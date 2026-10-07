const router = require('express').Router();
const { pool, dbError } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const ADMIN   = 'Administrator';
const MANAGER = 'SchoolManager';

// GET /api/transfers
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status, school_id, teacher_id, page = 1, limit = 20 } = req.query;
    let where = [];
    let params = [];

    if (search) {
      where.push(`(tr.teacher_name LIKE ? OR tr.teacher_tid LIKE ? OR tr.from_school_name LIKE ? OR tr.to_school_name LIKE ?)`);
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status)     { where.push('tr.status = ?');          params.push(status); }
    if (school_id)  { where.push('(tr.from_school_id = ? OR tr.to_school_id = ?)'); params.push(school_id, school_id); }
    if (teacher_id) { where.push('tr.teacher_id = ?');      params.push(teacher_id); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM transfers tr ${whereClause}`, params
    );
    const [rows] = await pool.query(
      `SELECT tr.* FROM transfers tr ${whereClause}
       ORDER BY tr.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// POST /api/transfers
router.post('/', authenticate, authorize(ADMIN, MANAGER), async (req, res) => {
  const { teacher_id, to_school_id, reason } = req.body;
  if (!teacher_id || !to_school_id) {
    return res.status(400).json({ success: false, message: 'Teacher and destination school required.' });
  }
  try {
    const [[teacher]] = await pool.query(
      `SELECT t.id, t.tid, t.name, t.school_id, s.name AS school_name
       FROM teachers t LEFT JOIN schools s ON s.id = t.school_id
       WHERE t.id = ?`, [teacher_id]
    );
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found.' });

    const [[toSchool]] = await pool.query('SELECT id, name FROM schools WHERE id = ?', [to_school_id]);
    if (!toSchool) return res.status(404).json({ success: false, message: 'Destination school not found.' });

    const [result] = await pool.query(
      `INSERT INTO transfers
         (teacher_id, teacher_name, teacher_tid, from_school_id, from_school_name,
          to_school_id, to_school_name, status, request_date, reason, requested_by)
       VALUES (?,?,?,?,?,?,?,?,CURDATE(),?,?)`,
      [teacher.id, teacher.name, teacher.tid, teacher.school_id, teacher.school_name,
       toSchool.id, toSchool.name, 'Pending', reason || null, req.user.id]
    );
    return res.status(201).json({ success: true, message: 'Transfer request created.', id: result.insertId });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// PATCH /api/transfers/:id/status
router.patch('/:id/status', authenticate, authorize(ADMIN), async (req, res) => {
  const { status, notes } = req.body;
  if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }
  try {
    const [[transfer]] = await pool.query('SELECT * FROM transfers WHERE id = ?', [req.params.id]);
    if (!transfer) return res.status(404).json({ success: false, message: 'Transfer not found.' });

    await pool.query(
      `UPDATE transfers SET status = ?, notes = ?, approved_by = ?,
       approved_date = IF(? = 'Approved', CURDATE(), NULL), updated_at = NOW()
       WHERE id = ?`,
      [status, notes || null, req.user.id, status, req.params.id]
    );

    // If approved — update teacher's school
    if (status === 'Approved' && transfer.to_school_id) {
      await pool.query('UPDATE teachers SET school_id = ? WHERE id = ?',
        [transfer.to_school_id, transfer.teacher_id]);

      // Update school counts
      if (transfer.from_school_id) {
        await pool.query(
          'UPDATE schools SET teachers = GREATEST(0, teachers - 1) WHERE id = ?',
          [transfer.from_school_id]
        );
      }
      await pool.query(
        'UPDATE schools SET teachers = teachers + 1 WHERE id = ?',
        [transfer.to_school_id]
      );
    }

    return res.json({ success: true, message: `Transfer ${status.toLowerCase()}.` });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// DELETE /api/transfers/:id
router.delete('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  try {
    await pool.query('DELETE FROM transfers WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Transfer deleted.' });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

module.exports = router;

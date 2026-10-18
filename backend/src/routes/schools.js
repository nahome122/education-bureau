const router = require('express').Router();
const { body } = require('express-validator');
const { pool, dbError } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { requireSchoolManagerAssignment, schoolIdForRequest } = require('../middleware/schoolScope');

const ADMIN = 'Administrator';
const MANAGER = 'SchoolManager';

// GET /api/schools
router.get('/', authenticate, requireSchoolManagerAssignment, async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const status = req.query.status || null;
    const assignedSchool = schoolIdForRequest(req);
    if (assignedSchool && req.query.school_id && Number(req.query.school_id) !== Number(assignedSchool)) {
      return res.status(403).json({ success: false, message: 'You can only access your assigned school.' });
    }
    const page   = parseInt(req.query.page  || '1');
    const limit  = parseInt(req.query.limit || '10');
    const offset = (page - 1) * limit;

    let sql = `SELECT s.*,
      (SELECT COUNT(*) FROM teachers t WHERE t.school_id = s.id) AS teacher_count,
      (SELECT COUNT(*) FROM staff st WHERE st.school_id = s.id) AS staff_total
      FROM schools s WHERE (s.name LIKE ? OR s.code LIKE ? OR s.principal LIKE ?)`;
    const params = [search, search, search];

    if (status) { sql += ' AND s.status = ?'; params.push(status); }
    if (assignedSchool) { sql += ' AND s.id = ?'; params.push(assignedSchool); }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM (${sql}) AS t`, params);
    const total = countRows[0].total;

    sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    const data = rows.map(({ teacher_count, staff_total, ...school }) => ({
      ...school,
      teachers: teacher_count,
      staff_count: staff_total,
    }));
    return res.json({ success: true, data, total, page, limit });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// POST /api/schools  (Admin)
router.post('/', authenticate, authorize(ADMIN),
  [
    body('name').trim().notEmpty().withMessage('School name required.'),
    body('code').trim().notEmpty().withMessage('School code required.'),
  ],
  validate,
  async (req, res) => {
    const { code, name, principal, phone, email, address, type, status, students } = req.body;
    try {
      const [dup] = await pool.query('SELECT id FROM schools WHERE code = ?', [code]);
      if (dup.length) return res.status(409).json({ success: false, message: 'School code already exists.' });

      const [result] = await pool.query(
        `INSERT INTO schools (code, name, principal, phone, email, address, type, status, students)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [code, name, principal || null, phone || null, email || null, address || null,
         type || 'Primary', status || 'Active', students || 0]
      );
      return res.status(201).json({ success: true, message: 'School created.', id: result.insertId });
    } catch (err) {
      const { status, message } = dbError(err);
      return res.status(status).json({ success: false, message });
    }
  }
);

// PUT /api/schools/:id  (Admin)
router.put('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  const { id } = req.params;
  const { code, name, principal, phone, email, address, type, status, students } = req.body;
  try {
    const [dup] = await pool.query('SELECT id FROM schools WHERE code = ? AND id != ?', [code, id]);
    if (dup.length) return res.status(409).json({ success: false, message: 'School code already exists.' });

    await pool.query(
      `UPDATE schools SET code=?,name=?,principal=?,phone=?,email=?,address=?,type=?,status=?,students=?,updated_at=NOW() WHERE id=?`,
      [code, name, principal || null, phone || null, email || null, address || null, type, status, students || 0, id]
    );
    return res.json({ success: true, message: 'School updated.' });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// DELETE /api/schools/:id  (Admin)
router.delete('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  try {
    await pool.query('DELETE FROM schools WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'School deleted.' });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

module.exports = router;

const router = require('express').Router();
const { body } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const ADMIN   = 'Administrator';
const MANAGER = 'SchoolManager';

// GET /api/staff
router.get('/', authenticate, async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const status = req.query.status || null;
    const school = req.query.school_id || null;
    const page   = parseInt(req.query.page  || '1');
    const limit  = parseInt(req.query.limit || '10');
    const offset = (page - 1) * limit;

    let sql = `
      SELECT st.*, d.name AS department_name, s.name AS school_name
      FROM staff st
      LEFT JOIN departments d ON d.id = st.department_id
      LEFT JOIN schools s ON s.id = st.school_id
      WHERE (st.name LIKE ? OR st.sid LIKE ? OR st.email LIKE ?)
    `;
    const params = [search, search, search];

    if (status) { sql += ' AND st.status = ?';    params.push(status); }
    if (school) { sql += ' AND st.school_id = ?'; params.push(school); }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM (${sql}) AS t`, params);
    const total = countRows[0].total;

    sql += ' ORDER BY st.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return res.json({ success: true, data: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/staff
router.post('/', authenticate, authorize(ADMIN, MANAGER),
  [
    body('name').trim().notEmpty().withMessage('Staff name required.'),
    body('sid').trim().notEmpty().withMessage('Staff ID required.'),
  ],
  validate,
  async (req, res) => {
    const { sid, name, gender, phone, email, position, department_id, school_id, salary, joining, status } = req.body;
    try {
      const [dup] = await pool.query('SELECT id FROM staff WHERE sid = ?', [sid]);
      if (dup.length) return res.status(409).json({ success: false, message: 'Staff ID already exists.' });

      const [result] = await pool.query(
        `INSERT INTO staff (sid, name, gender, phone, email, position, department_id, school_id, salary, joining, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [sid, name, gender || 'Male', phone || null, email || null, position || null,
         department_id || null, school_id || null, salary || 0, joining || null, status || 'Active']
      );
      return res.status(201).json({ success: true, message: 'Staff member added.', id: result.insertId });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// PUT /api/staff/:id
router.put('/:id', authenticate, authorize(ADMIN, MANAGER), async (req, res) => {
  const { id } = req.params;
  const { sid, name, gender, phone, email, position, department_id, school_id, salary, joining, status } = req.body;
  try {
    const [dup] = await pool.query('SELECT id FROM staff WHERE sid = ? AND id != ?', [sid, id]);
    if (dup.length) return res.status(409).json({ success: false, message: 'Staff ID already exists.' });

    await pool.query(
      `UPDATE staff SET sid=?,name=?,gender=?,phone=?,email=?,position=?,department_id=?,school_id=?,salary=?,joining=?,status=?,updated_at=NOW()
       WHERE id=?`,
      [sid, name, gender, phone || null, email || null, position || null,
       department_id || null, school_id || null, salary || 0, joining || null, status, id]
    );
    return res.json({ success: true, message: 'Staff updated.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/staff/:id
router.delete('/:id', authenticate, authorize(ADMIN, MANAGER), async (req, res) => {
  try {
    await pool.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Staff deleted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;

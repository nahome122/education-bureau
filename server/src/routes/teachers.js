const router = require('express').Router();
const { body } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const ADMIN   = 'Administrator';
const MANAGER = 'SchoolManager';
const OFFICER = 'AttendanceOfficer';

// GET /api/teachers
router.get('/', authenticate, async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const status = req.query.status || null;
    const school = req.query.school_id || null;
    const page   = parseInt(req.query.page  || '1');
    const limit  = parseInt(req.query.limit || '10');
    const offset = (page - 1) * limit;
    const sortOrder = req.query.sort === 'az' ? 'az' : 'recent';

    let sql = `
      SELECT t.*, d.name AS department_name, s.name AS school_name
      FROM teachers t
      LEFT JOIN departments d ON d.id = t.department_id
      LEFT JOIN schools s ON s.id = t.school_id
      WHERE (t.name LIKE ? OR t.tid LIKE ? OR t.email LIKE ?)
    `;
    const params = [search, search, search];

    if (status) { sql += ' AND t.status = ?';    params.push(status); }
    if (school) { sql += ' AND t.school_id = ?'; params.push(school); }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM (${sql}) AS t2`, params);
    const total = countRows[0].total;

    sql += sortOrder === 'az' ? ' ORDER BY t.name ASC LIMIT ? OFFSET ?' : ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    const data = rows.map(r => ({ ...r, subjects: JSON.parse(r.subjects || '[]') }));
    return res.json({ success: true, data, total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/teachers
router.post('/', authenticate, authorize(ADMIN, MANAGER),
  [
    body('name').trim().notEmpty().withMessage('Teacher name required.'),
    body('tid').trim().notEmpty().withMessage('Teacher ID required.'),
  ],
  validate,
  async (req, res) => {
    const {
      tid, name, gender, dob, phone, email, qualification,
      department_id, school_id, subjects, position, type,
      salary, experience, joining, status, semester1_score, semester2_score
    } = req.body;
    try {
      const [dup] = await pool.query('SELECT id FROM teachers WHERE tid = ?', [tid]);
      if (dup.length) return res.status(409).json({ success: false, message: 'Teacher ID already exists.' });

      const [result] = await pool.query(
        `INSERT INTO teachers (tid, name, gender, dob, phone, email, qualification,
          department_id, school_id, subjects, position, type, salary, experience, joining, status, semester1_score, semester2_score)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [tid, name, gender || 'Male', dob || null, phone || null, email || null,
         qualification || null, department_id || null, school_id || null,
         JSON.stringify(subjects || []), position || null, type || 'Permanent',
         salary || 0, experience || 0, joining || null, status || 'Active',
         semester1_score || 0, semester2_score || 0]
      );
      return res.status(201).json({ success: true, message: 'Teacher added.', id: result.insertId });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// PUT /api/teachers/:id
router.put('/:id', authenticate, authorize(ADMIN, MANAGER), async (req, res) => {
  const { id } = req.params;
  const {
    tid, name, gender, dob, phone, email, qualification,
    department_id, school_id, subjects, position, type,
    salary, experience, joining, status, semester1_score, semester2_score
  } = req.body;
  try {
    const [dup] = await pool.query('SELECT id FROM teachers WHERE tid = ? AND id != ?', [tid, id]);
    if (dup.length) return res.status(409).json({ success: false, message: 'Teacher ID already exists.' });

    await pool.query(
      `UPDATE teachers SET tid=?,name=?,gender=?,dob=?,phone=?,email=?,qualification=?,
        department_id=?,school_id=?,subjects=?,position=?,type=?,salary=?,experience=?,joining=?,status=?,semester1_score=?,semester2_score=?,updated_at=NOW()
       WHERE id=?`,
      [tid, name, gender, dob || null, phone || null, email || null, qualification || null,
       department_id || null, school_id || null, JSON.stringify(subjects || []),
       position || null, type, salary || 0, experience || 0, joining || null, status,
       semester1_score || 0, semester2_score || 0, id]
    );
    return res.json({ success: true, message: 'Teacher updated.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/teachers/:id
router.delete('/:id', authenticate, authorize(ADMIN, MANAGER), async (req, res) => {
  try {
    await pool.query('DELETE FROM teachers WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Teacher deleted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;

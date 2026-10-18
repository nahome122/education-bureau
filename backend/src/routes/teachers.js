const router = require('express').Router();
const { body } = require('express-validator');
const { pool, dbError } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { requireSchoolManagerAssignment, schoolIdForRequest } = require('../middleware/schoolScope');

const ADMIN   = 'Administrator';
const MANAGER = 'SchoolManager';
const OFFICER = 'AttendanceOfficer';

// GET /api/teachers
router.get('/', authenticate, requireSchoolManagerAssignment, async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const status = req.query.status || null;
    const assignedSchool = schoolIdForRequest(req);
    if (assignedSchool && req.query.school_id && Number(req.query.school_id) !== Number(assignedSchool)) {
      return res.status(403).json({ success: false, message: 'You can only access your assigned school.' });
    }
    const school = assignedSchool || req.query.school_id || null;
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
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// POST /api/teachers
router.post('/', authenticate, authorize(ADMIN, MANAGER), requireSchoolManagerAssignment,
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
    const assignedSchool = schoolIdForRequest(req);
    const targetSchool = assignedSchool || school_id || null;
    try {
      if (assignedSchool && department_id) {
        const [[department]] = await pool.query(
          'SELECT id FROM departments WHERE id = ? AND (school_id = ? OR school_id IS NULL)',
          [department_id, assignedSchool]
        );
        if (!department) return res.status(403).json({ success: false, message: 'Department is outside your assigned school.' });
      }
      const [dup] = await pool.query('SELECT id FROM teachers WHERE tid = ?', [tid]);
      if (dup.length) return res.status(409).json({ success: false, message: 'Teacher ID already exists.' });

      const [result] = await pool.query(
        `INSERT INTO teachers (tid, name, gender, dob, phone, email, qualification,
          department_id, school_id, subjects, position, type, salary, experience, joining, status, semester1_score, semester2_score)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [tid, name, gender || 'Male', dob || null, phone || null, email || null,
         qualification || null, department_id || null, targetSchool,
         JSON.stringify(subjects || []), position || null, type || 'Permanent',
         salary || 0, experience || 0, joining || null, status || 'Active',
         semester1_score || 0, semester2_score || 0]
      );
      return res.status(201).json({ success: true, message: 'Teacher added.', id: result.insertId });
    } catch (err) {
      const { status, message } = dbError(err);
      return res.status(status).json({ success: false, message });
    }
  }
);

// PUT /api/teachers/:id
router.put('/:id', authenticate, authorize(ADMIN, MANAGER), requireSchoolManagerAssignment, async (req, res) => {
  const { id } = req.params;
  const {
    tid, name, gender, dob, phone, email, qualification,
    department_id, school_id, subjects, position, type,
    salary, experience, joining, status, semester1_score, semester2_score
  } = req.body;
  const assignedSchool = schoolIdForRequest(req);
  try {
    if (assignedSchool && department_id) {
      const [[department]] = await pool.query(
        'SELECT id FROM departments WHERE id = ? AND (school_id = ? OR school_id IS NULL)',
        [department_id, assignedSchool]
      );
      if (!department) return res.status(403).json({ success: false, message: 'Department is outside your assigned school.' });
    }
    const [dup] = await pool.query('SELECT id FROM teachers WHERE tid = ? AND id != ?', [tid, id]);
    if (dup.length) return res.status(409).json({ success: false, message: 'Teacher ID already exists.' });

    const [result] = await pool.query(
      `UPDATE teachers SET tid=?,name=?,gender=?,dob=?,phone=?,email=?,qualification=?,
        department_id=?,school_id=?,subjects=?,position=?,type=?,salary=?,experience=?,joining=?,status=?,semester1_score=?,semester2_score=?,updated_at=NOW()
       WHERE id=?${assignedSchool ? ' AND school_id = ?' : ''}`,
      [tid, name, gender, dob || null, phone || null, email || null, qualification || null,
       department_id || null, assignedSchool || school_id || null, JSON.stringify(subjects || []),
       position || null, type, salary || 0, experience || 0, joining || null, status,
       semester1_score || 0, semester2_score || 0, id,
       ...(assignedSchool ? [assignedSchool] : [])]
    );
    if (assignedSchool && result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Teacher not found in your assigned school.' });
    }
    return res.json({ success: true, message: 'Teacher updated.' });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// DELETE /api/teachers/:id
router.delete('/:id', authenticate, authorize(ADMIN, MANAGER), requireSchoolManagerAssignment, async (req, res) => {
  try {
    const assignedSchool = schoolIdForRequest(req);
    const [result] = await pool.query(
      `DELETE FROM teachers WHERE id = ?${assignedSchool ? ' AND school_id = ?' : ''}`,
      [req.params.id, ...(assignedSchool ? [assignedSchool] : [])]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Teacher not found.' });
    return res.json({ success: true, message: 'Teacher deleted.' });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

module.exports = router;

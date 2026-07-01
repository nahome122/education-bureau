const router = require('express').Router();
const { body } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const ADMIN = 'Administrator';
const MANAGER = 'SchoolManager';

// GET /api/schools
router.get('/', authenticate, async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const status = req.query.status || null;
    const page   = parseInt(req.query.page  || '1');
    const limit  = parseInt(req.query.limit || '10');
    const offset = (page - 1) * limit;

    let sql = `SELECT * FROM schools WHERE (name LIKE ? OR code LIKE ? OR principal LIKE ?)`;
    const params = [search, search, search];

    if (status) { sql += ' AND status = ?'; params.push(status); }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM (${sql}) AS t`, params);
    const total = countRows[0].total;

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return res.json({ success: true, data: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
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
        `INSERT INTO schools (code, name, principal, phone, email, address, type, status, students,teachers,)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [code, name, principal || null, phone || null, email || null, address || null,
         type || 'Primary', status || 'Active', students || 0,teachers || null,]
      );
      return res.status(201).json({ success: true, message: 'School created.', id: result.insertId });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error.' });
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
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/schools/:id  (Admin)
router.delete('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  try {
    await pool.query('DELETE FROM schools WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'School deleted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;

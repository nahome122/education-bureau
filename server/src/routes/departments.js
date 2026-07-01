const router = require('express').Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const ADMIN = 'Administrator';

router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, s.name AS school_name FROM departments d LEFT JOIN schools s ON s.id = d.school_id ORDER BY d.name`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/', authenticate, authorize(ADMIN), async (req, res) => {
  const { name, head, description, school_id, status, color } = req.body;
  if (!name) return res.status(422).json({ success: false, message: 'Name required.' });
  try {
    const [result] = await pool.query(
      `INSERT INTO departments (name, head, description, school_id, status, color) VALUES (?,?,?,?,?,?)`,
      [name, head || null, description || null, school_id || null, status || 'Active', color || '#2563EB']
    );
    return res.status(201).json({ success: true, message: 'Department created.', id: result.insertId });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  const { name, head, description, school_id, status, color } = req.body;
  try {
    await pool.query(
      `UPDATE departments SET name=?,head=?,description=?,school_id=?,status=?,color=?,updated_at=NOW() WHERE id=?`,
      [name, head || null, description || null, school_id || null, status, color || '#2563EB', req.params.id]
    );
    return res.json({ success: true, message: 'Department updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  try {
    await pool.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Department deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;

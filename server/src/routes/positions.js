const router = require('express').Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const ADMIN = 'Administrator';

router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, d.name AS department_name FROM positions p LEFT JOIN departments d ON d.id = p.department_id ORDER BY p.title`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/', authenticate, authorize(ADMIN), async (req, res) => {
  const { title, department_id, description, status } = req.body;
  if (!title) return res.status(422).json({ success: false, message: 'Title required.' });
  try {
    const [result] = await pool.query(
      `INSERT INTO positions (title, department_id, description, status) VALUES (?,?,?,?)`,
      [title, department_id || null, description || null, status || 'Active']
    );
    return res.status(201).json({ success: true, message: 'Position created.', id: result.insertId });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  const { title, department_id, description, status } = req.body;
  try {
    await pool.query(
      `UPDATE positions SET title=?,department_id=?,description=?,status=? WHERE id=?`,
      [title, department_id || null, description || null, status, req.params.id]
    );
    return res.json({ success: true, message: 'Position updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  try {
    await pool.query('DELETE FROM positions WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Position deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;

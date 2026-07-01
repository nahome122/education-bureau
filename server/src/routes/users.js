const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, query } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const ADMIN = 'Administrator';

// GET /api/users  (Admin only)
router.get('/', authenticate, authorize(ADMIN), async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const role   = req.query.role   || null;
    const status = req.query.status || null;
    const page   = parseInt(req.query.page  || '1');
    const limit  = parseInt(req.query.limit || '10');
    const offset = (page - 1) * limit;

    let sql = `
      SELECT u.id, u.full_name, u.username, u.email, u.phone,
             u.status, u.last_login, u.created_at,
             r.id AS role_id, r.name AS role_name, r.label AS role_label,
             s.name AS school_name, u.school_id
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN schools s ON s.id = u.school_id
      WHERE (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)
    `;
    const params = [search, search, search];

    if (role)   { sql += ' AND r.name = ?';   params.push(role); }
    if (status) { sql += ' AND u.status = ?';  params.push(status); }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM (${sql}) AS t`, params
    );
    const total = countRows[0].total;

    sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);

    return res.json({ success: true, data: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/users  (Admin only)
router.post(
  '/',
  authenticate, authorize(ADMIN),
  [
    body('full_name').trim().notEmpty().withMessage('Full name required.'),
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 chars.'),
    body('email').isEmail().withMessage('Valid email required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 chars.'),
    body('role_id').isInt({ min: 1 }).withMessage('Role required.'),
  ],
  validate,
  async (req, res) => {
    const { full_name, username, email, phone, password, role_id, school_id, department_id, status } = req.body;
    try {
      // Check duplicate
      const [dup] = await pool.query(
        'SELECT id FROM users WHERE username = ? OR email = ?', [username, email]
      );
      if (dup.length) {
        return res.status(409).json({ success: false, message: 'Username or email already exists.' });
      }

      const hash = await bcrypt.hash(password, 12);
      const [result] = await pool.query(
        `INSERT INTO users (full_name, username, email, phone, password_hash, role_id, school_id, department_id, status, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [full_name, username, email, phone || null, hash, role_id,
         school_id || null, department_id || null, status || 'Active', req.user.id]
      );

      return res.status(201).json({ success: true, message: 'User created successfully.', id: result.insertId });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// PUT /api/users/:id  (Admin only)
router.put('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  const { id } = req.params;
  const { full_name, username, email, phone, role_id, school_id, department_id, status } = req.body;

  try {
    // Check duplicate excluding self
    const [dup] = await pool.query(
      'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?', [username, email, id]
    );
    if (dup.length) {
      return res.status(409).json({ success: false, message: 'Username or email already exists.' });
    }

    await pool.query(
      `UPDATE users SET full_name=?, username=?, email=?, phone=?, role_id=?, school_id=?, department_id=?, status=?, updated_at=NOW()
       WHERE id=?`,
      [full_name, username, email, phone || null, role_id, school_id || null, department_id || null, status, id]
    );

    return res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/users/:id  (Admin only, cannot delete self)
router.delete('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
  }
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/users/:id/reset-password  (Admin only)
router.post('/:id/reset-password', authenticate, authorize(ADMIN), async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(422).json({ success: false, message: 'Password must be at least 6 characters.' });
  }
  try {
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    return res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH /api/users/:id/status  (Admin only)
router.patch('/:id/status', authenticate, authorize(ADMIN), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['Active', 'Inactive'].includes(status)) {
    return res.status(422).json({ success: false, message: 'Invalid status.' });
  }
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'Cannot change your own status.' });
  }
  try {
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    return res.json({ success: true, message: `User ${status === 'Active' ? 'activated' : 'deactivated'}.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/users/roles  (Admin)
router.get('/roles', authenticate, authorize(ADMIN), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, label FROM roles ORDER BY id');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;

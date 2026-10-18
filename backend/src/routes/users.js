const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, query } = require('express-validator');
const { pool, dbError } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const ADMIN = 'Administrator';
const MANAGER = 'SchoolManager';

const ensureSchoolExists = async (connection, schoolId) => {
  if (!Number.isInteger(Number(schoolId)) || Number(schoolId) < 1) return false;
  const [[school]] = await connection.query('SELECT id FROM schools WHERE id = ?', [schoolId]);
  return Boolean(school);
};

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
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
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
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[role]] = await connection.query('SELECT name FROM roles WHERE id = ?', [role_id]);
      if (!role) {
        await connection.rollback();
        return res.status(422).json({ success: false, message: 'Selected role does not exist.' });
      }
      if (role.name === 'Viewer') {
        await connection.rollback();
        return res.status(422).json({ success: false, message: 'The Viewer role is no longer available.' });
      }
      if (role.name === MANAGER && !(await ensureSchoolExists(connection, school_id))) {
        await connection.rollback();
        return res.status(422).json({ success: false, message: 'A valid school is required for a School Manager.' });
      }

      // Check duplicate
      const [dup] = await connection.query(
        'SELECT id FROM users WHERE username = ? OR email = ?', [username, email]
      );
      if (dup.length) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Username or email already exists.' });
      }

      const hash = await bcrypt.hash(password, 12);
      const [result] = await connection.query(
        `INSERT INTO users (full_name, username, email, phone, password_hash, role_id, school_id, department_id, status, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [full_name, username, email, phone || null, hash, role_id,
         school_id || null, department_id || null, status || 'Active', req.user.id]
      );

      if (role.name === MANAGER) {
        const assignmentStatus = status === 'Inactive' ? 'Inactive' : 'Active';
        await connection.query(
          `INSERT INTO school_manager_assignments (user_id, school_id, status, assigned_by)
           VALUES (?, ?, ?, ?)`,
          [result.insertId, school_id, assignmentStatus, req.user.id]
        );
      }
      await connection.commit();
      return res.status(201).json({ success: true, message: 'User created successfully.', id: result.insertId });
    } catch (err) {
      await connection.rollback();
      const { status, message } = dbError(err);
      return res.status(status).json({ success: false, message });
    } finally {
      connection.release();
    }
  }
);

// PUT /api/users/:id  (Admin only)
router.put('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  const { id } = req.params;
  const { full_name, username, email, phone, role_id, school_id, department_id, status } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[role]] = await connection.query('SELECT name FROM roles WHERE id = ?', [role_id]);
    if (!role) {
      await connection.rollback();
      return res.status(422).json({ success: false, message: 'Selected role does not exist.' });
    }
    if (role.name === 'Viewer') {
      await connection.rollback();
      return res.status(422).json({ success: false, message: 'The Viewer role is no longer available.' });
    }
    if (role.name === MANAGER && !(await ensureSchoolExists(connection, school_id))) {
      await connection.rollback();
      return res.status(422).json({ success: false, message: 'A valid school is required for a School Manager.' });
    }
    const [[existing]] = await connection.query(
      `SELECT r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? FOR UPDATE`,
      [id]
    );
    if (!existing) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Check duplicate excluding self
    const [dup] = await connection.query(
      'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?', [username, email, id]
    );
    if (dup.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Username or email already exists.' });
    }

    await connection.query(
      `UPDATE users SET full_name=?, username=?, email=?, phone=?, role_id=?, school_id=?, department_id=?, status=?, updated_at=NOW()
       WHERE id=?`,
      [full_name, username, email, phone || null, role_id,
       role.name === MANAGER ? school_id : school_id || null, department_id || null, status, id]
    );

    if (role.name === MANAGER) {
      const nextStatus = status === 'Inactive' ? 'Inactive' : 'Active';
      await connection.query(
        `INSERT INTO school_manager_assignments (user_id, school_id, status, assigned_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE school_id = VALUES(school_id),
           status = VALUES(status), assigned_by = VALUES(assigned_by), assigned_at = NOW()`,
        [id, school_id, nextStatus, req.user.id]
      );
    } else if (existing.role_name === MANAGER) {
      await connection.query(
        `UPDATE school_manager_assignments SET status = 'Inactive' WHERE user_id = ?`,
        [id]
      );
    }
    await connection.commit();
    return res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) {
    await connection.rollback();
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  } finally {
    connection.release();
  }
});

// DELETE /api/users/:id  (Admin only, cannot delete self)
router.delete('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[user]] = await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [id]);
    if (!user) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    await connection.query('DELETE FROM users WHERE id = ?', [id]);
    await connection.commit();
    return res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    await connection.rollback();
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  } finally {
    connection.release();
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
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
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
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [[user]] = await connection.query(
      `SELECT u.school_id, u.status, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? FOR UPDATE`,
      [id]
    );
    if (!user) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.role_name === MANAGER && status === 'Active' && !user.school_id) {
      await connection.rollback();
      return res.status(422).json({ success: false, message: 'Assign a school before reactivating this manager.' });
    }
    await connection.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    if (user.role_name === MANAGER) {
      await connection.query(
        'UPDATE school_manager_assignments SET status = ? WHERE user_id = ?',
        [status, id]
      );
    }
    await connection.commit();
    return res.json({ success: true, message: `User ${status === 'Active' ? 'activated' : 'deactivated'}.` });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('User status transaction rollback failed:', rollbackError.message);
      }
    }
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/users/roles  (Admin)
router.get('/roles', authenticate, authorize(ADMIN), async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name, label FROM roles WHERE name <> 'Viewer' ORDER BY id");
    return res.json({ success: true, data: rows });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

module.exports = router;

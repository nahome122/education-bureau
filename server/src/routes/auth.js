const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const normalizeUsername = (value = '') => (value || '').trim().toLowerCase();

const makeEmployeeUsername = (name = '') => {
  const parts = (name || '').trim().toLowerCase().split(/\s+/);
  if (parts.length <= 1) return parts[0] || '';
  return `${parts[0]}.${parts[parts.length - 1]}`;
};

const getEmployeeDefaultPassword = () => process.env.EMPLOYEE_DEFAULT_PASSWORD || 'Employee@123';

const buildEmployeeAuthUser = (employee, username) => ({
  id: `emp_${employee.type}_${employee.id}`,
  full_name: employee.name,
  username,
  email: employee.email || '',
  phone: employee.phone || '',
  role_id: null,
  role_name: employee.type === 'teacher' ? 'Teacher' : 'Staff',
  role_label: employee.type === 'teacher' ? 'Teacher' : 'Staff',
  school_id: employee.school_id || null,
  school_name: employee.school_name || '',
  status: employee.status,
  permissions: ['dashboard', 'profile', 'id-cards', 'attendance'],
  employee_type: employee.type,
  employee_id: employee.id,
  employee_code: employee.emp_code,
  user_source: 'employee',
});

const generateToken = (user) => {
  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : JSON.parse(user.permissions || '[]');

  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role_name,
      role_name: user.role_name,
      role_label: user.role_label,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      school_id: user.school_id,
      school_name: user.school_name,
      permissions,
      status: user.status,
      user_source: user.user_source || 'system',
      employee_type: user.employee_type,
      employee_id: user.employee_id,
      employee_code: user.employee_code,
    },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
};

// POST /api/auth/login
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  async (req, res) => {
    const { username, password } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ua = req.headers['user-agent'] || '';

    try {
      const normalizedUsername = normalizeUsername(username);
      const [rows] = await pool.query(
        `SELECT u.*, r.name AS role_name, r.label AS role_label, r.permissions,
                s.name AS school_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN schools s ON s.id = u.school_id
         WHERE LOWER(u.username) = LOWER(?)`,
        [username]
      );

      let user = rows[0];
      let authMode = 'system';

      if (!user) {
        const [teacherRows] = await pool.query(
          `SELECT t.id, t.tid AS emp_code, t.name, t.email, t.phone, t.status, t.school_id, s.name AS school_name
           FROM teachers t
           LEFT JOIN schools s ON s.id = t.school_id`
        );
        const [staffRows] = await pool.query(
          `SELECT t.id, t.sid AS emp_code, t.name, t.email, t.phone, t.status, t.school_id, s.name AS school_name
           FROM staff t
           LEFT JOIN schools s ON s.id = t.school_id`
        );

        const employee = [...teacherRows.map((row) => ({ ...row, type: 'teacher' })), ...staffRows.map((row) => ({ ...row, type: 'staff' }))]
          .find((row) => normalizeUsername(makeEmployeeUsername(row.name)) === normalizedUsername);

        if (employee) {
          authMode = 'employee';
          user = buildEmployeeAuthUser(employee, normalizedUsername);
        }
      }

      // Log attempt
      const logAttempt = async (status) => {
        await pool.query(
          'INSERT INTO login_logs (user_id, username, ip_address, user_agent, status) VALUES (?,?,?,?,?)',
          [user?.id || null, username, ip, ua, status]
        ).catch(() => {});
      };

      if (!user) {
        await logAttempt('failed');
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }

      if (user.status !== 'Active') {
        await logAttempt('failed');
        return res.status(403).json({ success: false, message: 'Your account is deactivated. Contact the Administrator.' });
      }

      let valid = false;
      if (authMode === 'employee') {
        valid = password === getEmployeeDefaultPassword();
      } else {
        valid = await bcrypt.compare(password, user.password_hash);
      }

      if (!valid) {
        await logAttempt('failed');
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }

      // Update last login
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
      await logAttempt('success');

      const token = generateToken(user);

      const permissions = Array.isArray(user.permissions)
        ? user.permissions
        : JSON.parse(user.permissions || '[]');

      return res.json({
        success: true,
        token,
        user: {
          id:          user.id,
          full_name:   user.full_name,
          username:    user.username,
          email:       user.email,
          phone:       user.phone,
          role_id:     user.role_id,
          role_name:   user.role_name,
          role_label:  user.role_label,
          school_id:   user.school_id,
          school_name: user.school_name,
          permissions,
          employee_type: user.employee_type,
          employee_id: user.employee_id,
          employee_code: user.employee_code,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const u = req.user;
  res.json({
    success: true,
    user: {
      id:          u.id,
      full_name:   u.full_name,
      username:    u.username,
      email:       u.email,
      phone:       u.phone,
      role_id:     u.role_id,
      role_name:   u.role_name,
      role_label:  u.role_label,
      school_id:   u.school_id,
      school_name: u.school_name,
      permissions: u.permissions,
    },
  });
});

// PUT /api/auth/profile — self-service profile update
router.put(
  '/profile',
  authenticate,
  [
    body('full_name').trim().notEmpty().withMessage('Full name is required.'),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('Valid email required.'),
    body('phone').optional({ values: 'falsy' }).isString(),
  ],
  validate,
  async (req, res) => {
    const { full_name, phone, email } = req.body;
    try {
      await pool.query(
        'UPDATE users SET full_name = ?, phone = ?, email = ?, updated_at = NOW() WHERE id = ?',
        [full_name, phone || null, email || null, req.user.id]
      );

      const [rows] = await pool.query(
        `SELECT u.id, u.full_name, u.username, u.email, u.phone,
                u.role_id, u.school_id, u.department_id, u.status,
                r.name AS role_name, r.label AS role_label, r.permissions,
                s.name AS school_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN schools s ON s.id = u.school_id
         WHERE u.id = ?`,
        [req.user.id]
      );

      const updated = rows[0];
      return res.json({
        success: true,
        message: 'Profile updated successfully.',
        user: {
          id:          updated.id,
          full_name:   updated.full_name,
          username:    updated.username,
          email:       updated.email,
          phone:       updated.phone,
          role_id:     updated.role_id,
          role_name:   updated.role_name,
          role_label:  updated.role_label,
          school_id:   updated.school_id,
          school_name: updated.school_name,
          permissions: JSON.parse(updated.permissions || '[]'),
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  [
    body('current_password').notEmpty().withMessage('Current password required.'),
    body('new_password')
      .isLength({ min: 6 }).withMessage('New password must be at least 6 characters.'),
  ],
  validate,
  async (req, res) => {
    const { current_password, new_password } = req.body;
    try {
      const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });

      const valid = await bcrypt.compare(current_password, rows[0].password_hash);
      if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

      const hash = await bcrypt.hash(new_password, 12);
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

      return res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

module.exports = router;

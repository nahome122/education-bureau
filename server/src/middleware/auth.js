const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.email, u.phone,
              u.role_id, u.school_id, u.department_id, u.status,
              r.name AS role_name, r.label AS role_label, r.permissions,
              s.name AS school_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN schools s ON s.id = u.school_id
       WHERE u.id = ? AND u.status = 'Active'`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }

    req.user = {
      ...rows[0],
      permissions: JSON.parse(rows[0].permissions || '[]'),
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// Role-based access control
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  if (!allowedRoles.includes(req.user.role_name)) {
    return res.status(403).json({ success: false, message: '403 Access Denied. You do not have permission.' });
  }
  next();
};

// Permission-based access control
const hasPermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  const perms = req.user.permissions;
  if (perms.includes('*') || perms.includes(permission)) {
    return next();
  }
  return res.status(403).json({ success: false, message: '403 Access Denied.' });
};

module.exports = { authenticate, authorize, hasPermission };

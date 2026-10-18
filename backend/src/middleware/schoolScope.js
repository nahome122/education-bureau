const { pool } = require('../config/database');

const requireSchoolManagerAssignment = async (req, res, next) => {
  if (req.user?.role_name === 'AttendanceOfficer') {
    if (!req.user.school_id) {
      return res.status(403).json({
        success: false,
        message: 'An assigned school is required to access school management.',
      });
    }
    return next();
  }
  if (req.user?.role_name !== 'SchoolManager') return next();

  try {
    const [[assignment]] = await pool.query(
      `SELECT a.school_id, s.name AS school_name
       FROM school_manager_assignments a
       JOIN users u ON u.id = a.user_id
       JOIN roles r ON r.id = u.role_id
       JOIN schools s ON s.id = a.school_id
       WHERE a.user_id = ? AND a.status = 'Active'
         AND u.status = 'Active' AND r.name = 'SchoolManager'
         AND u.school_id = a.school_id`,
      [req.user.id]
    );
    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: 'An active school assignment is required to access school management.',
      });
    }
    req.schoolScope = assignment;
    return next();
  } catch (error) {
    console.error('School assignment lookup failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to verify school assignment.' });
  }
};

const schoolIdForRequest = (req) =>
  ['SchoolManager', 'AttendanceOfficer'].includes(req.user?.role_name)
    ? (req.user.role_name === 'AttendanceOfficer' ? req.user.school_id : req.schoolScope?.school_id) || null
    : null;

module.exports = { requireSchoolManagerAssignment, schoolIdForRequest };

const router = require('express').Router();
const { pool, dbError } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { requireSchoolManagerAssignment, schoolIdForRequest } = require('../middleware/schoolScope');

const employeeUsername = (name = '') => {
  const parts = name.trim().toLowerCase().split(/\s+/);
  return parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] || '';
};

router.delete(
  '/:type/:id',
  authenticate, authorize('Administrator', 'SchoolManager'), requireSchoolManagerAssignment,
  async (req, res) => {
    const { type } = req.params;
    const id = Number.parseInt(req.params.id, 10);
    if (!['teacher', 'staff', 'user'].includes(type) || !Number.isInteger(id) || id < 1) {
      return res.status(422).json({ success: false, message: 'Invalid history target.' });
    }

    const assignedSchool = schoolIdForRequest(req);
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const counts = { loginLogs: 0, reportEvents: 0 };
      if (type === 'teacher' || type === 'staff') {
        const table = type === 'teacher' ? 'teachers' : 'staff';
        const [[employee]] = await connection.query(
          `SELECT id, name, custom_username, school_id FROM ${table} WHERE id = ? FOR UPDATE`,
          [id]
        );
        if (!employee) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: `${type} not found.` });
        }
        if (assignedSchool && Number(employee.school_id) !== Number(assignedSchool)) {
          await connection.rollback();
          return res.status(403).json({ success: false, message: 'You can only clear history for your assigned school.' });
        }

        const usernames = [...new Set([
          employee.custom_username?.trim().toLowerCase(),
          employeeUsername(employee.name),
        ].filter(Boolean))];
        if (usernames.length) {
          const [result] = await connection.query(
            `DELETE FROM login_logs WHERE LOWER(username) IN (${usernames.map(() => '?').join(',')})`,
            usernames
          );
          counts.loginLogs = result.affectedRows;
        }
      } else {
        const [[targetUser]] = await connection.query(
          `SELECT u.id, u.school_id, r.name AS role_name
           FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? FOR UPDATE`,
          [id]
        );
        if (!targetUser) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: 'User not found.' });
        }
        if (assignedSchool && (
          targetUser.role_name !== 'SchoolManager' ||
          Number(targetUser.school_id) !== Number(assignedSchool)
        )) {
          await connection.rollback();
          return res.status(403).json({ success: false, message: 'You can only clear history for managers in your assigned school.' });
        }

        const [loginResult] = await connection.query('DELETE FROM login_logs WHERE user_id = ?', [id]);
        counts.loginLogs = loginResult.affectedRows;
        if (targetUser.role_name === 'SchoolManager') {
          const [eventResult] = await connection.query(
            `DELETE e FROM school_report_events e
             JOIN school_reports r ON r.id = e.report_id
             WHERE r.submitted_by = ?`,
            [id]
          );
          counts.reportEvents = eventResult.affectedRows;

        }
      }

      await connection.commit();
      return res.json({
        success: true,
        message: 'History entries cleared. Attendance and submitted reports were kept.',
        deleted: counts,
      });
    } catch (err) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error('History cleanup rollback failed:', rollbackError.message);
        }
      }
      const { status, message } = dbError(err);
      return res.status(status).json({ success: false, message });
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;

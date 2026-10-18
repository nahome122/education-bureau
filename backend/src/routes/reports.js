const router = require('express').Router();
const { pool, dbError } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireSchoolManagerAssignment, schoolIdForRequest } = require('../middleware/schoolScope');

// GET /api/reports/dashboard
router.get('/dashboard', authenticate, requireSchoolManagerAssignment, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const assignedSchool = schoolIdForRequest(req);

    const schoolClause = assignedSchool ? ' AND school_id = ?' : '';
    const [[{ totalSchools }]] = await pool.query(
      `SELECT COUNT(*) AS totalSchools FROM schools WHERE status = 'Active'${assignedSchool ? ' AND id = ?' : ''}`,
      assignedSchool ? [assignedSchool] : []
    );
    const [[{ totalTeachers }]] = await pool.query(
      `SELECT COUNT(*) AS totalTeachers FROM teachers WHERE status = 'Active'${schoolClause}`,
      assignedSchool ? [assignedSchool] : []
    );
    const [[{ totalStaff }]] = await pool.query(
      `SELECT COUNT(*) AS totalStaff FROM staff WHERE status = 'Active'${schoolClause}`,
      assignedSchool ? [assignedSchool] : []
    );
    const [[{ totalStudents }]] = await pool.query(
      `SELECT COALESCE(SUM(students), 0) AS totalStudents FROM schools
       WHERE status = 'Active'${assignedSchool ? ' AND id = ?' : ''}`,
      assignedSchool ? [assignedSchool] : []
    );
    const [[{ totalUsers }]] = await pool.query(
      `SELECT COUNT(*) AS totalUsers FROM users${assignedSchool ? ' WHERE school_id = ?' : ''}`,
      assignedSchool ? [assignedSchool] : []
    );
    const [[{ activeUsers }]] = await pool.query(
      `SELECT COUNT(*) AS activeUsers FROM users WHERE status = 'Active'${schoolClause}`,
      assignedSchool ? [assignedSchool] : []
    );
    const [[{ inactiveUsers }]] = await pool.query(
      `SELECT COUNT(*) AS inactiveUsers FROM users WHERE status = 'Inactive'${schoolClause}`,
      assignedSchool ? [assignedSchool] : []
    );

    const attendanceScope = assignedSchool
      ? ` AND ((a.employee_type = 'teacher' AND t.school_id = ?)
           OR (a.employee_type = 'staff' AND st.school_id = ?))`
      : '';
    const attendanceParams = (base) => assignedSchool ? [...base, assignedSchool, assignedSchool] : base;
    const attendanceJoin = `FROM attendance a
      LEFT JOIN teachers t ON a.employee_id = t.id AND a.employee_type = 'teacher'
      LEFT JOIN staff st ON a.employee_id = st.id AND a.employee_type = 'staff'`;
    const [[{ presentToday }]] = await pool.query(
      `SELECT COUNT(*) AS presentToday ${attendanceJoin}
       WHERE a.date = ? AND a.status = 'Present'${attendanceScope}`,
      attendanceParams([today])
    );
    const [[{ absentToday }]] = await pool.query(
      `SELECT COUNT(*) AS absentToday ${attendanceJoin}
       WHERE a.date = ? AND a.status = 'Absent'${attendanceScope}`,
      attendanceParams([today])
    );

    // Monthly attendance for chart (last 6 months)
    const [monthly] = await pool.query(`
      SELECT DATE_FORMAT(a.date, '%b %Y') AS month,
             COUNT(*) AS total,
             SUM(a.status = 'Present') AS present
      ${attendanceJoin}
      WHERE a.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)${attendanceScope}
      GROUP BY DATE_FORMAT(a.date, '%Y-%m')
      ORDER BY MIN(a.date)
    `, assignedSchool ? [assignedSchool, assignedSchool] : []);

    // Recent login logs
    const [recentLogins] = assignedSchool ? [[]] : await pool.query(`
      SELECT l.username, l.status, l.ip_address, l.created_at, u.full_name, r.label AS role
      FROM login_logs l
      LEFT JOIN users u ON u.id = l.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY l.created_at DESC
      LIMIT 10
    `);
    const [[{ totalSchoolManagers }]] = await pool.query(
      `SELECT COUNT(*) AS totalSchoolManagers
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'SchoolManager'${assignedSchool ? ' AND u.school_id = ?' : ''}`,
      assignedSchool ? [assignedSchool] : []
    );
    const [[{ pendingReports }]] = await pool.query(
      `SELECT COUNT(*) AS pendingReports FROM school_reports
       WHERE status IN ('Submitted','Under Review','Needs Correction')${assignedSchool ? ' AND school_id = ?' : ''}`,
      assignedSchool ? [assignedSchool] : []
    );
    const [recentReports] = await pool.query(
      `SELECT r.id, r.title, r.report_type, r.status, r.submitted_at,
              s.name AS school_name, u.full_name AS manager_name
       FROM school_reports r JOIN schools s ON s.id = r.school_id
       JOIN users u ON u.id = r.submitted_by
       ${assignedSchool ? 'WHERE r.school_id = ?' : ''}
       ORDER BY r.submitted_at DESC LIMIT 5`,
      assignedSchool ? [assignedSchool] : []
    );

    return res.json({
      success: true,
      data: {
        totalSchools, totalTeachers, totalStaff, totalStudents,
        totalUsers, activeUsers, inactiveUsers, totalSchoolManagers, pendingReports,
        presentToday, absentToday,
        monthly,
        recentLogins,
        recentReports,
        school: assignedSchool ? req.schoolScope : null,
      }
    });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// GET /api/reports/attendance?from=&to=&school_id=
router.get('/attendance', authenticate, requireSchoolManagerAssignment, async (req, res) => {
  try {
    const from   = req.query.from   || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to     = req.query.to     || new Date().toISOString().split('T')[0];
    const assignedSchool = schoolIdForRequest(req);
    if (assignedSchool && req.query.school_id && Number(req.query.school_id) !== Number(assignedSchool)) {
      return res.status(403).json({ success: false, message: 'You can only access reports for your assigned school.' });
    }
    const school = assignedSchool || req.query.school_id || null;

    let sql = `
      SELECT a.date, a.employee_type, a.status, COUNT(*) AS count
      FROM attendance a
      LEFT JOIN teachers t ON a.employee_id = t.id AND a.employee_type = 'teacher'
      LEFT JOIN staff    st ON a.employee_id = st.id AND a.employee_type = 'staff'
      WHERE a.date BETWEEN ? AND ?
    `;
    const params = [from, to];

    if (school) {
      sql += ` AND (t.school_id = ? OR st.school_id = ?)`;
      params.push(school, school);
    }

    sql += ' GROUP BY a.date, a.employee_type, a.status ORDER BY a.date';

    const [rows] = await pool.query(sql, params);
    return res.json({ success: true, data: rows, from, to });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// GET /api/reports/logs
router.get('/logs', authenticate, async (req, res) => {
  const role = req.user.role_name;
  if (role !== 'Administrator') {
    return res.status(403).json({ success: false, message: '403 Access Denied.' });
  }
  try {
    const page  = parseInt(req.query.page  || '1');
    const limit = parseInt(req.query.limit || '20');
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT l.*, u.full_name FROM login_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM login_logs`);
    return res.json({ success: true, data: rows, total, page, limit });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

module.exports = router;

const router = require('express').Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/reports/dashboard
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [[{ totalSchools }]]   = await pool.query(`SELECT COUNT(*) AS totalSchools FROM schools WHERE status = 'Active'`);
    const [[{ totalTeachers }]]  = await pool.query(`SELECT COUNT(*) AS totalTeachers FROM teachers WHERE status = 'Active'`);
    const [[{ totalStaff }]]     = await pool.query(`SELECT COUNT(*) AS totalStaff FROM staff WHERE status = 'Active'`);
    const [[{ totalStudents }]]  = await pool.query(`SELECT COALESCE(SUM(students), 0) AS totalStudents FROM schools WHERE status = 'Active'`);
    const [[{ totalUsers }]]     = await pool.query(`SELECT COUNT(*) AS totalUsers FROM users`);
    const [[{ activeUsers }]]    = await pool.query(`SELECT COUNT(*) AS activeUsers FROM users WHERE status = 'Active'`);
    const [[{ inactiveUsers }]]  = await pool.query(`SELECT COUNT(*) AS inactiveUsers FROM users WHERE status = 'Inactive'`);

    const [[{ presentToday }]]   = await pool.query(
      `SELECT COUNT(*) AS presentToday FROM attendance WHERE date = ? AND status = 'Present'`, [today]
    );
    const [[{ absentToday }]]    = await pool.query(
      `SELECT COUNT(*) AS absentToday FROM attendance WHERE date = ? AND status = 'Absent'`, [today]
    );

    // Monthly attendance for chart (last 6 months)
    const [monthly] = await pool.query(`
      SELECT DATE_FORMAT(date, '%b %Y') AS month,
             COUNT(*) AS total,
             SUM(status = 'Present') AS present
      FROM attendance
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(date, '%Y-%m')
      ORDER BY MIN(date)
    `);

    // Recent login logs
    const [recentLogins] = await pool.query(`
      SELECT l.username, l.status, l.ip_address, l.created_at, u.full_name, r.label AS role
      FROM login_logs l
      LEFT JOIN users u ON u.id = l.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY l.created_at DESC
      LIMIT 10
    `);

    return res.json({
      success: true,
      data: {
        totalSchools, totalTeachers, totalStaff, totalStudents,
        totalUsers, activeUsers, inactiveUsers,
        presentToday, absentToday,
        monthly,
        recentLogins,
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/reports/attendance?from=&to=&school_id=
router.get('/attendance', authenticate, async (req, res) => {
  try {
    const from   = req.query.from   || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to     = req.query.to     || new Date().toISOString().split('T')[0];
    const school = req.query.school_id || null;

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
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
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
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;

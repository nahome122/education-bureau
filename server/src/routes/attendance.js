const router = require('express').Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const ADMIN   = 'Administrator';
const MANAGER = 'SchoolManager';
const OFFICER = 'AttendanceOfficer';

// GET /api/attendance?date=&school_id=&type=teacher|staff
router.get('/', authenticate, async (req, res) => {
  try {
    const date   = req.query.date      || new Date().toISOString().split('T')[0];
    const type   = req.query.type      || 'teacher';
    const school = req.query.school_id || null;
    const page   = parseInt(req.query.page  || '1');
    const limit  = parseInt(req.query.limit || '50');
    const offset = (page - 1) * limit;

    let nameSql, idField;
    if (type === 'teacher') {
      nameSql  = `SELECT t.id, t.tid AS emp_id, t.name, t.position, s.name AS school_name,
                          a.status AS att_status, a.check_in, a.check_out, a.note
                   FROM teachers t
                   LEFT JOIN schools s ON s.id = t.school_id
                   LEFT JOIN attendance a ON a.employee_id = t.id AND a.employee_type = 'teacher' AND a.date = ?
                   WHERE t.status = 'Active'`;
    } else {
      nameSql  = `SELECT st.id, st.sid AS emp_id, st.name, st.position, s.name AS school_name,
                          a.status AS att_status, a.check_in, a.check_out, a.note
                   FROM staff st
                   LEFT JOIN schools s ON s.id = st.school_id
                   LEFT JOIN attendance a ON a.employee_id = st.id AND a.employee_type = 'staff' AND a.date = ?
                   WHERE st.status = 'Active'`;
    }

    const params = [date];
    if (school) { nameSql += ' AND ' + (type === 'teacher' ? 't' : 'st') + '.school_id = ?'; params.push(school); }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM (${nameSql}) AS c`, params);
    const total = countRows[0].total;

    nameSql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(nameSql, params);
    return res.json({ success: true, data: rows, date, total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/attendance/mark  (bulk mark)
router.post('/mark', authenticate, authorize(ADMIN, MANAGER, OFFICER), async (req, res) => {
  const { date, employee_type, records } = req.body;
  // records: [{ employee_id, status, check_in, check_out, note }]
  if (!date || !employee_type || !Array.isArray(records)) {
    return res.status(422).json({ success: false, message: 'Invalid payload.' });
  }
  try {
    const conn = await require('../config/database').pool.getConnection();
    await conn.beginTransaction();
    try {
      for (const r of records) {
        await conn.query(
          `INSERT INTO attendance (employee_id, employee_type, date, status, check_in, check_out, note, marked_by)
           VALUES (?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE status=VALUES(status), check_in=VALUES(check_in), check_out=VALUES(check_out), note=VALUES(note), marked_by=VALUES(marked_by)`,
          [r.employee_id, employee_type, date, r.status || 'Present',
           r.check_in || null, r.check_out || null, r.note || null, req.user.id]
        );
      }
      await conn.commit();
      conn.release();
      return res.json({ success: true, message: `Attendance saved for ${records.length} employees.` });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/attendance/stats?date=
router.get('/stats', authenticate, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const [stats] = await pool.query(
      `SELECT status, COUNT(*) AS count FROM attendance WHERE date = ? GROUP BY status`,
      [date]
    );

    const [totalTeachers] = await pool.query(`SELECT COUNT(*) AS total FROM teachers WHERE status = 'Active'`);
    const [totalStaff]    = await pool.query(`SELECT COUNT(*) AS total FROM staff    WHERE status = 'Active'`);

    return res.json({
      success: true,
      date,
      stats: stats.reduce((acc, s) => { acc[s.status] = s.count; return acc; }, {}),
      totals: {
        teachers: totalTeachers[0].total,
        staff:    totalStaff[0].total,
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;

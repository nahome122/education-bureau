const router = require('express').Router();
const { pool, dbError } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { requireSchoolManagerAssignment, schoolIdForRequest } = require('../middleware/schoolScope');

const ADMIN   = 'Administrator';
const MANAGER = 'SchoolManager';
const OFFICER = 'AttendanceOfficer';
const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'On Leave', 'Holiday'];
let attendanceSchoolColumnPromise;

const hasAttendanceSchoolColumn = async () => {
  if (!attendanceSchoolColumnPromise) {
    attendanceSchoolColumnPromise = pool.query(
      `SELECT 1 FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'school_id'`
    ).then(([rows]) => rows.length > 0).catch((error) => {
      attendanceSchoolColumnPromise = null;
      throw error;
    });
  }
  return attendanceSchoolColumnPromise;
};

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const isValidTime = (value) => value == null || value === '' ||
  /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);

// GET /api/attendance?date=&school_id=&type=teacher|staff
router.get('/', authenticate, authorize(ADMIN, MANAGER, OFFICER), requireSchoolManagerAssignment, async (req, res) => {
  try {
    const date   = req.query.date      || new Date().toISOString().split('T')[0];
    const type   = req.query.type      || 'teacher';
    if (!isValidDate(date)) {
      return res.status(422).json({ success: false, message: 'Date must be a valid YYYY-MM-DD value.' });
    }
    if (!['teacher', 'staff'].includes(type)) {
      return res.status(422).json({ success: false, message: 'Employee type must be teacher or staff.' });
    }
    const assignedSchool = schoolIdForRequest(req);
    if (req.query.school_id && (!/^\d+$/.test(String(req.query.school_id)) || Number(req.query.school_id) < 1)) {
      return res.status(422).json({ success: false, message: 'School ID must be a positive integer.' });
    }
    if (assignedSchool && req.query.school_id && Number(req.query.school_id) !== Number(assignedSchool)) {
      return res.status(403).json({ success: false, message: 'You can only access your assigned school.' });
    }
    const school = assignedSchool || req.query.school_id || null;
    const hasSchoolColumn = await hasAttendanceSchoolColumn();
    const page   = parseInt(req.query.page  || '1');
    const limit  = parseInt(req.query.limit || '50');
    const offset = (page - 1) * limit;

    let nameSql;
    if (type === 'teacher') {
      nameSql  = `SELECT t.id, t.tid AS emp_id, t.name, t.position, s.name AS school_name,
                          a.status AS att_status, a.check_in, a.check_out, a.note
                   FROM teachers t
                   LEFT JOIN schools s ON s.id = t.school_id
                   LEFT JOIN attendance a ON a.employee_id = t.id AND a.employee_type = 'teacher'
                     ${hasSchoolColumn ? 'AND a.school_id = t.school_id' : ''} AND a.date = ?
                   WHERE t.status = 'Active' AND t.school_id IS NOT NULL`;
    } else {
      nameSql  = `SELECT st.id, st.sid AS emp_id, st.name, st.position, s.name AS school_name,
                          a.status AS att_status, a.check_in, a.check_out, a.note
                   FROM staff st
                   LEFT JOIN schools s ON s.id = st.school_id
                   LEFT JOIN attendance a ON a.employee_id = st.id AND a.employee_type = 'staff'
                     ${hasSchoolColumn ? 'AND a.school_id = st.school_id' : ''} AND a.date = ?
                   WHERE st.status = 'Active' AND st.school_id IS NOT NULL`;
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
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// GET /api/attendance/all-schools (Administrator reporting dashboard)
router.get('/all-schools', authenticate, authorize(ADMIN), async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = req.query.start_date || req.query.date || today;
  const endDate = req.query.end_date || req.query.date || startDate;
  if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
    return res.status(422).json({ success: false, message: 'Provide a valid date range with start_date on or before end_date.' });
  }
  if ((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 > 366) {
    return res.status(422).json({ success: false, message: 'Attendance reports are limited to a 367-day range.' });
  }

  const schoolId = req.query.school_id || '';
  const teacherCode = typeof req.query.teacher_code === 'string' ? req.query.teacher_code.trim() : '';
  const status = req.query.status || '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (schoolId && (!/^\d+$/.test(String(schoolId)) || Number(schoolId) < 1)) {
    return res.status(422).json({ success: false, message: 'School ID must be a positive integer.' });
  }
  if (teacherCode.length > 20) {
    return res.status(422).json({ success: false, message: 'Teacher ID must be 20 characters or fewer.' });
  }
  if (status && !ATTENDANCE_STATUSES.includes(status)) {
    return res.status(422).json({ success: false, message: 'Invalid attendance status.' });
  }

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(5000, Math.max(1, Number.parseInt(req.query.limit, 10) || 200));
  const offset = (page - 1) * limit;
  const params = [startDate, endDate];
  const filters = [];
  if (schoolId) {
    filters.push('a.school_id = ?');
    params.push(Number(schoolId));
  }
  if (teacherCode) {
    filters.push('t.tid = ?');
    params.push(teacherCode);
  }
  if (status) {
    filters.push('a.status = ?');
    params.push(status);
  }
  if (search) {
    filters.push('(t.name LIKE ? OR t.tid LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const detailFilter = filters.length ? ` AND ${filters.join(' AND ')}` : '';

  try {
    if (!(await hasAttendanceSchoolColumn())) {
      return res.status(503).json({
        success: false,
        message: 'All Schools Attendance is not ready for this database. Back up the database, run npm run db:migrate-attendance-school from the backend folder, and restart the backend.',
      });
    }
    const [[schoolCount]] = await pool.query('SELECT COUNT(*) AS total FROM schools');
    const [teacherCountRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM teachers
       WHERE status = 'Active' AND school_id IS NOT NULL${schoolId ? ' AND school_id = ?' : ''}`,
      schoolId ? [Number(schoolId)] : []
    );

    const [schoolRows] = await pool.query(
      `SELECT s.id, s.name AS school_name,
              COALESCE(tc.total_teachers, 0) AS total_teachers,
              COALESCE(ar.present, 0) AS present,
              COALESCE(ar.absent, 0) AS absent,
              COALESCE(ar.late, 0) AS late,
              COALESCE(ar.on_leave, 0) AS on_leave,
              COALESCE(ar.holidays, 0) AS holidays,
              COALESCE(ar.end_date_recorded_teachers, 0) AS end_date_recorded_teachers,
              ar.last_attendance_date,
              manager.manager_name
       FROM schools s
       LEFT JOIN (
         SELECT school_id, COUNT(*) AS total_teachers
         FROM teachers WHERE status = 'Active' GROUP BY school_id
       ) tc ON tc.school_id = s.id
       LEFT JOIN (
         SELECT a.school_id,
                SUM(a.status = 'Present') AS present,
                SUM(a.status = 'Absent') AS absent,
                SUM(a.status = 'Late') AS late,
                SUM(a.status = 'On Leave') AS on_leave,
                SUM(a.status = 'Holiday') AS holidays,
                COUNT(DISTINCT CASE WHEN a.date = ? AND current_teacher.status = 'Active' THEN a.employee_id END) AS end_date_recorded_teachers,
                MAX(a.date) AS last_attendance_date
         FROM attendance a
         LEFT JOIN teachers current_teacher ON a.employee_type = 'teacher' AND current_teacher.id = a.employee_id
         WHERE a.employee_type = 'teacher' AND a.date BETWEEN ? AND ?
         GROUP BY a.school_id
       ) ar ON ar.school_id = s.id
       LEFT JOIN (
         SELECT sma.school_id,
                GROUP_CONCAT(DISTINCT manager.full_name ORDER BY manager.full_name SEPARATOR ', ') AS manager_name
         FROM school_manager_assignments sma
         JOIN users manager ON manager.id = sma.user_id AND manager.status = 'Active'
         JOIN roles manager_role ON manager_role.id = manager.role_id AND manager_role.name = 'SchoolManager'
         WHERE sma.status = 'Active'
         GROUP BY sma.school_id
       ) manager ON manager.school_id = s.id
       WHERE (? = 0 OR s.id = ?)
       ORDER BY s.name`,
      [endDate, startDate, endDate, Number(schoolId || 0), Number(schoolId || 0)]
    );

    const schools = schoolRows.map((row) => {
      const present = Number(row.present);
      const absent = Number(row.absent);
      const late = Number(row.late);
      const onLeave = Number(row.on_leave);
      const denominator = present + absent + late;
      const recorded = Number(row.end_date_recorded_teachers);
      const totalTeachers = Number(row.total_teachers);
      return {
        ...row,
        id: Number(row.id),
        total_teachers: totalTeachers,
        present,
        absent,
        late,
        on_leave: onLeave,
        holidays: Number(row.holidays),
        end_date_recorded_teachers: recorded,
        attendance_percentage: denominator ? Number((((present + late) / denominator) * 100).toFixed(1)) : null,
        submission_status: totalTeachers === 0 ? 'No teachers' : recorded === 0 ? 'Missing' : recorded >= totalTeachers ? 'Complete' : 'Partial',
      };
    });

    const [trendRows] = await pool.query(
      `SELECT a.date,
              SUM(a.status = 'Present') AS present,
              SUM(a.status = 'Absent') AS absent,
              SUM(a.status = 'Late') AS late,
              SUM(a.status = 'On Leave') AS on_leave
       FROM attendance a
       WHERE a.employee_type = 'teacher' AND a.date BETWEEN ? AND ?${schoolId ? ' AND a.school_id = ?' : ''}
       GROUP BY a.date ORDER BY a.date`,
      schoolId ? [startDate, endDate, Number(schoolId)] : [startDate, endDate]
    );

    const detailWhere = `WHERE a.employee_type = 'teacher' AND a.date BETWEEN ? AND ?${detailFilter}`;
    const detailParams = [...params];
    const [[{ total: detailTotal }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM attendance a
       JOIN teachers t ON t.id = a.employee_id
       ${detailWhere}`,
      detailParams
    );
    const [detailRows] = await pool.query(
      `SELECT a.id, a.employee_id AS teacher_id, t.tid AS teacher_code,
              t.name AS teacher_name, a.school_id, s.name AS school_name,
              a.date AS attendance_date, a.status, a.check_in, a.check_out,
              a.note AS remarks, recorder.full_name AS recorded_by
       FROM attendance a
       JOIN teachers t ON t.id = a.employee_id
       LEFT JOIN schools s ON s.id = a.school_id
       LEFT JOIN users recorder ON recorder.id = a.marked_by
       ${detailWhere}
       ORDER BY a.date DESC, s.name, t.name LIMIT ? OFFSET ?`,
      [...detailParams, limit, offset]
    );

    const totals = schoolRows.reduce((acc, row) => {
      acc.present += Number(row.present);
      acc.absent += Number(row.absent);
      acc.late += Number(row.late);
      acc.on_leave += Number(row.on_leave);
      return acc;
    }, { present: 0, absent: 0, late: 0, on_leave: 0 });
    const denominator = totals.present + totals.absent + totals.late;
    return res.json({
      success: true,
      range: { start_date: startDate, end_date: endDate },
      totals: {
        schools: Number(schoolCount.total),
        teachers: Number(teacherCountRows[0].total),
        ...totals,
        attendance_percentage: denominator ? Number((((totals.present + totals.late) / denominator) * 100).toFixed(1)) : null,
      },
      schools,
      trend: trendRows.map((row) => ({
        date: row.date,
        present: Number(row.present),
        absent: Number(row.absent),
        late: Number(row.late),
        on_leave: Number(row.on_leave),
      })),
      details: {
        data: detailRows,
        total: Number(detailTotal),
        page,
        limit,
      },
      definitions: {
        percentage: '(Present + Late) / (Present + Late + Absent); recorded On Leave and unrecorded teachers are excluded.',
        submission: `Record coverage on ${endDate} is based on attendance rows, not a separate submission event. Missing records are not counted as absences.`,
        leave_status: 'The existing attendance schema uses On Leave; it does not store leave approval separately.',
      },
    });
  } catch (err) {
    const { status: errorStatus, message } = dbError(err);
    return res.status(errorStatus).json({ success: false, message });
  }
});

// POST /api/attendance/mark  (bulk mark)
router.post('/mark', authenticate, authorize(ADMIN, MANAGER, OFFICER), requireSchoolManagerAssignment, async (req, res) => {
  const { date, employee_type, records } = req.body;
  // records: [{ employee_id, status, check_in, check_out, note }]
  if (!isValidDate(date) || !employee_type || !Array.isArray(records) || records.length > 1000) {
    return res.status(422).json({ success: false, message: 'Invalid payload.' });
  }
  if (!['teacher', 'staff'].includes(employee_type)) {
    return res.status(422).json({ success: false, message: 'Invalid employee type.' });
  }
  const assignedSchool = schoolIdForRequest(req);
  const seenEmployees = new Set();
  try {
    const hasSchoolColumn = await hasAttendanceSchoolColumn();
    const conn = await require('../config/database').pool.getConnection();
    await conn.beginTransaction();
    try {
      for (const r of records) {
      if (!r || typeof r !== 'object' ||
          !/^\d+$/.test(String(r.employee_id)) || Number(r.employee_id) < 1 ||
          !ATTENDANCE_STATUSES.includes(r.status || 'Present') ||
          !isValidTime(r.check_in) || !isValidTime(r.check_out)) {
        await conn.rollback();
        conn.release();
        return res.status(422).json({ success: false, message: 'Each record requires a valid employee ID and attendance status.' });
      }
        if (seenEmployees.has(Number(r.employee_id))) {
          await conn.rollback();
          conn.release();
          return res.status(422).json({ success: false, message: 'Attendance payload contains a duplicate employee ID.' });
        }
        seenEmployees.add(Number(r.employee_id));
        const table = employee_type === 'teacher' ? 'teachers' : 'staff';
        const [[employee]] = await conn.query(
          `SELECT id, school_id FROM ${table} WHERE id = ? AND status = 'Active'`,
          [r.employee_id]
        );
        if (!employee || !employee.school_id) {
          await conn.rollback();
          conn.release();
          return res.status(422).json({ success: false, message: 'Attendance can only be recorded for an active employee assigned to a school.' });
        }
        if (assignedSchool && Number(employee.school_id) !== Number(assignedSchool)) {
          await conn.rollback();
          conn.release();
          return res.status(403).json({
            success: false,
            message: 'Attendance can only be marked for employees in your assigned school.',
          });
        }
        if (hasSchoolColumn) {
          const [[existingRecord]] = await conn.query(
            `SELECT school_id FROM attendance
             WHERE employee_id = ? AND employee_type = ? AND date = ? FOR UPDATE`,
            [r.employee_id, employee_type, date]
          );
          if (assignedSchool && existingRecord?.school_id &&
              Number(existingRecord.school_id) !== Number(assignedSchool)) {
            await conn.rollback();
            conn.release();
            return res.status(403).json({
              success: false,
              message: 'You cannot modify an attendance record attributed to another school.',
            });
          }
        }
        if (hasSchoolColumn) {
          await conn.query(
            `INSERT INTO attendance (employee_id, employee_type, school_id, date, status, check_in, check_out, note, marked_by)
             VALUES (?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE school_id=COALESCE(school_id, VALUES(school_id)), status=VALUES(status),
               check_in=VALUES(check_in), check_out=VALUES(check_out), note=VALUES(note), marked_by=VALUES(marked_by)`,
            [r.employee_id, employee_type, employee.school_id, date, r.status || 'Present',
             r.check_in || null, r.check_out || null, r.note || null, req.user.id]
          );
        } else {
          await conn.query(
            `INSERT INTO attendance (employee_id, employee_type, date, status, check_in, check_out, note, marked_by)
             VALUES (?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE status=VALUES(status), check_in=VALUES(check_in),
               check_out=VALUES(check_out), note=VALUES(note), marked_by=VALUES(marked_by)`,
            [r.employee_id, employee_type, date, r.status || 'Present',
             r.check_in || null, r.check_out || null, r.note || null, req.user.id]
          );
        }
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
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// GET /api/attendance/stats?date=
router.get('/stats', authenticate, authorize(ADMIN, MANAGER, OFFICER), requireSchoolManagerAssignment, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    if (!isValidDate(date)) {
      return res.status(422).json({ success: false, message: 'Date must be a valid YYYY-MM-DD value.' });
    }
    const assignedSchool = schoolIdForRequest(req);

    const hasSchoolColumn = await hasAttendanceSchoolColumn();
    const statsQuery = hasSchoolColumn
      ? `SELECT a.status, COUNT(*) AS count FROM attendance a
         WHERE a.date = ?${assignedSchool ? ' AND a.school_id = ?' : ''} GROUP BY a.status`
      : `SELECT a.status, COUNT(*) AS count
         FROM attendance a
         LEFT JOIN teachers t ON a.employee_id = t.id AND a.employee_type = 'teacher'
         LEFT JOIN staff st ON a.employee_id = st.id AND a.employee_type = 'staff'
         WHERE a.date = ?${assignedSchool ? ' AND (t.school_id = ? OR st.school_id = ?)' : ''}
         GROUP BY a.status`;
    const statsParams = hasSchoolColumn
      ? (assignedSchool ? [date, assignedSchool] : [date])
      : (assignedSchool ? [date, assignedSchool, assignedSchool] : [date]);
    const [stats] = await pool.query(statsQuery, statsParams);

    const [totalTeachers] = await pool.query(
      `SELECT COUNT(*) AS total FROM teachers WHERE status = 'Active' AND school_id IS NOT NULL${assignedSchool ? ' AND school_id = ?' : ''}`,
      assignedSchool ? [assignedSchool] : []
    );
    const [totalStaff] = await pool.query(
      `SELECT COUNT(*) AS total FROM staff WHERE status = 'Active' AND school_id IS NOT NULL${assignedSchool ? ' AND school_id = ?' : ''}`,
      assignedSchool ? [assignedSchool] : []
    );

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
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

module.exports = router;

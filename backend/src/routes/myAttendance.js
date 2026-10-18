const router = require('express').Router();
const { pool, dbError } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.get('/attendance', authenticate, async (req, res) => {
  const employeeType = req.user.employee_type;
  const employeeId = Number(req.user.employee_id);
  if (!['teacher', 'staff'].includes(employeeType) ||
      !Number.isSafeInteger(employeeId) ||
      employeeId < 1) {
    return res.status(403).json({ success: false, message: 'This endpoint is only available to employee accounts.' });
  }

  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(422).json({ success: false, message: 'Month must use YYYY-MM format.' });
  }

  const startDate = `${month}-01`;
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonthDate = new Date(Date.UTC(year, monthNumber, 1));
  const endDate = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const today = new Date().toISOString().slice(0, 10);

  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date, status, check_in, check_out, note
       FROM attendance
       WHERE employee_type = ? AND employee_id = ?
         AND date >= ? AND date < ? AND date <= ?
       ORDER BY date`,
      [employeeType, employeeId, startDate, endDate, today]
    );

    const summary = { Present: 0, Absent: 0, Late: 0, 'On Leave': 0 };
    for (const row of rows) {
      if (Object.hasOwn(summary, row.status)) summary[row.status] += 1;
    }
    const markedDays = rows.filter((row) => Object.hasOwn(summary, row.status)).length;
    const rate = markedDays ? Math.round((summary.Present / markedDays) * 100) : 0;

    return res.json({ success: true, data: rows, month, summary, rate });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

module.exports = router;

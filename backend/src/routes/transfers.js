const router = require('express').Router();
const { pool, dbError } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const ADMIN = 'Administrator';

const employeeTable = (type) => {
  if (type === 'teacher') return { table: 'teachers', code: 'tid', counter: 'teachers' };
  if (type === 'staff') return { table: 'staff', code: 'sid', counter: 'staff_count' };
  return null;
};

// GET /api/transfers
router.get('/', authenticate, async (req, res) => {
  const isEmployee = req.user.user_source === 'employee';
  if (!isEmployee && req.user.role_name !== ADMIN) {
    return res.status(403).json({ success: false, message: 'Administrator access required.' });
  }

  try {
    const { search, status, school_id, teacher_id } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = [];
    const params = [];
    let currentSchool = null;

    if (isEmployee) {
      const type = req.user.employee_type || req.user.emp_type;
      const employeeId = req.user.employee_id ?? req.user.emp_id;
      const employee = employeeTable(type);
      if (!employee || !employeeId) {
        return res.status(403).json({ success: false, message: 'Employee account details are missing.' });
      }
      const [[school]] = await pool.query(
        `SELECT s.id, s.name FROM ${employee.table} e
         LEFT JOIN schools s ON s.id = e.school_id WHERE e.id = ?`,
        [employeeId]
      );
      currentSchool = school ? { id: school.id, name: school.name } : null;
      const column = type === 'teacher' ? 'teacher_id' : 'staff_id';
      where.push(`((tr.requested_employee_type = ? AND tr.requested_employee_id = ?) OR (tr.requested_employee_type IS NULL AND tr.employee_type = ? AND tr.${column} = ?))`);
      params.push(type, employeeId, type, employeeId);
      const [[clearance]] = await pool.query(
        `SELECT cleared_through_id FROM employee_transfer_history_clears
         WHERE employee_type = ? AND employee_id = ?`,
        [type, employeeId]
      );
      where.push('tr.id > ?');
      params.push(clearance?.cleared_through_id || 0);
    }

    if (search) {
      where.push(`(COALESCE(tr.teacher_name, t.name, st.name) LIKE ? OR COALESCE(tr.teacher_tid, t.tid, st.sid) LIKE ? OR tr.from_school_name LIKE ? OR tr.to_school_name LIKE ?)`);
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (status) {
      where.push('tr.status = ?');
      params.push(status);
    }
    if (school_id) {
      where.push('(tr.from_school_id = ? OR tr.to_school_id = ?)');
      params.push(school_id, school_id);
    }
    if (teacher_id && !isEmployee) {
      where.push('tr.teacher_id = ?');
      params.push(teacher_id);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const joins = `FROM transfers tr
      LEFT JOIN teachers t ON t.id = tr.teacher_id
      LEFT JOIN staff st ON st.id = tr.staff_id`;
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total ${joins} ${whereClause}`, params
    );
    const [rows] = await pool.query(
      `SELECT tr.*,
              COALESCE(tr.teacher_name, t.name, st.name) AS employee_name,
              COALESCE(tr.teacher_tid, t.tid, st.sid) AS employee_code
       ${joins} ${whereClause}
       ORDER BY tr.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );

    return res.json({ success: true, data: rows, total, page, limit, ...(isEmployee && { currentSchool }) });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// POST /api/transfers
router.post('/', authenticate, async (req, res) => {
  const isEmployee = req.user.user_source === 'employee';
  if (!isEmployee) {
    return res.status(403).json({ success: false, message: 'Only employees can submit transfer requests.' });
  }

  const type = req.user.employee_type || req.user.emp_type;
  const employeeId = req.user.employee_id ?? req.user.emp_id;
  const schoolId = Number.parseInt(req.body.to_school_id, 10);
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  const employee = employeeTable(type);

  if (!employee || !employeeId || !Number.isInteger(schoolId) || !reason) {
    return res.status(400).json({
      success: false,
      message: 'Employee, destination school, and transfer reason are required.',
    });
  }

  try {
    const [[person]] = await pool.query(
      `SELECT e.id, e.${employee.code} AS employee_code, e.name, e.school_id,
              e.status, s.name AS school_name
       FROM ${employee.table} e
       LEFT JOIN schools s ON s.id = e.school_id
       WHERE e.id = ?`,
      [employeeId]
    );
    if (!person) return res.status(404).json({ success: false, message: 'Employee not found.' });
    if (person.status !== 'Active') {
      return res.status(400).json({ success: false, message: 'Only active employees can request a transfer.' });
    }

    const [[destination]] = await pool.query(
      'SELECT id, name FROM schools WHERE id = ? AND status = ?',
      [schoolId, 'Active']
    );
    if (!destination) {
      return res.status(404).json({ success: false, message: 'Active destination school not found.' });
    }
    if (Number(person.school_id) === schoolId) {
      return res.status(400).json({ success: false, message: 'Destination must be different from your current school.' });
    }

    const [[{ pendingCount }]] = await pool.query(
      `SELECT COUNT(*) AS pendingCount FROM transfers
       WHERE employee_type = ? AND ${type === 'teacher' ? 'teacher_id' : 'staff_id'} = ?
         AND status = 'Pending'`,
      [type, employeeId]
    );
    if (pendingCount > 0) {
      return res.status(409).json({ success: false, message: 'You already have a pending transfer request.' });
    }

    const [result] = await pool.query(
      `INSERT INTO transfers
         (teacher_id, staff_id, employee_type, requested_employee_type, requested_employee_id,
          teacher_name, teacher_tid, from_school_id, from_school_name, to_school_id,
          to_school_name, status, request_date, reason, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', CURDATE(), ?, ?)`,
      [
        type === 'teacher' ? person.id : null,
        type === 'staff' ? person.id : null,
        type,
        isEmployee ? type : null,
        isEmployee ? person.id : null,
        person.name,
        person.employee_code,
        person.school_id,
        person.school_name,
        destination.id,
        destination.name,
        reason,
        isEmployee ? null : req.user.id,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Transfer request sent to the Administrator for review.',
      id: result.insertId,
    });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// PATCH /api/transfers/:id/status
router.patch('/:id/status', authenticate, authorize(ADMIN), async (req, res) => {
  const { status, notes } = req.body;
  const decisionNotes = typeof notes === 'string' ? notes.trim() : '';
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Transfer decision must be Approved or Rejected.' });
  }
  if (decisionNotes.length < 3) {
    return res.status(400).json({ success: false, message: 'Enter a decision reason for the employee.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [[transfer]] = await connection.query(
      'SELECT * FROM transfers WHERE id = ? FOR UPDATE', [req.params.id]
    );
    if (!transfer) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transfer not found.' });
    }
    if (transfer.status !== 'Pending') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'This transfer request has already been decided.' });
    }

    if (status === 'Approved') {
      const employee = employeeTable(transfer.employee_type || 'teacher');
      const employeeId = transfer.employee_type === 'staff' ? transfer.staff_id : transfer.teacher_id;
      if (!employee || !employeeId) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'The employee record for this transfer no longer exists.' });
      }

      const [[person]] = await connection.query(
        `SELECT id, school_id FROM ${employee.table} WHERE id = ? FOR UPDATE`,
        [employeeId]
      );
      if (!person) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'The employee record for this transfer no longer exists.' });
      }
      if (Number(person.school_id) === Number(transfer.to_school_id)) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Employee already belongs to the requested school.' });
      }

      const [[destination]] = await connection.query(
        'SELECT id FROM schools WHERE id = ? AND status = ? FOR UPDATE',
        [transfer.to_school_id, 'Active']
      );
      if (!destination) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'The destination school is no longer active.' });
      }

      await connection.query(
        `UPDATE ${employee.table} SET school_id = ? WHERE id = ?`,
        [transfer.to_school_id, employeeId]
      );
      if (person.school_id) {
        await connection.query(
          `UPDATE schools SET ${employee.counter} = GREATEST(0, ${employee.counter} - 1) WHERE id = ?`,
          [person.school_id]
        );
      }
      await connection.query(
        `UPDATE schools SET ${employee.counter} = ${employee.counter} + 1 WHERE id = ?`,
        [transfer.to_school_id]
      );
    }

    await connection.query(
      `UPDATE transfers SET status = ?, notes = ?, approved_by = ?,
       approved_date = IF(? = 'Approved', CURDATE(), NULL), updated_at = NOW() WHERE id = ?`,
      [status, decisionNotes, req.user.id, status, req.params.id]
    );
    await connection.commit();
    return res.json({ success: true, message: `Transfer ${status.toLowerCase()}.` });
  } catch (err) {
    if (connection) await connection.rollback();
    const { status: errorStatus, message } = dbError(err);
    return res.status(errorStatus).json({ success: false, message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE /api/transfers/my-history
router.delete('/my-history', authenticate, async (req, res) => {
  if (req.user.user_source !== 'employee') {
    return res.status(403).json({ success: false, message: 'Only employees can clear their own transfer history.' });
  }

  const type = req.user.employee_type || req.user.emp_type;
  const employeeId = req.user.employee_id ?? req.user.emp_id;
  const employee = employeeTable(type);
  if (!employee || !employeeId) {
    return res.status(403).json({ success: false, message: 'Employee account details are missing.' });
  }

  try {
    const employeeColumn = type === 'teacher' ? 'teacher_id' : 'staff_id';
    const [[{ clearedThroughId }]] = await pool.query(
      `SELECT COALESCE(MAX(id), 0) AS clearedThroughId
       FROM transfers
       WHERE (requested_employee_type = ? AND requested_employee_id = ?)
          OR (requested_employee_type IS NULL AND employee_type = ? AND ${employeeColumn} = ?)`,
      [type, employeeId, type, employeeId]
    );
    await pool.query(
      `INSERT INTO employee_transfer_history_clears (employee_type, employee_id, cleared_through_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cleared_through_id = GREATEST(cleared_through_id, VALUES(cleared_through_id)),
         cleared_at = CURRENT_TIMESTAMP`,
      [type, employeeId, clearedThroughId]
    );
    return res.json({
      success: true,
      message: 'Your transfer history was cleared. Administrator records were retained.',
    });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// DELETE /api/transfers/history (Administrator clears decided transfer history)
router.delete('/history', authenticate, authorize(ADMIN), async (req, res) => {
  try {
    const [result] = await pool.query(
      `DELETE FROM transfers WHERE status IN ('Approved', 'Rejected')`
    );
    return res.json({
      success: true,
      deleted: result.affectedRows,
      message: `Cleared ${result.affectedRows} transfer history records. Pending requests were kept.`,
    });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

// DELETE /api/transfers/:id
router.delete('/:id', authenticate, authorize(ADMIN), async (req, res) => {
  try {
    await pool.query('DELETE FROM transfers WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Transfer deleted.' });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

module.exports = router;

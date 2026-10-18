const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { body } = require('express-validator');
const { pool, dbError } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { requireSchoolManagerAssignment, schoolIdForRequest } = require('../middleware/schoolScope');

const ADMIN = 'Administrator';
const MANAGER = 'SchoolManager';
const uploadDirectory = path.resolve(
  process.env.REPORT_UPLOAD_DIR || path.join(__dirname, '../../storage/school-reports')
);
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedFiles = new Map([
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(path.posix.basename(file.originalname.replace(/\\/g, '/'))).toLowerCase();
    if (allowedFiles.get(extension) !== file.mimetype) {
      return callback(new Error('Only PDF, PNG, and JPEG attachments are allowed.'));
    }
    return callback(null, true);
  },
});

const parseAttachment = (req, res, next) => upload.single('attachment')(req, res, (error) => {
  if (!error) return next();
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 422;
  return res.status(status).json({ success: false, message: error.message });
});

const hasValidSignature = (file) => {
  const signature = file.buffer.subarray(0, 8);
  if (file.mimetype === 'application/pdf') return signature.subarray(0, 5).toString() === '%PDF-';
  if (file.mimetype === 'image/png') return signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === 'image/jpeg') return signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  return false;
};

const storeAttachment = async (file) => {
  if (!file) return null;
  const filename = `${crypto.randomUUID()}.secure`;
  const filePath = path.join(uploadDirectory, filename);
  await fs.promises.writeFile(filePath, file.buffer, { flag: 'wx', mode: 0o600 });
  return {
    ...file,
    filename,
    path: filePath,
    originalname: path.posix.basename(file.originalname.replace(/\\/g, '/')),
  };
};

const removeUpload = async (file) => {
  if (file?.path) await fs.promises.unlink(file.path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
};

const reportForUser = async (id, user, assignedSchool) => {
  const params = [id];
  let scopeSql = '';
  if (user.role_name === MANAGER) {
    scopeSql = ' AND r.school_id = ?';
    params.push(assignedSchool);
  }
  const [[report]] = await pool.query(
    `SELECT r.* FROM school_reports r WHERE r.id = ?${scopeSql}`,
    params
  );
  return report;
};

const recordEvent = (connection, reportId, userId, eventType, status, comment = null) =>
  connection.query(
    `INSERT INTO school_report_events (report_id, actor_user_id, event_type, status, comment)
     VALUES (?, ?, ?, ?, ?)`,
    [reportId, userId, eventType, status, comment]
  );

router.get('/', authenticate, authorize(ADMIN, MANAGER), requireSchoolManagerAssignment, async (req, res) => {
  try {
    const assignedSchool = schoolIdForRequest(req);
    const status = req.query.status || null;
    const schoolFilter = assignedSchool || req.query.school_id || null;
    if (assignedSchool && req.query.school_id && Number(req.query.school_id) !== Number(assignedSchool)) {
      return res.status(403).json({ success: false, message: 'You can only access reports for your assigned school.' });
    }
    const conditions = [];
    const params = [];
    if (schoolFilter) {
      conditions.push('r.school_id = ?');
      params.push(schoolFilter);
    }
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    const [rows] = await pool.query(
      `SELECT r.id, r.school_id, r.submitted_by, r.title, r.report_type, r.period_start, r.period_end,
              r.status, r.feedback, r.reviewed_at, r.submitted_at, r.updated_at,
              r.attachment_name, r.attachment_type, r.attachment_size,
              s.name AS school_name, u.full_name AS manager_name
       FROM school_reports r JOIN schools s ON s.id = r.school_id
       JOIN users u ON u.id = r.submitted_by
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY r.submitted_at DESC`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

router.get('/:id/events', authenticate, authorize(ADMIN, MANAGER), requireSchoolManagerAssignment, async (req, res) => {
  try {
    const report = await reportForUser(req.params.id, req.user, schoolIdForRequest(req));
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    const [events] = await pool.query(
      `SELECT e.id, e.event_type, e.status, e.comment, e.created_at, u.full_name AS actor_name
       FROM school_report_events e LEFT JOIN users u ON u.id = e.actor_user_id
       WHERE e.report_id = ? ORDER BY e.created_at ASC`,
      [report.id]
    );
    return res.json({ success: true, data: events });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

router.get('/:id/attachment', authenticate, authorize(ADMIN, MANAGER), requireSchoolManagerAssignment, async (req, res) => {
  try {
    const report = await reportForUser(req.params.id, req.user, schoolIdForRequest(req));
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    if (!report.attachment_storage_name) {
      return res.status(404).json({ success: false, message: 'This report has no attachment.' });
    }
    const filePath = path.join(uploadDirectory, report.attachment_storage_name);
    if (path.dirname(filePath) !== uploadDirectory) {
      return res.status(404).json({ success: false, message: 'Attachment not found.' });
    }
    return res.download(filePath, report.attachment_name, (error) => {
      if (error && !res.headersSent) {
        console.error('School report attachment download failed:', error.message);
        res.status(404).json({ success: false, message: 'Attachment not found.' });
      }
    });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

router.post(
  '/',
  authenticate, authorize(MANAGER), requireSchoolManagerAssignment, parseAttachment,
  [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be at most 200 characters.'),
    body('report_type').trim().isLength({ min: 1, max: 80 }).withMessage('Report type is required.'),
    body('period_start').isISO8601().withMessage('A valid period start date is required.'),
    body('period_end').isISO8601().withMessage('A valid period end date is required.'),
    body('content').trim().notEmpty().withMessage('Report content is required.'),
  ],
  validate,
  async (req, res) => {
    const attachment = req.file;
    let storedAttachment = null;
    const assignedSchool = schoolIdForRequest(req);
    try {
      if (new Date(req.body.period_end) < new Date(req.body.period_start)) {
        await removeUpload(storedAttachment);
        return res.status(422).json({ success: false, message: 'The end date must be on or after the start date.' });
      }
      if (attachment && !(await hasValidSignature(attachment))) {
        return res.status(422).json({ success: false, message: 'Attachment content does not match its file type.' });
      }
      storedAttachment = await storeAttachment(attachment);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `INSERT INTO school_reports
           (school_id, submitted_by, title, report_type, period_start, period_end, content,
            attachment_name, attachment_storage_name, attachment_type, attachment_size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [assignedSchool, req.user.id, req.body.title.trim(), req.body.report_type.trim(),
            req.body.period_start, req.body.period_end, req.body.content.trim(),
            storedAttachment?.originalname || null, storedAttachment?.filename || null,
            storedAttachment?.mimetype || null, storedAttachment?.size || null]
        );
        await recordEvent(connection, result.insertId, req.user.id, 'Submitted', 'Submitted');
        await connection.commit();
        return res.status(201).json({ success: true, message: 'Report submitted.', id: result.insertId });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } catch (err) {
      await removeUpload(storedAttachment);
      const { status, message } = dbError(err);
      return res.status(status).json({ success: false, message });
    }
  }
);

router.post(
  '/:id/resubmit',
  authenticate, authorize(MANAGER), requireSchoolManagerAssignment, parseAttachment,
  [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be at most 200 characters.'),
    body('report_type').trim().isLength({ min: 1, max: 80 }).withMessage('Report type is required.'),
    body('period_start').isISO8601().withMessage('A valid period start date is required.'),
    body('period_end').isISO8601().withMessage('A valid period end date is required.'),
    body('content').trim().notEmpty().withMessage('Report content is required.'),
  ],
  validate,
  async (req, res) => {
    const attachment = req.file;
    let storedAttachment = null;
    let oldAttachment = null;
    try {
      if (new Date(req.body.period_end) < new Date(req.body.period_start)) {
        await removeUpload(storedAttachment);
        return res.status(422).json({ success: false, message: 'The end date must be on or after the start date.' });
      }
      if (attachment && !(await hasValidSignature(attachment))) {
        return res.status(422).json({ success: false, message: 'Attachment content does not match its file type.' });
      }
      storedAttachment = await storeAttachment(attachment);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [[report]] = await connection.query(
          `SELECT id, status, attachment_storage_name FROM school_reports
           WHERE id = ? AND school_id = ? FOR UPDATE`,
          [req.params.id, schoolIdForRequest(req)]
        );
        if (!report) {
          await connection.rollback();
          await removeUpload(storedAttachment);
          return res.status(404).json({ success: false, message: 'Report not found.' });
        }
        if (report.status !== 'Needs Correction' && report.status !== 'Rejected') {
          await connection.rollback();
          await removeUpload(storedAttachment);
          return res.status(409).json({ success: false, message: 'Only reports requiring correction can be resubmitted.' });
        }
        oldAttachment = attachment ? report.attachment_storage_name : null;
        await connection.query(
          `UPDATE school_reports SET title = ?, report_type = ?, period_start = ?, period_end = ?,
           content = ?, status = 'Submitted', feedback = NULL, reviewed_by = NULL, reviewed_at = NULL,
           attachment_name = COALESCE(?, attachment_name),
           attachment_storage_name = COALESCE(?, attachment_storage_name),
           attachment_type = COALESCE(?, attachment_type),
           attachment_size = COALESCE(?, attachment_size)
           WHERE id = ?`,
          [req.body.title.trim(), req.body.report_type.trim(), req.body.period_start, req.body.period_end,
            req.body.content.trim(), storedAttachment?.originalname || null, storedAttachment?.filename || null,
            storedAttachment?.mimetype || null, storedAttachment?.size || null, report.id]
        );
        await recordEvent(connection, report.id, req.user.id, 'Resubmitted', 'Submitted');
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
      if (oldAttachment) {
        try {
          await removeUpload({ path: path.join(uploadDirectory, oldAttachment) });
        } catch (cleanupError) {
          console.error('Previous school report attachment cleanup failed:', cleanupError.message);
        }
      }
      return res.json({ success: true, message: 'Report resubmitted.' });
    } catch (err) {
      await removeUpload(storedAttachment);
      const { status, message } = dbError(err);
      return res.status(status).json({ success: false, message });
    }
  }
);

router.patch(
  '/:id/review',
  authenticate, authorize(ADMIN),
  [
    body('status').isIn(['Under Review', 'Needs Correction', 'Approved', 'Rejected'])
      .withMessage('Invalid review status.'),
    body('feedback').optional({ values: 'falsy' }).isString().withMessage('Feedback must be text.'),
  ],
  validate,
  async (req, res) => {
    const { status, feedback } = req.body;
    if (['Needs Correction', 'Rejected'].includes(status) && !String(feedback || '').trim()) {
      return res.status(422).json({ success: false, message: 'Feedback is required for this decision.' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[report]] = await connection.query(
        'SELECT id, school_id FROM school_reports WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      if (!report) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Report not found.' });
      }
      await connection.query(
        `UPDATE school_reports SET status = ?, feedback = ?, reviewed_by = ?, reviewed_at = NOW()
         WHERE id = ?`,
        [status, String(feedback || '').trim() || null, req.user.id, report.id]
      );
      await recordEvent(connection, report.id, req.user.id, 'Reviewed', status, String(feedback || '').trim() || null);
      await connection.commit();
      return res.json({ success: true, message: 'Report review saved.' });
    } catch (err) {
      await connection.rollback();
      const { status, message } = dbError(err);
      return res.status(status).json({ success: false, message });
    } finally {
      connection.release();
    }
  }
);

router.get('/:id', authenticate, authorize(ADMIN, MANAGER), requireSchoolManagerAssignment, async (req, res) => {
  try {
    const assignedSchool = schoolIdForRequest(req);
    const report = await reportForUser(req.params.id, req.user, assignedSchool);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    return res.json({ success: true, data: report });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

module.exports = router;

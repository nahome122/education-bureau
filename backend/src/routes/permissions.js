const router = require('express').Router();
const { pool, dbError } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const ADMIN = 'Administrator';
const MODULES = new Set([
  'dashboard', 'users', 'schools', 'teachers', 'staff', 'id-cards',
  'attendance', 'departments', 'teacher-performance', 'transfer',
  'reports', 'settings', 'profile',
]);
const ACTIONS = new Set(['view', 'create', 'edit', 'delete', 'export']);

const parseMatrix = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') return JSON.parse(value);
  return value;
};

const isValidMatrix = (matrix) =>
  matrix !== null &&
  typeof matrix === 'object' &&
  !Array.isArray(matrix) &&
  Object.entries(matrix).every(([module, actions]) =>
    MODULES.has(module) &&
    actions !== null &&
    typeof actions === 'object' &&
    !Array.isArray(actions) &&
    Object.entries(actions).every(([action, enabled]) =>
      ACTIONS.has(action) && typeof enabled === 'boolean'
    )
  );

router.get('/:userId', authenticate, authorize(ADMIN), async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(422).json({ success: false, message: 'Invalid user ID.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT permission_matrix FROM users WHERE id = ?',
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, data: parseMatrix(rows[0].permission_matrix) });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

router.put('/:userId', authenticate, authorize(ADMIN), async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(422).json({ success: false, message: 'Invalid user ID.' });
  }
  if (!isValidMatrix(req.body)) {
    return res.status(422).json({ success: false, message: 'Invalid permission matrix.' });
  }

  try {
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    await pool.query(
      'UPDATE users SET permission_matrix = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(req.body), userId]
    );
    return res.json({ success: true, message: 'Permissions saved successfully.' });
  } catch (err) {
    const { status, message } = dbError(err);
    return res.status(status).json({ success: false, message });
  }
});

module.exports = router;

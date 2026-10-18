const router = require('express').Router();
const { pool, connectionLimit } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.get('/database', authenticate, async (req, res) => {
  if (req.user.role_name !== 'Administrator') {
    return res.status(403).json({ success: false, message: 'Administrator access required.' });
  }

  try {
    const [[databaseInfo]] = await pool.query(
      'SELECT DATABASE() AS databaseName, VERSION() AS version'
    );
    const [[{ tableCount }]] = await pool.query(
      `SELECT COUNT(*) AS tableCount
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()`
    );

    return res.json({
      success: true,
      database: databaseInfo.databaseName,
      version: databaseInfo.version,
      tableCount,
      poolLimit: connectionLimit,
    });
  } catch (err) {
    console.error('[DATABASE SETTINGS]', err.message);
    return res.status(503).json({
      success: false,
      message: 'Could not read database status. Check the database connection.',
    });
  }
});

module.exports = router;

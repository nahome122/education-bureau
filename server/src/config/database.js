/**
 * database.js — Robust MySQL connection pool
 * - Reads from DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME (or DATABASE_URL)
 * - Keepalive ping every 30 s so idle connections don't time out
 * - Detailed error logging for every connection failure
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

// ── Parse optional DATABASE_URL ─────────────────────────────────────────────
function parseUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return {
      host:     u.hostname,
      port:     parseInt(u.port) || 3306,
      user:     decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  } catch { return null; }
}

// ── Build config from env ────────────────────────────────────────────────────
let dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'tsms_db',
};

const urlSource =
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL    ||
  process.env.CLEARDB_DATABASE_URL || null;

if (urlSource) {
  const parsed = parseUrl(urlSource);
  if (parsed && parsed.database) {
    dbConfig = { ...dbConfig, ...parsed };
    console.log('🔗  Using DATABASE_URL — host:', dbConfig.host, '| db:', dbConfig.database);
  }
}

// ── Create pool ──────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
  // Auto-reconnect on stale connections
  enableKeepAlive:    true,
  keepAliveInitialDelay: 10000,
  connectTimeout:     10000,
});

// ── Keepalive ping every 30 s ────────────────────────────────────────────────
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.warn('⚠️  DB keepalive ping failed:', err.message);
  }
}, 30_000);

// ── Translate MySQL error codes → human-readable messages ───────────────────
const MYSQL_ERRORS = {
  'ECONNREFUSED':   'Cannot connect to MySQL — make sure XAMPP MySQL is running.',
  'ENOTFOUND':      'MySQL host not found — check DB_HOST in server/.env.',
  'ER_ACCESS_DENIED_ERROR': 'MySQL access denied — check DB_USER / DB_PASSWORD.',
  'ER_BAD_DB_ERROR':        'Database does not exist — run: node server/src/scripts/setupDb.js',
  'ER_NO_SUCH_TABLE':       'Table does not exist — run migrations.',
  'ER_BAD_FIELD_ERROR':     'Unknown column in query.',
  'ER_DUP_ENTRY':           'Duplicate entry — record already exists.',
  'ER_ROW_IS_REFERENCED_2': 'Cannot delete — this record is referenced by other data.',
  'ER_NO_REFERENCED_ROW_2': 'Foreign key error — referenced record does not exist.',
  'ER_PARSE_ERROR':         'SQL syntax error.',
  'ER_LOCK_WAIT_TIMEOUT':   'Database lock timeout — try again.',
  'PROTOCOL_CONNECTION_LOST': 'Database connection lost.',
  'ETIMEDOUT':              'Database connection timed out.',
  'POOL_CLOSED':            'Connection pool is closed.',
};

/**
 * Translates a MySQL/Node error into a clean message.
 * Usage in route catch blocks: const { status, message } = dbError(err);
 */
function dbError(err) {
  const code    = err.code || '';
  const sqlMsg  = err.sqlMessage || '';
  const known   = MYSQL_ERRORS[code];

  // Log full error server-side
  console.error('─── DB ERROR ───────────────────────────────');
  console.error('Code   :', code);
  console.error('Message:', err.message);
  if (sqlMsg) console.error('SQL    :', sqlMsg);
  if (err.sql) console.error('Query  :', err.sql);
  console.error('────────────────────────────────────────────');

  if (code === 'ER_DUP_ENTRY') {
    // Extract field name from MySQL duplicate entry message
    const match = sqlMsg.match(/key '(.+?)'/);
    const field = match ? match[1] : 'field';
    return { status: 409, message: `Duplicate entry — ${field} already exists.` };
  }

  if (code === 'ER_ROW_IS_REFERENCED_2') {
    return { status: 409, message: 'Cannot delete — this record is used by teachers, staff, or other records.' };
  }

  if (code === 'ER_BAD_FIELD_ERROR') {
    return { status: 500, message: `Unknown column: ${sqlMsg}` };
  }

  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'POOL_CLOSED'].includes(code)) {
    return { status: 503, message: known || err.message || 'Database is unavailable.' };
  }

  if (known) {
    return { status: 500, message: known };
  }

  return { status: 500, message: `Database error: ${err.message || 'Unknown error.'}` };
}

// ── Test connection on startup ───────────────────────────────────────────────
const testConnection = async () => {
  try {
    const conn = await pool.getConnection();

    // Verify the DB and key tables exist
    await conn.query('SELECT 1');
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('teachers','staff','schools','users','departments')`,
      [dbConfig.database]
    );
    conn.release();

    const found = tables.map(r => r.TABLE_NAME);
    const missing = ['teachers','staff','schools','users','departments'].filter(t => !found.includes(t));

    console.log('✅  MySQL connected successfully');
    console.log(`   host: ${dbConfig.host} | db: ${dbConfig.database}`);

    if (missing.length) {
      console.warn('⚠️  Missing tables:', missing.join(', '));
      console.warn('   Run: node server/src/scripts/setupDb.js');
    } else {
      console.log('✅  All required tables found');
    }
  } catch (err) {
    const { message } = dbError(err);
    console.error('❌  Startup DB check failed:', message);
    process.exit(1);
  }
};

module.exports = { pool, testConnection, dbError };

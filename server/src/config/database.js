const mysql = require('mysql2/promise');
require('dotenv').config();

function parseDatabaseUrl(urlString) {
  try {
    const url = new URL(urlString);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname ? url.pathname.replace(/^\//, '') : undefined,
    };
  } catch (e) {
    return null;
  }
}

function hasPlaceholderValue(value) {
  if (value === undefined || value === null) return true;
  const text = String(value).trim().toLowerCase();
  if (!text) return true;

  const placeholderPatterns = [
    'your_db_',
    'replace_with',
    'example.com',
    'yourhost',
    'youruser',
    'yourpassword',
    'your_database',
    'changeme',
    'db_name',
    'db_host',
    'db_user',
  ];

  return placeholderPatterns.some((pattern) => text.includes(pattern));
}

let dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'tsms_db',
};

// Accept a single DATABASE_URL or MYSQL_URL if provided (Railway / other hosts)
const urlSource = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.CLEARDB_DATABASE_URL || null;
if (urlSource) {
  const parsed = parseDatabaseUrl(urlSource);
  if (parsed && parsed.database) {
    dbConfig = Object.assign(dbConfig, parsed);
    console.log('🔗  Parsed DB URL, using host:', dbConfig.host, 'db:', dbConfig.database);
  }
}

const hasPlaceholderDatabaseConfig = [
  dbConfig.host,
  dbConfig.user,
  dbConfig.password,
  dbConfig.database,
  urlSource,
].some(hasPlaceholderValue);

if (hasPlaceholderDatabaseConfig && process.env.NODE_ENV === 'production') {
  const message = 'Database is not configured. Replace all placeholder values in server/.env with your real online MySQL credentials.';
  console.error('❌ ' + message);
  console.error('   Current DB values still include placeholder text such as your_db_host or your_db_name.');
  throw new Error(message);
}

const pool = mysql.createPool(Object.assign({}, dbConfig, {
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
}));

const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL connected successfully');
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:');
    console.error('   host     =', dbConfig.host);
    console.error('   port     =', dbConfig.port);
    console.error('   user     =', dbConfig.user);
    console.error('   database =', dbConfig.database);
    console.error('   code     =', err.code || 'N/A');
    console.error('   message  =', err.message || 'N/A');
    console.error(err);
    process.exit(1);
  }
};

module.exports = { pool, testConnection };

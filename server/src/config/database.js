const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'tsms_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
});

const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL connected successfully');
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:');
    console.error('   host     =', process.env.DB_HOST || 'localhost');
    console.error('   port     =', process.env.DB_PORT || '3306');
    console.error('   user     =', process.env.DB_USER || 'root');
    console.error('   database =', process.env.DB_NAME || 'tsms_db');
    console.error('   code     =', err.code || 'N/A');
    console.error('   message  =', err.message || 'N/A');
    console.error(err);
    process.exit(1);
  }
};

module.exports = { pool, testConnection };

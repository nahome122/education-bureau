/**
 * Runs the custom_username migration then starts the server.
 * Called once at server startup if columns are missing.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'tsms_db',
  });

  await conn.query('ALTER TABLE teachers ADD COLUMN IF NOT EXISTS custom_username VARCHAR(80) DEFAULT NULL');
  await conn.query('ALTER TABLE staff    ADD COLUMN IF NOT EXISTS custom_username VARCHAR(80) DEFAULT NULL');

  const [[col1]] = await conn.query("SHOW COLUMNS FROM teachers LIKE 'custom_username'");
  const [[col2]] = await conn.query("SHOW COLUMNS FROM staff    LIKE 'custom_username'");

  console.log('teachers.custom_username:', col1 ? 'OK' : 'MISSING');
  console.log('staff.custom_username:   ', col2 ? 'OK' : 'MISSING');

  await conn.end();
}

run().catch(err => {
  console.error('Migration error:', err.message);
  process.exit(1);
});

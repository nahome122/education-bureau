/**
 * Migration: add custom_username column to teachers and staff tables
 * Run: node server/src/scripts/migrate_custom_username.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'tsms_db',
  });

  try {
    await conn.query(
      'ALTER TABLE teachers ADD COLUMN IF NOT EXISTS custom_username VARCHAR(80) DEFAULT NULL'
    );
    console.log('✅  teachers.custom_username column ready');

    await conn.query(
      'ALTER TABLE staff ADD COLUMN IF NOT EXISTS custom_username VARCHAR(80) DEFAULT NULL'
    );
    console.log('✅  staff.custom_username column ready');
  } catch (err) {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

migrate();

/**
 * Run this once to create the database schema and seed data.
 * Usage: npm run db:setup (from the backend directory)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

async function setup() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    console.log('✅  Connected to MySQL');
    const sql = fs.readFileSync(path.join(__dirname, '../config/schema.sql'), 'utf8');
    await conn.query(sql);
    console.log('✅  Database schema created and seeded successfully.');
    console.log('');
    console.log('🔑  Default credentials:');
    console.log('   Admin          → username: belete.guta     | password: Employee@123');
    console.log('   School Manager → username: schoolmanager  | password: password');
    console.log('   Att. Officer   → username: attendanceofficer | password: password');
    console.log('');
    console.log('⚠️   The seeded password hash is for "password" for other users — change immediately in production!');
  } finally {
    await conn.end();
  }
}

setup().catch((err) => {
  console.error('❌  Database setup failed:', err.message);
  process.exitCode = 1;
});

/**
 * Run this once to create the database schema and seed data.
 * Usage: node server/src/scripts/setupDb.js
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

  console.log('✅  Connected to MySQL');

  const sql = fs.readFileSync(path.join(__dirname, '../config/schema.sql'), 'utf8');

  try {
    await conn.query(sql);
    console.log('✅  Database schema created and seeded successfully.');
    console.log('');
    console.log('🔑  Default credentials:');
    console.log('   Admin          → username: admin         | password: password');
    console.log('   School Manager → username: schoolmanager | password: password');
    console.log('   Att. Officer   → username: attendanceofficer | password: password');
    console.log('   Viewer         → username: viewer        | password: password');
    console.log('');
    console.log('⚠️   The seeded password hash is for "password" — change immediately in production!');
  } catch (err) {
    console.error('❌  Error running schema:', err.message);
  }

  await conn.end();
}

setup().catch(console.error);

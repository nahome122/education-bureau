/**
 * Reset users with new credentials
 * Usage: node src/scripts/resetUsers.js (from the backend directory)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

async function resetUsers() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'tsms_db',
  });

  console.log('✅  Connected to MySQL');

  try {
    // Delete existing users
    await conn.query(
      `DELETE u FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id IN (1, 2, 3) AND (r.name IS NULL OR r.name <> 'Viewer')`
    );
    await conn.query(
      `UPDATE users u JOIN roles r ON r.id = u.role_id
       SET u.status = 'Inactive' WHERE r.name = 'Viewer'`
    );
    console.log('🗑️   Old users deleted');

    // Insert new users with updated credentials
    const sql = `
      INSERT INTO users (id, full_name, username, email, phone, password_hash, role_id, school_id, status, created_by)
      VALUES 
      (1, 'Nahom Eshetu', 'belete.guta', 'nahom@tsms.gov.et', '+251911000001',
       '$2a$12$qUobE4SBZK7rGL4EuidjcO5SIgzfmakcobQ3VxImVyi0TERrZGRAO', 1, NULL, 'Active', NULL),
      (2, 'Dawit Bekele', 'schoolmanager', 'manager@tsms.gov.et', '+251922000002',
       '$2a$12$U5o/fJy.sJZvADGi8DbsDuaiozNabGL9Nb.1V9dPCc26ic0wj3Zqe', 2, 1, 'Active', 1),
      (3, 'Sara Tesfaye', 'attendanceofficer', 'officer@tsms.gov.et', '+251933000003',
       '$2a$12$U5o/fJy.sJZvADGi8DbsDuaiozNabGL9Nb.1V9dPCc26ic0wj3Zqe', 3, 1, 'Active', 1)
    `;

    await conn.query(sql);
    console.log('✅  Users updated successfully!');
    console.log('');
    console.log('🔑  Updated credentials:');
    console.log('   Admin          → username: belete.guta    | password: Employee@123');
    console.log('   School Manager → username: schoolmanager  | password: password');
    console.log('   Att. Officer   → username: attendanceofficer | password: password');
    console.log('');
  } catch (err) {
    console.error('❌  Error updating users:', err.message);
  }

  await conn.end();
}

resetUsers().catch(console.error);

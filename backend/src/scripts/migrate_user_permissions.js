// Run with `npm run db:migrate-user-permissions` from the server directory.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

async function migrateUserPermissions() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tsms_db',
  });

  try {
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    );
    if (!columns.some((column) => column.COLUMN_NAME === 'permission_matrix')) {
      await connection.query(
        'ALTER TABLE users ADD COLUMN permission_matrix JSON DEFAULT NULL AFTER role_id'
      );
    }
    console.log('Per-user permission matrix storage is ready.');
  } finally {
    await connection.end();
  }
}

migrateUserPermissions().catch((error) => {
  console.error('User permissions migration failed:', error.message);
  process.exitCode = 1;
});

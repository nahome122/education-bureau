require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.CLEARDB_DATABASE_URL;
const connectionConfig = databaseUrl
  ? (() => {
      const url = new URL(databaseUrl);
      const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
      if (!url.hostname || !database) throw new Error('DATABASE_URL must include a host and database name.');
      return {
        host: url.hostname,
        port: Number.parseInt(url.port || '3306', 10),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database,
      };
    })()
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number.parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tsms_db',
    };

async function migrateAttendanceSchool() {
  const connection = await mysql.createConnection(connectionConfig);
  try {
    const [[table]] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance'`
    );
    if (!table) throw new Error('attendance table is missing; run the existing database setup first.');

    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'school_id'`
    );
    if (!columns.length) {
      await connection.query('ALTER TABLE attendance ADD COLUMN school_id INT NULL AFTER employee_type');
    }

    const [indexes] = await connection.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance'
         AND INDEX_NAME = 'idx_attendance_school_date_type'`
    );
    if (!indexes.length) {
      await connection.query(
        'ALTER TABLE attendance ADD INDEX idx_attendance_school_date_type (school_id, date, employee_type)'
      );
    }

    const [constraints] = await connection.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance'
         AND COLUMN_NAME = 'school_id' AND REFERENCED_TABLE_NAME = 'schools'`
    );
    if (!constraints.length) {
      await connection.query(
        `ALTER TABLE attendance
         ADD CONSTRAINT fk_attendance_school
         FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL`
      );
    }

    await connection.query(`
      UPDATE attendance a
      LEFT JOIN teachers t ON a.employee_type = 'teacher' AND t.id = a.employee_id
      LEFT JOIN staff st ON a.employee_type = 'staff' AND st.id = a.employee_id
      SET a.school_id = CASE
        WHEN a.employee_type = 'teacher' THEN t.school_id
        ELSE st.school_id
      END
      WHERE a.school_id IS NULL
    `);
    console.log('Attendance school attribution is ready. Existing records were backfilled from current employee assignments where available.');
  } finally {
    await connection.end();
  }
}

migrateAttendanceSchool().catch((error) => {
  console.error('Attendance school migration failed:', error.message);
  process.exitCode = 1;
});

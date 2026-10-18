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

async function migrateTeacherScores() {
  const connection = await mysql.createConnection(connectionConfig);
  try {
    const [[table]] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers'`
    );
    if (!table) throw new Error('teachers table is missing; run the existing database setup first.');

    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers'
         AND COLUMN_NAME IN ('semester1_score', 'semester2_score')`
    );
    const existingColumns = new Set(columns.map(({ COLUMN_NAME }) => COLUMN_NAME));
    if (!existingColumns.has('semester1_score')) {
      await connection.query(
        'ALTER TABLE teachers ADD COLUMN semester1_score DECIMAL(5,2) DEFAULT 0 AFTER status'
      );
    }
    if (!existingColumns.has('semester2_score')) {
      await connection.query(
        'ALTER TABLE teachers ADD COLUMN semester2_score DECIMAL(5,2) DEFAULT 0 AFTER semester1_score'
      );
    }

    console.log('Teacher semester score columns are ready.');
  } finally {
    await connection.end();
  }
}

migrateTeacherScores().catch((error) => {
  console.error('Teacher score migration failed:', error.message);
  process.exitCode = 1;
});

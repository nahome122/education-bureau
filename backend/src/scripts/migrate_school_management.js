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

async function migrateSchoolManagement() {
  const connection = await mysql.createConnection(connectionConfig);

  try {
    const [[usersTable]] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    );
    if (!usersTable) throw new Error('users table is missing; run the existing database setup first.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS school_manager_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        school_id INT NOT NULL,
        status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
        assigned_by INT NULL,
        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_school_manager_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_school_manager_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT,
        CONSTRAINT fk_school_manager_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_school_manager_school_status (school_id, status)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS school_reports (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        submitted_by INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        report_type VARCHAR(80) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        content MEDIUMTEXT NOT NULL,
        attachment_name VARCHAR(255) NULL,
        attachment_storage_name VARCHAR(80) NULL,
        attachment_type VARCHAR(120) NULL,
        attachment_size BIGINT UNSIGNED NULL,
        status ENUM('Submitted','Under Review','Needs Correction','Approved','Rejected') NOT NULL DEFAULT 'Submitted',
        feedback TEXT NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_school_report_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT,
        CONSTRAINT fk_school_report_submitter FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_school_report_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_school_reports_school_status (school_id, status, submitted_at),
        INDEX idx_school_reports_submitter (submitted_by, submitted_at)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS school_report_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        report_id BIGINT NOT NULL,
        actor_user_id INT NULL,
        event_type ENUM('Submitted','Resubmitted','Reviewed','Feedback') NOT NULL,
        status ENUM('Submitted','Under Review','Needs Correction','Approved','Rejected') NOT NULL,
        comment TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_school_report_event_report FOREIGN KEY (report_id) REFERENCES school_reports(id) ON DELETE CASCADE,
        CONSTRAINT fk_school_report_event_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_school_report_events_report (report_id, created_at)
      ) ENGINE=InnoDB
    `);

    await connection.query(`
      INSERT INTO school_manager_assignments (user_id, school_id, status)
      SELECT u.id, u.school_id, u.status
      FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'SchoolManager' AND u.school_id IS NOT NULL
      ON DUPLICATE KEY UPDATE
        school_id = VALUES(school_id),
        status = VALUES(status)
    `);
    console.log('School manager assignment and report tables are ready.');
  } finally {
    await connection.end();
  }
}

migrateSchoolManagement().catch((error) => {
  console.error('School management migration failed:', error.message);
  process.exitCode = 1;
});

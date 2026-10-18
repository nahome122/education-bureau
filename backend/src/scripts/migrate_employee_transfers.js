require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

async function migrateEmployeeTransfers() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tsms_db',
  });

  try {
    const [[table]] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transfers'`
    );
    if (!table) {
      throw new Error('transfers table does not exist. Run the existing database setup first.');
    }

    const [columns] = await connection.query(
      `SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transfers'`
    );
    const columnNames = new Set(columns.map((column) => column.COLUMN_NAME));

    if (columnNames.has('teacher_id') &&
        columns.find((column) => column.COLUMN_NAME === 'teacher_id').IS_NULLABLE !== 'YES') {
      await connection.query('ALTER TABLE transfers MODIFY teacher_id INT NULL');
    }
    if (!columnNames.has('staff_id')) {
      await connection.query('ALTER TABLE transfers ADD COLUMN staff_id INT NULL AFTER teacher_id');
    }
    if (!columnNames.has('employee_type')) {
      await connection.query(
        `ALTER TABLE transfers ADD COLUMN employee_type
         ENUM('teacher','staff') NOT NULL DEFAULT 'teacher' AFTER staff_id`
      );
    }
    if (!columnNames.has('requested_employee_type')) {
      await connection.query(
        `ALTER TABLE transfers ADD COLUMN requested_employee_type
         ENUM('teacher','staff') DEFAULT NULL AFTER employee_type`
      );
    }
    if (!columnNames.has('requested_employee_id')) {
      await connection.query(
        'ALTER TABLE transfers ADD COLUMN requested_employee_id INT DEFAULT NULL AFTER requested_employee_type'
      );
    }

    const [[staffIndex]] = await connection.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transfers'
         AND COLUMN_NAME = 'staff_id'`
    );
    if (!staffIndex) {
      await connection.query('ALTER TABLE transfers ADD INDEX idx_transfers_staff_id (staff_id)');
    }

    const [[staffForeignKey]] = await connection.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transfers'
         AND COLUMN_NAME = 'staff_id' AND REFERENCED_TABLE_NAME = 'staff'`
    );
    if (!staffForeignKey) {
      await connection.query(
        `ALTER TABLE transfers ADD CONSTRAINT fk_transfers_staff
         FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE`
      );
    }

    console.log('Employee transfer request columns and staff relation are ready.');
  } finally {
    await connection.end();
  }
}

migrateEmployeeTransfers().catch((error) => {
  console.error('Employee transfer migration failed:', error.message);
  process.exitCode = 1;
});

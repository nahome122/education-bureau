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

async function migrate() {
  const connection = await mysql.createConnection(connectionConfig);
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS employee_transfer_history_clears (
        employee_type ENUM('teacher', 'staff') NOT NULL,
        employee_id INT NOT NULL,
        cleared_through_id INT NOT NULL DEFAULT 0,
        cleared_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (employee_type, employee_id)
      ) ENGINE=InnoDB
    `);
    console.log('Transfer history clear markers are ready. Existing transfer records were not changed.');
  } finally {
    await connection.end();
  }
}

migrate().catch((error) => {
  console.error('Transfer history migration failed:', error.message);
  process.exitCode = 1;
});

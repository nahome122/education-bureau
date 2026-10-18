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

async function removeViewerRole() {
  const connection = await mysql.createConnection(connectionConfig);
  try {
    const [[role]] = await connection.query(
      `SELECT id FROM roles WHERE name = 'Viewer'`
    );
    if (!role) {
      console.log('Viewer role is not present; no accounts required deactivation.');
      return;
    }

    const [result] = await connection.query(
      `UPDATE users SET status = 'Inactive'
       WHERE role_id = ? AND status <> 'Inactive'`,
      [role.id]
    );
    console.log(`Deactivated ${result.affectedRows} existing Viewer account(s). No accounts or role rows were deleted.`);
  } finally {
    await connection.end();
  }
}

removeViewerRole().catch((error) => {
  console.error('Viewer-role migration failed:', error.message);
  process.exitCode = 1;
});

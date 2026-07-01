const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'database', 'education_bureau.sqlite');
const isNewDb = !fs.existsSync(dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ SQLite Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to SQLite database successfully');
    }
});

// Promise wrapper to match the mysql2/promise API we used
const promisePool = {
    query: function(sql, params = []) {
        return new Promise((resolve, reject) => {
            // Check if it's a SELECT query
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                db.all(sql, params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        // mysql2/promise returns [rows, fields], we just need to return [rows]
                        resolve([rows]);
                    }
                });
            } else {
                // For INSERT, UPDATE, DELETE
                db.run(sql, params, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve([{ insertId: this.lastID, affectedRows: this.changes }]);
                    }
                });
            }
        });
    }
};

module.exports = promisePool;

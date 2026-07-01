const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'education_bureau.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Fix duplicates - keep only the lowest ID for each unique teacher
    db.run("DELETE FROM teachers WHERE id NOT IN (SELECT MIN(id) FROM teachers GROUP BY full_name, school_name)", function(err) {
        if (err) console.error('Dup fix error:', err.message);
        else console.log('Duplicate teachers removed. Rows affected:', this.changes);
    });

    // Add schools table
    db.run(`CREATE TABLE IF NOT EXISTS schools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        address TEXT NULL,
        description TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Schools table error:', err.message);
        else console.log('Schools table ready');
    });

    // Add school_id column to teachers if missing
    db.all("PRAGMA table_info(teachers)", (err, rows) => {
        if (err) {
            console.error('Table info error:', err.message);
            return;
        }
        const hasSchoolId = rows.some(r => r.name === 'school_id');
        if (!hasSchoolId) {
            db.run("ALTER TABLE teachers ADD COLUMN school_id INTEGER", (alterErr) => {
                if (alterErr) {
                    console.error('Add school_id error:', alterErr.message);
                } else {
                    console.log('Added school_id to teachers');
                }
            });
        }
        db.run(`INSERT OR IGNORE INTO schools (name) SELECT DISTINCT school_name FROM teachers WHERE school_name IS NOT NULL`, (insertErr) => {
            if (insertErr) {
                console.error('Insert schools error:', insertErr.message);
            } else {
                console.log('Schools populated from teacher school names');
                db.run(`UPDATE teachers SET school_id = (SELECT id FROM schools WHERE schools.name = teachers.school_name) WHERE school_id IS NULL`, (updateErr) => {
                    if (updateErr) {
                        console.error('Update teachers school_id error:', updateErr.message);
                    } else {
                        console.log('Teacher school_id values updated');
                    }
                });
            }
        });
    });

    // Add attendance table
    db.run(`CREATE TABLE IF NOT EXISTS leaves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_type TEXT NOT NULL,
        person_id INTEGER NOT NULL,
        leave_type TEXT NOT NULL,
        from_date DATE NOT NULL,
        to_date DATE NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'Pending',
        approved_by INTEGER,
        approved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Leaves table error:', err.message);
        else console.log('Leaves table ready');
        db.close(() => console.log('Migration complete!'));
    });
});

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'education_bureau.sqlite');
const db = new sqlite3.Database(dbPath);

const schema = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'viewer',
    avatar_color TEXT DEFAULT '#10b981',
    is_active INTEGER DEFAULT 1,
    last_login DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    gender TEXT NOT NULL,
    date_of_birth DATE NULL,
    qualification TEXT NOT NULL,
    subject_specialization TEXT NOT NULL,
    school_name TEXT NOT NULL,
    school_id INTEGER NULL,
    phone TEXT NULL,
    email TEXT NULL,
    address TEXT NULL,
    hire_date DATE NOT NULL,
    salary REAL DEFAULT 0.00,
    experience_years INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active',
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    address TEXT NULL,
    description TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    gender TEXT NOT NULL,
    date_of_birth DATE NULL,
    position TEXT NOT NULL,
    department TEXT NOT NULL,
    phone TEXT NULL,
    email TEXT NULL,
    address TEXT NULL,
    hire_date DATE NOT NULL,
    salary REAL DEFAULT 0.00,
    experience_years INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active',
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const seedData = `
INSERT OR IGNORE INTO users (username, email, password, full_name, role) VALUES
('admin', 'admin@wachale-edu.gov.et', '$2a$10$8K1p/a0dR1xqM8K5iYz8YOXzq3wGcK7.K0YmZqKF6s5lXzPnKxPG2', 'System Administrator', 'admin');

INSERT OR IGNORE INTO teachers (full_name, gender, qualification, subject_specialization, school_name, school_id, phone, email, hire_date, salary, experience_years, status) VALUES
('Abebe Kebede', 'Male', 'BSc in Mathematics', 'Mathematics', 'Wachale Primary School', NULL, '0911234567', 'abebe.k@edu.et', '2019-09-01', 8500.00, 6, 'Active'),
('Tigist Hailu', 'Female', 'BA in English', 'English Language', 'Wachale Secondary School', NULL, '0922345678', 'tigist.h@edu.et', '2020-02-15', 7800.00, 5, 'Active'),
('Dawit Mengistu', 'Male', 'MSc in Physics', 'Physics', 'Wachale Secondary School', NULL, '0933456789', 'dawit.m@edu.et', '2017-09-01', 11200.00, 8, 'Active'),
('Meron Alemu', 'Female', 'BEd in Biology', 'Biology', 'Wachale Primary School', NULL, '0944567890', 'meron.a@edu.et', '2021-09-01', 6500.00, 4, 'On Leave'),
('Yonas Tadesse', 'Male', 'BA in History', 'History', 'Debre Sina School', NULL, '0955678901', 'yonas.t@edu.et', '2015-02-01', 9800.00, 10, 'Active');

INSERT OR IGNORE INTO staff (full_name, gender, position, department, phone, email, hire_date, salary, experience_years, status) VALUES
('Kebede Worku', 'Male', 'Bureau Director', 'Administration', '0911111111', 'kebede.w@edu.et', '2014-01-15', 15000.00, 11, 'Active'),
('Hiwot Assefa', 'Female', 'HR Officer', 'Human Resources', '0922222222', 'hiwot.a@edu.et', '2018-06-01', 9200.00, 7, 'Active'),
('Solomon Bekele', 'Male', 'IT Specialist', 'ICT Department', '0933333333', 'solomon.b@edu.et', '2020-01-10', 8800.00, 5, 'Active'),
('Selamawit Girma', 'Female', 'Accountant', 'Finance', '0944444444', 'selamawit.g@edu.et', '2019-03-20', 8500.00, 6, 'Active'),
('Tesfaye Negash', 'Male', 'Driver', 'Logistics', '0955555555', 'tesfaye.n@edu.et', '2016-08-01', 5500.00, 9, 'On Leave');
`;

db.serialize(() => {
    console.log('Initializing SQLite database...');
    db.exec(schema, (err) => {
        if (err) {
            console.error('Error creating schema:', err);
            return;
        }
        console.log('Schema created successfully.');

        db.exec(seedData, (err) => {
            if (err) {
                console.error('Error inserting seed data:', err);
            } else {
                console.log('Seed data inserted successfully.');
            }
            db.close();
        });
    });
});

-- ============================================================
-- Teacher & Staff Management System — Database Schema
-- ============================================================
CREATE DATABASE IF NOT EXISTS tsms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tsms_db;

-- ----------------------- roles ---------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE,
  label       VARCHAR(100) NOT NULL,
  permissions JSON         NOT NULL DEFAULT ('[]'),
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------- schools ---------------------------
CREATE TABLE IF NOT EXISTS schools (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  name        VARCHAR(200) NOT NULL,
  principal   VARCHAR(150),
  phone       VARCHAR(30),
  email       VARCHAR(150),
  address     VARCHAR(255),
  type        ENUM('Primary','Secondary','Preparatory','TVET','Other') DEFAULT 'Primary',
  status      ENUM('Active','Inactive') DEFAULT 'Active',
  teachers    INT DEFAULT 0,
  staff_count INT DEFAULT 0,
  students    INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ----------------------- departments -----------------------
CREATE TABLE IF NOT EXISTS departments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  head        VARCHAR(150),
  description TEXT,
  school_id   INT,
  status      ENUM('Active','Inactive') DEFAULT 'Active',
  color       VARCHAR(20) DEFAULT '#2563EB',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
);

-- ----------------------- positions -----------------------
CREATE TABLE IF NOT EXISTS positions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(100) NOT NULL,
  department_id INT,
  description TEXT,
  status      ENUM('Active','Inactive') DEFAULT 'Active',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- ----------------------- users ---------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(150) NOT NULL,
  username      VARCHAR(80)  NOT NULL UNIQUE,
  email         VARCHAR(150) NOT NULL UNIQUE,
  phone         VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL,
  role_id       INT          NOT NULL,
  school_id     INT,
  department_id INT,
  status        ENUM('Active','Inactive') DEFAULT 'Active',
  last_login    TIMESTAMP    NULL,
  created_by    INT          NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id)       REFERENCES roles(id),
  FOREIGN KEY (school_id)     REFERENCES schools(id)     ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)    REFERENCES users(id)       ON DELETE SET NULL
);

-- ----------------------- teachers ---------------------------
CREATE TABLE IF NOT EXISTS teachers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tid           VARCHAR(20)  NOT NULL UNIQUE,
  name          VARCHAR(150) NOT NULL,
  gender        ENUM('Male','Female','Other') DEFAULT 'Male',
  dob           DATE,
  phone         VARCHAR(30),
  email         VARCHAR(150),
  qualification VARCHAR(200),
  department_id INT,
  school_id     INT,
  subjects      JSON DEFAULT ('[]'),
  position      VARCHAR(100),
  type          ENUM('Permanent','Contract','Temporary') DEFAULT 'Permanent',
  salary        DECIMAL(12,2) DEFAULT 0,
  experience    INT DEFAULT 0,
  joining       DATE,
  status        ENUM('Active','Inactive','On Leave') DEFAULT 'Active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (school_id)     REFERENCES schools(id)     ON DELETE SET NULL
);

-- ----------------------- staff ---------------------------
CREATE TABLE IF NOT EXISTS staff (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  sid           VARCHAR(20)  NOT NULL UNIQUE,
  name          VARCHAR(150) NOT NULL,
  gender        ENUM('Male','Female','Other') DEFAULT 'Male',
  phone         VARCHAR(30),
  email         VARCHAR(150),
  position      VARCHAR(100),
  department_id INT,
  school_id     INT,
  salary        DECIMAL(12,2) DEFAULT 0,
  joining       DATE,
  status        ENUM('Active','Inactive','On Leave') DEFAULT 'Active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (school_id)     REFERENCES schools(id)     ON DELETE SET NULL
);

-- ----------------------- attendance ---------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  employee_id   INT          NOT NULL,
  employee_type ENUM('teacher','staff') NOT NULL,
  date          DATE         NOT NULL,
  status        ENUM('Present','Absent','Late','On Leave','Holiday') DEFAULT 'Present',
  check_in      TIME,
  check_out     TIME,
  note          TEXT,
  marked_by     INT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance (employee_id, employee_type, date),
  FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ----------------------- login_logs ---------------------------
CREATE TABLE IF NOT EXISTS login_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT,
  username   VARCHAR(80),
  ip_address VARCHAR(45),
  user_agent TEXT,
  status     ENUM('success','failed') DEFAULT 'success',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- Seed: Roles
-- ============================================================
INSERT IGNORE INTO roles (id, name, label, permissions) VALUES
(1, 'Administrator', 'Administrator',
 '["*"]'),
(2, 'SchoolManager', 'School Manager',
 '["dashboard","teachers","staff","attendance","reports","profile","id-cards"]'),
(3, 'AttendanceOfficer', 'Attendance Officer',
 '["dashboard","attendance","teachers","reports","profile","id-cards"]'),
(4, 'Viewer', 'Viewer',
 '["dashboard","reports","profile","id-cards","attendance"]');

-- ============================================================
-- Seed: Schools
-- ============================================================
INSERT IGNORE INTO schools (id, code, name, principal, phone, email, address, type, status, teachers, staff_count, students) VALUES
(1,'SCH001','Wachale Primary School','Ato Abebe Tadesse','+251911234567','Wachale@edu.gov.et','Wachale Woreda','Primary','Active',48,22,1240),
(2,'SCH002','Lemlem Primary School','Ato Kebede Alemu','+251922345678','lemlem@edu.gov.et','Wachale Woreda','Primary','Active',36,18,980),
(3,'SCH003','Ayat Primary School','W/ro Tigist Haile','+251933456789','ayat@edu.gov.et','Wachale Woreda','Primary','Active',42,20,860),
(4,'SCH004','Goro Primary School','Ato Mulugeta Bekele','+251944567890','goro@edu.gov.et','Wachale Woreda','Primary','Active',54,28,1100),
(5,'SCH005','Abebe Ker Primary School','Dr. Fatuma Ahmed','+251955678901','abekeeper@edu.gov.et','Wachale Woreda','Primary','Active',38,16,750);

-- ============================================================
-- Seed: Departments
-- ============================================================
INSERT IGNORE INTO departments (id, name, head, description, status, color) VALUES
(1,'Mathematics','Dr. Abebe Tadesse','Mathematics and Applied Sciences','Active','#2563EB'),
(2,'Sciences','Ato Kebede Alemu','Natural Sciences','Active','#10B981'),
(3,'Languages','W/ro Tigist Haile','Languages and Literature','Active','#8B5CF6'),
(4,'Social Studies','Ato Mulugeta Bekele','History, Civics, Geography','Active','#F59E0B'),
(5,'Administration','Dr. Fatuma Ahmed','School Administration','Active','#EF4444'),
(6,'Finance','Ato Samuel Girma','Accounting & Finance','Active','#06B6D4');

-- ============================================================
-- Seed: Admin user  (password: Admin@1234)
-- ============================================================
-- password: "password"  ← change in production
INSERT IGNORE INTO users (id, full_name, username, email, phone, password_hash, role_id, status)
VALUES (1, 'System Administrator', 'admin', 'admin@tsms.gov.et', '+251911000001',
  '$2a$12$U5o/fJy.sJZvADGi8DbsDuaiozNabGL9Nb.1V9dPCc26ic0wj3Zqe', 1, 'Active');

-- ============================================================
-- Seed: Sample users for each role  (password: "password")
-- ============================================================
INSERT IGNORE INTO users (id, full_name, username, email, phone, password_hash, role_id, school_id, status, created_by)
VALUES
(2,'Dawit Bekele','schoolmanager','manager@tsms.gov.et','+251922000002',
 '$2a$12$U5o/fJy.sJZvADGi8DbsDuaiozNabGL9Nb.1V9dPCc26ic0wj3Zqe', 2, 1, 'Active', 1),
(3,'Sara Tesfaye','attendanceofficer','officer@tsms.gov.et','+251933000003',
 '$2a$12$U5o/fJy.sJZvADGi8DbsDuaiozNabGL9Nb.1V9dPCc26ic0wj3Zqe', 3, 1, 'Active', 1),
(4,'Yohannes Girma','viewer','viewer@tsms.gov.et','+251944000004',
 '$2a$12$U5o/fJy.sJZvADGi8DbsDuaiozNabGL9Nb.1V9dPCc26ic0wj3Zqe', 4, 1, 'Active', 1);

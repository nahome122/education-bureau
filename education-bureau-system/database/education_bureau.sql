-- =====================================================
-- Teachers & Staff Management System
-- Wachale Woreda Education Bureau
-- Database Schema
-- =====================================================

CREATE DATABASE IF NOT EXISTS education_bureau;
USE education_bureau;

-- -----------------------------------------------------
-- Table: users (system users / administrators)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'manager', 'viewer') DEFAULT 'viewer',
    avatar_color VARCHAR(7) DEFAULT '#10b981',
    is_active TINYINT(1) DEFAULT 1,
    last_login DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------
-- Table: teachers
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    gender ENUM('Male', 'Female') NOT NULL,
    date_of_birth DATE NULL,
    qualification VARCHAR(100) NOT NULL,
    subject_specialization VARCHAR(100) NOT NULL,
    school_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    address VARCHAR(255) NULL,
    hire_date DATE NOT NULL,
    salary DECIMAL(10, 2) DEFAULT 0.00,
    experience_years INT DEFAULT 0,
    status ENUM('Active', 'On Leave', 'Transferred', 'Retired', 'Terminated') DEFAULT 'Active',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------
-- Table: staff
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    gender ENUM('Male', 'Female') NOT NULL,
    date_of_birth DATE NULL,
    position VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    address VARCHAR(255) NULL,
    hire_date DATE NOT NULL,
    salary DECIMAL(10, 2) DEFAULT 0.00,
    experience_years INT DEFAULT 0,
    status ENUM('Active', 'On Leave', 'Transferred', 'Retired', 'Terminated') DEFAULT 'Active',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------
-- Default Admin User
-- Password: admin123 (bcrypt hashed)
-- -----------------------------------------------------
INSERT INTO users (username, email, password, full_name, role) VALUES
('admin', 'admin@wachale-edu.gov.et', '$2a$10$8K1p/a0dR1xqM8K5iYz8YOXzq3wGcK7.K0YmZqKF6s5lXzPnKxPG2', 'System Administrator', 'admin');

-- -----------------------------------------------------
-- Sample Teachers Data
-- -----------------------------------------------------
INSERT INTO teachers (full_name, gender, qualification, subject_specialization, school_name, phone, email, hire_date, salary, experience_years, status) VALUES
('Abebe Kebede', 'Male', 'BSc in Mathematics', 'Mathematics', 'Wachale Primary School', '0911234567', 'abebe.k@edu.et', '2019-09-01', 8500.00, 6, 'Active'),
('Tigist Hailu', 'Female', 'BA in English', 'English Language', 'Wachale Secondary School', '0922345678', 'tigist.h@edu.et', '2020-02-15', 7800.00, 5, 'Active'),
('Dawit Mengistu', 'Male', 'MSc in Physics', 'Physics', 'Wachale Secondary School', '0933456789', 'dawit.m@edu.et', '2017-09-01', 11200.00, 8, 'Active'),
('Meron Alemu', 'Female', 'BEd in Biology', 'Biology', 'Wachale Primary School', '0944567890', 'meron.a@edu.et', '2021-09-01', 6500.00, 4, 'On Leave'),
('Yonas Tadesse', 'Male', 'BA in History', 'History', 'Debre Sina School', '0955678901', 'yonas.t@edu.et', '2015-02-01', 9800.00, 10, 'Active');

-- -----------------------------------------------------
-- Sample Staff Data
-- -----------------------------------------------------
INSERT INTO staff (full_name, gender, position, department, phone, email, hire_date, salary, experience_years, status) VALUES
('Kebede Worku', 'Male', 'Bureau Director', 'Administration', '0911111111', 'kebede.w@edu.et', '2014-01-15', 15000.00, 11, 'Active'),
('Hiwot Assefa', 'Female', 'HR Officer', 'Human Resources', '0922222222', 'hiwot.a@edu.et', '2018-06-01', 9200.00, 7, 'Active'),
('Solomon Bekele', 'Male', 'IT Specialist', 'ICT Department', '0933333333', 'solomon.b@edu.et', '2020-01-10', 8800.00, 5, 'Active'),
('Selamawit Girma', 'Female', 'Accountant', 'Finance', '0944444444', 'selamawit.g@edu.et', '2019-03-20', 8500.00, 6, 'Active'),
('Tesfaye Negash', 'Male', 'Driver', 'Logistics', '0955555555', 'tesfaye.n@edu.et', '2016-08-01', 5500.00, 9, 'On Leave');

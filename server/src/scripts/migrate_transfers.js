/**
 * Migration: add transfers table + seed sample teachers & staff
 * Run: node server/src/scripts/migrate_transfers.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'tsms_db',
    multipleStatements: true,
  });

  console.log('✅  Connected to MySQL');

  try {
    // 1. Create transfers table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS transfers (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id       INT          NOT NULL,
        teacher_name     VARCHAR(150),
        teacher_tid      VARCHAR(20),
        from_school_id   INT,
        from_school_name VARCHAR(200),
        to_school_id     INT,
        to_school_name   VARCHAR(200),
        status           ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
        request_date     DATE,
        approved_date    DATE,
        reason           TEXT,
        notes            TEXT,
        requested_by     INT,
        approved_by      INT,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id)     REFERENCES teachers(id) ON DELETE CASCADE,
        FOREIGN KEY (from_school_id) REFERENCES schools(id)  ON DELETE SET NULL,
        FOREIGN KEY (to_school_id)   REFERENCES schools(id)  ON DELETE SET NULL,
        FOREIGN KEY (requested_by)   REFERENCES users(id)    ON DELETE SET NULL,
        FOREIGN KEY (approved_by)    REFERENCES users(id)    ON DELETE SET NULL
      )
    `);
    console.log('✅  transfers table ready');

    // 2. Add custom_username to teachers if missing
    await conn.query(`
      ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS custom_username VARCHAR(80) DEFAULT NULL
    `);
    console.log('✅  teachers.custom_username ready');

    // 3. Add custom_username to staff if missing
    await conn.query(`
      ALTER TABLE staff
        ADD COLUMN IF NOT EXISTS custom_username VARCHAR(80) DEFAULT NULL
    `);
    console.log('✅  staff.custom_username ready');

    // 4. Add semester score columns to teachers if missing
    await conn.query(`
      ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS semester1_score DECIMAL(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS semester2_score DECIMAL(5,2) DEFAULT 0
    `);
    console.log('✅  teachers semester score columns ready');

    // 5. Seed sample teachers (only if table is empty)
    const [[{ count }]] = await conn.query('SELECT COUNT(*) as count FROM teachers');
    if (parseInt(count) === 0) {
      await conn.query(`
        INSERT INTO teachers
          (tid, name, gender, dob, phone, email, qualification, department_id,
           school_id, position, type, salary, experience, joining, status, subjects,
           semester1_score, semester2_score)
        VALUES
          ('TCH001','John Doe','Male','1985-03-15','+251911000101','john.doe@edu.gov.et',
           'BSc Mathematics',1,1,'Senior Teacher','Permanent',8500,12,'2012-09-01','Active','["Mathematics"]',88,91),
          ('TCH002','Sarah Smith','Female','1990-07-22','+251922000102','sarah.smith@edu.gov.et',
           'BA Languages',3,2,'Teacher','Contract',6500,7,'2017-09-01','Active','["English","Amharic"]',82,79),
          ('TCH003','David Wilson','Male','1988-11-05','+251933000103','d.wilson@edu.gov.et',
           'BSc Biology',2,3,'Lead Teacher','Permanent',9200,10,'2014-09-01','Active','["Biology","Chemistry"]',95,93),
          ('TCH004','Emily Johnson','Female','1992-02-18','+251944000104','emily.j@edu.gov.et',
           'BA Social Studies',4,4,'Teacher','Permanent',7000,6,'2018-09-01','On Leave','["History","Civics"]',75,78),
          ('TCH005','Tigist Hailu','Female','1987-09-30','+251955000105','t.hailu@edu.gov.et',
           'BA Languages',3,1,'Teacher','Contract',6800,9,'2015-09-01','Active','["Amharic"]',84,87),
          ('TCH006','Abebe Kebede','Male','1983-05-12','+251966000106','a.kebede@edu.gov.et',
           'MEd Administration',5,5,'Vice Principal','Permanent',12000,15,'2009-09-01','Active','[]',90,92),
          ('TCH007','Hana Tesfaye','Female','1994-01-25','+251977000107','h.tesfaye@edu.gov.et',
           'BSc Physics',2,2,'Teacher','Temporary',5500,4,'2020-09-01','Active','["Physics","Mathematics"]',70,73),
          ('TCH008','Michael Brown','Male','1986-08-14','+251988000108','m.brown@edu.gov.et',
           'BSc Biology',2,3,'Dept. Head','Permanent',10500,14,'2010-09-01','Active','["Biology"]',89,91),
          ('TCH009','Fatuma Ahmed','Female','1991-04-08','+251999000109','f.ahmed@edu.gov.et',
           'BA English',3,4,'Teacher','Permanent',7200,8,'2016-09-01','Active','["English"]',86,88),
          ('TCH010','Solomon Girma','Male','1989-12-20','+251911000110','s.girma@edu.gov.et',
           'BSc Mathematics',1,5,'Senior Teacher','Permanent',8800,11,'2013-09-01','Active','["Mathematics","Physics"]',92,94)
      `);
      console.log('✅  10 sample teachers seeded');
    } else {
      console.log(`ℹ️   teachers already has ${count} rows — skipping seed`);
    }

    // 6. Seed sample staff (only if table is empty)
    const [[{ count: staffCount }]] = await conn.query('SELECT COUNT(*) as count FROM staff');
    if (parseInt(staffCount) === 0) {
      await conn.query(`
        INSERT INTO staff
          (sid, name, gender, phone, email, position, department_id,
           school_id, salary, joining, status)
        VALUES
          ('STF001','Almaz Bekele','Female','+251911100101','almaz.b@edu.gov.et',
           'Secretary',5,1,5500,'2018-09-01','Active'),
          ('STF002','Kebede Alemu','Male','+251922100102','kebede.a@edu.gov.et',
           'Accountant',6,1,7000,'2016-09-01','Active'),
          ('STF003','Meron Tadesse','Female','+251933100103','meron.t@edu.gov.et',
           'Librarian',5,2,5200,'2019-09-01','Active'),
          ('STF004','Tesfaye Woldе','Male','+251944100104','tesfaye.w@edu.gov.et',
           'Security Guard',5,3,4500,'2020-09-01','Active'),
          ('STF005','Birtukan Haile','Female','+251955100105','birtukan.h@edu.gov.et',
           'Cashier',6,2,5800,'2017-09-01','Active'),
          ('STF006','Dawit Mengistu','Male','+251966100106','dawit.m@edu.gov.et',
           'IT Technician',5,1,8000,'2015-09-01','Active'),
          ('STF007','Tigist Kassa','Female','+251977100107','tigist.k@edu.gov.et',
           'Cleaner',5,4,3800,'2021-09-01','On Leave'),
          ('STF008','Yonas Fekadu','Male','+251988100108','yonas.f@edu.gov.et',
           'Store Keeper',5,5,5000,'2018-09-01','Active')
      `);
      console.log('✅  8 sample staff seeded');
    } else {
      console.log(`ℹ️   staff already has ${staffCount} rows — skipping seed`);
    }

    console.log('\n🎉  Migration complete! Restart the server.');
  } catch (err) {
    console.error('❌  Migration error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

migrate();

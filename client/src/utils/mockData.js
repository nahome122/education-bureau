// ============================================================
// Mock data — used when backend is not available
// ============================================================

export const mockDashboardStats = {
  totalSchools:   5,
  totalTeachers:  218,
  totalStaff:     64,
  totalStudents:  4930,
  totalUsers:     4,
  activeUsers:    4,
  inactiveUsers:  0,
  presentToday:   196,
  absentToday:    22,
  monthly: [
    { month: 'Jan 2026', total: 180, present: 162 },
    { month: 'Feb 2026', total: 200, present: 188 },
    { month: 'Mar 2026', total: 210, present: 194 },
    { month: 'Apr 2026', total: 195, present: 178 },
    { month: 'May 2026', total: 220, present: 205 },
    { month: 'Jun 2026', total: 218, present: 196 },
  ],
  recentLogins: [
    { username: 'belete.guta',       full_name: 'Nahom Eshetu',      role: 'Administrator',    status: 'success', ip_address: '127.0.0.1',  created_at: new Date().toISOString() },
    { username: 'schoolmanager',     full_name: 'Dawit Bekele',         role: 'School Manager',   status: 'success', ip_address: '192.168.1.2', created_at: new Date(Date.now() - 3600000).toISOString() },
    { username: 'attendanceofficer', full_name: 'Sara Tesfaye',         role: 'Att. Officer',     status: 'success', ip_address: '192.168.1.3', created_at: new Date(Date.now() - 7200000).toISOString() },
    { username: 'baduser',           full_name: null,                   role: null,               status: 'failed',  ip_address: '10.0.0.5',   created_at: new Date(Date.now() - 10800000).toISOString() },
  ],
};

export const mockSchools = [
  { id: 1, code: 'SCH001', name: 'Wachale Primary School',    principal: 'Ato Abebe Tadesse',  phone: '+251911234567', email: 'wachale@edu.gov.et',  address: 'Wachale Woreda', type: 'Primary',  status: 'Active',   teachers: 48, staff_count: 22, students: 1240 },
  { id: 2, code: 'SCH002', name: 'Lemlem Primary School',     principal: 'Ato Kebede Alemu',   phone: '+251922345678', email: 'lemlem@edu.gov.et',   address: 'Wachale Woreda', type: 'Primary',  status: 'Active',   teachers: 36, staff_count: 18, students: 980  },
  { id: 3, code: 'SCH003', name: 'Ayat Primary School',       principal: "W/ro Tigist Haile",  phone: '+251933456789', email: 'ayat@edu.gov.et',     address: 'Wachale Woreda', type: 'Primary',  status: 'Active',   teachers: 42, staff_count: 20, students: 860  },
  { id: 4, code: 'SCH004', name: 'Goro Primary School',       principal: 'Ato Mulugeta Bekele',phone: '+251944567890', email: 'goro@edu.gov.et',     address: 'Wachale Woreda', type: 'Primary',  status: 'Active',   teachers: 54, staff_count: 28, students: 1100 },
  { id: 5, code: 'SCH005', name: 'Abebe Ker Primary School',  principal: 'Dr. Fatuma Ahmed',   phone: '+251955678901', email: 'abekeeper@edu.gov.et',address: 'Wachale Woreda', type: 'Primary',  status: 'Active',   teachers: 38, staff_count: 16, students: 750  },
];

export const mockTeachers = [
  { id: 1, tid: 'TCH001', name: 'John Doe',       gender: 'Male',   phone: '+251911111111', email: 'john.doe@edu.gov.et',   qualification: 'MSc Mathematics', department_name: 'Mathematics',   school_id: 1, school_name: 'Wachale Primary School', position: 'Senior Teacher',  type: 'Permanent', salary: 8500,  experience: 12, joining: '2012-01-15', status: 'Active'   },
  { id: 2, tid: 'TCH002', name: 'Sarah Smith',    gender: 'Female', phone: '+251922222222', email: 'sarah.smith@edu.gov.et', qualification: 'BA English',      department_name: 'Languages',     school_id: 2, school_name: 'Lemlem Primary School',  position: 'Teacher',         type: 'Contract',  salary: 6500,  experience: 6,  joining: '2018-09-01', status: 'Active'   },
  { id: 3, tid: 'TCH003', name: 'David Wilson',   gender: 'Male',   phone: '+251933333333', email: 'd.wilson@edu.gov.et',    qualification: 'BSc Biology',     department_name: 'Sciences',      school_id: 3, school_name: 'Ayat Primary School',    position: 'Lead Teacher',    type: 'Permanent', salary: 9200,  experience: 15, joining: '2009-04-20', status: 'Active'   },
  { id: 4, tid: 'TCH004', name: 'Emily Johnson',  gender: 'Female', phone: '+251944444444', email: 'emily.j@edu.gov.et',     qualification: 'BA History',      department_name: 'Social Studies',school_id: 4, school_name: 'Goro Primary School',    position: 'Teacher',         type: 'Permanent', salary: 7000,  experience: 4,  joining: '2020-08-10', status: 'On Leave' },
  { id: 5, tid: 'TCH005', name: 'Tigist Hailu',   gender: 'Female', phone: '+251966666666', email: 't.hailu@edu.gov.et',     qualification: 'BA Amharic',      department_name: 'Languages',     school_id: 1, school_name: 'Wachale Primary School', position: 'Teacher',         type: 'Contract',  salary: 6200,  experience: 7,  joining: '2017-05-15', status: 'Active'   },
  { id: 6, tid: 'TCH006', name: 'Abebe Kebede',   gender: 'Male',   phone: '+251977777777', email: 'a.kebede@edu.gov.et',    qualification: 'MA Education',    department_name: 'Administration',school_id: 5, school_name: 'Abebe Ker Primary School',position: 'Vice Principal',  type: 'Permanent', salary: 13500, experience: 20, joining: '2004-09-01', status: 'Active'   },
  { id: 7, tid: 'TCH007', name: 'Hana Tesfaye',   gender: 'Female', phone: '+251988888888', email: 'h.tesfaye@edu.gov.et',   qualification: 'BSc Chemistry',   department_name: 'Sciences',      school_id: 2, school_name: 'Lemlem Primary School',  position: 'Teacher',         type: 'Temporary', salary: 5800,  experience: 2,  joining: '2022-09-05', status: 'Active'   },
  { id: 8, tid: 'TCH008', name: 'Michael Brown',  gender: 'Male',   phone: '+251955555555', email: 'm.brown@edu.gov.et',     qualification: 'MSc Physics',     department_name: 'Sciences',      school_id: 3, school_name: 'Ayat Primary School',    position: 'Dept. Head',      type: 'Permanent', salary: 11000, experience: 10, joining: '2014-02-28', status: 'Active'   },
  { id: 9, tid: 'TCH009', name: 'Fatuma Ahmed',   gender: 'Female', phone: '+251944555666', email: 'f.ahmed@edu.gov.et',     qualification: 'BA Civics',       department_name: 'Social Studies',school_id: 4, school_name: 'Goro Primary School',    position: 'Teacher',         type: 'Contract',  salary: 6000,  experience: 3,  joining: '2021-01-10', status: 'Active'   },
  { id: 10,tid: 'TCH010', name: 'Kebede Alemu',   gender: 'Male',   phone: '+251911222333', email: 'k.alemu@edu.gov.et',     qualification: 'MSc Mathematics', department_name: 'Mathematics',   school_id: 5, school_name: 'Abebe Ker Primary School',position: 'Senior Teacher',  type: 'Permanent', salary: 9500,  experience: 8,  joining: '2016-08-01', status: 'Active'   },
];

export const mockStaff = [
  { id: 1, sid: 'STF001', name: 'Samuel Girma',    gender: 'Male',   position: 'Accountant',      department_name: 'Finance',        school_id: 1, school_name: 'Wachale Primary School', phone: '+251911001001', email: 's.girma@edu.gov.et',  salary: 7500, joining: '2016-03-10', status: 'Active'   },
  { id: 2, sid: 'STF002', name: 'Marta Alemu',     gender: 'Female', position: 'Secretary',       department_name: 'Administration', school_id: 2, school_name: 'Lemlem Primary School',  phone: '+251922002002', email: 'm.alemu@edu.gov.et',  salary: 5500, joining: '2019-07-15', status: 'Active'   },
  { id: 3, sid: 'STF003', name: 'Dawit Haile',     gender: 'Male',   position: 'IT Officer',      department_name: 'IT',             school_id: 3, school_name: 'Ayat Primary School',    phone: '+251933003003', email: 'd.haile@edu.gov.et',  salary: 9000, joining: '2018-01-20', status: 'Active'   },
  { id: 4, sid: 'STF004', name: 'Bethlehem Teka',  gender: 'Female', position: 'Librarian',       department_name: 'Library',        school_id: 4, school_name: 'Goro Primary School',    phone: '+251944004004', email: 'b.teka@edu.gov.et',   salary: 5200, joining: '2020-04-12', status: 'On Leave' },
  { id: 5, sid: 'STF005', name: 'Solomon Bekele',  gender: 'Male',   position: 'Security Officer', department_name: 'Security',      school_id: 2, school_name: 'Lemlem Primary School',  phone: '+251955005005', email: 's.bekele@edu.gov.et', salary: 4500, joining: '2017-11-01', status: 'Active'   },
  { id: 6, sid: 'STF006', name: 'Yeshi Tadesse',   gender: 'Female', position: 'Lab Technician',  department_name: 'Sciences',       school_id: 5, school_name: 'Abebe Ker Primary School',phone: '+251966006006', email: 'y.tadesse@edu.gov.et',salary: 6800, joining: '2021-02-28', status: 'Active'   },
  { id: 7, sid: 'STF007', name: 'Biruk Getnet',    gender: 'Male',   position: 'Cleaner',         department_name: 'Administration', school_id: 1, school_name: 'Wachale Primary School', phone: '+251977007007', email: 'b.getnet@edu.gov.et', salary: 3500, joining: '2020-01-05', status: 'Active'   },
  { id: 8, sid: 'STF008', name: 'Liya Bekele',     gender: 'Female', position: 'Nurse',           department_name: 'Health',         school_id: 3, school_name: 'Ayat Primary School',    phone: '+251988008008', email: 'l.bekele@edu.gov.et', salary: 7200, joining: '2019-03-15', status: 'Active'   },
];

export const mockDepartments = [
  { id: 1, name: 'Mathematics',    head: 'Dr. Abebe Tadesse',  description: 'Mathematics and Applied Sciences', school_name: null, status: 'Active', color: '#2563EB' },
  { id: 2, name: 'Sciences',       head: 'Ato Kebede Alemu',   description: 'Natural Sciences',                 school_name: null, status: 'Active', color: '#10B981' },
  { id: 3, name: 'Languages',      head: "W/ro Tigist Haile",  description: 'Languages and Literature',         school_name: null, status: 'Active', color: '#8B5CF6' },
  { id: 4, name: 'Social Studies', head: 'Ato Mulugeta Bekele',description: 'History, Civics, Geography',       school_name: null, status: 'Active', color: '#F59E0B' },
  { id: 5, name: 'Administration', head: 'Dr. Fatuma Ahmed',   description: 'School Administration',           school_name: null, status: 'Active', color: '#EF4444' },
  { id: 6, name: 'Finance',        head: 'Ato Samuel Girma',   description: 'Accounting and Finance',          school_name: null, status: 'Active', color: '#06B6D4' },
];

export const mockPositions = [
  { id: 1, title: 'Senior Teacher',    department_name: 'Mathematics',    description: 'Experienced teacher with leadership role', status: 'Active' },
  { id: 2, title: 'Teacher',           department_name: 'Languages',      description: 'Classroom teaching',                       status: 'Active' },
  { id: 3, title: 'Department Head',   department_name: 'Sciences',       description: 'Manages department activities',            status: 'Active' },
  { id: 4, title: 'Vice Principal',    department_name: 'Administration', description: 'Assists principal in school management',   status: 'Active' },
  { id: 5, title: 'Accountant',        department_name: 'Finance',        description: 'Financial management',                     status: 'Active' },
  { id: 6, title: 'IT Officer',        department_name: null,             description: 'IT infrastructure management',             status: 'Active' },
];

export const mockUsers = [
  { id: 1, full_name: 'Nahom Eshetu', username: 'belete.guta',             email: 'nahom@tsms.gov.et',   phone: '+251911000001', role_id: 1, role_name: 'Administrator',     role_label: 'Administrator',     school_name: 'District Office',        status: 'Active',   last_login: new Date().toISOString() },
  { id: 2, full_name: 'Dawit Bekele',         username: 'schoolmanager',     email: 'manager@tsms.gov.et', phone: '+251922000002', role_id: 2, role_name: 'SchoolManager',     role_label: 'School Manager',    school_name: 'Wachale Primary School', status: 'Active',   last_login: new Date(Date.now() - 3600000).toISOString() },
  { id: 3, full_name: 'Sara Tesfaye',         username: 'attendanceofficer', email: 'officer@tsms.gov.et', phone: '+251933000003', role_id: 3, role_name: 'AttendanceOfficer', role_label: 'Attendance Officer', school_name: 'Wachale Primary School', status: 'Active',   last_login: new Date(Date.now() - 7200000).toISOString() },
  { id: 4, full_name: 'Yohannes Girma',       username: 'viewer',            email: 'viewer@tsms.gov.et',  phone: '+251944000004', role_id: 4, role_name: 'Viewer',            role_label: 'Viewer',            school_name: 'Wachale Primary School', status: 'Active',   last_login: null },
];

export const mockAttendanceEmployees = mockTeachers.map(t => ({
  id: t.id, emp_id: t.tid, name: t.name, position: t.position,
  school_name: t.school_name, att_status: 'Present',
}));

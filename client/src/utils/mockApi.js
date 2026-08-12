/**
 * mockApi.js — Complete in-memory CRUD store with localStorage persistence.
 * All changes (add / edit / delete) are saved to localStorage immediately.
 * Data survives page refresh until the browser's localStorage is cleared.
 */
import {
  mockSchools, mockTeachers, mockStaff, mockDepartments,
  mockPositions, mockUsers, mockDashboardStats, mockTransfers,
} from './mockData';

// ─── LocalStorage persistence helpers ───────────────────────────────────────
const KEYS = {
  schools:     'tsms_schools',
  teachers:    'tsms_teachers',
  staff:       'tsms_staff',
  departments: 'tsms_departments',
  positions:   'tsms_positions',
  transfers:   'tsms_transfers',
  users:       'tsms_users',
  passwords:   'tsms_passwords',
  attendance:  'tsms_attendance',
  nextId:      'tsms_nextId',
};

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(fallback));
  } catch {
    return JSON.parse(JSON.stringify(fallback));
  }
};

const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
};

// ─── Default password store ──────────────────────────────────────────────────
const DEFAULT_PASSWORDS = {
  'belete.guta':     'Employee@123',
  schoolmanager:     'password',
  attendanceofficer: 'password',
  viewer:            'password',
};

// ─── Initialize store from localStorage (or seed data on first run) ──────────
let schools     = load(KEYS.schools,     mockSchools);
let teachers    = load(KEYS.teachers,    mockTeachers);
let staff       = load(KEYS.staff,       mockStaff);
let departments = load(KEYS.departments, mockDepartments);
let positions   = load(KEYS.positions,   mockPositions);
let transfers   = load(KEYS.transfers,   mockTransfers);
let users       = load(KEYS.users,       mockUsers);
let passwords   = load(KEYS.passwords,   DEFAULT_PASSWORDS);
let attendance  = load(KEYS.attendance,  {});
let _nextId     = load(KEYS.nextId,      1000);

// Ensure seed passwords exist even if passwords key was already saved without them
Object.entries(DEFAULT_PASSWORDS).forEach(([u, p]) => {
  if (!passwords[u]) passwords[u] = p;
});
save(KEYS.passwords, passwords);

const uid = () => { _nextId++; save(KEYS.nextId, _nextId); return _nextId; };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ok   = (payload) => ({ data: { success: true, ...payload } });
const fail = (msg, status = 400) => {
  const e = new Error(msg);
  e.response = { status, data: { success: false, message: msg } };
  throw e;
};

const paginate = (arr, p = 1, limit = 10) => ({
  data:  arr.slice((p - 1) * limit, p * limit),
  total: arr.length,
  page:  Number(p),
  limit: Number(limit),
});

const filterSearch = (arr, q, fields) => {
  if (!q) return arr;
  const lq = q.toLowerCase();
  return arr.filter(r => fields.some(f => String(r[f] || '').toLowerCase().includes(lq)));
};

// ─── Generate username from name (e.g. "John Doe" → "john.doe") ─────────────
const makeUsername = (name = '') => {
  const parts = name.trim().toLowerCase().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts[parts.length - 1]}`;
};

// ─── Auto-register credentials for all teachers & staff on startup ───────────
// Username = first.last (lowercased), Password = Employee@123
// Only register if not already in passwords store
const EMPLOYEE_DEFAULT_PASSWORD = 'Employee@123';
const _registerEmployeeCredentials = () => {
  let changed = false;
  [...teachers, ...staff].forEach(emp => {
    const username = makeUsername(emp.name);
    if (!passwords[username]) {
      passwords[username] = EMPLOYEE_DEFAULT_PASSWORD;
      changed = true;
    }
  });
  if (changed) save(KEYS.passwords, passwords);
};
_registerEmployeeCredentials();

// ─── Employee role constants ──────────────────────────────────────────────────
// Employees (Teacher/Staff) only see: dashboard, profile, id-cards, attendance (view only)
const EMPLOYEE_ROLE_PERMS = ['dashboard', 'profile', 'id-cards', 'attendance'];
const ROLE_PERMS = {
  Administrator:     ['*'],
  SchoolManager:     ['dashboard','teachers','staff','attendance','reports','profile','id-cards'],
  AttendanceOfficer: ['dashboard','attendance','teachers','reports','profile','id-cards'],
  Viewer:            ['dashboard','reports','profile','id-cards','attendance'],
};
const ROLE_NAMES  = { 1:'Administrator', 2:'SchoolManager', 3:'AttendanceOfficer', 4:'Viewer' };
const ROLE_LABELS = { 1:'Administrator', 2:'School Manager', 3:'Attendance Officer', 4:'Viewer' };

// ═══════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════
export const mockAuthLogin = async (username, password) => {
  // First check system users
  const u = users.find(u => u.username === username);
  if (u) {
    if (passwords[username] !== password) fail('Invalid username or password.', 401);
    if (u.status !== 'Active')            fail('Your account is deactivated. Contact the Administrator.', 403);
    const idx = users.findIndex(x => x.username === username);
    users[idx].last_login = new Date().toISOString();
    save(KEYS.users, users);
    return ok({ token: 'mock-token-' + Date.now(), user: { ...users[idx], permissions: ROLE_PERMS[u.role_name] || [] } });
  }

  // Then check teachers & staff — match custom_username first, then auto-generated
  const allEmps = [
    ...teachers.map(e => ({ ...e, emp_type: 'teacher' })),
    ...staff.map(e => ({ ...e, emp_type: 'staff' })),
  ];

  // Priority 1: match a custom_username stored in the employee profile override
  let emp = allEmps.find(e => {
    const profileKey = `tsms_emp_profile_${e.emp_type}_${e.id}`;
    try {
      const saved = localStorage.getItem(profileKey);
      if (!saved) return false;
      const override = JSON.parse(saved);
      return override.username && override.username.toLowerCase() === username.toLowerCase();
    } catch { return false; }
  });

  // Priority 2: fall back to auto-derived first.last username
  if (!emp) {
    emp = allEmps.find(e => makeUsername(e.name) === username);
  }
  if (emp) {
    if (passwords[username] !== password) fail('Invalid username or password.', 401);
    if (emp.status === 'Inactive') fail('Your account is deactivated. Contact the Administrator.', 403);
    const empUser = {
      id:          `emp_${emp.emp_type}_${emp.id}`,
      full_name:   emp.name,
      username,
      email:       emp.email || '',
      phone:       emp.phone || '',
      gender:      emp.gender || '',
      dob:         emp.dob || '',
      address:     emp.address || '',
      bio:         emp.bio || '',
      role_id:     null,
      role_name:   emp.emp_type === 'teacher' ? 'Teacher' : 'Staff',
      role_label:  emp.emp_type === 'teacher' ? 'Teacher' : 'Staff',
      school_name: emp.school_name || '',
      school_id:   emp.school_id || null,
      status:      emp.status,
      permissions: EMPLOYEE_ROLE_PERMS,
      emp_type:    emp.emp_type,
      emp_id:      emp.id,
      emp_code:    emp.tid || emp.sid,
      last_login:  new Date().toISOString(),
    };
    return ok({ token: 'mock-token-' + Date.now(), user: empUser });
  }

  fail('Invalid username or password.', 401);
};

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetDashboard = async () => {
  const today = new Date().toISOString().split('T')[0];

  // Count attendance totals for today
  const presentToday = Object.entries(attendance)
    .filter(([k, v]) => k.endsWith(`-${today}`) && v === 'Present').length;
  const absentToday = Object.entries(attendance)
    .filter(([k, v]) => k.endsWith(`-${today}`) && v === 'Absent').length;

  const activeUsers   = users.filter(u => u.status === 'Active').length;
  const inactiveUsers = users.filter(u => u.status !== 'Active').length;

  return ok({
    data: {
      ...mockDashboardStats,
      totalSchools:   schools.filter(s => s.status === 'Active').length,
      totalTeachers:  teachers.filter(t => t.status === 'Active').length,
      totalStaff:     staff.filter(s => s.status === 'Active').length,
      totalStudents:  schools.filter(s => s.status === 'Active').reduce((sum, s) => sum + (Number(s.students) || 0), 0),
      totalUsers:     users.length,
      activeUsers,
      inactiveUsers,
      presentToday,
      absentToday,
      recentLogins: users
        .filter(u => u.last_login)
        .sort((a, b) => new Date(b.last_login) - new Date(a.last_login))
        .slice(0, 8)
        .map(u => ({
          username:   u.username,
          full_name:  u.full_name,
          role:       ROLE_LABELS[u.role_id] || u.role_name,
          status:     'success',
          ip_address: '127.0.0.1',
          created_at: u.last_login,
        })),
    }
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// SCHOOLS
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetSchools = async (params = {}) => {
  let list = [...schools];
  if (params.search) list = filterSearch(list, params.search, ['name','code','principal']);
  if (params.status) list = list.filter(s => s.status === params.status);
  return ok(paginate(list, +params.page || 1, +params.limit || 10));
};

export const mockCreateSchool = async (body) => {
  if (!body.name || !body.code) fail('Code and Name required.');
  if (schools.find(s => s.code === body.code)) fail('School code already exists.', 409);
  const rec = { ...body, id: uid(), teachers: 0, staff_count: 0, students: +body.students || 0 };
  schools.unshift(rec);
  save(KEYS.schools, schools);
  return ok({ message: 'School created.', id: rec.id });
};

export const mockUpdateSchool = async (id, body) => {
  const i = schools.findIndex(s => s.id === +id);
  if (i === -1) fail('School not found.', 404);
  if (schools.find(s => s.code === body.code && s.id !== +id)) fail('Code already exists.', 409);
  schools[i] = { ...schools[i], ...body };
  save(KEYS.schools, schools);
  return ok({ message: 'School updated.' });
};

export const mockDeleteSchool = async (id) => {
  schools = schools.filter(s => s.id !== +id);
  save(KEYS.schools, schools);
  return ok({ message: 'School deleted.' });
};

// ═══════════════════════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetDepartments = async () =>
  ok({ data: [...departments] });

export const mockCreateDept = async (body) => {
  if (!body.name) fail('Name required.');
  const rec = { ...body, id: uid() };
  departments.push(rec);
  save(KEYS.departments, departments);
  return ok({ message: 'Department created.', id: rec.id });
};

export const mockUpdateDept = async (id, body) => {
  const i = departments.findIndex(d => d.id === +id);
  if (i === -1) fail('Department not found.', 404);
  departments[i] = { ...departments[i], ...body };
  save(KEYS.departments, departments);
  return ok({ message: 'Department updated.' });
};

export const mockDeleteDept = async (id) => {
  departments = departments.filter(d => d.id !== +id);
  save(KEYS.departments, departments);
  return ok({ message: 'Department deleted.' });
};

// ═══════════════════════════════════════════════════════════════════════════
// POSITIONS
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetPositions = async () =>
  ok({ data: [...positions] });

export const mockCreatePosition = async (body) => {
  if (!body.title) fail('Title required.');
  const dept = departments.find(d => d.id === +body.department_id);
  const rec  = { ...body, id: uid(), department_name: dept?.name || null };
  positions.push(rec);
  save(KEYS.positions, positions);
  return ok({ message: 'Position created.', id: rec.id });
};

export const mockUpdatePosition = async (id, body) => {
  const i = positions.findIndex(p => p.id === +id);
  if (i === -1) fail('Position not found.', 404);
  const dept = departments.find(d => d.id === +body.department_id);
  positions[i] = { ...positions[i], ...body, department_name: dept?.name || positions[i].department_name };
  save(KEYS.positions, positions);
  return ok({ message: 'Position updated.' });
};

export const mockDeletePosition = async (id) => {
  positions = positions.filter(p => p.id !== +id);
  save(KEYS.positions, positions);
  return ok({ message: 'Position deleted.' });
};

export const mockGetTransfers = async (params = {}) => {
  let list = [...transfers];
  if (params.search) list = filterSearch(list, params.search, ['teacher_name', 'teacher_tid', 'from_school_name', 'to_school_name', 'status', 'reason']);
  if (params.status) list = list.filter(t => t.status === params.status);
  if (params.teacher_id) list = list.filter(t => String(t.teacher_id) === String(params.teacher_id));
  if (params.school_id) list = list.filter(t => String(t.from_school_id) === String(params.school_id) || String(t.to_school_id) === String(params.school_id));
  return ok({ data: list });
};

export const mockCreateTransfer = async (body) => {
  if (!body.teacher_id || !body.to_school_id) fail('Teacher and destination school required.');
  const teacher = teachers.find(t => String(t.id) === String(body.teacher_id));
  const fromSchool = schools.find(s => s.id === teacher?.school_id);
  const toSchool = schools.find(s => String(s.id) === String(body.to_school_id));
  const rec = {
    id: uid(),
    teacher_id: +body.teacher_id,
    teacher_name: teacher?.name || 'Unknown',
    teacher_tid: teacher?.tid || '',
    from_school_id: teacher?.school_id || null,
    from_school_name: fromSchool?.name || null,
    to_school_id: toSchool?.id || null,
    to_school_name: toSchool?.name || null,
    status: 'Pending',
    request_date: new Date().toISOString().split('T')[0],
    reason: body.reason || '',
  };
  transfers.unshift(rec);
  save(KEYS.transfers, transfers);
  return ok({ message: 'Transfer request created.', id: rec.id });
};

export const mockUpdateTransferStatus = async (id, body) => {
  const existing = transfers.find(t => String(t.id) === String(id));
  if (!existing) fail('Transfer not found.', 404);
  existing.status = body.status || existing.status;
  save(KEYS.transfers, transfers);
  return ok({ message: `Transfer ${existing.status.toLowerCase()} successfully.` });
};

// ═══════════════════════════════════════════════════════════════════════════
// TEACHERS  — employees can only fetch their own record
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetTeachers = async (params = {}) => {
  let list = [...teachers];
  if (params.search)    list = filterSearch(list, params.search, ['name','tid','email']);
  if (params.status)    list = list.filter(t => t.status === params.status);
  if (params.school_id) list = list.filter(t => String(t.school_id) === String(params.school_id));
  // Employee self-filter: only return their own record
  if (params._emp_code) list = list.filter(t => t.tid === params._emp_code);
  if (params.sort === 'az') {
    list = list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }
  return ok(paginate(list, +params.page || 1, +params.limit || 10));
};

export const mockCreateTeacher = async (body) => {
  if (!body.name || !body.tid) fail('Name and Teacher ID required.');
  if (teachers.find(t => t.tid === body.tid)) fail('Teacher ID already exists.', 409);
  const dept   = departments.find(d => d.id === +body.department_id);
  const school = schools.find(s => s.id === +body.school_id);
  const rec = { ...body, id: uid(), department_name: dept?.name || null, school_name: school?.name || null };
  teachers.unshift(rec);
  save(KEYS.teachers, teachers);

  // Register login credentials for the new teacher
  const username = makeUsername(rec.name);
  if (!passwords[username]) {
    passwords[username] = EMPLOYEE_DEFAULT_PASSWORD;
    save(KEYS.passwords, passwords);
  }

  // Update school teacher count
  if (body.school_id) {
    const si = schools.findIndex(s => s.id === +body.school_id);
    if (si !== -1) {
      schools[si].teachers = (schools[si].teachers || 0) + 1;
      save(KEYS.schools, schools);
    }
  }

  return ok({ message: 'Teacher added.', id: rec.id });
};

export const mockUpdateTeacher = async (id, body) => {
  const i = teachers.findIndex(t => t.id === +id);
  if (i === -1) fail('Teacher not found.', 404);
  if (teachers.find(t => t.tid === body.tid && t.id !== +id)) fail('Teacher ID already exists.', 409);

  const oldSchoolId = teachers[i].school_id;
  const newSchoolId = body.school_id ? +body.school_id : null;

  const dept   = departments.find(d => d.id === +body.department_id);
  const school = schools.find(s => s.id === newSchoolId);
  teachers[i] = {
    ...teachers[i], ...body,
    department_name: dept?.name   || teachers[i].department_name,
    school_name:     school?.name || teachers[i].school_name,
  };
  save(KEYS.teachers, teachers);

  // Update school counts if school changed
  if (oldSchoolId !== newSchoolId) {
    if (oldSchoolId) {
      const si = schools.findIndex(s => s.id === +oldSchoolId);
      if (si !== -1) { schools[si].teachers = Math.max(0, (schools[si].teachers || 1) - 1); }
    }
    if (newSchoolId) {
      const si = schools.findIndex(s => s.id === newSchoolId);
      if (si !== -1) { schools[si].teachers = (schools[si].teachers || 0) + 1; }
    }
    save(KEYS.schools, schools);
  }

  return ok({ message: 'Teacher updated.' });
};

export const mockDeleteTeacher = async (id) => {
  const t = teachers.find(t => t.id === +id);
  teachers = teachers.filter(t => t.id !== +id);
  save(KEYS.teachers, teachers);

  // Decrement school teacher count
  if (t?.school_id) {
    const si = schools.findIndex(s => s.id === +t.school_id);
    if (si !== -1) {
      schools[si].teachers = Math.max(0, (schools[si].teachers || 1) - 1);
      save(KEYS.schools, schools);
    }
  }

  return ok({ message: 'Teacher deleted.' });
};

// ═══════════════════════════════════════════════════════════════════════════
// STAFF  — employees can only fetch their own record
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetStaff = async (params = {}) => {
  let list = [...staff];
  if (params.search)    list = filterSearch(list, params.search, ['name','sid','email']);
  if (params.status)    list = list.filter(s => s.status === params.status);
  if (params.school_id) list = list.filter(s => String(s.school_id) === String(params.school_id));
  // Employee self-filter: only return their own record
  if (params._emp_code) list = list.filter(s => s.sid === params._emp_code);
  return ok(paginate(list, +params.page || 1, +params.limit || 10));
};

export const mockCreateStaff = async (body) => {
  if (!body.name || !body.sid) fail('Name and Staff ID required.');
  if (staff.find(s => s.sid === body.sid)) fail('Staff ID already exists.', 409);
  const dept   = departments.find(d => d.id === +body.department_id);
  const school = schools.find(s => s.id === +body.school_id);
  const rec = { ...body, id: uid(), department_name: dept?.name || null, school_name: school?.name || null };
  staff.unshift(rec);
  save(KEYS.staff, staff);

  // Register login credentials for the new staff member
  const username = makeUsername(rec.name);
  if (!passwords[username]) {
    passwords[username] = EMPLOYEE_DEFAULT_PASSWORD;
    save(KEYS.passwords, passwords);
  }

  // Update school staff count
  if (body.school_id) {
    const si = schools.findIndex(s => s.id === +body.school_id);
    if (si !== -1) {
      schools[si].staff_count = (schools[si].staff_count || 0) + 1;
      save(KEYS.schools, schools);
    }
  }

  return ok({ message: 'Staff added.', id: rec.id });
};

export const mockUpdateStaff = async (id, body) => {
  const i = staff.findIndex(s => s.id === +id);
  if (i === -1) fail('Staff not found.', 404);
  if (staff.find(s => s.sid === body.sid && s.id !== +id)) fail('Staff ID already exists.', 409);

  const oldSchoolId = staff[i].school_id;
  const newSchoolId = body.school_id ? +body.school_id : null;

  const dept   = departments.find(d => d.id === +body.department_id);
  const school = schools.find(s => s.id === newSchoolId);
  staff[i] = {
    ...staff[i], ...body,
    department_name: dept?.name   || staff[i].department_name,
    school_name:     school?.name || staff[i].school_name,
  };
  save(KEYS.staff, staff);

  // Update school staff_count if school changed
  if (oldSchoolId !== newSchoolId) {
    if (oldSchoolId) {
      const si = schools.findIndex(s => s.id === +oldSchoolId);
      if (si !== -1) { schools[si].staff_count = Math.max(0, (schools[si].staff_count || 1) - 1); }
    }
    if (newSchoolId) {
      const si = schools.findIndex(s => s.id === newSchoolId);
      if (si !== -1) { schools[si].staff_count = (schools[si].staff_count || 0) + 1; }
    }
    save(KEYS.schools, schools);
  }

  return ok({ message: 'Staff updated.' });
};

export const mockDeleteStaff = async (id) => {
  const s = staff.find(s => s.id === +id);
  staff = staff.filter(s => s.id !== +id);
  save(KEYS.staff, staff);

  // Decrement school staff count
  if (s?.school_id) {
    const si = schools.findIndex(sc => sc.id === +s.school_id);
    if (si !== -1) {
      schools[si].staff_count = Math.max(0, (schools[si].staff_count || 1) - 1);
      save(KEYS.schools, schools);
    }
  }

  return ok({ message: 'Staff deleted.' });
};

// ═══════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetUsers = async (params = {}) => {
  let list = [...users];
  if (params.search) list = filterSearch(list, params.search, ['full_name','username','email']);
  if (params.role)   list = list.filter(u => u.role_name === params.role);
  if (params.status) list = list.filter(u => u.status === params.status);
  return ok(paginate(list, +params.page || 1, +params.limit || 10));
};

export const mockCreateUser = async (body) => {
  if (!body.full_name || !body.username || !body.email || !body.role_id)
    fail('All required fields must be filled.');
  if (users.find(u => u.username === body.username)) fail('Username already exists.', 409);
  if (users.find(u => u.email    === body.email))    fail('Email already exists.', 409);
  if (!body.password || body.password.length < 6)    fail('Password must be at least 6 characters.');

  const school = schools.find(s => s.id === +body.school_id);
  const rec = {
    ...body,
    id:          uid(),
    role_name:   ROLE_NAMES[+body.role_id]  || 'Viewer',
    role_label:  ROLE_LABELS[+body.role_id] || 'Viewer',
    school_name: school?.name || null,
    last_login:  null,
  };

  // Save password
  passwords[body.username] = body.password;
  save(KEYS.passwords, passwords);

  users.unshift(rec);
  save(KEYS.users, users);
  return ok({ message: 'User created.', id: rec.id });
};

export const mockUpdateUser = async (id, body) => {
  const i = users.findIndex(u => u.id === +id);
  if (i === -1) fail('User not found.', 404);
  if (users.find(u => u.username === body.username && u.id !== +id)) fail('Username already exists.', 409);
  const school = schools.find(s => s.id === +body.school_id);
  users[i] = {
    ...users[i], ...body,
    role_name:   ROLE_NAMES[+body.role_id]  || users[i].role_name,
    role_label:  ROLE_LABELS[+body.role_id] || users[i].role_label,
    school_name: school?.name || users[i].school_name,
  };
  save(KEYS.users, users);
  return ok({ message: 'User updated.' });
};

export const mockDeleteUser = async (id) => {
  const u = users.find(u => u.id === +id);
  if (u) { delete passwords[u.username]; save(KEYS.passwords, passwords); }
  users = users.filter(u => u.id !== +id);
  save(KEYS.users, users);
  return ok({ message: 'User deleted.' });
};

export const mockSetUserStatus = async (id, status) => {
  const i = users.findIndex(u => u.id === +id);
  if (i !== -1) { users[i].status = status; save(KEYS.users, users); }
  return ok({ message: `User ${status === 'Active' ? 'activated' : 'deactivated'}.` });
};

export const mockResetPassword = async (id, newPassword) => {
  const u = users.find(u => u.id === +id);
  if (u) { passwords[u.username] = newPassword; save(KEYS.passwords, passwords); }
  return ok({ message: 'Password reset successfully.' });
};

const buildProfilePatch = (body) => {
  const allowed = ['full_name', 'phone', 'email', 'gender', 'dob', 'address', 'bio'];
  const patch = {};
  allowed.forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });
  return patch;
};

const buildEmployeeUser = (emp, empType, usernameOverride) => {
  const username = usernameOverride || makeUsername(emp.name);
  return {
    id:          `emp_${empType}_${emp.id}`,
    full_name:   emp.name,
    username,
    email:       emp.email || '',
    phone:       emp.phone || '',
    gender:      emp.gender || '',
    dob:         emp.dob || '',
    address:     emp.address || '',
    bio:         emp.bio || '',
    role_id:     null,
    role_name:   empType === 'teacher' ? 'Teacher' : 'Staff',
    role_label:  empType === 'teacher' ? 'Teacher' : 'Staff',
    school_name: emp.school_name || '',
    school_id:   emp.school_id || null,
    status:      emp.status,
    permissions: EMPLOYEE_ROLE_PERMS,
    emp_type:    empType,
    emp_id:      emp.id,
    emp_code:    emp.tid || emp.sid,
    last_login:  new Date().toISOString(),
  };
};

const renameEmployeeCredentials = (oldName, newName) => {
  const oldUsername = makeUsername(oldName);
  const newUsername = makeUsername(newName);
  if (!oldUsername || !newUsername || oldUsername === newUsername) return newUsername || oldUsername;
  if (passwords[oldUsername]) {
    passwords[newUsername] = passwords[oldUsername];
    delete passwords[oldUsername];
    save(KEYS.passwords, passwords);
  }
  return newUsername;
};

export const mockSaveMyProfile = async (user, body) => {
  const patch = buildProfilePatch(body);

  if (user?.emp_type && user?.emp_id) {
    const source = user.emp_type === 'teacher' ? teachers : staff;
    const i = source.findIndex(e => e.id === +user.emp_id);
    if (i === -1) fail('Employee record not found.', 404);

    const oldName = source[i].name;
    source[i] = {
      ...source[i],
      name:    patch.full_name ?? source[i].name,
      phone:   patch.phone    ?? source[i].phone,
      email:   patch.email    ?? source[i].email,
      gender:  patch.gender   ?? source[i].gender,
      dob:     patch.dob      ?? source[i].dob,
      address: patch.address  ?? source[i].address,
      bio:     patch.bio      ?? source[i].bio,
    };

    const username = renameEmployeeCredentials(oldName, source[i].name);
    save(user.emp_type === 'teacher' ? KEYS.teachers : KEYS.staff, source);

    return ok({
      message: 'Profile updated successfully.',
      user: buildEmployeeUser(source[i], user.emp_type, username),
    });
  }

  const i = users.findIndex(u => String(u.id) === String(user?.id));
  if (i === -1) fail('User not found.', 404);

  users[i] = { ...users[i], ...patch };
  save(KEYS.users, users);

  return ok({
    message: 'Profile updated successfully.',
    user: {
      ...users[i],
      permissions: ROLE_PERMS[users[i].role_name] || [],
    },
  });
};

export const mockUpdateProfile = async (id, body) => {
  const patch = buildProfilePatch(body);
  const found = users.find(u => String(u.id) === String(id));
  if (!found) fail('User not found.', 404);

  const i = users.findIndex(u => String(u.id) === String(id));
  users[i] = { ...users[i], ...patch };
  save(KEYS.users, users);

  return ok({
    message: 'Profile updated successfully.',
    user: {
      ...users[i],
      permissions: ROLE_PERMS[users[i].role_name] || [],
    },
  });
};

// ── Employee password change (mock only) ─────────────────────────────────────
export const mockChangeEmployeePassword = async (username, currentPassword, newPassword) => {
  if (!passwords[username]) fail('User not found.', 404);
  if (passwords[username] !== currentPassword) fail('Current password is incorrect.', 401);
  if (!newPassword || newPassword.length < 6) fail('New password must be at least 6 characters.', 400);
  passwords[username] = newPassword;
  save(KEYS.passwords, passwords);
  return ok({ message: 'Password changed successfully.' });
};

// ── Username change (mock) ────────────────────────────────────────────────────
export const mockChangeUsername = async (currentUser, newUsername) => {
  const trimmed = newUsername.trim().toLowerCase();
  if (!trimmed || trimmed.length < 3) fail('Username must be at least 3 characters.', 400);

  // Check uniqueness across system users
  if (users.find(u => u.username.toLowerCase() === trimmed && String(u.id) !== String(currentUser?.id))) {
    fail('Username already taken.', 409);
  }
  // Check uniqueness across employee overrides
  const allEmps = [
    ...teachers.map(e => ({ ...e, emp_type: 'teacher' })),
    ...staff.map(e => ({ ...e, emp_type: 'staff' })),
  ];
  for (const e of allEmps) {
    // Skip the current user's own record
    if (currentUser?.emp_type === e.emp_type && String(currentUser?.emp_id) === String(e.id)) continue;
    try {
      const saved = localStorage.getItem(`tsms_emp_profile_${e.emp_type}_${e.id}`);
      if (saved) {
        const ov = JSON.parse(saved);
        if (ov.username && ov.username.toLowerCase() === trimmed) fail('Username already taken.', 409);
      }
    } catch { /* ignore */ }
  }

  const isEmp = !!(currentUser?.emp_type && currentUser?.emp_id != null);

  if (isEmp) {
    // For employees: store the new username in their profile override
    const profileKey = `tsms_emp_profile_${currentUser.emp_type}_${currentUser.emp_id}`;
    let override = {};
    try { override = JSON.parse(localStorage.getItem(profileKey) || '{}'); } catch { /* ignore */ }
    override.username = trimmed;
    localStorage.setItem(profileKey, JSON.stringify(override));

    // Also update the passwords store: new key = trimmed, keep old key as well
    // so both old and new username work until next login
    const oldUsername = currentUser.username;
    if (oldUsername && passwords[oldUsername] !== undefined) {
      passwords[trimmed] = passwords[oldUsername];
      // Keep old key so session doesn't break immediately
      save(KEYS.passwords, passwords);
    }

    return ok({
      message: 'Username changed successfully.',
      user: { ...currentUser, username: trimmed },
    });
  }

  // System user: update username in users array and passwords store
  const i = users.findIndex(u => String(u.id) === String(currentUser?.id));
  if (i === -1) fail('User not found.', 404);

  const oldUsername = users[i].username;
  users[i] = { ...users[i], username: trimmed };
  save(KEYS.users, users);

  // Transfer password to new username key
  if (passwords[oldUsername] !== undefined) {
    passwords[trimmed] = passwords[oldUsername];
    delete passwords[oldUsername];
    save(KEYS.passwords, passwords);
  }

  return ok({
    message: 'Username changed successfully.',
    user: { ...users[i], permissions: ROLE_PERMS[users[i].role_name] || [] },
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// ATTENDANCE
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetAttendance = async (params = {}) => {
  const type   = params.type || 'teacher';
  const source = type === 'teacher' ? teachers : staff;

  let filtered = source.filter(e => e.status === 'Active');
  if (params.school_id && String(params.school_id) !== '') {
    filtered = filtered.filter(e => String(e.school_id) === String(params.school_id));
  }

  // For employee self-filter
  if (params._emp_id) {
    filtered = filtered.filter(e => e.id === +params._emp_id);
  }

  const data = filtered.map(e => {
    const attKey = `${type}-${e.id}-${params.date}`;
    const attRecord = attendance[attKey];
    return {
      id:          e.id,
      emp_id:      e.tid || e.sid,
      name:        e.name,
      position:    e.position || '—',
      school_name: e.school_name || '—',
      school_id:   e.school_id  || null,
      date:        params.date,
      att_status:  typeof attRecord === 'string' ? attRecord : (attRecord?.status || null),
      check_in:    attRecord?.check_in || null,
      check_out:   attRecord?.check_out || null,
      note:        attRecord?.note || null,
    };
  });

  return ok({ data, date: params.date, total: data.length, page: 1, limit: 100 });
};

export const mockMarkAttendance = async (body) => {
  const { date, employee_type, records } = body;
  records.forEach(r => {
    const key = `${employee_type}-${r.employee_id}-${date}`;
    attendance[key] = {
      status: r.status || 'Present',
      check_in: r.check_in || new Date().toISOString(),
      check_out: r.check_out || null,
      note: r.note || null,
    };
  });
  save(KEYS.attendance, attendance);
  return ok({ message: `Attendance saved for ${records.length} employees.` });
};

// ═══════════════════════════════════════════════════════════════════════════
// LOGS
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetLogs = async () => {
  const data = users
    .filter(u => u.last_login)
    .sort((a, b) => new Date(b.last_login) - new Date(a.last_login))
    .slice(0, 20)
    .map((u, i) => ({
      id:         i + 1,
      username:   u.username,
      full_name:  u.full_name,
      status:     'success',
      ip_address: '127.0.0.1',
      created_at: u.last_login,
    }));
  return ok({ data, total: data.length, page: 1, limit: 20 });
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY — reset all data back to seed (for development/testing)
// ═══════════════════════════════════════════════════════════════════════════
export const resetAllMockData = () => {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  window.location.reload();
};

/**
 * mockApi.js — Complete in-memory CRUD store with localStorage persistence.
 * All changes (add / edit / delete) are saved to localStorage immediately.
 * Data survives page refresh until the browser's localStorage is cleared.
 */
import {
  mockSchools, mockTeachers, mockStaff, mockDepartments,
  mockPositions, mockUsers, mockDashboardStats, mockTransfers,
  DEFAULT_PERMISSION_MATRIX,
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
  permissions: 'tsms_permissions',
  resetCodes:  'tsms_reset_codes',
  transferHistoryClears: 'tsms_transfer_history_clears',
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
let permissions = load(KEYS.permissions, {});
let resetCodes  = load(KEYS.resetCodes,  {});
let transferHistoryClears = load(KEYS.transferHistoryClears, {});

// Keep stale offline Viewer accounts visible to administrators but never usable.
users = users.map((user) => user.role_name === 'Viewer' ? { ...user, status: 'Inactive' } : user);
save(KEYS.users, users);
delete passwords.viewer;

// Ensure seed passwords exist
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

// Ensure username is unique — append number if needed
const makeUniqueUsername = (name) => {
  const base = makeUsername(name);
  let candidate = base;
  let n = 2;
  const allUsernames = [
    ...users.map(u => u.username.toLowerCase()),
    // Employee profile override usernames
    ...[...teachers, ...staff].map(e => {
      try {
        const empType = teachers.includes(e) ? 'teacher' : 'staff';
        const saved = localStorage.getItem(`tsms_emp_profile_${empType}_${e.id}`);
        if (saved) {
          const ov = JSON.parse(saved);
          return ov.username ? ov.username.toLowerCase() : null;
        }
      } catch { /* ignore */ }
      return null;
    }).filter(Boolean),
    ...Object.keys(passwords).map(k => k.toLowerCase()),
  ];
  while (allUsernames.includes(candidate)) {
    candidate = `${base}${n}`;
    n++;
  }
  return candidate;
};

// ─── Auto-register credentials for all teachers & staff on startup ───────────
const EMPLOYEE_DEFAULT_PASSWORD_FN = (firstName) =>
  `${firstName.toLowerCase()}@123`;

const _registerEmployeeCredentials = () => {
  let changed = false;
  [...teachers, ...staff].forEach(emp => {
    const username = makeUsername(emp.name);
    const firstName = emp.name.trim().split(/\s+/)[0];
    if (!passwords[username]) {
      passwords[username] = EMPLOYEE_DEFAULT_PASSWORD_FN(firstName);
      changed = true;
    }
  });
  if (changed) save(KEYS.passwords, passwords);
};
_registerEmployeeCredentials();

// ─── Role constants ──────────────────────────────────────────────────────────
const EMPLOYEE_ROLE_PERMS = ['dashboard', 'profile', 'id-cards', 'attendance'];
const ROLE_PERMS = {
  Administrator:     ['*'],
  SchoolManager:     ['dashboard','teachers','staff','attendance','reports','profile','id-cards','departments','teacher-performance','transfer','schools'],
  AttendanceOfficer: ['dashboard','attendance','teachers','staff','reports','profile','teacher-performance'],
};
const ROLE_NAMES  = { 1:'Administrator', 2:'SchoolManager', 3:'AttendanceOfficer' };
const ROLE_LABELS = { 1:'Administrator', 2:'School Manager', 3:'Attendance Officer' };

// ─── Permission matrix helpers ─────────────────────────────────────────────
const getDefaultMatrix = (roleName) =>
  DEFAULT_PERMISSION_MATRIX[roleName] || {};

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
    const userPerms = permissions[String(u.id)] || getDefaultMatrix(u.role_name);
    return ok({
      token: 'mock-token-' + Date.now(),
      user: {
        ...users[idx],
        permissions: ROLE_PERMS[u.role_name] || [],
        permission_matrix: userPerms,
      },
    });
  }

  // Then check teachers & staff
  const allEmps = [
    ...teachers.map(e => ({ ...e, emp_type: 'teacher' })),
    ...staff.map(e => ({ ...e, emp_type: 'staff' })),
  ];

  // Priority 1: custom username in profile override
  let emp = allEmps.find(e => {
    const profileKey = `tsms_emp_profile_${e.emp_type}_${e.id}`;
    try {
      const saved = localStorage.getItem(profileKey);
      if (!saved) return false;
      const override = JSON.parse(saved);
      return override.username && override.username.toLowerCase() === username.toLowerCase();
    } catch { return false; }
  });

  // Priority 2: auto-derived first.last username
  if (!emp) {
    emp = allEmps.find(e => makeUsername(e.name) === username);
  }

  if (emp) {
    if (passwords[username] !== password) fail('Invalid username or password.', 401);
    if (emp.status === 'Inactive') fail('Your account is deactivated. Contact the Administrator.', 403);
    const roleName = emp.emp_type === 'teacher' ? 'Teacher' : 'Staff';
    const empUser = {
      id:                   `emp_${emp.emp_type}_${emp.id}`,
      full_name:            emp.name,
      username,
      email:                emp.email || '',
      phone:                emp.phone || '',
      gender:               emp.gender || '',
      dob:                  emp.dob || '',
      address:              emp.address || '',
      bio:                  emp.bio || '',
      role_id:              null,
      role_name:            roleName,
      role_label:           roleName,
      school_name:          emp.school_name || '',
      school_id:            emp.school_id || null,
      status:               emp.status,
      permissions:          EMPLOYEE_ROLE_PERMS,
      permission_matrix:    getDefaultMatrix(roleName),
      must_change_password: emp.must_change_password || false,
      emp_type:             emp.emp_type,
      emp_id:               emp.id,
      emp_code:             emp.tid || emp.sid,
      last_login:           new Date().toISOString(),
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

  const presentToday = Object.entries(attendance)
    .filter(([k, v]) => k.endsWith(`-${today}`) && (v === 'Present' || v?.status === 'Present')).length;
  const absentToday = Object.entries(attendance)
    .filter(([k, v]) => k.endsWith(`-${today}`) && (v === 'Absent' || v?.status === 'Absent')).length;

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
  let list = schools.map((school) => ({
    ...school,
    teachers: teachers.filter((teacher) => String(teacher.school_id) === String(school.id)).length,
    staff_count: staff.filter((member) => String(member.school_id) === String(school.id)).length,
  }));
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

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFERS
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetTransfers = async (params = {}) => {
  let list = [...transfers];
  if (params.search) list = filterSearch(list, params.search, ['teacher_name', 'teacher_tid', 'from_school_name', 'to_school_name', 'status', 'reason']);
  if (params.status) list = list.filter(t => t.status === params.status);
  if (params.teacher_id) list = list.filter(t => String(t.teacher_id) === String(params.teacher_id));
  if (params.school_id) list = list.filter(t => String(t.from_school_id) === String(params.school_id) || String(t.to_school_id) === String(params.school_id));
  return ok({ data: list });
};

export const mockCreateTransfer = async (body) => {
  const type = body.employee_type || 'teacher';
  if (!['teacher', 'staff'].includes(type)) fail('Invalid employee type.');
  const employeeId = body.employee_id || body.teacher_id;
  const people = type === 'staff' ? staff : teachers;
  if (!employeeId || !body.to_school_id || !body.reason?.trim()) fail('Employee, destination school, and transfer reason are required.');
  const person = people.find(item => String(item.id) === String(employeeId));
  if (!person) fail('Employee not found.', 404);
  const fromSchool = schools.find(s => String(s.id) === String(person.school_id));
  const toSchool = schools.find(s => String(s.id) === String(body.to_school_id));
  if (!toSchool || toSchool.status !== 'Active') fail('Active destination school not found.', 404);
  if (String(toSchool?.id) === String(person.school_id)) fail('Destination must be different from the current school.');
  if (transfers.some(item =>
    item.employee_type === type &&
    String(type === 'staff' ? item.staff_id : item.teacher_id) === String(employeeId) &&
    item.status === 'Pending'
  )) fail('Employee already has a pending transfer request.', 409);
  const rec = {
    id: uid(),
    teacher_id: type === 'teacher' ? +employeeId : null,
    staff_id: type === 'staff' ? +employeeId : null,
    employee_type: type,
    requested_employee_type: null,
    requested_employee_id: null,
    teacher_name: person.name || 'Unknown',
    teacher_tid: person.tid || person.sid || '',
    from_school_id: person.school_id || null,
    from_school_name: fromSchool?.name || null,
    to_school_id: toSchool?.id || null,
    to_school_name: toSchool?.name || null,
    status: 'Pending',
    request_date: new Date().toISOString().split('T')[0],
    reason: body.reason.trim(),
    notes: null,
  };
  transfers.unshift(rec);
  save(KEYS.transfers, transfers);
  return ok({ message: 'Transfer request created.', id: rec.id });
};

export const mockUpdateTransferStatus = async (id, body) => {
  const existing = transfers.find(t => String(t.id) === String(id));
  if (!existing) fail('Transfer not found.', 404);
  if (existing.status !== 'Pending') fail('This transfer request has already been decided.', 409);
  if (!['Approved', 'Rejected'].includes(body.status)) fail('Transfer decision must be Approved or Rejected.');
  if (!body.notes?.trim()) fail('Enter a decision reason for the employee.');
  existing.status = body.status || existing.status;
  existing.notes = body.notes.trim();
  if (existing.status === 'Approved') {
    const type = existing.employee_type || 'teacher';
    const people = type === 'staff' ? staff : teachers;
    const person = people.find(item => String(item.id) === String(type === 'staff' ? existing.staff_id : existing.teacher_id));
    if (!person) fail('Employee not found.', 404);
    const oldSchool = schools.find(item => String(item.id) === String(person.school_id));
    const newSchool = schools.find(item => String(item.id) === String(existing.to_school_id));
    if (!newSchool) fail('Destination school not found.', 404);
    if (oldSchool) oldSchool[type === 'staff' ? 'staff_count' : 'teachers'] = Math.max(0, (oldSchool[type === 'staff' ? 'staff_count' : 'teachers'] || 0) - 1);
    newSchool[type === 'staff' ? 'staff_count' : 'teachers'] = (newSchool[type === 'staff' ? 'staff_count' : 'teachers'] || 0) + 1;
    person.school_id = newSchool.id;
    person.school_name = newSchool.name;
    save(KEYS.schools, schools);
    save(KEYS.teachers, teachers);
    save(KEYS.staff, staff);
  }
  save(KEYS.transfers, transfers);
  return ok({ message: `Transfer ${existing.status.toLowerCase()} successfully.` });
};

export const mockClearTransferHistory = async () => {
  const previousCount = transfers.length;
  transfers = transfers.filter(transfer => transfer.status === 'Pending');
  const deleted = previousCount - transfers.length;
  save(KEYS.transfers, transfers);
  return ok({
    deleted,
    message: `Cleared ${deleted} transfer history records. Pending requests were kept.`,
  });
};

export const mockGetMyTransfers = async (user, params = {}) => {
  const type = user?.employee_type || user?.emp_type;
  const id = user?.employee_id ?? user?.emp_id;
  const person = (type === 'teacher' ? teachers : staff).find(item => String(item.id) === String(id));
  const currentSchool = schools.find(item => String(item.id) === String(person?.school_id));
  const clearedThroughId = Number(transferHistoryClears[`${type}:${id}`] || 0);
  const list = transfers.filter(transfer =>
    transfer.requested_employee_type === type &&
    String(transfer.requested_employee_id) === String(id) &&
    Number(transfer.id) > clearedThroughId
  );
  return ok({
    data: list,
    total: list.length,
    page: Number(params.page) || 1,
    limit: Number(params.limit) || 20,
    currentSchool: currentSchool ? { id: currentSchool.id, name: currentSchool.name } : null,
  });
};

export const mockClearMyTransferHistory = async (user) => {
  const type = user?.employee_type || user?.emp_type;
  const id = user?.employee_id ?? user?.emp_id;
  if (!['teacher', 'staff'].includes(type) || id == null) {
    fail('Employee account details are missing.', 403);
  }
  const ownedTransfers = transfers.filter(transfer =>
    transfer.requested_employee_type === type &&
    String(transfer.requested_employee_id) === String(id)
  );
  const latestId = ownedTransfers.reduce((maxId, transfer) => Math.max(maxId, Number(transfer.id) || 0), 0);
  const key = `${type}:${id}`;
  transferHistoryClears[key] = Math.max(Number(transferHistoryClears[key]) || 0, latestId);
  save(KEYS.transferHistoryClears, transferHistoryClears);
  return ok({ message: 'Your transfer history was cleared. Administrator records were retained.' });
};

export const mockCreateMyTransfer = async (body, user) => {
  const type = user?.employee_type || user?.emp_type;
  const employeeId = user?.employee_id ?? user?.emp_id;
  const isTeacher = type === 'teacher';
  const person = (isTeacher ? teachers : type === 'staff' ? staff : [])
    .find(item => String(item.id) === String(employeeId));
  if (!person) fail('Employee account was not found.', 404);
  if (!body.to_school_id || !body.reason?.trim()) fail('Destination school and transfer reason are required.');
  const destination = schools.find(item => String(item.id) === String(body.to_school_id) && item.status === 'Active');
  if (!destination) fail('Active destination school not found.', 404);
  if (String(destination.id) === String(person.school_id)) fail('Destination must be different from your current school.');
  if (transfers.some(item =>
    item.employee_type === type &&
    String(isTeacher ? item.teacher_id : item.staff_id) === String(employeeId) &&
    item.status === 'Pending'
  )) fail('You already have a pending transfer request.', 409);

  const fromSchool = schools.find(item => String(item.id) === String(person.school_id));
  const record = {
    id: uid(),
    teacher_id: isTeacher ? person.id : null,
    staff_id: isTeacher ? null : person.id,
    employee_type: type,
    requested_employee_type: type,
    requested_employee_id: person.id,
    teacher_name: person.name,
    teacher_tid: person.tid || person.sid || '',
    from_school_id: person.school_id,
    from_school_name: fromSchool?.name || person.school_name || '',
    to_school_id: destination.id,
    to_school_name: destination.name,
    status: 'Pending',
    request_date: new Date().toISOString().split('T')[0],
    reason: body.reason.trim(),
    notes: null,
  };
  transfers.unshift(record);
  save(KEYS.transfers, transfers);
  return ok({ message: 'Transfer request sent to the Administrator for review.', id: record.id });
};

// ═══════════════════════════════════════════════════════════════════════════
// TEACHERS
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetTeachers = async (params = {}) => {
  let list = [...teachers];
  if (params.search)    list = filterSearch(list, params.search, ['name','tid','email']);
  if (params.status)    list = list.filter(t => t.status === params.status);
  if (params.school_id) list = list.filter(t => String(t.school_id) === String(params.school_id));
  if (params._emp_code) list = list.filter(t => t.tid === params._emp_code);
  if (params._emp_id)   list = list.filter(t => t.id === +params._emp_id);
  if (params.sort === 'az') {
    list = list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }
  return ok(paginate(list, +params.page || 1, +params.limit || 10));
};

export const mockCreateTeacher = async (body) => {
  if (!body.name || !body.tid)       fail('Name and Teacher ID required.');
  if (!body.school_id)               fail('School is required.');
  if (teachers.find(t => t.tid === body.tid)) fail('Teacher ID already exists.', 409);

  const dept   = departments.find(d => d.id === +body.department_id);
  const school = schools.find(s => s.id === +body.school_id);
  const rec = {
    ...body, id: uid(),
    department_name: dept?.name   || null,
    school_name:     school?.name || null,
    must_change_password: true,
  };
  teachers.unshift(rec);
  save(KEYS.teachers, teachers);

  // Auto-generate unique username & default password
  const username        = makeUniqueUsername(rec.name);
  const firstName       = rec.name.trim().split(/\s+/)[0];
  const defaultPassword = EMPLOYEE_DEFAULT_PASSWORD_FN(firstName);

  if (!passwords[username]) {
    passwords[username] = defaultPassword;
    save(KEYS.passwords, passwords);
  }

  if (body.school_id) {
    const si = schools.findIndex(s => s.id === +body.school_id);
    if (si !== -1) { schools[si].teachers = (schools[si].teachers || 0) + 1; save(KEYS.schools, schools); }
  }

  return ok({
    message:          'Teacher added.',
    id:               rec.id,
    username,
    default_password: defaultPassword,
  });
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
// STAFF
// ═══════════════════════════════════════════════════════════════════════════
export const mockGetStaff = async (params = {}) => {
  let list = [...staff];
  if (params.search)    list = filterSearch(list, params.search, ['name','sid','email']);
  if (params.status)    list = list.filter(s => s.status === params.status);
  if (params.school_id) list = list.filter(s => String(s.school_id) === String(params.school_id));
  if (params._emp_code) list = list.filter(s => s.sid === params._emp_code);
  if (params._emp_id)   list = list.filter(s => s.id === +params._emp_id);
  return ok(paginate(list, +params.page || 1, +params.limit || 10));
};

export const mockCreateStaff = async (body) => {
  if (!body.name || !body.sid) fail('Name and Staff ID required.');
  if (!body.school_id)         fail('School is required.');
  if (staff.find(s => s.sid === body.sid)) fail('Staff ID already exists.', 409);

  const dept   = departments.find(d => d.id === +body.department_id);
  const school = schools.find(s => s.id === +body.school_id);
  const rec = {
    ...body, id: uid(),
    department_name: dept?.name   || null,
    school_name:     school?.name || null,
    must_change_password: true,
  };
  staff.unshift(rec);
  save(KEYS.staff, staff);

  const username        = makeUniqueUsername(rec.name);
  const firstName       = rec.name.trim().split(/\s+/)[0];
  const defaultPassword = EMPLOYEE_DEFAULT_PASSWORD_FN(firstName);

  if (!passwords[username]) {
    passwords[username] = defaultPassword;
    save(KEYS.passwords, passwords);
  }

  if (body.school_id) {
    const si = schools.findIndex(s => s.id === +body.school_id);
    if (si !== -1) { schools[si].staff_count = (schools[si].staff_count || 0) + 1; save(KEYS.schools, schools); }
  }

  return ok({
    message:          'Staff added.',
    id:               rec.id,
    username,
    default_password: defaultPassword,
  });
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
  if (!ROLE_NAMES[+body.role_id])
    fail('Selected role is not available.', 422);
  if (users.find(u => u.username === body.username)) fail('Username already exists.', 409);
  if (users.find(u => u.email    === body.email))    fail('Email already exists.', 409);
  if (!body.password || body.password.length < 6)    fail('Password must be at least 6 characters.');

  const school = schools.find(s => s.id === +body.school_id);
  const rec = {
    ...body,
    id:                   uid(),
    role_name:            ROLE_NAMES[+body.role_id]  || '',
    role_label:           ROLE_LABELS[+body.role_id] || '',
    school_name:          school?.name || null,
    last_login:           null,
    must_change_password: body.must_change_password || false,
  };

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
  if (!u) fail('User not found.', 404);

  // If no explicit password supplied, generate firstname@123
  let pw = newPassword;
  if (!pw) {
    const firstName = (u.full_name || '').trim().split(/\s+/)[0].toLowerCase();
    pw = `${firstName}@123`;
  }
  passwords[u.username] = pw;
  save(KEYS.passwords, passwords);

  // Force change on next login
  const i = users.findIndex(x => x.id === +id);
  if (i !== -1) { users[i].must_change_password = true; save(KEYS.users, users); }

  return ok({ message: 'Password reset. User must change it on next login.', generated_password: pw });
};

// ─── Permissions ─────────────────────────────────────────────────────────────

// API STUB: GET /api/permissions/:userId
export const mockGetUserPermissions = async (userId) => {
  const userRec = users.find(u => String(u.id) === String(userId));
  const roleName = userRec?.role_name || '';
  const stored   = permissions[String(userId)];
  const matrix   = stored || getDefaultMatrix(roleName);
  return ok({ data: matrix, role_name: roleName });
};

// API STUB: PUT /api/permissions/:userId
export const mockSaveUserPermissions = async (userId, matrix) => {
  permissions[String(userId)] = matrix;
  save(KEYS.permissions, permissions);
  return ok({ message: 'Permissions saved.' });
};

// ─── Profile helpers ──────────────────────────────────────────────────────────
const buildProfilePatch = (body) => {
  const allowed = ['full_name', 'phone', 'email', 'gender', 'dob', 'address', 'bio'];
  const patch = {};
  allowed.forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });
  return patch;
};

const buildEmployeeUser = (emp, empType, usernameOverride) => {
  const username = usernameOverride || makeUsername(emp.name);
  const roleName = empType === 'teacher' ? 'Teacher' : 'Staff';
  return {
    id:                   `emp_${empType}_${emp.id}`,
    full_name:            emp.name,
    username,
    email:                emp.email || '',
    phone:                emp.phone || '',
    gender:               emp.gender || '',
    dob:                  emp.dob || '',
    address:              emp.address || '',
    bio:                  emp.bio || '',
    role_id:              null,
    role_name:            roleName,
    role_label:           roleName,
    school_name:          emp.school_name || '',
    school_id:            emp.school_id || null,
    status:               emp.status,
    permissions:          EMPLOYEE_ROLE_PERMS,
    permission_matrix:    getDefaultMatrix(roleName),
    must_change_password: emp.must_change_password || false,
    emp_type:             empType,
    emp_id:               emp.id,
    emp_code:             emp.tid || emp.sid,
    last_login:           new Date().toISOString(),
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
  const i = users.findIndex(u => String(u.id) === String(id));
  if (i === -1) fail('User not found.', 404);
  users[i] = { ...users[i], ...patch };
  save(KEYS.users, users);
  return ok({ message: 'Profile updated successfully.', user: { ...users[i], permissions: ROLE_PERMS[users[i].role_name] || [] } });
};

// ─── Employee password change ─────────────────────────────────────────────────
export const mockChangeEmployeePassword = async (username, currentPassword, newPassword) => {
  if (!passwords[username]) fail('User not found.', 404);
  if (passwords[username] !== currentPassword) fail('Current password is incorrect.', 401);
  if (!newPassword || newPassword.length < 8) fail('New password must be at least 8 characters.', 400);
  passwords[username] = newPassword;
  save(KEYS.passwords, passwords);

  // Clear must_change_password for system users
  const ui = users.findIndex(u => u.username === username);
  if (ui !== -1) { users[ui].must_change_password = false; save(KEYS.users, users); }

  // Clear for employees
  [...teachers, ...staff].forEach(emp => {
    if (makeUsername(emp.name) === username || emp.username === username) {
      emp.must_change_password = false;
    }
  });
  save(KEYS.teachers, teachers);
  save(KEYS.staff, staff);

  return ok({ message: 'Password changed successfully.' });
};

// ─── Username change ──────────────────────────────────────────────────────────
export const mockChangeUsername = async (currentUser, newUsername) => {
  const trimmed = newUsername.trim().toLowerCase();
  if (!trimmed || trimmed.length < 3) fail('Username must be at least 3 characters.', 400);

  if (users.find(u => u.username.toLowerCase() === trimmed && String(u.id) !== String(currentUser?.id))) {
    fail('Username already taken.', 409);
  }
  const allEmps = [
    ...teachers.map(e => ({ ...e, emp_type: 'teacher' })),
    ...staff.map(e => ({ ...e, emp_type: 'staff' })),
  ];
  for (const e of allEmps) {
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
    const profileKey = `tsms_emp_profile_${currentUser.emp_type}_${currentUser.emp_id}`;
    let override = {};
    try { override = JSON.parse(localStorage.getItem(profileKey) || '{}'); } catch { /* ignore */ }
    override.username = trimmed;
    localStorage.setItem(profileKey, JSON.stringify(override));

    const oldUsername = currentUser.username;
    if (oldUsername && passwords[oldUsername] !== undefined) {
      passwords[trimmed] = passwords[oldUsername];
      save(KEYS.passwords, passwords);
    }

    return ok({ message: 'Username changed successfully.', user: { ...currentUser, username: trimmed } });
  }

  const i = users.findIndex(u => String(u.id) === String(currentUser?.id));
  if (i === -1) fail('User not found.', 404);

  const oldUsername = users[i].username;
  users[i] = { ...users[i], username: trimmed };
  save(KEYS.users, users);

  if (passwords[oldUsername] !== undefined) {
    passwords[trimmed] = passwords[oldUsername];
    delete passwords[oldUsername];
    save(KEYS.passwords, passwords);
  }

  return ok({ message: 'Username changed successfully.', user: { ...users[i], permissions: ROLE_PERMS[users[i].role_name] || [] } });
};

// ═══════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════════════════════

// API STUB: POST /api/auth/forgot-password
export const mockRequestPasswordReset = async (usernameOrEmail) => {
  const val = (usernameOrEmail || '').trim().toLowerCase();
  if (!val) fail('Username or email is required.');

  // Find in system users
  let found = users.find(u =>
    u.username.toLowerCase() === val || u.email.toLowerCase() === val
  );

  // Find in employees
  if (!found) {
    const allEmps = [
      ...teachers.map(e => ({ ...e, emp_type: 'teacher' })),
      ...staff.map(e => ({ ...e, emp_type: 'staff' })),
    ];
    const emp = allEmps.find(e =>
      makeUsername(e.name) === val || (e.email || '').toLowerCase() === val
    );
    if (emp) found = { username: makeUsername(emp.name), email: emp.email };
  }

  if (!found) fail('No account found with that username or email.', 404);

  // Generate 6-digit code (in production this is emailed; in mock we return it)
  const code = String(Math.floor(100000 + Math.random() * 900000));
  resetCodes[code] = {
    username: found.username,
    expires:  Date.now() + 15 * 60 * 1000, // 15 minutes
  };
  save(KEYS.resetCodes, resetCodes);

  return ok({
    message:  'Reset code generated.',
    // Returned in mock so the dev can test; production would email it
    mock_code: code,
  });
};

// API STUB: POST /api/auth/confirm-reset
export const mockConfirmPasswordReset = async (code, newPassword) => {
  const entry = resetCodes[code];
  if (!entry)               fail('Invalid or expired reset code.', 400);
  if (Date.now() > entry.expires) fail('Reset code has expired. Please request a new one.', 400);
  if (!newPassword || newPassword.length < 8) fail('Password must be at least 8 characters.', 400);

  passwords[entry.username] = newPassword;
  save(KEYS.passwords, passwords);
  delete resetCodes[code];
  save(KEYS.resetCodes, resetCodes);

  // Clear must_change_password flag
  const ui = users.findIndex(u => u.username === entry.username);
  if (ui !== -1) { users[ui].must_change_password = false; save(KEYS.users, users); }

  return ok({ message: 'Password reset successfully. You can now log in.' });
};

// ═══════════════════════════════════════════════════════════════════════════
// MY ATTENDANCE (employee self-service)
// ═══════════════════════════════════════════════════════════════════════════

// API STUB: GET /api/me/attendance
export const mockGetMyAttendance = async (user, params = {}) => {
  const empType = user?.emp_type;
  const empId   = user?.emp_id;
  if (!empType || empId == null) fail('Not an employee account.', 403);

  const source = empType === 'teacher' ? teachers : staff;
  const emp = source.find(e => e.id === +empId);
  if (!emp) fail('Employee record not found.', 404);

  const month = params.month || new Date().toISOString().slice(0, 7); // YYYY-MM
  const [yr, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();

  const records = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const key     = `${empType}-${empId}-${dateStr}`;
    const rec     = attendance[key];
    const status  = typeof rec === 'string' ? rec : (rec?.status || null);
    records.push({
      date:      dateStr,
      status:    status,
      check_in:  rec?.check_in  || null,
      check_out: rec?.check_out || null,
      note:      rec?.note      || null,
    });
  }

  // Only past days + today
  const today = new Date().toISOString().split('T')[0];
  const past  = records.filter(r => r.date <= today);

  const counts = { Present: 0, Absent: 0, Late: 0, 'On Leave': 0 };
  past.forEach(r => { if (r.status && counts[r.status] !== undefined) counts[r.status]++; });
  const markedDays = past.filter(r => r.status).length;
  const rate = markedDays ? Math.round((counts.Present / markedDays) * 100) : 0;

  return ok({
    data:      past,
    month,
    employee:  { name: emp.name, emp_code: emp.tid || emp.sid, school: emp.school_name },
    summary:   counts,
    rate,
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
  if (params._emp_id) {
    filtered = filtered.filter(e => e.id === +params._emp_id);
  }

  const data = filtered.map(e => {
    const attKey    = `${type}-${e.id}-${params.date}`;
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
      check_in:    attRecord?.check_in  || null,
      check_out:   attRecord?.check_out || null,
      note:        attRecord?.note      || null,
    };

  });

  return ok({ data, date: params.date, total: data.length, page: 1, limit: 100 });
};

export const mockGetAllSchoolsAttendance = async (params = {}) => {
  const startDate = params.start_date || params.date || new Date().toISOString().slice(0, 10);
  const endDate = params.end_date || params.date || startDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    fail('Choose a valid attendance date range.');
  }

  const schoolId = params.school_id ? String(params.school_id) : '';
  const statusFilter = params.status || '';
  const teacherCode = String(params.teacher_code || '').trim().toLowerCase();
  const search = String(params.search || '').trim().toLowerCase();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(5000, Math.max(1, Number(params.limit) || 200));
  const activeTeachers = teachers.filter(teacher => teacher.status === 'Active' && teacher.school_id != null);
  const schoolsInScope = schools.filter(school => !schoolId || String(school.id) === schoolId);
  const details = [];
  const bySchool = new Map(schools.map(school => [String(school.id), {
    id: Number(school.id),
    school_name: school.name,
    total_teachers: activeTeachers.filter(teacher => String(teacher.school_id) === String(school.id)).length,
    present: 0,
    absent: 0,
    late: 0,
    on_leave: 0,
    holidays: 0,
    end_date_recorded_teachers: 0,
    last_attendance_date: null,
    manager_name: users.find(user =>
      user.role_name === 'SchoolManager' && user.status === 'Active' &&
      String(user.school_id) === String(school.id)
    )?.full_name || null,
  }]));
  const recordedAtEndDate = new Set();

  Object.entries(attendance).forEach(([key, rawRecord]) => {
    const match = /^(teacher|staff)-(\d+)-(\d{4}-\d{2}-\d{2})$/.exec(key);
    if (!match || match[1] !== 'teacher') return;
    const [, , rawTeacherId, date] = match;
    if (date < startDate || date > endDate) return;
    const teacher = activeTeachers.find(item => String(item.id) === rawTeacherId);
    if (!teacher || (schoolId && String(teacher.school_id) !== schoolId)) return;
    if (teacherCode && String(teacher.tid || '').toLowerCase() !== teacherCode) return;
    if (search && !`${teacher.name || ''} ${teacher.tid || ''}`.toLowerCase().includes(search)) return;

    const record = typeof rawRecord === 'string' ? { status: rawRecord } : rawRecord || {};
    const status = record.status || 'Present';
    if (!['Present', 'Absent', 'Late', 'On Leave', 'Holiday'].includes(status)) return;
    if (statusFilter && status !== statusFilter) return;

    const school = bySchool.get(String(teacher.school_id));
    if (!school) return;
    if (status === 'On Leave') school.on_leave += 1;
    else if (status === 'Holiday') school.holidays += 1;
    else school[status.toLowerCase()] += 1;
    if (!school.last_attendance_date || date > school.last_attendance_date) school.last_attendance_date = date;
    if (date === endDate) recordedAtEndDate.add(`${school.id}:${teacher.id}`);
    details.push({
      id: key,
      teacher_id: Number(teacher.id),
      teacher_code: teacher.tid || null,
      teacher_name: teacher.name,
      school_id: Number(teacher.school_id),
      school_name: schools.find(item => String(item.id) === String(teacher.school_id))?.name || null,
      attendance_date: date,
      status,
      check_in: record.check_in || null,
      check_out: record.check_out || null,
      remarks: record.note || null,
      recorded_by: null,
    });
  });

  const schoolRows = schoolsInScope.map(school => {
    const row = bySchool.get(String(school.id));
    const denominator = row.present + row.absent + row.late;
    row.end_date_recorded_teachers = [...recordedAtEndDate].filter(key => key.startsWith(`${row.id}:`)).length;
    row.attendance_percentage = denominator ? Number((((row.present + row.late) / denominator) * 100).toFixed(1)) : null;
    row.submission_status = row.total_teachers === 0 ? 'No teachers'
      : row.end_date_recorded_teachers === 0 ? 'Missing'
        : row.end_date_recorded_teachers >= row.total_teachers ? 'Complete' : 'Partial';
    return row;
  });
  details.sort((a, b) => b.attendance_date.localeCompare(a.attendance_date) || a.teacher_name.localeCompare(b.teacher_name));
  const totals = schoolRows.reduce((result, row) => {
    result.present += row.present;
    result.absent += row.absent;
    result.late += row.late;
    result.on_leave += row.on_leave;
    return result;
  }, {
    schools: schools.length,
    teachers: activeTeachers.filter(teacher => !schoolId || String(teacher.school_id) === schoolId).length,
    present: 0, absent: 0, late: 0, on_leave: 0, attendance_percentage: null,
  });
  const denominator = totals.present + totals.absent + totals.late;
  totals.attendance_percentage = denominator ? Number((((totals.present + totals.late) / denominator) * 100).toFixed(1)) : null;

  const trendMap = new Map();
  details.forEach(row => {
    if (!trendMap.has(row.attendance_date)) trendMap.set(row.attendance_date, { date: row.attendance_date, present: 0, absent: 0, late: 0, on_leave: 0 });
    const entry = trendMap.get(row.attendance_date);
    if (row.status === 'On Leave') entry.on_leave += 1;
    else if (row.status === 'Present' || row.status === 'Absent' || row.status === 'Late') entry[row.status.toLowerCase()] += 1;
  });

  return ok({
    isMock: true,
    range: { start_date: startDate, end_date: endDate },
    totals,
    schools: schoolRows,
    trend: [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    details: {
      data: details.slice((page - 1) * limit, page * limit),
      total: details.length,
      page,
      limit,
    },
    definitions: {
      percentage: '(Present + Late) / (Present + Late + Absent); recorded On Leave and unrecorded teachers are excluded.',
      submission: `Record coverage on ${endDate} is based on locally stored attendance rows. Missing records are not counted as absences.`,
      leave_status: 'The existing attendance schema uses On Leave; it does not store leave approval separately.',
    },
  });
};

export const mockMarkAttendance = async (body) => {
  const { date, employee_type, records } = body;
  records.forEach(r => {
    const key = `${employee_type}-${r.employee_id}-${date}`;
    attendance[key] = {
      status:    r.status    || 'Present',
      check_in:  r.check_in  || new Date().toISOString(),
      check_out: r.check_out || null,
      note:      r.note      || null,
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
// UTILITY — reset all data back to seed
// ═══════════════════════════════════════════════════════════════════════════
export const resetAllMockData = () => {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  window.location.reload();
};

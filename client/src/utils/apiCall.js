/**
 * apiCall.js — Dual-mode API layer.
 *
 * Mode 1 — Real MySQL (server is running):
 *   All calls go to Express/MySQL backend via VITE_API_URL.
 *
 * Mode 2 — Mock localStorage (server is down / offline):
 *   All calls use in-memory mock store persisted to localStorage.
 *   Full CRUD works. Data survives page refresh.
 *
 * Detection: first API call attempts the real backend.
 *   - Success → stay on real backend for the whole session.
 *   - Network/5xx failure → switch to mock for the whole session.
 *   - When real backend comes up and succeeds, stale mock cache is wiped.
 */
import api from './api';
import * as mock from './mockApi';

// null = not yet known | true = real backend | false = mock
let _backendUp = null;

// Mock localStorage keys — cleared when real backend is detected
const MOCK_KEYS = [
  'tsms_schools','tsms_teachers','tsms_staff','tsms_departments',
  'tsms_positions','tsms_transfers','tsms_users','tsms_attendance',
  'tsms_passwords','tsms_nextId',
];

export const getIsMock = () => _backendUp === false;

const call = async (realFn, mockFn) => {
  try {
    const result = await realFn();
    // First successful real call — wipe stale mock cache
    if (_backendUp !== true) {
      _backendUp = true;
      MOCK_KEYS.forEach(k => localStorage.removeItem(k));
    }
    return result;
  } catch (err) {
    const status = err.response?.status;
    const isNetworkFailure = !status &&
      ['ERR_NETWORK', 'ECONNABORTED', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(err.code);

    // Only use local mock data when no HTTP response was received.
    // A server error must not make a failed write look successful.
    if (isNetworkFailure) {
      if (_backendUp !== false) {
        _backendUp = false;
        console.warn('⚠️  Backend unreachable — switching to offline mock mode.');
      }
      return mockFn();
    }
    // Any HTTP response, including 5xx, confirms that the backend is reachable.
    _backendUp = true;
    throw err;
  }
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authLogin = (username, password) =>
  call(
    () => api.post('/auth/login', { username, password }),
    () => mock.mockAuthLogin(username, password)
  );

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export const getDashboard        = ()       => call(() => api.get('/reports/dashboard'),          () => mock.mockGetDashboard());
export const getReportsDashboard = ()       => call(() => api.get('/reports/dashboard'),          () => mock.mockGetDashboard());
export const getLogs             = (p = {}) => call(() => api.get(`/reports/logs?${qs(p)}`),      () => mock.mockGetLogs());

// ─── SCHOOLS ──────────────────────────────────────────────────────────────────
export const getSchools   = (p = {}) => call(() => api.get(`/schools?${qs(p)}`),   () => mock.mockGetSchools(p));
export const createSchool = (body)   => call(() => api.post('/schools', body),      () => mock.mockCreateSchool(body));
export const updateSchool = (id, b)  => call(() => api.put(`/schools/${id}`, b),    () => mock.mockUpdateSchool(id, b));
export const deleteSchool = (id)     => call(() => api.delete(`/schools/${id}`),    () => mock.mockDeleteSchool(id));

// ─── DEPARTMENTS ──────────────────────────────────────────────────────────────
export const getDepartments = ()      => call(() => api.get('/departments'),          () => mock.mockGetDepartments());
export const createDept     = (body)  => call(() => api.post('/departments', body),   () => mock.mockCreateDept(body));
export const updateDept     = (id, b) => call(() => api.put(`/departments/${id}`, b), () => mock.mockUpdateDept(id, b));
export const deleteDept     = (id)    => call(() => api.delete(`/departments/${id}`), () => mock.mockDeleteDept(id));

// ─── POSITIONS ────────────────────────────────────────────────────────────────
export const getPositions   = ()      => call(() => api.get('/positions'),            () => mock.mockGetPositions());
export const createPosition = (body)  => call(() => api.post('/positions', body),     () => mock.mockCreatePosition(body));
export const updatePosition = (id, b) => call(() => api.put(`/positions/${id}`, b),   () => mock.mockUpdatePosition(id, b));
export const deletePosition = (id)    => call(() => api.delete(`/positions/${id}`),   () => mock.mockDeletePosition(id));

// ─── TRANSFERS ────────────────────────────────────────────────────────────────
export const getTransfers         = (p = {}) => call(() => api.get(`/transfers?${qs(p)}`),         () => mock.mockGetTransfers(p));
export const createTransfer       = (body)   => call(() => api.post('/transfers', body),            () => mock.mockCreateTransfer(body));
export const updateTransferStatus = (id, b)  => call(() => api.patch(`/transfers/${id}/status`, b), () => mock.mockUpdateTransferStatus(id, b));

// ─── TEACHERS ─────────────────────────────────────────────────────────────────
export const getTeachers = (p = {}) => {
  const { _emp_code, ...rest } = p;
  return call(() => api.get(`/teachers?${qs(rest)}`), () => mock.mockGetTeachers(p));
};
export const createTeacher = (body)  => call(() => api.post('/teachers', body),      () => mock.mockCreateTeacher(body));
export const updateTeacher = (id, b) => call(() => api.put(`/teachers/${id}`, b),    () => mock.mockUpdateTeacher(id, b));
export const deleteTeacher = (id)    => call(() => api.delete(`/teachers/${id}`),    () => mock.mockDeleteTeacher(id));

// ─── STAFF ────────────────────────────────────────────────────────────────────
export const getStaff = (p = {}) => {
  const { _emp_code, ...rest } = p;
  return call(() => api.get(`/staff?${qs(rest)}`), () => mock.mockGetStaff(p));
};
export const createStaff = (body)  => call(() => api.post('/staff', body),           () => mock.mockCreateStaff(body));
export const updateStaff = (id, b) => call(() => api.put(`/staff/${id}`, b),         () => mock.mockUpdateStaff(id, b));
export const deleteStaff = (id)    => call(() => api.delete(`/staff/${id}`),         () => mock.mockDeleteStaff(id));

// ─── USERS ────────────────────────────────────────────────────────────────────
export const getUsers          = (p = {}) => call(() => api.get(`/users?${qs(p)}`),               () => mock.mockGetUsers(p));
export const createUser        = (body)   => call(() => api.post('/users', body),                  () => mock.mockCreateUser(body));
export const updateUser        = (id, b)  => call(() => api.put(`/users/${id}`, b),                () => mock.mockUpdateUser(id, b));
export const deleteUser        = (id)     => call(() => api.delete(`/users/${id}`),                () => mock.mockDeleteUser(id));
export const setUserStatus     = (id, s)  => call(() => api.patch(`/users/${id}/status`, { status: s }), () => mock.mockSetUserStatus(id, s));
export const resetUserPassword = (id, pw) => call(() => api.post(`/users/${id}/reset-password`, { new_password: pw }), () => mock.mockResetPassword(id, pw));
export const updateProfile     = (id, b)  => call(() => api.put(`/users/${id}/profile`, b),        () => mock.mockUpdateProfile(id, b));

export const saveMyProfile = (user, body) => {
  const token = localStorage.getItem('tsms_token') || sessionStorage.getItem('tsms_token');
  const isEmp     = !!(user?.emp_type && user?.emp_id != null);
  const isMockSes = !token || token.startsWith('mock-token-');
  if (isEmp || isMockSes) return mock.mockSaveMyProfile(user, body);
  return call(() => api.put('/auth/profile', body), () => mock.mockSaveMyProfile(user, body));
};

export const changeEmployeePw = (username, cur, nw) =>
  call(
    () => api.post('/auth/change-password', { current_password: cur, new_password: nw }),
    () => mock.mockChangeEmployeePassword(username, cur, nw)
  );

export const changeUsernameApi = (currentUser, newUsername) =>
  call(
    () => api.put('/auth/username', { new_username: newUsername }),
    () => mock.mockChangeUsername(currentUser, newUsername)
  );

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────
export const getAttendance  = (p = {}) => call(() => api.get(`/attendance?${qs(p)}`),    () => mock.mockGetAttendance(p));
export const markAttendance = (body)   => call(() => api.post('/attendance/mark', body),  () => mock.mockMarkAttendance(body));

// ─── UTIL ─────────────────────────────────────────────────────────────────────
const clean = (o = {}) => {
  const out = {};
  Object.entries(o).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') out[k] = v;
  });
  return out;
};
const qs = (params) => new URLSearchParams(clean(params)).toString();

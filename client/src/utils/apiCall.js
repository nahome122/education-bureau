/**
 * apiCall.js — Unified API layer with instant mock fallback.
 *
 * Strategy:
 * - On first call, do a quick health-check (1.5s timeout).
 * - If backend is up → use real API.
 * - If backend is down → use in-memory mock for EVERYTHING (get, add, edit, delete).
 * - Once determined, the result is cached for the entire session.
 * - Mock data fully supports CRUD — changes are visible immediately in the UI.
 */
import api from './api';
import * as mock from './mockApi';

// null  = not yet checked (health-check will run on first call)
// true  = backend confirmed up
// false = backend confirmed down → use mock
let _backendUp = null;

// Single in-flight promise so parallel first calls don't each fire a health-check
let _healthCheckPromise = null;

const isBackendUp = async () => {
  if (_backendUp === true)  return true;
  if (_backendUp === false) return false;

  // Only one health-check at a time
  if (!_healthCheckPromise) {
    _healthCheckPromise = api.get('/health', { timeout: 1500 })
      .then(() => { _backendUp = true;  })
      .catch(() => { _backendUp = false; })
      .finally(() => { _healthCheckPromise = null; });
  }

  await _healthCheckPromise;
  return _backendUp === true;
};

/**
 * call(realFn, mockFn)
 * - If backend available: run realFn, on network/5xx error fall to mockFn.
 * - If backend unavailable: run mockFn directly (no waiting).
 */
const call = async (realFn, mockFn) => {
  const up = await isBackendUp();
  if (!up) return mockFn();
  try {
    return await realFn();
  } catch (err) {
    const status = err.response?.status;
    if (!status || status >= 500 || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
      _backendUp = false;
      return mockFn();
    }
    throw err; // real 4xx error — surface to the page
  }
};

export const getIsMock = () => _backendUp === false;

// ─── AUTH ────────────────────────────────────────────────────────────────────
export const authLogin = (username, password) =>
  call(
    () => api.post('/auth/login', { username, password }),
    () => mock.mockAuthLogin(username, password)
  );

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
export const getDashboard       = ()       => call(() => api.get('/reports/dashboard'),            () => mock.mockGetDashboard());
export const getReportsDashboard= ()       => call(() => api.get('/reports/dashboard'),            () => mock.mockGetDashboard());
export const getLogs            = (params) => call(() => api.get(`/reports/logs?${qs(params)}`),   () => mock.mockGetLogs());

// ─── SCHOOLS ─────────────────────────────────────────────────────────────────
export const getSchools    = (p)     => call(() => api.get(`/schools?${qs(p)}`),    () => mock.mockGetSchools(p));
export const createSchool  = (body)  => call(() => api.post('/schools', body),       () => mock.mockCreateSchool(body));
export const updateSchool  = (id, b) => call(() => api.put(`/schools/${id}`, b),     () => mock.mockUpdateSchool(id, b));
export const deleteSchool  = (id)    => call(() => api.delete(`/schools/${id}`),     () => mock.mockDeleteSchool(id));

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────
export const getDepartments = ()      => call(() => api.get('/departments'),           () => mock.mockGetDepartments());
export const createDept     = (body)  => call(() => api.post('/departments', body),    () => mock.mockCreateDept(body));
export const updateDept     = (id, b) => call(() => api.put(`/departments/${id}`, b),  () => mock.mockUpdateDept(id, b));
export const deleteDept     = (id)    => call(() => api.delete(`/departments/${id}`),  () => mock.mockDeleteDept(id));

// ─── POSITIONS ───────────────────────────────────────────────────────────────
export const getPositions    = ()      => call(() => api.get('/positions'),             () => mock.mockGetPositions());
export const createPosition  = (body)  => call(() => api.post('/positions', body),      () => mock.mockCreatePosition(body));
export const updatePosition  = (id, b) => call(() => api.put(`/positions/${id}`, b),    () => mock.mockUpdatePosition(id, b));
export const deletePosition  = (id)    => call(() => api.delete(`/positions/${id}`),    () => mock.mockDeletePosition(id));

// ─── TRANSFERS ───────────────────────────────────────────────────────────────
export const getTransfers   = (p = {}) => call(() => api.get(`/transfers?${qs(p)}`),  () => mock.mockGetTransfers(p));
export const createTransfer = (body)  => call(() => api.post('/transfers', body),      () => mock.mockCreateTransfer(body));
export const updateTransferStatus = (id, body) => call(() => api.patch(`/transfers/${id}/status`, body), () => mock.mockUpdateTransferStatus(id, body));

// ─── TEACHERS ────────────────────────────────────────────────────────────────
// _emp_code is a mock-only param — strip it before sending to real backend
export const getTeachers    = (p = {}) => {
  const { _emp_code, ...rest } = p;
  return call(() => api.get(`/teachers?${qs(rest)}`), () => mock.mockGetTeachers(p));
};
export const createTeacher  = (body)  => call(() => api.post('/teachers', body),        () => mock.mockCreateTeacher(body));
export const updateTeacher  = (id, b) => call(() => api.put(`/teachers/${id}`, b),      () => mock.mockUpdateTeacher(id, b));
export const deleteTeacher  = (id)    => call(() => api.delete(`/teachers/${id}`),      () => mock.mockDeleteTeacher(id));

// ─── STAFF ───────────────────────────────────────────────────────────────────
// _emp_code is a mock-only param — strip it before sending to real backend
export const getStaff = (p = {}) => {
  const { _emp_code, ...rest } = p;
  return call(() => api.get(`/staff?${qs(rest)}`), () => mock.mockGetStaff(p));
};
export const createStaff = (body)  => call(() => api.post('/staff', body),           () => mock.mockCreateStaff(body));
export const updateStaff = (id, b) => call(() => api.put(`/staff/${id}`, b),         () => mock.mockUpdateStaff(id, b));
export const deleteStaff = (id)    => call(() => api.delete(`/staff/${id}`),         () => mock.mockDeleteStaff(id));

// ─── USERS ───────────────────────────────────────────────────────────────────
export const getUsers           = (p)          => call(() => api.get(`/users?${qs(p)}`),               () => mock.mockGetUsers(p));
export const createUser         = (body)        => call(() => api.post('/users', body),                 () => mock.mockCreateUser(body));
export const updateUser         = (id, b)       => call(() => api.put(`/users/${id}`, b),               () => mock.mockUpdateUser(id, b));
export const deleteUser         = (id)          => call(() => api.delete(`/users/${id}`),               () => mock.mockDeleteUser(id));
export const setUserStatus      = (id, status)  => call(() => api.patch(`/users/${id}/status`,{status}),() => mock.mockSetUserStatus(id, status));
export const resetUserPassword  = (id, newPw)   => call(() => api.post(`/users/${id}/reset-password`,{new_password:newPw}), () => mock.mockResetPassword(id, newPw));
export const updateProfile      = (id, b)       => call(() => api.put(`/users/${id}/profile`, b),       () => mock.mockUpdateProfile(id, b));
export const saveMyProfile = (user, body) => {
  const saveWithMock = () => mock.mockSaveMyProfile(user, body);
  const token = localStorage.getItem('tsms_token') || sessionStorage.getItem('tsms_token');
  const isEmployeeAccount = !!(user?.emp_type && user?.emp_id != null);
  const isMockSession = !token || token.startsWith('mock-token-');

  if (isEmployeeAccount || isMockSession) {
    return saveWithMock();
  }

  return call(
    () => api.put('/auth/profile', body),
    saveWithMock
  );
};
export const changeEmployeePw   = (username, cur, nw) => call(
  () => api.post('/auth/change-password', { current_password: cur, new_password: nw }),
  () => mock.mockChangeEmployeePassword(username, cur, nw)
);

export const changeUsernameApi  = (currentUser, newUsername) => call(
  () => api.put('/auth/username', { new_username: newUsername }),
  () => mock.mockChangeUsername(currentUser, newUsername)
);

// ─── ATTENDANCE ──────────────────────────────────────────────────────────────
export const getAttendance  = (p)    => call(() => api.get(`/attendance?${qs(p)}`),   () => mock.mockGetAttendance(p));
export const markAttendance = (body) => call(() => api.post('/attendance/mark', body), () => mock.mockMarkAttendance(body));

// ─── UTIL ────────────────────────────────────────────────────────────────────
const clean = (o = {}) => {
  const out = {};
  Object.entries(o).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') out[k] = v;
  });
  return out;
};
const qs = (params) => new URLSearchParams(clean(params)).toString();

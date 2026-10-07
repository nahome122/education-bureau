import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authLogin as callLogin, changeEmployeePw, changeUsernameApi } from '../utils/apiCall';
import api from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMock,  setIsMock]  = useState(false);

  const applyEmpProfileOverride = useCallback((u) => {
    const empType = u?.employee_type || u?.emp_type;
    const empId   = u?.employee_id   || u?.emp_id;
    if (!empType || empId == null) return u;
    try {
      const saved = localStorage.getItem(`tsms_emp_profile_${empType}_${empId}`);
      if (!saved) return u;
      const override = JSON.parse(saved);
      const { full_name, phone, email, gender, dob, address, bio, username } = override;
      return { ...u, full_name, phone, email, gender, dob, address, bio, ...(username ? { username } : {}) };
    } catch { return u; }
  }, []);

  // Re-hydrate session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('tsms_token') || sessionStorage.getItem('tsms_token');
    const storedUser  = localStorage.getItem('tsms_user')  || sessionStorage.getItem('tsms_user');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        const parsed = applyEmpProfileOverride(JSON.parse(storedUser));
        setUser(parsed);
        if (storedToken.startsWith('mock-token-')) setIsMock(true);
      } catch { /* ignore corrupt data */ }
    }
    setLoading(false);
  }, [applyEmpProfileOverride]);

  const login = useCallback(async (username, password, remember = false) => {
    try {
      const response = await callLogin(username, password);
      const data = response.data;
      if (!data.success) return { success: false, message: data.message || 'Login failed.' };

      const storage = remember ? localStorage : sessionStorage;
      const hydratedUser = applyEmpProfileOverride(data.user);
      storage.setItem('tsms_token', data.token);
      storage.setItem('tsms_user',  JSON.stringify(hydratedUser));
      setToken(data.token);
      setUser(hydratedUser);
      setIsMock(data.token.startsWith('mock-token-'));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Login failed. Please check your credentials.' };
    }
  }, [applyEmpProfileOverride]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setIsMock(false);
    localStorage.removeItem('tsms_token');
    localStorage.removeItem('tsms_user');
    sessionStorage.removeItem('tsms_token');
    sessionStorage.removeItem('tsms_user');
  }, []);

  const changePassword = useCallback(async (current_password, new_password) => {
    if (isMock) {
      try {
        const { data } = await changeEmployeePw(user?.username, current_password, new_password);
        return data;
      } catch (err) {
        return { success: false, message: err.response?.data?.message || 'Failed to change password.' };
      }
    }
    try {
      const { data } = await api.post('/auth/change-password', { current_password, new_password });
      return data;
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Server error.' };
    }
  }, [isMock, user]);

  const refreshUser = useCallback((updatedUser) => {
    const inLocal   = !!localStorage.getItem('tsms_token');
    const inSession = !!sessionStorage.getItem('tsms_token');
    const json = JSON.stringify(updatedUser);
    if (inLocal)   localStorage.setItem('tsms_user',   json);
    if (inSession) sessionStorage.setItem('tsms_user', json);
    const empType = updatedUser?.employee_type || updatedUser?.emp_type;
    const empId   = updatedUser?.employee_id   || updatedUser?.emp_id;
    if (empType && empId != null) {
      localStorage.setItem(`tsms_emp_profile_${empType}_${empId}`, json);
    }
    setUser(updatedUser);
  }, []);

  const changeUsername = useCallback(async (new_username) => {
    if (!new_username || new_username.length < 3) {
      return { success: false, message: 'Username must be at least 3 characters.' };
    }
    const trimmed = new_username.trim().toLowerCase();
    if (trimmed === user?.username?.toLowerCase()) {
      return { success: false, message: 'New username must be different from current.' };
    }
    try {
      const { data } = await changeUsernameApi(user, trimmed);
      if (data.success) {
        const updatedUser = data.user ? { ...user, ...data.user } : { ...user, username: trimmed };
        refreshUser(updatedUser);
      }
      return data;
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to change username.' };
    }
  }, [user, refreshUser]);

  const hasPermission = useCallback((perm) => {
    if (!user) return false;
    const perms = user.permissions || [];
    return perms.includes('*') || perms.includes(perm);
  }, [user]);

  const canAccess = useCallback((page) => {
    if (!user) return false;
    const perms = user.permissions || [];
    if (perms.includes('*')) return true;
    return perms.includes(page);
  }, [user]);

  const isAdmin         = user?.role_name === 'Administrator';
  const isSchoolManager = user?.role_name === 'SchoolManager';
  const isOfficer       = user?.role_name === 'AttendanceOfficer';
  const isViewer        = user?.role_name === 'Viewer';
  const isEmployee      = user?.role_name === 'Teacher' || user?.role_name === 'Staff';
  const isOwnRecord     = (empType, empCode) =>
    isEmployee && user?.emp_type === empType && user?.emp_code === empCode;

  return (
    <AuthContext.Provider value={{
      user, token, loading, isMock,
      login, logout, changePassword, changeUsername, refreshUser,
      hasPermission, canAccess,
      isAuthenticated: !!user,
      isAdmin, isSchoolManager, isOfficer, isViewer, isEmployee, isOwnRecord,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

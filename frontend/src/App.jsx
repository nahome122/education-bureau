import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppLayout from './components/layout/AppLayout';
import EmployeeLayout from './components/layout/EmployeeLayout';

// Pages
import Login            from './pages/auth/Login';
import ForgotPassword   from './pages/auth/ForgotPassword';
import Dashboard        from './pages/dashboard/Dashboard';
import Schools          from './pages/schools/Schools';
import Teachers         from './pages/teachers/Teachers';
import Staff            from './pages/staff/Staff';
import Departments      from './pages/departments/Departments';
import Attendance       from './pages/attendance/Attendance';
import AttendanceSummary from './pages/attendance/AttendanceSummary';
import Reports          from './pages/reports/Reports';
import Transfer         from './pages/transfer/Transfer';
import Users            from './pages/users/Users';
import Settings         from './pages/settings/Settings';
import Profile          from './pages/profile/Profile';
import AccessDenied     from './pages/errors/AccessDenied';

// Employee self-service pages
import MyDashboard      from './pages/employee/MyDashboard';
import MyAttendance     from './pages/employee/MyAttendance';
import AccountSettings  from './pages/employee/AccountSettings';
import MyTransfer       from './pages/employee/MyTransfer';

import './styles/variables.css';
import './styles/animations.css';
import './styles/global.css';

// ── Guards ────────────────────────────────────────────────────────────────────
// Admin/manager layout routes — redirect employees to their portal
const AdminRoute = ({ children }) => {
  const { isAuthenticated, loading, isEmployee } = useAuth();
  if (loading) return <div className="full-page-loader"><span className="spinner" /></div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (isEmployee) return <Navigate to="/my/dashboard" replace />;
  return children;
};

// Employee-only layout routes — redirect admins away
const EmployeeRoute = ({ children }) => {
  const { isAuthenticated, loading, isEmployee } = useAuth();
  if (loading) return <div className="full-page-loader"><span className="spinner" /></div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!isEmployee) return <Navigate to="/dashboard" replace />;
  return children;
};

// Permission-based module guard (for admin-side routes)
const RoleRoute = ({ children, permission, adminOnly, adminOrManagerOnly }) => {
  const { canAccess, isAdmin, isSchoolManager } = useAuth();
  if (adminOnly && !isAdmin)           return <AccessDenied />;
  if (adminOrManagerOnly && !isAdmin && !isSchoolManager) return <AccessDenied />;
  if (permission && !canAccess(permission)) return <AccessDenied />;
  return children;
};

const ProfileRoute = () => {
  const { canAccess, isAdmin, isSchoolManager } = useAuth();
  if (isAdmin || isSchoolManager) return <Navigate to="/settings" replace />;
  if (!canAccess('profile')) return <AccessDenied />;
  return <Profile />;
};

// ── Routes ────────────────────────────────────────────────────────────────────
const AppRoutes = () => {
  const { isAuthenticated, isEmployee } = useAuth();

  if (isAuthenticated && isEmployee) {
    // Redirect root to employee portal
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/my/dashboard" replace />} />

        {/* Public */}
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Employee self-service portal */}
        <Route element={<EmployeeRoute><EmployeeLayout /></EmployeeRoute>}>
          <Route path="/my/dashboard"  element={<MyDashboard />} />
          <Route path="/my/attendance" element={<MyAttendance />} />
          <Route path="/my/transfer"   element={<MyTransfer />} />
          <Route path="/my/profile"    element={<Navigate to="/my/settings?tab=profile" replace />} />
          <Route path="/my/settings"   element={<AccountSettings />} />
        </Route>

        {/* Block all admin pages → 403 */}
        <Route path="/403" element={<AccessDenied />} />
        <Route path="*"    element={<Navigate to="/my/dashboard" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Administrator / Manager / Officer layout */}
      <Route element={<AdminRoute><AppLayout /></AdminRoute>}>
        <Route path="/dashboard" element={<RoleRoute permission="dashboard"><Dashboard /></RoleRoute>} />

        {/* Admin-only */}
        <Route path="/users"       element={<RoleRoute adminOnly><Users /></RoleRoute>} />
        <Route path="/schools"     element={<RoleRoute adminOnly><Schools /></RoleRoute>} />
        <Route path="/all-schools-attendance" element={<Navigate to="/attendance" replace />} />
        <Route path="/departments" element={<RoleRoute adminOnly><Departments /></RoleRoute>} />
        <Route path="/settings"    element={<RoleRoute adminOrManagerOnly><Settings /></RoleRoute>} />

        {/* Shared by multiple roles */}
        <Route path="/teachers"           element={<RoleRoute permission="teachers"><Teachers /></RoleRoute>} />
        <Route path="/staff"              element={<RoleRoute permission="staff"><Staff /></RoleRoute>} />
        <Route path="/attendance"         element={<RoleRoute permission="attendance"><Attendance /></RoleRoute>} />
        <Route path="/attendance-summary" element={<RoleRoute permission="attendance"><AttendanceSummary /></RoleRoute>} />
        <Route path="/transfer"           element={<RoleRoute adminOnly><Transfer /></RoleRoute>} />
        <Route path="/reports"            element={<RoleRoute permission="reports"><Reports /></RoleRoute>} />
        <Route path="/profile"            element={<ProfileRoute />} />

        <Route path="/403" element={<AccessDenied />} />
        <Route path="*"    element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
};

const App = () => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { fontFamily: 'Inter, sans-serif', fontSize: '13px' },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default App;

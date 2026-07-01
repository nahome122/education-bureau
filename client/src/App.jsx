import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppLayout from './components/layout/AppLayout';

// Pages
import Login       from './pages/auth/Login';
import Dashboard   from './pages/dashboard/Dashboard';
import Schools     from './pages/schools/Schools';
import Teachers    from './pages/teachers/Teachers';
import Staff       from './pages/staff/Staff';
import Departments from './pages/departments/Departments';
import Positions   from './pages/positions/Positions';
import Attendance  from './pages/attendance/Attendance';
import Reports     from './pages/reports/Reports';
import Users       from './pages/users/Users';
import Settings    from './pages/settings/Settings';
import Profile     from './pages/profile/Profile';
import Logs        from './pages/logs/Logs';
import AccessDenied from './pages/errors/AccessDenied';
import IdCards      from './pages/idcards/IdCards';

import './styles/variables.css';
import './styles/animations.css';
import './styles/global.css';

// Require authentication
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="full-page-loader"><span className="spinner" /></div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

// Require a specific permission / role
const RoleRoute = ({ children, permission, adminOnly }) => {
  const { canAccess, isAdmin } = useAuth();
  if (adminOnly && !isAdmin)        return <AccessDenied />;
  if (permission && !canAccess(permission)) return <AccessDenied />;
  return children;
};

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />

      {/* Protected */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<RoleRoute permission="dashboard"><Dashboard /></RoleRoute>} />

        {/* Admin-only */}
        <Route path="/users"   element={<RoleRoute adminOnly><Users /></RoleRoute>} />
        <Route path="/schools" element={<RoleRoute adminOnly><Schools /></RoleRoute>} />
        <Route path="/departments" element={<RoleRoute adminOnly><Departments /></RoleRoute>} />
        <Route path="/positions"   element={<RoleRoute adminOnly><Positions /></RoleRoute>} />
        <Route path="/logs"        element={<RoleRoute adminOnly><Logs /></RoleRoute>} />
        <Route path="/settings"    element={<RoleRoute adminOnly><Settings /></RoleRoute>} />

        {/* Shared by multiple roles */}
        <Route path="/teachers"   element={<RoleRoute permission="teachers"><Teachers /></RoleRoute>} />
        <Route path="/staff"      element={<RoleRoute permission="staff"><Staff /></RoleRoute>} />
        <Route path="/id-cards"   element={<RoleRoute permission="id-cards"><IdCards /></RoleRoute>} />
        <Route path="/attendance" element={<RoleRoute permission="attendance"><Attendance /></RoleRoute>} />
        <Route path="/reports"    element={<RoleRoute permission="reports"><Reports /></RoleRoute>} />
        <Route path="/profile"    element={<RoleRoute permission="profile"><Profile /></RoleRoute>} />

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
            style: { fontFamily: 'Poppins, sans-serif', fontSize: '13px' },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default App;

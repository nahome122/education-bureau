import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  MdDashboard, MdEventNote, MdSettings,
  MdLogout, MdChevronLeft, MdChevronRight, MdWarning, MdKey, MdSwapHoriz,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './EmployeeLayout.css';

const EMP_NAV = [
  { path: '/my/dashboard',  icon: <MdDashboard />,  label: 'My Dashboard'   },
  { path: '/my/attendance', icon: <MdEventNote />,  label: 'My Attendance'  },
  { path: '/my/transfer',   icon: <MdSwapHoriz />,  label: 'Transfer Request' },
  { path: '/my/settings',   icon: <MdSettings />,   label: 'Account Settings' },
];

const EmployeeLayout = () => {
  const { user, logout, mustChangePassword } = useAuth();
  const { sidebarColor, setSidebarColor, theme } = useTheme();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className={`emp-layout ${theme === 'dark' ? 'dark' : ''}`}>
      {/* ── Sidebar ── */}
      <aside className={`emp-sidebar emp-sidebar--${sidebarColor} ${collapsed ? 'emp-sidebar--collapsed' : ''}`}>
        {/* Logo */}
        <div className="emp-sidebar-logo">
          <img src="/logo.jpg" alt="Wachale" className="emp-sidebar-logo-img" />
          {!collapsed && (
            <div className="emp-sidebar-logo-text">
              <span className="emp-sidebar-logo-name">TSMS</span>
              <span className="emp-sidebar-logo-sub">Self Service</span>
            </div>
          )}
          <button
            className="emp-sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <MdChevronRight /> : <MdChevronLeft />}
          </button>
        </div>

        {/* Mode switcher */}
        {!collapsed && (
          <div className="emp-mode-switcher">
            <button
              className={`emp-mode-btn ${sidebarColor === 'light' ? 'emp-mode-btn--active' : ''}`}
              onClick={() => setSidebarColor('light')}
            >
              <span className="emp-mode-dot emp-mode-dot--light" /> Light
            </button>
            <button
              className={`emp-mode-btn ${sidebarColor === 'dark' ? 'emp-mode-btn--active' : ''}`}
              onClick={() => setSidebarColor('dark')}
            >
              <span className="emp-mode-dot emp-mode-dot--dark" /> Dark
            </button>
          </div>
        )}

        {/* Role pill */}
        {!collapsed && (
          <div className="emp-role-pill">
            <span className={`badge ${user?.role_name === 'Teacher' ? 'badge-primary' : 'badge-warning'}`}>
              {user?.role_label || user?.role_name}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="emp-nav">
          <ul className="emp-nav-list">
            {EMP_NAV.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={() => `emp-nav-item ${isActive ? 'active' : ''}`}
                    data-tooltip={collapsed ? item.label : undefined}
                  >
                    <span className="emp-nav-icon">{item.icon}</span>
                    {!collapsed && <span className="emp-nav-label">{item.label}</span>}
                    {!collapsed && isActive && <span className="emp-nav-active-dot" />}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User strip */}
        <div className="emp-user-strip">
          <div className="emp-user-avatar">{getInitials(user?.full_name)}</div>
          {!collapsed && (
            <div className="emp-user-info">
              <span className="emp-user-name">{user?.full_name || 'Employee'}</span>
              <span className="emp-user-school">{user?.school_name || ''}</span>
            </div>
          )}
          <button
            className="emp-logout-btn"
            onClick={logout}
            title="Logout"
            data-tooltip={collapsed ? 'Logout' : undefined}
          >
            <MdLogout />
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="emp-main">
        {/* Must-change-password banner */}
        {mustChangePassword && (
          <div className="must-change-banner">
            <MdKey className="must-change-icon" />
            <span>
              You're using a default password. Please&nbsp;
              <NavLink to="/my/settings" className="must-change-link">
                change your password
              </NavLink>
              &nbsp;now to secure your account.
            </span>
            <MdWarning className="must-change-warn-icon" />
          </div>
        )}
        <div className="emp-page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default EmployeeLayout;

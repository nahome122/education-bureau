import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  MdDashboard, MdSchool, MdPeople, MdGroups, MdEventNote,
  MdAssessment, MdManageAccounts, MdSettings, MdLogout,
  MdChevronLeft, MdChevronRight, MdSupervisorAccount,
  MdBusinessCenter, MdBarChart, MdBadge, MdSwapHoriz,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './Sidebar.css';

const ALL_NAV = [
  { path: '/dashboard',            icon: <MdDashboard />,        label: 'Dashboard',            permission: 'dashboard' },
  { path: '/users',                icon: <MdSupervisorAccount />, label: 'User Management',      permission: null, adminOnly: true },
  { path: '/schools',              icon: <MdSchool />,            label: 'Schools',              permission: null, adminOnly: true },
  { path: '/teachers',             icon: <MdPeople />,            label: 'Teachers',             permission: 'teachers',  employeeHide: true },
  { path: '/staff',                icon: <MdManageAccounts />,    label: 'Staff',                permission: 'staff',     employeeHide: true },
  { path: '/id-cards',             icon: <MdBadge />,             label: 'ID Cards',             permission: 'id-cards' },
  { path: '/attendance',           icon: <MdEventNote />,         label: 'Attendance',           permission: 'attendance' },
  { path: '/departments',          icon: <MdBusinessCenter />,    label: 'Departments',          permission: null, adminOnly: true },
  { path: '/teacher-performance',  icon: <MdBarChart />,          label: 'Teacher Performance',  permission: 'reports', employeeHide: true },
  { path: '/transfer',             icon: <MdSwapHoriz />,         label: 'Transfer',             permission: 'reports',   employeeHide: true },
  { path: '/reports',              icon: <MdBarChart />,          label: 'Reports',              permission: 'reports',   employeeHide: true },
  { path: '/settings',             icon: <MdSettings />,          label: 'System Settings',      permission: null, adminOnly: true },
  { path: '/profile',              icon: <MdAssessment />,        label: 'Profile',              permission: 'profile' },
];

const Sidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const { user, logout, isAdmin, isEmployee, canAccess } = useAuth();
  const { sidebarColor, setSidebarColor } = useTheme();
  const location = useLocation();

  const visibleItems = ALL_NAV.filter(item => {
    if (item.adminOnly)              return isAdmin;
    if (item.employeeHide && isEmployee) return false;
    if (!item.permission)            return true;
    return canAccess(item.permission);
  });

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <aside className={`sidebar sidebar--${sidebarColor} ${collapsed ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--mobile-open' : ''}`}>

      {/* ── Logo ── */}
      <div className="sidebar-logo">
        <img src="/logo.jpg" alt="Wachale Woreda Education Bureau" className="sidebar-logo-img" />
        {!collapsed && (
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">Teacher &amp; Staff</span>
            <span className="sidebar-logo-sub">Management System</span>
          </div>
        )}
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? <MdChevronRight /> : <MdChevronLeft />}
        </button>
      </div>

      {/* ── Sidebar mode switcher ── */}
      {!collapsed && (
        <div className="sidebar-mode-switcher">
          <button
            className={`mode-btn ${sidebarColor === 'light' ? 'mode-btn--active' : ''}`}
            onClick={() => setSidebarColor('light')}
            aria-label="Light sidebar"
          >
            <span className="mode-dot mode-dot--light" />
            Light
          </button>
          <button
            className={`mode-btn ${sidebarColor === 'dark' ? 'mode-btn--active' : ''}`}
            onClick={() => setSidebarColor('dark')}
            aria-label="Dark sidebar"
          >
            <span className="mode-dot mode-dot--dark" />
            Dark
          </button>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">
        <ul className="sidebar-nav-list">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onMobileClose}
                  className={() => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                  data-tooltip={collapsed ? item.label : undefined}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
                  {!collapsed && isActive && <span className="sidebar-nav-active-dot" />}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── User strip ── */}
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{getInitials(user?.full_name)}</div>
        {!collapsed && (
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.full_name || 'User'}</span>
            <span className="sidebar-user-role">{user?.role_label || user?.role_name}</span>
          </div>
        )}
        <button
          className="sidebar-logout-btn"
          onClick={logout}
          data-tooltip={collapsed ? 'Logout' : undefined}
          title="Logout"
        >
          <MdLogout />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

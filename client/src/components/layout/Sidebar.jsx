import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  MdDashboard, MdSchool, MdPeople, MdGroups, MdEventNote,
  MdAssessment, MdManageAccounts, MdSettings, MdLogout,
  MdChevronLeft, MdChevronRight, MdSupervisorAccount,
  MdBusinessCenter, MdWork, MdHistory, MdBarChart, MdBadge
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

/**
 * Nav visibility rules:
 *   adminOnly    — only Administrator
 *   permission   — check canAccess(permission)
 *   employeeHide — HIDE this item when the logged-in user is a Teacher/Staff employee
 *
 * Employees (Teacher / Staff) see ONLY:
 *   Dashboard · ID Cards · Attendance (view) · Profile
 */
const ALL_NAV = [
  { path: '/dashboard',   icon: <MdDashboard />,        label: 'Dashboard',       permission: 'dashboard' },
  { path: '/users',       icon: <MdSupervisorAccount />, label: 'User Management', permission: null, adminOnly: true },
  { path: '/schools',     icon: <MdSchool />,            label: 'Schools',         permission: null, adminOnly: true },
  { path: '/teachers',    icon: <MdPeople />,            label: 'Teachers',        permission: 'teachers',  employeeHide: true },
  { path: '/staff',       icon: <MdManageAccounts />,    label: 'Staff',           permission: 'staff',     employeeHide: true },
  { path: '/id-cards',   icon: <MdBadge />,             label: 'ID Cards',        permission: 'id-cards' },
  { path: '/attendance',  icon: <MdEventNote />,         label: 'Attendance',      permission: 'attendance' },
  { path: '/departments', icon: <MdBusinessCenter />,    label: 'Departments',     permission: null, adminOnly: true },
  { path: '/positions',   icon: <MdWork />,              label: 'Positions',       permission: null, adminOnly: true },
  { path: '/reports',     icon: <MdBarChart />,          label: 'Reports',         permission: 'reports',   employeeHide: true },
  { path: '/logs',        icon: <MdHistory />,           label: 'System Logs',     permission: null, adminOnly: true },
  { path: '/settings',    icon: <MdSettings />,          label: 'System Settings', permission: null, adminOnly: true },
  { path: '/profile',     icon: <MdAssessment />,        label: 'Profile',         permission: 'profile' },
];

const Sidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const { user, logout, isAdmin, isEmployee, canAccess } = useAuth();
  const location = useLocation();

  const visibleItems = ALL_NAV.filter(item => {
    if (item.adminOnly)    return isAdmin;
    if (item.employeeHide && isEmployee) return false;   // hide from Teacher/Staff
    if (!item.permission)  return true;
    return canAccess(item.permission);
  });

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--mobile-open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><MdSchool /></div>
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

      {/* Navigation */}
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

      {/* User strip */}
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

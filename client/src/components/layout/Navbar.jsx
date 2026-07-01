import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MdSearch, MdNotifications, MdPerson, MdLogout, MdSettings,
  MdMenu, MdKeyboardArrowDown, MdBrightness4, MdBrightness7,
  MdLock
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './Navbar.css';

const PAGE_TITLES = {
  '/dashboard':   'Dashboard',
  '/schools':     'Schools',
  '/staff':       'Staff Management',
  '/teachers':    'Teachers',
  '/attendance':  'Attendance',
  '/reports':     'Reports',
  '/users':       'User Management',
  '/departments': 'Departments',
  '/positions':   'Positions',
  '/settings':    'System Settings',
  '/profile':     'My Profile',
  '/logs':        'System Logs',
};

const Navbar = ({ onMobileMenuToggle }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate   = useNavigate();
  const location   = useLocation();
  const pageTitle  = PAGE_TITLES[location.pathname] || 'Admin Panel';

  const [showProfile,    setShowProfile]    = useState(false);
  const [searchVal,      setSearchVal]      = useState('');
  const [searchFocused,  setSearchFocused]  = useState(false);

  const profileRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'Administrator':    return 'badge-danger';
      case 'SchoolManager':    return 'badge-primary';
      case 'AttendanceOfficer':return 'badge-warning';
      case 'Viewer':           return 'badge-gray';
      default:                 return 'badge-primary';
    }
  };

  return (
    <header className="navbar">
      {/* Mobile toggle */}
      <button className="navbar-mobile-toggle" onClick={onMobileMenuToggle} aria-label="Toggle menu">
        <MdMenu />
      </button>

      {/* Page Title */}
      <div className="navbar-page-title">
        <span>{pageTitle}</span>
      </div>

      {/* Search */}
      <div className={`navbar-search ${searchFocused ? 'focused' : ''}`}>
        <MdSearch className="navbar-search-icon" />
        <input
          type="text"
          placeholder="Search teachers, staff, schools..."
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="navbar-search-input"
        />
      </div>

      {/* Right actions */}
      <div className="navbar-actions">
        {/* Dark Mode */}
        <button className="navbar-icon-btn" onClick={toggleTheme} data-tooltip={isDark ? 'Light Mode' : 'Dark Mode'}>
          {isDark ? <MdBrightness7 /> : <MdBrightness4 />}
        </button>

        {/* Profile dropdown */}
        <div className="navbar-dropdown" ref={profileRef}>
          <button
            className="navbar-profile-btn"
            onClick={() => setShowProfile(s => !s)}
            aria-expanded={showProfile}
          >
            <div className="navbar-avatar">{getInitials(user?.full_name)}</div>
            <div className="navbar-profile-info">
              <span className="navbar-profile-name">{user?.full_name || 'User'}</span>
              <span className="navbar-profile-role">{user?.role_label || user?.role_name}</span>
            </div>
            <MdKeyboardArrowDown className={`navbar-chevron ${showProfile ? 'open' : ''}`} />
          </button>

          {showProfile && (
            <div className="navbar-panel profile-panel animate-slide-down">
              <div className="profile-panel-header">
                <div className="navbar-avatar navbar-avatar--lg">{getInitials(user?.full_name)}</div>
                <div>
                  <p className="font-semibold text-sm">{user?.full_name}</p>
                  <p className="text-xs text-muted">{user?.email}</p>
                  <span className={`badge ${getRoleBadgeColor(user?.role_name)} mt-sm`}>
                    {user?.role_label || user?.role_name}
                  </span>
                </div>
              </div>
              <div className="dropdown-divider" />
              <button className="dropdown-item" onClick={() => { navigate('/profile'); setShowProfile(false); }}>
                <MdPerson /> My Profile
              </button>
              <button className="dropdown-item" onClick={() => { navigate('/profile?tab=password'); setShowProfile(false); }}>
                <MdLock /> Change Password
              </button>
              {user?.role_name === 'Administrator' && (
                <button className="dropdown-item" onClick={() => { navigate('/settings'); setShowProfile(false); }}>
                  <MdSettings /> Settings
                </button>
              )}
              <div className="dropdown-divider" />
              <button className="dropdown-item danger" onClick={logout}>
                <MdLogout /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;

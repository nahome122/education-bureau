import React from 'react';
import { MdSettings, MdInfo, MdShield, MdStorage, MdPeople } from 'react-icons/md';
import './Settings.css';

const Settings = () => (
  <div className="settings-page">
    <div className="page-header">
      <div><h1 className="page-title">System Settings</h1><p className="page-subtitle">Administrator-only system configuration</p></div>
    </div>

    <div className="settings-grid">
      <div className="card settings-card">
        <div className="settings-icon primary"><MdInfo /></div>
        <h3>System Information</h3>
        <div className="settings-info-list">
          <div className="settings-info-row"><span>System Name</span><span>Teacher &amp; Staff Management System</span></div>
          <div className="settings-info-row"><span>Version</span><span>1.0.0</span></div>
          <div className="settings-info-row"><span>Organization</span><span>Wachale Woreda Education Bureau</span></div>
          <div className="settings-info-row"><span>Authentication</span><span>JWT + bcrypt</span></div>
          <div className="settings-info-row"><span>Database</span><span>MySQL</span></div>
          <div className="settings-info-row"><span>Environment</span><span>{import.meta.env.MODE || 'development'}</span></div>
        </div>
      </div>

      <div className="card settings-card">
        <div className="settings-icon success"><MdShield /></div>
        <h3>Security Settings</h3>
        <div className="settings-info-list">
          <div className="settings-info-row"><span>Password Hashing</span><span className="badge badge-success">bcrypt (rounds: 12)</span></div>
          <div className="settings-info-row"><span>Token Expiry</span><span>8 hours</span></div>
          <div className="settings-info-row"><span>Rate Limiting</span><span className="badge badge-success">Enabled</span></div>
          <div className="settings-info-row"><span>CORS</span><span className="badge badge-success">Configured</span></div>
          <div className="settings-info-row"><span>Helmet</span><span className="badge badge-success">Active</span></div>
          <div className="settings-info-row"><span>Input Validation</span><span className="badge badge-success">Active</span></div>
        </div>
      </div>

      <div className="card settings-card">
        <div className="settings-icon warning"><MdPeople /></div>
        <h3>User Roles</h3>
        <div className="settings-info-list">
          <div className="settings-info-row"><span><span className="badge badge-danger">Administrator</span></span><span>Full system access</span></div>
          <div className="settings-info-row"><span><span className="badge badge-primary">School Manager</span></span><span>Schools, Teachers, Staff, Attendance, Reports</span></div>
          <div className="settings-info-row"><span><span className="badge badge-warning">Attendance Officer</span></span><span>Attendance, Teachers, Reports</span></div>
          <div className="settings-info-row"><span><span className="badge badge-gray">Viewer</span></span><span>Dashboard, Reports (read-only)</span></div>
        </div>
      </div>

      <div className="card settings-card">
        <div className="settings-icon info"><MdStorage /></div>
        <h3>Database</h3>
        <div className="settings-info-list">
          <div className="settings-info-row"><span>Engine</span><span>MySQL 8+</span></div>
          <div className="settings-info-row"><span>Tables</span><span>users, roles, schools, teachers, staff, departments, positions, attendance, login_logs</span></div>
          <div className="settings-info-row"><span>Foreign Keys</span><span className="badge badge-success">Enabled</span></div>
          <div className="settings-info-row"><span>Connection Pool</span><span>Max 10</span></div>
        </div>
      </div>
    </div>
  </div>
);

export default Settings;

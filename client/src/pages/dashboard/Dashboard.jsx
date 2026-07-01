import React, { useEffect, useState } from 'react';
import {
  MdSchool, MdPeople, MdGroups, MdEventAvailable,
  MdPersonAdd, MdArrowForward, MdCheckCircle, MdCancel,
  MdSupervisorAccount, MdVerifiedUser, MdPersonOff, MdChildCare
} from 'react-icons/md';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Tooltip, Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getDashboard } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const StatCard = ({ icon, label, value, color, link, accent }) => (
  <div className="stat-box animate-slide-up" style={{ '--card-accent': accent }}>
    <div className="stat-box-content">
      <div className={`stat-box-icon ${color}`}>{icon}</div>
      <div className="stat-box-info">
        <h3>{value ?? '—'}</h3>
        <p>{label}</p>
      </div>
    </div>
    {link && (
      <Link to={link} className="stat-box-link">View all <MdArrowForward /></Link>
    )}
  </div>
);

const Dashboard = () => {
  const { user, isAdmin, isEmployee } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then(({ data }) => { if (data.success) setStats(data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chartData = {
    labels: stats?.monthly?.map(m => m.month) || [],
    datasets: [
      { label: 'Present',        data: stats?.monthly?.map(m => m.present) || [], backgroundColor: 'rgba(37,99,235,0.75)', borderRadius: 6 },
      { label: 'Total Recorded', data: stats?.monthly?.map(m => m.total)   || [], backgroundColor: 'rgba(16,185,129,0.45)', borderRadius: 6 },
    ],
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 6, font: { family: 'Poppins', size: 12 } } },
      tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', titleColor: '#fff', bodyColor: '#94A3B8', padding: 12, cornerRadius: 8 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 11 }, color: '#94A3B8' } },
      y: { grid: { color: 'rgba(226,232,240,0.5)' }, ticks: { font: { family: 'Poppins', size: 11 }, color: '#94A3B8' } },
    },
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="main-stats-grid">
          {[...Array(8)].map((_, i) => <div key={i} className="stat-box"><div className="skeleton skeleton-card" /></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Greeting */}
      <div className="dashboard-greeting mb-lg">
        <h1 className="page-title">
          Welcome back, <span className="text-primary">{user?.full_name?.split(' ')[0]}</span>
        </h1>
        <p className="page-subtitle">
          {user?.role_label} — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="main-stats-grid">
        <StatCard icon={<MdSchool size={32}/>}           label="Total Schools"   value={stats?.totalSchools}   color="text-blue"   link={isAdmin ? '/schools' : null}   accent="var(--gradient-primary)" />
        <StatCard icon={<MdPeople size={32}/>}            label="Total Teachers"  value={stats?.totalTeachers}  color="text-cyan"   link="/teachers"                     accent="var(--gradient-secondary)" />
        <StatCard icon={<MdGroups size={32}/>}            label="Total Staff"     value={stats?.totalStaff}     color="text-orange" link="/staff"                        accent="var(--gradient-warning)" />
        <StatCard icon={<MdChildCare size={32}/>}         label="Total Students"  value={stats?.totalStudents}  color="text-teal"   link={isAdmin ? '/schools' : null}   accent="linear-gradient(135deg,#0891B2,#06B6D4)" />
        <StatCard icon={<MdSupervisorAccount size={32}/>} label="Total Users"     value={stats?.totalUsers}     color="text-purple" link={isAdmin ? '/users' : null}     accent="var(--gradient-purple)" />
        <StatCard icon={<MdEventAvailable size={32}/>}    label="Present Today"   value={stats?.presentToday}   color="text-green"  link="/attendance"                   accent="linear-gradient(135deg,#22C55E,#10B981)" />
        <StatCard icon={<MdCancel size={32}/>}            label="Absent Today"    value={stats?.absentToday}    color="text-red"    link="/attendance"                   accent="var(--gradient-danger)" />
        {isAdmin && <>
          <StatCard icon={<MdVerifiedUser size={32}/>}    label="Active Users"    value={stats?.activeUsers}    color="text-green"  link="/users"                        accent="linear-gradient(135deg,#22C55E,#10B981)" />
          <StatCard icon={<MdPersonOff size={32}/>}       label="Inactive Users"  value={stats?.inactiveUsers}  color="text-gray"   link="/users"                        accent="linear-gradient(135deg,#64748B,#94A3B8)" />
        </>}
      </div>

      {/* Chart + recent logins */}
      <div className="dashboard-middle-row mt-lg">
        <div className={`card dashboard-chart-card animate-slide-up${isEmployee ? ' dashboard-chart-full' : ''}`}>
          <h3 className="card-title mb-lg">Monthly Attendance Overview</h3>
          <div style={{ height: '300px' }}>
            {stats?.monthly?.length > 0
              ? <Bar data={chartData} options={chartOptions} />
              : <div className="empty-state"><div className="empty-state-icon">📊</div><p className="text-muted">No attendance data yet</p></div>
            }
          </div>
        </div>

        {!isEmployee && (
          <div className="card dashboard-list-card animate-slide-up">
            <h3 className="card-title mb-lg">Recent Login Activity</h3>
            <div className="recent-logins-list">
              {stats?.recentLogins?.length > 0 ? stats.recentLogins.map((log, i) => (
                <div key={i} className="recent-login-item">
                  <div className={`login-status-dot ${log.status === 'success' ? 'success' : 'failed'}`} />
                  <div className="login-info">
                    <span className="login-name">{log.full_name || log.username}</span>
                    <span className="login-role text-muted">{log.role || '—'}</span>
                  </div>
                  <div className="login-meta">
                    <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}>{log.status}</span>
                    <span className="login-time text-muted">
                      {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">No recent logins</p></div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick actions — hidden for employees (Teacher/Staff) */}
      {!isEmployee && (
        <div className="card quick-actions-container animate-slide-up mt-lg">
          <h3 className="card-title mb-lg">Quick Actions</h3>
          <div className="quick-actions-grid">
            {isAdmin && <Link to="/users"      className="action-btn action-blue">   <MdPersonAdd size={22} /> Add User</Link>}
            {isAdmin && <Link to="/schools"    className="action-btn action-green">  <MdSchool size={22} /> Add School</Link>}
            <Link to="/teachers"               className="action-btn action-cyan">   <MdPeople size={22} /> Manage Teachers</Link>
            <Link to="/attendance"             className="action-btn action-purple"> <MdEventAvailable size={22} /> Mark Attendance</Link>
            <Link to="/reports"                className="action-btn action-orange"> <MdCheckCircle size={22} /> View Reports</Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

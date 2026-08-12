import React, { useEffect, useState } from 'react';
import {
  MdSchool, MdPeople, MdGroups, MdEventAvailable,
  MdArrowForward, MdCheckCircle, MdCancel,
  MdSupervisorAccount, MdVerifiedUser, MdPersonOff,
  MdChildCare, MdPersonAdd, MdTrendingUp, MdTrendingDown,
  MdAccessTime, MdBarChart, MdStar,
} from 'react-icons/md';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { getDashboard } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Tooltip, Legend, Filler,
);

/* ── KPI card ────────────────────────────────────────────── */
const KpiCard = ({ icon, label, value, trend, trendLabel, gradient, iconBg, link }) => (
  <div className="kpi-card animate-slide-up">
    <div className="kpi-top">
      <div className="kpi-icon" style={{ background: iconBg }}>{icon}</div>
      {trend !== undefined && (
        <span className={`kpi-trend ${trend >= 0 ? 'kpi-trend--up' : 'kpi-trend--down'}`}>
          {trend >= 0 ? <MdTrendingUp /> : <MdTrendingDown />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div className="kpi-value">{value ?? '—'}</div>
    <div className="kpi-label">{label}</div>
    {trendLabel && <div className="kpi-trend-label">{trendLabel}</div>}
    <div className="kpi-bar" style={{ background: gradient }} />
    {link && (
      <Link to={link} className="kpi-link">
        View details <MdArrowForward />
      </Link>
    )}
  </div>
);

/* ── Activity item ───────────────────────────────────────── */
const ActivityItem = ({ name, role, status, time }) => (
  <div className="activity-item">
    <div className={`activity-avatar ${status === 'success' ? 'activity-avatar--success' : 'activity-avatar--fail'}`}>
      {(name || '?')[0].toUpperCase()}
    </div>
    <div className="activity-info">
      <span className="activity-name">{name}</span>
      <span className="activity-role">{role || '—'}</span>
    </div>
    <div className="activity-right">
      <span className={`badge ${status === 'success' ? 'badge-success' : 'badge-danger'}`}>
        {status}
      </span>
      <span className="activity-time">
        <MdAccessTime /> {time}
      </span>
    </div>
  </div>
);

/* ── Quick action button ─────────────────────────────────── */
const QuickAction = ({ to, icon, label, gradient }) => (
  <Link to={to} className="quick-action" style={{ '--qa-gradient': gradient }}>
    <div className="quick-action-icon">{icon}</div>
    <span>{label}</span>
  </Link>
);

/* ════════════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════════════ */
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

  /* ── Chart configs ─────────────────────────────────────── */
  const months = stats?.monthly?.map(m => m.month) || [];

  const barData = {
    labels: months,
    datasets: [
      {
        label: 'Present',
        data: stats?.monthly?.map(m => m.present) || [],
        backgroundColor: 'rgba(99,102,241,0.80)',
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: 'Total',
        data: stats?.monthly?.map(m => m.total) || [],
        backgroundColor: 'rgba(16,185,129,0.40)',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const lineData = {
    labels: months.length ? months : ['Jan','Feb','Mar','Apr','May','Jun'],
    datasets: [
      {
        label: 'Attendance Rate %',
        data: stats?.monthly?.map(m =>
          m.total ? Math.round((m.present / m.total) * 100) : 0
        ) || [72, 85, 78, 90, 88, 94],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.10)',
        pointBackgroundColor: '#6366f1',
        pointRadius: 4,
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const chartOpts = (yLabel) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, boxWidth: 7, font: { size: 11 }, color: 'var(--text-secondary)' },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        padding: 12,
        cornerRadius: 10,
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: 'var(--text-muted)' } },
      y: {
        grid: { color: 'rgba(226,232,240,0.45)' },
        ticks: { font: { size: 11 }, color: 'var(--text-muted)' },
        title: yLabel ? { display: true, text: yLabel, color: 'var(--text-muted)', font: { size: 10 } } : undefined,
      },
    },
  });

  if (loading) return (
    <div className="dashboard">
      <div className="kpi-grid">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="kpi-card"><div className="skeleton skeleton-card" style={{ height: 140 }} /></div>
        ))}
      </div>
    </div>
  );

  const firstName = user?.full_name?.split(' ')[0] || 'there';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hour  = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="dashboard">

      {/* ── Hero banner ── */}
      <div className="dash-hero animate-slide-up">
        <div className="dash-hero-text">
          <h1>{greeting}, <span>{firstName}</span> 👋</h1>
          <p>{user?.role_label} &nbsp;·&nbsp; {today}</p>
        </div>
        <div className="dash-hero-badges">
          <div className="hero-badge hero-badge--green">
            <MdCheckCircle /> {stats?.presentToday ?? 0} Present Today
          </div>
          <div className="hero-badge hero-badge--red">
            <MdCancel /> {stats?.absentToday ?? 0} Absent Today
          </div>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="kpi-grid">
        <KpiCard
          icon={<MdSchool />}          label="Total Schools"
          value={stats?.totalSchools}  trend={5}  trendLabel="vs last month"
          gradient="linear-gradient(90deg,#6366f1,#818cf8)"
          iconBg="rgba(99,102,241,0.12)"
          link={isAdmin ? '/schools' : null}
        />
        <KpiCard
          icon={<MdPeople />}          label="Total Teachers"
          value={stats?.totalTeachers} trend={3}  trendLabel="new this month"
          gradient="linear-gradient(90deg,#10b981,#34d399)"
          iconBg="rgba(16,185,129,0.12)"
          link="/teachers"
        />
        <KpiCard
          icon={<MdGroups />}          label="Total Staff"
          value={stats?.totalStaff}    trend={1}  trendLabel="new this month"
          gradient="linear-gradient(90deg,#f59e0b,#fbbf24)"
          iconBg="rgba(245,158,11,0.12)"
          link="/staff"
        />
        <KpiCard
          icon={<MdChildCare />}       label="Total Students"
          value={stats?.totalStudents} trend={8}  trendLabel="enrolled"
          gradient="linear-gradient(90deg,#06b6d4,#22d3ee)"
          iconBg="rgba(6,182,212,0.12)"
          link={isAdmin ? '/schools' : null}
        />
        <KpiCard
          icon={<MdEventAvailable />}  label="Present Today"
          value={stats?.presentToday}
          gradient="linear-gradient(90deg,#22c55e,#4ade80)"
          iconBg="rgba(34,197,94,0.12)"
          link="/attendance"
        />
        <KpiCard
          icon={<MdCancel />}          label="Absent Today"
          value={stats?.absentToday}   trend={-2} trendLabel="vs yesterday"
          gradient="linear-gradient(90deg,#ef4444,#f87171)"
          iconBg="rgba(239,68,68,0.12)"
          link="/attendance"
        />
        {isAdmin && <>
          <KpiCard
            icon={<MdVerifiedUser />}  label="Active Users"
            value={stats?.activeUsers}
            gradient="linear-gradient(90deg,#8b5cf6,#a78bfa)"
            iconBg="rgba(139,92,246,0.12)"
            link="/users"
          />
          <KpiCard
            icon={<MdPersonOff />}     label="Inactive Users"
            value={stats?.inactiveUsers}
            gradient="linear-gradient(90deg,#64748b,#94a3b8)"
            iconBg="rgba(100,116,139,0.12)"
            link="/users"
          />
        </>}
      </div>

      {/* ── Charts row ── */}
      <div className={`dash-charts-row ${isEmployee ? 'dash-charts-single' : ''}`}>
        {/* Bar chart */}
        <div className="card dash-chart-card animate-slide-up">
          <div className="card-header">
            <div>
              <h3 className="card-title">Monthly Attendance</h3>
              <p className="card-subtitle">Present vs total recorded</p>
            </div>
            <div className="chart-badge"><MdBarChart /> Bar</div>
          </div>
          <div className="chart-wrap">
            {stats?.monthly?.length > 0
              ? <Bar data={barData} options={chartOpts('Employees')} />
              : <div className="empty-state"><div className="empty-state-icon">📊</div><p className="text-muted">No data yet</p></div>
            }
          </div>
        </div>

        {/* Line chart */}
        <div className="card dash-chart-card animate-slide-up">
          <div className="card-header">
            <div>
              <h3 className="card-title">Attendance Rate</h3>
              <p className="card-subtitle">Monthly trend (%)</p>
            </div>
            <div className="chart-badge chart-badge--purple"><MdTrendingUp /> Trend</div>
          </div>
          <div className="chart-wrap">
            <Line data={lineData} options={chartOpts('%')} />
          </div>
        </div>
      </div>

      {/* ── Bottom row: activity + quick actions ── */}
      <div className={`dash-bottom-row ${isEmployee ? 'dash-bottom-single' : ''}`}>

        {/* Recent activity */}
        {!isEmployee && (
          <div className="card dash-activity-card animate-slide-up">
            <div className="card-header">
              <div>
                <h3 className="card-title">Recent Activity</h3>
                <p className="card-subtitle">Latest login sessions</p>
              </div>
              <span className="activity-live"><span className="live-dot" /> Live</span>
            </div>
            <div className="activity-list">
              {stats?.recentLogins?.length > 0
                ? stats.recentLogins.map((log, i) => (
                    <ActivityItem
                      key={i}
                      name={log.full_name || log.username}
                      role={log.role}
                      status={log.status}
                      time={new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    />
                  ))
                : <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">No recent activity</p></div>
              }
            </div>
          </div>
        )}

        {/* Quick actions */}
        {!isEmployee && (
          <div className="card dash-actions-card animate-slide-up">
            <div className="card-header">
              <div>
                <h3 className="card-title">Quick Actions</h3>
                <p className="card-subtitle">Jump to key tasks</p>
              </div>
              <MdStar className="text-warning" style={{ fontSize: 20 }} />
            </div>
            <div className="quick-actions-grid">
              {isAdmin && (
                <QuickAction to="/users"      icon={<MdPersonAdd />}      label="Add User"         gradient="linear-gradient(135deg,#6366f1,#818cf8)" />
              )}
              {isAdmin && (
                <QuickAction to="/schools"    icon={<MdSchool />}         label="Add School"       gradient="linear-gradient(135deg,#10b981,#34d399)" />
              )}
              <QuickAction   to="/teachers"   icon={<MdPeople />}         label="Teachers"         gradient="linear-gradient(135deg,#06b6d4,#22d3ee)" />
              <QuickAction   to="/attendance" icon={<MdEventAvailable />} label="Attendance"       gradient="linear-gradient(135deg,#8b5cf6,#a78bfa)" />
              <QuickAction   to="/reports"    icon={<MdCheckCircle />}    label="Reports"          gradient="linear-gradient(135deg,#f59e0b,#fbbf24)" />
              {isAdmin && (
                <QuickAction to="/users"      icon={<MdSupervisorAccount />} label="Users"         gradient="linear-gradient(135deg,#ef4444,#f87171)" />
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;

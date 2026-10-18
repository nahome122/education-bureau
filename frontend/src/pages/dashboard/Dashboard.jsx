import React, { useCallback, useEffect, useState } from 'react';
import {
  MdSchool, MdPeople, MdGroups, MdEventAvailable, MdCheckCircle, MdCancel,
  MdVerifiedUser, MdPersonOff, MdChildCare, MdTrendingUp, MdRefresh, MdBarChart,
} from 'react-icons/md';
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
const DashboardStat = ({ icon, label, value, accent }) => (
  <div className="dashboard-stat">
    <span className={`dashboard-stat-icon ${accent ? 'dashboard-stat-icon--accent' : ''}`}>{icon}</span>
    <div>
      <dt className="dashboard-stat-label">{label}</dt>
      <dd className="dashboard-stat-value">{value ?? '—'}</dd>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════════════ */
const Dashboard = () => {
  const { user, isAdmin, isSchoolManager } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getDashboard();
      if (!data?.success) throw new Error(data?.message || 'Dashboard data is unavailable.');
      setStats(data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  /* ── Chart configs ─────────────────────────────────────── */
  const months = stats?.monthly?.map(m => m.month) || [];

  const barData = {
    labels: months,
    datasets: [
      {
        label: 'Present',
        data: stats?.monthly?.map(m => m.present) || [],
        backgroundColor: '#294B68',
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: 'Total',
        data: stats?.monthly?.map(m => m.total) || [],
        backgroundColor: 'rgba(217,119,36,0.62)',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const lineData = {
    labels: months,
    datasets: [
      {
        label: 'Attendance Rate %',
        data: stats?.monthly?.map(m =>
          m.total ? Math.round((m.present / m.total) * 100) : 0
        ) || [],
        borderColor: '#17324D',
        backgroundColor: 'rgba(23,50,77,0.10)',
        pointBackgroundColor: '#17324D',
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
      <div className="skeleton skeleton-title" />
      <div className="dashboard-loading-stats">
        {[...Array(6)].map((_, i) => <div key={i} className="dashboard-loading-stat"><div className="skeleton skeleton-text" /></div>)}
      </div>
    </div>
  );

  if (error) return (
    <div className="dashboard">
      <div className="page-header">
        <div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Wachale Woreda Education Bureau overview</p></div>
      </div>
      <div className="dashboard-error" role="alert">
        <p>{error}</p>
        <button className="btn btn-outline" onClick={loadDashboard}><MdRefresh /> Try again</button>
      </div>
    </div>
  );

  return (
    <div className="dashboard">

      {/* ── Hero banner ── */}
      <div className="dash-hero animate-slide-up">
        <div className="dash-hero-text">
          <h1>Education workforce overview</h1>
          <p>{user?.role_label}{isSchoolManager && stats?.school?.school_name ? ` · ${stats.school.school_name}` : ''}</p>
        </div>
        <div className="dash-hero-badges">
          <div className="hero-badge hero-badge--green">
            <MdCheckCircle /> {stats?.presentToday ?? '—'} Present Today
          </div>
          <div className="hero-badge hero-badge--red">
            <MdCancel /> {stats?.absentToday ?? '—'} Absent Today
          </div>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <dl className="dashboard-stats" aria-label="Education workforce statistics">
        <DashboardStat
          icon={<MdSchool />}          label="Total Schools"
          value={stats?.totalSchools}
        />
        <DashboardStat
          icon={<MdPeople />}          label="Total Teachers"
          value={stats?.totalTeachers}
        />
        <DashboardStat
          icon={<MdGroups />}          label="Total Staff"
          value={stats?.totalStaff}
        />
        <DashboardStat
          icon={<MdChildCare />}       label="Total Students"
          value={stats?.totalStudents}
        />
        <DashboardStat
          icon={<MdEventAvailable />}  label="Present Today"
          value={stats?.presentToday}
          accent
        />
        <DashboardStat
          icon={<MdCancel />}          label="Absent Today"
          value={stats?.absentToday}
        />
        {isAdmin && <>
          <DashboardStat
            icon={<MdVerifiedUser />}  label="Active Users"
            value={stats?.activeUsers}
          />
          <DashboardStat
            icon={<MdPersonOff />}     label="Inactive Users"
            value={stats?.inactiveUsers}
          />
        </>}
      </dl>

      {/* ── Charts row ── */}
      <div className="dash-charts-row">
        {/* Bar chart */}
        <section className="dash-chart-section animate-slide-up">
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
              : <div className="empty-state"><div className="empty-state-icon"><MdBarChart /></div><p className="text-muted">No attendance data recorded for this period.</p></div>
            }
          </div>
        </section>

        {/* Line chart */}
        <section className="dash-chart-section animate-slide-up">
          <div className="card-header">
            <div>
              <h3 className="card-title">Attendance Rate</h3>
              <p className="card-subtitle">Monthly trend (%)</p>
            </div>
            <div className="chart-badge chart-badge--purple"><MdTrendingUp /> Trend</div>
          </div>
          <div className="chart-wrap">
            {stats?.monthly?.length > 0
              ? <Line data={lineData} options={chartOpts('%')} />
              : <div className="empty-state"><div className="empty-state-icon"><MdTrendingUp /></div><p className="text-muted">No attendance data recorded for this period.</p></div>
            }
          </div>
        </section>
      </div>

    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import { MdDownload, MdRefresh, MdBarChart, MdTableChart } from 'react-icons/md';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { getReportsDashboard } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import './Reports.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const Reports = () => {
  const { isAdmin } = useAuth();
  const [dash,    setDash]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [from,    setFrom]    = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);

  const fetchDash = async () => {
    try {
      const { data } = await getReportsDashboard();
      if (data.success) setDash(data.data);
    } catch (err) { /* falls back via apiCall */ }
  };

  useEffect(() => {
    fetchDash().finally(() => setLoading(false));
  }, []);

  const handleFilter = () => { setLoading(true); fetchDash().finally(() => setLoading(false)); };

  const monthlyChart = {
    labels: dash?.monthly?.map(m => m.month) || [],
    datasets: [
      { label: 'Present', data: dash?.monthly?.map(m => m.present) || [], backgroundColor: 'rgba(37,99,235,0.75)', borderRadius: 5 },
      { label: 'Total',   data: dash?.monthly?.map(m => m.total)   || [], backgroundColor: 'rgba(16,185,129,0.45)', borderRadius: 5 },
    ],
  };

  const doughnutData = dash ? {
    labels: ['Active Users', 'Inactive Users'],
    datasets: [{ data: [dash.activeUsers, dash.inactiveUsers], backgroundColor: ['#22C55E', '#EF4444'], borderWidth: 0 }],
  } : null;

  return (
    <div className="reports-page">
      <div className="page-header">
        <div><h1 className="page-title">Reports</h1><p className="page-subtitle">Analytics and attendance summaries</p></div>
      </div>

      {/* Filters */}
      <div className="card mb-lg">
        <div className="report-filters">
          <div className="form-group"><label className="form-label">From</label><input type="date" className="form-control" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">To</label><input type="date" className="form-control" value={to} onChange={e => setTo(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={handleFilter}><MdRefresh /> Apply</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid-4 mb-lg">
        {[
          { label: 'Total Schools',  value: dash?.totalSchools,  color: '#2563EB' },
          { label: 'Total Teachers', value: dash?.totalTeachers, color: '#10B981' },
          { label: 'Total Staff',    value: dash?.totalStaff,    color: '#F59E0B' },
          { label: 'Present Today',  value: dash?.presentToday,  color: '#22C55E' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ '--card-accent': `linear-gradient(135deg, ${s.color}, ${s.color}88)` }}>
            <div className="stat-card-body">
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-value">{loading ? '—' : s.value ?? 0}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2 mb-lg">
        <div className="card">
          <h3 className="card-title mb-lg"><MdBarChart /> Monthly Attendance</h3>
          <div style={{ height: 280 }}>
            {dash?.monthly?.length > 0
              ? <Bar data={monthlyChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
              : <div className="empty-state" style={{ padding: '3rem' }}><p className="text-muted">No data available</p></div>
            }
          </div>
        </div>
        <div className="card">
          <h3 className="card-title mb-lg">User Status</h3>
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {doughnutData
              ? <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
              : <div className="empty-state"><p className="text-muted">No data</p></div>
            }
          </div>
        </div>
      </div>

      {/* Recent Logins */}
      {isAdmin && (
        <div className="card">
          <h3 className="card-title mb-lg"><MdTableChart /> Recent Login Activity</h3>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>User</th><th>Role</th><th>IP</th><th>Status</th><th>Time</th></tr></thead>
              <tbody>
                {loading ? [...Array(5)].map((_, i) => <tr key={i}>{[...Array(5)].map((_, j) => <td key={j}><div className="skeleton skeleton-text" /></td>)}</tr>)
                : (dash?.recentLogins || []).map((l, i) => (
                  <tr key={i}>
                    <td><div className="user-cell"><div className="avatar">{(l.full_name || l.username || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div><span>{l.full_name || l.username}</span></div></td>
                    <td>{l.role || '—'}</td>
                    <td className="text-muted">{l.ip_address}</td>
                    <td><span className={`badge ${l.status === 'success' ? 'badge-success' : 'badge-danger'}`}>{l.status}</span></td>
                    <td className="text-muted text-xs">{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default Reports;

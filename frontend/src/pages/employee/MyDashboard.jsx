import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  MdEventNote, MdPerson, MdSettings, MdCheckCircle, MdCancel,
  MdAccessTime, MdBeachAccess, MdTrendingUp, MdSchool, MdBadge,
} from 'react-icons/md';
import { getMyAttendance } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import './MyDashboard.css';

const statusIcon = { Present: <MdCheckCircle />, Absent: <MdCancel />, Late: <MdAccessTime />, 'On Leave': <MdBeachAccess /> };
const statusColor = { Present: 'badge-success', Absent: 'badge-danger', Late: 'badge-warning', 'On Leave': 'badge-info' };

const MyDashboard = () => {
  const { user } = useAuth();
  const [attData, setAttData] = useState(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await getMyAttendance(user, { month });
        if (data.success) setAttData(data);
      } catch { /* silent */ }
      setLoading(false);
    };
    fetch();
  }, [user, month]);

  const todayRecord = attData?.data?.find(r => r.date === today);
  const summary     = attData?.summary || { Present: 0, Absent: 0, Late: 0, 'On Leave': 0 };
  const rate        = attData?.rate || 0;
  const totalMarked = Object.values(summary).reduce((a, b) => a + b, 0);

  const getInitials = (name = '') =>
    name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U';

  const monthName = new Date(month + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="my-dashboard">

      {/* ── Welcome card ── */}
      <div className="my-welcome-card animate-slide-up">
        <div className="my-welcome-avatar">{getInitials(user?.full_name)}</div>
        <div className="my-welcome-info">
          <h1 className="my-welcome-name">Welcome, {(user?.full_name || 'Employee').split(' ')[0]}!</h1>
          <div className="my-welcome-meta">
            <span><MdBadge /> {user?.emp_code || '—'}</span>
            <span><MdSchool /> {user?.school_name || 'Wachale Woreda'}</span>
            <span className={`badge ${user?.role_name === 'Teacher' ? 'badge-primary' : 'badge-warning'}`}>
              {user?.role_name}
            </span>
          </div>
        </div>
        <div className="my-welcome-date">
          <span className="my-welcome-today-label">Today</span>
          <span className="my-welcome-today-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ── Today's attendance ── */}
      <div className="my-section-title">Today's Status</div>
      <div className="my-today-card animate-slide-up">
        {loading ? (
          <div className="my-today-loading"><span className="spinner" /></div>
        ) : todayRecord?.status ? (
          <div className="my-today-content">
            <div className={`my-today-icon my-today-icon--${todayRecord.status.toLowerCase().replace(' ', '-')}`}>
              {statusIcon[todayRecord.status]}
            </div>
            <div>
              <div className="my-today-status-label">
                <span className={`badge badge-lg ${statusColor[todayRecord.status]}`}>
                  <span className="badge-dot" />{todayRecord.status}
                </span>
              </div>
              <div className="my-today-times">
                {todayRecord.check_in  && <span>Check-in: <strong>{new Date(todayRecord.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</strong></span>}
                {todayRecord.check_out && <span>Check-out: <strong>{new Date(todayRecord.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</strong></span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="my-today-content">
            <div className="my-today-icon my-today-icon--pending">—</div>
            <div>
              <div className="my-today-status-label"><span className="badge badge-gray">Not Yet Marked</span></div>
              <div className="my-today-note">Your attendance for today hasn't been recorded yet.</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Monthly summary ── */}
      <div className="my-section-title">{monthName} Summary</div>
      <div className="my-summary-grid">
        {[
          { label: 'Present',   val: summary.Present,    color: '#10b981' },
          { label: 'Absent',    val: summary.Absent,     color: '#ef4444' },
          { label: 'Late',      val: summary.Late,       color: '#f59e0b' },
          { label: 'On Leave',  val: summary['On Leave'],color: '#3b82f6' },
        ].map(item => (
          <div key={item.label} className="my-summary-card animate-slide-up" style={{ '--acc': item.color }}>
            <div className="my-summary-val" style={{ color: item.color }}>{item.val}</div>
            <div className="my-summary-label">{item.label}</div>
          </div>
        ))}
      </div>

      {/* ── Attendance rate bar ── */}
      <div className="my-rate-card animate-slide-up">
        <div className="my-rate-header">
          <span><MdTrendingUp /> Attendance Rate — {monthName}</span>
          <strong style={{ color: rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444' }}>{rate}%</strong>
        </div>
        <div className="my-rate-bar">
          <div className="my-rate-fill" style={{ width: `${rate}%`, background: rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444' }} />
        </div>
        <div className="my-rate-note">{totalMarked} day(s) recorded out of working days this month.</div>
      </div>

      {/* ── Quick links ── */}
      <div className="my-section-title">Quick Links</div>
      <div className="my-quick-links">
        <NavLink to="/my/attendance" className="my-quick-card">
          <MdEventNote />
          <span>View Full Attendance</span>
        </NavLink>
        <NavLink to="/my/profile" className="my-quick-card">
          <MdPerson />
          <span>Edit My Profile</span>
        </NavLink>
        <NavLink to="/my/settings" className="my-quick-card">
          <MdSettings />
          <span>Account Settings</span>
        </NavLink>
      </div>
    </div>
  );
};

export default MyDashboard;

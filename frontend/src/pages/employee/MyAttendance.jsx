import React, { useState, useEffect, useCallback } from 'react';
import { MdChevronLeft, MdChevronRight, MdCalendarToday, MdCheckCircle, MdCancel, MdAccessTime, MdBeachAccess } from 'react-icons/md';
import { getMyAttendance } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import './MyAttendance.css';

const STATUS_COLORS = {
  Present:   { bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  Absent:    { bg: '#fee2e2', color: '#7f1d1d', dot: '#ef4444' },
  Late:      { bg: '#fef3c7', color: '#78350f', dot: '#f59e0b' },
  'On Leave':{ bg: '#dbeafe', color: '#1e3a8a', dot: '#3b82f6' },
};
const STATUS_ICON = {
  Present:   <MdCheckCircle />,
  Absent:    <MdCancel />,
  Late:      <MdAccessTime />,
  'On Leave':<MdBeachAccess />,
};

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const MyAttendance = () => {
  const { user } = useAuth();

  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed

  const [attData, setAttData] = useState(null);
  const [loading, setLoading] = useState(true);

  const monthStr = `${year}-${String(month).padStart(2,'0')}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getMyAttendance(user, { month: monthStr });
      if (data.success) setAttData(data);
    } catch { /* silent */ }
    setLoading(false);
  }, [user, monthStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const today = new Date();
    if (year === today.getFullYear() && month === today.getMonth() + 1) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Build calendar grid
  const buildCalendar = () => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const cells   = buildCalendar();
  const records = attData?.data || [];
  const summary = attData?.summary || { Present: 0, Absent: 0, Late: 0, 'On Leave': 0 };
  const rate    = attData?.rate || 0;

  const getRecord = (day) => {
    if (!day) return null;
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return records.find(r => r.date === dateStr) || null;
  };

  const today = new Date().toISOString().split('T')[0];
  const isToday = (day) => {
    if (!day) return false;
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return dateStr === today;
  };
  const isFuture = (day) => {
    if (!day) return false;
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return dateStr > today;
  };

  return (
    <div className="my-attendance">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Attendance</h1>
          <p className="page-subtitle">{user?.full_name} · {user?.school_name}</p>
        </div>
      </div>

      {/* ── Month nav ── */}
      <div className="card mb-lg">
        <div className="month-nav">
          <button className="btn btn-ghost btn-icon" onClick={prevMonth}><MdChevronLeft /></button>
          <span className="month-nav-label">
            <MdCalendarToday /> {MONTHS[month - 1]} {year}
          </span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={nextMonth}
            disabled={year === now.getFullYear() && month === now.getMonth() + 1}
          >
            <MdChevronRight />
          </button>
        </div>
      </div>

      <div className="my-att-layout">
        {/* ── Calendar ── */}
        <div className="card my-calendar-card">
          <div className="cal-grid-header">
            {DAYS.map(d => <div key={d} className="cal-day-name">{d}</div>)}
          </div>
          {loading ? (
            <div className="cal-loading"><span className="spinner" /></div>
          ) : (
            <div className="cal-grid">
              {cells.map((day, idx) => {
                const rec = getRecord(day);
                const style = rec?.status ? STATUS_COLORS[rec.status] : null;
                return (
                  <div
                    key={idx}
                    className={`cal-cell ${!day ? 'cal-cell--empty' : ''} ${isToday(day) ? 'cal-cell--today' : ''} ${isFuture(day) ? 'cal-cell--future' : ''}`}
                    style={style ? { background: style.bg, color: style.color } : {}}
                    title={rec?.status || (day ? 'Not marked' : '')}
                  >
                    {day && (
                      <>
                        <span className="cal-day-num">{day}</span>
                        {rec?.status && (
                          <span className="cal-status-dot" style={{ background: style.dot }} />
                        )}
                        {rec?.status && (
                          <span className="cal-status-icon">{STATUS_ICON[rec.status]}</span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Legend */}
          <div className="cal-legend">
            {Object.entries(STATUS_COLORS).map(([s, c]) => (
              <div key={s} className="cal-legend-item">
                <span className="cal-legend-dot" style={{ background: c.dot }} />
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel: summary + table ── */}
        <div className="my-att-right">
          {/* Summary */}
          <div className="card mb-lg">
            <div className="my-att-summary-title">Monthly Summary</div>
            <div className="my-att-summary-grid">
              {Object.entries(summary).map(([s, v]) => {
                const c = STATUS_COLORS[s];
                return (
                  <div key={s} className="my-att-stat" style={{ borderLeftColor: c?.dot }}>
                    <span className="my-att-stat-val">{v}</span>
                    <span className="my-att-stat-label">{s}</span>
                  </div>
                );
              })}
            </div>
            <div className="my-att-rate-row">
              <span>Attendance Rate</span>
              <strong style={{ color: rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444' }}>{rate}%</strong>
            </div>
            <div className="my-rate-bar" style={{ marginTop: 8 }}>
              <div className="my-rate-fill" style={{ width: `${rate}%`, background: rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? [...Array(5)].map((_, i) => <tr key={i}>{[...Array(4)].map((_, j) => <td key={j}><div className="skeleton skeleton-text" /></td>)}</tr>)
                    : records.filter(r => r.status).length === 0
                      ? <tr><td colSpan={4}><div className="empty-state"><div className="empty-state-icon"><MdCalendarToday /></div><p className="empty-state-title">No records this month</p></div></td></tr>
                      : records.filter(r => r.status).map(r => {
                          const c = STATUS_COLORS[r.status] || {};
                          return (
                            <tr key={r.date}>
                              <td>
                                {new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                {r.date === today && <span className="badge badge-primary" style={{ marginLeft: 6, fontSize: 10 }}>Today</span>}
                              </td>
                              <td>
                                <span className="badge" style={{ background: c.bg, color: c.color }}>
                                  {STATUS_ICON[r.status]}&nbsp;{r.status}
                                </span>
                              </td>
                              <td className="text-muted text-sm">
                                {r.check_in ? new Date(r.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="text-muted text-sm">
                                {r.check_out ? new Date(r.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                            </tr>
                          );
                        })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyAttendance;

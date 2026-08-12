import React, { useState, useEffect, useCallback } from 'react';
import { MdSave, MdRefresh, MdSchool, MdCalendarToday } from 'react-icons/md';
import toast from 'react-hot-toast';
import { getAttendance, markAttendance, getSchools } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import './Attendance.css';

const STATUSES = ['Present', 'Absent', 'Late', 'On Leave'];

const STATUS_COLORS = {
  'Present':  'att-present',
  'Absent':   'att-absent',
  'Late':     'att-late',
  'On Leave': 'att-on-leave',
};

const Attendance = () => {
  const { isEmployee, user } = useAuth();

  // Only AttendanceOfficer, SchoolManager, Admin can mark attendance
  const canMark = !isEmployee;

  const [date,      setDate]      = useState(new Date().toISOString().split('T')[0]);
  const [type,      setType]      = useState(() => {
    // Default type to match the employee's own type
    if (user?.emp_type) return user.emp_type;
    return 'teacher';
  });
  const [schoolId,  setSchoolId]  = useState('');
  const [schools,   setSchools]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [records,   setRecords]   = useState({});
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  
  // Employee view specific state
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [allAttendance, setAllAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Load schools (not needed for employee view, but harmless)
  useEffect(() => {
    if (!isEmployee) {
      getSchools({ limit: 100 })
        .then(({ data }) => { if (data.success) setSchools(data.data); })
        .catch(() => {});
    }
  }, [isEmployee]);

  // Fetch attendance — employee only sees their own row
  const fetchEmployees = useCallback(async (overrides = {}) => {
    const params = {
      date,
      type,
      school_id: schoolId,
      limit: 200,
      ...overrides,
    };

    // Employee: restrict to own record only
    if (isEmployee && user?.emp_id) {
      params._emp_id = user.emp_id;      // numeric id filter
    }

    setLoading(true);
    try {
      const { data } = await getAttendance(params);
      if (data.success) {
        // Employee: filter client-side to own row as extra safety
        const rows = isEmployee
          ? data.data.filter(e => e.id === user.emp_id)
          : data.data;

        setEmployees(rows);
        const init = {};
        rows.forEach(e => { init[e.id] = e.att_status || null; });
        setRecords(init);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load attendance.');
    }
    setLoading(false);
  }, [date, type, schoolId, isEmployee, user]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleSchoolChange = (e) => {
    const val = e.target.value;
    setSchoolId(val);
    fetchEmployees({ school_id: val, date, type });
  };

  const handleTypeChange = (e) => {
    const val = e.target.value;
    setType(val);
    fetchEmployees({ type: val, date, school_id: schoolId });
  };

  const handleDateChange = (e) => {
    const val = e.target.value;
    setDate(val);
    fetchEmployees({ date: val, type, school_id: schoolId });
  };

  // Fetch all attendance records for employee for a given month
  const fetchAllMonthAttendance = useCallback(async (monthYearStr) => {
    if (!isEmployee || !user?.emp_id) return;
    
    setAttendanceLoading(true);
    try {
      // Get all days in the month
      const [year, month] = monthYearStr.split('-');
      const firstDay = new Date(year, parseInt(month) - 1, 1);
      const lastDay = new Date(year, parseInt(month), 0);
      const daysInMonth = lastDay.getDate();
      
      // Fetch data for several key dates in the month (approximation)
      // In production, you'd have a dedicated API endpoint
      const records = [];
      const promises = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
        promises.push(
          getAttendance({ date: dateStr, type: user.emp_type, limit: 1000 })
            .then(({ data }) => {
              if (data.success && data.data) {
                const myRec = data.data.find(r => r.id === user.emp_id);
                if (myRec) {
                  records.push(myRec);
                }
              }
            })
            .catch(() => {})
        );
      }
      
      await Promise.all(promises);
      setAllAttendance(records);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    }
    setAttendanceLoading(false);
  }, [isEmployee, user]);

  useEffect(() => {
    if (isEmployee) {
      fetchAllMonthAttendance(monthYear);
    }
  }, [isEmployee, monthYear, fetchAllMonthAttendance]);

  const setStatus = (id, status) => {
    if (!canMark) return;   // employees cannot change status
    setRecords(r => ({ ...r, [id]: status }));
  };

  const handleMarkAll = (status) => {
    if (!canMark) return;
    const all = {};
    employees.forEach(e => { all[e.id] = status; });
    setRecords(all);
  };

  const handleSave = async () => {
    if (!canMark || employees.length === 0) return;
    setSaving(true);
    try {
      const recs = employees.map(e => ({
        employee_id: e.id,
        status:      records[e.id] || 'Present',
      }));
      await markAttendance({ date, employee_type: type, records: recs });
      toast.success(`Attendance saved for ${recs.length} ${type}${recs.length !== 1 ? 's' : ''}.`);
      // Refresh the data to show updated attendance
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save attendance.');
    }
    setSaving(false);
  };

  // Summary counts
  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = Object.values(records).filter(v => v === s).length;
    return acc;
  }, {});

  const selectedSchool = schools.find(s => String(s.id) === String(schoolId));

  // ── Employee view — all attendance records ─────────────────────────────
  if (isEmployee) {
    const [year, month] = monthYear.split('-');
    const daysInMonth = new Date(year, parseInt(month), 0).getDate();
    const monthName = new Date(year, parseInt(month) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    // Calculate stats
    const stats = {
      'Present': 0,
      'Absent': 0,
      'Late': 0,
      'On Leave': 0,
      'Not Marked': 0,
    };
    
    const recordsByDay = {};
    allAttendance.forEach(rec => {
      if (rec.date) {
        recordsByDay[rec.date] = rec;
        const status = rec.att_status || 'Not Marked';
        stats[status] = (stats[status] || 0) + 1;
      }
    });

    return (
      <div className="attendance-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Attendance</h1>
            <p className="page-subtitle">View all your attendance records</p>
          </div>
          <div className="header-actions">
            <input
              type="month"
              className="form-control"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
              style={{ width: 160 }}
            />
            <button className="btn btn-ghost btn-icon" onClick={() => fetchAllMonthAttendance(monthYear)} title="Refresh">
              <MdRefresh />
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
          {Object.entries(stats).map(([status, count]) => {
            const colorMap = {
              'Present': '#10B981',
              'Absent': '#EF4444',
              'Late': '#F59E0B',
              'On Leave': '#8B5CF6',
              'Not Marked': '#95A3B3',
            };
            return (
              <div key={status} className="stat-card" style={{ '--card-accent': `linear-gradient(135deg, ${colorMap[status]}, ${colorMap[status]}88)` }}>
                <div className="stat-card-body">
                  <div className="stat-card-label">{status}</div>
                  <div className="stat-card-value">{attendanceLoading ? '—' : count}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Attendance Records Table */}
        <div className="card">
          <h3 className="card-title mb-lg">Attendance Records — {monthName}</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 100 }}>Date</th>
                  <th style={{ minWidth: 120 }}>Day</th>
                  <th style={{ minWidth: 100 }}>Status</th>
                  <th style={{ minWidth: 120 }}>Check In</th>
                  <th style={{ minWidth: 120 }}>Check Out</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLoading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Loading attendance data...</td>
                  </tr>
                ) : daysInMonth === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Invalid month selected</td>
                  </tr>
                ) : (
                  [...Array(daysInMonth)].map((_, idx) => {
                    const day = idx + 1;
                    const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
                    const record = recordsByDay[dateStr];
                    const dayName = new Date(year, parseInt(month) - 1, day).toLocaleDateString('en-GB', { weekday: 'short' });
                    const status = record?.att_status || 'Not Marked';
                    const statusColorMap = {
                      'Present': 'att-present',
                      'Absent': 'att-absent',
                      'Late': 'att-late',
                      'On Leave': 'att-on-leave',
                      'Not Marked': 'att-not-marked',
                    };

                    return (
                      <tr key={dateStr}>
                        <td><strong>{dateStr}</strong></td>
                        <td>{dayName}</td>
                        <td>
                          <span className={`att-badge ${statusColorMap[status] || 'att-not-marked'}`}>
                            {status}
                          </span>
                        </td>
                        <td>{record?.check_in ? new Date(record.check_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td>{record?.check_out ? new Date(record.check_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className="text-muted">{record?.note || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-muted text-sm" style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
            Attendance is marked by your school's Attendance Officer or Administrator.
          </p>
        </div>
      </div>
    );
  }

  // ── Admin / Officer / Manager view — full marking interface ─────────────
  return (
    <div className="attendance-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mark Attendance</h1>
          <p className="page-subtitle">
            Record daily attendance
            {selectedSchool ? ` — ${selectedSchool.name}` : ' — All Schools'}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || employees.length === 0}
        >
          {saving ? <span className="spinner-sm" /> : <><MdSave /> Save Attendance</>}
        </button>
      </div>

      {/* Controls */}
      <div className="card mb-lg">
        <div className="att-controls">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-control" value={date} onChange={handleDateChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Employee Type</label>
            <select className="form-control" value={type} onChange={handleTypeChange}>
              <option value="teacher">👩‍🏫 Teachers</option>
              <option value="staff">👷 Staff</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 220 }}>
            <label className="form-label">Filter by School</label>
            <select className="form-control" value={schoolId} onChange={handleSchoolChange}>
              <option value="">All Schools</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={() => fetchEmployees()} title="Refresh" style={{ marginTop: 22 }}>
            <MdRefresh />
          </button>
        </div>
      </div>

      {/* Summary */}
      {employees.length > 0 && (
        <div className="att-summary mb-lg">
          <div className="att-stat present"><span>{counts['Present']}</span> Present</div>
          <div className="att-stat absent"><span>{counts['Absent']}</span> Absent</div>
          <div className="att-stat late"><span>{counts['Late']}</span> Late</div>
          <div className="att-stat on-leave"><span>{counts['On Leave']}</span> On Leave</div>
          <div className="att-stat total"><span>{employees.length}</span> Total</div>
          <div className="att-mark-all">
            <span className="text-muted">Mark all:</span>
            {STATUSES.map(s => (
              <button key={s} className={`att-bulk-btn att-bulk-${s.toLowerCase().replace(' ', '-')}`} onClick={() => handleMarkAll(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Employee list */}
      <div className="card">
        {loading ? (
          <div className="att-loading">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="att-skeleton-row">
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}><div className="skeleton skeleton-text" style={{ width: '50%' }} /></div>
                <div className="skeleton" style={{ width: 260, height: 36, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{type === 'teacher' ? '👩‍🏫' : '👷'}</div>
            <p className="empty-state-title">No active {type}s found{selectedSchool ? ` in ${selectedSchool.name}` : ''}</p>
          </div>
        ) : (
          <div className="att-list">
            <div className="att-list-header">
              <span style={{ flex: 2 }}>Name</span>
              <span style={{ flex: 2 }}>Position · School</span>
              <span style={{ flex: 3 }}>Attendance Status</span>
            </div>
            {employees.map(emp => (
              <div key={emp.id} className="att-row">
                <div className="att-emp-info" style={{ flex: 2 }}>
                  <div className={`avatar att-avatar att-avatar-${(records[emp.id] || 'present').toLowerCase().replace(' ', '-')}`}>
                    {emp.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{emp.name}</div>
                    <div className="text-muted text-xs">{emp.emp_id}</div>
                  </div>
                </div>
                <div className="att-emp-meta" style={{ flex: 2 }}>
                  <span className="text-sm">{emp.position || '—'}</span>
                  <span className="text-muted text-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MdSchool style={{ fontSize: 12 }} />{emp.school_name || '—'}
                  </span>
                </div>
                <div className="att-status-btns" style={{ flex: 3 }}>
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      className={`att-status-btn ${STATUS_COLORS[s]} ${records[emp.id] === s ? 'selected' : ''}`}
                      onClick={() => setStatus(emp.id, s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Attendance;

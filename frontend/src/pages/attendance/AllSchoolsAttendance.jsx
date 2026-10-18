import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MdCalendarToday, MdDownload, MdEventNote, MdPrint, MdRefresh,
  MdSearch, MdSchool, MdVisibility,
} from 'react-icons/md';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import { getAllSchoolsAttendance, getSchools } from '../../utils/apiCall';
import './AllSchoolsAttendance.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dateOffset = (value, offset) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const emptyReport = {
  totals: { schools: 0, teachers: 0, present: 0, absent: 0, late: 0, on_leave: 0, attendance_percentage: null },
  schools: [],
  trend: [],
  details: { data: [], total: 0, page: 1, limit: 100 },
};
const STATUS_LABELS = {
  Present: 'Present',
  Absent: 'Absent',
  Late: 'Late',
  'On Leave': 'On Leave',
  Holiday: 'Holiday',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);
  return new Date(`${date}T00:00:00`).toLocaleDateString();
};

const formatTime = (value) => {
  if (!value) return '—';
  if (typeof value === 'string') return value.slice(0, 5);
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const csvValue = (value) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

const AllSchoolsAttendance = () => {
  const [filters, setFilters] = useState({ start_date: today(), end_date: today(), school_id: '', search: '', teacher_code: '', status: '' });
  const [period, setPeriod] = useState('daily');
  const [applied, setApplied] = useState({ start_date: today(), end_date: today(), page: 1, limit: 100 });
  const [report, setReport] = useState(emptyReport);
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [schoolOptionsError, setSchoolOptionsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [isMock, setIsMock] = useState(false);
  const detailsRef = useRef(null);

  useEffect(() => {
    let active = true;
    getSchools({ limit: 1000 })
      .then(({ data }) => {
        if (!data.success) throw new Error(data.message || 'Could not load schools.');
        if (active) setSchoolOptions(data.data);
      })
      .catch((err) => {
        const message = err.response?.data?.message || err.message || 'Could not load schools.';
        if (active) {
          setSchoolOptionsError(message);
          toast.error(message);
        }
      });
    return () => { active = false; };
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAllSchoolsAttendance(applied);
      if (!data.success) throw new Error(data.message || 'Could not load school attendance.');
      setReport(data);
      setIsMock(Boolean(data.isMock));
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Could not load school attendance.';
      setReport(emptyReport);
      setIsMock(false);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const applyFilters = (event) => {
    event.preventDefault();
    if (!filters.start_date || !filters.end_date || filters.start_date > filters.end_date) {
      toast.error('Choose a valid date range.');
      return;
    }
    setApplied({
      start_date: filters.start_date,
      end_date: filters.end_date,
      ...(filters.school_id && { school_id: filters.school_id }),
      ...(filters.search && { search: filters.search.trim() }),
      ...(filters.teacher_code && { teacher_code: filters.teacher_code.trim() }),
      ...(filters.status && { status: filters.status }),
      page: 1,
      limit: 100,
    });
  };

  const setReportPeriod = (value) => {
    setPeriod(value);
    if (value === 'custom') return;
    const endDate = filters.end_date || today();
    const startDate = value === 'weekly'
      ? dateOffset(endDate, -6)
      : value === 'monthly'
        ? `${endDate.slice(0, 7)}-01`
        : endDate;
    setFilters(current => ({ ...current, start_date: startDate, end_date: endDate }));
  };

  const viewSchool = (schoolId) => {
    setFilters(current => ({ ...current, school_id: String(schoolId) }));
    setApplied(current => ({ ...current, school_id: String(schoolId), page: 1 }));
    detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const changePage = (page) => setApplied(current => ({ ...current, page }));

  const comparisonChart = useMemo(() => ({
    labels: report.schools.map(school => school.school_name),
    datasets: [{
      label: 'Attendance rate',
      data: report.schools.map(school => school.attendance_percentage),
      backgroundColor: '#10b981bb',
      borderColor: '#059669',
      borderWidth: 1,
      borderRadius: 5,
    }],
  }), [report.schools]);

  const trendChart = useMemo(() => ({
    labels: report.trend.map(item => formatDate(item.date)),
    datasets: [
      { label: 'Present', data: report.trend.map(item => item.present), borderColor: '#10b981', backgroundColor: '#10b98122', tension: 0.25 },
      { label: 'Absent', data: report.trend.map(item => item.absent), borderColor: '#ef4444', backgroundColor: '#ef444422', tension: 0.25 },
      { label: 'Late', data: report.trend.map(item => item.late), borderColor: '#f59e0b', backgroundColor: '#f59e0b22', tension: 0.25 },
      { label: 'On Leave', data: report.trend.map(item => item.on_leave), borderColor: '#8b5cf6', backgroundColor: '#8b5cf622', tension: 0.25 },
    ],
  }), [report.trend]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await getAllSchoolsAttendance({ ...applied, page: 1, limit: 5000 });
      if (data.details.total > data.details.data.length) {
        toast.error('This report exceeds the 5,000-row export limit. Narrow the date range or filters.');
        return;
      }
      const columns = [
        ['Teacher ID', 'teacher_code'],
        ['Teacher Name', 'teacher_name'],
        ['School', 'school_name'],
        ['Date', 'attendance_date'],
        ['Status', 'status'],
        ['Check-in', 'check_in'],
        ['Check-out', 'check_out'],
        ['Recorded by', 'recorded_by'],
        ['Remarks', 'remarks'],
      ];
      const lines = [
        columns.map(([label]) => csvValue(label)).join(','),
        ...data.details.data.map(row => columns.map(([, key]) => csvValue(row[key])).join(',')),
      ];
      const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `all_schools_attendance_${applied.start_date}_${applied.end_date}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Filtered attendance details exported.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not export attendance report.');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(report.details.total / report.details.limit));
  const totals = report.totals;
  const summaryCards = [
    ['Registered schools', totals.schools, 'schools'],
    ['Active teachers', totals.teachers, 'teachers'],
    ['Present', totals.present, 'present'],
    ['Absent', totals.absent, 'absent'],
    ['Late', totals.late, 'late'],
    ['On Leave', totals.on_leave, 'leave'],
    ['Attendance rate', totals.attendance_percentage == null ? '—' : `${totals.attendance_percentage}%`, 'rate'],
  ];

  return (
    <div className="all-attendance-page">
      <div className="page-header all-attendance-header">
        <div>
          <h1 className="page-title"><MdEventNote /> Attendance Overview</h1>
          <p className="page-subtitle">Monitor teacher attendance across the Woreda using recorded attendance data.</p>
        </div>
        <div className="all-attendance-actions">
          <button className="btn btn-secondary" type="button" onClick={loadReport} disabled={loading}>
            <MdRefresh /> Refresh
          </button>
          <button className="btn btn-secondary" type="button" onClick={exportCsv} disabled={loading || exporting || report.details.total === 0}>
            <MdDownload /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => window.print()}>
            <MdPrint /> Print
          </button>
        </div>
      </div>

      <form className="all-attendance-filters" onSubmit={applyFilters}>
        <div className="form-group">
          <label className="form-label" htmlFor="attendance-period">Report period</label>
          <select id="attendance-period" className="form-control" value={period} onChange={event => setReportPeriod(event.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="attendance-start">From</label>
          <input id="attendance-start" className="form-control" type="date" value={filters.start_date} onChange={event => { setPeriod('custom'); setFilters(current => ({ ...current, start_date: event.target.value })); }} required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="attendance-end">To</label>
          <input id="attendance-end" className="form-control" type="date" value={filters.end_date} onChange={event => { setPeriod('custom'); setFilters(current => ({ ...current, end_date: event.target.value })); }} required />
        </div>
        <div className="form-group all-attendance-school-filter">
          <label className="form-label" htmlFor="attendance-school">School</label>
          <select id="attendance-school" className="form-control" value={filters.school_id} onChange={event => setFilters(current => ({ ...current, school_id: event.target.value }))}>
            <option value="">All schools</option>
            {schoolOptions.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
          {schoolOptionsError && <span className="all-attendance-filter-error">{schoolOptionsError}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="attendance-search">Teacher search</label>
          <div className="search-input-wrap">
            <MdSearch className="search-icon" />
            <input id="attendance-search" className="form-control" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Name or teacher ID" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="attendance-teacher-code">Teacher ID (exact)</label>
          <input id="attendance-teacher-code" className="form-control" maxLength="20" value={filters.teacher_code} onChange={event => setFilters(current => ({ ...current, teacher_code: event.target.value }))} placeholder="Any teacher" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="attendance-status">Status</label>
          <select id="attendance-status" className="form-control" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary all-attendance-apply" type="submit"><MdCalendarToday /> Apply filters</button>
      </form>

      {isMock && (
        <div className="all-attendance-demo-notice" role="status">
          The backend is offline. This is offline demo mode: values come only from school, teacher, and attendance data stored in this browser. Start the backend and MySQL to view live database reports.
        </div>
      )}

      {error && <div className="all-attendance-error" role="alert">{error}</div>}

      <section className="all-attendance-stats" aria-label="Attendance summary">
        {summaryCards.map(([label, value, tone]) => (
          <div className={`all-attendance-stat all-attendance-stat--${tone}`} key={label}>
            <span>{label}</span>
            <strong>{loading ? '—' : value}</strong>
          </div>
        ))}
      </section>

      <section className="all-attendance-charts">
        <section className="all-attendance-chart">
          <h2><MdSchool /> School comparison</h2>
          {loading ? <div className="all-attendance-empty">Loading school comparison…</div> : report.schools.length ? (
            <div className="all-attendance-chart-canvas"><Bar data={comparisonChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: value => `${value}%` } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.raw}%` } } } }} /></div>
          ) : <div className="all-attendance-empty">No schools found for this selection.</div>}
        </section>
        <section className="all-attendance-chart">
          <h2><MdCalendarToday /> Attendance trend</h2>
          {loading ? <div className="all-attendance-empty">Loading trend…</div> : report.trend.length ? (
            <div className="all-attendance-chart-canvas"><Line data={trendChart} options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div>
          ) : <div className="all-attendance-empty">No attendance records in this date range.</div>}
        </section>
      </section>

      <section className="all-attendance-school-table">
        <div className="all-attendance-section-heading">
          <div><h2>Attendance by school</h2><p>School counts are teacher-day records over the selected dates. Record coverage refers to the end date.</p></div>
          {filters.school_id && <button className="btn btn-ghost" type="button" onClick={() => { setFilters(current => ({ ...current, school_id: '' })); setApplied(current => { const next = { ...current, page: 1 }; delete next.school_id; return next; }); }}>Show all schools</button>}
        </div>
        {loading ? <div className="all-attendance-empty">Loading school summaries…</div> : report.schools.length === 0 ? (
          <div className="all-attendance-empty">No schools match this selection.</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>School</th><th>Total teachers</th><th>Present</th><th>Absent</th><th>Late</th><th>On Leave</th><th>Attendance %</th><th>Last attendance</th><th>Record coverage ({applied.end_date})</th><th>School Manager</th><th>Details</th></tr></thead>
              <tbody>
                {report.schools.map(school => (
                  <tr key={school.id}>
                    <td>{school.school_name}</td>
                    <td>{school.total_teachers}</td>
                    <td>{school.present}</td>
                    <td>{school.absent}</td>
                    <td>{school.late}</td>
                    <td>{school.on_leave}</td>
                    <td>{school.attendance_percentage == null ? '—' : `${school.attendance_percentage}%`}</td>
                    <td>{formatDate(school.last_attendance_date)}</td>
                    <td><span className={`all-attendance-submission all-attendance-submission--${school.submission_status.toLowerCase().replaceAll(' ', '-')}`}>{school.submission_status} ({school.end_date_recorded_teachers}/{school.total_teachers})</span></td>
                    <td>{school.manager_name || '—'}</td>
                    <td><button className="btn btn-secondary btn-sm" type="button" onClick={() => viewSchool(school.id)}><MdVisibility /> View details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="all-attendance-details" ref={detailsRef}>
        <div className="all-attendance-section-heading">
          <div><h2>Attendance details</h2><p>{report.details.total.toLocaleString()} recorded teacher attendance rows match the selected filters.</p></div>
        </div>
        {loading ? <div className="all-attendance-empty">Loading attendance details…</div> : report.details.data.length === 0 ? (
          <div className="all-attendance-empty">{error ? 'Attendance details could not be loaded.' : 'No recorded attendance matches these filters. No records does not mean teachers were absent.'}</div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Teacher</th><th>Teacher ID</th><th>School</th><th>Date</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Recorded by</th><th>Remarks</th></tr></thead>
                <tbody>
                  {report.details.data.map(row => (
                    <tr key={row.id}>
                      <td>{row.teacher_name}</td>
                      <td>{row.teacher_code || row.teacher_id}</td>
                      <td>{row.school_name || 'Unassigned school'}</td>
                      <td>{formatDate(row.attendance_date)}</td>
                      <td><span className={`badge ${row.status === 'Present' ? 'badge-success' : row.status === 'Absent' ? 'badge-danger' : row.status === 'Late' ? 'badge-warning' : ''}`}>{row.status}</span></td>
                      <td>{formatTime(row.check_in)}</td>
                      <td>{formatTime(row.check_out)}</td>
                      <td>{row.recorded_by || '—'}</td>
                      <td>{row.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="all-attendance-pagination">
                <span>Page {report.details.page} of {totalPages}</span>
                <div>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => changePage(report.details.page - 1)} disabled={report.details.page <= 1 || loading}>Previous</button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => changePage(report.details.page + 1)} disabled={report.details.page >= totalPages || loading}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default AllSchoolsAttendance;

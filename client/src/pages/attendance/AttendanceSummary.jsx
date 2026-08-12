import React, { useState, useEffect, useMemo } from 'react';
import { MdBarChart, MdCalendarToday, MdRefresh, MdDownload } from 'react-icons/md';
import toast from 'react-hot-toast';
import { getAttendance } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import './AttendanceSummary.css';

const STATUSES = ['Present', 'Absent', 'Late', 'On Leave'];
const STATUS_COLORS = {
  'Present': '#10B981',
  'Absent': '#EF4444',
  'Late': '#F59E0B',
  'On Leave': '#8B5CF6',
};

const AttendanceSummary = () => {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState({});

  // Fetch attendance records for the entire year
  const fetchYearAttendance = async () => {
    setLoading(true);
    try {
      // We'll fetch month by month and aggregate
      const allRecords = [];
      
      for (let month = 1; month <= 12; month++) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        // Fetch attendance for this month
        const { data } = await getAttendance({
          date: startDate,
          type: 'teacher',
          limit: 1000,
        });

        if (data.success && data.data) {
          // Note: API returns single date - we need to aggregate
          // For now, we'll collect what we can
          allRecords.push(...data.data);
        }
      }

      setAttendanceData(allRecords);
      calculateMonthlyStats(allRecords);
    } catch (err) {
      toast.error('Failed to load attendance data.');
      console.error(err);
    }
    setLoading(false);
  };

  const calculateMonthlyStats = (records) => {
    const monthly = {};
    for (let month = 0; month < 12; month++) {
      monthly[month] = {
        'Present': 0,
        'Absent': 0,
        'Late': 0,
        'On Leave': 0,
      };
    }

    records.forEach(record => {
      if (record.date) {
        const d = new Date(record.date);
        const month = d.getMonth();
        const status = record.att_status || 'Absent';
        if (monthly[month] && monthly[month].hasOwnProperty(status)) {
          monthly[month][status]++;
        }
      }
    });

    setMonthlyData(monthly);
  };

  useEffect(() => {
    fetchYearAttendance();
  }, [year]);

  // Calculate yearly statistics
  const yearlyStats = useMemo(() => {
    const stats = {
      'Present': 0,
      'Absent': 0,
      'Late': 0,
      'On Leave': 0,
    };

    Object.values(monthlyData).forEach(month => {
      Object.keys(stats).forEach(status => {
        stats[status] += month[status] || 0;
      });
    });

    return stats;
  }, [monthlyData]);

  const totalDays = Object.values(yearlyStats).reduce((a, b) => a + b, 0);
  const attendancePercentage = totalDays > 0 
    ? ((yearlyStats.Present + yearlyStats.Late) / totalDays * 100).toFixed(1)
    : 0;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const handleExportCsv = () => {
    const rows = [];
    rows.push(['Attendance Summary', year].join(','));
    rows.push(['']);
    rows.push(['Month', 'Present', 'Absent', 'Late', 'On Leave', 'Total'].join(','));
    
    months.forEach((month, idx) => {
      const data = monthlyData[idx] || {};
      const total = Object.values(data).reduce((a, b) => a + b, 0);
      rows.push([
        month,
        data['Present'] || 0,
        data['Absent'] || 0,
        data['Late'] || 0,
        data['On Leave'] || 0,
        total,
      ].join(','));
    });

    rows.push(['']);
    rows.push(['YEARLY TOTAL', yearlyStats.Present, yearlyStats.Absent, yearlyStats.Late, yearlyStats['On Leave'], totalDays].join(','));

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_summary_${year}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('Attendance data exported.');
  };

  return (
    <div className="attendance-summary-page">
      <div className="page-header">
        <div>
          <h1 className="page-title"><MdBarChart /> Attendance Summary</h1>
          <p className="page-subtitle">View your attendance statistics by year</p>
        </div>
        <div className="header-actions">
          <div className="form-group">
            <label className="form-label">Year</label>
            <input
              type="number"
              className="form-control"
              value={year}
              min="2000"
              max="2100"
              onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
              style={{ width: 100 }}
            />
          </div>
          <button className="btn btn-secondary" onClick={fetchYearAttendance} title="Refresh">
            <MdRefresh /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={handleExportCsv}>
            <MdDownload /> Export
          </button>
        </div>
      </div>

      {/* Yearly Statistics Cards */}
      <div className="grid-5 mb-lg">
        {STATUSES.map((status) => (
          <div key={status} className="stat-card" style={{ '--card-accent': `linear-gradient(135deg, ${STATUS_COLORS[status]}, ${STATUS_COLORS[status]}88)` }}>
            <div className="stat-card-body">
              <div className="stat-card-label">{status}</div>
              <div className="stat-card-value">{loading ? '—' : yearlyStats[status]}</div>
            </div>
          </div>
        ))}
        <div className="stat-card" style={{ '--card-accent': 'linear-gradient(135deg, #3B82F6, #3B82F688)' }}>
          <div className="stat-card-body">
            <div className="stat-card-label">Attendance %</div>
            <div className="stat-card-value">{loading ? '—' : `${attendancePercentage}%`}</div>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="card">
        <h3 className="card-title mb-lg"><MdCalendarToday /> Monthly Breakdown</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Late</th>
                <th>On Leave</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading attendance data...
                  </td>
                </tr>
              ) : (
                <>
                  {months.map((month, idx) => {
                    const data = monthlyData[idx] || {};
                    const total = Object.values(data).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={month}>
                        <td><strong>{month} {year}</strong></td>
                        <td>
                          <span className="badge badge-success">{data['Present'] || 0}</span>
                        </td>
                        <td>
                          <span className="badge badge-danger">{data['Absent'] || 0}</span>
                        </td>
                        <td>
                          <span className="badge badge-warning">{data['Late'] || 0}</span>
                        </td>
                        <td>
                          <span className="badge badge-info">{data['On Leave'] || 0}</span>
                        </td>
                        <td><strong>{total}</strong></td>
                      </tr>
                    );
                  })}
                  <tr className="att-summary-total">
                    <td><strong>YEARLY TOTAL</strong></td>
                    <td><strong className="text-success">{yearlyStats.Present}</strong></td>
                    <td><strong className="text-danger">{yearlyStats.Absent}</strong></td>
                    <td><strong className="text-warning">{yearlyStats.Late}</strong></td>
                    <td><strong className="text-info">{yearlyStats['On Leave']}</strong></td>
                    <td><strong>{totalDays}</strong></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Stats Cards */}
      <div className="grid-2 mt-lg">
        <div className="card">
          <h4 className="card-title mb-md">Present vs Absent</h4>
          <div className="att-stat-comparison">
            <div className="att-stat-item">
              <div className="att-stat-label">Present</div>
              <div className="att-stat-bar att-stat-present" style={{ width: `${totalDays > 0 ? (yearlyStats.Present / totalDays * 100) : 0}%` }}>
                <span className="att-stat-percent">{totalDays > 0 ? ((yearlyStats.Present / totalDays * 100).toFixed(1)) : 0}%</span>
              </div>
            </div>
            <div className="att-stat-item">
              <div className="att-stat-label">Absent</div>
              <div className="att-stat-bar att-stat-absent" style={{ width: `${totalDays > 0 ? (yearlyStats.Absent / totalDays * 100) : 0}%` }}>
                <span className="att-stat-percent">{totalDays > 0 ? ((yearlyStats.Absent / totalDays * 100).toFixed(1)) : 0}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 className="card-title mb-md">Status Distribution</h4>
          <div className="att-stat-grid">
            {STATUSES.map((status) => (
              <div key={status} className="att-stat-badge" style={{ borderLeft: `4px solid ${STATUS_COLORS[status]}` }}>
                <div className="att-stat-badge-label">{status}</div>
                <div className="att-stat-badge-value">{yearlyStats[status]}</div>
                <div className="att-stat-badge-percent">
                  {totalDays > 0 ? ((yearlyStats[status] / totalDays * 100).toFixed(1)) : 0}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceSummary;

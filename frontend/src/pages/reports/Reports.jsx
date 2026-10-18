import React, { useState, useEffect } from 'react';
import { MdDownload, MdRefresh, MdBarChart, MdUploadFile, MdHistory } from 'react-icons/md';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useAuth } from '../../context/AuthContext';
import {
  getReportsDashboard, getSchoolReports, getSchoolReport, getSchoolReportEvents,
  submitSchoolReport, resubmitSchoolReport, reviewSchoolReport, downloadSchoolReportAttachment,
} from '../../utils/apiCall';
import './Reports.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const exportReport = (dash) => {
  const workbook = XLSX.utils.book_new();
  const addSheet = (name, rows, widths) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  };

  addSheet('Summary', [
    { Metric: 'Total Schools', Value: dash.totalSchools ?? 0 },
    { Metric: 'Total Teachers', Value: dash.totalTeachers ?? 0 },
    { Metric: 'Total Staff', Value: dash.totalStaff ?? 0 },
    { Metric: 'Total Users', Value: dash.totalUsers ?? 0 },
    { Metric: 'Active Users', Value: dash.activeUsers ?? 0 },
    { Metric: 'Inactive Users', Value: dash.inactiveUsers ?? 0 },
    { Metric: 'Present Today', Value: dash.presentToday ?? 0 },
    { Metric: 'Absent Today', Value: dash.absentToday ?? 0 },
  ], [24, 16]);

  addSheet('Monthly Attendance', (dash.monthly || []).map((month) => ({
    Month: month.month,
    Present: month.present,
    Total: month.total,
  })), [22, 14, 14]);

  XLSX.writeFile(workbook, `Education_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

const Reports = () => {
  const { isAdmin, isSchoolManager } = useAuth();
  const [dash,    setDash]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [from,    setFrom]    = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);
  const [schoolReports, setSchoolReports] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportDraftId, setReportDraftId] = useState(null);
  const [reportForm, setReportForm] = useState({
    title: '', report_type: '', period_start: '', period_end: '', content: '',
  });
  const [reportFile, setReportFile] = useState(null);
  const [reviewReport, setReviewReport] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('Under Review');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [historyReportId, setHistoryReportId] = useState(null);
  const [reportEvents, setReportEvents] = useState([]);

  const fetchDash = async () => {
    try {
      const { data } = await getReportsDashboard();
      if (data.success) setDash(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load report analytics.');
    }
  };

  useEffect(() => {
    fetchDash().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAdmin && !isSchoolManager) return;
    setReportLoading(true);
    getSchoolReports()
      .then(({ data }) => { if (data.success) setSchoolReports(data.data); })
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load school reports.'))
      .finally(() => setReportLoading(false));
  }, [isAdmin, isSchoolManager]);

  const handleFilter = () => { setLoading(true); fetchDash().finally(() => setLoading(false)); };

  const handleReportSubmit = async (event) => {
    event.preventDefault();
    setReportSaving(true);
    const form = new FormData();
    Object.entries(reportForm).forEach(([key, value]) => form.append(key, value));
    if (reportFile) form.append('attachment', reportFile);
    try {
      if (reportDraftId) await resubmitSchoolReport(reportDraftId, form);
      else await submitSchoolReport(form);
      toast.success(reportDraftId ? 'Report resubmitted.' : 'Report submitted.');
      setReportForm({ title: '', report_type: '', period_start: '', period_end: '', content: '' });
      setReportFile(null);
      setReportDraftId(null);
      const { data } = await getSchoolReports();
      setSchoolReports(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the report.');
    } finally {
      setReportSaving(false);
    }
  };

  const startResubmission = async (id) => {
    try {
      const { data } = await getSchoolReport(id);
      const report = data.data;
      setReportDraftId(report.id);
      setReportForm({
        title: report.title,
        report_type: report.report_type,
        period_start: String(report.period_start).slice(0, 10),
        period_end: String(report.period_end).slice(0, 10),
        content: report.content,
      });
      setReportFile(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not open this report.');
    }
  };

  const openHistory = async (id) => {
    try {
      const { data } = await getSchoolReportEvents(id);
      setReportEvents(data.data || []);
      setHistoryReportId(id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load report history.');
    }
  };

  const saveReview = async () => {
    if (!reviewReport) return;
    try {
      await reviewSchoolReport(reviewReport.id, { status: reviewStatus, feedback: reviewFeedback });
      toast.success('Report review saved.');
      setReviewReport(null);
      const { data } = await getSchoolReports();
      setSchoolReports(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the review.');
    }
  };

  const downloadAttachment = async (report) => {
    try {
      const { data } = await downloadSchoolReportAttachment(report.id);
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = report.attachment_name || `school-report-${report.id}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not download the attachment.');
    }
  };

  const handleExport = () => {
    if (!dash) return;
    try {
      exportReport(dash);
      toast.success('Report exported to Excel.');
    } catch {
      toast.error('Could not export the report. Please try again.');
    }
  };

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
        <button className="btn btn-secondary" type="button" onClick={handleExport} disabled={loading || !dash}>
          <MdDownload /> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="report-filter-section mb-lg">
        <div className="report-filters">
          <div className="form-group"><label className="form-label">From</label><input type="date" className="form-control" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">To</label><input type="date" className="form-control" value={to} onChange={e => setTo(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={handleFilter}><MdRefresh /> Apply</button>
        </div>
      </div>

      {/* Summary */}
      <div className="report-summary mb-lg">
        {[
          { label: 'Total Schools',  value: dash?.totalSchools },
          { label: 'Total Teachers', value: dash?.totalTeachers },
          { label: 'Total Staff',    value: dash?.totalStaff },
          { label: 'Present Today',  value: dash?.presentToday },
        ].map((s, i) => (
          <div key={i} className="report-summary-item">
            <span>{s.label}</span><strong>{loading ? '—' : s.value ?? 0}</strong>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2 mb-lg">
        <section className="report-chart">
          <h3 className="section-title"><MdBarChart /> Monthly Attendance</h3>
          <div style={{ height: 280 }}>
            {dash?.monthly?.length > 0
              ? <Bar data={monthlyChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
              : <div className="empty-state" style={{ padding: '3rem' }}><p className="text-muted">No data available</p></div>
            }
          </div>
        </section>
        <section className="report-chart">
          <h3 className="section-title">User Status</h3>
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {doughnutData
              ? <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
              : <div className="empty-state"><p className="text-muted">No data</p></div>
            }
          </div>
        </section>
      </div>

      {isSchoolManager && (
        <section className="report-form-section mb-lg">
          <h2 className="section-title"><MdUploadFile /> {reportDraftId ? 'Correct and resubmit report' : 'Submit a school report'}</h2>
          <form onSubmit={handleReportSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="report-title">Title</label>
                <input id="report-title" className="form-control" maxLength="200" required value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="report-type">Report type</label>
                <input id="report-type" className="form-control" maxLength="80" required value={reportForm.report_type}
                  onChange={(e) => setReportForm({ ...reportForm, report_type: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="report-period-start">Period start</label>
                <input id="report-period-start" type="date" className="form-control" required value={reportForm.period_start}
                  onChange={(e) => setReportForm({ ...reportForm, period_start: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="report-period-end">Period end</label>
                <input id="report-period-end" type="date" className="form-control" required value={reportForm.period_end}
                  onChange={(e) => setReportForm({ ...reportForm, period_end: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="report-content">Report details</label>
              <textarea id="report-content" className="form-control" rows="5" required value={reportForm.content}
                onChange={(e) => setReportForm({ ...reportForm, content: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="report-attachment">Attachment (PDF, PNG, or JPEG; max 10 MB)</label>
              <input id="report-attachment" type="file" className="form-control" accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setReportFile(e.target.files?.[0] || null)} />
            </div>
            <button className="btn btn-primary" disabled={reportSaving} type="submit">
              <MdUploadFile /> {reportSaving ? 'Saving…' : reportDraftId ? 'Resubmit report' : 'Submit report'}
            </button>
            {reportDraftId && <button className="btn btn-secondary" type="button" onClick={() => {
              setReportDraftId(null);
              setReportForm({ title: '', report_type: '', period_start: '', period_end: '', content: '' });
              setReportFile(null);
            }}>Cancel</button>}
          </form>
        </section>
      )}

      {(isAdmin || isSchoolManager) && (
        <section className="school-reports-section mb-lg">
          <h2 className="section-title">{isAdmin ? 'School report inbox' : 'My school reports'}</h2>
          {reviewReport && isAdmin && (
            <div className="report-review" role="group" aria-label={`Review report ${reviewReport.title}`}>
              <h4>{reviewReport.title}</h4>
              <div className="form-group">
                <label className="form-label" htmlFor="review-status">Decision</label>
                <select id="review-status" className="form-control" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                  <option>Under Review</option><option>Needs Correction</option><option>Approved</option><option>Rejected</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="review-feedback">Feedback (required for correction or rejection)</label>
                <textarea id="review-feedback" className="form-control" rows="3" value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)} />
              </div>
              <button className="btn btn-primary" type="button" onClick={saveReview}>Save review</button>
              <button className="btn btn-secondary" type="button" onClick={() => setReviewReport(null)}>Cancel</button>
            </div>
          )}
          {historyReportId && (
            <div className="report-history mb-lg">
              <h4>Report history</h4>
              {reportEvents.map((item) => (
                <p key={item.id}>
                  <strong>{item.event_type}</strong> · {item.status} · {item.actor_name || 'System'} · {new Date(item.created_at).toLocaleString()}
                  {item.comment && <><br />{item.comment}</>}
                </p>
              ))}
              <button className="btn btn-secondary" type="button" onClick={() => setHistoryReportId(null)}>Close history</button>
            </div>
          )}
          <div className="table-container">
            <table className="data-table">
              <thead><tr>{isAdmin && <th>School</th>}<th>Title</th><th>Type</th><th>Period</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
              <tbody>
                {reportLoading ? <tr><td colSpan={isAdmin ? 7 : 6}>Loading reports…</td></tr>
                  : schoolReports.length === 0 ? <tr><td colSpan={isAdmin ? 7 : 6}>No school reports yet.</td></tr>
                  : schoolReports.map((report) => (
                    <tr key={report.id}>
                      {isAdmin && <td>{report.school_name}</td>}
                      <td>{report.title}{isAdmin && <small style={{ display: 'block' }}>{report.manager_name}</small>}
                        {report.feedback && <small style={{ display: 'block' }}>Feedback: {report.feedback}</small>}
                      </td>
                      <td>{report.report_type}</td>
                      <td>{String(report.period_start).slice(0, 10)} – {String(report.period_end).slice(0, 10)}</td>
                      <td><span className="badge badge-gray">{report.status}</span></td>
                      <td>{new Date(report.submitted_at).toLocaleDateString()}</td>
                      <td>
                        {report.attachment_name && <button className="btn btn-secondary" type="button" onClick={() => downloadAttachment(report)}><MdDownload /> File</button>}
                        <button className="btn btn-secondary" type="button" onClick={() => openHistory(report.id)}><MdHistory /> History</button>
                        {isAdmin && <button className="btn btn-primary" type="button" onClick={() => {
                          setReviewReport(report); setReviewStatus(report.status === 'Submitted' ? 'Under Review' : report.status); setReviewFeedback(report.feedback || '');
                        }}>Review</button>}
                        {isSchoolManager && ['Needs Correction', 'Rejected'].includes(report.status) &&
                          <button className="btn btn-primary" type="button" onClick={() => startResubmission(report.id)}>Resubmit</button>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
export default Reports;

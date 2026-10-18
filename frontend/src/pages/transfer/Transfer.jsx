import React, { useCallback, useEffect, useState } from 'react';
import { MdSwapHoriz, MdDescription, MdSearch, MdRefresh, MdDeleteSweep } from 'react-icons/md';
import toast from 'react-hot-toast';
import { clearTransferHistory, getTransfers, updateTransferStatus } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import '../reports/Reports.css';

const Transfer = () => {
  const { isAdmin } = useAuth();
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [appliedFilters, setAppliedFilters] = useState({ search: '', status: '' });
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getTransfers({ ...appliedFilters, limit: 200 });
      if (data.success) {
        const all = data.data || [];
        setPending(all.filter(t => t.status === 'Pending'));
        setHistory(all.filter(t => t.status !== 'Pending'));
      }
    } catch {
      toast.error('Failed to load transfer data.');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleSearch = () => setAppliedFilters({ ...filters });

  const openReview = (transfer, status) => {
    setReview({ transfer, status });
    setReviewNotes('');
  };

  const handleUpdateStatus = async () => {
    if (!reviewNotes.trim()) {
      toast.error('Enter a decision reason that the employee can see.');
      return;
    }
    setActionLoading(true);
    try {
      await updateTransferStatus(review.transfer.id, { status: review.status, notes: reviewNotes.trim() });
      toast.success(`Transfer ${review.status.toLowerCase()} successfully.`);
      setReview(null);
      fetchTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${review.status.toLowerCase()} transfer.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Permanently delete all approved and rejected transfer history? Pending requests will be kept. This cannot be undone.')) return;

    setClearingHistory(true);
    try {
      const { data } = await clearTransferHistory();
      toast.success(data.message || 'Transfer history cleared. Pending requests were kept.');
      await fetchTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not clear transfer history.');
    } finally {
      setClearingHistory(false);
    }
  };

  const employeeName = (transfer) => transfer.employee_name || transfer.teacher_name || 'Unknown';
  const employeeCode = (transfer) => transfer.employee_code || transfer.teacher_tid || '—';

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transfer</h1>
          <p className="page-subtitle">Review teacher and staff requests and record a decision reason for each employee.</p>
        </div>
      </div>

      <div className="report-filter-section mb-lg">
        <div className="report-filters">
          <div className="form-group">
            <label className="form-label">Search transfers</label>
            <div className="search-input-wrap">
              <MdSearch className="search-icon" />
              <input
                className="form-control"
                placeholder="Search teacher, school, or status..."
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleSearch}><MdRefresh /> Filter</button>
        </div>
      </div>

      <div className="grid-2 mb-lg">
        <section className="report-chart">
          <h2 className="section-title"><MdSwapHoriz /> Pending Transfers</h2>
          {loading ? (
            <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">Loading...</p></div>
          ) : pending.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">No pending transfer requests.</p></div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>#</th><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Date</th><th>Request reason</th><th>Actions</th></tr></thead>
                <tbody>
                  {pending.map((t, idx) => (
                    <tr key={t.id}>
                      <td>{idx + 1}</td>
                      <td>{employeeName(t)}<div className="text-muted text-xs">{employeeCode(t)}</div></td>
                      <td>{t.employee_type || 'teacher'}</td>
                      <td>{t.from_school_name || '—'}</td>
                      <td>{t.to_school_name}</td>
                      <td>{t.request_date}</td>
                      <td>{t.reason || '—'}</td>
                      <td>
                        <button className="btn btn-success btn-sm" disabled={actionLoading} onClick={() => openReview(t, 'Approved')}>Approve</button>
                        <button className="btn btn-danger btn-sm" disabled={actionLoading} onClick={() => openReview(t, 'Rejected')}>Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="report-chart">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-lg)' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}><MdDescription /> Transfer History</h2>
            {isAdmin && (
              <button
                className="btn btn-danger btn-sm"
                type="button"
                onClick={handleClearHistory}
                disabled={clearingHistory || loading}
              >
                <MdDeleteSweep /> {clearingHistory ? 'Clearing…' : 'Clear History'}
              </button>
            )}
          </div>
          {loading ? (
            <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">Loading...</p></div>
          ) : history.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">Transfer history will appear here.</p></div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>#</th><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Status</th><th>Date</th><th>Decision reason</th></tr></thead>
                <tbody>
                  {history.map((t, idx) => (
                    <tr key={t.id}>
                      <td>{idx + 1}</td>
                      <td>{employeeName(t)}</td>
                      <td>{t.employee_type || 'teacher'}</td>
                      <td>{t.from_school_name || '—'}</td>
                      <td>{t.to_school_name}</td>
                      <td><span className={`badge ${t.status === 'Approved' ? 'badge-success' : 'badge-danger'}`}>{t.status}</span></td>
                      <td>{t.request_date}</td>
                      <td>{t.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {review && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setReview(null)}>
          <div className="modal animate-scale-in">
            <div className="modal-header">
              <h3 className="modal-title">{review.status} transfer request</h3>
              <button className="btn btn-icon" onClick={() => setReview(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              <p>{employeeName(review.transfer)}: {review.transfer.from_school_name || '—'} → {review.transfer.to_school_name || '—'}</p>
              <p><strong>Employee request:</strong> {review.transfer.reason || '—'}</p>
              <div className="form-group">
                <label className="form-label required" htmlFor="transfer-decision-reason">Decision reason shown to employee</label>
                <textarea id="transfer-decision-reason" className="form-control" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={4} maxLength={2000} required />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setReview(null)}>Cancel</button>
              <button className={`btn ${review.status === 'Approved' ? 'btn-success' : 'btn-danger'}`} onClick={handleUpdateStatus} disabled={actionLoading || !reviewNotes.trim()}>
                {actionLoading ? 'Saving…' : `${review.status} request`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transfer;

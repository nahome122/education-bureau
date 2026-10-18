import React, { useState, useEffect, useCallback } from 'react';
import { MdHistory, MdRefresh } from 'react-icons/md';
import toast from 'react-hot-toast';
import { getLogs } from '../../utils/apiCall';
import './Logs.css';

const Logs = () => {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const LIMIT = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getLogs({ page, limit: LIMIT });
      if (data.success) { setLogs(data.data); setTotal(data.total); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load logs.'); }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="logs-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">System Logs</h1>
          <p className="page-subtitle">Login activity and audit trail</p>
        </div>
        <button className="btn btn-ghost" onClick={fetchLogs}><MdRefresh /> Refresh</button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>User</th><th>Username</th><th>IP Address</th><th>Status</th><th>Date &amp; Time</th></tr>
            </thead>
            <tbody>
              {loading ? [...Array(8)].map((_, i) => <tr key={i}>{[...Array(6)].map((_, j) => <td key={j}><div className="skeleton skeleton-text" /></td>)}</tr>)
              : logs.length === 0 ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon"><MdHistory /></div><p className="empty-state-title">No logs yet</p></div></td></tr>
              : logs.map((l, i) => (
                <tr key={l.id}>
                  <td className="text-muted">{(page - 1) * LIMIT + i + 1}</td>
                  <td>{l.full_name || <span className="text-muted">Unknown</span>}</td>
                  <td><code className="log-username">{l.username}</code></td>
                  <td className="text-muted">{l.ip_address}</td>
                  <td><span className={`badge ${l.status === 'success' ? 'badge-success' : 'badge-danger'}`}><span className="badge-dot" />{l.status}</span></td>
                  <td className="text-muted text-xs">{new Date(l.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && <div className="pagination">
          <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
          {[...Array(Math.min(totalPages, 10))].map((_, i) => <button key={i} className={`pagination-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>)}
          <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
        </div>}
      </div>
    </div>
  );
};
export default Logs;

import React, { useEffect, useState } from 'react';
import { MdSwapHoriz, MdDescription, MdSearch, MdAdd, MdRefresh } from 'react-icons/md';
import toast from 'react-hot-toast';
import { getTransfers, createTransfer, updateTransferStatus, getTeachers, getSchools } from '../../utils/apiCall';
import '../reports/Reports.css';

const Transfer = () => {
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [transfers, setTransfers] = useState([]);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ teacher_id: '', to_school_id: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const { data } = await getTransfers({ ...filters, limit: 200 });
      if (data.success) {
        const all = data.data || [];
        setPending(all.filter(t => t.status === 'Pending'));
        setHistory(all.filter(t => t.status !== 'Pending'));
        setTransfers(all);
      }
    } catch (err) {
      toast.error('Failed to load transfer data.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTransfers();
    getTeachers({ limit: 200 }).then(({ data }) => { if (data.success) setTeachers(data.data); }).catch(() => {});
    getSchools({ limit: 200 }).then(({ data }) => { if (data.success) setSchools(data.data); }).catch(() => {});
  }, []);

  const handleSearch = () => fetchTransfers();

  const openModal = () => {
    setForm({ teacher_id: '', to_school_id: '', reason: '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.teacher_id || !form.to_school_id) {
      toast.error('Teacher and destination school are required.');
      return;
    }
    setSaving(true);
    try {
      await createTransfer(form);
      toast.success('Transfer request created.');
      setShowModal(false);
      fetchTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create transfer request.');
    }
    setSaving(false);
  };

  const handleUpdateStatus = async (id, status) => {
    setActionLoading(true);
    try {
      await updateTransferStatus(id, { status });
      toast.success(`Transfer ${status.toLowerCase()} successfully.`);
      fetchTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${status.toLowerCase()} transfer.`);
    }
    setActionLoading(false);
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transfer</h1>
          <p className="page-subtitle">Teacher transfer requests and movement records</p>
        </div>
      </div>

      <div className="card mb-lg">
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
          <button className="btn btn-secondary" onClick={openModal}><MdAdd /> New Transfer</button>
        </div>
      </div>

      <div className="grid-2 mb-lg">
        <div className="card">
          <h3 className="card-title mb-lg"><MdSwapHoriz /> Pending Transfers</h3>
          {loading ? (
            <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">Loading...</p></div>
          ) : pending.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">No pending transfer requests.</p></div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>#</th><th>Teacher</th><th>From</th><th>To</th><th>Date</th><th>Reason</th><th>Actions</th></tr></thead>
                <tbody>
                  {pending.map((t, idx) => (
                    <tr key={t.id}>
                      <td>{idx + 1}</td>
                      <td>{t.teacher_name}<div className="text-muted text-xs">{t.teacher_tid}</div></td>
                      <td>{t.from_school_name || '—'}</td>
                      <td>{t.to_school_name}</td>
                      <td>{t.request_date}</td>
                      <td>{t.reason || '—'}</td>
                      <td>
                        <button className="btn btn-success btn-sm" disabled={actionLoading} onClick={() => handleUpdateStatus(t.id, 'Approved')}>Approve</button>
                        <button className="btn btn-danger btn-sm" disabled={actionLoading} onClick={() => handleUpdateStatus(t.id, 'Rejected')}>Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title mb-lg"><MdDescription /> Transfer History</h3>
          {loading ? (
            <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">Loading...</p></div>
          ) : history.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">Transfer history will appear here.</p></div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>#</th><th>Teacher</th><th>From</th><th>To</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {history.map((t, idx) => (
                    <tr key={t.id}>
                      <td>{idx + 1}</td>
                      <td>{t.teacher_name}</td>
                      <td>{t.from_school_name || '—'}</td>
                      <td>{t.to_school_name}</td>
                      <td>{t.status}</td>
                      <td>{t.request_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg animate-scale-in">
            <div className="modal-header">
              <h3 className="modal-title">New Transfer Request</h3>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">Teacher</label>
                  <select className="form-control" value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
                    <option value="">Select a teacher</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.tid}) — {t.school_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">Destination School</label>
                  <select className="form-control" value={form.to_school_id} onChange={e => setForm(f => ({ ...f, to_school_id: e.target.value }))}>
                    <option value="">Select school</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <textarea className="form-control" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={4} placeholder="Optional transfer reason" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Submit Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transfer;

import React, { useCallback, useEffect, useState } from 'react';
import { MdDeleteSweep, MdRefresh, MdSend, MdSwapHoriz } from 'react-icons/md';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { clearMyTransferHistory, createMyTransfer, getMyTransfers, getSchools } from '../../utils/apiCall';
import './MyTransfer.css';

const MyTransfer = () => {
  const { user, refreshUser } = useAuth();
  const [schools, setSchools] = useState([]);
  const [requests, setRequests] = useState([]);
  const [destinationId, setDestinationId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: requestData }, { data: schoolData }] = await Promise.all([
        getMyTransfers(user, { limit: 100 }),
        getSchools({ limit: 200, status: 'Active' }),
      ]);
      setRequests(requestData.data || []);
      if (requestData.currentSchool &&
          (String(requestData.currentSchool.id) !== String(user?.school_id) ||
           requestData.currentSchool.name !== user?.school_name)) {
        refreshUser({
          ...user,
          school_id: requestData.currentSchool.id,
          school_name: requestData.currentSchool.name,
        });
      }
      setSchools((schoolData.data || []).filter(
        school => String(school.id) !== String(user?.school_id)
      ));
    } catch (err) {
      const message = err.response?.data?.message || 'Could not load transfer requests.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [refreshUser, user]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!destinationId || !reason.trim()) {
      toast.error('Select a destination school and explain your transfer request.');
      return;
    }

    setSaving(true);
    try {
      await createMyTransfer({ to_school_id: destinationId, reason: reason.trim() }, user);
      toast.success('Transfer request sent to the Administrator.');
      setDestinationId('');
      setReason('');
      await loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit transfer request.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear your transfer requests from this history? The Administrator will still retain the records.')) return;

    setClearing(true);
    try {
      const { data } = await clearMyTransferHistory(user);
      toast.success(data.message || 'Your transfer history was cleared.');
      await loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not clear your transfer history.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="my-transfer-page">
      <div className="page-header my-transfer-header">
        <div>
          <h1 className="page-title">Transfer Request</h1>
          <p className="page-subtitle">Ask the Administrator to transfer you to another school and follow the decision.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={loadRequests} disabled={loading}>
          <MdRefresh /> Refresh
        </button>
      </div>

      <form className="card my-transfer-form" onSubmit={handleSubmit}>
        <h2><MdSwapHoriz /> Request transfer to another school</h2>
        <p className="my-transfer-hint">
          Your current school is <strong>{user?.school_name || 'not assigned'}</strong>.
          The Administrator must approve your request before your school assignment changes.
        </p>
        <div className="form-group">
          <label className="form-label required" htmlFor="transfer-destination">Requested school</label>
          <select
            id="transfer-destination"
            className="form-control"
            value={destinationId}
            onChange={event => setDestinationId(event.target.value)}
            required
          >
            <option value="">Select destination school</option>
            {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label required" htmlFor="transfer-reason">Reason for transfer</label>
          <textarea
            id="transfer-reason"
            className="form-control"
            rows={4}
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="Explain why you are requesting this transfer."
            maxLength={2000}
            required
          />
        </div>
        <div className="my-transfer-submit">
          <button className="btn btn-primary" type="submit" disabled={saving || !destinationId || !reason.trim()}>
            <MdSend /> {saving ? 'Sending request…' : 'Send to Administrator'}
          </button>
        </div>
      </form>

      <section className="card my-transfer-history">
        <div className="my-transfer-history-heading">
          <div><h2>My transfer requests</h2><p>Administrator decisions and reasons appear here.</p></div>
          <button
            className="btn btn-danger"
            type="button"
            onClick={handleClearHistory}
            disabled={loading || clearing || requests.length === 0}
          >
            <MdDeleteSweep /> {clearing ? 'Clearing…' : 'Clear history'}
          </button>
        </div>
        {error ? (
          <div className="my-transfer-empty" role="alert">{error}</div>
        ) : loading ? (
          <div className="my-transfer-empty">Loading your requests…</div>
        ) : requests.length === 0 ? (
          <div className="my-transfer-empty">You have not submitted any transfer requests.</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Requested</th><th>Current school</th><th>Requested school</th><th>Reason</th><th>Status</th><th>Administrator response</th></tr></thead>
              <tbody>
                {requests.map(request => (
                  <tr key={request.id}>
                    <td>{request.request_date ? new Date(request.request_date).toLocaleDateString() : '—'}</td>
                    <td>{request.from_school_name || '—'}</td>
                    <td>{request.to_school_name || '—'}</td>
                    <td>{request.reason || '—'}</td>
                    <td><span className={`badge ${request.status === 'Approved' ? 'badge-success' : request.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>{request.status}</span></td>
                    <td>{request.notes || (request.status === 'Pending' ? 'Awaiting Administrator review.' : 'No reason provided.')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default MyTransfer;

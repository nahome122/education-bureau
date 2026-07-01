import React, { useState, useEffect, useCallback } from 'react';
import { MdPersonAdd, MdSearch, MdEdit, MdDelete, MdClose, MdRefresh, MdDownload } from 'react-icons/md';
import toast from 'react-hot-toast';
import { getStaff, createStaff, updateStaff, deleteStaff, getSchools, getDepartments } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import { exportStaffExcel } from '../../utils/exportExcel';
import './Staff.css';

const EMPTY = { sid: '', name: '', gender: 'Male', phone: '', email: '', position: '', department_id: '', school_id: '', salary: '', joining: '', status: 'Active' };

const Staff = () => {
  const { isAdmin, isSchoolManager, isEmployee, isOwnRecord, user } = useAuth();
  // Admin/manager can add/delete. Employees can only edit their own row.
  const canAdd    = isAdmin || isSchoolManager;
  const canDelete = isAdmin || isSchoolManager;
  const canEdit   = isAdmin || isSchoolManager; // used for "Actions" column visibility

  const [staffList,   setStaffList]   = useState([]);
  const [schools,     setSchools]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const LIMIT = 10;

  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal,    setShowModal]    = useState(false);
  const [editItem,     setEditItem]     = useState(null);
  const [form,         setForm]         = useState(EMPTY);
  const [saving,       setSaving]       = useState(false);
  const [deleteId,     setDeleteId]     = useState(null);
  const [exporting,    setExporting]    = useState(false);

  // Show Actions column if admin/manager OR current user is an employee
  const showActions = canEdit || isEmployee;
  const cols = showActions ? 8 : 7;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Employees only see their own record
      const params = { page, limit: LIMIT, ...(search && { search }), ...(filterStatus && { status: filterStatus }) };
      if (isEmployee) params._emp_code = user.emp_code;
      const { data } = await getStaff(params);
      if (data.success) { setStaffList(data.data); setTotal(data.total); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    setLoading(false);
  }, [page, search, filterStatus, isEmployee, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    getSchools({ limit: 100 }).then(({ data }) => { if (data.success) setSchools(data.data); }).catch(() => {});
    getDepartments().then(({ data }) => { if (data.success) setDepartments(data.data); }).catch(() => {});
  }, []);

  const openAdd = () => { setEditItem(null); setForm({ ...EMPTY, sid: `STF${String(Date.now()).slice(-5)}` }); setShowModal(true); };
  const openEdit = (s) => {
    setEditItem(s);
    setForm({ sid: s.sid, name: s.name, gender: s.gender || 'Male', phone: s.phone || '', email: s.email || '',
      position: s.position || '', department_id: String(s.department_id || ''), school_id: String(s.school_id || ''),
      salary: String(s.salary || ''), joining: s.joining?.split('T')[0] || '', status: s.status });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.sid) { toast.error('Name and Staff ID required.'); return; }
    setSaving(true);
    try {
      const payload = { ...form,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        school_id:     form.school_id     ? parseInt(form.school_id)     : null,
        salary:        parseFloat(form.salary) || 0,
      };
      if (editItem) { await updateStaff(editItem.id, payload); toast.success('Staff updated.'); }
      else          { await createStaff(payload);               toast.success('Staff member added.'); }
      setShowModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const targetId = id ?? deleteId;
    try { await deleteStaff(targetId); toast.success('Staff deleted.'); setDeleteId(null); fetchData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = { limit: 10000, ...(search && { search }), ...(filterStatus && { status: filterStatus }) };
      if (isEmployee) params._emp_code = user.emp_code;
      const { data } = await getStaff(params);
      if (data.success && data.data.length > 0) {
        exportStaffExcel(data.data);
        toast.success(`Exported ${data.data.length} staff member(s) to Excel.`);
      } else { toast.error('No staff to export.'); }
    } catch { toast.error('Failed to export staff.'); }
    setExporting(false);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="staff-page">
      <div className="page-header">
        <div><h1 className="page-title">Staff</h1><p className="page-subtitle">Manage all non-teaching staff</p></div>
        <div className="header-actions">
          <button className="btn" onClick={handleExport} disabled={exporting} style={{ minWidth: 130, background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', boxShadow: '0 4px 12px rgba(22,163,74,0.35)' }}>
            {exporting ? <span className="spinner-sm" /> : <MdDownload />} Export Excel
          </button>
          {canAdd && <button className="btn btn-primary" onClick={openAdd}><MdPersonAdd /> Add Staff</button>}
        </div>
      </div>

      <div className="card mb-lg">
        <div className="filters-row">
          <div className="search-input-wrap"><MdSearch className="search-icon" />
            <input className="search-input" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-control" style={{ maxWidth: 140 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option><option>Active</option><option>Inactive</option><option>On Leave</option>
          </select>
          <button className="btn btn-ghost btn-icon" onClick={fetchData}><MdRefresh /></button>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead><tr>
              <th>#</th><th>ID</th><th>Name</th><th>Position</th><th>Department</th><th>School</th><th>Status</th>
              {showActions && <th>Actions</th>}
            </tr></thead>
            <tbody>
              {loading
                ? [...Array(5)].map((_, i) => <tr key={i}>{[...Array(cols)].map((_, j) => <td key={j}><div className="skeleton skeleton-text" /></td>)}</tr>)
                : staffList.length === 0
                  ? <tr><td colSpan={cols}><div className="empty-state"><div className="empty-state-icon">👷</div><p className="empty-state-title">No staff found</p></div></td></tr>
                  : staffList.map((s, i) => {
                      const ownRow = isOwnRecord('staff', s.sid);
                      return (
                        <tr key={s.id} className={ownRow ? 'own-row-highlight' : ''}>
                          <td className="text-muted">{(page - 1) * LIMIT + i + 1}</td>
                          <td><code className="id-code">{s.sid}</code></td>
                          <td>
                            <div className="user-cell">
                              <div className="avatar">{s.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                              <div>
                                <div className="font-medium">
                                  {s.name}
                                  {ownRow && <span className="own-row-badge">You</span>}
                                </div>
                                <div className="text-muted text-xs">{s.email || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td>{s.position || '—'}</td>
                          <td>{s.department_name || '—'}</td>
                          <td>{s.school_name || '—'}</td>
                          <td><span className={`badge ${s.status === 'Active' ? 'badge-success' : s.status === 'On Leave' ? 'badge-warning' : 'badge-danger'}`}><span className="badge-dot" />{s.status}</span></td>
                          {showActions && (
                            <td>
                              {(canEdit || ownRow) ? (
                                <div className="action-btns">
                                  <button className="btn btn-icon" onClick={() => openEdit(s)} title={ownRow && !canEdit ? 'Edit your info' : 'Edit'}><MdEdit /></button>
                                  {canDelete && <button className="btn btn-icon btn-danger-icon" onClick={() => setDeleteId(s.id)} title="Delete"><MdDelete /></button>}
                                </div>
                              ) : <span className="text-muted">—</span>}
                            </td>
                          )}
                        </tr>
                      );
                    })
              }
            </tbody>
          </table>
        </div>

        {totalPages > 1 && <div className="pagination">
          <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
          {[...Array(totalPages)].map((_, i) => <button key={i} className={`pagination-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>)}
          <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
        </div>}
      </div>

      {/* ── Edit / Add modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg animate-scale-in">
            <div className="modal-header">
              <h3 className="modal-title">{editItem ? 'Edit Staff' : 'Add Staff'}</h3>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}><MdClose /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label required">Staff ID</label>
                  <input className="form-control" value={form.sid} onChange={e => setForm(f => ({ ...f, sid: e.target.value }))}
                    readOnly={isEmployee} style={isEmployee ? { opacity: 0.6 } : {}} /></div>
                <div className="form-group"><label className="form-label required">Full Name</label>
                  <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Gender</label>
                  <select className="form-control" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}><option>Male</option><option>Female</option><option>Other</option></select></div>
                <div className="form-group"><label className="form-label">Phone</label>
                  <input className="form-control" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email</label>
                  <input type="email" className="form-control" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Position</label>
                  <input className="form-control" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                    readOnly={isEmployee} style={isEmployee ? { opacity: 0.6 } : {}} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Department</label>
                  <select className="form-control" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                    disabled={isEmployee} style={isEmployee ? { opacity: 0.6 } : {}}>
                    <option value="">Select</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div className="form-group"><label className="form-label">School</label>
                  <select className="form-control" value={form.school_id} onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))}
                    disabled={isEmployee} style={isEmployee ? { opacity: 0.6 } : {}}>
                    <option value="">Select</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Salary (ETB)</label>
                  <input type="number" className="form-control" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                    readOnly={isEmployee} style={isEmployee ? { opacity: 0.6 } : {}} /></div>
                <div className="form-group"><label className="form-label">Joining Date</label>
                  <input type="date" className="form-control" value={form.joining} onChange={e => setForm(f => ({ ...f, joining: e.target.value }))}
                    readOnly={isEmployee} style={isEmployee ? { opacity: 0.6 } : {}} /></div>
              </div>
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  disabled={isEmployee} style={isEmployee ? { opacity: 0.6 } : {}}>
                  <option>Active</option><option>Inactive</option><option>On Leave</option></select></div>
              {isEmployee && (
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                  * You can edit your contact info (name, phone, email, gender). Other fields are managed by the Administrator.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <span className="spinner-sm" /> : editItem ? 'Save Changes' : 'Add Staff'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
        <div className="modal animate-scale-in" style={{ maxWidth: 420 }}>
          <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="delete-icon-wrap"><MdDelete /></div>
            <h3 className="modal-title mb-sm">Delete Staff?</h3><p className="text-muted">This cannot be undone.</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete</button>
          </div>
        </div>
      </div>}
    </div>
  );
};
export default Staff;

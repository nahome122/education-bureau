import React, { useState, useEffect, useCallback } from 'react';
import { MdPersonAdd, MdSearch, MdEdit, MdDelete, MdClose, MdRefresh, MdDownload } from 'react-icons/md';
import toast from 'react-hot-toast';
import { getStaff, createStaff, updateStaff, deleteStaff, getSchools, getDepartments } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import { exportStaffExcel } from '../../utils/exportExcel';
import CredentialsModal from '../../components/CredentialsModal';
import Can from '../../components/Can';
import './Staff.css';

const EMPTY = { sid: '', name: '', gender: 'Male', phone: '', email: '', position: '', department_id: '', school_id: '', salary: '', joining: '', status: 'Active' };

const Staff = () => {
  const { isAdmin, isSchoolManager, isOfficer, isEmployee, isOwnRecord, user } = useAuth();
  const canAdd    = isAdmin || isSchoolManager;
  const canDelete = isAdmin || isSchoolManager;
  const canEdit   = isAdmin || isSchoolManager;

  const scopedSchoolId = (isSchoolManager || isOfficer) ? user?.school_id : null;

  const [staffList,   setStaffList]   = useState([]);
  const [schools,     setSchools]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const LIMIT = 10;

  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSchool, setFilterSchool] = useState(scopedSchoolId ? String(scopedSchoolId) : '');
  const [showModal,    setShowModal]    = useState(false);
  const [editItem,     setEditItem]     = useState(null);
  const [form,         setForm]         = useState(EMPTY);
  const [formErrors,   setFormErrors]   = useState({});
  const [saving,       setSaving]       = useState(false);
  const [deleteId,     setDeleteId]     = useState(null);
  const [exporting,    setExporting]    = useState(false);
  const [creds,        setCreds]        = useState(null);

  const showActions = canEdit || isEmployee;
  const cols = showActions ? 8 : 7;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT, ...(search && { search }), ...(filterStatus && { status: filterStatus }), ...(( filterSchool || scopedSchoolId) && { school_id: filterSchool || scopedSchoolId }) };
      if (isEmployee) params._emp_code = user.emp_code;
      const { data } = await getStaff(params);
      if (data.success) { setStaffList(data.data); setTotal(data.total); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    setLoading(false);
  }, [page, search, filterStatus, filterSchool, scopedSchoolId, isEmployee, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    getSchools({ limit: 100 }).then(({ data }) => { if (data.success) setSchools(data.data); }).catch(() => {});
    getDepartments().then(({ data }) => { if (data.success) setDepartments(data.data); }).catch(() => {});
  }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...EMPTY, sid: `STF${String(Date.now()).slice(-5)}`, ...(scopedSchoolId ? { school_id: String(scopedSchoolId) } : {}) });
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditItem(s);
    setForm({ sid: s.sid, name: s.name, gender: s.gender||'Male', phone: s.phone||'', email: s.email||'', position: s.position||'', department_id: String(s.department_id||''), school_id: String(s.school_id||''), salary: String(s.salary||''), joining: s.joining?.split('T')[0]||'', status: s.status });
    setFormErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())   e.name        = 'Full name is required.';
    if (!form.sid.trim())    e.sid         = 'Staff ID is required.';
    if (!form.school_id)     e.school_id   = 'School is required.';
    return e;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    try {
      const payload = { ...form, department_id: form.department_id ? parseInt(form.department_id) : null, school_id: form.school_id ? parseInt(form.school_id) : null, salary: parseFloat(form.salary)||0 };
      if (editItem) {
        await updateStaff(editItem.id, payload);
        toast.success('Staff updated.');
        setShowModal(false);
        fetchData();
      } else {
        const { data } = await createStaff(payload);
        setShowModal(false);
        fetchData();
        if (data.username) {
          setCreds({ name: form.name, username: data.username, password: data.default_password });
        } else {
          toast.success('Staff member added.');
        }
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save.'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const targetId = id ?? deleteId;
    try {
      await deleteStaff(targetId);
      toast.success('Staff member deleted.');
      setDeleteId(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete.'); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = { limit: 10000, ...(search && { search }), ...(filterStatus && { status: filterStatus }), ...((filterSchool || scopedSchoolId) && { school_id: filterSchool || scopedSchoolId }) };
      if (isEmployee) params._emp_code = user.emp_code;
      const { data } = await getStaff(params);
      if (data.success && data.data.length > 0) {
        exportStaffExcel(data.data);
        toast.success(`Exported ${data.data.length} staff to Excel.`);
      } else { toast.error('No staff to export.'); }
    } catch { toast.error('Failed to export.'); }
    setExporting(false);
  };

  const getStaffUsername = (name = '') => {
    const parts = name.trim().toLowerCase().split(/\s+/);
    return parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0];
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="staff-page">
      <div className="page-header">
        <div><h1 className="page-title">Staff</h1><p className="page-subtitle">Manage all staff members across schools</p></div>
        <div className="header-actions">
          <Can module="staff" action="export">
            <button className="btn btn-secondary" onClick={handleExport} disabled={exporting} style={{ minWidth: 130 }}>
              {exporting ? <span className="spinner-sm" /> : <MdDownload />} Export Excel
            </button>
          </Can>
          <Can module="staff" action="create">
            {canAdd && <button className="btn btn-primary" onClick={openAdd}><MdPersonAdd /> Add Staff</button>}
          </Can>
        </div>
      </div>

      <div className="management-filters mb-lg">
        <div className="filters-row">
          <div className="search-input-wrap"><MdSearch className="search-icon" /><input className="search-input" placeholder="Search by name, ID, email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
          <select className="form-control" style={{ maxWidth: 140 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option><option>Active</option><option>Inactive</option><option>On Leave</option>
          </select>
          {!scopedSchoolId && (
            <select className="form-control" style={{ maxWidth: 180 }} value={filterSchool} onChange={e => { setFilterSchool(e.target.value); setPage(1); }}>
              <option value="">All Schools</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button className="btn btn-ghost btn-icon" onClick={fetchData}><MdRefresh /></button>
        </div>
      </div>

      <div className="management-table">
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>#</th><th>ID</th><th>Name</th><th>Position</th><th>Department</th><th>School</th><th>Status</th>{showActions && <th>Actions</th>}</tr></thead>
            <tbody>
              {loading ? [...Array(5)].map((_,i) => <tr key={i}>{[...Array(cols)].map((_,j) => <td key={j}><div className="skeleton skeleton-text" /></td>)}</tr>)
              : staffList.length === 0 ? <tr><td colSpan={cols}><div className="empty-state"><div className="empty-state-icon">👥</div><p className="empty-state-title">No staff found</p></div></td></tr>
              : staffList.map((s, i) => {
                const ownRow = isOwnRecord('staff', s.sid);
                return (
                  <tr key={s.id} className={ownRow ? 'own-row-highlight' : ''}>
                    <td className="text-muted">{(page-1)*LIMIT+i+1}</td>
                    <td><code className="id-code">{s.sid}</code></td>
                    <td><div className="user-cell"><div className="avatar">{s.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}</div><div>
                      <div className="font-medium">{s.name}{ownRow && <span className="own-row-badge">You</span>}</div>
                      <div className="text-muted text-xs">{s.email||'—'}</div>
                    </div></div></td>
                    <td>{s.position||'—'}</td>
                    <td>{s.department_name||'—'}</td>
                    <td>{s.school_name||'—'}</td>
                    <td><span className={`badge ${s.status==='Active'?'badge-success':s.status==='On Leave'?'badge-warning':'badge-danger'}`}><span className="badge-dot"/>{s.status}</span></td>
                    {showActions && (
                      <td>
                        {(canEdit || ownRow) ? (
                          <div className="action-btns">
                            <button className="btn btn-icon" onClick={() => openEdit(s)} title="Edit"><MdEdit /></button>
                            <Can module="staff" action="delete">
                              {canDelete && <button className="btn btn-icon btn-danger-icon" onClick={() => setDeleteId(s.id)} title="Delete"><MdDelete /></button>}
                            </Can>
                          </div>
                        ) : <span className="text-muted">—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && <div className="pagination"><button className="pagination-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹</button>{[...Array(totalPages)].map((_,i)=><button key={i} className={`pagination-btn ${page===i+1?'active':''}`} onClick={()=>setPage(i+1)}>{i+1}</button>)}<button className="pagination-btn" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>›</button></div>}
      </div>

      {creds && <CredentialsModal name={creds.name} username={creds.username} password={creds.password} onClose={() => setCreds(null)} />}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg animate-scale-in">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{editItem?'Edit Staff':'Add Staff'}</h3>
                {editItem && <p className="text-muted text-xs" style={{ marginTop: 3 }}>Login username: <code style={{ background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: 4 }}>{getStaffUsername(editItem.name)}</code></p>}
              </div>
              <button className="btn btn-icon" onClick={()=>setShowModal(false)}><MdClose /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">Staff ID</label>
                  <input className={`form-control ${formErrors.sid ? 'error' : ''}`} value={form.sid} onChange={e=>setForm(f=>({...f,sid:e.target.value}))} placeholder="STF001" readOnly={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}} />
                  {formErrors.sid && <span className="form-error">{formErrors.sid}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label required">Full Name</label>
                  <input className={`form-control ${formErrors.name ? 'error' : ''}`} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
                  {formErrors.name && <span className="form-error">{formErrors.name}</span>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Gender</label><select className="form-control" value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value}))}><option>Male</option><option>Female</option><option>Other</option></select></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+251..." /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Position</label><input className="form-control" value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))} placeholder="e.g. Accountant" readOnly={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}} /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className={`form-control ${formErrors.department_id ? 'error' : ''}`} value={form.department_id} onChange={e=>setForm(f=>({...f,department_id:e.target.value}))} disabled={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}}>
                    <option value="">Select Department (optional)</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {formErrors.department_id && <span className="form-error">{formErrors.department_id}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label required">School</label>
                  <select className={`form-control ${formErrors.school_id ? 'error' : ''}`} value={form.school_id} onChange={e=>setForm(f=>({...f,school_id:e.target.value}))} disabled={!canEdit || !!scopedSchoolId} style={(!canEdit || !!scopedSchoolId) ? { opacity: 0.6 } : {}}>
                    <option value="">Select School</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {formErrors.school_id && <span className="form-error">{formErrors.school_id}</span>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Salary (ETB)</label><input type="number" className="form-control" value={form.salary} onChange={e=>setForm(f=>({...f,salary:e.target.value}))} readOnly={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}} /></div>
                <div className="form-group"><label className="form-label">Joining Date</label><input type="date" className="form-control" value={form.joining} onChange={e=>setForm(f=>({...f,joining:e.target.value}))} readOnly={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}} /></div>
              </div>
              <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} disabled={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}}><option>Active</option><option>Inactive</option><option>On Leave</option></select></div>
              {!editItem && canEdit && (
                <div className="form-hint" style={{ marginTop: 12, padding: '8px 12px', background: 'var(--primary-alpha)', borderRadius: 8, fontSize: 12 }}>
                  🔑 A login account will be auto-created for this staff member. You'll see the username &amp; password after saving.
                </div>
              )}
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?<span className="spinner-sm"/>:editItem?'Save Changes':'Add Staff'}</button></div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDeleteId(null)}>
          <div className="modal animate-scale-in" style={{maxWidth:420}}>
            <div className="modal-body" style={{textAlign:'center',padding:'2rem'}}><div className="delete-icon-wrap"><MdDelete /></div><h3 className="modal-title mb-sm">Delete Staff?</h3><p className="text-muted">This cannot be undone.</p></div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setDeleteId(null)}>Cancel</button><button className="btn btn-danger" onClick={()=>handleDelete(deleteId)}>Delete</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;

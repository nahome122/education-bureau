import React, { useState, useEffect, useCallback } from 'react';
import { MdPersonAdd, MdSearch, MdEdit, MdDelete, MdClose, MdRefresh, MdDownload } from 'react-icons/md';
import toast from 'react-hot-toast';
import { getTeachers, createTeacher, updateTeacher, deleteTeacher, getSchools, getDepartments } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import { exportTeachersExcel } from '../../utils/exportExcel';
import './Teachers.css';

const EMPTY = { tid:'', name:'', gender:'Male', dob:'', phone:'', email:'', qualification:'', department_id:'', school_id:'', position:'', type:'Permanent', salary:'', experience:'', joining:'', status:'Active' };

const Teachers = () => {
  const { isAdmin, isSchoolManager, isEmployee, isOwnRecord, user } = useAuth();
  // Admin/manager can add/delete. Employee can only edit their own row.
  const canEdit   = isAdmin || isSchoolManager;
  const canAdd    = isAdmin || isSchoolManager;
  const canDelete = isAdmin || isSchoolManager;

  const [teachers,    setTeachers]    = useState([]);
  const [schools,     setSchools]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const LIMIT = 10;
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterSchool,  setFilterSchool]  = useState('');
  const [sortOrder,     setSortOrder]     = useState('recent');
  const [showModal,     setShowModal]     = useState(false);
  const [editItem,      setEditItem]      = useState(null);
  const [form,          setForm]          = useState(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [deleteId,      setDeleteId]      = useState(null);
  const [exporting,     setExporting]     = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Employees only see their own record — pass _emp_code to filter
      const params = { page, limit: LIMIT, search, status: filterStatus, school_id: filterSchool, sort: sortOrder };
      if (isEmployee) params._emp_code = user.emp_code;
      const { data } = await getTeachers(params);
      if (data.success) { setTeachers(data.data); setTotal(data.total); }
    } catch { toast.error('Failed to load teachers.'); }
    setLoading(false);
  }, [page, search, filterStatus, filterSchool, sortOrder, isEmployee, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    getSchools({ limit: 100 }).then(({ data }) => { if (data.success) setSchools(data.data); }).catch(() => {});
    getDepartments().then(({ data }) => { if (data.success) setDepartments(data.data); }).catch(() => {});
  }, []);

  const openAdd  = () => { setEditItem(null); setForm({ ...EMPTY, tid: `TCH${String(Date.now()).slice(-5)}` }); setShowModal(true); };
  const openEdit = (t) => {
    setEditItem(t);
    setForm({ tid: t.tid, name: t.name, gender: t.gender||'Male', dob: t.dob?.split('T')[0]||'', phone: t.phone||'', email: t.email||'', qualification: t.qualification||'', department_id: String(t.department_id||''), school_id: String(t.school_id||''), position: t.position||'', type: t.type||'Permanent', salary: String(t.salary||''), experience: String(t.experience||''), joining: t.joining?.split('T')[0]||'', status: t.status });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.tid.trim()) { toast.error('Name and Teacher ID are required.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, department_id: form.department_id ? parseInt(form.department_id) : null, school_id: form.school_id ? parseInt(form.school_id) : null, salary: parseFloat(form.salary)||0, experience: parseInt(form.experience)||0 };
      if (editItem) {
        await updateTeacher(editItem.id, payload);
        toast.success('Teacher updated.');
      } else {
        await createTeacher(payload);
        const nameParts = form.name.trim().toLowerCase().split(/\s+/);
        const autoUsername = nameParts.length > 1
          ? `${nameParts[0]}.${nameParts[nameParts.length - 1]}`
          : nameParts[0];
        toast.success(
          `Teacher added.\nLogin: ${autoUsername} / Password: Employee@123`,
          { duration: 6000 }
        );
      }
      setShowModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save.'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const targetId = id ?? deleteId;
    try {
      await deleteTeacher(targetId);
      toast.success('Teacher deleted.');
      setDeleteId(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete.');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = { limit: 10000, ...(search && { search }), ...(filterStatus && { status: filterStatus }), ...(filterSchool && { school_id: filterSchool }), sort: sortOrder };
      if (isEmployee) params._emp_code = user.emp_code;
      const { data } = await getTeachers(params);
      if (data.success && data.data.length > 0) {
        exportTeachersExcel(data.data);
        toast.success(`Exported ${data.data.length} teacher(s) to Excel.`);
      } else { toast.error('No teachers to export.'); }
    } catch { toast.error('Failed to export teachers.'); }
    setExporting(false);
  };

  const cols = (canEdit || isEmployee) ? 9 : 8;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="teachers-page">
      <div className="page-header">
        <div><h1 className="page-title">Teachers</h1><p className="page-subtitle">Manage all teachers across schools</p></div>
        <div className="header-actions">
          <button className="btn" onClick={handleExport} disabled={exporting} style={{ minWidth: 130, background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', boxShadow: '0 4px 12px rgba(22,163,74,0.35)' }}>
            {exporting ? <span className="spinner-sm" /> : <MdDownload />} Export Excel
          </button>
          {canAdd && <button className="btn btn-primary" onClick={openAdd}><MdPersonAdd /> Add Teacher</button>}
        </div>
      </div>

      <div className="card mb-lg">
        <div className="filters-row">
          <div className="search-input-wrap"><MdSearch className="search-icon" /><input className="search-input" placeholder="Search by name, ID, email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
          <select className="form-control" style={{ maxWidth:140 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option><option>Active</option><option>Inactive</option><option>On Leave</option>
          </select>
          <select className="form-control" style={{ maxWidth:180 }} value={filterSchool} onChange={e => { setFilterSchool(e.target.value); setPage(1); }}>
            <option value="">All Schools</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            className={`btn ${sortOrder === 'az' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setSortOrder(prev => prev === 'az' ? 'recent' : 'az'); setPage(1); }}
            style={{ minWidth: 96 }}
          >
            {sortOrder === 'az' ? 'A → Z' : 'A → Z'}
          </button>
          <button className="btn btn-ghost btn-icon" onClick={fetchData}><MdRefresh /></button>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>#</th><th>ID</th><th>Name</th><th>Department</th><th>School</th><th>Position</th><th>Type</th><th>Status</th>{(canEdit || isEmployee) && <th>Actions</th>}</tr></thead>
            <tbody>
              {loading ? [...Array(5)].map((_,i) => <tr key={i}>{[...Array(cols)].map((_,j) => <td key={j}><div className="skeleton skeleton-text" /></td>)}</tr>)
              : teachers.length === 0 ? <tr><td colSpan={cols}><div className="empty-state"><div className="empty-state-icon">👩‍🏫</div><p className="empty-state-title">No teachers found</p></div></td></tr>
              : teachers.map((t,i) => {
                const ownRow = isOwnRecord('teacher', t.tid);
                return (
                <tr key={t.id} className={ownRow ? 'own-row-highlight' : ''}>
                  <td className="text-muted">{(page-1)*LIMIT+i+1}</td>
                  <td><code className="id-code">{t.tid}</code></td>
                  <td><div className="user-cell"><div className="avatar">{t.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}</div><div>
                    <div className="font-medium">{t.name}{ownRow && <span className="own-row-badge">You</span>}</div>
                    <div className="text-muted text-xs">{t.email||'—'}</div>
                  </div></div></td>
                  <td>{t.department_name||'—'}</td>
                  <td>{t.school_name||'—'}</td>
                  <td>{t.position||'—'}</td>
                  <td><span className="badge badge-info">{t.type}</span></td>
                  <td><span className={`badge ${t.status==='Active'?'badge-success':t.status==='On Leave'?'badge-warning':'badge-danger'}`}><span className="badge-dot"/>{t.status}</span></td>
                  {(canEdit || isEmployee) && (
                    <td>
                      {(canEdit || ownRow) ? (
                        <div className="action-btns">
                          <button className="btn btn-icon" onClick={() => openEdit(t)} title="Edit"><MdEdit /></button>
                          {canDelete && <button className="btn btn-icon btn-danger-icon" onClick={() => setDeleteId(t.id)} title="Delete"><MdDelete /></button>}
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

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg animate-scale-in">
            <div className="modal-header"><h3 className="modal-title">{editItem?'Edit Teacher':'Add Teacher'}</h3><button className="btn btn-icon" onClick={()=>setShowModal(false)}><MdClose /></button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label required">Teacher ID</label><input className="form-control" value={form.tid} onChange={e=>setForm(f=>({...f,tid:e.target.value}))} placeholder="TCH001"
                  readOnly={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}} /></div>
                <div className="form-group"><label className="form-label required">Full Name</label><input className="form-control" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Gender</label><select className="form-control" value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value}))}><option>Male</option><option>Female</option><option>Other</option></select></div>
                <div className="form-group"><label className="form-label">Date of Birth</label><input type="date" className="form-control" value={form.dob} onChange={e=>setForm(f=>({...f,dob:e.target.value}))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+251..." /></div>
                <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Qualification</label><input className="form-control" value={form.qualification} onChange={e=>setForm(f=>({...f,qualification:e.target.value}))} placeholder="MSc Mathematics"
                  readOnly={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}} /></div>
                <div className="form-group"><label className="form-label">Position</label><input className="form-control" value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))} placeholder="Senior Teacher"
                  readOnly={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Department</label><select className="form-control" value={form.department_id} onChange={e=>setForm(f=>({...f,department_id:e.target.value}))}
                  disabled={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}}><option value="">Select Department</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div className="form-group"><label className="form-label">School</label><select className="form-control" value={form.school_id} onChange={e=>setForm(f=>({...f,school_id:e.target.value}))}
                  disabled={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}}><option value="">Select School</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Type</label><select className="form-control" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}
                  disabled={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}}><option>Permanent</option><option>Contract</option><option>Temporary</option></select></div>
                <div className="form-group"><label className="form-label">Salary (ETB)</label><input type="number" className="form-control" value={form.salary} onChange={e=>setForm(f=>({...f,salary:e.target.value}))}
                  readOnly={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Experience (years)</label><input type="number" className="form-control" value={form.experience} onChange={e=>setForm(f=>({...f,experience:e.target.value}))}
                  readOnly={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}} /></div>
                <div className="form-group"><label className="form-label">Joining Date</label><input type="date" className="form-control" value={form.joining} onChange={e=>setForm(f=>({...f,joining:e.target.value}))}
                  readOnly={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}} /></div>
              </div>
              <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                disabled={!canEdit} style={!canEdit ? { opacity: 0.6 } : {}}><option>Active</option><option>Inactive</option><option>On Leave</option></select></div>
              {!canEdit && (
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                  * You can edit your contact info (name, phone, email, gender, date of birth). Other fields are managed by the Administrator.
                </p>
              )}
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?<span className="spinner-sm"/>:editItem?'Save Changes':'Add Teacher'}</button></div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDeleteId(null)}>
          <div className="modal animate-scale-in" style={{maxWidth:420}}>
            <div className="modal-body" style={{textAlign:'center',padding:'2rem'}}><div className="delete-icon-wrap"><MdDelete /></div><h3 className="modal-title mb-sm">Delete Teacher?</h3><p className="text-muted">This cannot be undone.</p></div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setDeleteId(null)}>Cancel</button><button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Teachers;

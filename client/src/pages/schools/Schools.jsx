import React, { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdSearch, MdEdit, MdDelete, MdClose, MdRefresh, MdSchool } from 'react-icons/md';
import toast from 'react-hot-toast';
import { getSchools, createSchool, updateSchool, deleteSchool } from '../../utils/apiCall';
import './Schools.css';

const EMPTY = { code: '', name: '', principal: '', phone: '', email: '', address: '', type: 'Primary', status: 'Active', students: '' };

const Schools = () => {
  const [schools,   setSchools]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const LIMIT = 10;
  const [search,    setSearch]    = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [deleteId,  setDeleteId]  = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSchools({ page, limit: LIMIT, ...(search && { search }) });
      if (data.success) { setSchools(data.data); setTotal(data.total); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load schools.'); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd  = () => { setEditItem(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (s) => {
    setEditItem(s);
    setForm({ code: s.code, name: s.name, principal: s.principal || '', phone: s.phone || '',
      email: s.email || '', address: s.address || '', type: s.type, status: s.status, students: String(s.students || '') });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error('Code and Name required.'); return; }
    setSaving(true);
    const payload = { ...form, students: parseInt(form.students) || 0 };
    try {
      if (editItem) { await updateSchool(editItem.id, payload); toast.success('School updated.'); }
      else          { await createSchool(payload);              toast.success('School added.'); }
      setShowModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const targetId = id ?? deleteId;
    try {
      await deleteSchool(targetId);
      toast.success('School deleted.');
      setDeleteId(null); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="schools-page">
      <div className="page-header">
        <div><h1 className="page-title">Schools</h1><p className="page-subtitle">Manage all schools in the woreda</p></div>
        <button className="btn btn-primary" onClick={openAdd}><MdAdd /> Add School</button>
      </div>

      <div className="card mb-lg">
        <div className="filters-row">
          <div className="search-input-wrap"><MdSearch className="search-icon" />
            <input className="search-input" placeholder="Search schools..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button className="btn btn-ghost btn-icon" onClick={fetchData}><MdRefresh /></button>
        </div>
      </div>

      <div className="schools-grid">
        {loading ? [...Array(6)].map((_, i) => <div key={i} className="school-card skeleton skeleton-card" />) :
         schools.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🏫</div><p className="empty-state-title">No schools found</p></div> :
         schools.map(s => (
          <div key={s.id} className="school-card card animate-slide-up">
            <div className="school-card-header">
              <div className="school-icon"><MdSchool /></div>
              <div className="school-meta">
                <span className="id-code">{s.code}</span>
                <span className={`badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}`}><span className="badge-dot" />{s.status}</span>
              </div>
            </div>
            <h3 className="school-name">{s.name}</h3>
            <p className="school-principal text-muted">{s.principal || 'No principal assigned'}</p>
            <div className="school-stats">
              <div className="school-stat"><span className="school-stat-val">{s.teachers || 0}</span><span className="school-stat-lbl">Teachers</span></div>
              <div className="school-stat"><span className="school-stat-val">{s.staff_count || 0}</span><span className="school-stat-lbl">Staff</span></div>
              <div className="school-stat"><span className="school-stat-val">{s.students || 0}</span><span className="school-stat-lbl">Students</span></div>
            </div>
            <div className="school-type-row">
              <span className="badge badge-info">{s.type}</span>
              <span className="text-muted text-xs">{s.address || '—'}</span>
            </div>
            <div className="school-actions">
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}><MdEdit /> Edit</button>
              <button className="btn btn-ghost btn-sm btn-danger-icon" onClick={() => setDeleteId(s.id)}><MdDelete /> Delete</button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && <div className="pagination mt-lg">
        <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
        {[...Array(totalPages)].map((_, i) => <button key={i} className={`pagination-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>)}
        <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
      </div>}

      {showModal && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
        <div className="modal modal-lg animate-scale-in">
          <div className="modal-header">
            <h3 className="modal-title">{editItem ? 'Edit School' : 'Add School'}</h3>
            <button className="btn btn-icon" onClick={() => setShowModal(false)}><MdClose /></button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group"><label className="form-label required">Code</label><input className="form-control" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="SCH001" /></div>
              <div className="form-group"><label className="form-label required">School Name</label><input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Principal</label><input className="form-control" value={form.principal} onChange={e => setForm(f => ({ ...f, principal: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Address</label><input className="form-control" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Type</label><select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}><option>Primary</option><option>Secondary</option><option>Preparatory</option><option>TVET</option><option>Other</option></select></div>
              <div className="form-group"><label className="form-label">Students</label><input type="number" className="form-control" value={form.students} onChange={e => setForm(f => ({ ...f, students: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><option>Active</option><option>Inactive</option></select></div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner-sm" /> : editItem ? 'Save Changes' : 'Add School'}
            </button>
          </div>
        </div>
      </div>}

      {deleteId && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
        <div className="modal animate-scale-in" style={{ maxWidth: 420 }}>
          <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="delete-icon-wrap"><MdDelete /></div>
            <h3 className="modal-title mb-sm">Delete School?</h3><p className="text-muted">This cannot be undone.</p>
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
export default Schools;

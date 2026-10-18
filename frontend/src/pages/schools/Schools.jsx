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
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [deleteId,  setDeleteId]  = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSchools({
        page,
        limit: LIMIT,
        ...(search && { search }),
        ...(status && { status }),
      });
      if (data.success) { setSchools(data.data); setTotal(data.total); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load schools.'); }
    setLoading(false);
  }, [page, search, status]);

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

      <div className="schools-filters mb-lg">
        <div className="filters-row">
          <label className="search-input-wrap" aria-label="Search schools"><MdSearch className="search-icon" />
            <input className="search-input" placeholder="Search schools by name, code, or principal..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </label>
          <select className="form-control school-status-filter" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} aria-label="Filter schools by status">
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <button className="btn btn-ghost btn-icon" onClick={fetchData} aria-label="Refresh schools" title="Refresh">
            <MdRefresh />
          </button>
        </div>
      </div>

      <div className="table-container schools-table">
        <table className="data-table" aria-label="Schools">
          <thead>
            <tr>
              <th scope="col">Code</th><th scope="col">School</th><th scope="col">Principal</th>
              <th scope="col">Type</th><th scope="col">Teachers</th><th scope="col">Staff</th>
              <th scope="col">Students</th><th scope="col">Status</th><th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={9}><div className="skeleton skeleton-text" /></td></tr>)
              : schools.length === 0
                ? <tr><td colSpan={9}><div className="empty-state"><div className="empty-state-icon"><MdSchool /></div><p className="empty-state-title">No schools found</p><p className="empty-state-desc">Try changing your search or status filter.</p></div></td></tr>
                : schools.map(s => (
                  <tr key={s.id}>
                    <td><code className="id-code">{s.code}</code></td>
                    <td><span className="school-table-name">{s.name}</span><span className="school-table-address">{s.address || '—'}</span></td>
                    <td>{s.principal || '—'}</td>
                    <td>{s.type}</td>
                    <td>{s.teachers ?? 0}</td><td>{s.staff_count ?? 0}</td><td>{s.students ?? 0}</td>
                    <td><span className={`badge ${s.status === 'Active' ? 'badge-success' : 'badge-gray'}`}>{s.status}</span></td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}><MdEdit /> Edit</button>
                        <button className="btn btn-ghost btn-sm btn-danger-icon" onClick={() => setDeleteId(s.id)} aria-label={`Delete ${s.name}`}><MdDelete /> Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
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

import React, { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdEdit, MdDelete, MdClose, MdWork } from 'react-icons/md';
import toast from 'react-hot-toast';
import { getPositions, createPosition, updatePosition, deletePosition, getDepartments } from '../../utils/apiCall';
import './Positions.css';

const EMPTY = { title: '', department_id: '', description: '', status: 'Active' };

const Positions = () => {
  const [list,     setList]     = useState([]);
  const [depts,    setDepts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal,setShowModal]= useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getPositions();
      if (data.success) setList(data.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    getDepartments().then(({ data }) => { if (data.success) setDepts(data.data); }).catch(() => {});
  }, []);

  const openAdd  = () => { setEditItem(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (p) => {
    setEditItem(p);
    setForm({ title: p.title, department_id: String(p.department_id || ''), description: p.description || '', status: p.status });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('Title required.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, department_id: form.department_id ? parseInt(form.department_id) : null };
      if (editItem) { await updatePosition(editItem.id, payload); toast.success('Position updated.'); }
      else          { await createPosition(payload);               toast.success('Position created.'); }
      setShowModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const targetId = id ?? deleteId;
    try { await deletePosition(targetId); toast.success('Deleted.'); setDeleteId(null); fetchData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  return (
    <div className="positions-page">
      <div className="page-header">
        <div><h1 className="page-title">Positions</h1><p className="page-subtitle">Manage job positions and roles</p></div>
        <button className="btn btn-primary" onClick={openAdd}><MdAdd /> Add Position</button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>#</th><th>Title</th><th>Department</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? [...Array(4)].map((_, i) => <tr key={i}>{[...Array(6)].map((_, j) => <td key={j}><div className="skeleton skeleton-text" /></td>)}</tr>)
              : list.length === 0 ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon">💼</div><p className="empty-state-title">No positions found</p></div></td></tr>
              : list.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td><div className="user-cell"><div className="pos-icon"><MdWork /></div><span className="font-medium">{p.title}</span></div></td>
                  <td>{p.department_name || '—'}</td>
                  <td className="text-muted">{p.description || '—'}</td>
                  <td><span className={`badge ${p.status === 'Active' ? 'badge-success' : 'badge-danger'}`}><span className="badge-dot" />{p.status}</span></td>
                  <td><div className="action-btns">
                    <button className="btn btn-icon" onClick={() => openEdit(p)}><MdEdit /></button>
                    <button className="btn btn-icon btn-danger-icon" onClick={() => setDeleteId(p.id)}><MdDelete /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
        <div className="modal animate-scale-in">
          <div className="modal-header">
            <h3 className="modal-title">{editItem ? 'Edit Position' : 'Add Position'}</h3>
            <button className="btn btn-icon" onClick={() => setShowModal(false)}><MdClose /></button>
          </div>
          <div className="modal-body">
            <div className="form-group"><label className="form-label required">Title</label><input className="form-control" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Senior Teacher" /></div>
            <div className="form-group"><label className="form-label">Department</label><select className="form-control" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}><option value="">Select Department</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><option>Active</option><option>Inactive</option></select></div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <span className="spinner-sm" /> : editItem ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </div>}

      {deleteId && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
        <div className="modal animate-scale-in" style={{ maxWidth: 400 }}>
          <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="delete-icon-wrap"><MdDelete /></div>
            <h3 className="modal-title mb-sm">Delete Position?</h3>
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
export default Positions;

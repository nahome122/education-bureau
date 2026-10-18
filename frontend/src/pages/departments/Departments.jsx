import React, { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdEdit, MdDelete, MdClose, MdBusinessCenter, MdSearch } from 'react-icons/md';
import toast from 'react-hot-toast';
import { getDepartments, createDept, updateDept, deleteDept, getSchools } from '../../utils/apiCall';
import './Departments.css';

const EMPTY = { name: '', head: '', description: '', school_id: '', status: 'Active', color: '#2563EB' };

const Departments = () => {
  const [list,     setList]     = useState([]);
  const [schools,  setSchools]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal,setShowModal]= useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getDepartments();
      if (data.success) setList(data.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    getSchools({ limit: 100 })
      .then(({ data }) => { if (data.success) setSchools(data.data); })
      .catch(err => toast.error(err.response?.data?.message || 'Failed to load schools.'));
  }, []);

  const openAdd  = () => { setEditItem(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (d) => {
    setEditItem(d);
    setForm({ name: d.name, head: d.head || '', description: d.description || '', school_id: String(d.school_id || ''), status: d.status, color: d.color || '#2563EB' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Name required.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, school_id: form.school_id ? parseInt(form.school_id) : null };
      if (editItem) { await updateDept(editItem.id, payload); toast.success('Department updated.'); }
      else          { await createDept(payload);               toast.success('Department created.'); }
      setShowModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const targetId = id ?? deleteId;
    try { await deleteDept(targetId); toast.success('Deleted.'); setDeleteId(null); fetchData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const filteredList = list.filter(department => {
    const query = search.trim().toLowerCase();
    const schoolName = schools.find(school => String(school.id) === String(department.school_id))?.name || '';
    const matchesSearch = !query || [department.name, department.head, department.description, schoolName]
      .some(value => value?.toLowerCase().includes(query));
    const matchesSchool = !schoolFilter || String(department.school_id || '') === schoolFilter;
    const matchesStatus = !statusFilter || department.status === statusFilter;
    return matchesSearch && matchesSchool && matchesStatus;
  });

  return (
    <div className="departments-page">
      <div className="page-header">
        <div><h1 className="page-title">Departments</h1><p className="page-subtitle">Manage academic and administrative departments</p></div>
        <button className="btn btn-primary" onClick={openAdd}><MdAdd /> Add Department</button>
      </div>

      <div className="dept-filters">
        <label className="search-input-wrap" aria-label="Search departments">
          <MdSearch className="search-icon" />
          <input
            className="search-input"
            placeholder="Search departments, heads, or schools..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </label>
        <select
          className="form-control"
          value={schoolFilter}
          onChange={event => setSchoolFilter(event.target.value)}
          aria-label="Filter departments by school"
        >
          <option value="">All schools</option>
          {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
        </select>
        <select
          className="form-control"
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value)}
          aria-label="Filter departments by status"
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div className="table-container dept-table">
          <table className="data-table" aria-label="Departments">
            <tbody>{[...Array(5)].map((_, i) => <tr key={i}><td><div className="skeleton skeleton-text" /></td></tr>)}</tbody>
          </table>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><MdBusinessCenter /></div>
          <p className="empty-state-title">{list.length ? 'No matching departments' : 'No departments yet'}</p>
          <p className="empty-state-desc">{list.length ? 'Adjust the search or filters to see more departments.' : 'Add a department to organize the woreda workforce.'}</p>
        </div>
      ) : (
        <div className="table-container dept-table">
          <table className="data-table" aria-label="Departments">
            <thead>
              <tr><th scope="col">Department</th><th scope="col">Head</th><th scope="col">School</th><th scope="col">Description</th><th scope="col">Status</th><th scope="col">Actions</th></tr>
            </thead>
            <tbody>
              {filteredList.map(d => (
                <tr key={d.id}>
                  <td><span className="dept-table-name">{d.name}</span><span className="dept-table-id">Record ID: {d.id}</span></td>
                  <td>{d.head || '—'}</td>
                  <td>{schools.find(school => String(school.id) === String(d.school_id))?.name || 'All schools'}</td>
                  <td className="dept-description">{d.description || '—'}</td>
                  <td><span className={`badge ${d.status === 'Active' ? 'badge-success' : 'badge-gray'}`}>{d.status}</span></td>
                  <td>
                    <div className="dept-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(d)} aria-label={`Edit ${d.name}`}><MdEdit /> Edit</button>
                      <button className="btn btn-ghost btn-sm btn-danger-icon" onClick={() => setDeleteId(d.id)} aria-label={`Delete ${d.name}`}><MdDelete /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
        <div className="modal animate-scale-in">
          <div className="modal-header">
            <h3 className="modal-title">{editItem ? 'Edit Department' : 'Add Department'}</h3>
            <button className="btn btn-icon" onClick={() => setShowModal(false)}><MdClose /></button>
          </div>
          <div className="modal-body">
            <div className="form-group"><label className="form-label required">Name</label><input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Head</label><input className="form-control" value={form.head} onChange={e => setForm(f => ({ ...f, head: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">School</label><select className="form-control" value={form.school_id} onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))}><option value="">All Schools</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Color</label><input type="color" className="form-control" style={{ height: 42 }} value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} /></div>
            </div>
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
            <h3 className="modal-title mb-sm">Delete Department?</h3>
            <p className="text-muted">Teachers assigned to this department will be unlinked.</p>
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
export default Departments;

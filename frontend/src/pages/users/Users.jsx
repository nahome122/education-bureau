import React, { useState, useEffect, useCallback } from 'react';
import {
  MdPersonAdd, MdSearch, MdEdit, MdDelete, MdLock, MdLockOpen,
  MdKey, MdRefresh, MdClose, MdVisibility, MdVisibilityOff,
  MdSecurity,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import { getUsers, createUser, updateUser, deleteUser, setUserStatus, resetUserPassword, getSchools } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import PermissionsModal from './PermissionsModal';
import './Users.css';

/* ── Role definitions ────────────────────────────────────── */
const ROLES = [
  { id: 1, name: 'Administrator',     label: 'Administrator',      badge: 'badge-danger',
    desc: 'Full system access — can manage all users, schools, settings.' },
  { id: 2, name: 'SchoolManager',     label: 'School Manager',     badge: 'badge-primary',
    desc: 'Can manage teachers, staff, attendance and view reports of their assigned school.' },
  { id: 3, name: 'AttendanceOfficer', label: 'Attendance Officer', badge: 'badge-warning',
    desc: 'Can mark attendance and view teacher/report data of their assigned school.' },
];

const EMPTY = {
  full_name: '', username: '', email: '', phone: '',
  password: '', confirm_password: '',
  role_id: '', school_id: '', status: 'Active',
};

/* ── Component ───────────────────────────────────────────── */
const Users = () => {
  const { user: currentUser } = useAuth();

  const [users,        setUsers]        = useState([]);
  const [schools,      setSchools]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const LIMIT = 10;

  const [search,       setSearch]       = useState('');
  const [filterRole,   setFilterRole]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  /* add/edit modal */
  const [showModal,  setShowModal]  = useState(false);
  const [editUser,   setEditUser]   = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [showPw,     setShowPw]     = useState(false);
  const [errors,     setErrors]     = useState({});
  const [saving,     setSaving]     = useState(false);

  /* reset-password modal */
  const [showReset,   setShowReset]   = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPw,       setNewPw]       = useState('');
  const [showNewPw,   setShowNewPw]   = useState(false);

  /* delete confirm */
  const [deleteId, setDeleteId] = useState(null);

  /* permissions modal */
  const [permTarget, setPermTarget] = useState(null);

  /* ── fetch ──────────────────────────────────────────────── */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getUsers({
        page, limit: LIMIT,
        ...(search       && { search }),
        ...(filterRole   && { role: filterRole }),
        ...(filterStatus && { status: filterStatus }),
      });
      if (data.success) { setUsers(data.data); setTotal(data.total); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load users.'); }
    setLoading(false);
  }, [page, search, filterRole, filterStatus]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    getSchools({ limit: 100 })
      .then(({ data }) => { if (data.success) setSchools(data.data); })
      .catch(() => {});
  }, []);

  /* ── helpers ────────────────────────────────────────────── */
  const roleBadge = (name) => ROLES.find(r => r.name === name)?.badge || 'badge-gray';
  const roleLabel = (name) => ROLES.find(r => r.name === name)?.label || name;
  const isSelf    = (id)   => id === currentUser?.id;

  const setF = (key) => (e) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors(er => { const c = { ...er }; delete c[key]; return c; });
  };

  /* ── open modals ────────────────────────────────────────── */
  const openAdd = () => {
    setEditUser(null);
    setForm(EMPTY);
    setErrors({});
    setShowPw(false);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      full_name:        u.full_name,
      username:         u.username,
      email:            u.email,
      phone:            u.phone || '',
      password:         '',
      confirm_password: '',
      role_id:          String(u.role_id),
      school_id:        String(u.school_id || ''),
      status:           u.status,
    });
    setErrors({});
    setShowPw(false);
    setShowModal(true);
  };

  /* ── validate ───────────────────────────────────────────── */
  const validate = () => {
    const e = {};
    if (!form.full_name.trim())                             e.full_name        = 'Full name is required.';
    if (!form.username.trim() || form.username.length < 3)  e.username         = 'Username must be at least 3 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))    e.email            = 'Valid email required.';
    if (!form.role_id)                                       e.role_id          = 'Role is required.';
    if (ROLES.some(r => r.name === 'SchoolManager' && r.id === parseInt(form.role_id, 10)) && !form.school_id) {
      e.school_id = 'A school assignment is required for a School Manager.';
    }
    if (!editUser) {
      if (!form.password)                                    e.password         = 'Password is required.';
      else if (form.password.length < 6)                    e.password         = 'Password must be at least 6 characters.';
      if (form.password !== form.confirm_password)           e.confirm_password = 'Passwords do not match.';
    }
    return e;
  };

  /* ── save (create / update) ─────────────────────────────── */
  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        username:  form.username.trim(),
        email:     form.email.trim(),
        phone:     form.phone.trim(),
        role_id:   parseInt(form.role_id),
        school_id: form.school_id ? parseInt(form.school_id) : null,
        status:    form.status,
      };
      if (!editUser) payload.password = form.password;

      if (editUser) {
        await updateUser(editUser.id, payload);
        toast.success('User updated.');
      } else {
        await createUser(payload);
        toast.success(`User "${payload.username}" created. They can now log in.`);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save.');
    }
    setSaving(false);
  };

  /* ── delete ─────────────────────────────────────────────── */
  const handleDelete = async (id) => {
    const tid = id ?? deleteId;
    if (isSelf(tid)) { toast.error('You cannot delete your own account.'); return; }
    try {
      await deleteUser(tid);
      toast.success('User deleted.');
      setDeleteId(null);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  /* ── activate / deactivate ──────────────────────────────── */
  const handleToggleStatus = async (u) => {
    if (isSelf(u.id)) { toast.error('You cannot change your own status.'); return; }
    const next = u.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await setUserStatus(u.id, next);
      toast.success(`User ${next === 'Active' ? 'activated' : 'deactivated'}.`);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  /* ── reset password ─────────────────────────────────────── */
  const handleResetPassword = async () => {
    if (!newPw || newPw.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    try {
      const { data } = await resetUserPassword(resetTarget.id, newPw);
      toast.success(data.message || `Password reset for "${resetTarget.username}".`);
      setShowReset(false);
      setNewPw('');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  /* ── reset to default (firstname@123) ─────────────────── */
  const handleResetToDefault = async (u) => {
    try {
      const { data } = await resetUserPassword(u.id, null);
      toast.success(`Password reset to default (${data.generated_password}). User must change on next login.`, { duration: 6000 });
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  /* ── render ─────────────────────────────────────────────── */
  return (
    <div className="users-page">

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Only the Administrator can create accounts and assign roles</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <MdPersonAdd /> Add User
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="management-filters mb-lg">
        <div className="filters-row">
          <div className="search-input-wrap">
            <MdSearch className="search-icon" />
            <input className="search-input" placeholder="Search by name, username or email..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-control" style={{ maxWidth: 170 }} value={filterRole}
            onChange={e => { setFilterRole(e.target.value); setPage(1); }}>
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r.id} value={r.name}>{r.label}</option>)}
          </select>
          <select className="form-control" style={{ maxWidth: 140 }} value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <button className="btn btn-ghost btn-icon" onClick={fetchUsers} title="Refresh"><MdRefresh /></button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="management-table">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Full Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>School</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i}>{[...Array(9)].map((_, j) => <td key={j}><div className="skeleton skeleton-text" /></td>)}</tr>
                  ))
                : users.length === 0
                  ? <tr><td colSpan={9}><div className="empty-state"><div className="empty-state-icon">👤</div><p className="empty-state-title">No users found</p></div></td></tr>
                  : users.map((u, i) => (
                    <tr key={u.id} className={isSelf(u.id) ? 'self-row' : ''}>
                      <td className="text-muted">{(page - 1) * LIMIT + i + 1}</td>
                      <td>
                        <div className="user-cell">
                          <div className={`avatar ${isSelf(u.id) ? 'avatar-self' : ''}`}>
                            {u.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">
                              {u.full_name}
                              {isSelf(u.id) && <span className="you-badge">You</span>}
                              {u.must_change_password && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 10 }}>⚠ Change Pw</span>}
                            </div>
                            <div className="text-muted text-xs">{u.phone || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td><code className="username-code">{u.username}</code></td>
                      <td className="text-muted text-sm">{u.email}</td>
                      <td><span className={`badge ${roleBadge(u.role_name)}`}>{roleLabel(u.role_name)}</span></td>
                      <td className="text-muted text-sm">{u.school_name || 'District Office'}</td>
                      <td>
                        <span className={`badge ${u.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                          <span className="badge-dot" />{u.status}
                        </span>
                      </td>
                      <td className="text-muted text-xs">
                        {u.last_login
                          ? new Date(u.last_login).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : 'Never'}
                      </td>
                      <td>
                        <div className="action-btns">
                          {/* Permissions */}
                          <button
                            className="btn btn-icon"
                            title="Edit permissions"
                            onClick={() => setPermTarget(u)}
                          >
                            <MdSecurity />
                          </button>
                          {/* Edit */}
                          <button className="btn btn-icon" title="Edit user" onClick={() => openEdit(u)}>
                            <MdEdit />
                          </button>
                          {/* Activate/Deactivate */}
                          <button
                            className="btn btn-icon"
                            title={u.status === 'Active' ? 'Deactivate' : 'Activate'}
                            onClick={() => handleToggleStatus(u)}
                            disabled={isSelf(u.id)}
                          >
                            {u.status === 'Active' ? <MdLockOpen /> : <MdLock />}
                          </button>
                          {/* Reset password */}
                          <button
                            className="btn btn-icon"
                            title="Reset password"
                            onClick={() => { setResetTarget(u); setNewPw(''); setShowNewPw(false); setShowReset(true); }}
                          >
                            <MdKey />
                          </button>
                          {/* Delete */}
                          <button
                            className="btn btn-icon btn-danger-icon"
                            title="Delete user"
                            onClick={() => setDeleteId(u.id)}
                            disabled={isSelf(u.id)}
                          >
                            <MdDelete />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {[...Array(totalPages)].map((_, i) => (
              <button key={i} className={`pagination-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
            ))}
            <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        )}
      </div>

      {/* ══ PERMISSIONS MODAL ══ */}
      {permTarget && (
        <PermissionsModal user={permTarget} onClose={() => { setPermTarget(null); fetchUsers(); }} />
      )}

      {/* ══ ADD / EDIT MODAL ══ */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg animate-scale-in">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{editUser ? `Edit — ${editUser.full_name}` : 'Create New User'}</h3>
                <p className="text-muted text-xs" style={{ marginTop: 3 }}>
                  {editUser
                    ? 'Update user details or change their role.'
                    : 'Administrator creates the account. The user logs in with the username & password you set.'}
                </p>
              </div>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}><MdClose /></button>
            </div>

            <div className="modal-body">
              <div className="modal-section-label">Personal Information</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">Full Name</label>
                  <input className={`form-control ${errors.full_name ? 'error' : ''}`}
                    value={form.full_name} onChange={setF('full_name')} placeholder="e.g. Abebe Kebede" autoFocus />
                  {errors.full_name && <span className="form-error">{errors.full_name}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={form.phone} onChange={setF('phone')} placeholder="+251..." />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label required">Email</label>
                <input type="email" className={`form-control ${errors.email ? 'error' : ''}`}
                  value={form.email} onChange={setF('email')} placeholder="user@tsms.gov.et" />
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>

              <div className="modal-section-label" style={{ marginTop: 20 }}>Login Credentials</div>
              <div className="form-group">
                <label className="form-label required">Username</label>
                <input className={`form-control ${errors.username ? 'error' : ''}`}
                  value={form.username} onChange={setF('username')} placeholder="e.g. abebe.kebede"
                  disabled={!!editUser} />
                {editUser && <span className="form-hint">Username cannot be changed here. The user can change it in their Profile.</span>}
                {errors.username && <span className="form-error">{errors.username}</span>}
              </div>

              {!editUser && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required">Password</label>
                    <div className="pw-field-wrap">
                      <input
                        type={showPw ? 'text' : 'password'}
                        className={`form-control ${errors.password ? 'error' : ''}`}
                        value={form.password} onChange={setF('password')} placeholder="Min. 6 characters" />
                      <button type="button" className="pw-eye-btn" onClick={() => setShowPw(s => !s)}>
                        {showPw ? <MdVisibilityOff /> : <MdVisibility />}
                      </button>
                    </div>
                    {errors.password && <span className="form-error">{errors.password}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Confirm Password</label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      className={`form-control ${errors.confirm_password ? 'error' : ''}`}
                      value={form.confirm_password} onChange={setF('confirm_password')} placeholder="Repeat password" />
                    {errors.confirm_password && <span className="form-error">{errors.confirm_password}</span>}
                  </div>
                </div>
              )}

              <div className="modal-section-label" style={{ marginTop: 20 }}>Role &amp; Access</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">Role</label>
                  <select className={`form-control ${errors.role_id ? 'error' : ''}`}
                    value={form.role_id} onChange={setF('role_id')}>
                    <option value="">— Select Role —</option>
                    {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                  {errors.role_id && <span className="form-error">{errors.role_id}</span>}
                  {form.role_id && (
                    <span className="form-hint">
                      {ROLES.find(r => r.id === parseInt(form.role_id))?.desc}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label className={`form-label ${ROLES.some(r => r.name === 'SchoolManager' && r.id === parseInt(form.role_id, 10)) ? 'required' : ''}`}>Assigned School</label>
                  <select className={`form-control ${errors.school_id ? 'error' : ''}`} value={form.school_id} onChange={setF('school_id')}>
                    <option value="">District Office</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {errors.school_id && <span className="form-error">{errors.school_id}</span>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Account Status</label>
                <div className="status-toggle-row">
                  {['Active', 'Inactive'].map(s => (
                    <button
                      key={s} type="button"
                      className={`status-toggle-btn ${form.status === s ? (s === 'Active' ? 'active-on' : 'active-off') : ''}`}
                      onClick={() => setForm(f => ({ ...f, status: s }))}
                    >
                      {s === 'Active' ? <MdLockOpen /> : <MdLock />} {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner-sm" /> : editUser ? 'Save Changes' : 'Create User Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ RESET PASSWORD MODAL ══ */}
      {showReset && resetTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReset(false)}>
          <div className="modal animate-scale-in" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Reset Password</h3>
                <p className="text-muted text-xs" style={{ marginTop: 3 }}>
                  Setting new password for <strong>{resetTarget.full_name}</strong> ({resetTarget.username})
                </p>
              </div>
              <button className="btn btn-icon" onClick={() => setShowReset(false)}><MdClose /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label required">New Password</label>
                <div className="pw-field-wrap">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    className="form-control"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="Min. 6 characters"
                    autoFocus
                  />
                  <button type="button" className="pw-eye-btn" onClick={() => setShowNewPw(s => !s)}>
                    {showNewPw ? <MdVisibilityOff /> : <MdVisibility />}
                  </button>
                </div>
                <span className="form-hint">The user will be required to change this password on next login.</span>
              </div>
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleResetToDefault(resetTarget)}
                  type="button"
                >
                  <MdKey /> Reset to default (firstname@123)
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowReset(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResetPassword}>
                <MdKey /> Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DELETE CONFIRM MODAL ══ */}
      {deleteId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal animate-scale-in" style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '2.5rem 2rem 1.5rem' }}>
              <div className="delete-icon-wrap"><MdDelete /></div>
              <h3 className="modal-title mb-sm">Delete User?</h3>
              <p className="text-muted" style={{ fontSize: 14 }}>
                This will permanently remove the user account.<br />This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;

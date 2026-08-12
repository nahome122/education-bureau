import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  MdPerson, MdLock, MdSave, MdVisibility, MdVisibilityOff,
  MdEdit, MdClose, MdCameraAlt,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { saveMyProfile } from '../../utils/apiCall';
import './Profile.css';

// ── Photo key — shared with IdCards ──────────────────────────────────────────
const getPhotoKey = (user) => {
  if (user?.emp_type && user?.emp_id) return `tsms_photo_${user.emp_type}_${user.emp_id}`;
  return `tsms_profile_photo_${user?.id}`;
};

// ── Role badge colour ─────────────────────────────────────────────────────────
const roleBadge = (role) => ({
  Administrator:     'badge-danger',
  SchoolManager:     'badge-primary',
  AttendanceOfficer: 'badge-warning',
  Viewer:            'badge-gray',
}[role] || 'badge-primary');

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U';

// ═════════════════════════════════════════════════════════════
const Profile = () => {
  const { user, changePassword, changeUsername, refreshUser } = useAuth();
  const location = useLocation();

  const [tab, setTab] = useState(
    location.search?.includes('password') ? 'password' : 'info'
  );
  const [editing, setEditing] = useState(false);

  // ── Local editable copy of profile fields ─────────────────
  // This is totally independent of `user` — updated only on Save or Cancel
  const [draft, setDraft] = useState({
    full_name: user?.full_name || '',
    phone:     user?.phone     || '',
    email:     user?.email     || '',
    gender:    user?.gender    || '',
    dob:       user?.dob       || '',
    address:   user?.address   || '',
    bio:       user?.bio       || '',
  });
  const [draftErrors, setDraftErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // ── Profile photo ─────────────────────────────────────────
  const [photo, setPhoto] = useState(() =>
    localStorage.getItem(getPhotoKey(user)) || null
  );

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      localStorage.setItem(getPhotoKey(user), b64);
      setPhoto(b64);
      toast.success('Photo updated — also visible on your ID card.');
    };
    reader.readAsDataURL(file);
  };

  // ── Open edit: copy current user values into draft ────────
  const openEdit = () => {
    setDraft({
      full_name: user?.full_name || '',
      phone:     user?.phone     || '',
      email:     user?.email     || '',
      gender:    user?.gender    || '',
      dob:       user?.dob       || '',
      address:   user?.address   || '',
      bio:       user?.bio       || '',
    });
    setDraftErrors({});
    setEditing(true);
  };

  // ── Cancel: discard draft ──────────────────────────────────
  const cancelEdit = () => {
    setDraftErrors({});
    setEditing(false);
  };

  // ── Save: validate → persist → update context ─────────────
  const handleSave = async () => {
    const errs = {};
    if (!draft.full_name.trim()) errs.full_name = 'Full name is required.';
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email))
      errs.email = 'Enter a valid email.';
    if (Object.keys(errs).length) { setDraftErrors(errs); return; }

    setSaving(true);

    const payload = {
      full_name: draft.full_name.trim(),
      phone:     draft.phone.trim(),
      email:     draft.email.trim(),
      gender:    draft.gender,
      dob:       draft.dob,
      address:   draft.address.trim(),
      bio:       draft.bio.trim(),
    };

    try {
      const { data } = await saveMyProfile(user, payload);
      if (!data.success) {
        toast.error(data.message || 'Failed to save profile.');
        setSaving(false);
        return;
      }

      const updated = data.user || { ...user, ...payload };
      refreshUser(updated);
      setEditing(false);
      setDraftErrors({});
      toast.success('Profile saved successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  // ── Change username ──────────────────────────────────────
  const [unForm, setUnForm] = useState({ new_username: '', confirm: '' });
  const [savingUn, setSavingUn] = useState(false);
  const [unErrors, setUnErrors] = useState({});

  const handleChangeUsername = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!unForm.new_username || unForm.new_username.length < 3) errs.new_username = 'Username must be at least 3 characters.';
    if (unForm.new_username !== unForm.confirm) errs.confirm = 'Usernames do not match.';
    if (unForm.new_username === user?.username) errs.new_username = 'New username must be different from current.';
    if (Object.keys(errs).length) { setUnErrors(errs); return; }

    setSavingUn(true);
    setUnErrors({});
    const result = await changeUsername(unForm.new_username);
    setSavingUn(false);

    if (result.success) {
      toast.success('Username changed successfully.');
      setUnForm({ new_username: '', confirm: '' });
      setUnErrors({});
    } else {
      toast.error(result.message || 'Failed to change username.');
      setUnErrors({ submit: result.message || 'Failed to change username.' });
    }
  };

  // ── Change password ───────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);
  const [pwErrors, setPwErrors] = useState({});

  const handleChangePw = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pwForm.current)                         errs.current  = 'Current password required.';
    if (!pwForm.next || pwForm.next.length < 6)  errs.next     = 'Min. 6 characters.';
    if (pwForm.next !== pwForm.confirm)           errs.confirm  = 'Passwords do not match.';
    if (Object.keys(errs).length) { setPwErrors(errs); return; }

    setSavingPw(true);
    const result = await changePassword(pwForm.current, pwForm.next);
    setSavingPw(false);

    if (result.success) {
      toast.success('Password changed successfully.');
      setPwForm({ current: '', next: '', confirm: '' });
      setPwErrors({});
    } else {
      toast.error(result.message || 'Failed to change password.');
    }
  };

  // ── Helpers ───────────────────────────────────────────────
  const d = (k) => draft[k] ?? '';
  const sd = (k) => (e) => setDraft(p => ({ ...p, [k]: e.target.value }));

  // Current display values — read from `user` (context)
  const v = (k) => user?.[k] || '—';

  return (
    <div className="profile-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">View and edit your account details</p>
        </div>
      </div>

      <div className="profile-layout">

        {/* ── Left card ── */}
        <div className="card profile-card">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar-container">
              <div className="profile-avatar">
                {photo
                  ? <img src={photo} alt={user?.full_name} className="profile-avatar-img" />
                  : initials(user?.full_name)
                }
              </div>
              <label className="profile-photo-upload" htmlFor="profile-photo-input" title="Change photo">
                <MdCameraAlt />
                <input id="profile-photo-input" type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
              </label>
            </div>
            <h2 className="profile-name">{user?.full_name}</h2>
            <span className={`badge ${roleBadge(user?.role_name)} profile-role-badge`}>
              {user?.role_label || user?.role_name}
            </span>
          </div>

          <div className="profile-details">
            {[
              ['Username', <code key="u">{user?.username}</code>],
              ['Email',    user?.email   || '—'],
              ['Phone',    user?.phone   || '—'],
              ['School',   user?.school_name || 'District Office'],
              user?.gender  ? ['Gender',        user.gender]  : null,
              user?.dob     ? ['Date of Birth', new Date(user.dob).toLocaleDateString('en-GB')] : null,
              user?.address ? ['Address',       user.address] : null,
            ].filter(Boolean).map(([label, val]) => (
              <div key={label} className="profile-detail-item">
                <span className="profile-detail-label">{label}</span>
                <span className="profile-detail-val">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="profile-main">
          <div className="tabs mb-lg">
            <button className={`tab-btn ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>
              <MdPerson /> Account Info
            </button>
            <button className={`tab-btn ${tab === 'username' ? 'active' : ''}`} onClick={() => setTab('username')}>
              <MdLock /> Change Username
            </button>
            <button className={`tab-btn ${tab === 'password' ? 'active' : ''}`} onClick={() => setTab('password')}>
              <MdLock /> Change Password
            </button>
          </div>

          {/* ── Info tab ── */}
          {tab === 'info' && (
            <div className="card">
              <div className="profile-tab-header">
                <h3 className="card-title">Account Information</h3>
                {!editing
                  ? <button className="btn btn-outline btn-sm" onClick={openEdit}><MdEdit /> Edit Profile</button>
                  : <button className="btn btn-ghost btn-sm"   onClick={cancelEdit}><MdClose /> Cancel</button>
                }
              </div>

              {!editing ? (
                /* ── Read-only ── */
                <div className="profile-info-grid">
                  {[
                    ['Full Name',     v('full_name')],
                    ['Username',      <code key="u">{user?.username}</code>],
                    ['Email',         v('email')],
                    ['Phone',         v('phone')],
                    ['Gender',        v('gender')],
                    ['Date of Birth', user?.dob ? new Date(user.dob).toLocaleDateString('en-GB') : '—'],
                    ['Address',       v('address')],
                    ['Role',          <span key="r" className={`badge ${roleBadge(user?.role_name)}`}>{user?.role_label || user?.role_name}</span>],
                    ['School',        user?.school_name || 'District Office'],
                  ].map(([label, val]) => (
                    <div key={label} className="profile-info-row">
                      <label>{label}</label><span>{val}</span>
                    </div>
                  ))}
                  {user?.bio && (
                    <div className="profile-info-row profile-info-full">
                      <label>Bio</label><span>{user.bio}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Edit form ── */
                <div className="profile-edit-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label required">Full Name</label>
                      <input className={`form-control ${draftErrors.full_name ? 'error' : ''}`}
                        value={d('full_name')} onChange={sd('full_name')} placeholder="Your full name" />
                      {draftErrors.full_name && <span className="form-error">{draftErrors.full_name}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input className="form-control" value={d('phone')} onChange={sd('phone')} placeholder="+251..." />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input type="email" className={`form-control ${draftErrors.email ? 'error' : ''}`}
                        value={d('email')} onChange={sd('email')} placeholder="your@email.com" />
                      {draftErrors.email && <span className="form-error">{draftErrors.email}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gender</label>
                      <select className="form-control" value={d('gender')} onChange={sd('gender')}>
                        <option value="">— Select —</option>
                        <option>Male</option><option>Female</option><option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Date of Birth</label>
                      <input type="date" className="form-control" value={d('dob')} onChange={sd('dob')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Address</label>
                      <input className="form-control" value={d('address')} onChange={sd('address')} placeholder="Your address" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Bio / Notes</label>
                    <textarea className="form-control" rows={3} value={d('bio')} onChange={sd('bio')}
                      placeholder="A short description about yourself..." style={{ resize: 'vertical', minHeight: 72 }} />
                  </div>

                  <div className="profile-readonly-note">
                    <MdPerson style={{ flexShrink: 0 }} />
                    To change username or password, use the dedicated tabs above. Role and school can only be changed by an Administrator.
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                      {saving ? <span className="spinner-sm" /> : <><MdSave /> Save Changes</>}
                    </button>
                    <button className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Username tab ── */}
          {tab === 'username' && (
            <div className="card">
              <h3 className="card-title mb-lg">Change Username</h3>
              {unErrors.submit && <div style={{ color: '#dc2626', marginBottom: 16 }}>{unErrors.submit}</div>}
              <form onSubmit={handleChangeUsername} style={{ maxWidth: 440 }}>
                <div className="form-group mb-md">
                  <label className="form-label required">New Username</label>
                  <input
                    type="text"
                    className={`form-control ${unErrors.new_username ? 'error' : ''}`}
                    value={unForm.new_username}
                    onChange={e => setUnForm(p => ({ ...p, new_username: e.target.value.toLowerCase() }))}
                    placeholder="At least 3 characters"
                  />
                  {unErrors.new_username && <span className="form-error">{unErrors.new_username}</span>}
                </div>
                <div className="form-group mb-md">
                  <label className="form-label required">Confirm Username</label>
                  <input
                    type="text"
                    className={`form-control ${unErrors.confirm ? 'error' : ''}`}
                    value={unForm.confirm}
                    onChange={e => setUnForm(p => ({ ...p, confirm: e.target.value.toLowerCase() }))}
                    placeholder="Repeat new username"
                  />
                  {unErrors.confirm && <span className="form-error">{unErrors.confirm}</span>}
                </div>
                <button type="submit" className="btn btn-primary" disabled={savingUn}>
                  {savingUn ? <span className="spinner-sm" /> : <><MdSave /> Change Username</>}
                </button>
              </form>
            </div>
          )}

          {/* ── Password tab ── */}
          {tab === 'password' && (
            <div className="card">
              <h3 className="card-title mb-lg">Change Password</h3>
              <form onSubmit={handleChangePw} style={{ maxWidth: 440 }}>
                {[
                  { key: 'current', label: 'Current Password',  placeholder: 'Enter current password' },
                  { key: 'next',    label: 'New Password',       placeholder: 'Min. 6 characters' },
                  { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="form-group mb-md">
                    <label className="form-label required">{label}</label>
                    <div className="pw-field">
                      <input
                        type={showPw[key] ? 'text' : 'password'}
                        className={`form-control ${pwErrors[key] ? 'error' : ''}`}
                        value={pwForm[key]}
                        onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                      />
                      <button type="button" className="pw-toggle"
                        onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}>
                        {showPw[key] ? <MdVisibilityOff /> : <MdVisibility />}
                      </button>
                    </div>
                    {pwErrors[key] && <span className="form-error">{pwErrors[key]}</span>}
                  </div>
                ))}
                <button type="submit" className="btn btn-primary" disabled={savingPw}>
                  {savingPw ? <span className="spinner-sm" /> : <><MdSave /> Change Password</>}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;

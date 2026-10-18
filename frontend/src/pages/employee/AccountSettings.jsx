import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MdBadge, MdKey, MdPerson, MdVisibility, MdVisibilityOff, MdSave, MdCheck } from 'react-icons/md';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Profile from '../profile/Profile';
import IdCards from '../idcards/IdCards';
import './AccountSettings.css';

/* ── Password strength helpers ── */
const checkStrength = (pw = '') => {
  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))           score++;
  if (/[a-z]/.test(pw))           score++;
  if (/\d/.test(pw))              score++;
  if (/[^A-Za-z0-9]/.test(pw))   score++;
  return score; // 0-5
};
const strengthLabel = [null, 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
const strengthColor = [null, '#ef4444',   '#f97316', '#f59e0b', '#10b981', '#059669'];

const AccountSettings = () => {
  const { user, changePassword, changeUsername, clearMustChangePassword, mustChangePassword } = useAuth();
  const location = useLocation();

  const [tab, setTab] = useState(mustChangePassword ? 'password' : 'username');
  const [view, setView] = useState(() => (
    new URLSearchParams(location.search).get('tab') === 'profile' ? 'profile' : 'credentials'
  ));

  useEffect(() => {
    if (new URLSearchParams(location.search).get('tab') === 'profile') {
      setView('profile');
    }
  }, [location.search]);

  /* ── Change username ── */
  const [newUsername, setNewUsername] = useState('');
  const [usernameErr, setUsernameErr] = useState('');
  const [savingUname, setSavingUname] = useState(false);

  const handleChangeUsername = async () => {
    setUsernameErr('');
    if (!newUsername.trim() || newUsername.trim().length < 3) {
      setUsernameErr('Username must be at least 3 characters.');
      return;
    }
    setSavingUname(true);
    const result = await changeUsername(newUsername.trim().toLowerCase());
    setSavingUname(false);
    if (result.success) {
      toast.success('Username changed successfully.');
      setNewUsername('');
    } else {
      setUsernameErr(result.message || 'Failed to change username.');
    }
  };

  /* ── Change password ── */
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwErr,  setPwErr]  = useState({});
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);
  const strength = checkStrength(pwForm.newPw);

  const setP = (key) => (e) => {
    setPwForm(f => ({ ...f, [key]: e.target.value }));
    if (pwErr[key]) setPwErr(er => { const c = { ...er }; delete c[key]; return c; });
  };

  const toggleShow = (key) => setShowPw(s => ({ ...s, [key]: !s[key] }));

  const validatePw = () => {
    const e = {};
    if (!pwForm.current)             e.current = 'Current password is required.';
    if (pwForm.newPw.length < 8)     e.newPw   = 'Password must be at least 8 characters.';
    if (pwForm.newPw !== pwForm.confirm) e.confirm = 'Passwords do not match.';
    return e;
  };

  const handleChangePassword = async () => {
    const errs = validatePw();
    if (Object.keys(errs).length) { setPwErr(errs); return; }
    setSavingPw(true);
    const result = await changePassword(pwForm.current, pwForm.newPw);
    setSavingPw(false);
    if (result.success) {
      toast.success('Password changed successfully!');
      setPwForm({ current: '', newPw: '', confirm: '' });
      if (mustChangePassword) clearMustChangePassword();
    } else {
      setPwErr({ current: result.message || 'Failed to change password.' });
    }
  };

  return (
    <div className="account-settings">
      <div className="page-header">
        <div>
          <h1 className="page-title">Account Settings</h1>
          <p className="page-subtitle">Manage your profile, employee ID card, and login credentials.</p>
        </div>
      </div>

      {mustChangePassword && (
        <div className="must-change-inline-banner">
          <MdKey /> You must change your default password before using the system.
        </div>
      )}

      <div className="accs-section-tabs" role="tablist" aria-label="Account settings sections">
        <button type="button" role="tab" aria-selected={view === 'credentials'} className={`accs-section-tab ${view === 'credentials' ? 'active' : ''}`} onClick={() => setView('credentials')}>
          <MdKey /> Login credentials
        </button>
        <button type="button" role="tab" aria-selected={view === 'profile'} className={`accs-section-tab ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>
          <MdPerson /> My Profile
        </button>
        <button type="button" role="tab" aria-selected={view === 'id-card'} className={`accs-section-tab ${view === 'id-card' ? 'active' : ''}`} onClick={() => setView('id-card')}>
          <MdBadge /> View my ID card
        </button>
      </div>

      {view === 'credentials' && <div className="card accs-card">
        {/* Tabs */}
        <div className="accs-tabs">
          <button className={`accs-tab ${tab === 'username' ? 'active' : ''}`} onClick={() => setTab('username')}>
            <MdPerson /> Change Username
          </button>
          <button className={`accs-tab ${tab === 'password' ? 'active' : ''}`} onClick={() => setTab('password')}>
            <MdKey /> Change Password
          </button>
        </div>

        {/* ── Username tab ── */}
        {tab === 'username' && (
          <div className="accs-body">
            <div className="accs-current-row">
              <span className="accs-label">Current username</span>
              <code className="accs-current-val">{user?.username || '—'}</code>
            </div>
            <div className="form-group">
              <label className="form-label required">New Username</label>
              <input
                className={`form-control ${usernameErr ? 'error' : ''}`}
                value={newUsername}
                onChange={e => { setNewUsername(e.target.value); setUsernameErr(''); }}
                placeholder="e.g. john.doe"
                autoComplete="off"
              />
              {usernameErr && <span className="form-error">{usernameErr}</span>}
              <span className="form-hint">Minimum 3 characters. Only lowercase letters, numbers and dots allowed.</span>
            </div>
            <div className="accs-actions">
              <button className="btn btn-primary" onClick={handleChangeUsername} disabled={savingUname || !newUsername.trim()}>
                {savingUname ? <span className="spinner-sm" /> : <MdSave />}
                {savingUname ? 'Saving…' : 'Save Username'}
              </button>
            </div>
          </div>
        )}

        {/* ── Password tab ── */}
        {tab === 'password' && (
          <div className="accs-body">
            {/* Current password */}
            <div className="form-group">
              <label className="form-label required">Current Password</label>
              <div className="pw-field-wrap">
                <input
                  type={showPw.current ? 'text' : 'password'}
                  className={`form-control ${pwErr.current ? 'error' : ''}`}
                  value={pwForm.current}
                  onChange={setP('current')}
                  placeholder="Your current password"
                  autoComplete="current-password"
                />
                <button type="button" className="pw-eye-btn" onClick={() => toggleShow('current')}>
                  {showPw.current ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
              {pwErr.current && <span className="form-error">{pwErr.current}</span>}
            </div>

            {/* New password */}
            <div className="form-group">
              <label className="form-label required">New Password</label>
              <div className="pw-field-wrap">
                <input
                  type={showPw.newPw ? 'text' : 'password'}
                  className={`form-control ${pwErr.newPw ? 'error' : ''}`}
                  value={pwForm.newPw}
                  onChange={setP('newPw')}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
                <button type="button" className="pw-eye-btn" onClick={() => toggleShow('newPw')}>
                  {showPw.newPw ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
              {pwErr.newPw && <span className="form-error">{pwErr.newPw}</span>}

              {/* Strength meter */}
              {pwForm.newPw && (
                <div className="pw-strength-wrap">
                  <div className="pw-strength-bar">
                    {[1,2,3,4,5].map(i => (
                      <div
                        key={i}
                        className="pw-strength-seg"
                        style={{ background: i <= strength ? strengthColor[strength] : 'var(--border)' }}
                      />
                    ))}
                  </div>
                  <span className="pw-strength-label" style={{ color: strengthColor[strength] }}>
                    {strengthLabel[strength]}
                  </span>
                </div>
              )}

              {/* Rules */}
              <div className="pw-rules">
                {[
                  { test: pwForm.newPw.length >= 8,          label: 'At least 8 characters' },
                  { test: /[A-Z]/.test(pwForm.newPw),        label: 'One uppercase letter' },
                  { test: /[0-9]/.test(pwForm.newPw),        label: 'One number' },
                  { test: /[^A-Za-z0-9]/.test(pwForm.newPw), label: 'One special character' },
                ].map((r, i) => (
                  <div key={i} className={`pw-rule ${r.test ? 'pw-rule--ok' : ''}`}>
                    <MdCheck /> {r.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm */}
            <div className="form-group">
              <label className="form-label required">Confirm New Password</label>
              <div className="pw-field-wrap">
                <input
                  type={showPw.confirm ? 'text' : 'password'}
                  className={`form-control ${pwErr.confirm ? 'error' : ''}`}
                  value={pwForm.confirm}
                  onChange={setP('confirm')}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                <button type="button" className="pw-eye-btn" onClick={() => toggleShow('confirm')}>
                  {showPw.confirm ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
              {pwErr.confirm && <span className="form-error">{pwErr.confirm}</span>}
            </div>

            <div className="accs-actions">
              <button className="btn btn-primary" onClick={handleChangePassword} disabled={savingPw}>
                {savingPw ? <span className="spinner-sm" /> : <MdKey />}
                {savingPw ? 'Saving…' : 'Change Password'}
              </button>
            </div>
          </div>
        )}
      </div>}
      {view === 'profile' && <Profile />}
      {view === 'id-card' && <IdCards />}
    </div>
  );
};

export default AccountSettings;

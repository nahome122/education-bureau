import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdLock, MdPerson, MdKey, MdCheck, MdWarning, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { requestPasswordReset, confirmPasswordReset } from '../../utils/apiCall';
import './Login.css';

const STEPS = ['request', 'verify', 'success'];

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('request');

  /* Step 1 */
  const [identifier, setIdentifier] = useState('');
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError,   setReqError]   = useState('');
  const [mockCode,   setMockCode]   = useState(''); // shown in mock mode

  /* Step 2 */
  const [code,     setCode]    = useState('');
  const [newPw,    setNewPw]   = useState('');
  const [confPw,   setConfPw]  = useState('');
  const [showPw,   setShowPw]  = useState(false);
  const [cfmLoading, setCfmLoading] = useState(false);
  const [cfmError,   setCfmError]   = useState('');

  /* Step 1 — request code */
  const handleRequest = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) { setReqError('Please enter your username or email.'); return; }
    setReqLoading(true);
    setReqError('');
    try {
      const { data } = await requestPasswordReset(identifier.trim());
      if (data.success) {
        if (data.mock_code) setMockCode(data.mock_code);
        setStep('verify');
      }
    } catch (err) {
      setReqError(err.response?.data?.message || 'Account not found. Check your username or email.');
    }
    setReqLoading(false);
  };

  /* Step 2 — confirm code + new password */
  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!code.trim())           { setCfmError('Please enter the reset code.'); return; }
    if (newPw.length < 8)       { setCfmError('Password must be at least 8 characters.'); return; }
    if (newPw !== confPw)       { setCfmError('Passwords do not match.'); return; }
    setCfmLoading(true);
    setCfmError('');
    try {
      const { data } = await confirmPasswordReset(code.trim(), newPw);
      if (data.success) setStep('success');
    } catch (err) {
      setCfmError(err.response?.data?.message || 'Invalid or expired code.');
    }
    setCfmLoading(false);
  };

  return (
    <div className="login-wrapper">
      <div className="login-watermark" aria-hidden="true" />
      <div className="login-card">
        <div className="login-form-panel">
          <div className="login-form-inner">

            {/* Logo */}
            <div className="login-logo-wrap">
              <img src="/logo.jpg" alt="Wachale Woreda" className="login-logo-img" />
            </div>

            {/* Step indicator */}
            <div className="forgot-steps">
              {[{ icon: <MdPerson />, label: 'Identify' }, { icon: <MdKey />, label: 'Verify' }, { icon: <MdCheck />, label: 'Done' }].map((s, i) => {
                const idx = STEPS.indexOf(step);
                return (
                  <React.Fragment key={i}>
                    <div className={`forgot-step ${i <= idx ? 'active' : ''}`}>
                      <span className="forgot-step-icon">{s.icon}</span>
                      <span className="forgot-step-label">{s.label}</span>
                    </div>
                    {i < 2 && <div className={`forgot-step-line ${i < idx ? 'active' : ''}`} />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* ── Step 1: Request ── */}
            {step === 'request' && (
              <>
                <h1 className="login-title">Forgot Password</h1>
                <p className="login-subtitle">Enter your username or email address and we'll send you a reset code.</p>

                {reqError && (
                  <div className="login-error animate-shake">
                    <MdWarning /> {reqError}
                  </div>
                )}

                <form onSubmit={handleRequest} className="login-form" noValidate>
                  <div className="login-field">
                    <label className="login-label">Username or Email</label>
                    <div className="login-input-wrap">
                      <MdPerson className="login-input-icon" />
                      <input
                        type="text" className="login-input"
                        placeholder="e.g. john.doe or john@edu.gov.et"
                        value={identifier}
                        onChange={e => { setIdentifier(e.target.value); setReqError(''); }}
                        autoFocus autoComplete="username"
                      />
                    </div>
                  </div>

                  <button type="submit" className={`login-btn ${reqLoading ? 'loading' : ''}`} disabled={reqLoading}>
                    {reqLoading ? <span className="login-spinner" /> : <><span>Send Reset Code</span><MdKey /></>}
                  </button>
                </form>
              </>
            )}

            {/* ── Step 2: Verify ── */}
            {step === 'verify' && (
              <>
                <h1 className="login-title">Enter Reset Code</h1>
                <p className="login-subtitle">A reset code was generated. Enter it below along with your new password.</p>

                {/* Mock mode: show code inline */}
                {mockCode && (
                  <div className="forgot-mock-code">
                    <span className="forgot-mock-label">🔑 Reset code (mock):</span>
                    <code className="forgot-mock-val">{mockCode}</code>
                  </div>
                )}

                {cfmError && (
                  <div className="login-error animate-shake"><MdWarning /> {cfmError}</div>
                )}

                <form onSubmit={handleConfirm} className="login-form" noValidate>
                  <div className="login-field">
                    <label className="login-label">Reset Code</label>
                    <div className="login-input-wrap">
                      <MdKey className="login-input-icon" />
                      <input
                        type="text" className="login-input login-input--code"
                        placeholder="6-digit code"
                        value={code}
                        onChange={e => { setCode(e.target.value); setCfmError(''); }}
                        maxLength={6}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="login-field">
                    <label className="login-label">New Password</label>
                    <div className="login-input-wrap">
                      <MdLock className="login-input-icon" />
                      <input
                        type={showPw ? 'text' : 'password'} className="login-input"
                        placeholder="Min. 8 characters"
                        value={newPw}
                        onChange={e => { setNewPw(e.target.value); setCfmError(''); }}
                        autoComplete="new-password"
                      />
                      <button type="button" className="login-eye-btn" onClick={() => setShowPw(s => !s)} tabIndex={-1}>
                        {showPw ? <MdVisibilityOff /> : <MdVisibility />}
                      </button>
                    </div>
                  </div>

                  <div className="login-field">
                    <label className="login-label">Confirm New Password</label>
                    <div className="login-input-wrap">
                      <MdLock className="login-input-icon" />
                      <input
                        type={showPw ? 'text' : 'password'} className="login-input"
                        placeholder="Repeat new password"
                        value={confPw}
                        onChange={e => { setConfPw(e.target.value); setCfmError(''); }}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <button type="submit" className={`login-btn ${cfmLoading ? 'loading' : ''}`} disabled={cfmLoading}>
                    {cfmLoading ? <span className="login-spinner" /> : <><span>Reset Password</span><MdCheck /></>}
                  </button>
                </form>

                <button className="forgot-back-link" onClick={() => setStep('request')}>
                  <MdArrowBack /> Try a different account
                </button>
              </>
            )}

            {/* ── Step 3: Success ── */}
            {step === 'success' && (
              <div className="forgot-success">
                <div className="forgot-success-icon"><MdCheck /></div>
                <h1 className="login-title">Password Reset!</h1>
                <p className="login-subtitle">Your password has been updated successfully. You can now log in with your new password.</p>
                <button className="login-btn" onClick={() => navigate('/')}>
                  <span>Back to Login</span><MdArrowBack />
                </button>
              </div>
            )}

            {step !== 'success' && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <Link to="/" className="forgot-back-link"><MdArrowBack /> Back to Login</Link>
              </div>
            )}

            <p className="login-copyright">
              © {new Date().getFullYear()} Wachale Woreda Education Bureau. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

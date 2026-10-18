import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MdPerson, MdLock, MdVisibility, MdVisibilityOff,
  MdArrowForward, MdWarning
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const Login = () => {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form,         setForm]         = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [remember,     setRemember]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    const result = await login(form.username.trim(), form.password, remember);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setError(result.message || 'Invalid username or password.');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-watermark" aria-hidden="true" />
      <div className="login-card">
        <div className="login-form-panel">
          <div className="login-form-inner">

            {/* Logo + title */}
            <div className="login-logo-wrap">
              <img
                src="/logo.jpg"
                alt="Wachale Woreda Education Bureau"
                className="login-logo-img"
              />
            </div>

            <h1 className="login-title">Welcome Back</h1>
            <p className="login-subtitle">
              Wachale Woreda Education Bureau<br />
              Teacher &amp; Staff Management System
            </p>

            {/* Error */}
            {error && (
              <div className="login-error animate-shake">
                <MdWarning /> {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="login-form">
              <div className="login-field">
                <label className="login-label" htmlFor="login-username">Username</label>
                <div className="login-input-wrap">
                  <MdPerson className="login-input-icon" />
                  <input
                    type="text"
                    id="login-username"
                    name="username"
                    className="login-input"
                    placeholder="Enter your username"
                    value={form.username}
                    onChange={handleChange}
                    autoComplete="username"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="login-password">Password</label>
                <div className="login-input-wrap">
                  <MdLock className="login-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="login-password"
                    name="password"
                    className="login-input"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                  </button>
                </div>
              </div>

              <div className="login-row">
                <label className="login-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="login-checkbox"
                  />
                  Remember me
                </label>
                <Link to="/forgot-password" className="login-forgot-link">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                className={`login-btn ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading
                  ? <span className="login-spinner" />
                  : <><span>Sign In</span> <MdArrowForward /></>
                }
              </button>
            </form>

            <p className="login-copyright">
              © {new Date().getFullYear()} Wachale Woreda Education Bureau. All rights reserved.
            </p>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

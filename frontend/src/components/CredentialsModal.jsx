import React, { useState } from 'react';
import { MdClose, MdContentCopy, MdCheck, MdPerson, MdLock } from 'react-icons/md';
import './CredentialsModal.css';

/**
 * CredentialsModal — shown after creating a Teacher or Staff account.
 * Displays auto-generated username and default password with copy buttons.
 */
const CredentialsModal = ({ name, username, password, onClose }) => {
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPw,   setCopiedPw]   = useState(false);

  const copy = async (text, setCopied) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-scale-in cred-modal">
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Account Created ✓</h3>
            <p className="text-muted text-xs" style={{ marginTop: 3 }}>
              Hand these credentials to <strong>{name}</strong>
            </p>
          </div>
          <button className="btn btn-icon" onClick={onClose}><MdClose /></button>
        </div>

        <div className="modal-body">
          <div className="cred-note">
            <span className="cred-note-icon">🔑</span>
            The employee must change their password on first login.
          </div>

          <div className="cred-field">
            <label className="cred-label"><MdPerson /> Username</label>
            <div className="cred-value-row">
              <code className="cred-value">{username}</code>
              <button
                className={`cred-copy-btn ${copiedUser ? 'copied' : ''}`}
                onClick={() => copy(username, setCopiedUser)}
                title="Copy username"
              >
                {copiedUser ? <MdCheck /> : <MdContentCopy />}
                {copiedUser ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="cred-field">
            <label className="cred-label"><MdLock /> Default Password</label>
            <div className="cred-value-row">
              <code className="cred-value">{password}</code>
              <button
                className={`cred-copy-btn ${copiedPw ? 'copied' : ''}`}
                onClick={() => copy(password, setCopiedPw)}
                title="Copy password"
              >
                {copiedPw ? <MdCheck /> : <MdContentCopy />}
                {copiedPw ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="cred-hint">
            Login URL: <code>{window.location.origin}/</code>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default CredentialsModal;

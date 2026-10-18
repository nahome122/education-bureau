import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MdLockOutline, MdArrowBack } from 'react-icons/md';
import './AccessDenied.css';

const AccessDenied = () => {
  const navigate = useNavigate();
  return (
    <div className="access-denied-page">
      <div className="access-denied-card animate-scale-in">
        <div className="access-denied-icon">
          <MdLockOutline />
        </div>
        <h1>403</h1>
        <h2>Access Denied</h2>
        <p>You do not have permission to access this page.<br />Please contact your Administrator.</p>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
          <MdArrowBack /> Go to Dashboard
        </button>
      </div>
    </div>
  );
};

export default AccessDenied;

import axios from 'axios';
import toast from 'react-hot-toast';

// Local dev:  VITE_API_URL=http://localhost:5000/api  (set in client/.env)
// Production: relative /api (server serves the client on the same origin)
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 12000,
});

// ── Request interceptor — attach JWT ────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('tsms_token') ||
      sessionStorage.getItem('tsms_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — surface every error clearly ──────────────────────
api.interceptors.response.use(
  // Success — pass through unchanged
  (res) => res,

  (error) => {
    const status  = error.response?.status;
    const data    = error.response?.data;
    const message = data?.message || error.message || 'Unknown error.';

    // ── Network / timeout — server is unreachable ──
    if (!error.response) {
      const isTimeout = error.code === 'ECONNABORTED';
      const msg = isTimeout
        ? 'Request timed out — the server may be overloaded.'
        : 'Cannot reach the server — make sure XAMPP MySQL and the Node server are running.';
      toast.error(msg, { id: 'network-error', duration: 5000 });
      return Promise.reject(error);
    }

    // ── 401 Unauthorized — token expired or invalid ──
    if (status === 401) {
      const token =
        localStorage.getItem('tsms_token') ||
        sessionStorage.getItem('tsms_token');
      if (token) {
        localStorage.removeItem('tsms_token');
        localStorage.removeItem('tsms_user');
        sessionStorage.removeItem('tsms_token');
        sessionStorage.removeItem('tsms_user');
        toast.error('Session expired — please log in again.', { id: 'auth-error' });
        setTimeout(() => { window.location.href = '/'; }, 1500);
      }
      return Promise.reject(error);
    }

    // ── 403 Forbidden ──
    if (status === 403) {
      toast.error('Access denied — you do not have permission for this action.', { id: 'forbidden' });
      return Promise.reject(error);
    }

    // ── 409 Conflict — duplicate entry, FK violation ──
    if (status === 409) {
      toast.error(message, { id: 'conflict-error' });
      return Promise.reject(error);
    }

    // ── 422 Validation error ──
    if (status === 422) {
      const fieldErrors = data?.errors;
      if (fieldErrors?.length) {
        fieldErrors.forEach(e =>
          toast.error(`${e.field}: ${e.message}`, { duration: 4000 })
        );
      } else {
        toast.error(message, { id: 'validation-error' });
      }
      return Promise.reject(error);
    }

    // ── 503 Service Unavailable — DB connection lost ──
    if (status === 503) {
      toast.error(`Database error: ${message}`, { id: 'db-error', duration: 6000 });
      return Promise.reject(error);
    }

    // ── 500 Internal Server Error ──
    if (status === 500) {
      toast.error(`Server error: ${message}`, { id: 'server-error', duration: 5000 });
      return Promise.reject(error);
    }

    // ── All other errors — surface the message ──
    if (message) {
      toast.error(message, { duration: 4000 });
    }

    return Promise.reject(error);
  }
);

export default api;

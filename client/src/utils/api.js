import axios from 'axios';

// In production the server serves the client from the same origin,
// so we use a relative path (/api) — no hardcoded host needed.
// In local development VITE_API_URL points to http://localhost:5000/api.
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 8000, // slightly longer for deployed environments
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tsms_token') || sessionStorage.getItem('tsms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('tsms_token') || sessionStorage.getItem('tsms_token');
      if (token && !token.startsWith('mock-token-')) {
        localStorage.removeItem('tsms_token');
        localStorage.removeItem('tsms_user');
        sessionStorage.removeItem('tsms_token');
        sessionStorage.removeItem('tsms_user');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

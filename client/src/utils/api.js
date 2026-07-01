import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 3000, // 3s max — fail fast so mock fallback kicks in
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

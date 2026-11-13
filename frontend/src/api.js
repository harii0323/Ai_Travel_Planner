import axios from 'axios';

// Dynamically determine the backend API base URL
const getBaseURL = () => {
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }
  
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || 'localhost';
    // If running on local machine in development, hit port 5000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:5000`;
    }
    // On Vercel or cloud deployments, use the origin domain (reverse proxied /api/ routes)
    return window.location.origin;
  }
  
  return 'http://localhost:5000';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Auto-attach JWT token if present in localStorage
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('token');
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Ignore localStorage read errors in non-browser environments
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to format errors and handle expired session
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If token is invalid or expired, clear client session to prevent infinite stale auth loops
    if (error.response?.status === 401) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } catch (e) {
        // ignore storage errors
      }
    }

    // If backend is completely unreachable
    if (!error.response) {
      const targetUrl = api.defaults.baseURL || 'http://localhost:5000';
      error.message = `Cannot connect to the server at ${targetUrl}. Please ensure the backend is running.`;
    }
    return Promise.reject(error);
  }
);

export default api;

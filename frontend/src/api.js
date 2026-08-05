import axios from 'axios';

const defaultBaseURL =
  process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : '';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || defaultBaseURL
});

export default api;

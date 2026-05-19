import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL}/api` 
    : 'http://localhost:5000/api',
});

// Add a request interceptor to add the auth token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: (data) => API.post('/auth/login', data),
  signup: (data) => API.post('/auth/register', data),
  getMe: () => API.get('/auth/me'),
};

export const ebayService = {
  connect: () => API.get('/ebay/auth'),
  callback: (code) => API.post('/ebay/callback', { code }),
  refresh: () => API.post('/ebay/refresh'),
  getStatus: () => API.get('/ebay/status'),
  getPolicies: () => API.get('/ebay/policies'),
  disconnect: () => API.delete('/ebay/disconnect'),
};

export const listingService = {
  getAll: () => API.get('/listings'),
  getOne: (id) => API.get(`/listings/${id}`),
  create: (data) => API.post('/listings', data),
  publish: (id) => API.post(`/listings/${id}/publish`),
  getStats: () => API.get('/listings/stats'),
};

export const ruleService = {
  getAll: () => API.get('/rules'),
  create: (data) => API.post('/rules', data),
  update: (id, data) => API.put(`/rules/${id}`, data),
  delete: (id) => API.delete(`/rules/${id}`),
};

export const aiService = {
  analyze: (data) => API.post('/ai/analyze', data),
};

export default API;

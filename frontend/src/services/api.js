import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.MODE === 'production'
    ? (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.elister.ai/api')
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
  updateSubscription: (data) => API.put('/auth/subscription', data),
};

export const subscriptionService = {
  createRazorpayOrder: (data) => API.post('/subscriptions/razorpay/order', data),
  verifyRazorpayPayment: (data) => API.post('/subscriptions/razorpay/verify', data),
};

export const ebayService = {
  connect: () => API.get('/ebay/auth'),
  callback: (code) => API.post('/ebay/callback', { code }),
  refresh: () => API.post('/ebay/refresh'),
  getStatus: () => API.get('/ebay/status'),
  getPolicies: () => API.get('/ebay/policies'),
  disconnect: () => API.delete('/ebay/disconnect'),
  suggestCategories: (query) => API.get(`/ebay/categories/suggest?q=${encodeURIComponent(query)}`),
  getCategoryAspects: (categoryId) => API.get(`/ebay/categories/${categoryId}/aspects`),
};

export const listingService = {
  getAll: () => API.get('/listings'),
  getOne: (id) => API.get(`/listings/${id}`),
  create: (data) => API.post('/listings', data),
  update: (id, data) => API.put(`/listings/${id}`, data),
  delete: (id) => API.delete(`/listings/${id}`),
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

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
  verifyOtp: (data) => API.post('/auth/verify-otp', data),
  resendOtp: (data) => API.post('/auth/resend-otp', data),
  updateProfile: (data) => API.put('/auth/profile', data),
  changePassword: (data) => API.put('/auth/password', data),
  forgotPassword: (data) => API.post('/auth/forgot-password', data),
  resetPassword: (token, data) => API.post(`/auth/reset-password/${token}`, data),
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
  getInventory: () => API.get('/ebay/inventory'),
  syncInventory: () => API.post('/ebay/sync/inventory'),
};

export const bulkListingEbayService = {
  analyze: (data) => API.post('/bulklistingebay/analyze', data),
  saveDrafts: (data) => API.post('/bulklistingebay/save-drafts', data),
  publish: (data) => API.post('/bulklistingebay/publish', data),
};

export const listingService = {
  getAll: () => API.get('/listings'),
  getOne: (id) => API.get(`/listings/${id}`),
  create: (data) => API.post('/listings', data),
  update: (id, data) => API.put(`/listings/${id}`, data),
  delete: (id) => API.delete(`/listings/${id}`),
  publish: (id) => API.post(`/listings/${id}/publish`),
  getStats: () => API.get('/listings/stats'),
  checkDuplicate: (data) => API.post('/listings/check-duplicate', data),
  verifyLive: (id) => API.post(`/listings/${id}/verify-live`),
};

export const ruleService = {
  getAll: () => API.get('/rules'),
  create: (data) => API.post('/rules', data),
  update: (id, data) => API.put(`/rules/${id}`, data),
  delete: (id) => API.delete(`/rules/${id}`),
};

export const aiService = {
  analyze: (data) => API.post('/ai/analyze', data),
  poshmarkAnalyze: (data) => API.post('/ai/poshmark-analyze', data),
  poshmarkSuggestCategories: (query) => API.get(`/ai/poshmark-categories?query=${query}`),
  vintedAnalyze: (data) => API.post('/ai/vinted-analyze', data),
  vintedSuggestCategories: (query) => API.get(`/ai/vinted-categories?query=${query}`),
  vintedGetCategoryDetails: (params) => API.get('/ai/vinted-category-details', { params }),
  vintedGetCategoryBrands: (categoryId) => API.get(`/ai/vinted-brands?category_id=${categoryId}`),
  vintedGetColors: () => API.get('/ai/vinted-colors'),
  vintedGetCategorySizes: (catalogIds) => API.get(`/ai/vinted-sizes?catalog_ids=${catalogIds}`),
  depopAnalyze: (data) => API.post('/ai/depop-analyze', data),
  depopSuggestCategories: (query) => API.get(`/ai/depop-categories?query=${query}`),
  depopGetCategoryDetails: (params) => API.get('/ai/depop-category-details', { params }),
};

export const adminService = {
  getStats: () => API.get('/admin/stats'),
  getUsers: () => API.get('/admin/users'),
  updateUser: (id, data) => API.put(`/admin/users/${id}`, data),
};

export const poshmarkService = {
  importCloset: (data) => API.post('/poshmark/import', data),
  connect: (data) => API.post('/poshmark/connect', data),
  connectPassword: (data) => API.post('/poshmark/connect-password', data),
  publish: (id, data) => API.post(`/poshmark/publish/${id}`, data),
  getLive: () => API.get('/poshmark/live')
};

export const depopService = {
  importCloset: (data) => API.post('/depop/import', data),
  connect: (data) => API.post('/depop/connect', data),
  publish: (id, data) => API.post(`/depop/publish/${id}`, data),
  getLive: () => API.get('/depop/live')
};

// Legacy mapping for compatibility
export const externalImportService = {
  importCloset: (data) => data.platform === 'depop' ? depopService.importCloset(data) : poshmarkService.importCloset(data),
  connect: (data) => data.platform === 'depop' ? depopService.connect(data) : poshmarkService.connect(data),
  connectPassword: (data) => poshmarkService.connectPassword(data),
  publish: (id, data) => data.platform === 'depop' ? depopService.publish(id, data) : poshmarkService.publish(id, data),
  getLive: (platform) => platform === 'depop' ? depopService.getLive() : poshmarkService.getLive()
};


export default API;

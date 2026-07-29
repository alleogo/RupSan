import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000/api/v1', // Assuming backend runs on 4000
});

// Add a request interceptor to attach the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authApi = {
  getPendingManagers: () => api.get('/auth/pending-managers'),
  approveManager: (managerId, action) => api.post('/auth/approve-manager', { managerId, action })
};

export const yatraApi = {
  getAll: () => api.get('/yatra'),
  getById: (id) => api.get(`/yatra/${id}`),
  create: (data) => api.post('/yatra', data), // data can be FormData
  update: (id, data) => api.put(`/yatra/${id}`, data), // data can be FormData
  delete: (id) => api.delete(`/yatra/${id}`)
};

export const expenseApi = {
  getAll: (yatraId) => api.get(`/expense/${yatraId}`),
  add: (data) => api.post('/expense/add', data),
  update: (id, data) => api.put(`/expense/${id}`, data),
  delete: (id) => api.delete(`/expense/${id}`)
};

export const transactionApi = {
  getSummary: (params) => api.get('/transaction/summary', { params }),
  getAll: (params) => api.get('/transaction', { params }),
  add: (data) => api.post('/transaction/add', data),
  update: (id, data) => api.put(`/transaction/${id}`, data),
  delete: (id) => api.delete(`/transaction/${id}`),
  getCategories: () => api.get('/transaction/categories')
};

export const ticketApi = {
  getAll: (yatraId) => api.get(`/ticket/${yatraId}`),
  add: (data) => api.post('/ticket/add', data),
  update: (id, data) => api.put(`/ticket/${id}`, data),
  delete: (id) => api.delete(`/ticket/${id}`)
};

export const registrationApi = {
  getAll: (yatraId, params) => api.get(`/registration/${yatraId}`, { params }),
  register: (data) => api.post('/registration/register', data), // Now handles FormData
  approve: (id, action) => api.put(`/registration/approve/${id}`, { action }),
  updateDetails: (id, data) => api.put(`/registration/${id}/details`, data),
  myStatus: (yatraId) => api.get(`/registration/my-status/${yatraId}`),
  myRegistrations: () => api.get('/registration/my-registrations')
};

export const userApi = {
  getUnverified: () => api.get('/user/unverified'),
  verify: (id, action) => api.put(`/user/verify/${id}`, { action })
};

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

export const reviewApi = {
  getAll: (yatraId) => api.get(`/review/${yatraId}`),
  add: (data) => api.post('/review/add', data),
  update: (id, data) => api.put(`/review/${id}`, data)
};

export const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `http://localhost:4000${path}`;
};

export default api;

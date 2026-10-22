import axios from 'axios';

// In production the backend is served from the same domain under /api (see vercel.json);
// in local dev it runs on port 4000. REACT_APP_API_URL overrides both.
const API_ORIGIN = (process.env.REACT_APP_API_URL ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000')).replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_ORIGIN}/api/v1`,
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
  getAll: (params) => api.get('/user/all', { params }),
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
  return `${API_ORIGIN}${path}`;
};

// Optimised image URL for <img> tags: Cloudinary images get automatic format (WebP/AVIF) and quality,
// and are capped at `width` pixels. Other URLs are returned unchanged. Use getMediaUrl for links to originals.
export const getImageUrl = (path, width) => {
  const url = getMediaUrl(path);
  if (!url.includes('res.cloudinary.com/') || !url.includes('/image/upload/')) return url;
  const transforms = ['f_auto', 'q_auto', ...(width ? [`w_${width}`, 'c_limit'] : [])].join(',');
  return url.replace('/image/upload/', `/image/upload/${transforms}/`);
};

export default api;

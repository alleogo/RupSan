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
  search: (params) => api.get('/yatra/search', { params }), // Super Admin
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
  add: (data) => api.post('/transaction/add', data), // data can be FormData (payment proof)
  update: (id, data) => api.put(`/transaction/${id}`, data), // data can be FormData (payment proof)
  delete: (id) => api.delete(`/transaction/${id}`),
  bulkDelete: (ids) => api.post('/transaction/bulk-delete', { ids }),
  getCategories: (params) => api.get('/transaction/categories', { params }),
  getDeleted: (params) => api.get('/transaction/deleted', { params }),
  restore: (id) => api.post(`/transaction/${id}/restore`),
  history: (id) => api.get(`/transaction/${id}/history`),
  // Super Admin: entries from before centre accounts
  unassigned: () => api.get('/transaction/unassigned'),
  assignUnassigned: (recordedBy, centreId) => api.post('/transaction/unassigned/assign', { recordedBy, centreId }),
  getMonthly: (params) => api.get('/transaction/monthly', { params }),
  getBreakdown: (params) => api.get('/transaction/breakdown', { params }),
  exportCsv: (params) => api.get('/transaction/export', { params, responseType: 'blob' })
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
  verify: (id, action) => api.put(`/user/verify/${id}`, { action }),
  changeRole: (id, data) => api.put(`/user/${id}/role`, data), // { role: 'Manager' | 'Participant', until?, note? }
  uploadAadharCard: (formData) => api.post('/user/aadhar-card', formData),
  aadharCardImage: (id) => api.get(`/user/${id}/aadhar-card`, { responseType: 'blob' })
};

export const centreApi = {
  list: () => api.get('/centres'),
  // Super Admin
  manage: () => api.get('/centres/manage'),
  create: (fields) => api.post('/centres', fields), // { name, description, place, location, pm: { name, phone, email } }
  update: (id, fields) => api.put(`/centres/${id}`, fields),
  details: (id) => api.get(`/centres/${id}/details`), // members of the centre and the Super Admin
  remove: (id) => api.delete(`/centres/${id}`),
  appointAdmin: (id, userId, previousAdminRole) => api.put(`/centres/${id}/admin`, { userId, previousAdminRole }),
  changeAdminRole: (id, role) => api.put(`/centres/${id}/admin/role`, { role }),
  changeUnassignedAdminRole: (userId, role) => api.put(`/centres/unassigned-admins/${userId}/role`, { role }),
  // Centre admin / co-admins
  mine: () => api.get('/centres/mine'),
  addCoAdmin: (userId) => api.post('/centres/mine/co-admins', { userId }),
  removeCoAdmin: (userId, role) => api.delete(`/centres/mine/co-admins/${userId}`, { data: { role } })
};

export const accountAccessApi = {
  me: () => api.get('/account-access/me'),
  list: () => api.get('/account-access'),
  grant: (userId, level, expiresOn) => api.put('/account-access', { userId, level, expiresOn }),
  revoke: (userId) => api.delete(`/account-access/${userId}`)
};

export const roleRequestApi = {
  create: (data) => api.post('/role-request', data),
  mine: () => api.get('/role-request/mine'),
  cancel: (id) => api.post(`/role-request/${id}/cancel`),
  endMyAccess: () => api.post('/role-request/end-access'),
  list: (status) => api.get('/role-request', { params: { status } }),
  review: (id, data) => api.post(`/role-request/${id}/review`, data),
  revoke: (id, note) => api.post(`/role-request/${id}/revoke`, { note })
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

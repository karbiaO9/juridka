import axios from 'axios';

// Safely strip stray quotes from environment variables just in case
const rawBaseURL = process.env.REACT_APP_API_URL || '';
const cleanBaseURL = rawBaseURL.replace(/^['"]|['"]$/g, '');

// Create axios instance with base configuration
const api = axios.create({
  baseURL: cleanBaseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Log the error but don't automatically clear storage for debugging
      console.error('401 Unauthorized error:', error.response?.data);
      console.error('Request headers:', error.config?.headers);

      // Temporarily disable automatic logout for debugging
      // localStorage.removeItem('token');
      // localStorage.removeItem('user');
      // if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
      //   window.location.href = '/login';
      // }
    }
    return Promise.reject(error);
  }
);

// Authentication API calls
export const authAPI = {
  // User login
  loginUser: (credentials) => api.post('/api/auth/login', credentials),

  // Client signup
  signupClient: (userData) => api.post('/api/auth/signup/client', userData),

  // Avocat signup
  signupAvocat: (userData) => {
    // Check if userData is FormData (for file uploads)
    if (userData instanceof FormData) {
      return api.post('/api/auth/signup/avocat', userData, {
        headers: {
          'Content-Type': undefined,
        },
      });
    } else {
      return api.post('/api/auth/signup/avocat', userData);
    }
  },

  // Get user profile
  getUserProfile: () => api.get('/api/auth/profile'),

  // Get full avocat profile from server
  getAvocatProfile: () => api.get('/api/auth/avocat/profile'),

  // Update avocat profile (uses avocat-specific endpoint with correct field names)
  updateAvocatProfile: (profileData) => api.patch('/api/auth/avocat/profile', profileData),

  // Update user profile
  updateProfile: (profileData) => {
    if (profileData instanceof FormData) {
      return api.patch('/api/auth/profile', profileData, {
        headers: {
          'Content-Type': undefined,
        },
      });
    } else {
      return api.patch('/api/auth/profile', profileData);
    }
  },

  // Change password
  changePassword: (passwordData) => api.put('/api/auth/change-password', passwordData),

  // Get lawyer working hours
  getLawyerWorkingHours: (lawyerId) => api.get(`/api/auth/working-hours/${lawyerId}`),

  // Update lawyer working hours
  updateLawyerWorkingHours: (lawyerId, workingHours) => api.put(`/api/auth/working-hours/${lawyerId}`, { workingHours }),

  // Upload avatar
  uploadAvatar: (formData) => {
    return api.post('/api/auth/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Get all avocats
  getAvocats: () => api.get('/api/auth/avocats'),

  // Get avocat by ID
  getAvocatById: (id) => api.get(`/api/auth/avocats/${id}`),


  forgotPassword: (email) =>
    api.post('/api/auth/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    api.post('/api/auth/reset-password', { token, newPassword }),
  // Logout (client-side only for now)
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return Promise.resolve();
  }
};

// Admin API calls
export const adminAPI = {
  getPendingLawyers: () => api.get('/api/admin/pending-lawyers'),
  verifyLawyer: (lawyerId, action) => api.post(`/api/admin/verify-lawyer/${lawyerId}`, { action }),
  getUnverifiedAvocats: () => api.get('/api/admin/avocats/unverified'),
  verifyAvocat: (avocatId) => api.patch(`/api/admin/avocats/${avocatId}/verify`),
  deleteAvocat: (avocatId) => api.delete(`/api/admin/avocats/${avocatId}`),
};

// Rendez-vous (Appointment) API calls
export const rendezVousAPI = {
  getAvailableSlots: (avocatId, day, date) =>
    api.get('/api/rendezvous/slots', { params: { avocatId, day, date } }),
  bookRendezVous: (data) =>
    api.post('/api/rendezvous/book', data),
  approveRendezVous: (id) =>
    api.post(`/api/rendezvous/approve/${id}`),
  rejectRendezVous: (id) =>
    api.post(`/api/rendezvous/reject/${id}`),
  getLawyerRendezVous: (avocatId) =>
    api.get('/api/rendezvous', { params: { avocatId } }).catch(err => {
      console.error('Error fetching lawyer appointments:', err);
      return { data: [] };
    }),
  getClientRendezVous: (clientId) =>
    api.get('/api/rendezvous', { params: { clientId } }).catch(err => {
      console.error('Error fetching client appointments:', err);
      return { data: [] };
    }),
  updateRendezVous: (id, data) =>
    api.patch(`/api/rendezvous/update/${id}`, data),
  markAsPaid: (id, paymentData) =>
    api.patch(`/api/rendezvous/mark-paid/${id}`, paymentData),
};

// User profile API
export const userAPI = {
  // Refresh current user data (for lawyers to check verification status)
  refreshUserData: async () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const userType = (user.userType || user.role || 'unknown').toLowerCase();

    let response;

    if (
      userType === 'avocat' ||
      user.specialites !== undefined ||
      user.diplome !== undefined ||
      user.verified !== undefined ||
      user.barNumber !== undefined
    ) {
      response = await api.get('/api/auth/avocat/profile');
    } else if (userType === 'client' || userType === 'admin') {
      response = await api.get('/api/client/me');
    } else {
      return user;
    }

    if (response?.data?.success || response?.data?.user) {
      const updatedUser = {
        ...user,
        ...(response.data.user || response.data),
        userType: user.userType, // ✅ Garde le userType original ('Avocat')
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    }

    return user;
  } catch (error) {
    return JSON.parse(localStorage.getItem('user') || '{}');
  }
}
};

// Case management API
export const notificationAPI = {
  getAll: () => api.get('/api/notifications').then(r => r.data),
  markAllRead: () => api.put('/api/notifications/mark-read').then(r => r.data),
  markOneRead: (id) => api.patch(`/api/notifications/${id}/read`).then(r => r.data),
};

export const foundingMemberAPI = {
  getStats: () => api.get('/api/founding-members/stats').then(r => r.data),
};

export const temoignageAPI = {
  submit:           (data) => api.post('/api/temoignages', data).then(r => r.data),
  getSubmittedRdvs: ()     => api.get('/api/temoignages/submitted-rdvs').then(r => r.data),
  getMes:           ()     => api.get('/api/temoignages/mes').then(r => r.data),
  getByAvocat:      (id)   => api.get(`/api/temoignages/avocat/${id}`).then(r => r.data),
};

export const caseAPI = {
  createCase: (formData) => {
    // formData should be FormData for files
    return api.post(`${process.env.REACT_APP_API_URL}/api/cases`, formData, { headers: { 'Content-Type': undefined } });
  },
  getCases: () => api.get(`${process.env.REACT_APP_API_URL}/api/cases`),
  getCase: (id) => api.get(`${process.env.REACT_APP_API_URL}/api/cases/${id}`),
  updateCase: (id, formData) => api.put(`${process.env.REACT_APP_API_URL}/api/cases/${id}`, formData, { headers: { 'Content-Type': undefined } }),
  deleteCase: (id) => api.delete(`${process.env.REACT_APP_API_URL}/api/cases/${id}`),
  deleteFile: (id, fileUrl) => api.post(`${process.env.REACT_APP_API_URL}/api/cases/${id}/delete-file`, { file: fileUrl }),
  addFiles: (id, formData) => api.post(`${process.env.REACT_APP_API_URL}/api/cases/${id}/add-files`, formData, { headers: { 'Content-Type': undefined } }),
}
export const reseauProAPI = {
  // Annuaire
  getAnnuaire:       (params) => api.get('/api/reseau-pro/annuaire', { params }).then(r => r.data),
  updateDispo:       (disponibilite) => api.patch('/api/reseau-pro/disponibilite', { disponibilite }).then(r => r.data),

  // Délégation
  getDelegations:    ()       => api.get('/api/reseau-pro/delegations').then(r => r.data),
  getMesDelegations: ()       => api.get('/api/reseau-pro/delegations/mes').then(r => r.data),
  createDelegation:  (data)   => api.post('/api/reseau-pro/delegations', data).then(r => r.data),
  updateDelegation:  (id, data) => api.patch(`/api/reseau-pro/delegations/${id}`, data).then(r => r.data),
  repondreDelegation:(id, message) => api.post(`/api/reseau-pro/delegations/${id}/repondre`, { message }).then(r => r.data),
  sauvegarder:       (id)     => api.post(`/api/reseau-pro/delegations/${id}/sauvegarder`).then(r => r.data),

  // Substitution
  getSubstitutions:  ()       => api.get('/api/reseau-pro/substitutions').then(r => r.data),
  getMesSubstitutions: ()     => api.get('/api/reseau-pro/substitutions/mes').then(r => r.data),
  createSubstitution:(formData) => api.post('/api/reseau-pro/substitutions', formData, { headers: { 'Content-Type': undefined } }).then(r => r.data),
  accepterSub:       (id)     => api.patch(`/api/reseau-pro/substitutions/${id}/accepter`).then(r => r.data),
  ignorerSub:        (id)     => api.patch(`/api/reseau-pro/substitutions/${id}/ignorer`).then(r => r.data),
  retirerSub:        (id)     => api.patch(`/api/reseau-pro/substitutions/${id}/retirer`).then(r => r.data),

  // Documents
  getMesDocuments:   ()       => api.get('/api/reseau-pro/documents').then(r => r.data),
  uploadDocument:    (formData) => api.post('/api/reseau-pro/documents', formData, { headers: { 'Content-Type': undefined } }).then(r => r.data),
  supprimerDocument: (id)     => api.delete(`/api/reseau-pro/documents/${id}`).then(r => r.data),
  partagerDocument:  (id, avocatId) => api.post(`/api/reseau-pro/documents/${id}/partager`, { avocatId }).then(r => r.data),

  // Conventions
  getMesConventions: ()       => api.get('/api/reseau-pro/conventions').then(r => r.data),
  creerConvention:   (data)   => api.post('/api/reseau-pro/conventions', data).then(r => r.data),
  signerConvention:  (id)     => api.patch(`/api/reseau-pro/conventions/${id}/signer`).then(r => r.data),
};

export const messagerieAPI = {
  getConversations:       ()                    => api.get('/api/messagerie-pro/conversations').then(r => r.data),
  getOrCreate:            (data)                => api.post('/api/messagerie-pro/conversations', data).then(r => r.data),
  deleteConversation:     (convId)              => api.delete(`/api/messagerie-pro/conversations/${convId}`).then(r => r.data),
  getMessages:            (convId)              => api.get(`/api/messagerie-pro/conversations/${convId}/messages`).then(r => r.data),
  sendMessage:            (convId, formData)    => api.post(`/api/messagerie-pro/conversations/${convId}/messages`, formData, { headers: { 'Content-Type': undefined } }).then(r => r.data),
  getUnreadCount:         ()                    => api.get('/api/messagerie-pro/unread-count').then(r => r.data),
  searchAvocats:          (q)                   => api.get('/api/messagerie-pro/avocats/search', { params: { q } }).then(r => r.data),
};

export default api;
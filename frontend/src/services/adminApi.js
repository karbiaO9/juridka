const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// Get auth token from localStorage
const getAuthToken = () => {
    // First try to get token from localStorage directly
    let token = localStorage.getItem('token');
    
    // If not found, try to get from user object
    if (!token) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        token = user.token;
    }
    
    console.log('User object from localStorage:', JSON.parse(localStorage.getItem('user') || '{}'));
    console.log('Direct token from localStorage:', localStorage.getItem('token'));
    console.log('Final token being used:', token);
    
    return token;
};

// Admin API Service
export const adminApi = {
    // Get admin dashboard statistics
    getStats: async () => {
        try {
            const url = `${API_BASE_URL}/api/admin/stats`;
            console.log('Fetching admin stats from:', url);
            console.log('Auth token:', getAuthToken());
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            });

            console.log('Stats response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Stats response error:', errorText);
                throw new Error('Failed to fetch admin statistics');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching admin stats:', error);
            throw error;
        }
    },

    // Get pending lawyer verification requests
    getPendingLawyers: async () => {
        try {
            const url = `${API_BASE_URL}/api/admin/pending-lawyers`;
            console.log('Fetching pending lawyers from:', url);
            console.log('Auth token:', getAuthToken());
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            });

            console.log('Pending lawyers response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Pending lawyers response error:', errorText);
                throw new Error('Failed to fetch pending lawyers');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching pending lawyers:', error);
            throw error;
        }
    },

    // Verify or reject a lawyer
    verifyLawyer: async (lawyerId, action) => {
        try {
            const url = `${API_BASE_URL}/api/admin/verify-lawyer/${lawyerId}`;
            console.log('Verifying lawyer at:', url);
            console.log('Action:', action);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({ action })
            });

            console.log('Verify lawyer response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Verify lawyer response error:', errorText);
                throw new Error('Failed to verify lawyer');
            }

            return await response.json();
        } catch (error) {
            console.error('Error verifying lawyer:', error);
            throw error;
        }
    },

    // Get all lawyers (they're called "avocats" on the server)
    getAllLawyers: async () => {
        try {
            const url = `${API_BASE_URL}/api/admin/avocats`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch all lawyers');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching all lawyers:', error);
            throw error;
        }
    },

    // Get verified lawyers only
    getVerifiedLawyers: async () => {
        try {
            const url = `${API_BASE_URL}/api/admin/verified-lawyers`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch verified lawyers');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching verified lawyers:', error);
            throw error;
        }
    },

    // Get all clients
    getAllClients: async () => {
        try {
            const url = `${API_BASE_URL}/api/admin/clients`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch all clients');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching all clients:', error);
            throw error;
        }
    },
    // ── Founding Members ──────────────────────────────────────────────────────
    getFoundingMembers: async () => {
        const response = await fetch(`${API_BASE_URL}/api/founding-members`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (!response.ok) throw new Error('Failed to fetch founding members');
        return await response.json();
    },

    confirmFoundingMember: async (id) => {
        const response = await fetch(`${API_BASE_URL}/api/founding-members/${id}/confirm`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (!response.ok) throw new Error('Failed to confirm founding member');
        return await response.json();
    },

    rejectFoundingMember: async (id, note = '') => {
        const response = await fetch(`${API_BASE_URL}/api/founding-members/${id}/reject`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
            body: JSON.stringify({ note })
        });
        if (!response.ok) throw new Error('Failed to reject founding member');
        return await response.json();
    },

    getAppointments: async (filter = '') => {
    try {
        const url = `${API_BASE_URL}/api/rendezvous/admin/all${filter ? `?filter=${filter}` : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch appointments');
        return await response.json();
    } catch (error) {
        console.error('Error fetching appointments:', error);
        throw error;
    }
},

    // ── Notifications ─────────────────────────────────────────────────────────
    getNotifications: async () => {
        const response = await fetch(`${API_BASE_URL}/api/notifications`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (!response.ok) throw new Error('Failed to fetch notifications');
        return await response.json(); // { notifications: [...], unreadCount: N }
    },

    markAllNotificationsRead: async () => {
        const response = await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (!response.ok) throw new Error('Failed to mark notifications read');
        return await response.json();
    },

    markNotificationRead: async (id) => {
        const response = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (!response.ok) throw new Error('Failed to mark notification read');
        return await response.json();
    },

    // ── Témoignages ───────────────────────────────────────────────────────────
    getTemoignages: async (statut = '') => {
        const url = `${API_BASE_URL}/api/temoignages/admin/all${statut ? `?statut=${statut}` : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (!response.ok) throw new Error('Failed to fetch testimonials');
        return await response.json();
    },

    approveTemoignage: async (id) => {
        const response = await fetch(`${API_BASE_URL}/api/temoignages/admin/${id}/approve`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (!response.ok) throw new Error('Failed to approve testimonial');
        return await response.json();
    },

    rejectTemoignage: async (id) => {
        const response = await fetch(`${API_BASE_URL}/api/temoignages/admin/${id}/reject`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (!response.ok) throw new Error('Failed to reject testimonial');
        return await response.json();
    },
};
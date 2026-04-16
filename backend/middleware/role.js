// Role-based middleware lel access control
// 3aslema, kol middleware fil file mosta9el

// General role middleware - besh nestaamlha lel kol
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication matlub' });
        }

        // nchof ken l user 3ando wa7ed mil roles l matluba
        const hasRole = allowedRoles.some(role => {
            if (role === 'admin') {
                return req.user.role === 'admin';
            }
            if (role === 'client') {
                return req.user.userType === 'client' && req.user.role === 'client';
            }
            if (role === 'avocat') {
                return req.user.userType === 'avocat';
            }
            if (role === 'verified-avocat') {
                return req.user.userType === 'avocat' && req.user.verified;
            }
            if (role === 'unverified-avocat') {
                return req.user.userType === 'avocat' && !req.user.verified;
            }
            return false;
        });

        if (hasRole) {
            next();
        } else {
            res.status(403).json({ 
                error: 'Ma3andeksh l permissions lel route hedhi',
                requiredRoles: allowedRoles,
                yourRole: req.user.userType === 'client' ? req.user.role : req.user.userType,
                verified: req.user.verified || false
            });
        }
    };
};

// Middleware besh nchof ken user 3ando specific userType
const requireUserType = (...allowedUserTypes) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication matlub' });
        }

        if (allowedUserTypes.includes(req.user.userType)) {
            next();
        } else {
            res.status(403).json({ 
                error: 'UserType ghalat lel route hedhi',
                requiredUserTypes: allowedUserTypes,
                yourUserType: req.user.userType
            });
        }
    };
};

// Middleware combinations li nest3mlohom barsha
const requireAdmin = requireRole('admin');
const requireClient = requireRole('client'); 
const requireAvocat = requireRole('avocat');
const requireVerifiedAvocat = requireRole('verified-avocat');
const requireUnverifiedAvocat = requireRole('unverified-avocat');

// Mixed permissions
const requireAdminOrVerifiedAvocat = requireRole('admin', 'verified-avocat');
const requireClientOrAvocat = requireRole('client', 'avocat');
const requireAnyUser = requireRole('admin', 'client', 'avocat');

// Custom role checking function
const checkRole = (user, role) => {
    if (!user) return false;
    
    switch(role) {
        case 'admin':
            return user.role === 'admin';
        case 'client':
            return user.userType === 'client' && user.role === 'client';
        case 'avocat':
            return user.userType === 'avocat';
        case 'verified-avocat':
            return user.userType === 'avocat' && user.verified;
        case 'unverified-avocat':
            return user.userType === 'avocat' && !user.verified;
        default:
            return false;
    }
};

// Helper function besh nchof permissions
const hasPermission = (user, requiredRoles) => {
    if (!user || !requiredRoles || requiredRoles.length === 0) return false;
    return requiredRoles.some(role => checkRole(user, role));
};

module.exports = {
    // Main middleware functions
    requireRole,
    requireUserType,
    
    // Pre-defined role middleware
    requireAdmin,
    requireClient,
    requireAvocat,
    requireVerifiedAvocat,
    requireUnverifiedAvocat,
    
    // Mixed permission middleware
    requireAdminOrVerifiedAvocat,
    requireClientOrAvocat,
    requireAnyUser,
    
    // Helper functions
    checkRole,
    hasPermission
};

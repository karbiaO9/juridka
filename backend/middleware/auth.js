const jwt = require('jsonwebtoken');
const Client = require('../Model/Client');
const Avocat = require('../Model/Avocat');
const FoundingMember         = require('../Model/FoundingMember');
const PendingFoundingSession = require('../Model/PendingFoundingSession');

const requireAuth = async (req, res, next) => {
    const { authorization } = req.headers;

    console.log('Auth middleware called');
    console.log('Authorization header:', authorization ? 'Present' : 'Missing');

    if (!authorization) {
        return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authorization.split(' ')[1];
    console.log('Token extracted:', token ? 'Yes' : 'No');
    console.log('Raw token:', token);
    console.log('Token length:', token ? token.length : 0);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded:', decoded);
        
    const { _id, role, userType } = decoded;

    let user;
    // Handle both 'Avocat' and 'avocat' case variations
    const normalizedUserType = String(userType || '').toLowerCase();
        
    console.log('Original userType:', userType);
    console.log('Normalized userType:', normalizedUserType);
        
    if (normalizedUserType === 'client') {
            console.log('Looking for client with ID:', _id);
            user = await Client.findOne({ _id }).select('_id role email fullName');
        } else if (normalizedUserType === 'avocat') {
            console.log('Looking for avocat with ID:', _id);
            user = await Avocat.findOne({ _id }).select('_id email fullName verified');
        } else if (normalizedUserType === 'founding_member') {
            console.log('Looking for founding member with ID:', _id);
            user = await FoundingMember.findOne({ _id }).select('_id email firstName lastName onboardingStep status');
        } else if (normalizedUserType === 'pending_founding') {
            console.log('Looking for pending founding session with ID:', _id);
            user = await PendingFoundingSession.findOne({ _id, isVerified: true }).select('_id email basicInfo isVerified');
        } else {
            console.log('Unknown userType:', userType);
            return res.status(401).json({ error: 'Invalid user type' });
        }

        console.log('User found:', user ? 'Yes' : 'No');

        if (!user) {
            return res.status(401).json({ error: 'User not found in database' });
        }

    // Store normalized userType on req.user so downstream role checks are reliable
    req.user = { ...user._doc, role, userType: normalizedUserType };
    console.log('req.user prepared by auth middleware:', req.user);
        console.log('Auth successful for user:', req.user.email);
        next();

    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Middleware for admin check (legacy - use roleMiddleware.js lel jdid)
const requireAdmin = async (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Acces Prohibted' });
    }
};

// Middleware for avocat check (legacy - use roleMiddleware.js lel jdid)
const requireAvocat = async (req, res, next) => {
    if (req.user && req.user.userType === 'avocat') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied' });
    }
};

// Middleware  avocat verified (legacy - use roleMiddleware.js lel jdid)
const requireVerifiedAvocat = async (req, res, next) => {
    if (req.user && req.user.userType === 'avocat' && req.user.verified) {
        next();
    } else {
        res.status(403).json({ error: 'You are not Verified' });
    }
};

module.exports = { 
    requireAuth, 
    requireAdmin, 
    requireAvocat, 
    requireVerifiedAvocat
};

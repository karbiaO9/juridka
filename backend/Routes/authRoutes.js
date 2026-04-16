const express = require('express');
const router = express.Router();
const {
    loginUser,
    signupClient,
    signupAvocat,
    getUserProfile,
    updateProfile,
    changePassword,
    verifyPhone,
    resendOtp,
    forgotPassword,
    resetPassword
} = require('../Controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// Login route 
router.post('/login', loginUser);

// Signup routes
router.post('/signup/client', signupClient);
router.post('/signup/avocat', upload.fields([
    { name: 'documentsVerif', maxCount: 1 },
    { name: 'avatarUrl', maxCount: 1 }
]), signupAvocat);

//Reset pasword routes
router.post('/forgot-password', forgotPassword);  // ← présent ?
router.post('/reset-password', resetPassword);   // ← présent ?
// Phone verification endpoints
router.post('/verify-phone', verifyPhone);
router.post('/resend-otp', resendOtp);

// Protected route for the profile
router.get('/profile', requireAuth, getUserProfile);

// Update profile route (PATCH method) - same as signup but with PATCH
router.patch('/profile', upload.fields([
    { name: 'documentsVerif', maxCount: 1 },
    { name: 'avatarUrl', maxCount: 1 }
]), requireAuth, updateProfile);

// Test GET endpoint for debugging
router.get('/profile-temp', (req, res) => {
    res.json({
        message: 'Profile-temp endpoint is working!',
        method: 'GET',
        timestamp: new Date().toISOString(),
        routes: 'Both GET and PATCH methods are available'
    });
});

// Debug endpoint to check token contents
router.get('/debug-token', (req, res) => {
    const { authorization } = req.headers;

    if (!authorization) {
        return res.json({ error: 'No authorization header' });
    }

    try {
        const token = authorization.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        res.json({
            message: 'Token decoded successfully',
            decoded: decoded,
            tokenValid: true
        });
    } catch (error) {
        res.json({
            error: 'Invalid token',
            details: error.message,
            tokenValid: false
        });
    }
});

// Temporary profile update without strict auth (for debugging)
router.patch('/profile-temp', async (req, res) => {
    console.log('🔍 PATCH /profile-temp route hit (temporary)');
    console.log('Body:', req.body);

    try {
        // Get user ID from request body or header
        const userId = req.body.userId || req.headers['x-user-id'];

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const Avocat = require('../Model/Avocat');
        const updateData = req.body;

        // Remove sensitive fields
        delete updateData.password;
        delete updateData._id;
        delete updateData.userId;
        delete updateData.verified;

        const updatedUser = await Avocat.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, select: '-password' }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Temp profile update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Change password route
router.put('/change-password', requireAuth, changePassword);

// Working hours routes
// ✅ Route publique — pas de requireAuth
router.get('/working-hours/:lawyerId', async (req, res) => {
    try {
        const Avocat = require('../Model/Avocat');
        const avocat = await Avocat.findById(req.params.lawyerId).select('availability');
        if (!avocat) return res.status(404).json({ error: 'Lawyer not found' });
        res.json({ workingHours: avocat.availability?.slots || [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch working hours' });
    }
});

router.put('/working-hours/:lawyerId', requireAuth, async (req, res) => {
    try {
        const Avocat = require('../Model/Avocat');
        const { lawyerId } = req.params;
        const { workingHours } = req.body;

        // Check if user is updating their own data or is admin
        if (req.user._id.toString() !== lawyerId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Convert object format to array format for database
        const convertObjectToArray = (workingHoursObj) => {
            const daysMapping = {
                'monday': 'Monday',
                'tuesday': 'Tuesday',
                'wednesday': 'Wednesday',
                'thursday': 'Thursday',
                'friday': 'Friday',
                'saturday': 'Saturday',
                'sunday': 'Sunday'
            };

            return Object.keys(workingHoursObj).map(dayKey => ({
                day: daysMapping[dayKey] || dayKey,
                start: workingHoursObj[dayKey].start,
                end: workingHoursObj[dayKey].end,
                isOpen: workingHoursObj[dayKey].isOpen !== undefined ? workingHoursObj[dayKey].isOpen : true
            }));
        };

        const workingHoursArray = convertObjectToArray(workingHours);

        const updatedAvocat = await Avocat.findByIdAndUpdate(
            lawyerId,
            { workingHours: workingHoursArray },
            { new: true }
        ).select('workingHours');

        if (!updatedAvocat) {
            return res.status(404).json({ error: 'Lawyer not found' });
        }

        res.json({
            message: 'Working hours updated successfully',
            workingHours: updatedAvocat.workingHours
        });
    } catch (error) {
        console.error('Error updating working hours:', error);
        res.status(500).json({ error: 'Failed to update working hours' });
    }
});

router.get('/avocats', async (req, res) => {
    try {
        const Avocat = require('../Model/Avocat');

        const avocats = await Avocat.find({
            status: 'approved'  
        }).select('-password -otp -otpRequestedAt -resetPasswordToken -resetPasswordExpires');

        res.json(avocats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch avocats' });
    }
});

router.get('/avocats/:id', async (req, res) => {
    try {
        const Avocat = require('../Model/Avocat');
        const avocat = await Avocat.findOne({
            _id: req.params.id,
            status: 'approved' 
        }).select('-password -otp -otpRequestedAt -resetPasswordToken -resetPasswordExpires');

        if (!avocat) return res.status(404).json({ error: 'Lawyer not found or not verified' });
        res.json(avocat);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch avocat profile' });
    }
});
// Protected route for pending verification
router.get('/pending-verification', requireAuth, (req, res) => {
    if (req.user.userType !== 'avocat') {
        return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.verified) {
        return res.json({
            message: 'You are already verified!',
            verified: true,
            redirectTo: '/avocat/dashboard'
        });
    }

    res.json({
        message: 'Your account is still under review',
        verified: false,
    });
});

module.exports = router;
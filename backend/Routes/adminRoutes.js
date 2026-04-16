const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getAdminStats, getPendingLawyers, verifyLawyer } = require('../Controllers/adminController');
const Client = require('../Model/Client');

// Admin dashboard 
router.get('/dashboard', requireAuth, requireAdmin, (req, res) => {
    res.json({
        message: 'Admin Dashboard',
        user: req.user,
        redirectUrl: '/admin/dashboard'
    });
});

// Get admin statistics
router.get('/stats', requireAuth, requireAdmin, getAdminStats);

// Get pending lawyers for verification
router.get('/pending-lawyers', requireAuth, requireAdmin, getPendingLawyers);

// Verify or reject a lawyer
router.post('/verify-lawyer/:lawyerId', requireAuth, requireAdmin, verifyLawyer);
// ✅ Tous les avocats
router.get(['/avocats', '/lawyers'], requireAuth, requireAdmin, async (req, res) => {
    try {
        const Avocat = require('../Model/Avocat');
        const avocats = await Avocat.find({}).select('-password -otp');
        res.json(avocats);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ✅ Avocats vérifiés — status approved
router.get('/verified-lawyers', requireAuth, requireAdmin, async (req, res) => {
    try {
        const Avocat = require('../Model/Avocat');
        const avocats = await Avocat.find({ status: 'approved' }).select('-password -otp'); // ✅
        res.json(avocats);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ✅ Clients — pas de filtre role
router.get('/clients', requireAuth, requireAdmin, async (req, res) => {
    try {
        const clients = await Client.find({}).select('-password'); // ✅ supprime { role: 'client' }
        res.json(clients);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Avocat Verification (legacy endpoint - keeping for compatibility)
router.patch('/verify-avocat/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const Avocat = require('../Model/Avocat');
        const avocat = await Avocat.findByIdAndUpdate(
            req.params.id,
            { verified: true },
            { new: true }
        ).select('-password');

        if (!avocat) {
            return res.status(404).json({ error: 'No Avocat found' });
        }

        res.json({ message: 'Avocat Is Verified', avocat });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
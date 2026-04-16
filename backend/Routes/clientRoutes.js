const express    = require('express');
const router     = express.Router();
const { requireAuth: auth, requireAdmin } = require('../middleware/auth');

// Alias pour compatibilité
const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) {
    return res.status(403).json({ error: 'Accès refusé — rôle insuffisant' });
  }
  next();
};

const {
  loginClient,
  signupClient,
  verifyEmailClient,
  resendOtpClient,
  getClientProfile,
  updateClientProfile,
  changePasswordClient,
  forgotPasswordClient,
  resetPasswordClient,
  getPendingClients,
  approveClient,
  rejectClient,
} = require('../Controllers/Authclient');

// ─── Public ───────────────────────────────────────────────────────────────────
router.post('/signup',          signupClient);
router.post('/verify-email',    verifyEmailClient);
router.post('/resend-otp',      resendOtpClient);
router.post('/login',           loginClient);
router.post('/forgot-password', forgotPasswordClient);
router.post('/reset-password',  resetPasswordClient);

// ─── Client authentifié ───────────────────────────────────────────────────────
router.get  ('/profile',          auth, getClientProfile);
router.patch('/profile',          auth, updateClientProfile);
router.patch('/change-password',  auth, changePasswordClient);

// ─── Admin uniquement ─────────────────────────────────────────────────────────
// requireRole('admin') vérifie que req.user.role === 'admin'
router.get  ('/pending',          auth, requireRole('admin'), getPendingClients);
router.patch('/:id/approve',      auth, requireRole('admin'), approveClient);
router.patch('/:id/reject',       auth, requireRole('admin'), rejectClient);

module.exports = router;
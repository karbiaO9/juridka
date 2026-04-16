const express = require('express');
const router  = express.Router();
const { requireAuth: auth } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  loginAvocat,
  registerStep1,
  verifyEmailAvocat,
  resendOtpAvocat,
  registerStep3,
  registerStep4,
  uploadPhoto,
  approvePhoto,
  registerStep8,
  getProfilePreview,
  submitRegistration,
  initFlouciPayment,
  verifyFlouciPayment,
  savePaymentProof,
  getAvocatProfile,
  updateAvocatProfile,
  changePasswordAvocat,
  forgotPasswordAvocat,
  resetPasswordAvocat,
  getAvocatAvailability
} = require('../Controllers/AuthAvocat');

// ── Auth publique ────────────────────────────────────────────────────────────
router.post('/login',           loginAvocat);
router.post('/forgot-password', forgotPasswordAvocat);
router.post('/reset-password',  resetPasswordAvocat);

// ── Onboarding ───────────────────────────────────────────────────────────────

// Étape 1 — Infos de base + OTP (pas d'auth)
router.post('/register/step1', registerStep1);

// Étape 2 — Vérification OTP (pas d'auth)
router.post('/verify-email', verifyEmailAvocat);
router.post('/resend-otp',   resendOtpAvocat);

// Étape 3 — Identité professionnelle (auth requise)
router.post('/register/step3', auth, registerStep3);

// Étape 4 — Upload 5 documents (auth requise)
router.post(
  '/register/step4',
  auth,
  upload.fields([
    { name: 'carteBarreauFront', maxCount: 1 },
    { name: 'carteBarreauBack',  maxCount: 1 },
    { name: 'diplome',           maxCount: 1 },
    { name: 'patente',           maxCount: 1 },
    { name: 'casierJudiciaire',  maxCount: 1 },
  ]),
  registerStep4,
);

// Étape 5 — Photo profil (auth requise)
router.post('/register/step5/upload',  auth, upload.single('photo'), uploadPhoto);
router.post('/register/step5/approve', auth, approvePhoto);

// Étape 8 — Disponibilités + Localisation (auth requise)
router.post('/register/step8', auth, registerStep8);

// Étape 9 — Preview + Soumission (auth requise)
router.get('/register/preview', auth, getProfilePreview);
router.post('/register/submit', auth, submitRegistration);

// ── Paiement ─────────────────────────────────────────────────────────────────

// Flouci — paiement en ligne
router.post('/register/payment-init',   auth, initFlouciPayment);
router.get('/register/payment-verify',  auth, verifyFlouciPayment);

// Virement — upload justificatif
router.post(
  '/register/payment-proof',
  auth,
  upload.single('justif'),
  savePaymentProof,
);

// ── Profil (auth requise) ────────────────────────────────────────────────────
router.get('/profile',           auth, getAvocatProfile);
router.patch('/profile',         auth, updateAvocatProfile);
router.patch('/change-password', auth, changePasswordAvocat);

// ── Public ───────────────────────────────────────────────────────────────────
router.get('/:id/availability', getAvocatAvailability);

module.exports = router;
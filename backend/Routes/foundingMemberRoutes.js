const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');
const {
  getStats,
  registerStep1,
  verifyEmail,
  resendOtp,
  uploadDocsTemp,
  uploadPhotoTemp,
  submitRegistration,
  getAll,
  confirm,
  reject,
} = require('../Controllers/foundingMemberController');

// ── Cloudinary storage — dossier temporaire par session ───────────────────────
const fmStorage = new CloudinaryStorage({
  cloudinary,
  params: (req) => ({
    folder: `juridika/founding-members/pending/${req.user?._id || 'unknown'}`,
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
    resource_type: 'auto',
    public_id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  }),
});

const fmUpload = multer({
  storage: fmStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Format non autorisé'));
  },
});

const uploadDocsMiddleware = fmUpload.fields([
  { name: 'carteBarreauFront', maxCount: 1 },
  { name: 'carteBarreauBack',  maxCount: 1 },
  { name: 'diplome',           maxCount: 1 },
  { name: 'patente',           maxCount: 1 },
  { name: 'casierJudiciaire',  maxCount: 1 },
]);

const uploadPhotoMiddleware = fmUpload.single('photo');

// ── Middleware : session OTP en cours (pending_founding) ──────────────────────
const requirePendingSession = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user?.userType?.toLowerCase() !== 'pending_founding') {
      return res.status(403).json({ error: 'Session de pré-inscription requise' });
    }
    next();
  });
};

// ── Routes publiques ──────────────────────────────────────────────────────────
router.get ('/stats',          getStats);
router.post('/register/step1', registerStep1);
router.post('/verify-email',   verifyEmail);
router.post('/resend-otp',     resendOtp);

// ── Routes protégées (session pending_founding — après vérification email) ────
router.post('/register/docs',    requirePendingSession, uploadDocsMiddleware, uploadDocsTemp);
router.post('/register/photo',   requirePendingSession, uploadPhotoMiddleware, uploadPhotoTemp);
router.post('/register/submit',  requirePendingSession, submitRegistration);

// ── Routes admin ──────────────────────────────────────────────────────────────
router.get  ('/',            requireAuth, requireAdmin, getAll);
router.patch('/:id/confirm', requireAuth, requireAdmin, confirm);
router.patch('/:id/reject',  requireAuth, requireAdmin, reject);

module.exports = router;

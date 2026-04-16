const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Client = require('../Model/Client');
const PendingUser = require('../Model/PendingUser');
const { sendResetEmail } = require('../config/mailer');
const {
  createToken,
  generateOtp,
  sendOtpByEmail,
  PASSWORD_POLICY,
} = require('./Helpers');

const OTP_TTL_SECONDS = 600; // 10 min
const MAX_OTP_ATTEMPTS = 5;

const CIN_POLICY = /^\d{8}$/;
// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/client/login
 */
const loginClient = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const user = await Client.findOne({ email });
    if (!user)
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    // Email pas encore vérifié → renvoyer OTP
    if (!user.emailVerified) {
      const otp = generateOtp();
      await PendingUser.deleteMany({ email: user.email });
      const pending = await PendingUser.create({
        email: user.email, password: user.password,
        fullName: user.fullName, phone: user.phone,
        otp, otpRequestedAt: new Date(),
      });
      await sendOtpByEmail(user.email, otp);
      return res.status(403).json({
        error: 'Email non vérifié', needVerification: true, pendingId: pending._id,
      });
    }

    // Email vérifié mais pas encore approuvé par admin
    if (!user.isApproved) {
      return res.status(403).json({
        error: 'Votre compte est en attente d\'approbation par notre équipe. Vous recevrez un email de confirmation.',
        needApproval: true,
      });
    }

    const token = createToken(user._id, user.role, 'Client');

    return res.status(200).json({
      user: {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        userType: 'Client',
        isApproved: user.isApproved,
        phone: user.phone || '',
        idType: user.idType || null,
        idNumber: user.idNumber || '',
        preferredLanguage: user.preferredLanguage || 'Français',
        legalNeed: user.legalNeed || {},
      },
      token,
      redirectUrl: user.role === 'admin' ? '/admin/dashboard' : '/client/dashboard',
      message: 'Connexion réussie',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SIGNUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/client/signup
 */
const signupClient = async (req, res) => {
  const { email, password, fullName, phone } = req.body;

  if (!email || !password || !fullName || !phone)
    return res.status(400).json({ error: 'Tous les champs sont requis' });

  if (!PASSWORD_POLICY.test(password))
    return res.status(400).json({
      error: 'Le mot de passe doit contenir au moins 8 caractères et un chiffre',
    });
  
  try {
    const [emailTaken, phoneTaken] = await Promise.all([
      Client.findOne({ email }),
      Client.findOne({ phone }),
    ]);
    if (emailTaken) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    if (phoneTaken) return res.status(409).json({ error: 'Ce numéro de téléphone est déjà utilisé' });

    await PendingUser.deleteMany({ email });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();

    const pending = await PendingUser.create({
      email, password: hashedPassword, fullName, phone,
      otp, otpRequestedAt: new Date(), otpAttempts: 0,
    });

    await sendOtpByEmail(email, otp);

    return res.status(200).json({
      message: 'OTP envoyé par email. Veuillez vérifier votre boîte mail.',
      pendingId: pending._id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY EMAIL (OTP)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/client/verify-email
 * Crée le compte avec emailVerified=true, isApproved=false (attente admin)
 */
const verifyEmailClient = async (req, res) => {
  const { pendingId, otp } = req.body;

  if (!pendingId || !otp)
    return res.status(400).json({ error: 'pendingId et otp sont requis' });

  try {
    const pending = await PendingUser.findById(pendingId);
    if (!pending)
      return res.status(404).json({ error: 'Session expirée. Veuillez recommencer.' });

    const elapsed = (Date.now() - pending.otpRequestedAt.getTime()) / 1000;
    if (elapsed > OTP_TTL_SECONDS) {
      await PendingUser.findByIdAndDelete(pendingId);
      return res.status(400).json({ error: 'OTP expiré. Veuillez recommencer.' });
    }

    if (pending.otpAttempts >= MAX_OTP_ATTEMPTS) {
      await PendingUser.findByIdAndDelete(pendingId);
      return res.status(400).json({ error: 'Trop de tentatives. Veuillez recommencer.' });
    }

    if (pending.otp !== otp) {
      pending.otpAttempts += 1;
      await pending.save();
      const remaining = MAX_OTP_ATTEMPTS - pending.otpAttempts;
      return res.status(400).json({
        error: `Code OTP invalide. ${remaining} tentative(s) restante(s).`,
      });
    }

    // Vérifier doublons
    const [emailTaken, phoneTaken] = await Promise.all([
      Client.findOne({ email: pending.email }),
      Client.findOne({ phone: pending.phone }),
    ]);
    if (emailTaken) { await PendingUser.findByIdAndDelete(pendingId); return res.status(409).json({ error: 'Email déjà utilisé' }); }
    if (phoneTaken) { await PendingUser.findByIdAndDelete(pendingId); return res.status(409).json({ error: 'Téléphone déjà utilisé' }); }

    // ── Créer le compte : emailVerified=true, isApproved=false ────────────
    const newUser = await Client.create({
      email: pending.email,
      password: pending.password,
      fullName: pending.fullName,
      phone: pending.phone,
      role: 'client',
      emailVerified: true,   // 
      isApproved: false,  // 
    });

    await PendingUser.findByIdAndDelete(pendingId);

    // Token émis même sans approbation — pour sauvegarder les étapes 2 & 3
    const token = createToken(newUser._id, newUser.role, 'Client');

    return res.status(201).json({
      message: "Email vérifié ! Votre compte est en attente d'approbation.",
      needApproval: true,
      token,
      user: {
        _id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        isApproved: false,
        userType: 'Client',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESEND OTP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/client/resend-otp
 */
const resendOtpClient = async (req, res) => {
  const { pendingId } = req.body;
  if (!pendingId) return res.status(400).json({ error: 'pendingId est requis' });

  try {
    const pending = await PendingUser.findById(pendingId);
    if (!pending) return res.status(404).json({ error: "Session introuvable. Veuillez recommencer l'inscription." });

    const otp = generateOtp();
    pending.otp = otp;
    pending.otpRequestedAt = new Date();
    pending.otpAttempts = 0;
    await pending.save();

    await sendOtpByEmail(pending.email, otp);
    return res.status(200).json({ message: 'OTP renvoyé par email.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFIL — mise à jour des étapes 2 & 3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/client/profile
 */
const getClientProfile = async (req, res) => {
  try {
    const user = await Client.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    return res.status(200).json({ user, userType: 'client' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
};

/**
 * PATCH /api/auth/client/profile
 * Utilisé pour :
 *   - Étape 2 : idType, idNumber, idDocumentUrl, profilePhotoUrl, consentData, consentCgu, preferredLanguage
 *   - Étape 3 : legalNeed { governorate, legalType, situation, urgency }
 *   - Étape 4 : chosenLawyerId, consultationType
 */
const updateClientProfile = async (req, res) => {
  try {
    const allowed = [
      'preferredLanguage',
      'idType', 'idNumber', 'idDocumentUrl', 'profilePhotoUrl',
      'consentData', 'consentCgu',
      'legalNeed',
      'chosenLawyerId', 'consultationType',
    ];

    const updateData = {};
    allowed.forEach(key => {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    });

    // Si les deux consentements sont donnés, on enregistre la date
    if (updateData.consentData && updateData.consentCgu) {
      updateData.consentedAt = new Date();
    }

    const user = await Client.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true },
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    return res.status(200).json({ message: 'Profil mis à jour', user });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
};

/**
 * PATCH /api/auth/client/change-password
 */
const changePasswordClient = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Les deux mots de passe sont requis' });

  if (!PASSWORD_POLICY.test(newPassword))
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères et un chiffre' });

  try {
    const user = await Client.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — approbation / rejet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/client/pending
 * Liste tous les clients en attente d'approbation (admin only)
 */
const getPendingClients = async (req, res) => {
  try {
    const clients = await Client.find({ emailVerified: true, isApproved: false })
      .select('-password')
      .sort({ createdAt: -1 });
    return res.status(200).json({ clients, total: clients.length });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * PATCH /api/auth/client/:id/approve
 * Approuver un client (admin only)
 */
const approveClient = async (req, res) => {
  try {
    const user = await Client.findByIdAndUpdate(
      req.params.id,
      {
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: req.user._id,
        rejectedAt: null,
        rejectionReason: null,
      },
      { new: true },
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'Client introuvable' });

    // TODO: envoyer un email de bienvenue au client
    // await sendApprovalEmail(user.email, user.fullName);

    return res.status(200).json({ message: 'Client approuvé avec succès', user });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * PATCH /api/auth/client/:id/reject
 * Rejeter un client (admin only)
 */
const rejectClient = async (req, res) => {
  const { reason } = req.body;
  try {
    const user = await Client.findByIdAndUpdate(
      req.params.id,
      {
        isApproved: false,
        rejectedAt: new Date(),
        rejectionReason: reason || 'Dossier incomplet',
        approvedAt: null,
        approvedBy: null,
      },
      { new: true },
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'Client introuvable' });

    // TODO: envoyer un email de rejet au client
    // await sendRejectionEmail(user.email, user.fullName, reason);

    return res.status(200).json({ message: 'Client rejeté', user });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────────────────────────────────────

const forgotPasswordClient = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  try {
    const user = await Client.findOne({ email });
    if (!user) return res.status(200).json({ message: 'Si cet email existe, un lien a été envoyé.' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}&type=client`;

    try {
      await sendResetEmail(user.email, resetLink);
    } catch (mailErr) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      return res.status(500).json({ error: "Échec d'envoi de l'email. Veuillez réessayer." });
    }

    return res.status(200).json({ message: 'Si cet email existe, un lien a été envoyé.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const resetPasswordClient = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });

  if (!PASSWORD_POLICY.test(newPassword))
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères et un chiffre' });

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await Client.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ error: 'Lien invalide ou expiré' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  loginClient,
  signupClient,
  verifyEmailClient,
  resendOtpClient,
  getClientProfile,
  updateClientProfile,
  changePasswordClient,
  forgotPasswordClient,
  resetPasswordClient,
  // Admin
  getPendingClients,
  approveClient,
  rejectClient,
};
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Avocat = require('../Model/Avocat');
const Notification = require('../Model/Notification');
const { cloudinary } = require('../config/cloudinary');
const { sendResetEmail } = require('../config/mailer');
const { enhancePhotoWithGemini } = require('../config/gemini');
const {
  createToken,
  generateOtp,
  sendOtpByEmail,
  cleanupCloudinaryFiles,
  PASSWORD_POLICY,
} = require('./Helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const ONAT_BAR_REGEX = /^[A-Z]{2}-\d{4}-\d{3,6}$/;
const validateBarNumber = (barNumber) => ONAT_BAR_REGEX.test(barNumber);

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/avocat/login
 */
const loginAvocat = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    const user = await Avocat.login(email, password);
    const token = createToken(user._id, 'avocat', 'Avocat');

    return res.status(200).json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: 'avocat',
        userType: 'Avocat',
        onboardingStep: user.onboardingStep,
        status: user.status,
        isVerified: user.isVerified,
        phone: user.phone || '',
        specialties: user.specialties || [],
        anneExperience: user.anneExperience ?? null,
        bio: user.bio || '',
        officeLocation: user.officeLocation || {},
        spokenLanguages: user.spokenLanguages || [],
        photo: user.photo || {},
        barNumber: user.barNumber || '',
        availability: user.availability || {},
      },
      redirectUrl: '/avocat/dashboard',
      message: 'Connexion réussie',
    });
  } catch (error) {
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({
        error: error.message,
        code: 'EMAIL_NOT_VERIFIED',
        needVerification: true,
        userId: error.userId,
      });
    }
    if (error.code === 'ACCOUNT_PENDING') {
      return res.status(403).json({
        error: error.message,
        code: 'ACCOUNT_PENDING',
      });
    }
    return res.status(400).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Étape 1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/avocat/register/step1
 */
const registerStep1 = async (req, res) => {
  const {
    firstName, lastName, email, phone,
    sameWhatsapp, whatsappPhone,
    password, languagePreference,
  } = req.body;

  if (!firstName || !lastName || !email || !phone || !password) {
    return res.status(400).json({ error: 'Prénom, nom, email, téléphone et mot de passe sont requis' });
  }

  if (!PASSWORD_POLICY.test(password)) {
    return res.status(400).json({
      error: 'Le mot de passe doit contenir au moins 8 caractères et un chiffre',
    });
  }

  let finalWhatsappPhone = null;
  if (sameWhatsapp) finalWhatsappPhone = phone;
  else if (whatsappPhone) finalWhatsappPhone = whatsappPhone;

  try {
    const existing = await Avocat.findOne({ email });
    if (existing) {
      return res.status(409).json({
        error: 'Un compte existe déjà avec cet email. Veuillez vous connecter.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();

    const avocat = await Avocat.create({
      firstName, lastName, email, phone,
      whatsappPhone: finalWhatsappPhone,
      password: hashedPassword,
      languagePreference: languagePreference || 'fr',
      otp,
      otpRequestedAt: new Date(),
      isVerified: false,
      onboardingStep: 1,
      status: 'draft',
    });

    await sendOtpByEmail(email, otp);

    return res.status(200).json({
      message: 'Code OTP envoyé par email.',
      avocatId: avocat._id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/avocat/verify-email
 */
const verifyEmailAvocat = async (req, res) => {
  const { avocatId, otp } = req.body;

  if (!avocatId || !otp) {
    return res.status(400).json({ error: 'avocatId et otp sont requis' });
  }

  try {
    const avocat = await Avocat.findById(avocatId);
    if (!avocat) return res.status(404).json({ error: 'Session introuvable, veuillez recommencer' });
    if (avocat.isVerified) return res.status(400).json({ error: 'Email déjà vérifié' });

    const elapsed = (new Date() - avocat.otpRequestedAt) / 1000;
    if (elapsed > 600) return res.status(400).json({ error: 'OTP expiré, veuillez en demander un nouveau' });
    if (avocat.otp !== otp) return res.status(400).json({ error: 'Code OTP invalide' });

    avocat.isVerified = true;
    avocat.otp = null;
    avocat.otpRequestedAt = null;
    avocat.onboardingStep = 3;
    await avocat.save();

    const token = createToken(avocat._id, 'avocat', 'Avocat');

    return res.status(200).json({
      message: "Email vérifié. Continuez vers l'étape 3.",
      token,
      onboardingStep: 3,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /auth/avocat/resend-otp
 */
const resendOtpAvocat = async (req, res) => {
  const { avocatId } = req.body;
  if (!avocatId) return res.status(400).json({ error: 'avocatId est requis' });

  try {
    const avocat = await Avocat.findById(avocatId);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });
    if (avocat.isVerified) return res.status(400).json({ error: 'Email déjà vérifié' });

    const otp = generateOtp();
    avocat.otp = otp;
    avocat.otpRequestedAt = new Date();
    await avocat.save();
    await sendOtpByEmail(avocat.email, otp);

    return res.status(200).json({ message: 'Nouveau code OTP envoyé' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Étape 3 — Identité professionnelle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/avocat/register/step3
 */
const registerStep3 = async (req, res) => {
  const {
    barNumber, barRegion, graduationYear,
    practiceStatus, firmName, specialties, spokenLanguages,
  } = req.body;

  if (!barNumber || !barRegion || !graduationYear || !practiceStatus || !specialties?.length) {
    return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
  }

  if (!validateBarNumber(barNumber)) {
    return res.status(400).json({ error: 'Format du numéro de barreau invalide. Format attendu : TN-2015-1234' });
  }

  const specialtiesArray = Array.isArray(specialties) ? specialties : [specialties];
  if (specialtiesArray.length > 3) {
    return res.status(400).json({ error: 'Maximum 3 spécialités autorisées' });
  }

  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    avocat.barNumber = barNumber;
    avocat.barRegion = barRegion;
    avocat.graduationYear = parseInt(graduationYear);
    avocat.practiceStatus = practiceStatus;
    avocat.firmName = firmName || '';
    avocat.specialties = specialtiesArray;
    avocat.spokenLanguages = spokenLanguages || [];
    avocat.onboardingStep = 4;
    await avocat.save();

    return res.status(200).json({ message: 'Étape 3 enregistrée', onboardingStep: 4 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Étape 4 — Documents
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/avocat/register/step4
 */
const registerStep4 = async (req, res) => {
  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    const files = req.files || {};
    const requiredDocs = ['carteBarreauFront', 'carteBarreauBack', 'diplome', 'patente', 'casierJudiciaire'];
    const missingDocs = requiredDocs.filter((doc) => !files[doc]?.[0]);

    if (missingDocs.length > 0) {
      await cleanupCloudinaryFiles(req);
      return res.status(400).json({ error: 'Tous les documents sont obligatoires', missing: missingDocs });
    }

    avocat.documents = {
      carteBarreauFront: { url: files.carteBarreauFront[0].path, uploadedAt: new Date() },
      carteBarreauBack: { url: files.carteBarreauBack[0].path, uploadedAt: new Date() },
      diplome: { url: files.diplome[0].path, uploadedAt: new Date() },
      patente: { url: files.patente[0].path, uploadedAt: new Date() },
      casierJudiciaire: { url: files.casierJudiciaire[0].path, uploadedAt: new Date() },
    };
    avocat.onboardingStep = 5;
    await avocat.save();

    return res.status(200).json({ message: 'Documents uploadés avec succès', onboardingStep: 5 });
  } catch (err) {
    await cleanupCloudinaryFiles(req);
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Étape 5 — Photo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/avocat/register/step5/upload
 */
const uploadPhoto = async (req, res) => {
  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });
    if (!req.file) return res.status(400).json({ error: 'Photo requise' });

    const originalUrl = req.file.path;
    const publicId = req.file.filename;
    const useGemini = req.body.useGemini === 'true';

    let enhancedUrl;

    if (useGemini && process.env.GEMINI_API_KEY) {
      try {
        // Fetch the original image to send to Gemini
        const fetchRes = await fetch(originalUrl);
        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Process with Gemini
        const enhancedBuffer = await enhancePhotoWithGemini(buffer, req.file.mimetype || 'image/jpeg');
        
        // Upload the result to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { 
              folder: 'avocats/enhanced',
              transformation: [ { width: 400, height: 400, crop: 'fill' } ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(enhancedBuffer);
        });

        enhancedUrl = uploadResult.secure_url;
      } catch (geminiError) {
        console.error('[Gemini] Enhancement failed, falling back to Cloudinary.', geminiError);
        // Fallback to basic Cloudinary transformation
        enhancedUrl = cloudinary.url(publicId, {
          transformation: [
            { background: 'white', width: 400, height: 400, crop: 'pad' },
            { effect: 'improve', mode: 'outdoor' },
            { effect: 'auto_brightness' },
          ],
        });
      }
    } else {
      enhancedUrl = cloudinary.url(publicId, {
        transformation: [
          { background: 'white', width: 400, height: 400, crop: 'pad' },
          { effect: 'improve', mode: 'outdoor' },
          { effect: 'auto_brightness' },
        ],
      });
    }

    avocat.photo = { original: originalUrl, enhanced: enhancedUrl, approved: false };
    await avocat.save();

    return res.status(200).json({
      message: 'Photo uploadée. Prévisualisez et approuvez.',
      original: originalUrl,
      enhanced: enhancedUrl,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /auth/avocat/register/step5/approve
 */
const approvePhoto = async (req, res) => {
  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    if (!avocat.photo?.enhanced) {
      return res.status(400).json({ error: 'Aucune photo à approuver' });
    }

    avocat.photo.approved = true;
    avocat.onboardingStep = 6;
    await avocat.save();

    return res.status(200).json({ message: 'Photo approuvée', onboardingStep: 6 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Étape 8 — Disponibilités & Cabinet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/avocat/register/step8
 */
const registerStep8 = async (req, res) => {
  const { slots, emergencyEnabled, gouvernorat, quartier, address, lat, lng } = req.body;

  if (!address || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Adresse et coordonnées GPS sont requises' });
  }

  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    avocat.availability = {
      slots: slots || [],
      emergency: { enabled: emergencyEnabled || false },
    };
    avocat.officeLocation = {
      gouvernorat: gouvernorat || '',
      quartier: quartier || '',
      address,
      coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
      googleMapsLink: `https://www.google.com/maps?q=${lat},${lng}`,
    };
    avocat.onboardingStep = 9;
    await avocat.save();

    return res.status(200).json({ message: 'Disponibilités et localisation enregistrées', onboardingStep: 9 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Preview
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /auth/avocat/register/preview
 */
const getProfilePreview = async (req, res) => {
  try {
    const avocat = await Avocat.findById(req.user._id)
      .select('-password -otp -otpRequestedAt -resetPasswordToken -resetPasswordExpires');
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });
    return res.status(200).json({ preview: avocat });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Paiement — Flouci (online)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/avocat/register/payment-init
 * Body: { plan, amount }
 * → Crée un paiement Flouci et retourne le payment_url
 */
const initFlouciPayment = async (req, res) => {
  const { plan, amount } = req.body;

  if (!plan || !amount) {
    return res.status(400).json({ error: 'plan et amount sont requis' });
  }

  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    const flouciRes = await fetch('https://developers.flouci.com/api/generate_payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_token: process.env.FLOUCI_APP_TOKEN,
        app_secret: process.env.FLOUCI_APP_SECRET,
        amount: amount * 1000, // millimes (1 DT = 1000)
        accept_card: true,
        session_id: avocat._id.toString(),
        success_link: `${process.env.FRONTEND_URL}/avocat/onboarding/payment-success`,
        fail_link: `${process.env.FRONTEND_URL}/avocat/onboarding/payment-fail`,
        developer_tracking_id: `avocat-${avocat._id}-${Date.now()}`,
      }),
    });

    if (!flouciRes.ok) {
      const errData = await flouciRes.json().catch(() => ({}));
      console.error('[Flouci] init error:', errData);
      return res.status(500).json({ error: "Impossible d'initialiser le paiement Flouci", details: errData });
    }

    const flouciJson = await flouciRes.json();
    const { payment_id, link } = flouciJson.result;

    avocat.payment = {
      plan,
      mode: 'online',
      status: 'pending',
      amount,
      paymentId: payment_id,
    };
    await avocat.save();

    return res.status(200).json({ payment_url: link, payment_id });
  } catch (err) {
    console.error('[Flouci] init error:', err.message);
    return res.status(500).json({ error: "Impossible d'initialiser le paiement Flouci", details: err.message });
  }
};

/**
 * GET /auth/avocat/register/payment-verify?payment_id=xxx
 * → Appelé par le frontend après redirection Flouci (success_link)
 */
const verifyFlouciPayment = async (req, res) => {
  const { payment_id } = req.query;
  if (!payment_id) return res.status(400).json({ error: 'payment_id requis' });

  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    const flouciRes = await fetch(
      `https://developers.flouci.com/api/verify_payment/${payment_id}`,
      {
        method: 'GET',
        headers: {
          apppublic: process.env.FLOUCI_APP_TOKEN,
          appsecret: process.env.FLOUCI_APP_SECRET,
        },
      },
    );

    if (!flouciRes.ok) {
      const errData = await flouciRes.json().catch(() => ({}));
      console.error('[Flouci] verify error:', errData);
      return res.status(500).json({ error: 'Erreur vérification paiement', details: errData });
    }

    const { result } = await flouciRes.json();

    if (result?.status === 'SUCCESS') {
      avocat.payment.status = 'paid';
      avocat.payment.paidAt = new Date();
      avocat.status = 'pending';
      avocat.submittedAt = new Date();
      await avocat.save();

      await Notification.create({
        type: 'payment_confirmed',
        title: 'Paiement Flouci confirmé',
        message: `Paiement Flouci confirmé — ${avocat.firstName} ${avocat.lastName} (${avocat.email}) — Plan: ${avocat.payment.plan}`,
        recipientRole: 'admin',
        entity: { model: 'Avocat', id: avocat._id },
        meta: { plan: avocat.payment.plan, mode: 'flouci' },
      }).catch((e) => console.error('Notification error:', e));

      return res.status(200).json({ message: 'Paiement confirmé', status: 'paid' });
    }

    avocat.payment.status = 'failed';
    await avocat.save();
    return res.status(400).json({ error: 'Paiement non confirmé', status: result?.status || 'unknown' });
  } catch (err) {
    console.error('[Flouci] verify error:', err.message);
    return res.status(500).json({ error: 'Erreur vérification paiement', details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Paiement — Virement bancaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/avocat/register/payment-proof
 * Multipart — champ fichier : justif
 */
const savePaymentProof = async (req, res) => {
  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });
    if (!req.file) return res.status(400).json({ error: 'Justificatif requis' });

    avocat.payment = {
      plan: req.body.plan || '',
      mode: 'virement',
      status: 'pending',       // validation manuelle par admin
      amount: req.body.amount ? parseFloat(req.body.amount) : 0,
      proofUrl: req.file.path,   // URL Cloudinary
      paidAt: null,
    };
    avocat.status = 'pending';
    avocat.submittedAt = new Date();
    await avocat.save();

    await Notification.create({
      type: 'payment_pending',
      title: 'Virement bancaire en attente',
      message: `Virement en attente — ${avocat.firstName} ${avocat.lastName} (${avocat.email}) — Plan: ${avocat.payment.plan}`,
      recipientRole: 'admin',
      entity: { model: 'Avocat', id: avocat._id },
      meta: { plan: avocat.payment.plan, mode: 'virement' },
    }).catch((e) => console.error('Notification error:', e));

    return res.status(200).json({ message: 'Justificatif enregistré, en attente de validation' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Soumission finale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/avocat/register/submit
 * Body: { declarationAccepted: true }
 * Appelé après confirmation du paiement (Flouci ou virement)
 */
const submitRegistration = async (req, res) => {
  const { declarationAccepted } = req.body;

  if (!declarationAccepted) {
    return res.status(400).json({ error: 'Vous devez accepter la déclaration pour soumettre' });
  }

  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    if (!avocat.payment?.mode) {
      return res.status(400).json({
        error: 'Aucun paiement initié. Veuillez compléter le paiement avant de soumettre.',
      });
    }

    // Mettre à jour seulement si encore en draft
    if (avocat.status === 'draft') {
      avocat.status = 'pending';
      avocat.submittedAt = new Date();
    }
    avocat.onboardingStep = 9;
    await avocat.save();

    // Notifier seulement pour virement (Flouci notifie déjà dans verifyFlouciPayment)
    if (avocat.payment.mode === 'virement') {
      await Notification.create({
        type: 'document_submitted',
        title: 'Dossier avocat soumis',
        message: `Dossier soumis — ${avocat.firstName} ${avocat.lastName} — Virement en attente`,
        recipientRole: 'admin',
        entity: { model: 'Avocat', id: avocat._id },
        meta: { plan: avocat.payment.plan, mode: 'virement' },
      }).catch((err) => console.error('Erreur notification:', err));
    }

    return res.status(200).json({
      message: 'Dossier soumis. Vous recevrez une confirmation par email après validation.',
      reference: avocat._id,
      status: avocat.status,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Profil
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /auth/avocat/profile
 */
const getAvocatProfile = async (req, res) => {
  try {
    const avocat = await Avocat.findById(req.user._id)
      .select('-password -otp -otpRequestedAt -resetPasswordToken -resetPasswordExpires');
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });
    return res.status(200).json({ user: avocat, userType: 'avocat' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
};

/**
 * PATCH /auth/avocat/profile
 */
const updateAvocatProfile = async (req, res) => {
  const PROTECTED = [
    'password', '_id', 'email', 'status', 'isActive', 'isVerified',
    'onboardingStep', 'submittedAt', 'reviewedAt', 'otp', 'otpRequestedAt', 'payment',
  ];

  try {
    const updateData = { ...req.body };
    PROTECTED.forEach((field) => delete updateData[field]);

    if (updateData['officeLocation.coordinates']) {
      const { lat, lng } = updateData['officeLocation.coordinates'];
      if (lat && lng) {
        updateData['officeLocation.googleMapsLink'] = `https://www.google.com/maps?q=${lat},${lng}`;
      }
    }

    const avocat = await Avocat.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, select: '-password -otp -otpRequestedAt -resetPasswordToken -resetPasswordExpires' },
    );

    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });
    return res.status(200).json({ message: 'Profil mis à jour', user: avocat });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
};

/**
 * PATCH /auth/avocat/change-password
 */
const changePasswordAvocat = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Les deux mots de passe sont requis' });
  }
  if (!PASSWORD_POLICY.test(newPassword)) {
    return res.status(400).json({
      error: 'Le nouveau mot de passe doit contenir au moins 8 caractères et un chiffre',
    });
  }

  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    const isMatch = await bcrypt.compare(currentPassword, avocat.password);
    if (!isMatch) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });

    avocat.password = await bcrypt.hash(newPassword, 10);
    await avocat.save();

    return res.status(200).json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
};

/**
 * GET /avocat/:id/availability
 */
const getAvocatAvailability = async (req, res) => {
  try {
    const avocat = await Avocat.findById(req.params.id)
      .select('availability officeLocation firstName lastName');
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    return res.status(200).json({
      slots: avocat.availability?.slots || [],
      emergency: avocat.availability?.emergency || { enabled: false },
      officeLocation: avocat.officeLocation || {},
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset Password
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/avocat/forgot-password
 */
const forgotPasswordAvocat = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  try {
    const avocat = await Avocat.findOne({ email });
    if (!avocat) return res.status(200).json({ message: 'Si cet email existe, un lien a été envoyé.' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    avocat.resetPasswordToken = hashedToken;
    avocat.resetPasswordExpires = Date.now() + 24 * 60 * 60 * 1000;
    await avocat.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}&type=avocat`;

    try {
      await sendResetEmail(avocat.email, resetLink);
    } catch (mailErr) {
      console.error('Erreur envoi email reset:', mailErr);
      avocat.resetPasswordToken = undefined;
      avocat.resetPasswordExpires = undefined;
      await avocat.save();
      return res.status(500).json({ error: 'Échec envoi email. Réessayez.' });
    }

    return res.status(200).json({ message: 'Si cet email existe, un lien a été envoyé.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * POST /auth/avocat/reset-password
 */
const resetPasswordAvocat = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
  }
  if (!PASSWORD_POLICY.test(newPassword)) {
    return res.status(400).json({
      error: 'Le mot de passe doit contenir au moins 8 caractères et un chiffre',
    });
  }

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const avocat = await Avocat.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!avocat) return res.status(400).json({ error: 'Lien invalide ou expiré' });

    avocat.password = await bcrypt.hash(newPassword, 10);
    avocat.resetPasswordToken = undefined;
    avocat.resetPasswordExpires = undefined;
    await avocat.save();

    return res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Auth
  loginAvocat,
  forgotPasswordAvocat,
  resetPasswordAvocat,
  changePasswordAvocat,

  // Onboarding
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

  // Paiement
  initFlouciPayment,
  verifyFlouciPayment,
  savePaymentProof,

  // Profil
  getAvocatProfile,
  updateAvocatProfile,
  getAvocatAvailability,
};
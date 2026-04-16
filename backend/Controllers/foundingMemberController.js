const bcrypt   = require('bcrypt');
const FoundingMember         = require('../Model/FoundingMember');
const PendingFoundingSession = require('../Model/PendingFoundingSession');
const Notification           = require('../Model/Notification');
const { cloudinary } = require('../config/cloudinary');
const { transporter } = require('../config/mailer');
const {
  createToken,
  generateOtp,
  sendOtpByEmail,
  cleanupCloudinaryFiles,
  PASSWORD_POLICY,
} = require('./Helpers');

const MAX_SPOTS      = 50;
const ONAT_BAR_REGEX = /^[A-Z]{2}-\d{4}-\d{3,6}$/;

const normalizeEmail = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value.email) value = value.email;
  return String(value).toLowerCase().trim();
};

// ── Emails ─────────────────────────────────────────────────────────────────────

const sendConfirmedEmail = (member) => {
  const num = String(member.founderNumber).padStart(4, '0');
  return transporter.sendMail({
    from: `"Juridika.tn" <${process.env.EMAIL_USER}>`,
    to: member.email,
    subject: `🎉 Félicitations Membre Fondateur #${num} — Juridika.tn`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;background:#0d1520;color:#f0ece3;border-radius:8px;">
        <h2 style="color:#c9972c;">Juridika.tn</h2>
        <h3>Félicitations ${member.firstName} !</h3>
        <p>Votre dossier a été validé. Vous êtes officiellement
          <strong style="color:#c9972c;">Membre Fondateur #${num}</strong> de Juridika.tn.</p>
        <div style="background:#1a2535;border:1px solid #c9972c;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
          <div style="color:#c9972c;font-size:28px;font-weight:bold;">#${num}</div>
          <div style="color:#9ca3af;font-size:13px;margin-top:4px;">Votre numéro fondateur permanent</div>
        </div>
        <p>Plan <strong>${member.plan}</strong> à −30% garanti à vie par contrat.</p>
      </div>
    `,
  });
};

const sendRejectedEmail = (member) =>
  transporter.sendMail({
    from: `"Juridika.tn" <${process.env.EMAIL_USER}>`,
    to: member.email,
    subject: 'Votre dossier Membre Fondateur — Juridika.tn',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;background:#0d1520;color:#f0ece3;border-radius:8px;">
        <h2 style="color:#c9972c;">Juridika.tn</h2>
        <h3>Bonjour ${member.firstName},</h3>
        <p>Votre dossier n'a pas pu être validé.
          ${member.reviewNote ? `<br/><strong>Motif :</strong> ${member.reviewNote}` : ''}
        </p>
        <p>Pour toute question : <a href="mailto:${process.env.EMAIL_USER}" style="color:#c9972c;">${process.env.EMAIL_USER}</a></p>
      </div>
    `,
  });

// ── Stats (Public) ─────────────────────────────────────────────────────────────

// GET /api/founding-members/stats
const getStats = async (req, res) => {
  try {
    const confirmed = await FoundingMember.countDocuments({ status: 'confirmed' });
    const pending   = await FoundingMember.countDocuments({ status: 'pending' });
    const taken     = confirmed + pending;
    res.json({ total: MAX_SPOTS, taken, remaining: Math.max(0, MAX_SPOTS - taken), confirmed, pending });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ── Étape 1 — Créer la session temporaire + envoyer OTP ───────────────────────

// POST /api/founding-members/register/step1
const registerStep1 = async (req, res) => {
  const { firstName, lastName, phone, sameWhatsapp, whatsappPhone, password, languagePreference } = req.body;
  const email = normalizeEmail(req.body.email || req.query.email || req.body.emailAddress || req.body.email_address);

  if (!firstName || !lastName || !email || !phone || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  if (!PASSWORD_POLICY.test(password)) {
    return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum dont un chiffre' });
  }

  try {
    // Vérifier les places disponibles (seulement pending + confirmed, pas les sessions temporaires)
    const taken = await FoundingMember.countDocuments({ status: { $in: ['pending', 'confirmed'] } });
    if (taken >= MAX_SPOTS) {
      return res.status(409).json({ error: 'Les 50 places fondateurs sont complètes', code: 'NO_SPOTS' });
    }

    // Vérifier que l'email n'est pas déjà utilisé dans FoundingMember (compte finalisé)
    const existingMember = await FoundingMember.findOne({ email });
    if (existingMember) return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });

    let finalWhatsapp = null;
    if (sameWhatsapp) finalWhatsapp = phone;
    else if (whatsappPhone) finalWhatsapp = whatsappPhone;

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();

    // Upsert : si l'utilisateur retente avec le même email, on réinitialise la session
    await PendingFoundingSession.findOneAndUpdate(
      { email },
      {
        email,           // force la valeur normalisée
        hashedPassword,
        otp,
        otpRequestedAt: new Date(),
        isVerified: false,
        basicInfo: { firstName, lastName, phone, whatsappPhone: finalWhatsapp, languagePreference: languagePreference || 'fr' },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOtpByEmail(email, otp);

    return res.status(200).json({ message: 'Code OTP envoyé par email.', email });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Étape 2 — Vérification OTP ────────────────────────────────────────────────

// POST /api/founding-members/verify-email
const verifyEmail = async (req, res) => {
  const email = normalizeEmail(req.body?.email || req.query?.email || req.body?.emailAddress || req.body?.email_address);
  const otp   = (req.body?.otp   || '').toString().trim();
  if (!email) return res.status(400).json({ error: 'email requis' });
  if (!otp)   return res.status(400).json({ error: 'otp requis' });

  try {
    const session = await PendingFoundingSession.findOne({ email });
    if (!session) return res.status(404).json({ error: 'Session introuvable, veuillez recommencer' });
    if (session.isVerified) return res.status(400).json({ error: 'Email déjà vérifié' });

    const elapsed = (new Date() - session.otpRequestedAt) / 1000;
    if (elapsed > 600) return res.status(400).json({ error: 'OTP expiré, demandez un nouveau code' });
    if (session.otp !== otp) return res.status(400).json({ error: 'Code OTP invalide' });

    session.isVerified = true;
    session.otp = null;
    session.otpRequestedAt = null;
    await session.save();

    // JWT porte le sessionId (pour les uploads Cloudinary) et le userType pending_founding
    const token = createToken(session._id, 'pending_founding', 'pending_founding');
    return res.status(200).json({ message: 'Email vérifié.', token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/founding-members/resend-otp
const resendOtp = async (req, res) => {
  const email = normalizeEmail(req.body.email || req.query.email || req.body.emailAddress || req.body.email_address);
  if (!email) return res.status(400).json({ error: 'email requis' });

  try {
    const session = await PendingFoundingSession.findOne({ email });
    if (!session) return res.status(404).json({ error: 'Session introuvable' });
    if (session.isVerified) return res.status(400).json({ error: 'Email déjà vérifié' });

    const otp = generateOtp();
    session.otp = otp;
    session.otpRequestedAt = new Date();
    await session.save();
    await sendOtpByEmail(email, otp);

    return res.status(200).json({ message: 'Nouveau code OTP envoyé' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Étape 4 — Upload documents temporaires (Cloudinary, pas de DB) ────────────

// POST /api/founding-members/register/docs
const uploadDocsTemp = async (req, res) => {
  try {
    const sessionId = req.user._id;
    const files = req.files || {};
    const required = ['carteBarreauFront', 'carteBarreauBack', 'diplome', 'patente', 'casierJudiciaire'];
    const missing  = required.filter(d => !files[d]?.[0]);

    if (missing.length > 0) {
      await cleanupCloudinaryFiles(req);
      return res.status(400).json({ error: 'Tous les documents sont obligatoires', missing });
    }

    // Retourner les URLs Cloudinary — aucune écriture en base
    const urls = {};
    required.forEach(key => {
      urls[key] = files[key][0].path;
    });

    return res.status(200).json({ message: 'Documents uploadés', urls });
  } catch (err) {
    await cleanupCloudinaryFiles(req);
    return res.status(500).json({ error: err.message });
  }
};

// ── Étape 5 — Upload photo temporaire (Cloudinary, pas de DB) ─────────────────

// POST /api/founding-members/register/photo
const uploadPhotoTemp = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo requise' });

    const originalUrl = req.file.path;
    const publicId    = req.file.filename;

    const enhancedUrl = cloudinary.url(publicId, {
      transformation: [
        { background: 'white', width: 400, height: 400, crop: 'pad' },
        { effect: 'improve', mode: 'outdoor' },
        { effect: 'auto_brightness' },
      ],
    });

    // Retourner les URLs — aucune écriture en base
    return res.status(200).json({ message: 'Photo uploadée.', original: originalUrl, enhanced: enhancedUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Étape 8 — Soumission complète — création du FoundingMember ────────────────

// POST /api/founding-members/register/submit
const submitRegistration = async (req, res) => {
  try {
    const session = await PendingFoundingSession.findById(req.user._id);
    if (!session) return res.status(404).json({ error: 'Session introuvable, veuillez recommencer' });
    if (!session.isVerified) return res.status(403).json({ error: 'Email non vérifié' });

    // Vérifier les places au moment de la soumission finale
    const taken = await FoundingMember.countDocuments({ status: { $in: ['pending', 'confirmed'] } });
    if (taken >= MAX_SPOTS) {
      return res.status(409).json({ error: 'Les 50 places sont complètes — vous êtes sur liste d\'attente', code: 'NO_SPOTS' });
    }

    const {
      // Step 3 — identité
      barNumber, barRegion, graduationYear, practiceStatus, firmName, specialties, spokenLanguages,
      // Step 4 — documents (URLs Cloudinary déjà uploadées)
      docUrls,
      // Step 5 — photo (URLs Cloudinary déjà uploadées)
      photoOriginal, photoEnhanced,
      // Step 6 — disponibilités & cabinet
      slots, emergencyEnabled, gouvernorat, quartier, address, lat, lng,
      // Step 7 — plan
      plan,
    } = req.body;

    // Validations minimales
    if (!barNumber || !ONAT_BAR_REGEX.test(barNumber)) {
      return res.status(400).json({ error: 'Numéro ONAT invalide' });
    }
    if (!['essentiel', 'professionnel', 'cabinet'].includes(plan)) {
      return res.status(400).json({ error: 'Plan invalide' });
    }

    const { firstName, lastName, phone, whatsappPhone, languagePreference } = session.basicInfo;

    const member = await FoundingMember.create({
      // Step 1 — depuis la session
      firstName, lastName,
      email:             session.email,
      password:          session.hashedPassword,
      phone,
      whatsappPhone:     whatsappPhone || null,
      languagePreference: languagePreference || 'fr',
      isVerified:        true,

      // Step 3
      barNumber,
      barRegion:      barRegion     || '',
      graduationYear: parseInt(graduationYear) || 0,
      practiceStatus: practiceStatus || '',
      firmName:       firmName       || '',
      specialties:    Array.isArray(specialties) ? specialties : [],
      spokenLanguages: Array.isArray(spokenLanguages) ? spokenLanguages : [],

      // Step 4 — documents
      documents: docUrls ? {
        carteBarreauFront: { url: docUrls.carteBarreauFront, uploadedAt: new Date() },
        carteBarreauBack:  { url: docUrls.carteBarreauBack,  uploadedAt: new Date() },
        diplome:           { url: docUrls.diplome,           uploadedAt: new Date() },
        patente:           { url: docUrls.patente,           uploadedAt: new Date() },
        casierJudiciaire:  { url: docUrls.casierJudiciaire,  uploadedAt: new Date() },
      } : {},

      // Step 5 — photo
      photo: photoOriginal ? {
        original: photoOriginal,
        enhanced: photoEnhanced || photoOriginal,
        approved: true,
      } : {},

      // Step 6
      availability: {
        slots:     Array.isArray(slots) ? slots : [],
        emergency: { enabled: !!emergencyEnabled },
      },
      officeLocation: address ? {
        gouvernorat: gouvernorat || '',
        quartier:    quartier    || '',
        address,
        coordinates: { lat: parseFloat(lat) || 0, lng: parseFloat(lng) || 0 },
        googleMapsLink: lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : '',
      } : {},

      // Step 7
      plan,

      status:       'pending',
      submittedAt:  new Date(),
      onboardingStep: 8,
    });

    // Supprimer la session temporaire
    await PendingFoundingSession.findByIdAndDelete(session._id);

    // Notifier l'admin
    await Notification.create({
      type: 'new_founding_member',
      title: 'Nouveau membre fondateur',
      message: `Nouveau dossier Membre Fondateur — ${member.firstName} ${member.lastName} (${member.email}) — Plan: ${member.plan}`,
      recipientRole: 'admin',
      entity: { model: 'FoundingMember', id: member._id },
      meta: { plan: member.plan, email: member.email },
    }).catch(e => console.error('Notification error:', e));

    return res.status(201).json({
      message: 'Dossier soumis. Vous serez contacté sous 48h ouvrables.',
      reference: member._id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Admin ──────────────────────────────────────────────────────────────────────

// GET /api/founding-members
const getAll = async (req, res) => {
  try {
    const members = await FoundingMember.find()
      .select('-password -otp -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: 1 });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// PATCH /api/founding-members/:id/confirm
const confirm = async (req, res) => {
  try {
    const alreadyConfirmed = await FoundingMember.countDocuments({ status: 'confirmed' });
    if (alreadyConfirmed >= MAX_SPOTS) return res.status(400).json({ error: '50 places déjà confirmées' });

    const founderNumber = alreadyConfirmed + 1;
    const member = await FoundingMember.findByIdAndUpdate(
      req.params.id,
      { status: 'confirmed', founderNumber, confirmedAt: new Date() },
      { new: true }
    );
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    await sendConfirmedEmail(member);
    res.json({ message: `Fondateur #${String(founderNumber).padStart(4, '0')} confirmé`, member });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// PATCH /api/founding-members/:id/reject
const reject = async (req, res) => {
  try {
    const member = await FoundingMember.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', reviewNote: req.body.note || '', rejectedAt: new Date() },
      { new: true }
    );
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });
    await sendRejectedEmail(member);
    res.json({ message: 'Membre rejeté', member });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = {
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
};

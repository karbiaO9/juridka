const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const Schema   = mongoose.Schema;

const avocatSchema = new Schema({

  // ── Étape 1 — Infos de base ───────────────────────────────────────────────
  firstName:          { type: String, required: true },
  lastName:           { type: String, required: true },
  email:              { type: String, required: true, unique: true },
  password:           { type: String, required: true },
  phone:              { type: String, required: true, unique: true, sparse: true },
  whatsappPhone:      { type: String, default: null }, // null = pas de WhatsApp
  languagePreference: { type: String, enum: ['fr', 'ar', 'en'], default: 'fr' },

  // ── Étape 3 — Identité professionnelle ───────────────────────────────────
  barNumber:      { type: String },
  barRegion:      { type: String },
  graduationYear: { type: Number },
  practiceStatus: { type: String, enum: ['independant', 'associated', 'member'] },
  firmName:       { type: String },
  specialties: {
    type: [String],
    validate: { validator: v => v.length <= 3, message: 'Maximum 3 spécialités' },
  },
  spokenLanguages: { type: [String] },
  anneExperience:  { type: Number, default: null },
  bio:             { type: String, default: '' },
  disponibilite: {
    type: String,
    enum: ['disponible', 'en_audience', 'indisponible'],
    default: 'disponible',
  },

  // ── Étape 4 — Documents justificatifs ────────────────────────────────────
  documents: {
    carteBarreauFront: { url: String, uploadedAt: Date },
    carteBarreauBack:  { url: String, uploadedAt: Date },
    diplome:           { url: String, uploadedAt: Date },
    patente:           { url: String, uploadedAt: Date },
    casierJudiciaire:  { url: String, uploadedAt: Date },
  },

  // ── Étape 5 — Photo de profil ─────────────────────────────────────────────
  photo: {
    original: { type: String },
    enhanced: { type: String },
    approved: { type: Boolean, default: false },
  },

  // ── Étape 8 — Disponibilités & Cabinet ───────────────────────────────────
  availability: {
    slots: [{
      day:  { type: String },
      time: { type: String },
    }],
    emergency: {
      enabled: { type: Boolean, default: false },
    },
  },

  officeLocation: {
    gouvernorat: { type: String },
    quartier:    { type: String },
    address:     { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    googleMapsLink: { type: String },
  },

  // ── Paiement ──────────────────────────────────────────────────────────────
  payment: {
    mode:      { type: String, enum: ['online', 'virement'] },           // mode choisi
    status:    { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    amount:    { type: Number },                                          // montant en DT
    proofUrl:  { type: String },                                          // virement 
    paymentId: { type: String },                                          // Flouci : payment_id
  },

  // ── Onboarding ────────────────────────────────────────────────────────────
  onboardingStep: { type: Number, default: 1 },

  // ── Statut du compte ──────────────────────────────────────────────────────
  // draft → pending (soumis) → approved / rejected (admin)
  status:      { type: String, enum: ['draft', 'pending', 'approved', 'rejected'], default: 'draft' },
  submittedAt: { type: Date },
  reviewedAt:  { type: Date },
  reviewNote:  { type: String },

  // ── Auth & OTP ────────────────────────────────────────────────────────────
  isVerified:           { type: Boolean, default: false },
  otp:                  { type: String,  default: null },
  otpRequestedAt:       { type: Date },
  resetPasswordToken:   { type: String },
  resetPasswordExpires: { type: Date },

},  
  {timestamps: true,
  toJSON: { virtuals: true },   // ← ajouter ceci
  toObject: { virtuals: true }  // ← et ceci
});

// ── Virtual ───────────────────────────────────────────────────────────────────
avocatSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ── Static Login ──────────────────────────────────────────────────────────────
avocatSchema.statics.login = async function (email, password) {
  const avocat = await this.findOne({ email });
  if (!avocat) throw Error('Email ou mot de passe invalide');

  const match = await bcrypt.compare(password, avocat.password);
  if (!match) throw Error('Email ou mot de passe invalide');

  if (!avocat.isVerified) {
    const err  = Error('Email non vérifié');
    err.code   = 'EMAIL_NOT_VERIFIED';
    err.userId = avocat._id;
    throw err;
  }

  if (avocat.status !== 'approved') {
    const err = Error(
      avocat.status === 'rejected'
        ? 'Votre dossier a été refusé. Contactez le support.'
        : 'Votre compte est en attente de validation par notre équipe'
    );
    err.code = 'ACCOUNT_PENDING';
    throw err;
  }

  return avocat;
};
module.exports = mongoose.model('Avocat', avocatSchema);
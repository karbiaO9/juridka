const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const foundingMemberSchema = new mongoose.Schema({

  // ── Étape 1 — Infos de base ───────────────────────────────────────────────
  firstName:          { type: String, required: true },
  lastName:           { type: String, required: true },
  email:              { type: String, required: true, unique: true, lowercase: true },
  password:           { type: String, required: true },
  phone:              { type: String, required: true },
  whatsappPhone:      { type: String, default: null },
  languagePreference: { type: String, enum: ['fr', 'ar', 'en'], default: 'fr' },

  // ── Étape 3 — Identité professionnelle ───────────────────────────────────
  barNumber:      { type: String },
  barRegion:      { type: String },
  graduationYear: { type: Number },
  practiceStatus: { type: String, enum: ['independant', 'associated', 'member'] },
  firmName:       { type: String },
  specialties:    { type: [String], validate: { validator: v => v.length <= 3, message: 'Max 3 spécialités' } },
  spokenLanguages: { type: [String] },

  // ── Étape 4 — Documents ────────────────────────────────────────────────────
  documents: {
    carteBarreauFront: { url: String, uploadedAt: Date },
    carteBarreauBack:  { url: String, uploadedAt: Date },
    diplome:           { url: String, uploadedAt: Date },
    patente:           { url: String, uploadedAt: Date },
    casierJudiciaire:  { url: String, uploadedAt: Date },
  },

  // ── Étape 5 — Photo ────────────────────────────────────────────────────────
  photo: {
    original: { type: String },
    enhanced: { type: String },
    approved: { type: Boolean, default: false },
  },

  // ── Étape 6 — Disponibilités & Cabinet ───────────────────────────────────
  availability: {
    slots: [{ day: String, time: String }],
    emergency: { enabled: { type: Boolean, default: false } },
  },
  officeLocation: {
    gouvernorat:    { type: String },
    quartier:       { type: String },
    address:        { type: String },
    coordinates:    { lat: Number, lng: Number },
    googleMapsLink: { type: String },
  },

  // ── Étape 7 — Plan fondateur ───────────────────────────────────────────────
  plan: { type: String, enum: ['essentiel', 'professionnel', 'cabinet'], default: 'essentiel' },

  // ── Statut du dossier ──────────────────────────────────────────────────────
  // draft     → en cours d'onboarding
  // pending   → dossier soumis, attend review admin
  // confirmed → approuvé, numéro fondateur attribué
  // rejected  → rejeté par l'admin
  // waitlist  → plus de places disponibles
  status:      { type: String, enum: ['draft', 'pending', 'confirmed', 'rejected', 'waitlist'], default: 'draft' },
  submittedAt: { type: Date },
  confirmedAt: { type: Date },
  rejectedAt:  { type: Date },
  reviewNote:  { type: String, default: '' },

  // ── Numéro fondateur (#0001–#0050) ────────────────────────────────────────
  founderNumber: { type: Number, default: null },

  // ── Onboarding step ───────────────────────────────────────────────────────
  onboardingStep: { type: Number, default: 1 },

  // ── Auth & OTP ────────────────────────────────────────────────────────────
  isVerified:           { type: Boolean, default: false },
  otp:                  { type: String, default: null },
  otpRequestedAt:       { type: Date },
  resetPasswordToken:   { type: String },
  resetPasswordExpires: { type: Date },

}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

foundingMemberSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

foundingMemberSchema.statics.login = async function (email, password) {
  const member = await this.findOne({ email });
  if (!member) throw Error('Email ou mot de passe invalide');
  const match = await bcrypt.compare(password, member.password);
  if (!match) throw Error('Email ou mot de passe invalide');
  if (!member.isVerified) {
    const err = Error('Email non vérifié');
    err.code = 'EMAIL_NOT_VERIFIED';
    err.userId = member._id;
    throw err;
  }
  return member;
};

module.exports = mongoose.model('FoundingMember', foundingMemberSchema);

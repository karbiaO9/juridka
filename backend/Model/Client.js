const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const clientSchema = new mongoose.Schema(
  {
    // ─── Infos de base ────────────────────────────────────────────────────
    fullName: {
      type:     String,
      required: [true, 'Le nom complet est requis'],
      trim:     true,
    },
    email: {
      type:      String,
      required:  [true, "L'email est requis"],
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    password: {
      type:     String,
      required: [true, 'Le mot de passe est requis'],
    },
    phone: {
      type:     String,
      required: [true, 'Le numéro de téléphone est requis'],
      unique:   true,
      trim:     true,
    },
    role: {
      type:    String,
      enum:    ['client', 'admin'],
      default: 'client',
    },
    preferredLanguage: {
      type:    String,
      enum:    ['Français', 'Arabe', 'Anglais'],
      default: 'Français',
    },

    // ─── Vérification email OTP ───────────────────────────────────────────
    // emailVerified = true dès que l'OTP est validé
    emailVerified: {
      type:    Boolean,
      default: false,
    },

    // ─── Approbation admin ────────────────────────────────────────────────
    // isApproved = true seulement après action de l'admin
    isApproved: {
      type:    Boolean,
      default: false,
    },
    approvedAt: {
      type:    Date,
      default: null,
    },
    rejectedAt: {
      type:    Date,
      default: null,
    },

    // ─── Identité (étape 2) ───────────────────────────────────────────────
    idType: {
      type:    String,
      enum:    ['cin', 'passport', 'residence_permit', null],
      default: null,
    },
    idNumber: {
      type:    String,
      default: null,
      trim:    true,
    },
    idDocumentUrl: {
      type:    String,
      default: null,
    },
    profilePhotoUrl: {
      type:    String,
      default: null,
    },
    consentData: {
      type:    Boolean,
      default: false,
    },
    consentCgu: {
      type:    Boolean,
      default: false,
    },
    consentedAt: {
      type:    Date,
      default: null,
    },

    // ─── Besoin juridique (étape 3) ───────────────────────────────────────
    legalNeed: {
      governorate: { type: String, default: null },
      legalType:   { type: String, default: null },
      situation:   { type: String, default: null },
      urgency:     { type: String, enum: ['flexible', 'soon', 'urgent', null], default: null },
    },

    // ─── Avocat choisi (étape 4) ──────────────────────────────────────────
    chosenLawyerId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Avocat',
      default: null,
    },
    consultationType: {
      type:    String,
      enum:    ['in_person', 'video', 'phone', null],
      default: null,
    },

    // ─── Reset mot de passe ───────────────────────────────────────────────
    resetPasswordToken:   { type: String, default: null },
    resetPasswordExpires: { type: Date,   default: null },
  },
  { timestamps: true },
);

// ─── Virtual isVerified ───────────────────────────────────────────────────────
// Pour la compatibilité : isVerified = email OK + approuvé par admin
clientSchema.virtual('isVerified').get(function () {
  return this.emailVerified && this.isApproved;
});
clientSchema.set('toJSON',   { virtuals: true });
clientSchema.set('toObject', { virtuals: true });

// ─── Static login ─────────────────────────────────────────────────────────────
clientSchema.statics.login = async function (email, password) {
  const client = await this.findOne({ email });
  if (!client) throw new Error('Email ou mot de passe incorrect');
  const match = await bcrypt.compare(password, client.password);
  if (!match)  throw new Error('Email ou mot de passe incorrect');
  return client;
};

module.exports = mongoose.model('Client', clientSchema);
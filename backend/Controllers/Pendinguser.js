const mongoose = require('mongoose');

/**
 * PendingUser — stocke les inscriptions en attente de vérification OTP.
 * Le champ `createdAt` avec `expires: 600` supprime automatiquement
 * le document après 10 minutes grâce au TTL index de MongoDB.
 */
const pendingUserSchema = new mongoose.Schema(
  {
    fullName: {
      type:     String,
      required: true,
      trim:     true,
    },

    email: {
      type:     String,
      required: true,
      trim:     true,
    },

    password: {
      type:     String,
      required: true, // déjà hashé
    },

    phone: {
      type:     String,
      required: true,
      trim:     true,
    },

    role: {
      type:    String,
      default: 'client',
    },

    // ─── OTP ──────────────────────────────────────────────────────────────
    otp: {
      type:     String,
      required: true,
    },

    otpRequestedAt: {
      type:     Date,
      required: true,
    },

    otpAttempts: {
      type:    Number,
      default: 0, // max 5 avant suppression de la session
    },

    // TTL MongoDB : supprime le document automatiquement après 10 minutes
    createdAt: {
      type:    Date,
      default: Date.now,
      expires: 600, // secondes
    },
  },
);

module.exports = mongoose.model('PendingUser', pendingUserSchema);
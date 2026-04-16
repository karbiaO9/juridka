const mongoose = require('mongoose');

/**
 * Temporary session for the OTP verification phase (steps 1-2).
 * Deleted once the member submits the complete dossier (step 8).
 * The real FoundingMember is created ONLY at that point.
 */
const pendingFoundingSessionSchema = new mongoose.Schema({
  email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  hashedPassword: { type: String, required: true },
  isVerified:     { type: Boolean, default: false },
  otp:            { type: String },
  otpRequestedAt: { type: Date },

  // Basic info collected at step 1 — stored here so it doesn't go in JWT
  basicInfo: {
    firstName:           { type: String, required: true },
    lastName:            { type: String, required: true },
    phone:               { type: String },
    whatsappPhone:       { type: String, default: null },
    languagePreference:  { type: String, default: 'fr' },
  },

  // Auto-expire after 24 hours if registration not completed
  createdAt: { type: Date, default: Date.now, expires: 86400 },
});

module.exports = mongoose.model('PendingFoundingSession', pendingFoundingSessionSchema);

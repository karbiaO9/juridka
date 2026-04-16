const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../config/mailer');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_START = '08:00';
const DEFAULT_END   = '17:00';

const DAY_MAP = {
  lundi:    'Monday',
  mardi:    'Tuesday',
  mercredi: 'Wednesday',
  jeudi:    'Thursday',
  vendredi: 'Friday',
  samedi:   'Saturday',
  dimanche: 'Sunday',
};

const DEFAULT_WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PASSWORD_POLICY = /^(?=.*\d).{8,}$/;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a signed JWT for a given user.
 */
const createToken = (_id, role, userType) =>
  jwt.sign({ _id, role, userType }, process.env.JWT_SECRET, { expiresIn: '3d' });

/**
 * Generate a random 6-digit OTP string.
 */
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Send an OTP via Email (replaces SMS).
 */
const sendOtpByEmail = (email, code) =>{
   sendOtpEmail(email, code);
}
 

/**
 * Normalize a `disponibilites` object into the `workingHours` array format.
 */
const normalizeDisponibilites = (disponibilites) => {
  if (disponibilites && typeof disponibilites === 'object') {
    return Object.entries(disponibilites)
      .filter(([, val]) => val && val.available)
      .map(([key]) => ({
        day:   DAY_MAP[key] || key,
        start: DEFAULT_START,
        end:   DEFAULT_END,
      }));
  }
  return DEFAULT_WORKING_DAYS.map((day) => ({
    day,
    start: DEFAULT_START,
    end:   DEFAULT_END,
  }));
};

/**
 * Delete uploaded Cloudinary files on error.
 */
const cleanupCloudinaryFiles = async (req) => {
  const { cloudinary } = require('../config/cloudinary');
  const toDelete = [];

  if (req.files) {
    if (req.files.documentsVerif?.[0]?.public_id)
      toDelete.push(req.files.documentsVerif[0].public_id);
    if (req.files.avatarUrl?.[0]?.public_id)
      toDelete.push(req.files.avatarUrl[0].public_id);
  } else if (req.file?.public_id) {
    toDelete.push(req.file.public_id);
  }

  for (const publicId of toDelete) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error('Error deleting file from Cloudinary:', err);
    }
  }
};

module.exports = {
  createToken,
  generateOtp,
  sendOtpByEmail,
  normalizeDisponibilites,
  cleanupCloudinaryFiles,
  PASSWORD_POLICY,
};
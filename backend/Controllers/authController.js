const Client = require('../Model/Client');
const Avocat = require('../Model/Avocat');
const PendingUser = require('../Model/PendingUser');
const Notification = require('../Model/Notification');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { cloudinary } = require('../config/cloudinary');
const twilioClient = require('../config/twilio');
const { sendResetEmail } = require('../config/mailer');
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_START = '08:00';
const DEFAULT_END = '17:00';

const DAY_MAP = {
  lundi: 'Monday',
  mardi: 'Tuesday',
  mercredi: 'Wednesday',
  jeudi: 'Thursday',
  vendredi: 'Friday',
  samedi: 'Saturday',
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
 * Send an OTP via SMS using Twilio.
 */
const sendOtpSms = (phone, code) =>
  twilioClient.messages.create({
    body: `Votre code de vérification est : ${code}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone,
  });

/**
 * Normalize a `disponibilites` object into the `workingHours` array format.
 * Falls back to all default working days when no data is provided.
 */
const normalizeDisponibilites = (disponibilites) => {
  if (disponibilites && typeof disponibilites === 'object') {
    return Object.entries(disponibilites)
      .filter(([, val]) => val && val.available)
      .map(([key]) => ({
        day: DAY_MAP[key] || key,
        start: DEFAULT_START,
        end: DEFAULT_END,
      }));
  }

  // Default: Monday – Saturday
  return DEFAULT_WORKING_DAYS.map((day) => ({
    day,
    start: DEFAULT_START,
    end: DEFAULT_END,
  }));
};

/**
 * Find a user by ID, searching Client first then Avocat.
 * @returns {{ user, type }}
 */
const findUserById = async (id) => {
  let user = await Client.findById(id);
  if (user) return { user, type: 'client' };

  user = await Avocat.findById(id);
  return { user, type: 'avocat' };
};

/**
 * Delete uploaded Cloudinary files on error.
 */
const cleanupCloudinaryFiles = async (req) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// Auth Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /login
 */
const loginUser = async (req, res) => {
  const { email, password, userType } = req.body;

  try {
    let user;
    let role;
    let redirectUrl;
    let actualUserType;

    if (userType) {
      // ── Explicit user type ──────────────────────────────────────────────
      if (userType === 'client') {
        user = await Client.login(email, password);
        role = user.role;
        actualUserType = 'Client';
        redirectUrl = role === 'admin' ? '/admin/dashboard' : '/client/dashboard';
      } else if (userType === 'avocat') {
        user = await Avocat.login(email, password);
        role = 'avocat';
        actualUserType = 'Avocat';
        redirectUrl = '/avocat/dashboard';
      } else {
        return res.status(400).json({ error: 'userType must be client or avocat' });
      }
    } else {
      // ── Auto-detect: try Client, then Avocat ────────────────────────────
      try {
        user = await Client.login(email, password);
        role = user.role;
        actualUserType = 'Client';
        redirectUrl = role === 'admin' ? '/admin/dashboard' : '/client/dashboard';
      } catch {
        try {
          user = await Avocat.login(email, password);
          role = 'avocat';
          actualUserType = 'Avocat';
          redirectUrl = '/avocat/dashboard';
        } catch {
          return res.status(400).json({ error: 'Invalid email or password' });
        }
      }
    }

    const token = createToken(user._id, role, actualUserType);

    return res.status(200).json({
      user: {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        role,
        userType: actualUserType,
        status: actualUserType === 'Avocat' ? user.status : undefined,
        isVerified: actualUserType === 'Avocat' ? user.isVerified : undefined,
      },
      token,
      redirectUrl,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(400).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Signup Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /signup/client
 */
const signupClient = async (req, res) => {
  const { email, password, fullName, phone } = req.body;

  if (!email || !password || !fullName || !phone) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const existing = await Client.findOne({ phone });
    if (existing) {
      return res.status(400).json({ error: 'Phone already used' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = generateOtp();

    const pendingUser = await PendingUser.create({
      email,
      password: hashedPassword,
      fullName,
      phone,
      role: 'client',
      userType: 'client',
      otp,
      otpRequestedAt: new Date(),
    });

    await sendOtpSms(phone, otp);

    return res.status(200).json({
      message: 'OTP sent. Please verify.',
      pendingId: pendingUser._id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /signup/avocat
 */
const signupAvocat = async (req, res) => {
  console.log('🔍 Signup request received');
  console.log('Files:', req.files);
  console.log('Body:', req.body);
  console.log('Content-Type:', req.headers['content-type']);

  const {
    fullName, email, password, phone,
    ville, specialites, diplome,
    adresseCabinet, anneExperience,
    langues, bio, disponibilites,
  } = req.body;

  // Validate required fields
  if (!fullName || !email || !password || !phone || !ville || !specialites || !diplome) {
    return res.status(400).json({
      error: 'All required fields must be provided',
      missing: {
        fullName: !fullName,
        email: !email,
        password: !password,
        phone: !phone,
        ville: !ville,
        specialites: !specialites,
        diplome: !diplome,
      },
    });
  }

  try {
    // ── Extract uploaded file URLs ────────────────────────────────────────
    let documentUrl = null;
    let avatarUrl = null;

    if (req.files) {
      documentUrl = req.files.documentsVerif?.[0]?.path ?? null;
      avatarUrl = req.files.avatarUrl?.[0]?.path ?? null;
    } else if (req.file) {
      documentUrl = req.file.path;
    }

    // ── Parse optional fields ─────────────────────────────────────────────
    let parsedDisponibilites = null;
    if (disponibilites) {
      try {
        parsedDisponibilites = JSON.parse(disponibilites);
      } catch {
        console.error('Error parsing disponibilites');
      }
    }

    let parsedLangues = [];
    if (langues) {
      try {
        parsedLangues = typeof langues === 'string' ? JSON.parse(langues) : langues;
      } catch {
        console.error('Error parsing langues');
      }
    }

    const workingHours = normalizeDisponibilites(parsedDisponibilites);

    // ── Create Avocat document ────────────────────────────────────────────
    const user = await Avocat.signup(
      email, password, fullName, phone,
      ville, adresseCabinet, specialites, diplome,
      bio, documentUrl, workingHours,
      anneExperience ? parseInt(anneExperience) : null,
      parsedLangues, avatarUrl,
    );

    // Generate & send OTP
    const otp = generateOtp();
    user.otp = otp;
    user.otpRequestedAt = new Date();
    user.otpAttempts = 0;
    await user.save();

    try {
      await sendOtpSms(user.phone, otp);
    } catch (smsErr) {
      console.error('Failed to send OTP SMS to avocat:', smsErr);
    }

    // Notify admins
    try {
      await Notification.create({
        type: 'new_avocat',
        title: 'Nouvel avocat inscrit',
        message: `Nouvelle demande d'avocat : ${user.fullName} (${user.email})`,
        recipientRole: 'admin',
        entity: { model: 'Avocat', id: user._id },
        meta: { email: user.email, fullName: user.fullName },
      });
    } catch (notifErr) {
      console.error('Failed to create admin notification:', notifErr);
    }

    return res.status(200).json({
      message: 'Avocat signup successful. OTP sent to phone for verification. Please wait for admin approval after phone is verified.',
      userId: user._id,
    });
  } catch (error) {
    console.error('Avocat signup error:', error);
    await cleanupCloudinaryFiles(req);
    return res.status(400).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /verify-phone
 */
const verifyPhone = async (req, res) => {
  const { pendingId, otp } = req.body;

  try {
    const pending = await PendingUser.findById(pendingId);
    if (!pending) {
      return res.status(404).json({ error: 'Pending user not found' });
    }

    // Check OTP expiry (10 minutes)
    const elapsed = (new Date() - pending.otpRequestedAt) / 1000;
    if (elapsed > 600) {
      await PendingUser.findByIdAndDelete(pendingId);
      return res.status(400).json({ error: 'OTP expired' });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    let newUser;

    if (pending.role === 'client') {
      newUser = await Client.create({
        email: pending.email,
        password: pending.password,
        fullName: pending.fullName,
        phone: pending.phone,
        role: pending.role,
        isVerified: true,
      });
      // Notify admin of new client registration
      try {
        await Notification.create({
          type: 'new_client',
          title: 'Nouveau client inscrit',
          message: `Nouveau client : ${newUser.fullName} (${newUser.email})`,
          recipientRole: 'admin',
          entity: { model: 'Client', id: newUser._id },
          meta: { email: newUser.email, fullName: newUser.fullName },
        });
      } catch (notifErr) {
        console.error('Failed to create client notification:', notifErr);
      }
    } else if (pending.role === 'avocat') {
      newUser = await Avocat.create({
        ...pending.additionalData,
        email: pending.email,
        password: pending.password,
        fullName: pending.fullName,
        phone: pending.phone,
        isVerified: true,
      });
    }

    await PendingUser.findByIdAndDelete(pendingId);

    const token = createToken(newUser._id, newUser.role, pending.userType);

    return res.status(200).json({ message: 'Account created successfully', token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /resend-otp
 * Regenerates and resends the OTP for an existing, unverified user.
 */
const resendOtp = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const { user } = await findUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Phone already verified' });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpRequestedAt = new Date();
    user.otpAttempts = 0;
    await user.save();

    try {
      await sendOtpSms(user.phone, otp);
    } catch (smsErr) {
      console.error('Failed to send OTP SMS on resend:', smsErr);
    }

    return res.status(200).json({ message: 'OTP resent' });
  } catch (err) {
    console.error('resendOtp error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Profile Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /profile
 */
const getUserProfile = async (req, res) => {
  try {
    const { userType, _id } = req.user;
    const normalized = String(userType || '').toLowerCase();

    let user;
    if (normalized === 'client') {
      user = await Client.findById(_id).select('-password');
    } else if (normalized === 'avocat') {
      user = await Avocat.findById(_id).select('-password');
    }

    if (!user) {
      return res.status(404).json({ error: 'No User found' });
    }

    return res.status(200).json({
      user,
      userType: normalized,
      role: normalized === 'client' ? user.role : 'avocat',
    });
  } catch (error) {
    console.error(' getUserProfile error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * PATCH /profile
 * Updates allowed fields for the authenticated user.
 */
const updateProfile = async (req, res) => {
  try {
    const { userType, _id } = req.user;
    const normalized = String(userType || '').toLowerCase();
    const updateData = { ...req.body };

    console.log(' Update profile request received');
    console.log('User Type:', userType, '| User ID:', _id);
    console.log('Update Data:', updateData);

    // Strip fields that must not be updated here
    delete updateData.password;
    delete updateData._id;
    delete updateData.role;
    delete updateData.verified;

    let Model;

    if (normalized === 'client') {
      Model = Client;
    } else if (normalized === 'avocat') {
      Model = Avocat;

      // Map frontend field names → backend field names
      const fieldMap = {
        specialization: 'specialites',
        experience: 'anneExperience',
        barNumber: 'numeroBarreau',
        address: 'adresseCabinet',
      };

      for (const [from, to] of Object.entries(fieldMap)) {
        if (updateData[from] !== undefined) {
          updateData[to] = from === 'experience'
            ? parseInt(updateData[from])
            : updateData[from];
          delete updateData[from];
        }
      }

      // Normalize disponibilites → workingHours
      if (updateData.disponibilites) {
        try {
          const parsed = typeof updateData.disponibilites === 'string'
            ? JSON.parse(updateData.disponibilites)
            : updateData.disponibilites;

          updateData.workingHours = normalizeDisponibilites(parsed);
        } catch (e) {
          console.error('Error normalizing disponibilites in update:', e);
        }
        delete updateData.disponibilites;
      }
    } else {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    const user = await Model.findByIdAndUpdate(_id, updateData, {
      new: true,
      select: '-password',
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(' Profile updated successfully:', user);

    return res.status(200).json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error(' Profile update error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * PATCH /change-password
 */
const changePassword = async (req, res) => {
  console.log('🔐 changePassword called');
  console.log('req.user:', req.user);

  try {
    const { userType, _id } = req.user;
    const { currentPassword, newPassword } = req.body;
    const normalized = String(userType || '').toLowerCase();

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (!PASSWORD_POLICY.test(newPassword)) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters and include at least one number',
      });
    }

    let Model;
    if (normalized === 'client') Model = Client;
    else if (normalized === 'avocat') Model = Avocat;
    else return res.status(400).json({ error: 'Invalid user type' });

    const user = await Model.findById(_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await Model.findByIdAndUpdate(_id, { password: hashedPassword });

    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset Password Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /forgot-password
 */
const forgotPassword = async (req, res) => {
  const { email } = req.body;
 
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
 
  try {
    // Cherche dans Client puis Avocat
    let user = await Client.findOne({ email });
    let userType = 'client';
 
    if (!user) {
      user = await Avocat.findOne({ email });
      userType = 'avocat';
    }
 
    // Toujours répondre 200 — ne jamais révéler si l'email existe
    if (!user) {
      return res.status(200).json({ message: 'If this email exists, a reset link has been sent.' });
    }
 
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
 
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h
    await user.save();
    const org = req.get('origin') 
    // ✅ Plus de &type= dans l'URL — juste le token
    const resetLink = `${org}/reset-password?token=${rawToken}`; 
    try {
      await sendResetEmail(user.email, resetLink);
    } catch (mailErr) {
      console.error('Failed to send reset email:', mailErr);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({ error: 'Failed to send email. Please try again.' });
    }
 
    return res.status(200).json({ message: 'If this email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
/**
 * POST /reset-password
 */
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
 
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required' });
  }
 
  if (!PASSWORD_POLICY.test(newPassword)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters and include at least one number',
    });
  }
 
  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
 
    let user = await Client.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });
    let Model = Client;
 
    if (!user) {
      user = await Avocat.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() },
      });
      Model = Avocat;
    }
 
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    }
 
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
 
    await Model.findByIdAndUpdate(user._id, {
      password: hashed,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
    });
 
    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  loginUser,
  signupClient,
  signupAvocat,
  getUserProfile,
  updateProfile,
  changePassword,
  verifyPhone,
  resendOtp,
  forgotPassword,
  resetPassword,
};
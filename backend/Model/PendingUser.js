const mongoose = require('mongoose');

const pendingUserSchema = new mongoose.Schema({
    email: String,
    password: String,
    fullName: String,
    phone: String,
    role: String,       // 'client' ou 'avocat'
    userType: String,
    otp: String,
    otpRequestedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// TTL index: expire après 10 minutes
pendingUserSchema.index({ otpRequestedAt: 1 }, { expireAfterSeconds: 600 });

module.exports = mongoose.model('PendingUser', pendingUserSchema);
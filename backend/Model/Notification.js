const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
    // User registration
    'new_client',
    'new_avocat',
    'new_founding_member',
    // Verification
    'avocat_verified',
    'avocat_rejected',
    'founding_member_confirmed',
    'founding_member_rejected',
    // Payments
    'payment_confirmed',
    'payment_pending',
    'payment_failed',
    // Documents
    'document_submitted',
    // Testimonials
    'temoignage_submitted',
    'temoignage_approved',
    'temoignage_rejected',
    // Appointments
    'appointment_created',
    'appointment_confirmed',
    'appointment_rejected',
    'appointment_rescheduled',
    'appointment_cancelled',
];

const notificationSchema = new mongoose.Schema({
    /** Discriminator — used to render the right icon/label in the UI */
    type: {
        type: String,
        enum: NOTIFICATION_TYPES,
        required: true,
        index: true,
    },

    /** Short human-readable title (e.g. "Nouvel avocat inscrit") */
    title: { type: String, required: true },

    /** Longer description or auto-generated sentence */
    message: { type: String, required: true },

    /** Who should receive this notification */
    recipientRole: {
        type: String,
        enum: ['admin', 'avocat', 'client'],
        required: true,
        index: true,
    },

    /**
     * Optional: specific user targeted by this notification.
     * If set, only that user sees it (used for avocat/client-specific notifs).
     * If null, all users of recipientRole see it (used for admin broadcast).
     */
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true,
    },

    /**
     * The entity that triggered the notification.
     * entityModel  — Mongoose model name  (e.g. 'User', 'Avocat', 'FoundingMember')
     * entityId     — ObjectId of that document
     */
    entity: {
        model: { type: String },
        id: { type: mongoose.Schema.Types.ObjectId },
    },

    /**
     * Free-form extra data (plan name, amount, rejection note, …).
     * Keep small — this is not a substitute for the referenced entity.
     */
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },

    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
}, { timestamps: true });

// Compound indexes for the most common queries
notificationSchema.index({ recipientRole: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

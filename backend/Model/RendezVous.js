const mongoose = require('mongoose');
const { Schema } = mongoose;

const RendezVousSchema = new Schema({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  avocatId: {
    type: Schema.Types.ObjectId,
    ref: 'Avocat',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  heure: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['visio', 'physique'],
    required: true
  },
  // Services requested for this appointment. Each service carries a price.
  services: [{
    name: { type: String },
    description: { type: String },
    price: { type: Number},
    currency: { type: String, default: 'USD' }
  }],
  // Optional case file(s) uploaded by the client prior to the meeting
  caseFiles: [{
    url: { type: String},
    filename: { type: String },
    contentType: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Client' },
    uploadedAt: { type: Date, default: Date.now }
  }],
  statut: {
    type: String,
    enum: ['en_attente', 'confirmé', 'annulé', 'terminé', 'refusé'],
    default: 'en_attente',
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['not_paid', 'paid_online', 'paid_in_person', 'pending'],
    default: 'not_paid'
  },
  paymentMethod: {
    type: String,
    enum: ['online', 'in_person', 'after_consultation'],
    default: 'after_consultation'
  },
  paymentConfirmedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Avocat' // Lawyer who confirmed the payment
  },
  paymentConfirmedAt: {
    type: Date
  },
  notes: {
    type: String // Additional notes from client
  }
}, { timestamps: true });

module.exports = mongoose.model('RendezVous', RendezVousSchema);

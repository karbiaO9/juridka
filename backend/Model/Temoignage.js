const mongoose = require('mongoose');

function generateRef() {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `AV-${year}-${rand}`;
}

const temoignageSchema = new mongoose.Schema({
  clientId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Client',    required: true },
  avocatId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Avocat',    required: true },
  rendezVousId: { type: mongoose.Schema.Types.ObjectId, ref: 'RendezVous', required: true, unique: true },

  ratings: {
    ecoute:      { type: Number, min: 1, max: 5, default: null },
    clarte:      { type: Number, min: 1, max: 5, default: null },
    pertinence:  { type: Number, min: 1, max: 5, default: null },
    ponctualite: { type: Number, min: 1, max: 5, default: null },
    accueil:     { type: Number, min: 1, max: 5, default: null },
  },

  texte:   { type: String, maxlength: 1000, default: '' },

  statut: {
    type:    String,
    enum:    ['en_attente', 'approuvé', 'rejeté'],
    default: 'en_attente',
  },

  reference:    { type: String, unique: true },
  nomAnonyme:   { type: String, required: true },

  consentPublier: { type: Boolean, required: true },
  consentStats:   { type: Boolean, default: false },

  windowExpireAt: { type: Date, required: true },
  publishedAt:    { type: Date, default: null },
}, { timestamps: true });

temoignageSchema.pre('save', function (next) {
  if (!this.reference) this.reference = generateRef();
  next();
});

module.exports = mongoose.model('Temoignage', temoignageSchema);

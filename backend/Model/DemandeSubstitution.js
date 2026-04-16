const mongoose = require('mongoose');

const demandeSubstitutionSchema = new mongoose.Schema({
  avocatId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Avocat', required: true },
  tribunal:      { type: String, required: true },
  dateAudience:  { type: Date, required: true },
  nature: {
    type: String,
    enum: ['audience_civile', 'chambre_commerciale', 'chambre_penale', 'chambre_administrative', 'mise_en_etat', 'autre'],
    required: true,
  },
  contexte:      { type: String, default: '' },
  procurationUrl:{ type: String, default: null },
  statut: {
    type: String,
    enum: ['en_attente', 'acceptee', 'retiree'],
    default: 'en_attente',
  },
  accepteePar:   { type: mongoose.Schema.Types.ObjectId, ref: 'Avocat', default: null },
  ignoredBy:     { type: [mongoose.Schema.Types.ObjectId], ref: 'Avocat', default: [] },
  urgente:       { type: Boolean, default: false },
}, { timestamps: true });

// Auto-calculer urgente avant save
demandeSubstitutionSchema.pre('save', function (next) {
  if (this.dateAudience) {
    const diff = new Date(this.dateAudience) - new Date();
    this.urgente = diff > 0 && diff < 24 * 60 * 60 * 1000;
  }
  next();
});

module.exports = mongoose.model('DemandeSubstitution', demandeSubstitutionSchema);

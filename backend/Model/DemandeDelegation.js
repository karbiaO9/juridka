const mongoose = require('mongoose');

const reponseSchema = new mongoose.Schema({
  avocatId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Avocat', required: true },
  message:   { type: String, default: '' },
  lu:        { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const demandeDelegationSchema = new mongoose.Schema({
  avocatId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Avocat', required: true },
  specialite:   { type: String, required: true },
  gouvernorat:  { type: String, required: true },
  description:  { type: String, required: true },
  delai: {
    type: String,
    enum: ['urgent', 'quelques_jours', '1_semaine', '2_semaines', 'flexible'],
    default: 'flexible',
  },
  langues:      { type: [String], default: [] },
  statut: {
    type: String,
    enum: ['brouillon', 'en_attente', 'active', 'retiree'],
    default: 'en_attente',
  },
  reponses:     { type: [reponseSchema], default: [] },
  savedBy:      { type: [mongoose.Schema.Types.ObjectId], ref: 'Avocat', default: [] },
  conventionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConventionCollaboration', default: null },
}, { timestamps: true });

module.exports = mongoose.model('DemandeDelegation', demandeDelegationSchema);

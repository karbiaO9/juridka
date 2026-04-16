const mongoose = require('mongoose');

const conventionCollaborationSchema = new mongoose.Schema({
  avocat1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Avocat', required: true },
  avocat2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Avocat', required: true },
  objet:     { type: String, default: '' },
  type: {
    type: String,
    enum: ['delegation', 'substitution', 'collaboration'],
    default: 'collaboration',
  },
  statut: {
    type: String,
    enum: ['proposee', 'signee', 'active', 'terminee'],
    default: 'proposee',
  },
  demandeLieeId:   { type: mongoose.Schema.Types.ObjectId, default: null },
  demandeLieeType: { type: String, enum: ['delegation', 'substitution', null], default: null },
  dateSignature:   { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('ConventionCollaboration', conventionCollaborationSchema);

const mongoose = require('mongoose');

const conversationProSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Avocat', required: true }],

  // Dernier message (pour l'aperçu dans la liste)
  lastMessage: {
    content:   { type: String, default: '' },
    senderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Avocat' },
    createdAt: { type: Date },
    hasFile:   { type: Boolean, default: false },
  },

  // Compteur de non-lus par avocat { "avocatId": count }
  unreadCounts: { type: Map, of: Number, default: {} },

  // Avocats qui ont supprimé la conversation de leur côté
  deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Avocat' }],

  // Contexte optionnel (lié à une délégation ou substitution)
  contexte: {
    type:  { type: String, enum: ['delegation', 'substitution', null], default: null },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
}, { timestamps: true });

// Index pour trouver rapidement les conversations d'un avocat
conversationProSchema.index({ participants: 1 });

module.exports = mongoose.model('ConversationPro', conversationProSchema);

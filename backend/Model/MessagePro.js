const mongoose = require('mongoose');

const messageProSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'ConversationPro',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Avocat',
    required: true,
  },
  content: { type: String, default: '' },

  // Fichier joint (optionnel)
  fileUrl:  { type: String, default: null },
  fileName: { type: String, default: null },
  fileSize: { type: Number, default: null },

  // IDs des avocats qui ont lu ce message
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Avocat' }],
}, { timestamps: true });

module.exports = mongoose.model('MessagePro', messageProSchema);

const mongoose = require('mongoose');

const documentProSchema = new mongoose.Schema({
  avocatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Avocat', required: true },
  fileUrl:  { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, default: 0 }, // bytes
  categorie: {
    type: String,
    enum: ['travail_anonymise', 'procuration', 'convention', 'modele', 'autre'],
    default: 'travail_anonymise',
  },
  badge: {
    type: String,
    enum: ['anonymise', 'confidentiel'],
    default: 'anonymise',
  },
  declarationSignee: { type: Boolean, default: false },
  partageAvec: { type: [mongoose.Schema.Types.ObjectId], ref: 'Avocat', default: [] },
}, { timestamps: true });

module.exports = mongoose.model('DocumentPro', documentProSchema);

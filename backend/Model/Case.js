const mongoose = require('mongoose');
const { Schema } = mongoose;

const caseSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  state: { type: String, enum: ['Open', 'In Progress', 'Closed'], default: 'Open' },
  files: [{ type: String }],
  lawyer: { type: Schema.Types.ObjectId, ref: 'Avocat', required: true },
  client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  appointment: { type: Schema.Types.ObjectId, ref: 'RendezVous', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Case', caseSchema);

const mongoose = require('mongoose');

const pariuSchema = new mongoose.Schema({
  meci: { type: String, required: true },
  competitie: { type: String },
  pronostic: { type: String, required: true },
  cota: { type: Number, required: true },
  agentie: { type: String, required: true },
  mizaRecomandata: { type: Number, required: true },
  avantajEV: { type: Number, required: true },
  dataMeci: { type: Date },
  dataSalvare: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['In Asteptare', 'Castigat', 'Pierdut', 'Anulat'],
    default: 'In Asteptare'
  },
  ai_decizie: { type: String, default: 'Nespecificat' },
  ai_motiv: { type: String, default: '' },
  clvFinal: { type: Number, default: null },
  mesajCLV: { type: String, default: "" },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }
});

module.exports = mongoose.model('Pariu', pariuSchema);

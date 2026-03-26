const mongoose = require('mongoose');

const cacheSchema = new mongoose.Schema({
  numeApi: { type: String, required: true, unique: true },
  ultimulUpdate: { type: Number, required: true },
  date: { type: mongoose.Schema.Types.Mixed, required: true }
});

module.exports = mongoose.model('Cache', cacheSchema);

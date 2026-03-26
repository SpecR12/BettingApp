const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  parola: { type: String, required: true },
  dataCreare: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

module.exports = { User };

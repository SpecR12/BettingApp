const mongoose = require('mongoose');

// =========================================================================
// 1. MeciEsports: Aici stau DOAR meciurile care au COTE (Sursa pt Radar)
// =========================================================================
const meciEsportsSchema = new mongoose.Schema({
  id: { type: String, unique: true }, // ID-ul unic al meciului (evită duplicatele în Radar)
  fixtureId: String, // Referința exactă către OddsPapi
  sport_key: String,
  sport_title: String,
  home_team: String,
  away_team: String,
  commence_time: Date,
  source: { type: String, default: 'oddspapi-db' },
  bookmakers: Array,
  dataActualizare: { type: Date, default: Date.now }
});

// =========================================================================
// 2. FixtureCache: Aici stă "Harta" cu toate meciurile (Sursa pt Miner)
// =========================================================================
const fixtureSchema = new mongoose.Schema({
  fixtureId: { type: String, unique: true },
  sportId: Number,
  sport_key: String,
  home_team: String,
  away_team: String,
  commence_time: Date,
  lastOddsUpdate: Date
});

const MeciEsports = mongoose.model('MeciEsports', meciEsportsSchema);
const FixtureCache = mongoose.model('FixtureCache', fixtureSchema);

module.exports = { MeciEsports, FixtureCache };

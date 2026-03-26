const axios = require('axios');
const cron = require('node-cron');
const Cache = require('../models/Cache.model');
require('dotenv').config();

// ==========================================
// ⛏️ MINERUL (Rulează doar în fundal)
// ==========================================
async function fetchAndSaveOddsApi() {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) return;

    console.log("\n🌍 [CRON] The Odds API: Tragem cote noi (Mod Economic)...");

    const response = await axios.get('https://api.the-odds-api.com/v4/sports/upcoming/odds/', {
      params: { apiKey: apiKey, regions: 'eu,us', markets: 'h2h,totals' }
    });

    await Cache.findOneAndUpdate(
      { numeApi: 'OddsAPI' },
      {
        ultimulUpdate: Date.now(),
        date: response.data
      },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`✅ [CRON] The Odds API a salvat ${response.data.length} meciuri în baza de date!`);

    if (response.headers['x-requests-remaining']) {
      console.log(`📊 [Odds API] Credite rămase luna aceasta: ${response.headers['x-requests-remaining']}`);
    }

  } catch (error) {
    console.error("❌ [CRON] Eroare The Odds API:", error.response?.data?.message || error.message);
  }
}

// ==========================================
// ⏰ PROGRAMATORUL (Declanșatorul)
// ==========================================
function startOddsApiCron() {
  cron.schedule('0 9,17 * * *', fetchAndSaveOddsApi);
  console.log('⏰ [CRON] Pipeline-ul The Odds API a fost programat (la 09:00 și 17:00).');
}

// ==========================================
// 📖 CITITORUL (Acesta este apelat de Controller la click!)
// ==========================================
async function fetchDeLaOddsApi() {
  try {
    const cacheLocal = await Cache.findOne({ numeApi: 'OddsAPI' });

    if (cacheLocal && cacheLocal.date) {
      console.log(`💾 The Odds API: Date extrase din MongoDB local! (Super rapid, 0 request-uri consumate)`);
      return cacheLocal.date;
    }

    return [];
  } catch (err) {
    console.error("⚠️ Eroare la citirea The Odds API din MongoDB:", err.message);
    return [];
  }
}

module.exports = { fetchDeLaOddsApi, startOddsApiCron };

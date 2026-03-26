const axios = require('axios');
const cron = require('node-cron');
const { MeciEsports, FixtureCache } = require('../models/MeciEsports.model');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAndSaveOddsPapi() {
  try {
    const apiKey = process.env.ODDSPAPI_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ ODDSPAPI_API_KEY lipsește din .env");
      return;
    }

    const baseURL = 'https://api.oddspapi.io/v4';

    const acum = new Date();
    const fromDate = acum.toISOString().split('.')[0] + 'Z';
    const toDate = new Date(acum.getTime() + 48 * 60 * 60 * 1000).toISOString().split('.')[0] + 'Z';

    console.log(`\n🔍 [OddsPapi] Pipeline START. Extrag Fixtures de la ${fromDate} la ${toDate}...`);

    const sportIds = [16, 17, 18, 61];
    const sportMap = { 16: 'CS2', 17: 'Dota 2', 18: 'LoL', 61: 'Valorant' };

    // ==========================================
    // PAS 1 & 2: GET FIXTURES
    // ==========================================
    for (const sportId of sportIds) {
      try {
        await sleep(5000); // 🛡️ Pauză anti Rate-Limit
        const fixturesRes = await axios.get(`${baseURL}/fixtures`, {
          params: { sportId, from: fromDate, to: toDate, hasOdds: 'true', apiKey }
        });

        const fixtures = fixturesRes.data || [];
        for (const f of fixtures) {
          await FixtureCache.findOneAndUpdate(
            { fixtureId: f.id },
            {
              sport_key: `esports_${sportId}`,
              home_team: f.home_team || f.homeTeam,
              away_team: f.away_team || f.awayTeam,
              commence_time: f.commence_time || f.date
            },
            { upsert: true }
          );
        }
      } catch (err) {
        console.error(`⚠️ [OddsPapi] Eroare Fixtures pt Sport ${sportId}:`, err.response ? err.response.data : err.message);
      }
    }

    // ==========================================
    // PAS 3: GET ODDS (Limitat la 8 pt economie)
    // ==========================================
    const fixturesDeActualizat = await FixtureCache.find({
      commence_time: { $gt: acum },
      $or: [
        { lastOddsUpdate: { $exists: false } },
        { lastOddsUpdate: { $lt: new Date(acum.getTime() - 12 * 60 * 60 * 1000) } }
      ]
    }).limit(8);

    console.log(`🎯 [OddsPapi] Am găsit ${fixturesDeActualizat.length} meciuri noi. Extrag cotele de la API...`);

    for (const f of fixturesDeActualizat) {
      console.log(`💰 Consum 1 request pt cota: ${f.home_team} vs ${f.away_team}`);
      try {
        await sleep(5000);

        const oddsRes = await axios.get(`${baseURL}/odds`, {
          params: { fixtureId: f.fixtureId, oddsFormat: 'decimal', verbosity: '3', apiKey }
        });

        if (oddsRes.data && oddsRes.data.bookmakers) {
          const idSportClean = f.sport_key.split('_')[1];
          const titluFrumos = sportMap[idSportClean] || 'eSports';

          await MeciEsports.findOneAndUpdate(
            { id: f.fixtureId },
            {
              id: f.fixtureId,
              sport_key: f.sport_key,
              sport_title: titluFrumos,
              home_team: f.home_team,
              away_team: f.away_team,
              commence_time: f.commence_time,
              bookmakers: oddsRes.data.bookmakers,
              source: 'oddspapi-api',
              dataActualizare: new Date()
            },
            { upsert: true }
          );
          f.lastOddsUpdate = new Date();
          await f.save();
        }
      } catch (oddsErr) {
        console.error(`❌ [OddsPapi] Eroare Cote pt ${f.fixtureId}:`, oddsErr.response ? oddsErr.response.data : oddsErr.message);
      }
    }
    console.log('✅ [OddsPapi] Pipeline finalizat cu succes! Meciurile sunt in baza de date.\n');
  } catch (error) {
    console.error('❌ [OddsPapi] Eroare Critică Pipeline:', error.message);
  }
}

// ==========================================
// ⏰ PROGRAMATORUL (Declanșatorul)
// ==========================================
function startOddsPapiWeekendCron() {
  // 🛡️ Rulează doar Sâmbătă și Duminică, doar de 2 ori pe zi: dimineața (09:00) și seara (18:00).
  cron.schedule('0 9,18 * * 6,0', fetchAndSaveOddsPapi);
  console.log('⏰ [CRON] Pipeline-ul OddsPapi a fost programat (Sâmbătă/Duminică la 09:00 și 18:00).');
}

// ==========================================
// 📖 CITITORUL (Rămâne neschimbat)
// ==========================================
async function fetchDeLaOddsPapi() {
  try {
    const acum = new Date();
    const meciuriDB = await MeciEsports.find({
      commence_time: { $gt: acum },
      bookmakers: { $exists: true, $not: { $size: 0 } }
    });

    console.log(`💾 OddsPapi: Date extrase din MongoDB local! (${meciuriDB.length} meciuri de eSports găsite. 0 request-uri consumate la API)`);
    return meciuriDB;
  } catch (error) {
    console.error("❌ Eroare la citirea eSports din baza de date:", error.message);
    return [];
  }
}

module.exports = { fetchDeLaOddsPapi, startOddsPapiWeekendCron};

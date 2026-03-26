const axios = require('axios');
const cron = require('node-cron');
const Cache = require('../models/Cache.model');
require('dotenv').config();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// ⛏️ MINERUL (Rulează doar în fundal, lent și sigur)
// ==========================================
async function fetchAndSaveApiFootball() {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      console.log("❌ [CRON] Eroare: API_FOOTBALL_KEY lipsește din .env");
      return;
    }

    console.log("\n🌍 [CRON] API-Sports: Tragem cote noi pentru 8 SPORTURI (Mod Sigur - Max 3 pagini/zi)...");

    const headers = { 'x-apisports-key': String(apiKey) };
    const zileDeScanat = [];
    const NUMAR_ZILE = 3;

    for (let i = 0; i < NUMAR_ZILE; i++) {
      const data = new Date();
      data.setDate(data.getDate() + i);
      zileDeScanat.push(data.toISOString().split('T')[0]);
    }

    const sporturi = [
      { idDomeniu: 'fotbal', nume: 'Fotbal', url: 'https://v3.football.api-sports.io', rutaMeciuri: '/fixtures' },
      { idDomeniu: 'baschet', nume: 'Baschet', url: 'https://v1.basketball.api-sports.io', rutaMeciuri: '/games' },
      { idDomeniu: 'hochei', nume: 'Hochei', url: 'https://v1.hockey.api-sports.io', rutaMeciuri: '/games' },
      { idDomeniu: 'volei', nume: 'Volei', url: 'https://v1.volleyball.api-sports.io', rutaMeciuri: '/games' },
      { idDomeniu: 'baseball', nume: 'Baseball', url: 'https://v1.baseball.api-sports.io', rutaMeciuri: '/games' },
      { idDomeniu: 'handbal', nume: 'Handbal', url: 'https://v1.handball.api-sports.io', rutaMeciuri: '/games' },
      { idDomeniu: 'rugby', nume: 'Rugby', url: 'https://v1.rugby.api-sports.io', rutaMeciuri: '/games' },
      { idDomeniu: 'american-football', nume: 'Fotbal American', url: 'https://v1.american-football.api-sports.io', rutaMeciuri: '/games' }
    ];

    let toateDateleFormatate = [];

    for (const sport of sporturi) {
      let meciuriBrute = [];
      let coteBrute = [];

      for (const data of zileDeScanat) {
        try {
          await sleep(7000);
          const fixturesRes = await axios.get(`${sport.url}${sport.rutaMeciuri}`, { params: { date: data }, headers });
          if (fixturesRes.data && fixturesRes.data.response) meciuriBrute.push(...fixturesRes.data.response);

          let paginaCurenta = 1;
          let totalPagini = 1;
          const MAX_PAGINI_PERMISE = 3;

          while (paginaCurenta <= totalPagini && paginaCurenta <= MAX_PAGINI_PERMISE) {
            await sleep(7000);

            console.log(`⏳ Tragem cote pt ${sport.nume} (${data}) - Pagina ${paginaCurenta}...`);
            const oddsRes = await axios.get(`${sport.url}/odds`, { params: { date: data, page: paginaCurenta }, headers });

            if (oddsRes.data && oddsRes.data.response) {
              coteBrute.push(...oddsRes.data.response);
              if (oddsRes.data.paging && oddsRes.data.paging.total) {
                totalPagini = oddsRes.data.paging.total;
              }
            } else {
              break;
            }
            paginaCurenta++;
          }

        } catch (err) {
          console.error(`⚠️ [CRON] Eroare API la ${sport.nume} pe ${data}:`, err.message);
        }
      }

      const dictionarEchipe = {};
      meciuriBrute.forEach(m => {
        const meciId = m.fixture ? m.fixture.id : m.id;
        const ligaNume = m.league?.name || "Competiție";
        dictionarEchipe[meciId] = {
          home: m.teams?.home?.name || "Echipă Gazdă",
          away: m.teams?.away?.name || "Echipă Oaspete",
          sport: `${sport.nume} - ${ligaNume}`,
          dataStart: m.fixture ? m.fixture.date : m.date
        };
      });

      coteBrute.forEach(item => {
        const idMeciCote = item.fixture ? item.fixture.id : item.game.id;
        const detaliiMeci = dictionarEchipe[idMeciCote];
        if (!detaliiMeci) return;

        const bookmakersFormatati = [];

        item.bookmakers?.forEach(bm => {
          const marketCastigator = bm.bets?.find(bet => bet.id === 1 || bet?.name === 'Match Winner' || bet?.name === 'Home/Away');

          if (marketCastigator && marketCastigator.values?.length >= 2) {
            const cota1 = marketCastigator.values.find(v => v.value === 'Home' || v.value === '1')?.odd;
            const cota2 = marketCastigator.values.find(v => v.value === 'Away' || v.value === '2')?.odd;

            if (cota1 && cota2) {
              bookmakersFormatati.push({
                key: bm.name?.toLowerCase() || 'unknown',
                title: bm.name || 'Agenție Necunoscută',
                markets: [{
                  outcomes: [
                    { name: detaliiMeci.home, price: parseFloat(cota1) },
                    { name: detaliiMeci.away, price: parseFloat(cota2) }
                  ]
                }]
              });
            }
          }
        });

        if (bookmakersFormatati.length >= 2) {
          toateDateleFormatate.push({
            id: `${sport.idDomeniu}_${idMeciCote}`,
            sport_group: sport.nume,
            sport_title: detaliiMeci.sport,
            home_team: detaliiMeci.home,
            away_team: detaliiMeci.away,
            commence_time: detaliiMeci.dataStart,
            bookmakers: bookmakersFormatati
          });
        }
      });
    }

    if (toateDateleFormatate.length > 0) {
      await Cache.findOneAndUpdate(
        { numeApi: 'ApiSports_v3' },
        { ultimulUpdate: Date.now(), date: toateDateleFormatate },
        { upsert: true, returnDocument: 'after'}
      );
      console.log(`✅ [CRON] API-Sports a salvat cu succes ${toateDateleFormatate.length} meciuri în MongoDB!`);
    } else {
      console.log("⚠️ [CRON] API-Sports a returnat 0 meciuri salvabile.");
    }

  } catch (error) {
    console.error("❌ [CRON] Eroare Critică API-Sports:", error.message);
  }
}

// ==========================================
// ⏰ PROGRAMATORUL (Declanșatorul)
// ==========================================
function startApiFootballCron() {
  cron.schedule('0 */6 * * *', fetchAndSaveApiFootball);
  console.log('⏰ [CRON] Pipeline-ul API-Sports a fost programat (din 6 în 6 ore).');
}

// ==========================================
// 📖 CITITORUL (Acesta este apelat de Controller!)
// ==========================================
async function fetchDeLaApiFootball() {
  try {
    const cacheLocal = await Cache.findOne({ numeApi: 'ApiSports_v3' });

    if (cacheLocal && cacheLocal.date && cacheLocal.date.length > 0) {
      console.log(`💾 API-Sports: Date extrase din MongoDB local! (Super rapid, ${cacheLocal.date.length} meciuri, 0 request-uri consumate)`);
      return cacheLocal.date;
    }

    return [];
  } catch (err) {
    console.error("⚠️ Eroare la citirea API-Sports din MongoDB:", err.message);
    return [];
  }
}

module.exports = { fetchDeLaApiFootball, startApiFootballCron};

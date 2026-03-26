const cron = require('node-cron');
const axios = require('axios');
const mongoose = require('mongoose');
const { calculeazaCoteRealeDinamice } = require('../utils/calculator-cote');

const apiFootballService = require('./apiFootball.service');
const theRundownService = require('./theRundownAPI.service');
const { MeciEsports } = require('../models/MeciEsports.model');

async function actualizeazaCLV() {
  try {
    console.log('🔄 [CLV TRACKER] Pornire ciclu de verificare...');

    const Pariu = mongoose.model('Pariu');
    const pariuriActive = await Pariu.find({ status: 'In Asteptare' });

    if (pariuriActive.length === 0) {
      console.log('💤 [CLV] Niciun pariu în așteptare pentru tracking. Sistemul intră în repaus.');
      return;
    }

    // =========================================================
    // 🎯 NIVELUL 1: THE ODDS API (Pinnacle/Marathon)
    // =========================================================
    let meciuriOddsAPI = [];
    try {
      const apiKey = process.env.ODDS_API_KEY;
      if (apiKey) {
        const response = await axios.get(`https://api.the-odds-api.com/v4/sports/upcoming/odds/?apiKey=${apiKey}&regions=eu&markets=h2h`);
        meciuriOddsAPI = response.data;
      }
    } catch (err) {
      console.error('⚠️ [CLV] Eșec conectare The Odds API la acest interval.');
    }

    let clvActualizate = 0;

    for (let pariu of pariuriActive) {
      const [echipaGazda, echipaOaspete] = pariu.meci.split(' vs ');
      let cotaRealaInchidere = null;

      const meciGasitNivel1 = meciuriOddsAPI.find(m =>
        (m.home_team.includes(echipaGazda) || echipaGazda.includes(m.home_team)) &&
        (m.away_team.includes(echipaOaspete) || echipaOaspete.includes(m.away_team))
      );

      if (meciGasitNivel1) {
        const sharpBookie = meciGasitNivel1.bookmakers.find(b =>
          ['pinnacle', 'marathonbet', 'matchbook'].includes(b.key.toLowerCase())
        );

        if (sharpBookie && sharpBookie.markets[0]) {
          const market = sharpBookie.markets[0];
          const coteBrute = market.outcomes.map(o => o.price);
          const coteReale = calculeazaCoteRealeDinamice(coteBrute);

          const outcome = market.outcomes.find(o =>
            pariu.pronostic.toLowerCase().includes(o.name.toLowerCase()) ||
            (pariu.pronostic === 'Egal (X)' && o.name.toLowerCase() === 'draw')
          );

          if (outcome && coteReale) {
            const index = market.outcomes.indexOf(outcome);
            cotaRealaInchidere = coteReale[index];
          }
        }
      }

      // =========================================================
      // 🛡️ NIVELUL 2: FALLBACK (OddsPapi DB / Rundown / API-Sports)
      // =========================================================
      if (!cotaRealaInchidere) {
        const liga = pariu.competitie ? pariu.competitie.toLowerCase() : '';
        try {
          if (liga.includes('cs2') || liga.includes('csgo') || liga.includes('dota') || liga.includes('lol') || liga.includes('esports')) {
            const meciuriEsportsDinDB = await MeciEsports.find({});
            const meciGasitDB = meciuriEsportsDinDB.find(m =>
              (m.home_team.includes(echipaGazda) || echipaGazda.includes(m.home_team)) &&
              (m.away_team.includes(echipaOaspete) || echipaOaspete.includes(m.away_team))
            );

            if (meciGasitDB && meciGasitDB.bookmakers) {
              const pinnacleDB = meciGasitDB.bookmakers.find(b =>
                ['pinnacle', 'pinnacle88', 'ps3838'].includes(b.key.toLowerCase())
              );

              if (pinnacleDB && pinnacleDB.markets) {
                const marketH2H = pinnacleDB.markets.find(m => m.key === 'h2h');
                if (marketH2H && marketH2H.outcomes) {
                  const coteSharp = marketH2H.outcomes.map(o => o.price);
                  const coteReale = calculeazaCoteRealeDinamice(coteSharp);
                  const outcome = marketH2H.outcomes.find(o =>
                    pariu.pronostic.toLowerCase().includes(o.name.toLowerCase()) ||
                    (pariu.pronostic === 'Egal (X)' && o.name.toLowerCase() === 'draw')
                  );
                  if (outcome && coteReale) {
                    cotaRealaInchidere = coteReale[marketH2H.outcomes.indexOf(outcome)];
                  }
                }
              }
            }
          } else if (liga.includes('ncaa') || liga.includes('cfb')) {
            cotaRealaInchidere = await theRundownService.extrageCotaReala(echipaGazda, echipaOaspete);
          } else {
            cotaRealaInchidere = await apiFootballService.extrageCotaReala(echipaGazda, echipaOaspete);
          }
        } catch (fallbackError) {
          console.error(`❌ [CLV Fallback] Eroare pentru ${pariu.meci}`);
        }
      }

      // =========================================================
      // 💾 SALVARE FINALĂ (Succes sau Eroare)
      // =========================================================
      if (cotaRealaInchidere) {
        const clvNou = ((pariu.cota / cotaRealaInchidere) - 1) * 100;
        pariu.clvFinal = parseFloat(clvNou.toFixed(2));
        pariu.mesajCLV = "";
        await pariu.save();
        clvActualizate++;
      } else {
        pariu.mesajCLV = "Nu se poate calcula CLV în acest moment.";
        await pariu.save();
        console.log(`⚠️ [CLV] Lipsă cote pentru: ${pariu.meci}. Eroare înregistrată pe bilet.`);
      }
    }
    console.log(`🏁 [CLV] Ciclu terminat. Actualizate: ${clvActualizate} bilete.`);
  } catch (error) {
    console.error('❌ [CLV] Eroare critică:', error.message);
  }
}

function startCLVCronJob() {
  cron.schedule('*/15 * * * *', actualizeazaCLV);
  console.log('⏰ [CRON] CLV Tracker activat.');
}

module.exports = { startCLVCronJob };

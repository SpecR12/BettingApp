const axios = require('axios');
const cron = require('node-cron');
const Cache = require('../models/Cache.model');
require('dotenv').config();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// ⛏️ MINERUL (Rulează doar în fundal din 2 în 2 ore)
// ==========================================
async function fetchAndSaveRundownApi() {
  try {
    const rundownKey = process.env.THE_RUNDOWN_API_KEY;
    if (!rundownKey) {
      console.log("❌ [CRON] Eroare: THE_RUNDOWN_API_KEY lipsește din fișierul .env");
      return;
    }

    console.log("\n🌍 [CRON] The Rundown API: Căutăm meciuri noi pe serverele lor...");

    const zileDeScanat = [];
    for (let i = 0; i < 3; i++) {
      const data = new Date();
      data.setDate(data.getDate() + i);
      zileDeScanat.push(data.toISOString().split('T')[0]);
    }

    const sporturiRundown = [
      { id: 2, nume: 'NFL' },
      { id: 3, nume: 'MLB' },
      { id: 4, nume: 'NBA' },
      { id: 5, nume: 'NCAA' },
      { id: 6, nume: 'NHL' }
    ];

    let toateEvenimentele = [];

    // Facem request-urile la API
    for (const dataString of zileDeScanat) {
      for (const sport of sporturiRundown) {
        try {
          await sleep(2000);
          const response = await axios.get(`https://therundown.io/api/v2/sports/${sport.id}/events/${dataString}`, {
            params: { key: rundownKey, include: 'all_periods' }
          });

          const evenimenteZi = response.data.events ? response.data.events : response.data;
          if (Array.isArray(evenimenteZi)) toateEvenimentele.push(...evenimenteZi);
        } catch (err) {
          console.error(`❌ [CRON] [Rundown API] Eroare la ${sport.nume} pt data ${dataString}:`, err.response ? err.response.data : err.message);
        }
      }
    }

    // Salvăm datele
    if (toateEvenimentele.length > 0) {
      await Cache.findOneAndUpdate(
        { numeApi: 'RundownAPI_Extins' },
        { ultimulUpdate: Date.now(), date: toateEvenimentele },
        { upsert: true, returnDocument: 'after' }
      );
      console.log(`✅ [CRON] The Rundown a adus și salvat în MongoDB ${toateEvenimentele.length} evenimente proaspete!`);
    } else {
      console.log("⚠️ [CRON] The Rundown a returnat 0 evenimente totale. API-ul a răspuns, dar nu sunt meciuri de interes.");
    }

  } catch (error) {
    console.error("❌ [CRON] Eroare Critică The Rundown:", error.message);
  }
}

// ==========================================
// ⏰ PROGRAMATORUL (Declanșatorul)
// ==========================================
function startRundownApiCron() {
  cron.schedule('0 */2 * * *', fetchAndSaveRundownApi);
  console.log('⏰ [CRON] Pipeline-ul The Rundown API a fost programat (din 2 în 2 ore).');
}

// ==========================================
// 📖 CITITORUL (Acesta este apelat de Controller la click!)
// ==========================================
async function fetchRundownEvents() {
  try {
    const cacheLocal = await Cache.findOne({ numeApi: 'RundownAPI_Extins' });

    if (cacheLocal && cacheLocal.date && cacheLocal.date.length > 0) {
      console.log(`💾 The Rundown API: Date extrase din MongoDB local! (Super rapid, ${cacheLocal.date.length} meciuri, 0 request-uri consumate)`);
      return cacheLocal.date;
    }

    return [];
  } catch (err) {
    console.error("⚠️ Eroare la citirea The Rundown din MongoDB:", err.message);
    return [];
  }
}

module.exports = { fetchRundownEvents, startRundownApiCron };

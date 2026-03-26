const axios = require('axios');
const Cache = require('../models/Cache.model');

let logoCacheMemorie = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchTeamLogo = async (teamName) => {
  const cleanName = teamName.replace(/( FC| City| United| Rovers| Wanderers)/gi, '').trim();

  if (logoCacheMemorie === null) {
    try {
      const dbCache = await Cache.findOne({ numeApi: 'Logos' });
      logoCacheMemorie = dbCache && dbCache.date ? dbCache.date : {};
    } catch (err) {
      console.error("⚠️ Eroare citire logouri din DB:", err.message);
      logoCacheMemorie = {};
    }
  }

  if (logoCacheMemorie[cleanName] !== undefined) {
    return logoCacheMemorie[cleanName];
  }

  try {
    await sleep(300);

    const response = await axios.get(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(cleanName)}`);

    let logoUrl = null;
    if (response.data && response.data.teams && response.data.teams.length > 0) {
      logoUrl = response.data.teams[0].strBadge;
    }

    logoCacheMemorie[cleanName] = logoUrl;

    Cache.findOneAndUpdate(
      { numeApi: 'Logos' },
      { ultimulUpdate: Date.now(), date: logoCacheMemorie },
      { upsert: true }
    ).catch(err => console.error("⚠️ Eroare la salvarea logoului nou în DB:", err.message));

    return logoUrl;

  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log(`⚠️ Pauză TheSportsDB (Rate Limit) pentru: ${cleanName}`);
    } else {
      console.error(`❌ Eroare TheSportsDB pentru ${cleanName}:`, error.message);
    }
    return null;
  }
};

module.exports = { fetchTeamLogo };

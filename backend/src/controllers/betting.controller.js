const { fetchDeLaOddsApi } = require('../services/oddsApi.service');
const { fetchTeamLogo } = require('../services/theSportsDB.service');
const { fetchRundownEvents } = require('../services/theRundownAPI.service');
const { fetchDeLaApiFootball } = require('../services/apiFootball.service');
const { fetchDeLaOddsPapi } = require('../services/oddspapi.service');
const { calculeazaCoteRealeDinamice, calculeazaValueSiKelly } = require('../utils/calculator-cote');
const { analizeazaPariuCuAI } = require('../services/ai.service');
const Pariu = require('../models/Pariu.model');

const aiCache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000;

const americanToDecimal = (american) => {
  if (!american) return 1.0;
  if (american > 0) return (american / 100) + 1;
  return (100 / Math.abs(american)) + 1;
};

const rundownBookies = {
  3: { key: 'pinnacle', title: 'Pinnacle' },
  8: { key: 'williamhill', title: 'William Hill' },
  11: { key: 'bovada', title: 'Bovada' },
  43: { key: 'betfair_ex_eu', title: 'Betfair' }
};

const getValueBets = async (req, res) => {
  try {
    console.log("\n=========================================");
    console.log(`🔄 START SCANARE pt User ID: ${req.user.id}`);
    console.log("=========================================");

    const rezultateApi = await Promise.allSettled([
      fetchDeLaOddsApi(),
      fetchRundownEvents(),
      fetchDeLaApiFootball(),
      fetchDeLaOddsPapi()
    ]);

    const meciuriOddsApi = rezultateApi[0].status === 'fulfilled' ? rezultateApi[0].value : [];
    const rundownToate = rezultateApi[1].status === 'fulfilled' ? rezultateApi[1].value : [];
    const meciuriApiSports = rezultateApi[2].status === 'fulfilled' ? rezultateApi[2].value : [];
    const meciuriOddsPapi = rezultateApi[3].status === 'fulfilled' ? rezultateApi[3].value : [];

    console.log(`📡 [FETCH] The Odds API a adus: ${meciuriOddsApi?.length || 0} meciuri brute`);
    console.log(`📡 [FETCH] API-Sports a adus: ${meciuriApiSports?.length || 0} meciuri brute`);
    console.log(`📡 [FETCH] The Rundown a adus: ${rundownToate?.length || 0} meciuri brute`);
    console.log(`📡 [FETCH] OddsPapi (eSports) a adus: ${meciuriOddsPapi?.length || 0} meciuri brute`);

    const safeOddsApi = (meciuriOddsApi || []).map(m => ({ ...m, source: 'odds-api' }));

    const meciuriApiSportsAdaptate = (meciuriApiSports || [])
      .map(meci => {
        if (!meci || !meci.bookmakers || !Array.isArray(meci.bookmakers)) return null;
        meci.bookmakers.forEach(bm => {
          if (bm.markets && bm.markets[0] && !bm.markets[0].key) bm.markets[0].key = 'h2h';
        });
        meci.commence_time = meci.commence_time || meci.fixture?.date || meci.date;
        if (!meci.commence_time) return null;

        meci.source = 'api-sports';
        return meci;
      }).filter(Boolean);

    const safeRundown = (rundownToate || []).map(event => {
      if (!event || !event.teams || !event.lines) return null;

      const gazda = event.teams.find(t => t.is_home)?.name || 'Echipa Gazdă';
      const oaspete = event.teams.find(t => t.is_away)?.name || 'Echipa Oaspete';
      const bookmakersAdaptati = [];

      Object.keys(event.lines).forEach(bookieId => {
        const bookieInfo = rundownBookies[bookieId];
        if (!bookieInfo) return;

        const line = event.lines[bookieId];
        const h2hMarket = { key: 'h2h', outcomes: [] };

        if (line.moneyline) {
          h2hMarket.outcomes.push({ name: gazda, price: americanToDecimal(line.moneyline.moneyline_home) });
          h2hMarket.outcomes.push({ name: oaspete, price: americanToDecimal(line.moneyline.moneyline_away) });
        }

        if (h2hMarket.outcomes.length > 0) {
          bookmakersAdaptati.push({
            key: bookieInfo.key,
            title: bookieInfo.title,
            markets: [h2hMarket]
          });
        }
      });

      return {
        id: event.event_id || Math.random().toString(36).substring(7),
        sport_key: 'rundown_sport',
        sport_title: 'Sporturi US (Rundown)',
        commence_time: event.event_date,
        home_team: gazda,
        away_team: oaspete,
        bookmakers: bookmakersAdaptati,
        source: 'the-rundown'
      };
    }).filter(meci => meci !== null && meci.bookmakers.length > 0);

    const meciuriOddsPapiAdaptate = (meciuriOddsPapi || []).map(meci => {
      const data = meci.toObject ? meci.toObject() : meci;

      if (data.bookmakers && Array.isArray(data.bookmakers)) {
        data.bookmakers = data.bookmakers.map(bm => ({
          key: bm.name ? bm.name.toLowerCase().replace(/\s/g, '') : (bm.key || 'necunoscut'),
          title: bm.name || bm.title,
          markets: (bm.markets || []).map(mk => ({
            key: (mk.id === 1 || mk.key === 'Match Winner') ? 'h2h' : (mk.key || 'h2h'),
            outcomes: (mk.outcomes || mk.choices || []).map(o => ({
              name: o.name || o.title || 'Selecție',
              price: o.price || o.odds
            }))
          }))
        }));
      }

      return { ...data, source: 'oddspapi-db' };
    });

    const meciuriBrute = [
      ...safeOddsApi,
      ...meciuriApiSportsAdaptate,
      ...safeRundown,
      ...meciuriOddsPapiAdaptate
    ];

    console.log(`📊 TOTAL MECIURI BĂGATE ÎN CALCULATORUL MATEMATIC: ${meciuriBrute.length}`);

    const oportunitatiMap = new Map();
    const sureBetsMap = new Map();

    const caseEtalon = ['pinnacle', 'marathonbet', 'matchbook'];
    const caseSoft = [
      'sport888', 'betfair_ex_eu', 'onexbet', 'williamhill',
      'unibet', 'unibet_eu', 'unibet_uk', 'unibet_fr', 'unibet_it', 'unibet_nl', 'unibet_se',
      'betano', 'betano_ro', 'betano_eu', 'superbet', 'superbet_ro',
      'bet365', 'betway', 'ggbet', 'bovada', 'draftkings', 'fanduel'
    ];

    if (meciuriBrute && meciuriBrute.length > 0) {
      meciuriBrute.forEach(meci => {
        if (!meci || !meci.commence_time || !meci.bookmakers || meci.bookmakers.length < 2) return;

        const oraStartMeci = new Date(meci.commence_time);
        const oraCurenta = new Date();
        if (oraStartMeci <= oraCurenta) return;

        const orePanaLaStart = (oraStartMeci - oraCurenta) / (1000 * 60 * 60);
        if (orePanaLaStart > 72) return;

        const marketH2H = 'h2h';
        let celeMaiBuneCote = {};

        meci.bookmakers.forEach(bm => {
          if (!caseSoft.includes(bm.key.toLowerCase())) return;

          const market = bm.markets?.find(m => m.key === marketH2H);
          if (market && market.outcomes) {
            market.outcomes.forEach(outcome => {
              const numePronostic = outcome.name.toLowerCase() === 'draw' || outcome.name.toLowerCase() === 'tie' ? 'X' : outcome.name;

              if (!celeMaiBuneCote[numePronostic] || outcome.price > celeMaiBuneCote[numePronostic].price) {
                celeMaiBuneCote[numePronostic] = {
                  price: outcome.price,
                  agentie: bm.title,
                  numeOriginal: outcome.name
                };
              }
            });
          }
        });

        const pronosticuriDisponibile = Object.keys(celeMaiBuneCote);
        if (pronosticuriDisponibile.length === 2 || pronosticuriDisponibile.length === 3) {
          let marjaTotala = 0;
          pronosticuriDisponibile.forEach(p => {
            marjaTotala += (1 / celeMaiBuneCote[p].price);
          });
          if (marjaTotala < 1.0) {
            const profitGarantat = ((1 / marjaTotala) - 1) * 100;
            if (profitGarantat > 0.5 && profitGarantat < 20) {
              const uniqueId = `${meci.home_team}_${meci.away_team}_surebet`.replace(/\s+/g, '');
              sureBetsMap.set(uniqueId, {
                id: uniqueId,
                meci: `${meci.home_team} vs ${meci.away_team}`,
                liga: meci.sport_title,
                profitGarantat: parseFloat(profitGarantat.toFixed(2)),
                detaliiPariuri: pronosticuriDisponibile.map(p => ({
                  pronostic: p === 'X' ? 'Egal' : `Victorie ${p}`,
                  cota: celeMaiBuneCote[p].price,
                  agentie: celeMaiBuneCote[p].agentie
                }))
              });
            }
          }
        }

        let casaReferinta = meci.bookmakers.find(b => caseEtalon.includes(b.key.toLowerCase()));
        if (!casaReferinta) casaReferinta = meci.bookmakers[0];

        let agentieLocala = meci.bookmakers.find(b => caseSoft.includes(b.key.toLowerCase()));
        if (!agentieLocala || agentieLocala.key === casaReferinta.key) agentieLocala = meci.bookmakers[1];

        if (!casaReferinta || !agentieLocala) return;

        const pieteDeScanat = ['h2h', 'totals', 'spreads'];

        pieteDeScanat.forEach(marketKey => {
          const refMarket = casaReferinta.markets?.find(m => m.key === marketKey);
          const localMarket = agentieLocala.markets?.find(m => m.key === marketKey);

          if (!refMarket || !localMarket || !refMarket.outcomes || !localMarket.outcomes) return;
          if (refMarket.outcomes.length !== localMarket.outcomes.length) return;

          const refPrices = refMarket.outcomes.map(o => o.price);
          const coteRealeCurate = calculeazaCoteRealeDinamice(refPrices);

          refMarket.outcomes.forEach((refOutcome, index) => {
            const localOutcome = localMarket.outcomes.find(lo =>
              lo.name === refOutcome.name &&
              (marketKey === 'h2h' || lo.point === refOutcome.point)
            );

            if (!localOutcome) return;

            const cotaRealaMatematica = coteRealeCurate ? coteRealeCurate[index] : null;
            if (!cotaRealaMatematica) return;

            const rezultatMatematic = calculeazaValueSiKelly(cotaRealaMatematica, localOutcome.price);

            if (rezultatMatematic && rezultatMatematic.evProcent > 0 && rezultatMatematic.evProcent < 50) {

              let pronosticFrumos = refOutcome.name;
              if (marketKey === 'h2h') {
                const numeNormalizat = refOutcome.name.toLowerCase();
                if (numeNormalizat === 'draw' || numeNormalizat === 'x' || numeNormalizat === 'tie') {
                  pronosticFrumos = 'Egal (X)';
                } else {
                  pronosticFrumos = `Victorie ${refOutcome.name}`;
                }
              } else if (marketKey === 'totals') {
                const directie = refOutcome.name === 'Over' ? 'Peste' : 'Sub';
                pronosticFrumos = `${directie} ${refOutcome.point} Goluri/Puncte`;
              } else if (marketKey === 'spreads') {
                pronosticFrumos = `Handicap ${refOutcome.name} (${refOutcome.point > 0 ? '+' : ''}${refOutcome.point})`;
              }

              const uniqueMatchId = meci.id ? `${meci.source}_${meci.id}` : `${meci.home_team}_${meci.away_team}`.replace(/\s+/g, '');

              if (!oportunitatiMap.has(uniqueMatchId)) {
                let categoriaFinala = meci.sport_group || (meci?.sport_key ? meci.sport_key.split('_')[0] : 'Sport');
                oportunitatiMap.set(uniqueMatchId, {
                  id: uniqueMatchId,
                  categorie: categoriaFinala,
                  liga: meci.sport_title || "Competiție",
                  meci: `${meci.home_team} vs ${meci.away_team}`,
                  orePanaLaStart: parseFloat(orePanaLaStart.toFixed(1)),
                  echipaGazda: meci.home_team,
                  echipaOaspete: meci.away_team,
                  toatePariurile: []
                });
              }

              oportunitatiMap.get(uniqueMatchId).toatePariurile.push({
                pronostic: pronosticFrumos,
                agentie: agentieLocala.title,
                cotaPinnacleOriginala: refOutcome.price,
                cotaRealaCurata: rezultatMatematic.cotaReala,
                cotaGasita: rezultatMatematic.cotaGasita,
                avantajEV: rezultatMatematic.evProcent,
                kellyRecomandat: rezultatMatematic.mizaRecomandataProcent
              });
            }
          });
        });
      });
    }

    const oportunitatiFinale = [];
    oportunitatiMap.forEach(meci => {
      meci.toatePariurile.sort((a, b) => b.avantajEV - a.avantajEV);
      const pariuPrincipal = meci.toatePariurile[0];
      const pariuriAlternative = meci.toatePariurile.slice(1);

      oportunitatiFinale.push({
        ...meci,
        ...pariuPrincipal,
        altePariuri: pariuriAlternative
      });
    });

    oportunitatiFinale.sort((a, b) => b.avantajEV - a.avantajEV);

    const oportunitatiCuLogouri = await Promise.all(oportunitatiFinale.map(async (meci) => {
      const numeEchipe = meci.meci.split(' vs ');
      const echipaGazda = numeEchipe[0];
      const echipaOaspete = numeEchipe[1] || 'Oaspeți';

      const logoGazda = await fetchTeamLogo(echipaGazda);
      const logoOaspete = await fetchTeamLogo(echipaOaspete);
      const defaultLogo = 'https://cdn-icons-png.flaticon.com/512/53/53283.png';

      return {
        ...meci,
        echipaGazda: echipaGazda,
        echipaOaspete: echipaOaspete,
        logoGazda: logoGazda || defaultLogo,
        logoOaspete: logoOaspete || defaultLogo
      };
    }));

    console.log(`🤖 Trecem ${oportunitatiCuLogouri.length} Value Bets prin filtrul AI...`);

    const meciuriCuAnalizaAI = await Promise.all(oportunitatiCuLogouri.map(async (meci) => {
      let analiza;
      const cacheKey = `${meci.id}_${meci.pronostic}`;

      if (aiCache.has(cacheKey)) {
        const cacheEntry = aiCache.get(cacheKey);
        if (Date.now() - cacheEntry.timestamp < CACHE_TTL) {
          analiza = cacheEntry.data;
        } else {
          aiCache.delete(cacheKey);
        }
      }

      if (!analiza) {
        let istoricBazaDeDate = [];
        try {
          istoricBazaDeDate = await Pariu.find({
            user: req.user.id,
            $or: [
              { meci: { $regex: meci.echipaGazda, $options: 'i' } },
              { meci: { $regex: meci.echipaOaspete, $options: 'i' } }
            ],
            status: { $in: ['Castigat', 'Pierdut'] }
          }).sort({ dataMeci: -1 }).limit(5);
        } catch (dbErr) {
          console.error('❌ Eroare la citirea istoricului:', dbErr.message);
        }

        analiza = await analizeazaPariuCuAI(meci, istoricBazaDeDate);
        if (analiza) aiCache.set(cacheKey, { data: analiza, timestamp: Date.now() });
      }

      return {
        ...meci,
        ai_decizie: analiza ? analiza.decizie : "N/A",
        ai_scor: analiza ? analiza.scor_incredere : 0,
        ai_motiv: analiza ? analiza.motiv : "Analiza AI nu este disponibilă.",
        ai_alternativa: analiza ? analiza.alternativa : "Niciuna",
        ai_pariu_riscant: analiza ? analiza.pariu_riscant : ""
      };
    }));

    res.json({
      status: 'success',
      timp_generare: new Date().toISOString(),
      total_oportunitati: meciuriCuAnalizaAI.length,
      data: meciuriCuAnalizaAI,
      sure_bets: Array.from(sureBetsMap.values()).sort((a, b) => b.profitGarantat - a.profitGarantat)
    });
  } catch (error) {
    console.error("❌ Eroare Critică în Controller:", error);
    res.status(500).json({ status: 'error', message: 'Eroare la procesarea cotelor.' });
  }
};

module.exports = { getValueBets };

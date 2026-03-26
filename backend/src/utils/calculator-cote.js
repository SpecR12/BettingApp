/**
 * Elimină marja casei de pariuri folosind metoda Power (proporțională cu probabilitatea).
 * @param {number[]} coteArray - Un array de cote (ex: [2.10, 3.40, 3.60])
 * @returns {number[]|null} - Returnează cotele reale sau null dacă datele sunt corupte
 */
function calculeazaCoteRealeDinamice(coteArray) {
  if (!coteArray || coteArray.length < 2) return null;
  if (coteArray.some(c => c <= 1.01)) return null;

  const probImplicite = coteArray.map(c => 1 / c);
  const sumaProb = probImplicite.reduce((a, b) => a + b, 0);

  if (sumaProb <= 1) return coteArray;

  let low = 1.0;
  let high = 5.0;
  let k = 1.0;

  for (let i = 0; i < 50; i++) {
    k = (low + high) / 2;
    let sumaTest = probImplicite.reduce((suma, p) => suma + Math.pow(p, k), 0);

    if (sumaTest > 1) {
      low = k;
    } else {
      high = k;
    }
  }

  const probReale = probImplicite.map(p => Math.pow(p, k));
  return probReale.map(prob => parseFloat((1 / prob).toFixed(3)));
}

/**
 * Calculează Avantajul (EV) și recomandă miza folosind Criteriul Kelly.
 * @param {number} cotaReala - Cota 100% corectă (fără marjă)
 * @param {number} cotaLocal - Cota găsită la agenția de cartier/soft
 * @param {Object} setari - Ajustări fine pentru siguranță
 */
function calculeazaValueSiKelly(cotaReala, cotaLocal, setari = {}) {
  const pragMinimEV = setari.pragMinimEV || 0.00;
  const comisionExchange = setari.comisionExchange || 0.00;

  if (!cotaReala || !cotaLocal || cotaLocal <= 1.01) return null;
  const cotaNeta = cotaLocal - ((cotaLocal - 1) * comisionExchange);
  const edge = (cotaNeta / cotaReala) - 1;

  if (edge < pragMinimEV) return null;

  const probabilitateReala = 1 / cotaReala;
  const fullKelly = ((probabilitateReala * cotaNeta) - 1) / (cotaNeta - 1);

  if (fullKelly <= 0) return null;

  return {
    cotaReala: cotaReala,
    cotaGasita: parseFloat(cotaNeta.toFixed(2)),
    evProcent: parseFloat((edge * 100).toFixed(2)),
    mizaRecomandataProcent: parseFloat((fullKelly * 100).toFixed(2))
  };
}

module.exports = {
  calculeazaCoteRealeDinamice,
  calculeazaValueSiKelly
};

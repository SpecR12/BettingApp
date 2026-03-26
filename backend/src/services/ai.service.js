const axios = require('axios');

async function analizeazaPariuCuAI(meci, istoricEchipe = []) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.log('⚠️ Cheia DeepSeek lipsește din .env!');
      return null;
    }

    let textMemorie = "";
    if (istoricEchipe && istoricEchipe.length > 0) {
      textMemorie = `\n\n[MEMORIE STRICTĂ - ISTORICUL TĂU DE PREDICȚII]
În trecut, ai mai analizat aceste echipe. Iată ce ai recomandat tu și ce s-a întâmplat de fapt pe teren (date extrase din Portofoliu):
`;
      istoricEchipe.forEach(pariu => {
        const decizieTrecuta = pariu.ai_decizie || "Nespecificat";
        textMemorie += `- Meci: ${pariu.meci} | Pariu: ${pariu.pronostic} | Ce ai recomandat tu: ${decizieTrecuta} | Rezultat final: ${pariu.status.toUpperCase()}.\n`;
      });

      textMemorie += `
Reguli de învățare din greșeli:
- Dacă tu ai recomandat "EVITĂ" dar biletul a ieșit "CASTIGAT", înseamnă că analizezi prea defensiv. Fii mai curajos la Value Bets!
- Dacă tu ai recomandat "PARIAZĂ" dar biletul a ieșit "PIERDUT", înseamnă că ai ratat o capcană a cotelor. Analizează mai atent acum!
- Dacă pariul a fost "ANULAT", nu te penaliza, dar ține cont de context.
Ajustează-ți decizia actuală și, dacă este cazul, menționează scurt în "motiv" că te-ai corectat pe baza acestui istoric!`;
    }

    const promptSistem = `Ești un analist sportiv profesionist și expert în pariuri PRE-MECI.
Rolul tău este să evaluezi un pariu matematic (Value Bet) prin filtrul realității fotbalistice.

REGULI STRICTE PENTRU TINE:
1. NU ai acces la internet live.
2. NU inventa statistici exacte recente pe care nu le poți verifica.
3. Bazează-ți argumentele pe forța generală a echipelor, stilul de joc istoric și statutul de gazdă/oaspete.
4. Fii precaut la pariul principal, dar creativ la pariul riscant!${textMemorie}

Trebuie să răspunzi STRICT în format JSON, cu această structură:
{
  "decizie": "PARIAZĂ" sau "EVITĂ",
  "scor_incredere": număr de la 1 la 10,
  "motiv": "Explică decizia pe baza forței celor două echipe, fără să inventezi numere exacte.",
  "alternativa": "Dacă decizia e EVITĂ, oferă o alternativă sigură PRE-MECI (ex: Șansă Dublă, Handicap Asiatic). Dacă decizia e PARIAZĂ, scrie 'Niciuna'.",
  "pariu_riscant": "Categoria 'Nu riști, nu câștigi'. Fă o predicție curajoasă bazată pe stilul de joc al echipelor (ex: 'Peste 10.5 cornere pentru că ambele joacă pe flancuri', 'X pauză / 1 final', 'Echipa X marchează prima', sau 'Cartonaș roșu în meci'). Fii curajos!"
}`;

    const promptUser = `
Meci: ${meci.echipaGazda} vs ${meci.echipaOaspete}
Liga: ${meci.liga}
Pronostic Recomandat: ${meci.pronostic}
Cotă Găsită: ${meci.cotaGasita}
Avantaj Matematic (EV): +${meci.avantajEV}%

Te rog analizează acest pariu. Merită jucat în realitate sau este o capcană a cotelor?`;

    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: promptSistem },
        { role: "user", content: promptUser }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3 // Ușor mărit de la 0.2 ca să fie puțin mai creativ la secțiunea riscantă
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });

    const continutAI = response.data.choices[0].message.content;
    return JSON.parse(continutAI);

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error(`⏳ Timeout! DeepSeek a durat prea mult pentru ${meci.echipaGazda}.`);
    } else {
      console.error(`❌ Eroare AI pentru meciul ${meci.echipaGazda}:`, error.response?.data || error.message);
    }
    return null;
  }
}

module.exports = { analizeazaPariuCuAI };

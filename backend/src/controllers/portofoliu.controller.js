const Pariu = require('../models/Pariu.model');

const adaugaPariu = async (req, res) => {
  try {
    const datePariu = req.body;

    const pariuNou = new Pariu({
      meci: datePariu.meci,
      competitie: datePariu.competitie || datePariu.liga,
      pronostic: datePariu.pronostic,
      cota: datePariu.cota || datePariu.cotaGasita,
      agentie: datePariu.agentie,
      mizaRecomandata: datePariu.mizaRecomandata,
      avantajEV: datePariu.avantajEV,
      ai_decizie: datePariu.ai_decizie || 'Nespecificat',
      ai_motiv: datePariu.ai_motiv || '',
      dataMeci: datePariu.dataMeci || null,
      user: req.user.id
    });

    const pariuSalvat = await pariuNou.save();

    console.log(`💾 Portofoliu: S-a salvat pariul pe ${pariuNou.meci} (${pariuNou.pronostic}) | User ID: ${req.user.id}`);
    res.status(201).json({ status: 'success', message: 'Pariu salvat cu succes!', data: pariuSalvat });

  } catch (error) {
    console.error("❌ Eroare la salvarea pariului:", error.message);
    res.status(500).json({ status: 'error', message: 'Eroare la salvarea in baza de date.' });
  }
};

const getPariuri = async (req, res) => {
  try {
    const pariuri = await Pariu.find({ user: req.user.id }).sort({ dataSalvare: -1 });

    res.status(200).json({ status: 'success', data: pariuri });
  } catch (error) {
    console.error("❌ Eroare la extragerea portofoliului:", error.message);
    res.status(500).json({ status: 'error', message: 'Eroare la citirea bazei de date.' });
  }
};

const updateStatusPariu = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const pariuActualizat = await Pariu.findOneAndUpdate(
      { _id: id, user: req.user.id },
      { status: status },
      { returnDocument: 'after' }
    );

    if (!pariuActualizat) {
      return res.status(404).json({ status: 'error', message: 'Pariul nu a fost găsit sau accesul este interzis.' });
    }

    console.log(`🔄 Status actualizat: Pariul pe ${pariuActualizat.meci} este acum ${status}!`);
    res.status(200).json({ status: 'success', data: pariuActualizat });

  } catch (error) {
    console.error("❌ Eroare la actualizarea statusului:", error.message);
    res.status(500).json({ status: 'error', message: 'Eroare la actualizarea in baza de date.' });
  }
};

module.exports = { adaugaPariu, getPariuri, updateStatusPariu };

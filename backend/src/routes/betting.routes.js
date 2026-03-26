const express = require('express');
const router = express.Router();
const { getValueBets } = require('../controllers/betting.controller');
const { adaugaPariu, getPariuri, updateStatusPariu } = require('../controllers/portofoliu.controller');
const { verificaToken } = require('../middleware/auth.middleware');

const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 30 });

const cacheMiddleware = (req, res, next) => {
  const key = req.originalUrl;
  const cachedData = cache.get(key);
  if (cachedData) {
    console.log(`⚡ Date servite instant din RAM (Cache) pentru ${key}`);
    return res.json(cachedData);
  } else {
    console.log(`🐌 Date cerute din MongoDB/API pentru ${key}`);
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      cache.set(key, body);
      originalJson(body);
    };
    next();
  }
};
router.get('/value-bets', verificaToken, cacheMiddleware, getValueBets);

router.post('/save-bet', verificaToken, adaugaPariu);
router.get('/pariuri', verificaToken, getPariuri);
router.patch('/pariuri/:id/status', verificaToken, updateStatusPariu);

module.exports = router;

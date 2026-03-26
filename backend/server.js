require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const compression = require('compression');

const { startCLVCronJob } = require('./src/services/clv.service');
const { startOddsPapiWeekendCron } = require('./src/services/oddspapi.service');
const { startOddsApiCron } = require('./src/services/oddsApi.service');
const { startRundownApiCron } = require('./src/services/theRundownAPI.service');
const { startApiFootballCron } = require('./src/services/apiFootball.service');
const { register, login, resetPassword } = require('./src/controllers/auth.controller');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(compression());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectat cu succes!'))
  .catch(err => console.error('❌ Eroare conectare MongoDB:', err));

startCLVCronJob();
startOddsPapiWeekendCron();
startOddsApiCron();
startRundownApiCron();
startApiFootballCron();

app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/api/auth/reset-password', resetPassword);
app.get('/api/status', (req, res) => res.json({ message: "Server Online" }));

const bettingRoutes = require('./src/routes/betting.routes.js');
app.use('/api', bettingRoutes);

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Serverul rulează pe portul ${port}`);
});

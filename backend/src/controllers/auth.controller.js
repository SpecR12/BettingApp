const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models/Auth.model');
const Pariu = require('../models/Pariu.model');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_betting_key_123';
const MASTER_INVITE_CODE = process.env.INVITE_CODE || 'VIP-RADAR-2026';

const register = async (req, res) => {
  try {
    const { email, parola, codInvitatie } = req.body;

    if (codInvitatie !== MASTER_INVITE_CODE) {
      return res.status(400).json({ message: 'Cod de invitație incorect sau expirat!' });
    }

    const userExistent = await User.findOne({ email });
    if (userExistent) {
      return res.status(400).json({ message: 'Email-ul este deja înregistrat.' });
    }

    const salt = await bcrypt.genSalt(10);
    const parolaCriptata = await bcrypt.hash(parola, salt);

    const newUser = new User({ email, parola: parolaCriptata });
    await newUser.save();

    res.status(201).json({ message: 'Cont creat cu succes!' });
  } catch (error) {
    res.status(500).json({ message: 'Eroare la înregistrare', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, parola } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Email sau parolă incorectă.' });

    const parolaValida = await bcrypt.compare(parola, user.parola);
    if (!parolaValida) return res.status(400).json({ message: 'Email sau parolă incorectă.' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    res.json({ message: 'Login reusit', token });
  } catch (error) {
    res.status(500).json({ message: 'Eroare la logare', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, parola, codInvitatie } = req.body;

    if (codInvitatie !== MASTER_INVITE_CODE) {
      return res.status(400).json({ message: 'Cod de securitate incorect!' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Nu există niciun cont cu acest email.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.parola = await bcrypt.hash(parola, salt);
    await user.save();

    res.json({ message: 'Parola a fost schimbată cu succes!' });
  } catch (error) {
    res.status(500).json({ message: 'Eroare la resetarea parolei.', error: error.message });
  }
};

module.exports = { register, login, resetPassword };

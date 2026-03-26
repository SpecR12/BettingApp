const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const verificaToken = (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ message: 'Acces interzis. Lipsesc credențialele.' });
  }

  try {
    const tokenCurat = token.split(' ')[1];
    req.user = jwt.verify(tokenCurat, JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token invalid sau expirat.' });
  }
};

module.exports = { verificaToken };

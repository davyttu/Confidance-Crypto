// middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

/**
 * Middleware pour vérifier le JWT
 * Ajoute req.user si le token est valide
 */
const authenticateToken = (req, res, next) => {
  // Récupérer le token depuis le cookie ou l'en-tête Authorization
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, email, accountType }
    next();
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return res.status(403).json({ error: 'Token invalide' });
  }
};

/**
 * Middleware optionnel - ne bloque pas si pas de token
 * Ajoute req.user si token valide, sinon continue
 */
const optionalAuth = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // Token invalide mais on continue quand même
      console.log('Optional auth: invalid token');
    }
  }

  next();
};

/**
 * Génère un JWT
 */
const generateToken = (userId, email, accountType) => {
  return jwt.sign(
    { 
      userId, 
      email, 
      accountType 
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Token valide 7 jours
  );
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  JWT_SECRET
};
// middleware/auth.js
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers'); // 🆕 AJOUTÉ pour vérification signature

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

/**
 * Middleware pour vérifier le JWT
 * Ajoute req.user si le token est valide
 */
const authenticateToken = (req, res, next) => {
  // Récupérer le token depuis le cookie ou l'en-tête Authorization
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    console.log('auth: no token received (Authorization header or cookie)');
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

// ============================================================
// 🆕 AUTHENTIFICATION PAR SIGNATURE WALLET (pour Liquidité)
// ============================================================

/**
 * Middleware pour vérifier la signature wallet
 * Utilisé pour les endpoints de liquidité qui nécessitent une preuve de propriété du wallet
 * 
 * Headers requis:
 * - address: Adresse du wallet (0x...)
 * - signature: Signature du message
 * - message: Message signé (format: "timestamp:nonce")
 * 
 * Ajoute req.user.address si la signature est valide
 */
const authenticateWallet = async (req, res, next) => {
  try {
    // Récupérer les données depuis les headers
    const address = req.headers.address || req.body.address;
    const signature = req.headers.signature || req.body.signature;
    const message = req.headers.message || req.body.message;

    if (!address || !signature || !message) {
      return res.status(401).json({ 
        error: 'Authentification wallet requise',
        required: ['address', 'signature', 'message']
      });
    }

    // Vérifier le format de l'adresse
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Adresse wallet invalide' });
    }

    // Vérifier le timestamp (max 5 minutes)
    const timestamp = parseInt(message.split(':')[0]);
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    if (now - timestamp > maxAge) {
      return res.status(401).json({ error: 'Signature expirée (max 5 minutes)' });
    }

    // Vérifier la signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({ error: 'Signature invalide' });
    }

    // Ajouter l'adresse vérifiée à req.user
    req.user = {
      ...(req.user || {}),
      address: address.toLowerCase()
    };

    next();
  } catch (error) {
    console.error('❌ Wallet authentication failed:', error.message);
    return res.status(403).json({ error: 'Erreur vérification signature' });
  }
};

/**
 * 🆕 Middleware hybride : JWT OU Signature Wallet
 * Accepte soit un JWT valide, soit une signature wallet valide
 * Utilisé pour les endpoints qui peuvent être accessibles par les deux méthodes
 */
const authenticateHybrid = async (req, res, next) => {
  // Essayer d'abord l'authentification JWT
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      // JWT invalide, essayer la signature wallet
      console.log('JWT invalid, trying wallet signature...');
    }
  }

  // Si pas de JWT ou JWT invalide, essayer la signature wallet
  const address = req.headers.address || req.body.address;
  const signature = req.headers.signature || req.body.signature;
  const message = req.headers.message || req.body.message;

  if (address && signature && message) {
    return authenticateWallet(req, res, next);
  }

  // Aucune authentification valide
  return res.status(401).json({ 
    error: 'Authentification requise',
    methods: ['JWT token', 'Wallet signature']
  });
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  authenticateWallet,      // 🆕 AJOUTÉ
  authenticateHybrid,      // 🆕 AJOUTÉ
  JWT_SECRET
};
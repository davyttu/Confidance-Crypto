// routes/liquidity.js
const express = require('express');
const router = express.Router();
const liquidityController = require('../controllers/liquidityController');
const { authenticateWallet } = require('../middleware/auth');

/**
 * GET /api/liquidity/position/:address
 * Récupère la position active d'un utilisateur
 */
router.get('/position/:address', liquidityController.getPosition);

/**
 * POST /api/liquidity/create
 * Crée une nouvelle position de liquidité
 * Body: {
 *   ethAmount: string,
 *   token: 'USDC' | 'USDT',
 *   ltvPercentage: number
 * }
 */
router.post('/create', authenticateWallet, liquidityController.createPosition);

/**
 * POST /api/liquidity/repay
 * Rembourse tout ou partie de la dette
 * Body: {
 *   positionId: string,
 *   amount: string
 * }
 */
router.post('/repay', authenticateWallet, liquidityController.repay);

/**
 * POST /api/liquidity/add-collateral
 * Ajoute de l'ETH comme collatéral
 * Body: {
 *   positionId: string,
 *   ethAmount: string
 * }
 */
router.post('/add-collateral', authenticateWallet, liquidityController.addCollateral);

/**
 * POST /api/liquidity/close
 * Clôture complète de la position
 * Body: {
 *   positionId: string
 * }
 */
router.post('/close', authenticateWallet, liquidityController.closePosition);

/**
 * GET /api/liquidity/events/:positionId
 * Récupère l'historique des événements d'une position
 */
router.get('/events/:positionId', liquidityController.getEvents);

/**
 * GET /api/liquidity/health/:positionId
 * Récupère le health factor en temps réel
 */
router.get('/health/:positionId', liquidityController.getHealthFactor);

/**
 * GET /api/liquidity/calculate
 * Calcule les montants avant création
 * Query: ?ethAmount=1&ltv=50
 */
router.get('/calculate', liquidityController.calculateAmounts);

module.exports = router;
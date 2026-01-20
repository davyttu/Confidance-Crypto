const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { buildAdvisorContext } = require('../services/ai/contextBuilder');
const { explainQuestion } = require('../services/ai/advisorService');

const router = express.Router();

const isValidMonth = (month) => /^\d{4}-\d{2}$/.test(String(month || ''));

/**
 * POST /api/ai/advisor/explain
 * Lecture seule: IA conseillère explicative
 */
router.post('/explain', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { month, question } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!isValidMonth(month)) {
      return res.status(400).json({ error: 'Format de mois invalide (YYYY-MM)' });
    }
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question requise' });
    }

    console.log('🧠 [Advisor] Nouvelle question:', {
      userId,
      month,
      length: question.length
    });

    const context = await buildAdvisorContext(userId, month);
    const response = await explainQuestion(context, question);

    return res.json(response);
  } catch (error) {
    console.error('❌ [Advisor] Erreur:', error.message);
    if (error.message.includes('ADVISOR_WEBHOOK_URL')) {
      return res.status(503).json({ error: 'Advisor indisponible' });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

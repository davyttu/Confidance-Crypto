const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { sendMonthlyStatement } = require('../services/monthlyStatementService');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * POST /api/statements/send
 * Envoie le relevé mensuel pour un utilisateur (par email ou userId).
 * Body: { email?: string, userId?: string, month: number, year: number }
 * Sécurisé par clé interne STATEMENT_SEND_KEY ou auth.
 */
router.post('/send', async (req, res) => {
  try {
    const { email, userId, month, year } = req.body;

    const authKey = req.headers['x-statement-key'] || req.body.key;
    const expectedKey = process.env.STATEMENT_SEND_KEY;
    if (expectedKey && authKey !== expectedKey) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    if ((!email && !userId) || !month || !year) {
      return res.status(400).json({
        error: 'Fournir email ou userId, et month (1-12), year',
      });
    }

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (m < 1 || m > 12 || !y) {
      return res.status(400).json({ error: 'Mois (1-12) et année invalides' });
    }

    let targetUserId = userId;
    if (!targetUserId && email) {
      const { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error || !user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé pour cet email' });
      }
      targetUserId = user.id;
    }

    const result = await sendMonthlyStatement(targetUserId, m, y);

    if (result.success) {
      return res.json({ success: true, message: 'Relevé envoyé' });
    }
    return res.status(400).json({
      success: false,
      reason: result.reason,
      error: result.error?.message,
    });
  } catch (error) {
    console.error('Erreur envoi relevé:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

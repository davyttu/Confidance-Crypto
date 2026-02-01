// routes/recurringPayments.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { addTimelineEvent } = require('../services/timeline/timelineService');
const { sendRecurringFailureEmail } = require('../services/email/recurringFailureEmail');
const { notifyPaymentFailed } = require('../services/notificationService');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================================
// CONSTANTES
// ============================================================

/**
 * Adresses des tokens supportés par réseau
 */
const TOKEN_ADDRESSES = {
  base_mainnet: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
  },
  base_sepolia: {
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    // USDT testnet non fourni → laissé vide si non utilisé
    USDT: null
  }
};

/**
 * Tokens autorisés pour les paiements récurrents
 */
const ALLOWED_TOKENS = ['USDC', 'USDT'];

/**
 * Nombre de mois min/max
 */
const MIN_MONTHS = 1;
const MAX_MONTHS = 12;

/**
 * Durée d'un mois en secondes (30 jours)
 */
const MONTH_IN_SECONDS = 30 * 24 * 60 * 60; // 2592000

const formatPaymentCreatedExplanation = (label, category) => {
  const trimmedLabel = typeof label === 'string' ? label.trim() : '';
  const trimmedCategory = typeof category === 'string' ? category.trim() : '';

  if (trimmedLabel && trimmedCategory) {
    return `Paiement créé : ${trimmedLabel} (${trimmedCategory})`;
  }
  if (trimmedLabel) {
    return `Paiement créé : ${trimmedLabel}`;
  }
  if (trimmedCategory) {
    return `Paiement créé (${trimmedCategory})`;
  }
  return 'Paiement créé';
};

const sanitizeMetadata = (metadata) =>
  Object.fromEntries(
    Object.entries(metadata || {}).filter(([, value]) => value !== undefined)
  );

const requireInternalKey = (req, res) => {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    return true;
  }
  const headerKey = req.headers['x-internal-key'];
  if (headerKey && headerKey === internalKey) {
    return true;
  }
  res.status(401).json({ error: 'Unauthorized' });
  return false;
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Générer un ticket number unique
 */
function generateTicketNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CONF-REC-${timestamp}-${random}`;
}

/**
 * Valider les paramètres de création
 */
function validateRecurringPayment(body) {
  const errors = [];

  // Champs requis
  if (!body.contract_address) errors.push('contract_address requis');
  if (!body.payer_address) errors.push('payer_address requis');
  if (!body.payee_address) errors.push('payee_address requis');
  if (!body.token_symbol) errors.push('token_symbol requis');
  if (!body.monthly_amount) errors.push('monthly_amount requis');
  if (!body.total_months) errors.push('total_months requis');
  if (!body.first_payment_time) errors.push('first_payment_time requis');

  // Validations métier
  if (body.token_symbol && !ALLOWED_TOKENS.includes(body.token_symbol)) {
    errors.push(`token_symbol doit être ${ALLOWED_TOKENS.join(' ou ')}`);
  }

  if (body.total_months && (body.total_months < MIN_MONTHS || body.total_months > MAX_MONTHS)) {
    errors.push(`total_months doit être entre ${MIN_MONTHS} et ${MAX_MONTHS}`);
  }

  if (body.monthly_amount && parseFloat(body.monthly_amount) <= 0) {
    errors.push('monthly_amount doit être > 0');
  }

  if (body.first_month_amount && parseFloat(body.first_month_amount) <= 0) {
    errors.push('first_month_amount doit être > 0');
  }

  return errors;
}

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/payments/recurring
 * Créer un paiement récurrent
 */
router.post('/', async (req, res) => {
  try {
    const {
      contract_address,
      payer_address,
      payee_address,
      token_symbol,
      monthly_amount,
      first_month_amount,
      is_first_month_custom,
      total_months,
      first_payment_time,
      network,
      transaction_hash,
      cancellable,
      user_id,
      guest_email,
      payment_label,
      payment_category,
      payment_categorie,
      label,
      category,
      categorie
    } = req.body;

    // Validations
    const errors = validateRecurringPayment(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation échouée', 
        details: errors 
      });
    }

    // Déterminer si user connecté ou invité
    let ticket_number = null;

    if (!user_id) {
      // Mode INVITÉ
      if (!guest_email) {
        return res.status(400).json({ 
          error: 'Email requis pour les utilisateurs invités' 
        });
      }
      ticket_number = generateTicketNumber();
    }

    const normalizedPaymentLabel =
      typeof payment_label === 'string'
        ? payment_label.trim()
        : typeof label === 'string'
        ? label.trim()
        : '';
    const normalizedPaymentCategory =
      typeof payment_category === 'string'
        ? payment_category.trim()
        : typeof payment_categorie === 'string'
        ? payment_categorie.trim()
        : typeof category === 'string'
        ? category.trim()
        : typeof categorie === 'string'
        ? categorie.trim()
        : '';

    // Calculer next_execution_time (= first_payment_time au départ)
    const next_execution_time = first_payment_time;

    // Récupérer l'adresse du token (en fonction du réseau)
    const resolvedNetwork =
      typeof network === 'string' && network.trim().length > 0
        ? network.trim()
        : 'base_mainnet';
    const tokenAddressByNetwork = TOKEN_ADDRESSES[resolvedNetwork] || TOKEN_ADDRESSES.base_mainnet;
    const token_address = tokenAddressByNetwork?.[token_symbol] || null;

    // Normaliser les adresses en lowercase
    const normalizedContractAddress = String(contract_address).toLowerCase();
    const normalizedPayerAddress = String(payer_address).toLowerCase();
    const normalizedPayeeAddress = String(payee_address).toLowerCase();

    // Enregistrer dans Supabase
    const { data: recurringPayment, error } = await supabase
      .from('recurring_payments')
      .insert({
        contract_address: normalizedContractAddress,
        payer_address: normalizedPayerAddress,
        payee_address: normalizedPayeeAddress,
        token_symbol,
        token_address,
        monthly_amount,
        first_month_amount: first_month_amount || null,
        is_first_month_custom: !!is_first_month_custom,
        total_months,
        executed_months: 0,
        first_payment_time,
        next_execution_time,
        last_execution_time: null,
        cancellable: cancellable || false,
        network: network || 'base_mainnet',
        transaction_hash,
        user_id: user_id || null,
        guest_email: guest_email || null,
        ticket_number,
        status: 'pending',
        payment_label: normalizedPaymentLabel || null,
        payment_category: normalizedPaymentCategory || null
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur Supabase recurring:', error);
      return res.status(500).json({ 
        error: 'Erreur lors de l\'enregistrement',
        details: error.message
      });
    }

    console.log('✅ Paiement récurrent enregistré:', recurringPayment.id);

    if (recurringPayment?.id && recurringPayment?.user_id) {
      const metadata = sanitizeMetadata({
        amount: recurringPayment.monthly_amount,
        currency: recurringPayment.token_symbol,
        frequency: 'monthly'
      });

      addTimelineEvent({
        payment_id: recurringPayment.id,
        user_id: recurringPayment.user_id,
        event_type: 'payment_created',
        event_label: 'Paiement créé',
        actor_type: 'user',
        actor_label: 'Vous',
        explanation: formatPaymentCreatedExplanation(normalizedPaymentLabel, normalizedPaymentCategory),
        metadata
      });
    }

    res.status(201).json({
      success: true,
      recurringPayment,
      ticket_number
    });

  } catch (error) {
    console.error('❌ Erreur POST /api/payments/recurring:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/payments/recurring/:walletAddress
 * Récupérer tous les paiements récurrents d'un wallet
 */
router.get('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Adresse wallet requise' });
    }

    // Récupérer paiements récurrents envoyés OU reçus
    const { data: payments, error } = await supabase
      .from('recurring_payments')
      .select('*')
      .or(`payer_address.eq.${walletAddress},payee_address.eq.${walletAddress}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération recurring:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    res.json({
      success: true,
      payments: payments || []
    });

  } catch (error) {
    console.error('❌ Erreur GET /api/payments/recurring/:wallet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/payments/recurring/id/:id
 * Récupérer les détails d'un paiement récurrent spécifique
 */
router.get('/id/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'ID requis' });
    }

    const { data: payment, error } = await supabase
      .from('recurring_payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Erreur récupération recurring by ID:', error);
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    res.json({
      success: true,
      payment
    });

  } catch (error) {
    console.error('❌ Erreur GET /api/payments/recurring/id/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PATCH /api/payments/recurring/:id
 * Mettre à jour un paiement récurrent (utilisé par le keeper)
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      executed_months,
      next_execution_time,
      last_execution_time,
      status,
      last_execution_hash,
      failure_reason
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID requis' });
    }

    const { data: existingPayment, error: existingError } = await supabase
      .from('recurring_payments')
      .select('last_execution_hash')
      .eq('id', id)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.warn('⚠️ Erreur lecture paiement existant (non bloquant):', existingError.message);
    }

    // Construire l'objet de mise à jour
    const updates = {};
    if (executed_months !== undefined) updates.executed_months = executed_months;
    if (next_execution_time !== undefined) updates.next_execution_time = next_execution_time;
    if (last_execution_time !== undefined) updates.last_execution_time = last_execution_time;
    if (status !== undefined) updates.status = status;
    if (last_execution_hash !== undefined) updates.last_execution_hash = last_execution_hash;

    // Ajouter updated_at
    updates.updated_at = new Date().toISOString();

    const { data: payment, error } = await supabase
      .from('recurring_payments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur update recurring:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }

    console.log('✅ Paiement récurrent mis à jour:', id);

    if (payment?.id && payment?.user_id && status === 'active') {
      addTimelineEvent({
        payment_id: payment.id,
        user_id: payment.user_id,
        event_type: 'payment_scheduled',
        event_label: 'Paiement programmé',
        actor_type: 'system',
        actor_label: 'Confidance',
        explanation: 'Paiement programmé selon la règle définie'
      });
    }

    const hasSkippedHash =
      typeof last_execution_hash === 'string' &&
      last_execution_hash.toLowerCase().startsWith('skipped');
    const changedHash =
      typeof last_execution_hash === 'string' &&
      last_execution_hash !== existingPayment?.last_execution_hash;

    if (payment?.id && payment?.user_id && last_execution_hash && changedHash) {
      if (hasSkippedHash) {
        addTimelineEvent({
          payment_id: payment.id,
          user_id: payment.user_id,
          event_type: 'payment_failed',
          event_label: 'Paiement échoué',
          actor_type: 'system',
          actor_label: 'Confidance',
          explanation: 'Paiement mensuel non exécuté',
          metadata: sanitizeMetadata({
            amount: payment.monthly_amount,
            currency: payment.token_symbol,
            payment_type: 'recurring',
            category: req.body.category ?? null,
            tx_hash: last_execution_hash,
            failure_reason: typeof failure_reason === 'string' ? failure_reason : null,
            executed_months: payment.executed_months ?? null
          })
        });
      } else {
        addTimelineEvent({
          payment_id: payment.id,
          user_id: payment.user_id,
          event_type: 'payment_executed',
          event_label: 'Paiement exécuté',
          actor_type: 'system',
          actor_label: 'Confidance',
          explanation: 'Paiement exécuté avec succès',
          metadata: sanitizeMetadata({
            amount: payment.monthly_amount,
            currency: payment.token_symbol,
            payment_type: 'recurring',
            category: req.body.category ?? null,
            tx_hash: last_execution_hash,
            gas_fee: req.body.gas_fee ?? 0,
            protocol_fee: req.body.protocol_fee ?? 0
          })
        });
      }
    }

    if (payment?.id && payment?.user_id && status === 'completed') {
      addTimelineEvent({
        payment_id: payment.id,
        user_id: payment.user_id,
        event_type: 'payment_completed',
        event_label: 'Paiement terminé',
        actor_type: 'system',
        actor_label: 'Confidance',
        explanation: 'Toutes les mensualités ont été exécutées',
        metadata: sanitizeMetadata({
          amount: payment.monthly_amount,
          currency: payment.token_symbol,
          payment_type: 'recurring',
          category: req.body.category ?? null,
          executed_months: payment.executed_months ?? null,
          total_months: payment.total_months ?? null
        })
      });
    }

    const shouldNotifyFailure = (hasSkippedHash && changedHash) || status === 'failed';

    if (payment?.id && payment?.user_id && shouldNotifyFailure) {
      await sendRecurringFailureEmail({
        supabase,
        payment,
        reason: typeof failure_reason === 'string' ? failure_reason : undefined,
        monthNumber: Number(payment.executed_months || 0),
      });
    }

    res.json({
      success: true,
      payment
    });

  } catch (error) {
    console.error('❌ Erreur PATCH /api/payments/recurring/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/payments/recurring/notify-failed
 * Notification email pour une mensualité échouée (appel interne keeper)
 */
router.post('/notify-failed', async (req, res) => {
  if (!requireInternalKey(req, res)) return;

  try {
    const { payment_id, failure_reason, month_number } = req.body || {};

    if (!payment_id) {
      return res.status(400).json({ error: 'payment_id requis' });
    }

    const { data: payment, error: fetchError } = await supabase
      .from('recurring_payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (fetchError || !payment) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    const monthNumber = Number.isFinite(Number(month_number))
      ? Number(month_number)
      : Math.max(1, Number(payment.executed_months || 0) + 1);
    const shouldCheckTimeline = Boolean(monthNumber && payment?.id);

    if (shouldCheckTimeline) {
      const { data: existingEvents, error: existingError } = await supabase
        .from('payment_timeline_events')
        .select('id')
        .eq('payment_id', payment.id)
        .eq('event_type', 'recurring_month_failed')
        .contains('metadata', { month_number: monthNumber })
        .limit(1);

      if (!existingError && Array.isArray(existingEvents) && existingEvents.length > 0) {
        return res.json({ success: true, skipped: true });
      }
    }

    await sendRecurringFailureEmail({
      supabase,
      payment,
      reason: typeof failure_reason === 'string' ? failure_reason : undefined,
      monthNumber
    });

    if (payment?.user_id) {
      const reasonText = monthNumber
        ? `Mensualité ${monthNumber} échouée. ${typeof failure_reason === 'string' ? failure_reason : ''}`.trim()
        : (typeof failure_reason === 'string' ? failure_reason : 'Mensualité échouée');
      await notifyPaymentFailed(
        payment.user_id,
        payment.payment_label || 'Paiement récurrent',
        reasonText
      ).catch((err) => console.warn('⚠️ Notification in-app recurring failure:', err?.message || err));
    }

    if (payment?.id && payment?.user_id) {
      addTimelineEvent({
        payment_id: payment.id,
        user_id: payment.user_id,
        event_type: 'recurring_month_failed',
        event_label: 'Mensualité échouée',
        actor_type: 'system',
        actor_label: 'Confidance',
        explanation: 'Une mensualité a échoué',
        metadata: sanitizeMetadata({
          month_number: monthNumber,
          reason: typeof failure_reason === 'string' ? failure_reason : null,
          network: payment.network || null
        })
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur POST /api/payments/recurring/notify-failed:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/payments/recurring/:id
 * Annuler un paiement récurrent (appelle cancel() sur le smart contract)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { payer_address } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID requis' });
    }

    if (!payer_address) {
      return res.status(400).json({ error: 'payer_address requis' });
    }

    // Récupérer le paiement
    const { data: payment, error: fetchError } = await supabase
      .from('recurring_payments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !payment) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    // Vérifier que c'est bien le payer
    if (payment.payer_address.toLowerCase() !== payer_address.toLowerCase()) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // Vérifier qu'il est annulable
    if (!payment.cancellable) {
      return res.status(400).json({ error: 'Ce paiement n\'est pas annulable' });
    }

    // Vérifier le statut
    if (payment.status === 'cancelled') {
      return res.status(400).json({ error: 'Déjà annulé' });
    }

    if (payment.status === 'completed') {
      return res.status(400).json({ error: 'Impossible d\'annuler un paiement complété' });
    }

    // Mettre à jour le statut (le frontend devra appeler cancel() sur la blockchain)
    const { data: updatedPayment, error: updateError } = await supabase
      .from('recurring_payments')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erreur annulation recurring:', updateError);
      return res.status(500).json({ error: 'Erreur lors de l\'annulation' });
    }

    console.log('✅ Paiement récurrent annulé:', id);

    if (updatedPayment?.id && updatedPayment?.user_id) {
      addTimelineEvent({
        payment_id: updatedPayment.id,
        user_id: updatedPayment.user_id,
        event_type: 'payment_cancelled',
        event_label: 'Paiement annulé',
        actor_type: 'user',
        actor_label: 'Vous',
        explanation: 'Paiement annulé'
      });
    }

    res.json({
      success: true,
      payment: updatedPayment,
      message: 'Paiement annulé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur DELETE /api/payments/recurring/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/payments/recurring/:id/remove
 * Supprimer un paiement récurrent du dashboard (sans toucher au smart contract)
 * Autorisé uniquement si annulé ou terminé
 */
router.delete('/:id/remove', async (req, res) => {
  try {
    const { id } = req.params;
    const { wallet_address } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID requis' });
    }
    if (!wallet_address) {
      return res.status(400).json({ error: 'wallet_address requis' });
    }

    const { data: payment, error: fetchError } = await supabase
      .from('recurring_payments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !payment) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    const wallet = wallet_address.toLowerCase();
    const isOwner =
      payment.payer_address?.toLowerCase() === wallet ||
      payment.payee_address?.toLowerCase() === wallet;

    if (!isOwner) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const allowedStatuses = ['cancelled', 'completed', 'released', 'failed'];
    if (!allowedStatuses.includes(payment.status)) {
      return res.status(400).json({ error: 'Paiement non supprimable' });
    }

    const { error: deleteError } = await supabase
      .from('recurring_payments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Erreur Supabase delete recurring:', deleteError);
      return res.status(500).json({ error: 'Erreur lors de la suppression' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur DELETE /api/payments/recurring/:id/remove:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/payments/recurring/stats/:walletAddress
 * Statistiques des paiements récurrents pour un wallet
 */
router.get('/stats/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Adresse wallet requise' });
    }

    // Récupérer tous les paiements du wallet
    const { data: payments, error } = await supabase
      .from('recurring_payments')
      .select('*')
      .or(`payer_address.eq.${walletAddress},payee_address.eq.${walletAddress}`);

    if (error) {
      console.error('❌ Erreur stats recurring:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    // Calculer les stats
    const stats = {
      total: payments.length,
      pending: payments.filter(p => p.status === 'pending').length,
      active: payments.filter(p => p.status === 'active').length,
      completed: payments.filter(p => p.status === 'completed').length,
      cancelled: payments.filter(p => p.status === 'cancelled').length,
      totalMonthlyAmount: payments
        .filter(p => p.status === 'active' || p.status === 'pending')
        .reduce((sum, p) => sum + parseFloat(p.monthly_amount), 0),
      byToken: {}
    };

    // Stats par token
    payments.forEach(payment => {
      if (!stats.byToken[payment.token_symbol]) {
        stats.byToken[payment.token_symbol] = {
          count: 0,
          totalMonthly: 0
        };
      }
      stats.byToken[payment.token_symbol].count++;
      if (payment.status === 'active' || payment.status === 'pending') {
        stats.byToken[payment.token_symbol].totalMonthly += parseFloat(payment.monthly_amount);
      }
    });

    res.json({
      success: true,
      stats,
      payments
    });

  } catch (error) {
    console.error('❌ Erreur GET /api/payments/recurring/stats/:wallet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
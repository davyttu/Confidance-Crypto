require('dotenv').config();
const cron = require('node-cron'); // 🆕 AJOUTÉ pour le keeper de liquidité
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const recurringPaymentsRoutes = require('./routes/recurringPayments'); // ✅ AJOUTÉ
const paymentLinksRoutes = require('./routes/paymentLinks');
const sendPaymentLinkRoutes = require('./routes/sendPaymentLink');
const paymentTransactionsRoutes = require('./routes/paymentTransactions');
const statementsRoutes = require('./routes/statements');
const chatRoutes = require('./routes/chat'); // ✅ Chat Agent
const aiAdvisorRoutes = require('./routes/aiAdvisor');
const notificationsRoutes = require('./routes/notifications');
const linkWalletRoutes = require('./routes/linkWallet');
const { authenticateToken, optionalAuth } = require('./middleware/auth');
const { addTimelineEvent } = require('./services/timeline/timelineService');
const { buildCategoryInsights } = require('./services/analytics/categoryInsights');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigins = allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;

app.use(cors({
  origin: corsOrigins,
  credentials: true, // Autoriser les cookies/credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/** Ethereum addresses in DB must match dashboard queries (lowercase). */
const normalizeHexAddress = (value) => {
  if (value == null || value === '') return value;
  if (typeof value !== 'string') return value;
  return value.toLowerCase();
};

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

const getMonthKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthRange = (monthKey) => {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start: start.toISOString(), end: end.toISOString() };
};

const buildKpiExplanations = (stats, breakdown, previous) => {
  const totalCount = breakdown.instant.count + breakdown.scheduled.count + breakdown.recurring.count;
  const dominant = [
    { key: 'instant', label: 'instantanés', value: breakdown.instant.count },
    { key: 'scheduled', label: 'programmés', value: breakdown.scheduled.count },
    { key: 'recurring', label: 'récurrents', value: breakdown.recurring.count }
  ].sort((a, b) => b.value - a.value)[0];

  const transactionsExplanation = totalCount === 0
    ? 'Aucune exécution ce mois-ci.'
    : dominant.value / totalCount > 0.6
      ? `Principalement des paiements ${dominant.label} ce mois-ci.`
      : 'Répartition équilibrée entre les types de paiements.';

  const totalFees = Number(stats.totalFees || 0);
  const gasFees = Number(stats.gasFees || 0);
  const protocolFees = Number(stats.protocolFees || 0);
  let feesExplanation = 'Frais faibles ce mois-ci.';
  if (totalFees > 0 && stats.transactionCount > 4) {
    feesExplanation = 'Les frais augmentent avec le nombre d’exécutions.';
  }
  if (totalFees > 0 && gasFees / totalFees > 0.6) {
    feesExplanation = 'Les frais sont élevés à cause des frais de gas.';
  } else if (totalFees > 0 && protocolFees / totalFees > 0.6) {
    feesExplanation = 'Les frais viennent surtout des frais Confidance.';
  }

  const realCost = Number(stats.feeRatio || 0);
  let realCostExplanation = 'Le coût réel est dans la moyenne.';
  if (realCost > 3) {
    realCostExplanation = 'Le coût réel est élevé car le volume est faible.';
  } else if (realCost > 0 && realCost < 1) {
    realCostExplanation = 'Le coût réel est faible grâce à un volume important.';
  }

  const totalVolume = Number(stats.totalVolume || 0);
  const volumeExplanation = totalVolume <= 0
    ? 'Aucun volume ce mois-ci.'
    : stats.transactionCount === 1
      ? 'Basé sur une seule exécution.'
      : `Volume réparti sur ${stats.transactionCount} exécutions.`;

  const delta = (current, previousValue) => {
    if (!previousValue || previousValue === 0) return 0;
    return Number((((current - previousValue) / previousValue) * 100).toFixed(1));
  };

  return {
    transactions: {
      value: stats.transactionCount,
      delta: previous ? delta(stats.transactionCount, previous.transactionCount) : 0,
      explanation: transactionsExplanation
    },
    totalVolume: {
      value: stats.totalVolume,
      delta: previous ? delta(Number(stats.totalVolume || 0), Number(previous.totalVolume || 0)) : 0,
      explanation: volumeExplanation
    },
    totalFees: {
      value: stats.totalFees,
      delta: previous ? delta(Number(stats.totalFees || 0), Number(previous.totalFees || 0)) : 0,
      explanation: feesExplanation
    },
    realCost: {
      value: stats.feeRatio,
      delta: previous ? Number((stats.feeRatio - previous.feeRatio).toFixed(2)) : 0,
      explanation: realCostExplanation
    }
  };
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 CONFIDANCE CRYPTO API - BACKEND');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📡 Port: ${PORT}`);
console.log(`✨ Features: Auth + Payments + Beneficiaries + Recurring + Liquidity`); // ✅ MODIFIÉ (ajouté "+ Recurring")
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Routes d'authentification
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chat', chatRoutes); // ✅ Chat Agent
app.use('/api/ai/advisor', aiAdvisorRoutes);
app.use('/api/payment-links', paymentLinksRoutes);
app.use('/api/send-payment-link', sendPaymentLinkRoutes);
app.use('/api/payment-transactions', paymentTransactionsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/link-wallet', linkWalletRoutes);
app.use('/api/statements', statementsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    features: ['auth', 'single-payments', 'batch-payments', 'beneficiaries', 'recurring-payments', 'status-update', 'liquidity'], keeper: { active: true, interval: '5 minutes', monitoring: ['liquidity-positions'] } // ✅ MODIFIÉ (ajouté 'recurring-payments')
  });
});

// GET /api/analytics/monthly - Analytics mensuelles basées sur la timeline
app.get('/api/analytics/monthly', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { month } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    let analyticsQuery = supabase
      .from('monthly_payment_analytics_v1')
      .select('*')
      .eq('user_id', userId)
      .order('month', { ascending: false });

    let breakdownQuery = supabase
      .from('monthly_payment_breakdown_v1')
      .select('*')
      .eq('user_id', userId);

    if (month) {
      const range = getMonthRange(month);
      if (!range) {
        return res.status(400).json({ error: 'Format de mois invalide (YYYY-MM)' });
      }
      analyticsQuery = analyticsQuery.gte('month', range.start).lt('month', range.end);
      breakdownQuery = breakdownQuery.gte('month', range.start).lt('month', range.end);
    }

    const { data: analyticsRows, error: analyticsError } = await analyticsQuery;
    if (analyticsError) {
      console.error('❌ Erreur analytics view:', analyticsError);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    const { data: breakdownRows, error: breakdownError } = await breakdownQuery;
    if (breakdownError) {
      console.error('❌ Erreur breakdown view:', breakdownError);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    const breakdownByMonth = (breakdownRows || []).reduce((acc, row) => {
      const monthKey = getMonthKey(row.month);
      if (!monthKey) return acc;
      if (!acc[monthKey]) {
        acc[monthKey] = {
          instant: { count: 0, volume: '0', avg_fees: '0' },
          scheduled: { count: 0, volume: '0', avg_fees: '0' },
          recurring: { count: 0, volume: '0', avg_fees: '0' }
        };
      }
      const typeKey = row.payment_type || 'scheduled';
      const target = acc[monthKey][typeKey] || acc[monthKey].scheduled;
      target.count = Number(row.transactions_count || 0);
      target.volume = String(row.total_volume || '0');
      target.avg_fees = String(row.avg_fees || '0');
      acc[monthKey][typeKey] = target;
      return acc;
    }, {});

    const monthStats = (analyticsRows || []).map((row) => {
      const monthKey = getMonthKey(row.month);
      const breakdown = breakdownByMonth[monthKey] || {
        instant: { count: 0, volume: '0', avg_fees: '0' },
        scheduled: { count: 0, volume: '0', avg_fees: '0' },
        recurring: { count: 0, volume: '0', avg_fees: '0' }
      };

      return {
        month: monthKey,
        transactionCount: Number(row.transactions_count || 0),
        totalVolume: String(row.total_volume || '0'),
        totalFees: String(row.total_fees || '0'),
        feeRatio: Number(row.real_cost_percentage || 0),
        gasFees: String(row.gas_fees_total || '0'),
        protocolFees: String(row.protocol_fees_total || '0'),
        breakdown: {
          instant: {
            count: breakdown.instant.count,
            volume: breakdown.instant.volume,
            avgFees: breakdown.instant.avg_fees
          },
          scheduled: {
            count: breakdown.scheduled.count,
            volume: breakdown.scheduled.volume,
            avgFees: breakdown.scheduled.avg_fees
          },
          recurring: {
            count: breakdown.recurring.count,
            volume: breakdown.recurring.volume,
            avgFees: breakdown.recurring.avg_fees
          }
        }
      };
    }).filter((row) => row.month);

    const sorted = monthStats.sort((a, b) => b.month.localeCompare(a.month));
    const enriched = sorted.map((stats, index) => {
      const breakdown = stats.breakdown;
      const previous = index < sorted.length - 1 ? sorted[index + 1] : null;

      return {
        ...stats,
        explanations: buildKpiExplanations(stats, breakdown, previous)
      };
    });

    res.json({ months: enriched });
  } catch (error) {
    console.error('❌ Erreur analytics monthly:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/analytics/:month/timeline - Events exécutés du mois
app.get('/api/analytics/:month/timeline', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { month } = req.params;
    const range = getMonthRange(month);

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!range) {
      return res.status(400).json({ error: 'Format de mois invalide (YYYY-MM)' });
    }

    const { data: events, error } = await supabase
      .from('payment_timeline_events')
      .select('event_type, event_label, actor_label, explanation, created_at, metadata')
      .eq('user_id', userId)
      .eq('event_type', 'payment_executed')
      .gte('created_at', range.start)
      .lt('created_at', range.end)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Erreur timeline analytics:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    res.json(events || []);
  } catch (error) {
    console.error('❌ Erreur analytics timeline:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/analytics/:month/insights - Insights par catégorie (timeline only)
app.get('/api/analytics/:month/insights', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { month } = req.params;
    const range = getMonthRange(month);

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!range) {
      return res.status(400).json({ error: 'Format de mois invalide (YYYY-MM)' });
    }

    const insights = await buildCategoryInsights({
      supabase,
      userId,
      monthKey: month
    });

    res.json(Array.isArray(insights) ? insights : []);
  } catch (error) {
    console.error('❌ Erreur analytics insights:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/payments - Créer un paiement SIMPLE
app.post('/api/payments', optionalAuth, async (req, res) => {
  const { user } = req; // User connecté ou null
  try {
    const {
      contract_address,
      payer_address,
      payee_address,
      token_symbol,
      token_address,
      amount,
      release_time,
      cancellable,
      network,
      transaction_hash,
      is_instant,
      payment_type,
    } = req.body;

    console.log('📥 [SIMPLE] Nouvelle demande - BODY COMPLET:', JSON.stringify(req.body, null, 2));
    console.log('📥 [SIMPLE] Extractions:', { 
      contract_address, 
      payer_address,
      is_instant_extracted: is_instant,
      payment_type_extracted: payment_type,
      token_symbol,
      amount
    });

    // Validation
    if (!transaction_hash) {
      console.error('❌ transaction_hash manquant');
      return res.status(400).json({ error: 'transaction_hash is required' });
    }

    const normalizedContractAddress = normalizeHexAddress(contract_address);
    const normalizedPayerAddress = normalizeHexAddress(payer_address);
    const normalizedPayeeAddress = normalizeHexAddress(payee_address);
    const normalizedTokenAddress =
      token_address && typeof token_address === 'string'
        ? normalizeHexAddress(token_address)
        : token_address;

    // ✅ FIX : Vérifier si le paiement existe déjà (protection contre doublons)
    // Utiliser une transaction pour éviter les race conditions
    try {
      const { data: existingPayment, error: checkError } = await supabase
        .from('scheduled_payments')
        .select('*')
        .eq('contract_address', normalizedContractAddress)
        .maybeSingle();

      // PGRST116 = no rows returned (normal, pas d'erreur)
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Erreur vérification doublon:', checkError);
        // Ne pas retourner d'erreur, continuer avec l'insertion
      } else if (existingPayment) {
        console.log('ℹ️ [SIMPLE] Paiement déjà existant:', existingPayment.id);
        // Retourner le paiement existant au lieu d'erreur
        return res.json({ 
          success: true, 
          payment: existingPayment,
          alreadyExists: true 
        });
      }
    } catch (checkErr) {
      console.warn('⚠️ Erreur lors de la vérification (non bloquant):', checkErr.message);
      // Continuer avec l'insertion même si la vérification échoue
    }

    // Pour les paiements instantanés, le statut est "released" car ils sont exécutés immédiatement
    // ✅ FIX : S'assurer que payment_type n'est jamais null (contrainte NOT NULL dans Supabase)
    
    // Déterminer si c'est un paiement instantané
    const isInstant = is_instant === true || is_instant === 'true' || String(is_instant) === 'true';
    
    // ✅ CRITIQUE : Toujours définir payment_type, jamais null ou undefined
    // Vérifier d'abord si payment_type est valide et non vide
    let finalPaymentType = 'scheduled'; // Valeur par défaut garantie
    
    if (payment_type && typeof payment_type === 'string' && payment_type.trim() !== '') {
      // Si payment_type est fourni et valide, l'utiliser
      if (payment_type === 'instant' || payment_type === 'scheduled' || payment_type === 'recurring') {
        finalPaymentType = payment_type;
      }
    } else if (isInstant) {
      // Si is_instant est true, c'est un paiement instantané
      finalPaymentType = 'instant';
    }
    // Sinon, on garde 'scheduled' par défaut
    
    const finalStatus = isInstant ? 'released' : 'pending';
    
    // ✅ SÉCURITÉ FINALE : Garantir que payment_type n'est jamais null/undefined
    if (!finalPaymentType || finalPaymentType === null || finalPaymentType === undefined) {
      console.error('❌ [SIMPLE] ERREUR CRITIQUE: payment_type est null/undefined, utilisation de "scheduled"');
      finalPaymentType = 'scheduled';
    }
    
    console.log('🔍 [SIMPLE] Détermination type paiement:', {
      is_instant_received: is_instant,
      is_instant_type: typeof is_instant,
      payment_type_received: payment_type,
      payment_type_type: typeof payment_type,
      isInstant_calculated: isInstant,
      finalPaymentType,
      finalStatus
    });

    // ✅ SÉCURITÉ : Vérifier une dernière fois avant insertion
    if (!finalPaymentType || finalPaymentType === null || finalPaymentType === undefined) {
      console.error('❌ [SIMPLE] ERREUR CRITIQUE AVANT INSERTION: payment_type est null/undefined');
      finalPaymentType = 'scheduled';
    }

    const insertData = {
      contract_address: normalizedContractAddress,
      payer_address: normalizedPayerAddress,
      payee_address: normalizedPayeeAddress,
      token_symbol,
      token_address: normalizedTokenAddress,
      amount,
      release_time,
      cancellable: cancellable || false,
      network: network || 'base_mainnet',
      transaction_hash,
      status: finalStatus,
      user_id: user ? user.userId : null,
      guest_email: !user ? req.body.guest_email : null,
      is_instant: isInstant,
      payment_type: finalPaymentType, // ✅ GARANTI non-null
      // Colonnes par défaut pour éviter les erreurs si elles n'existent pas
      is_batch: false,
      batch_count: null,
      batch_beneficiaries: null,
    };
    
    // ✅ VÉRIFICATION FINALE avant insertion
    if (insertData.payment_type === null || insertData.payment_type === undefined) {
      console.error('❌ [SIMPLE] ERREUR CRITIQUE: payment_type est null dans insertData !');
      insertData.payment_type = 'scheduled';
    }

    console.log('📤 [SIMPLE] Données à insérer:', JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from('scheduled_payments')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ [SIMPLE] Erreur Supabase détaillée:', JSON.stringify(error, null, 2));
      console.error('❌ [SIMPLE] Code erreur:', error.code);
      console.error('❌ [SIMPLE] Message:', error.message);
      console.error('❌ [SIMPLE] Détails:', error.details);
      console.error('❌ [SIMPLE] Hint:', error.hint);
      
      // ✅ FIX : Gérer l'erreur de doublon de manière gracieuse (priorité)
      if (error.code === '23505' || 
          error.message?.includes('duplicate key') || 
          error.message?.includes('contract_address') ||
          error.message?.includes('unique constraint')) {
        console.log('ℹ️ [SIMPLE] Doublon détecté après insertion, récupération du paiement existant...');
        
        // Récupérer le paiement existant
        const { data: existing, error: fetchError } = await supabase
          .from('scheduled_payments')
          .select('*')
          .eq('contract_address', normalizedContractAddress)
          .single();
        
        if (fetchError) {
          console.warn('⚠️ Erreur récupération paiement existant (non bloquant):', fetchError.message);
          // Retourner quand même un succès car le paiement existe sur la blockchain
          return res.json({ 
            success: true, 
            payment: { contract_address, transaction_hash },
            alreadyExists: true,
            warning: 'Paiement créé mais enregistrement DB partiel'
          });
        }
        
        return res.json({ 
          success: true, 
          payment: existing,
          alreadyExists: true 
        });
      }
      
      // Pour les autres erreurs, logger et retourner l'erreur avec plus de détails
      console.error('❌ [SIMPLE] Erreur non gérée, retour erreur au client');
      return res.status(500).json({ 
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        insertData: insertData // Retourner les données pour debug
      });
    }

    console.log('✅ [SIMPLE] Paiement enregistré:', data.id);

    if (data?.id && data?.user_id) {
      const metadata = sanitizeMetadata({
        amount: data.amount ?? amount,
        currency: data.token_symbol ?? token_symbol,
        frequency: finalPaymentType === 'recurring' ? 'monthly' : undefined
      });

      addTimelineEvent({
        payment_id: data.id,
        user_id: data.user_id,
        event_type: 'payment_created',
        event_label: 'Paiement créé',
        actor_type: 'user',
        actor_label: 'Vous',
        explanation: formatPaymentCreatedExplanation(req.body.label, req.body.category),
        metadata
      });

      if (finalStatus === 'pending') {
        addTimelineEvent({
          payment_id: data.id,
          user_id: data.user_id,
          event_type: 'payment_scheduled',
          event_label: 'Paiement programmé',
          actor_type: 'system',
          actor_label: 'Confidance',
          explanation: 'Paiement programmé selon la règle définie'
        });
      } else {
        addTimelineEvent({
          payment_id: data.id,
          user_id: data.user_id,
          event_type: 'payment_executed',
          event_label: 'Paiement exécuté',
          actor_type: 'system',
          actor_label: 'Confidance',
          explanation: 'Paiement exécuté avec succès',
          metadata: sanitizeMetadata({
            amount: data.amount ?? amount,
            currency: data.token_symbol ?? token_symbol,
            gas_fee: req.body.gas_fee ?? 0,
            protocol_fee: req.body.protocol_fee ?? 0,
            payment_type: finalPaymentType,
            category: req.body.category ?? null,
            tx_hash: transaction_hash
          })
        });
      }
    }
    
    // 🆕 Notifier Albert via Payment Protocol (non bloquant)
    const { notifyPaymentCreated } = require('./services/paymentProtocol');
    notifyPaymentCreated(data).catch(err => {
      console.warn('⚠️ [PaymentProtocol] Notification échouée (non bloquant):', err.message);
    });
    
    res.json({ success: true, payment: data });
  } catch (error) {
    console.error('❌ [SIMPLE] Erreur:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🆕 POST /api/payments/batch - Créer un paiement BATCH (multi-bénéficiaires)
app.post('/api/payments/batch', optionalAuth, async (req, res) => {
  const { user } = req;
  try {
    const {
      contract_address,
      payer_address,
      beneficiaries,
      total_to_beneficiaries,
      protocol_fee,
      total_sent,
      release_time,
      cancellable,
      network,
      transaction_hash,
      is_instant,
      payment_type,
      token_symbol,           // ✅ Ajouter token_symbol depuis le body
      token_address,          // ✅ Ajouter token_address depuis le body
    } = req.body;

    console.log('📥 [BATCH] Nouvelle demande:', { 
      contract_address, 
      payer_address,
      transaction_hash,
      beneficiaries_count: beneficiaries?.length,
      is_instant,
      payment_type,
    });

    // Validation des champs obligatoires
    if (!contract_address) {
      return res.status(400).json({ error: 'contract_address is required' });
    }
    if (!payer_address) {
      return res.status(400).json({ error: 'payer_address is required' });
    }
    if (!transaction_hash) {
      console.error('❌ [BATCH] transaction_hash manquant !');
      return res.status(400).json({ error: 'transaction_hash is required' });
    }
    if (!beneficiaries || !Array.isArray(beneficiaries)) {
      return res.status(400).json({ error: 'beneficiaries must be an array' });
    }
    if (beneficiaries.length === 0) {
      return res.status(400).json({ error: 'beneficiaries array is empty' });
    }
    if (!release_time) {
      return res.status(400).json({ error: 'release_time is required' });
    }

    const normalizedBatchContract = normalizeHexAddress(contract_address);
    const normalizedBatchPayer = normalizeHexAddress(payer_address);
    const beneficiariesNormalized = beneficiaries.map((b) => ({
      ...b,
      address: b && b.address != null ? normalizeHexAddress(String(b.address)) : b?.address,
    }));

    // ✅ Déterminer isInstant et payment_type de manière explicite (NE JAMAIS laisser NULL)
    // Normaliser is_instant (peut être true, "true", 1, etc.)
    const normalizedIsInstant = is_instant === true || 
                                is_instant === 'true' || 
                                is_instant === 1 || 
                                is_instant === '1' ||
                                payment_type === 'instant';
    
    // Déterminer finalPaymentType (TOUJOURS 'instant' ou 'scheduled', JAMAIS null/undefined)
    let finalPaymentType;
    if (payment_type === 'instant' || payment_type === 'scheduled') {
      // Si payment_type est valide, l'utiliser
      finalPaymentType = payment_type;
    } else if (normalizedIsInstant) {
      // Si is_instant est vrai (même sans payment_type valide), c'est instantané
      finalPaymentType = 'instant';
    } else {
      // Par défaut, c'est scheduled
      finalPaymentType = 'scheduled';
    }
    
    // ✅ Garantir que finalPaymentType n'est jamais null/undefined
    if (!finalPaymentType || (finalPaymentType !== 'instant' && finalPaymentType !== 'scheduled')) {
      console.error('❌ [BATCH] ERREUR CRITIQUE: finalPaymentType invalide après détermination:', finalPaymentType);
      finalPaymentType = 'scheduled'; // Fallback sécurisé
    }
    
    // ✅ Recalculer isInstant avec la valeur finale de payment_type
    const isInstant = normalizedIsInstant || finalPaymentType === 'instant';
    
    // Déterminer le statut : completed pour instantané, pending pour programmé
    const finalStatus = isInstant ? 'completed' : 'pending';
    
    console.log('📋 [BATCH] Détermination payment_type:', {
      is_instant_from_body: is_instant,
      payment_type_from_body: payment_type,
      normalizedIsInstant,
      finalPaymentType,
      isInstant,
      finalStatus,
    });
    
    // Préparer les données pour insertion
    const insertData = {
      contract_address: normalizedBatchContract,
      payer_address: normalizedBatchPayer,
      payee_address: beneficiariesNormalized[0].address, // Premier bénéficiaire comme référence
      token_symbol: token_symbol || 'ETH',      // ✅ Utiliser token_symbol depuis req.body
      token_address:
        token_address && typeof token_address === 'string'
          ? normalizeHexAddress(token_address)
          : token_address || null,     // ✅ Utiliser token_address depuis req.body
      amount: total_sent || total_to_beneficiaries || '0',
      release_time: parseInt(release_time),
      cancellable: cancellable || false,
      network: network || 'base_mainnet',
      transaction_hash,
      status: finalStatus, // ✅ Utiliser le statut déterminé (completed pour instantané)
      
      // Colonnes BATCH
      is_batch: true,
      is_instant: isInstant || false, // ✅ Ajouter is_instant
      payment_type: finalPaymentType, // ✅ Ajouter payment_type (TOUJOURS défini)
      batch_count: beneficiariesNormalized.length,
      batch_beneficiaries: beneficiariesNormalized, // Supabase accepte direct l'objet JS pour JSONB
      user_id: user ? user.userId : null,
      guest_email: !user ? req.body.guest_email : null,
    };
    
    // ✅ Vérification finale avant insertion
    if (!insertData.payment_type || (insertData.payment_type !== 'instant' && insertData.payment_type !== 'scheduled')) {
      console.error('❌ [BATCH] ERREUR CRITIQUE: payment_type invalide dans insertData:', insertData.payment_type);
      insertData.payment_type = 'scheduled'; // Fallback absolu
      console.warn('⚠️ [BATCH] Correction appliquée: payment_type = "scheduled"');
    }
    
    console.log('✅ [BATCH] insertData avec payment_type:', insertData.payment_type, 'is_instant:', insertData.is_instant);

    console.log('📤 [BATCH] Données à insérer:', JSON.stringify(insertData, null, 2));

    // Insertion dans Supabase
    const { data, error } = await supabase
      .from('scheduled_payments')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ [BATCH] Erreur Supabase:', JSON.stringify(error, null, 2));
      return res.status(500).json({ 
        error: error.message, 
        details: error,
        hint: 'Vérifiez que toutes les colonnes existent dans Supabase'
      });
    }

    console.log('✅ [BATCH] Paiement enregistré:', data.id);
    console.log(`   👥 ${beneficiariesNormalized.length} bénéficiaires`);
    console.log(`   💰 Montant total: ${insertData.amount}`);

    if (data?.id && data?.user_id) {
      const metadata = sanitizeMetadata({
        amount: insertData.amount,
        currency: insertData.token_symbol,
        frequency: finalPaymentType === 'recurring' ? 'monthly' : undefined
      });

      addTimelineEvent({
        payment_id: data.id,
        user_id: data.user_id,
        event_type: 'payment_created',
        event_label: 'Paiement créé',
        actor_type: 'user',
        actor_label: 'Vous',
        explanation: formatPaymentCreatedExplanation(req.body.label, req.body.category),
        metadata
      });

      if (finalStatus === 'pending') {
        addTimelineEvent({
          payment_id: data.id,
          user_id: data.user_id,
          event_type: 'payment_scheduled',
          event_label: 'Paiement programmé',
          actor_type: 'system',
          actor_label: 'Confidance',
          explanation: 'Paiement programmé selon la règle définie'
        });
      } else {
        addTimelineEvent({
          payment_id: data.id,
          user_id: data.user_id,
          event_type: 'payment_executed',
          event_label: 'Paiement exécuté',
          actor_type: 'system',
          actor_label: 'Confidance',
          explanation: 'Paiement exécuté avec succès',
          metadata: sanitizeMetadata({
            amount: insertData.amount,
            currency: insertData.token_symbol,
            gas_fee: req.body.gas_fee ?? 0,
            protocol_fee: req.body.protocol_fee ?? 0,
            payment_type: finalPaymentType,
            category: req.body.category ?? null,
            tx_hash: transaction_hash
          })
        });
      }
    }
    
    // 🆕 Notifier Albert via Payment Protocol (non bloquant)
    const { notifyPaymentCreated } = require('./services/paymentProtocol');
    notifyPaymentCreated(data).catch(err => {
      console.warn('⚠️ [PaymentProtocol] Notification échouée (non bloquant):', err.message);
    });
    
    res.json({ success: true, payment: data });

  } catch (error) {
    console.error('❌ [BATCH] Erreur serveur:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payments/:paymentId/timeline - Timeline d'un paiement
app.get('/api/payments/:paymentId/timeline', authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?.userId;

    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId requis' });
    }

    const { data: scheduledPayment, error: scheduledError } = await supabase
      .from('scheduled_payments')
      .select('id, user_id')
      .eq('id', paymentId)
      .maybeSingle();

    if (scheduledError && scheduledError.code !== 'PGRST116') {
      console.error('❌ Erreur recherche paiement:', scheduledError);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    let payment = scheduledPayment;

    if (!payment) {
      const { data: recurringPayment, error: recurringError } = await supabase
        .from('recurring_payments')
        .select('id, user_id')
        .eq('id', paymentId)
        .maybeSingle();

      if (recurringError && recurringError.code !== 'PGRST116') {
        console.error('❌ Erreur recherche paiement récurrent:', recurringError);
        return res.status(500).json({ error: 'Erreur lors de la récupération' });
      }

      payment = recurringPayment;
    }

    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    if (!payment.user_id || payment.user_id !== userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const { data: events, error: eventsError } = await supabase
      .from('payment_timeline_events')
      .select('event_type, event_label, actor_label, explanation, created_at, metadata')
      .eq('payment_id', paymentId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (eventsError) {
      console.error('❌ Erreur récupération timeline:', eventsError);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    return res.json(events || []);
  } catch (error) {
    console.error('❌ Erreur timeline:', error.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});


// GET /api/payments/:address - Liste des paiements d'un utilisateur (SIMPLE + RÉCURRENTS)
app.get('/api/payments/:address', async (req, res) => {
  console.log('🔥 ROUTE :address APPELÉE - params:', req.params, 'url:', req.url);
  try {
    const { address } = req.params;

    // Normaliser l'adresse en lowercase pour la comparaison
    const normalizedAddress = address.toLowerCase();
    console.log('📊 Liste paiements pour:', normalizedAddress);

    // ✅ ÉTAPE 1 : Charger les paiements SIMPLES/BATCH
    const { data: simplePayments, error: simpleError } = await supabase
      .from('scheduled_payments')
      .select('*')
      .or(`payer_address.ilike.${normalizedAddress},payee_address.ilike.${normalizedAddress}`)
      .order('created_at', { ascending: false });

    if (simpleError) {
      console.error('❌ Erreur scheduled_payments:', simpleError);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    // ✅ ÉTAPE 2 : Charger les paiements RÉCURRENTS
    const { data: recurringPayments, error: recurringError } = await supabase
      .from('recurring_payments')
      .select('*')
      .or(`payer_address.ilike.${normalizedAddress},payee_address.ilike.${normalizedAddress}`)
      .order('created_at', { ascending: false });

    if (recurringError) {
      console.error('⚠️ Erreur recurring_payments (non bloquant):', recurringError);
      // Ne pas bloquer si recurring échoue, juste logger
    }

    // ✅ ÉTAPE 3 : COMBINER les deux types avec flag is_recurring
    const allPayments = [
      // Paiements simples/batch (is_recurring = false)
      ...(simplePayments || []).map(p => {
        // ✅ FIX : Utiliser le payment_type de la DB, ou déterminer depuis is_instant
        let paymentType = p.payment_type;
        if (!paymentType || paymentType === null) {
          // Si payment_type n'est pas défini, le déterminer depuis is_instant
          paymentType = (p.is_instant === true || p.is_instant === 'true') ? 'instant' : 'scheduled';
        }
        
        return {
          ...p, 
          is_recurring: false,
          payment_type: paymentType // ✅ Utiliser le payment_type réel de la DB
        };
      }),
      // Paiements récurrents (is_recurring = true)
      ...(recurringPayments || []).map(p => {
        const isFirstMonthCustom = p.is_first_month_custom === true || p.is_first_month_custom === 'true';
        const displayAmount = isFirstMonthCustom && p.first_month_amount ? p.first_month_amount : p.monthly_amount;

        return { 
          ...p, 
          is_recurring: true,
          payment_type: 'recurring',
          // Mapper les champs pour compatibilité avec le frontend
          amount: displayAmount, // Afficher le montant du mois 1 si personnalisé
          release_time: p.first_payment_time // Le frontend attend "release_time"
        };
      })
    ];

    // ✅ ÉTAPE 4 : Trier par date de création (plus récent en premier)
    allPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log(`✅ ${simplePayments?.length || 0} paiement(s) simple(s) trouvé(s)`);
    console.log(`✅ ${recurringPayments?.length || 0} paiement(s) récurrent(s) trouvé(s)`);
    console.log(`📦 Total combiné: ${allPayments.length}`);

    res.json({ payments: allPayments });
  } catch (error) {
    console.error('❌ Erreur liste:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payments - Tous les paiements (pour admin/debug)
app.get('/api/payments', async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase.from('scheduled_payments').select('*');

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('release_time', { ascending: true });

    if (error) throw error;

    console.log(`📊 Paiements totaux: ${data?.length || 0}`);
    if (data && data.length > 0) {
      const batchCount = data.filter(p => p.is_batch === true).length;
      const singleCount = data.filter(p => p.is_batch !== true).length;
      console.log(`   📦 Simple: ${singleCount} | 🎁 Batch: ${batchCount}`);
    }

    res.json({ payments: data || [] });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🆕 PATCH /api/payments/:id - Mettre à jour un paiement (utilisé pour l'annulation)
app.patch('/api/payments/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancelled_at } = req.body;

    console.log('🔄 PATCH /api/payments/:id:', { id, status, cancelled_at });

    const updateData = { 
      updated_at: new Date().toISOString()
    };

    // Gérer le statut si fourni
    if (status) {
      const validStatuses = ['pending', 'released', 'cancelled', 'failed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: `Status invalide. Valeurs acceptées: ${validStatuses.join(', ')}` 
        });
      }
      updateData.status = status;
    }

    // Gérer cancelled_at si fourni
    if (cancelled_at) {
      updateData.cancelled_at = cancelled_at;
    }

    // Si le statut est 'released' et qu'il n'y a pas encore de released_at
    if (status === 'released' && !updateData.released_at) {
      updateData.released_at = new Date().toISOString();
    }

    // Si le statut est 'cancelled' et qu'il n'y a pas encore de cancelled_at
    if (status === 'cancelled' && !updateData.cancelled_at) {
      updateData.cancelled_at = new Date().toISOString();
    }

    console.log('📝 Données de mise à jour:', updateData);

    const { data, error } = await supabase
      .from('scheduled_payments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    console.log('✅ Paiement mis à jour:', { id: data.id, status: data.status, cancelled_at: data.cancelled_at });

    if (status && data?.id && data?.user_id) {
      const actor_type = req.user ? 'user' : 'system';
      const actor_label = req.user ? 'Vous' : 'Confidance';
      let eventPayload = null;

      if (status === 'cancelled') {
        eventPayload = {
          event_type: 'payment_cancelled',
          event_label: 'Paiement annulé',
          explanation: 'Paiement annulé'
        };
      } else if (status === 'released' || status === 'executed' || status === 'completed') {
        eventPayload = {
          event_type: 'payment_executed',
          event_label: 'Paiement exécuté',
          explanation: 'Paiement exécuté avec succès',
          metadata: sanitizeMetadata({
            amount: data.amount,
            currency: data.token_symbol,
            payment_type: data.payment_type || (data.is_instant ? 'instant' : 'scheduled'),
            category: req.body.category ?? null,
            tx_hash: req.body.execution_tx_hash || req.body.transaction_hash,
            gas_fee: req.body.gas_fee ?? 0,
            protocol_fee: req.body.protocol_fee ?? 0
          })
        };
      }

      if (eventPayload) {
        addTimelineEvent({
          payment_id: data.id,
          user_id: data.user_id,
          actor_type,
          actor_label,
          ...eventPayload
        });
      }
    }
    res.json({ success: true, payment: data });
  } catch (error) {
    console.error('❌ Erreur PATCH /api/payments/:id:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🆕 PUT /api/payments/:id/status - Mettre à jour le statut d'un paiement
app.put('/api/payments/:id/status', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log('🔄 Mise à jour statut:', { id, status });

    // Validation
    const validStatuses = ['pending', 'released', 'cancelled', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Status invalide. Valeurs acceptées: ${validStatuses.join(', ')}` 
      });
    }

    const updateData = { 
      status,
      updated_at: new Date().toISOString()
    };

    // Si le statut est 'released' ou 'cancelled', ajouter la date
    if (status === 'released') {
      updateData.released_at = new Date().toISOString();
    }
    
    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('scheduled_payments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    console.log('✅ Statut mis à jour:', data.id);

    if (status && data?.id && data?.user_id) {
      const actor_type = req.user ? 'user' : 'system';
      const actor_label = req.user ? 'Vous' : 'Confidance';
      let eventPayload = null;

      if (status === 'cancelled') {
        eventPayload = {
          event_type: 'payment_cancelled',
          event_label: 'Paiement annulé',
          explanation: 'Paiement annulé'
        };
      } else if (status === 'released' || status === 'executed' || status === 'completed') {
        eventPayload = {
          event_type: 'payment_executed',
          event_label: 'Paiement exécuté',
          explanation: 'Paiement exécuté avec succès',
          metadata: sanitizeMetadata({
            amount: data.amount,
            currency: data.token_symbol,
            payment_type: data.payment_type || (data.is_instant ? 'instant' : 'scheduled'),
            category: req.body.category ?? null,
            tx_hash: req.body.execution_tx_hash || req.body.transaction_hash,
            gas_fee: req.body.gas_fee ?? 0,
            protocol_fee: req.body.protocol_fee ?? 0
          })
        };
      }

      if (eventPayload) {
        addTimelineEvent({
          payment_id: data.id,
          user_id: data.user_id,
          actor_type,
          actor_label,
          ...eventPayload
        });
      }
    }

    res.json({ success: true, payment: data });
  } catch (error) {
    console.error('❌ Erreur mise à jour statut:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🆕 DELETE /api/payments/:id/remove - Supprimer un paiement du dashboard
app.delete('/api/payments/:id/remove', async (req, res) => {
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
      .from('scheduled_payments')
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

    const allowedStatuses = ['released', 'cancelled', 'failed'];
    if (!allowedStatuses.includes(payment.status)) {
      return res.status(400).json({ error: 'Paiement non supprimable' });
    }

    const { error: deleteError } = await supabase
      .from('scheduled_payments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Erreur Supabase delete scheduled:', deleteError);
      return res.status(500).json({ error: 'Erreur lors de la suppression' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur DELETE /api/payments/:id/remove:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 🆕 ROUTES BÉNÉFICIAIRES
const beneficiariesRoutes = require('./routes/beneficiaries');
app.use('/api/beneficiaries', beneficiariesRoutes);

// 🆕 ROUTES PAIEMENTS RÉCURRENTS
app.use('/api/payments/recurring', recurringPaymentsRoutes); // ✅ AJOUTÉ

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`\n✅ API Backend démarrée sur http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 Endpoints disponibles:`);
  console.log(`   POST /api/auth/register         - Inscription`);
  console.log(`   POST /api/auth/login            - Connexion`);
  console.log(`   POST /api/auth/verify           - Vérifier email`);
  console.log(`   GET  /api/users/profile         - Profil utilisateur`);
  console.log(`   POST /api/chat                  - Envoyer message au Chat Agent`);
  console.log(`   GET  /api/chat/health           - Vérifier disponibilité Chat Agent`);
  console.log(`   POST /api/ai/advisor/explain    - IA conseillère explicative`);
  console.log(`   POST /api/payments              - Paiement simple`);
  console.log(`   POST /api/payments/batch        - Paiement batch`);
    console.log(`   GET  /api/payments/:address     - Liste paiements utilisateur`);
    console.log(`   GET  /api/payments              - Tous les paiements`);
    console.log(`   PATCH /api/payments/:id         - Mise à jour paiement (annulation)`);
    console.log(`   PUT  /api/payments/:id/status   - Mise à jour statut`);
  console.log(`   GET  /api/beneficiaries/:wallet - Liste bénéficiaires`);
  console.log(`   POST /api/beneficiaries         - Créer bénéficiaire`);
  console.log(`   PUT  /api/beneficiaries/:id     - Modifier bénéficiaire`);
  console.log(`   DELETE /api/beneficiaries/:id   - Supprimer bénéficiaire`);
  // ✅ AJOUTÉ - Routes récurrentes
  console.log(`   POST /api/payments/recurring              - Créer paiement récurrent`);
  console.log(`   GET  /api/payments/recurring/:wallet      - Liste paiements récurrents`);
  console.log(`   GET  /api/payments/recurring/id/:id       - Détails paiement récurrent`);
  console.log(`   PATCH /api/payments/recurring/:id         - Mettre à jour récurrent`);
  console.log(`   DELETE /api/payments/recurring/:id        - Annuler récurrent`);
  console.log(`   GET  /api/payments/recurring/stats/:wallet - Stats récurrents`);
  console.log(`   POST /api/payment-transactions            - Enregistrer frais de gas`);
  console.log(`   GET  /api/payment-transactions/:id/:type  - Récupérer frais de gas\n`);
   console.log(`   POST /api/liquidity/create                - Créer position liquidité`);
  console.log(`   GET  /api/liquidity/position/:address     - Récupérer position active`);
  console.log(`   POST /api/liquidity/repay                 - Rembourser dette`);
  console.log(`   POST /api/liquidity/add-collateral        - Ajouter ETH collatéral`);
  console.log(`   POST /api/liquidity/close                 - Clôturer position`);
  console.log(`   GET  /api/liquidity/events/:positionId    - Historique événements`);
  console.log(`   GET  /api/liquidity/health/:positionId    - Health factor temps réel`);
  console.log(`   GET  /api/liquidity/calculate             - Calculer montants`);
});
// ============================================================
// 🆕 ROUTES LIQUIDITÉ - AJOUTÉ POUR LA FONCTIONNALITÉ LIQUIDITÉ
// ============================================================
const liquidityRoutes = require('./routes/liquidity');
app.use('/api/liquidity', liquidityRoutes);

// ============================================================
// 🆕 KEEPER SERVICE - SURVEILLANCE AUTOMATIQUE DES POSITIONS DE LIQUIDITÉ
// ============================================================
const keeperService = require('./services/keeperService');

// Lancer la surveillance toutes les 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('🤖 [LIQUIDITY KEEPER] Running position monitoring...');
  try {
    await keeperService.monitorAllPositions();
    console.log('✅ [LIQUIDITY KEEPER] Monitoring complete');
  } catch (error) {
    console.error('❌ [LIQUIDITY KEEPER] Monitoring failed:', error.message);
  }
});

console.log('✅ Liquidity keeper scheduled (every 5 minutes)');

// Relevés mensuels : 1er de chaque mois à 9h00
const { scheduleMonthlyStatements } = require('./jobs/monthlyStatementJob');
scheduleMonthlyStatements();

// Optionnel : Exécuter immédiatement au démarrage (après 30 secondes)
setTimeout(async () => {
  console.log('🚀 [LIQUIDITY KEEPER] Initial monitoring run...');
  try {
    await keeperService.monitorAllPositions();
    console.log('✅ [LIQUIDITY KEEPER] Initial monitoring complete');
  } catch (error) {
    console.error('❌ [LIQUIDITY KEEPER] Initial monitoring failed:', error.message);
  }
}, 30000);


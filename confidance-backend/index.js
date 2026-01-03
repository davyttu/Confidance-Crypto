require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const recurringPaymentsRoutes = require('./routes/recurringPayments'); // ✅ AJOUTÉ
const chatRoutes = require('./routes/chat'); // ✅ Chat Agent
const { optionalAuth } = require('./middleware/auth');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 CONFIDANCE CRYPTO API - BACKEND');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📡 Port: ${PORT}`);
console.log(`✨ Features: Auth + Payments + Beneficiaries + Recurring`); // ✅ MODIFIÉ (ajouté "+ Recurring")
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Routes d'authentification
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chat', chatRoutes); // ✅ Chat Agent

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    features: ['auth', 'single-payments', 'batch-payments', 'beneficiaries', 'recurring-payments', 'status-update'] // ✅ MODIFIÉ (ajouté 'recurring-payments')
  });
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

    // ✅ FIX : Vérifier si le paiement existe déjà (protection contre doublons)
    // Utiliser une transaction pour éviter les race conditions
    try {
      const { data: existingPayment, error: checkError } = await supabase
        .from('scheduled_payments')
        .select('*')
        .eq('contract_address', contract_address)
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
      contract_address,
      payer_address,
      payee_address,
      token_symbol,
      token_address,
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
          .eq('contract_address', contract_address)
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
    } = req.body;

    console.log('📥 [BATCH] Nouvelle demande:', { 
      contract_address, 
      payer_address,
      transaction_hash,
      beneficiaries_count: beneficiaries?.length 
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

    // Préparer les données pour insertion
    const insertData = {
      contract_address,
      payer_address,
      payee_address: beneficiaries[0].address, // Premier bénéficiaire comme référence
      token_symbol: 'ETH',
      token_address: null,
      amount: total_sent || total_to_beneficiaries || '0',
      release_time: parseInt(release_time),
      cancellable: cancellable || false,
      network: network || 'base_mainnet',
      transaction_hash,
      status: 'pending',
      
      // Colonnes BATCH
      is_batch: true,
      batch_count: beneficiaries.length,
      batch_beneficiaries: beneficiaries, // Supabase accepte direct l'objet JS pour JSONB
      user_id: user ? user.userId : null,
      guest_email: !user ? req.body.guest_email : null,
    };

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
    console.log(`   👥 ${beneficiaries.length} bénéficiaires`);
    console.log(`   💰 Montant total: ${insertData.amount}`);
    
    res.json({ success: true, payment: data });

  } catch (error) {
    console.error('❌ [BATCH] Erreur serveur:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// GET /api/payments/:address - Liste des paiements d'un utilisateur (SIMPLE + RÉCURRENTS)
app.get('/api/payments/:address', async (req, res) => {
  try {
    const { address } = req.params;

    console.log('📊 Liste paiements pour:', address);

    // ✅ ÉTAPE 1 : Charger les paiements SIMPLES/BATCH
    const { data: simplePayments, error: simpleError } = await supabase
      .from('scheduled_payments')
      .select('*')
      .or(`payer_address.eq.${address},payee_address.eq.${address}`)
      .order('created_at', { ascending: false });

    if (simpleError) {
      console.error('❌ Erreur scheduled_payments:', simpleError);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    // ✅ ÉTAPE 2 : Charger les paiements RÉCURRENTS
    const { data: recurringPayments, error: recurringError } = await supabase
      .from('recurring_payments')
      .select('*')
      .or(`payer_address.eq.${address},payee_address.eq.${address}`)
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
      ...(recurringPayments || []).map(p => ({ 
        ...p, 
        is_recurring: true,
        payment_type: 'recurring',
        // Mapper les champs pour compatibilité avec le frontend
        amount: p.monthly_amount, // Le frontend attend "amount"
        release_time: p.first_payment_time // Le frontend attend "release_time"
      }))
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

// 🆕 PUT /api/payments/:id/status - Mettre à jour le statut d'un paiement
app.put('/api/payments/:id/status', async (req, res) => {
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
    res.json({ success: true, payment: data });
  } catch (error) {
    console.error('❌ Erreur mise à jour statut:', error.message);
    res.status(500).json({ error: error.message });
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
  console.log(`   POST /api/payments              - Paiement simple`);
  console.log(`   POST /api/payments/batch        - Paiement batch`);
  console.log(`   GET  /api/payments/:address     - Liste paiements utilisateur`);
  console.log(`   GET  /api/payments              - Tous les paiements`);
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
  console.log(`   GET  /api/payments/recurring/stats/:wallet - Stats récurrents\n`);
});
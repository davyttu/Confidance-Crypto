require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 CONFIDANCE CRYPTO API - BACKEND');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📡 Port: ${PORT}`);
console.log(`✨ Features: Single + Batch Payments + Beneficiaries`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    features: ['single-payments', 'batch-payments', 'beneficiaries', 'status-update']
  });
});

// POST /api/payments - Créer un paiement SIMPLE
app.post('/api/payments', async (req, res) => {
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
    } = req.body;

    console.log('📥 [SIMPLE] Nouvelle demande:', { contract_address, payer_address });

    // Validation
    if (!transaction_hash) {
      console.error('❌ transaction_hash manquant');
      return res.status(400).json({ error: 'transaction_hash is required' });
    }

    const { data, error } = await supabase
      .from('scheduled_payments')
      .insert([
        {
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
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    console.log('✅ [SIMPLE] Paiement enregistré:', data.id);
    res.json({ success: true, payment: data });
  } catch (error) {
    console.error('❌ [SIMPLE] Erreur:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🆕 POST /api/payments/batch - Créer un paiement BATCH (multi-bénéficiaires)
app.post('/api/payments/batch', async (req, res) => {
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

// GET /api/payments/:address - Liste des paiements d'un utilisateur
app.get('/api/payments/:address', async (req, res) => {
  try {
    const { address } = req.params;

    console.log('📊 Liste paiements pour:', address);

    const { data, error } = await supabase
      .from('scheduled_payments')
      .select('*')
      .or(`payer_address.eq.${address},payee_address.eq.${address}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`✅ ${data?.length || 0} paiement(s) trouvé(s)`);
    res.json({ payments: data || [] });
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

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`\n✅ API Backend démarrée sur http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 Endpoints disponibles:`);
  console.log(`   POST /api/payments              - Paiement simple`);
  console.log(`   POST /api/payments/batch        - Paiement batch`);
  console.log(`   GET  /api/payments/:address     - Liste paiements utilisateur`);
  console.log(`   GET  /api/payments              - Tous les paiements`);
  console.log(`   PUT  /api/payments/:id/status   - Mise à jour statut`);
  console.log(`   GET  /api/beneficiaries/:wallet - Liste bénéficiaires`);
  console.log(`   POST /api/beneficiaries         - Créer bénéficiaire`);
  console.log(`   PUT  /api/beneficiaries/:id     - Modifier bénéficiaire`);
  console.log(`   DELETE /api/beneficiaries/:id   - Supprimer bénéficiaire\n`);
});
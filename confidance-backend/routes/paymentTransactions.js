// routes/paymentTransactions.js
// Routes pour enregistrer les frais de gas des paiements
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * POST /api/payment-transactions
 * Enregistrer une transaction individuelle (approbation ou création)
 *
 * Body:
 * {
 *   scheduled_payment_id: string (UUID du paiement dans scheduled_payments)
 *   user_address: string (adresse wallet de l'utilisateur)
 *   chain_id: number (ID de la blockchain)
 *   tx_hash: string (hash de la transaction)
 *   tx_type: 'approve' | 'create' | 'execute' (type de transaction)
 *   token_address: string | null (adresse du token, null pour ETH natif)
 *   gas_used: string (gas utilisé)
 *   gas_price: string (prix du gas)
 *   gas_cost_native: string (coût total en wei)
 *   gas_cost_usd: number (coût en USD, optionnel)
 * }
 */
router.post('/', async (req, res) => {
  try {
    const {
      scheduled_payment_id,
      user_address,
      chain_id,
      tx_hash,
      tx_type,
      token_address,
      gas_used,
      gas_price,
      gas_cost_native,
      gas_cost_usd
    } = req.body;

    console.log('📥 [PAYMENT_TRANSACTIONS] Nouvelle transaction:', {
      scheduled_payment_id,
      user_address,
      tx_hash,
      tx_type,
      chain_id
    });

    // Validations
    if (!scheduled_payment_id) {
      return res.status(400).json({ error: 'scheduled_payment_id requis' });
    }
    if (!user_address) {
      return res.status(400).json({ error: 'user_address requis' });
    }
    if (!tx_hash) {
      return res.status(400).json({ error: 'tx_hash requis' });
    }
    if (!tx_type || !['approve', 'create', 'execute'].includes(tx_type)) {
      return res.status(400).json({ error: 'tx_type doit être "approve", "create" ou "execute"' });
    }
    if (!gas_used) {
      return res.status(400).json({ error: 'gas_used requis' });
    }
    if (!gas_price) {
      return res.status(400).json({ error: 'gas_price requis' });
    }
    if (!gas_cost_native) {
      return res.status(400).json({ error: 'gas_cost_native requis' });
    }

    // Vérifier si la transaction existe déjà (par tx_hash unique)
    const { data: existing, error: checkError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('tx_hash', tx_hash)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Erreur vérification doublon:', checkError);
    }

    if (existing) {
      console.log('ℹ️ [PAYMENT_TRANSACTIONS] Transaction déjà enregistrée:', tx_hash);
      return res.json({
        success: true,
        id: existing.id,
        alreadyExists: true
      });
    }

    // Préparer les données pour insertion
    const insertData = {
      scheduled_payment_id,
      user_address,
      chain_id: chain_id || 8453,
      tx_hash,
      tx_type,
      token_address: token_address || null,
      gas_used,
      gas_price,
      gas_cost_native,
      gas_cost_usd: gas_cost_usd || 0
    };

    console.log('📤 [PAYMENT_TRANSACTIONS] Données à insérer:', JSON.stringify(insertData, null, 2));

    // Insérer dans Supabase
    const { data, error } = await supabase
      .from('payment_transactions')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ [PAYMENT_TRANSACTIONS] Erreur Supabase:', JSON.stringify(error, null, 2));

      // Gérer l'erreur de doublon par tx_hash
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('tx_hash')) {
        console.log('ℹ️ [PAYMENT_TRANSACTIONS] Doublon détecté (tx_hash), récupération...');
        const { data: existingData } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('tx_hash', tx_hash)
          .single();

        if (existingData) {
          return res.json({
            success: true,
            id: existingData.id,
            alreadyExists: true
          });
        }
      }

      return res.status(500).json({
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
    }

    console.log('✅ [PAYMENT_TRANSACTIONS] Transaction enregistrée:', data.id);
    res.status(201).json({
      success: true,
      id: data.id
    });

  } catch (error) {
    console.error('❌ [PAYMENT_TRANSACTIONS] Erreur serveur:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payment-transactions/:paymentId
 * Récupérer toutes les transactions (approbation + création) pour un paiement
 */
router.get('/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('scheduled_payment_id', paymentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Erreur récupération transactions:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Aucune transaction trouvée pour ce paiement' });
    }

    // Calculer le total des frais
    const totalGasCost = data.reduce((sum, tx) => {
      return sum + BigInt(tx.gas_cost_native);
    }, BigInt(0));

    res.json({
      success: true,
      transactions: data,
      total_gas_cost_native: totalGasCost.toString(),
      transaction_count: data.length
    });

  } catch (error) {
    console.error('❌ Erreur GET payment-transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;











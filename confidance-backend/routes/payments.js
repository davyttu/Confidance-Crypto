// routes/payments.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Générer un ticket number unique
 */
function generateTicketNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CONF-${timestamp}-${random}`;
}

/**
 * POST /api/payments
 * Créer un paiement simple (ETH ou ERC20)
 */
router.post('/', async (req, res) => {
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
      user_id,        // ✅ Fourni si utilisateur connecté
      guest_email     // ✅ Fourni si utilisateur invité
    } = req.body;

    // Validations de base
    if (!contract_address || !payer_address || !payee_address || !amount || !release_time) {
      return res.status(400).json({ error: 'Champs requis manquants' });
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

    // Enregistrer dans Supabase
    const { data: payment, error } = await supabase
      .from('scheduled_payments')
      .insert({
        contract_address,
        payer_address,
        payee_address,
        token_symbol: token_symbol || 'ETH',
        token_address,
        amount,
        release_time,
        cancellable: cancellable || false,
        network: network || 'base_mainnet',
        transaction_hash,
        user_id: user_id || null,
        guest_email: guest_email || null,
        ticket_number,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
    }

    console.log('✅ Paiement enregistré:', payment.id);

    res.status(201).json({
      success: true,
      payment,
      ticket_number // Retourner le ticket si invité
    });

  } catch (error) {
    console.error('❌ Erreur /api/payments:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/payments/batch
 * Créer un batch payment (plusieurs bénéficiaires)
 */
router.post('/batch', async (req, res) => {
  try {
    const {
      contract_address,
      payer_address,
      beneficiaries,           // Array: [{ address, amount, name }]
      total_to_beneficiaries,
      protocol_fee,
      total_sent,
      release_time,
      cancellable,
      network,
      transaction_hash,
      user_id,
      guest_email
    } = req.body;

    // Validations
    if (!contract_address || !payer_address || !beneficiaries || beneficiaries.length === 0) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    // Ticket si invité
    let ticket_number = null;
    if (!user_id) {
      if (!guest_email) {
        return res.status(400).json({ 
          error: 'Email requis pour les utilisateurs invités' 
        });
      }
      ticket_number = generateTicketNumber();
    }

    // Créer un paiement par bénéficiaire
    const paymentsToInsert = beneficiaries.map(beneficiary => ({
      contract_address,
      payer_address,
      payee_address: beneficiary.address,
      token_symbol: 'ETH',
      amount: beneficiary.amount,
      release_time,
      cancellable: cancellable || false,
      network: network || 'base_mainnet',
      transaction_hash,
      user_id: user_id || null,
      guest_email: guest_email || null,
      ticket_number,
      status: 'pending'
    }));

    const { data: payments, error } = await supabase
      .from('scheduled_payments')
      .insert(paymentsToInsert)
      .select();

    if (error) {
      console.error('❌ Erreur Supabase batch:', error);
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
    }

    console.log(`✅ ${payments.length} paiements batch enregistrés`);

    res.status(201).json({
      success: true,
      payments,
      ticket_number
    });

  } catch (error) {
    console.error('❌ Erreur /api/payments/batch:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/payments/:walletAddress
 * Récupérer TOUS les paiements d'un wallet (simples + récurrents)
 * 
 * ✅ MODIFIÉ : Combine scheduled_payments + recurring_payments
 */
router.get('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Adresse wallet requise' });
    }

    console.log('📊 Liste paiements pour:', walletAddress);

    // ✅ ÉTAPE 1 : Charger les paiements SIMPLES/BATCH
    const { data: simplePayments, error: simpleError } = await supabase
      .from('scheduled_payments')
      .select('*')
      .or(`payer_address.eq.${walletAddress},payee_address.eq.${walletAddress}`)
      .order('created_at', { ascending: false });

    if (simpleError) {
      console.error('❌ Erreur scheduled_payments:', simpleError);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    // ✅ ÉTAPE 2 : Charger les paiements RÉCURRENTS
    const { data: recurringPayments, error: recurringError } = await supabase
      .from('recurring_payments')
      .select('*')
      .or(`payer_address.eq.${walletAddress},payee_address.eq.${walletAddress}`)
      .order('created_at', { ascending: false });

    if (recurringError) {
      console.error('⚠️ Erreur recurring_payments (non bloquant):', recurringError);
      // Ne pas bloquer si recurring échoue, juste logger
    }

    // ✅ ÉTAPE 3 : COMBINER les deux types avec flag is_recurring
    const allPayments = [
      // Paiements simples/batch (is_recurring = false)
      ...(simplePayments || []).map(p => ({ 
        ...p, 
        is_recurring: false,
        payment_type: 'simple' 
      })),
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

    res.json({
      success: true,
      payments: allPayments
    });

  } catch (error) {
    console.error('❌ Erreur /api/payments/:wallet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
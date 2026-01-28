// routes/paymentLinks.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { createNotification } = require('../services/notificationService');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function generatePaymentLinkId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}${rand}`.toLowerCase();
}

function validatePayload(body) {
  const {
    creator,
    amount,
    token,
    payment_type,
    chain_id,
    execute_at,
    frequency,
    periods,
    start_at,
    first_month_amount,
  } = body;

  if (!creator || !amount || !token || !payment_type || !chain_id) {
    return 'Missing required fields';
  }

  if (payment_type === 'scheduled' && !execute_at) {
    return 'Missing execute_at for scheduled payment';
  }

  if (payment_type === 'recurring') {
    if (!periods) {
      return 'Missing recurring fields';
    }
  }

  if (first_month_amount && Number(first_month_amount) <= 0) {
    return 'Invalid first_month_amount';
  }

  return null;
}

// POST /api/payment-links
router.post('/', async (req, res) => {
  try {
    const errorMessage = validatePayload(req.body);
    if (errorMessage) {
      return res.status(400).json({ error: errorMessage });
    }

    const {
      creator,
      amount,
      first_month_amount,
      is_first_month_custom,
      token,
      token_address,
      payment_type,
      frequency,
      periods,
      start_at,
      execute_at,
      chain_id,
      description,
      payment_label,
      payment_category,
      payment_categorie,
      label,
      category,
      categorie,
      device_id,
      user_agent,
      ip_address,
    } = req.body;

    const paymentLinkId = generatePaymentLinkId();
    const creatorAddress = String(creator).toLowerCase();
    const normalizedLabel =
      typeof payment_label === 'string'
        ? payment_label.trim()
        : typeof label === 'string'
        ? label.trim()
        : '';
    const normalizedCategory =
      typeof payment_categorie === 'string'
        ? payment_categorie.trim()
        : typeof payment_category === 'string'
        ? payment_category.trim()
        : typeof categorie === 'string'
        ? categorie.trim()
        : typeof category === 'string'
        ? category.trim()
        : '';

    const normalizedFrequency = payment_type === 'recurring'
      ? (frequency || 'monthly')
      : frequency || null;

    const { data: paymentLink, error } = await supabase
      .from('payment_links')
      .insert({
        id: paymentLinkId,
        creator_address: creatorAddress,
        amount: String(amount),
        first_month_amount: first_month_amount ? String(first_month_amount) : null,
        is_first_month_custom: !!is_first_month_custom,
        token_symbol: token,
        token_address: token_address || null,
        payment_type,
        frequency: normalizedFrequency,
        periods: periods ? Number(periods) : null,
        start_at: start_at ? Number(start_at) : null,
        execute_at: execute_at ? Number(execute_at) : null,
        chain_id: Number(chain_id),
        description: description || null,
        payment_label: normalizedLabel || null,
        payment_categorie: normalizedCategory || null,
        status: 'pending',
        device_id: device_id || null,
        user_agent: user_agent || null,
        ip_address: ip_address || null,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error (payment_links insert):', error);
      return res.status(500).json({ error: 'Failed to create payment link' });
    }

    return res.status(201).json({ success: true, paymentLink });
  } catch (err) {
    console.error('❌ /api/payment-links error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payment-links/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase error (payment_links fetch):', error);
      return res.status(500).json({ error: 'Failed to fetch payment link' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    return res.json({ paymentLink: data });
  } catch (err) {
    console.error('❌ /api/payment-links/:id error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payment-links?creator=0x...
router.get('/', async (req, res) => {
  try {
    const { creator } = req.query;

    if (!creator) {
      return res.status(400).json({ error: 'Missing creator' });
    }

    const { data, error } = await supabase
      .from('payment_links')
      .select('*')
      .ilike('creator_address', creator)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase error (payment_links list):', error);
      return res.status(500).json({ error: 'Failed to list payment links' });
    }

    return res.json({ paymentLinks: data || [] });
  } catch (err) {
    console.error('❌ /api/payment-links list error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/payment-links/:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payer_address } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Missing status' });
    }

    // Récupérer les infos du lien AVANT la mise à jour pour vérifier l'ancien statut
    const { data: oldLink, error: fetchError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('❌ Erreur récupération lien:', fetchError);
    }

    const { data, error } = await supabase
      .from('payment_links')
      .update({
        status,
        payer_address: payer_address ? String(payer_address).toLowerCase() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error (payment_links update):', error);
      return res.status(500).json({ error: 'Failed to update payment link' });
    }

    // 🔔 NOTIFICATION: Si le statut passe à "paid" ou "completed", notifier le créateur
    console.log(`🔍 [NOTIF DEBUG] Ancien statut: ${oldLink?.status}, Nouveau statut: ${status}`);

    if (oldLink && (status === 'paid' || status === 'completed') && oldLink.status !== status) {
      console.log(`✅ [NOTIF DEBUG] Conditions remplies, création de notification...`);

      const creatorAddress = data.creator_address; // ✅ CORRIGÉ: utiliser creator_address
      console.log(`🔍 [NOTIF DEBUG] Adresse créateur: ${creatorAddress}`);

      // Normaliser l'adresse en lowercase
      const creatorAddressLower = creatorAddress.toLowerCase();
      console.log(`🔍 [NOTIF DEBUG] Adresse normalisée: ${creatorAddressLower}`);

      // Récupérer l'user_id du créateur depuis la table user_wallets (support multi-wallets)
      const { data: walletData, error: walletError } = await supabase
        .from('user_wallets')
        .select('user_id')
        .eq('wallet_address', creatorAddressLower)
        .maybeSingle();

      console.log(`🔍 [NOTIF DEBUG] Recherche wallet:`, { walletData, walletError });

      if (!walletData && !walletError) {
        console.log(`⚠️ [NOTIF DEBUG] Wallet non trouvé dans user_wallets, tentative avec users.primary_wallet (legacy)`);

        // Fallback : essayer avec l'ancienne méthode (users.primary_wallet)
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, primary_wallet')
          .eq('primary_wallet', creatorAddressLower)
          .maybeSingle();

        console.log(`🔍 [NOTIF DEBUG] Recherche user (legacy):`, { userData, userError });

        if (userData) {
          walletData = { user_id: userData.id };
        }
      }

      const userId = walletData?.user_id;

      if (!userId) {
        console.error(`⚠️ Créateur ${creatorAddress} non trouvé dans la base (ni user_wallets ni users.primary_wallet)`);
        return res.json({ paymentLink: data });
      }

      // Récupérer les infos de l'utilisateur
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single();

      console.log(`🔍 [NOTIF DEBUG] User trouvé:`, { userData, userError });

      if (!userError && userData) {
        console.log(`✅ [NOTIF DEBUG] User trouvé: ${userData.email} (ID: ${userData.id})`);

        const payerShort = payer_address
          ? `${payer_address.slice(0, 6)}...${payer_address.slice(-4)}`
          : 'Un utilisateur';

        const label = data.description || 'Paiement sans nom';
        const amount = data.amount;
        const token = data.token_symbol || 'ETH';

        console.log(`📝 [NOTIF DEBUG] Création notification:`, {
          userId: userData.id,
          title: '💰 Lien de paiement validé !',
          message: `${payerShort} a payé votre lien "${label}" de ${amount} ${token}.`
        });

        // Créer la notification
        const notifResult = await createNotification(
          userData.id,
          'payment',
          '💰 Lien de paiement validé !',
          `${payerShort} a payé votre lien "${label}" de ${amount} ${token}.`
        );

        console.log(`🔔 [NOTIF DEBUG] Résultat création:`, notifResult);

        if (notifResult.success) {
          console.log(`✅ Notification envoyée au créateur (user ${userData.id}) pour le lien ${id}`);
        } else {
          console.error(`❌ Échec création notification:`, notifResult.error);
        }
      } else {
        console.error(`⚠️ User non trouvé pour le créateur ${creatorAddress}`);
        console.error(`🔍 [NOTIF DEBUG] userError:`, userError);
      }
    } else {
      console.log(`⏭️ [NOTIF DEBUG] Conditions non remplies pour notification`);
      console.log(`   - oldLink existe: ${!!oldLink}`);
      console.log(`   - status paid/completed: ${status === 'paid' || status === 'completed'}`);
      console.log(`   - statut changé: ${oldLink?.status !== status}`);
    }

    return res.json({ paymentLink: data });
  } catch (err) {
    console.error('❌ /api/payment-links/:id patch error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

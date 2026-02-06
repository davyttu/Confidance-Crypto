// routes/users.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/users/wallets
 * Récupérer tous les wallets associés à l'utilisateur
 */
router.get('/wallets', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    const { data: wallets, error } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error) {
      console.error('Error fetching wallets:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération des wallets' });
    }

    res.json({ wallets: wallets || [] });

  } catch (error) {
    console.error('Get wallets error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/users/wallets
 * Associer un nouveau wallet à l'utilisateur
 */
router.post('/wallets', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { walletAddress } = req.body;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: 'Adresse wallet invalide' });
    }

    // Vérifier si le wallet est déjà associé à un autre utilisateur
    const { data: existingWallet } = await supabase
      .from('user_wallets')
      .select('user_id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (existingWallet && existingWallet.user_id !== userId) {
      return res.status(409).json({ error: 'Ce wallet est déjà associé à un autre compte' });
    }

    if (existingWallet && existingWallet.user_id === userId) {
      return res.status(409).json({ error: 'Ce wallet est déjà associé à votre compte' });
    }

    // Vérifier combien de wallets l'utilisateur a déjà
    const { data: userWallets, error: countError } = await supabase
      .from('user_wallets')
      .select('id')
      .eq('user_id', userId);

    if (countError) {
      console.error('Error counting wallets:', countError);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    const isPrimary = userWallets.length === 0; // Premier wallet = primary

    // Ajouter le wallet
    const { data: newWallet, error } = await supabase
      .from('user_wallets')
      .insert({
        user_id: userId,
        wallet_address: walletAddress.toLowerCase(),
        is_primary: isPrimary
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding wallet:', error);
      return res.status(500).json({ error: 'Erreur lors de l\'ajout du wallet' });
    }

    res.status(201).json({
      success: true,
      message: 'Wallet associé avec succès',
      wallet: newWallet
    });

  } catch (error) {
    console.error('Add wallet error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/users/wallets/:address
 * Retirer un wallet de l'utilisateur
 */
router.delete('/wallets/:address', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { address } = req.params;

    // Vérifier que ce wallet appartient bien à cet utilisateur
    const { data: wallet, error: fetchError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('wallet_address', address.toLowerCase())
      .single();

    if (fetchError || !wallet) {
      return res.status(404).json({ error: 'Wallet non trouvé' });
    }

    // Ne pas supprimer le wallet primary si c'est le seul
    if (wallet.is_primary) {
      const { data: allWallets } = await supabase
        .from('user_wallets')
        .select('id')
        .eq('user_id', userId);

      if (allWallets && allWallets.length === 1) {
        return res.status(400).json({ error: 'Vous devez avoir au moins un wallet associé' });
      }
    }

    // Supprimer le wallet
    const { error } = await supabase
      .from('user_wallets')
      .delete()
      .eq('id', wallet.id);

    if (error) {
      console.error('Error deleting wallet:', error);
      return res.status(500).json({ error: 'Erreur lors de la suppression' });
    }

    res.json({ success: true, message: 'Wallet retiré avec succès' });

  } catch (error) {
    console.error('Delete wallet error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/users/wallets/:address/primary
 * Définir un wallet comme principal
 */
router.put('/wallets/:address/primary', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { address } = req.params;

    // Vérifier que ce wallet appartient à cet utilisateur
    const { data: wallet, error: fetchError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('wallet_address', address.toLowerCase())
      .single();

    if (fetchError || !wallet) {
      return res.status(404).json({ error: 'Wallet non trouvé' });
    }

    // Retirer le flag primary de tous les wallets
    await supabase
      .from('user_wallets')
      .update({ is_primary: false })
      .eq('user_id', userId);

    // Définir ce wallet comme primary
    const { error } = await supabase
      .from('user_wallets')
      .update({ is_primary: true })
      .eq('id', wallet.id);

    if (error) {
      console.error('Error setting primary wallet:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }

    res.json({ success: true, message: 'Wallet principal mis à jour' });

  } catch (error) {
    console.error('Set primary wallet error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/users/preferences
 * Récupérer les préférences UI de l'utilisateur
 */
const fetchPreferences = async (tableName, userId) => {
  return supabase
    .from(tableName)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
};

const upsertPreferences = async (tableName, payload) => {
  return supabase
    .from(tableName)
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();
};

router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    let { data, error } = await fetchPreferences('user_ui_preferences', userId);
    if (error && error.code === 'PGRST205') {
      ({ data, error } = await fetchPreferences('user_preferences', userId));
    }

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching preferences:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération des préférences' });
    }

    const prefs = data || {};
    if (!prefs.locale) {
      const { data: userRow } = await supabase.from('users').select('locale').eq('id', userId).single();
      if (userRow?.locale) prefs.locale = userRow.locale;
    }
    res.json({ preferences: prefs });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/users/preferences
 * Mettre à jour les préférences UI de l'utilisateur
 */
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { analytics_year, analytics_month, locale } = req.body;

    if (locale !== undefined && ['fr', 'en', 'es', 'ru', 'zh'].includes(locale)) {
      await supabase.from('users').update({ locale, updated_at: new Date().toISOString() }).eq('id', userId);
    }

    let { data: existing } = await fetchPreferences('user_ui_preferences', userId);
    const payload = {
      user_id: userId,
      ...(existing || {}),
      updated_at: new Date().toISOString(),
    };
    if (analytics_year !== undefined) payload.analytics_year = analytics_year;
    if (analytics_month !== undefined) payload.analytics_month = analytics_month;
    if (locale !== undefined) payload.locale = locale;
    delete payload.id;

    let { data, error } = await upsertPreferences('user_ui_preferences', payload);
    if (error && error.code === 'PGRST205') {
      ({ data, error } = await upsertPreferences('user_preferences', payload));
    }

    if (error) {
      console.error('Error saving preferences:', error);
      return res.status(500).json({ error: 'Erreur lors de la sauvegarde des préférences' });
    }

    res.json({ success: true, preferences: data });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/users/profile
 * Récupérer le profil complet de l'utilisateur
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    // Récupérer utilisateur
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, account_type, email_verified, kyc_verified, created_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Récupérer wallets
    const { data: wallets, error: walletsError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (walletsError) {
      console.error('Error fetching wallets:', walletsError);
    }

    // Compter les paiements
    const { data: payments, error: paymentsError } = await supabase
      .from('scheduled_payments')
      .select('id, status')
      .eq('user_id', userId);

    if (paymentsError) {
      console.error('Error counting payments:', paymentsError);
    }

    const paymentStats = {
      total: payments?.length || 0,
      pending: payments?.filter(p => p.status === 'pending').length || 0,
      released: payments?.filter(p => p.status === 'released').length || 0,
      cancelled: payments?.filter(p => p.status === 'cancelled').length || 0
    };

    res.json({
      user: {
        ...user,
        wallets: wallets || [],
        paymentStats
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/users/payments
 * Récupérer TOUS les paiements de TOUS les wallets de l'utilisateur
 * ✅ NOUVELLE ROUTE POUR LE MULTI-WALLETS
 */
router.get('/payments', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    // 1. Récupérer tous les wallets de l'utilisateur
    const { data: wallets, error: walletsError } = await supabase
      .from('user_wallets')
      .select('wallet_address')
      .eq('user_id', userId);

    if (walletsError) {
      console.error('Error fetching wallets:', walletsError);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (!wallets || wallets.length === 0) {
      console.log('ℹ️ Aucun wallet associé à cet utilisateur');
      return res.json({ payments: [] });
    }

    const addresses = wallets.map(w => w.wallet_address.toLowerCase());
    console.log(`📊 Récupération paiements pour ${addresses.length} wallet(s):`, addresses);

    // 2. Récupérer tous les paiements où l'utilisateur est payer OU payee
    // Construction de la query OR pour Supabase
    const orConditions = addresses.map(addr => 
      `payer_address.eq.${addr},payee_address.eq.${addr}`
    ).join(',');

    const { data: payments, error: paymentsError } = await supabase
      .from('scheduled_payments')
      .select('*')
      .or(orConditions)
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      return res.status(500).json({ error: 'Erreur lors du chargement des paiements' });
    }

    console.log(`✅ ${payments?.length || 0} paiement(s) récupéré(s)`);

    res.json({ payments: payments || [] });

  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

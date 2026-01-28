const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * POST /api/link-wallet
 * Lie automatiquement le wallet à l'utilisateur connecté
 * Supporte plusieurs wallets par utilisateur
 *
 * Body:
 * {
 *   wallet_address: "0x...",
 *   label: "MetaMask Pro" (optionnel)
 * }
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wallet_address, label } = req.body;

    if (!wallet_address) {
      return res.status(400).json({ error: 'wallet_address requis' });
    }

    const walletLower = wallet_address.toLowerCase();

    console.log(`🔗 [LINK-WALLET] Liaison du wallet ${walletLower} à l'utilisateur ${userId}`);

    // Vérifier si ce wallet est déjà lié à un autre utilisateur
    const { data: existingWallet, error: checkError } = await supabase
      .from('user_wallets')
      .select('user_id, label')
      .eq('wallet_address', walletLower)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ [LINK-WALLET] Erreur vérification:', checkError);
    }

    // Si le wallet est déjà lié à CET utilisateur, ne rien faire
    if (existingWallet && existingWallet.user_id === userId) {
      console.log(`✅ [LINK-WALLET] Wallet déjà lié à cet utilisateur`);
      return res.json({
        success: true,
        message: 'Wallet déjà lié',
        wallet: existingWallet
      });
    }

    // Si le wallet est lié à un AUTRE utilisateur, erreur
    if (existingWallet && existingWallet.user_id !== userId) {
      console.log(`⚠️ [LINK-WALLET] Wallet déjà lié à un autre utilisateur`);
      return res.status(400).json({
        error: 'Ce wallet est déjà lié à un autre compte'
      });
    }

    // Vérifier si l'utilisateur a déjà des wallets
    const { data: userWallets, error: countError } = await supabase
      .from('user_wallets')
      .select('id')
      .eq('user_id', userId);

    const isFirstWallet = !userWallets || userWallets.length === 0;

    // Générer un label automatique si non fourni
    const walletLabel = label || `Wallet ${(userWallets?.length || 0) + 1}`;

    // Ajouter le nouveau wallet
    const { data, error } = await supabase
      .from('user_wallets')
      .insert({
        user_id: userId,
        wallet_address: walletLower,
        label: walletLabel,
        is_primary: isFirstWallet // Le premier wallet devient automatiquement primary
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [LINK-WALLET] Erreur insertion:', error);
      return res.status(500).json({ error: 'Impossible de lier le wallet' });
    }

    console.log(`✅ [LINK-WALLET] Wallet lié avec succès pour user ${userId} (${isFirstWallet ? 'primary' : 'secondary'})`);

    res.json({
      success: true,
      wallet: data,
      is_first: isFirstWallet
    });

  } catch (error) {
    console.error('❌ [LINK-WALLET] Erreur serveur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/link-wallet
 * Récupère tous les wallets liés à l'utilisateur connecté
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data, error } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ [LINK-WALLET] Erreur récupération:', error);
      return res.status(500).json({ error: 'Impossible de récupérer les wallets' });
    }

    res.json({
      success: true,
      wallets: data || [],
      primary_wallet: data?.find(w => w.is_primary)?.wallet_address || null
    });

  } catch (error) {
    console.error('❌ [LINK-WALLET] Erreur serveur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PATCH /api/link-wallet/:walletAddress/primary
 * Définir un wallet comme principal
 */
router.patch('/:walletAddress/primary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const walletAddress = req.params.walletAddress.toLowerCase();

    // Vérifier que ce wallet appartient à cet utilisateur
    const { data: wallet, error: checkError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('wallet_address', walletAddress)
      .single();

    if (checkError || !wallet) {
      return res.status(404).json({ error: 'Wallet non trouvé' });
    }

    // Retirer le statut primary de tous les autres wallets
    await supabase
      .from('user_wallets')
      .update({ is_primary: false })
      .eq('user_id', userId);

    // Définir ce wallet comme primary
    const { data, error } = await supabase
      .from('user_wallets')
      .update({ is_primary: true })
      .eq('user_id', userId)
      .eq('wallet_address', walletAddress)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Impossible de définir le wallet principal' });
    }

    console.log(`✅ [LINK-WALLET] Wallet ${walletAddress} défini comme principal pour user ${userId}`);

    res.json({
      success: true,
      wallet: data
    });

  } catch (error) {
    console.error('❌ [LINK-WALLET] Erreur serveur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/link-wallet/:walletAddress
 * Supprimer un wallet (sauf s'il est primary et qu'il est le seul)
 */
router.delete('/:walletAddress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const walletAddress = req.params.walletAddress.toLowerCase();

    // Compter les wallets de l'utilisateur
    const { data: wallets, error: countError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId);

    if (countError) {
      return res.status(500).json({ error: 'Erreur lors de la vérification' });
    }

    // Si c'est le seul wallet et qu'il est primary, refuser
    const targetWallet = wallets.find(w => w.wallet_address === walletAddress);
    if (wallets.length === 1 && targetWallet?.is_primary) {
      return res.status(400).json({
        error: 'Impossible de supprimer le dernier wallet principal'
      });
    }

    // Supprimer le wallet
    const { error } = await supabase
      .from('user_wallets')
      .delete()
      .eq('user_id', userId)
      .eq('wallet_address', walletAddress);

    if (error) {
      return res.status(500).json({ error: 'Impossible de supprimer le wallet' });
    }

    // Si le wallet supprimé était primary, définir un autre comme primary
    if (targetWallet?.is_primary && wallets.length > 1) {
      const nextWallet = wallets.find(w => w.wallet_address !== walletAddress);
      if (nextWallet) {
        await supabase
          .from('user_wallets')
          .update({ is_primary: true })
          .eq('id', nextWallet.id);
      }
    }

    console.log(`✅ [LINK-WALLET] Wallet ${walletAddress} supprimé pour user ${userId}`);

    res.json({
      success: true,
      message: 'Wallet supprimé'
    });

  } catch (error) {
    console.error('❌ [LINK-WALLET] Erreur serveur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

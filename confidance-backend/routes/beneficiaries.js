// routes/beneficiaries.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialiser Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/beneficiaries/:walletAddress
 * Récupère tous les bénéficiaires d'un utilisateur
 */
router.get('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Récupérer les bénéficiaires de l'utilisateur
    const { data, error } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('user_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur Supabase:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    res.json({
      success: true,
      beneficiaries: data || [],
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/beneficiaries
 * Créer un nouveau bénéficiaire
 */
router.post('/', async (req, res) => {
  try {
    const { user_address, beneficiary_address, display_name, category, email, phone } = req.body;

    // Validation
    if (!user_address || !beneficiary_address || !display_name) {
      return res.status(400).json({
        error: 'Champs requis manquants'
      });
    }

    // Vérifier que le bénéficiaire n'existe pas déjà
    const { data: existing } = await supabase
      .from('beneficiaries')
      .select('id')
      .eq('user_address', user_address.toLowerCase())
      .eq('beneficiary_address', beneficiary_address.toLowerCase())
      .single();

    if (existing) {
      return res.status(409).json({ 
        error: 'Ce bénéficiaire existe déjà' 
      });
    }

    // Créer le bénéficiaire
    const { data, error } = await supabase
      .from('beneficiaries')
      .insert([{
        user_address: user_address.toLowerCase(),
        beneficiary_address: beneficiary_address.toLowerCase(),
        display_name: display_name.trim(),
        category: category || null,
        email: email && String(email).trim() ? String(email).trim() : null,
        phone: phone && String(phone).trim() ? String(phone).trim() : null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Erreur Supabase:', error);
      return res.status(500).json({ error: 'Erreur lors de la création' });
    }

    res.status(201).json({
      success: true,
      beneficiary: data,
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/beneficiaries/:id
 * Modifier un bénéficiaire existant
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, category, email, phone } = req.body;

    // Validation
    if (!display_name || display_name.trim().length < 2) {
      return res.status(400).json({
        error: 'Le nom doit contenir au moins 2 caractères'
      });
    }

    // Mettre à jour le bénéficiaire
    const updatePayload = {
      display_name: display_name.trim(),
      category: category || null,
      updated_at: new Date().toISOString(),
    };
    if (email !== undefined) updatePayload.email = email && String(email).trim() ? String(email).trim() : null;
    if (phone !== undefined) updatePayload.phone = phone && String(phone).trim() ? String(phone).trim() : null;

    const { data, error } = await supabase
      .from('beneficiaries')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erreur Supabase:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Bénéficiaire non trouvé' });
    }

    res.json({
      success: true,
      beneficiary: data,
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/beneficiaries/:id
 * Supprimer un bénéficiaire
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Supprimer le bénéficiaire
    const { error } = await supabase
      .from('beneficiaries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erreur Supabase:', error);
      return res.status(500).json({ error: 'Erreur lors de la suppression' });
    }

    res.json({
      success: true,
      message: 'Bénéficiaire supprimé',
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
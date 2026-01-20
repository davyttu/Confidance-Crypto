// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, confirmPassword, accountType = 'particular' } = req.body;
    const isProfessionalSignup = accountType === 'professional';

    // Validations
    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    // Vérifier email unique
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Générer code de vérification (6 chiffres)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Créer l'utilisateur
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        // Ne pas activer "pro" avant validation du formulaire
        account_type: isProfessionalSignup ? 'particular' : accountType,
        pro_status: isProfessionalSignup ? 'pending' : null,
        verification_code: verificationCode,
        verification_code_expires_at: expiresAt.toISOString(),
        email_verified: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Erreur lors de la création du compte' });
    }

    // TODO: Envoyer email avec code de vérification
    console.log(`📧 Code de vérification pour ${email}: ${verificationCode}`);

    res.status(201).json({
      success: true,
      message: 'Compte créé ! Vérifiez votre email.',
      userId: newUser.id,
      verificationCode: verificationCode // Retourner le code en dev
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/verify
 * Vérifier le code email
 */
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email et code requis' });
    }

    // Récupérer l'utilisateur
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier si déjà vérifié
    if (user.email_verified) {
      return res.status(400).json({ error: 'Email déjà vérifié' });
    }

    // Vérifier le code
    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Code incorrect' });
    }

    // ✅ FIX : Gestion robuste de la timezone
    const now = new Date();
    const expiresAtRaw = user.verification_code_expires_at;

    let expiresAt;
    try {
      if (expiresAtRaw.includes('Z') || expiresAtRaw.includes('+')) {
        expiresAt = new Date(expiresAtRaw);
      } else {
        expiresAt = new Date(expiresAtRaw + 'Z');
      }
    } catch (e) {
      expiresAt = new Date(expiresAtRaw);
    }

    console.log('🕐 Debug expiration:', {
      rawValue: expiresAtRaw,
      now: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isExpired: now > expiresAt
    });

    if (now > expiresAt) {
      return res.status(400).json({ error: 'Code expiré' });
    }

    // Marquer comme vérifié
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email_verified: true,
        verification_code: null,
        verification_code_expires_at: null
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error verifying user:', updateError);
      return res.status(500).json({ error: 'Erreur lors de la vérification' });
    }

    // Générer JWT
    const token = generateToken(user.id, user.email, user.account_type);

    // Envoyer le token en cookie httpOnly
    // ⚠️ sameSite: 'none' requiert secure: true (localhost est une exception autorisée)
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: !isProduction ? true : true, // Toujours true pour sameSite: none
      sameSite: isProduction ? 'strict' : 'none', // 'none' en dev pour cross-origin
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    });

    const resolvedAccountType =
      user.account_type === 'professional' && user.pro_status === 'verified'
        ? 'professional'
        : 'particular';

    res.json({
      success: true,
      message: 'Email vérifié avec succès',
      user: {
        id: user.id,
        email: user.email,
        accountType: resolvedAccountType,
        proStatus: user.pro_status || null,
        emailVerified: true
      },
      token
    });

  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/login
 * Connexion utilisateur
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Récupérer l'utilisateur
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier si email vérifié
    if (!user.email_verified) {
      return res.status(403).json({ 
        error: 'Email non vérifié',
        needsVerification: true 
      });
    }

    // Générer JWT
    const token = generateToken(user.id, user.email, user.account_type);

    // Envoyer le token en cookie
    // ⚠️ sameSite: 'none' requiert secure: true (localhost est une exception autorisée)
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: !isProduction ? true : true, // Toujours true pour sameSite: none
      sameSite: isProduction ? 'strict' : 'none', // 'none' en dev pour cross-origin
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const resolvedAccountType =
      user.account_type === 'professional' && user.pro_status === 'verified'
        ? 'professional'
        : 'particular';

    res.json({
      success: true,
      message: 'Connexion réussie',
      user: {
        id: user.id,
        email: user.email,
        accountType: resolvedAccountType,
        proStatus: user.pro_status || null,
        emailVerified: user.email_verified,
        kycVerified: user.kyc_verified
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/logout
 * Déconnexion utilisateur
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Déconnexion réussie' });
});

/**
 * POST /api/auth/change-password
 * Modifier le mot de passe (ancien mot de passe requis)
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const { userId } = req.user;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const validPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour du mot de passe' });
    }

    return res.json({ success: true, message: 'Mot de passe mis à jour' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/change-email
 * Demande de modification email (ancien mot de passe requis)
 */
router.post('/change-email', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newEmail } = req.body;
    const { userId } = req.user;

    if (!oldPassword || !newEmail) {
      return res.status(400).json({ error: 'Ancien mot de passe et nouvel email requis' });
    }

    const normalizedEmail = newEmail.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const validPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('users')
      .update({
        pending_email: normalizedEmail,
        pending_email_code: verificationCode,
        pending_email_expires_at: expiresAt,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error setting pending email:', updateError);
      return res.status(500).json({ error: 'Erreur lors de la demande de changement d’email' });
    }

    console.log(`📧 Code de confirmation changement email ${normalizedEmail}: ${verificationCode}`);
    return res.json({ success: true, message: 'Code de confirmation envoyé' });
  } catch (error) {
    console.error('Change email error:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/confirm-email-change
 * Confirmer le changement d'email avec code
 */
router.post('/confirm-email-change', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    const { userId } = req.user;

    if (!code) {
      return res.status(400).json({ error: 'Code requis' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, account_type, pro_status, pending_email, pending_email_code, pending_email_expires_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (!user.pending_email || !user.pending_email_code) {
      return res.status(400).json({ error: 'Aucun changement email en attente' });
    }

    if (user.pending_email_code !== code) {
      return res.status(400).json({ error: 'Code incorrect' });
    }

    const expiresAtRaw = user.pending_email_expires_at;
    if (expiresAtRaw) {
      const expiresAt = new Date(expiresAtRaw);
      if (new Date() > expiresAt) {
        return res.status(400).json({ error: 'Code expiré' });
      }
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        email: user.pending_email,
        email_verified: true,
        pending_email: null,
        pending_email_code: null,
        pending_email_expires_at: null,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error confirming email change:', updateError);
      return res.status(500).json({ error: 'Erreur lors de la confirmation email' });
    }

    const resolvedAccountType =
      user.account_type === 'professional' && user.pro_status === 'verified'
        ? 'professional'
        : 'particular';

    const token = generateToken(user.id, user.pending_email, user.account_type);

    return res.json({
      success: true,
      message: 'Email mis à jour',
      user: {
        id: user.id,
        email: user.pending_email,
        accountType: resolvedAccountType,
        proStatus: user.pro_status || null,
        emailVerified: true,
      },
      token,
    });
  } catch (error) {
    console.error('Confirm email change error:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/auth/me
 * Récupérer l'utilisateur connecté
 */
router.get('/me', async (req, res) => {
  try {
    // ✅ MODIFIÉ : Récupérer le token depuis cookie OU header Authorization
    let token = req.cookies?.token;

    // Si pas de cookie, chercher dans Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Vérifier le token
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-key-change-in-production');

    // Récupérer l'utilisateur complet
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, account_type, pro_status, email_verified, kyc_verified, created_at')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const resolvedAccountType =
      user.account_type === 'professional' && user.pro_status === 'verified'
        ? 'professional'
        : 'particular';

    res.json({
      user: {
        id: user.id,
        email: user.email,
        accountType: resolvedAccountType,
        proStatus: user.pro_status || null,
        emailVerified: user.email_verified,
        kycVerified: user.kyc_verified,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Token invalide' });
  }
});

module.exports = router;
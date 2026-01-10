require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

// ✅ VERSION DU CODE - À VÉRIFIER DANS LES LOGS
const CODE_VERSION = "v2.0-with-payment-type-fix";
console.log("🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴");
console.log("🔴 CODE VERSION:", CODE_VERSION);
console.log("🔴 DATE:", new Date().toISOString());
console.log("🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_KEY || "placeholder-key"
);

console.log("🚀 Confidance Crypto API");
console.log("━━━━━━━━━━━━━━━━━━━━━━");
console.log("Port:", PORT);
console.log("Supabase URL:", process.env.SUPABASE_URL || "NOT SET");
console.log("━━━━━━━━━━━━━━━━━━━━━━");

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// POST /api/payments - Créer un nouveau paiement SIMPLE
app.post("/api/payments", async (req, res) => {
  try {
    const {
      contract_address,
      payer,
      payee,
      currency,
      token_address,
      amount,
      amount_decimals,
      release_time,
      status,
      chain_id,
      tx_hash,
      cancellable,
      network,
    } = req.body;

    // Validation
    if (!contract_address || !payer || !payee || !amount || !release_time) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["contract_address", "payer", "payee", "amount", "release_time"]
      });
    }

    const { data, error } = await supabase
      .from("scheduled_payments")
      .insert([
        {
          contract_address,
          payer,
          payee,
          currency: currency || "ETH",
          token_address,
          amount,
          amount_decimals: amount_decimals || 18,
          release_time,
          status: status || "pending",
          chain_id: chain_id || 8453,
          tx_hash,
          cancellable: cancellable || false,
          network: network || "base_mainnet",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("❌ Erreur Supabase:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log("✅ Paiement enregistré:", data.id);
    res.json({ success: true, payment: data });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🆕 POST /api/payments/batch - Créer des paiements MULTIPLES
app.post("/api/payments/batch", async (req, res) => {
  try {
    // ✅ LOG TRÈS VISIBLE POUR VÉRIFIER QUE LE NOUVEAU CODE S'EXÉCUTE
    console.log('');
    console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴');
    console.log('🔴 NOUVEAU CODE API BATCH - VERSION:', CODE_VERSION);
    console.log('🔴 TIMESTAMP:', new Date().toISOString());
    console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴');
    console.log('');
    
    // ✅ Log du body complet reçu pour debug
    console.log('📥 REQUEST BODY reçu:', JSON.stringify({
      ...req.body,
      beneficiaries: req.body.beneficiaries ? `${req.body.beneficiaries.length} beneficiaries` : 'none',
    }, null, 2));
    
    const {
      contract_address,
      payer_address,
      beneficiaries,          // Array: [{ address, amount, name }]
      total_to_beneficiaries,
      protocol_fee,
      total_sent,
      release_time,
      cancellable,
      network,
      transaction_hash,
      is_instant,
      payment_type,
    } = req.body;

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
      console.error('❌ ERREUR CRITIQUE: finalPaymentType invalide après détermination:', finalPaymentType);
      finalPaymentType = 'scheduled'; // Fallback sécurisé
    }
    
    // ✅ Recalculer isInstant avec la valeur finale de payment_type
    const isInstant = normalizedIsInstant || finalPaymentType === 'instant';
    
    console.log('📋 Données batch payment RECUES:', {
      is_instant_from_body: is_instant,
      payment_type_from_body: payment_type,
      type_of_is_instant: typeof is_instant,
      type_of_payment_type: typeof payment_type,
      normalizedIsInstant,
      finalPaymentType,
      isInstant,
      contract_address_from_body: contract_address,
      transaction_hash_from_body: transaction_hash,
    });
    
    if (!payer_address || !beneficiaries || !release_time) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["payer_address", "beneficiaries", "release_time"]
      });
    }
    
    if (!isInstant && !contract_address) {
      return res.status(400).json({ 
        error: "contract_address is required for scheduled payments"
      });
    }
    
    // ✅ Pour les paiements instantanés, utiliser transaction_hash comme contract_address si non fourni
    const finalContractAddress = contract_address || (isInstant && transaction_hash ? transaction_hash : null);
    
    if (!finalContractAddress) {
      return res.status(400).json({ 
        error: "contract_address or transaction_hash is required"
      });
    }

    if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) {
      return res.status(400).json({ error: "beneficiaries must be a non-empty array" });
    }

    // ✅ Validation finale : finalPaymentType doit toujours être défini (déjà fait plus haut, mais double sécurité)
    if (!finalPaymentType || (finalPaymentType !== 'instant' && finalPaymentType !== 'scheduled')) {
      console.error('❌ ERREUR CRITIQUE: finalPaymentType invalide après toutes les vérifications:', finalPaymentType);
      console.error('❌ Données reçues:', {
        is_instant_from_body: is_instant,
        payment_type_from_body: payment_type,
        normalizedIsInstant,
      });
      // Fallback absolu : utiliser 'scheduled' par défaut
      finalPaymentType = 'scheduled';
      console.warn('⚠️ Utilisation de fallback: payment_type = "scheduled"');
    }

    console.log('💾 Insertion dans Supabase avec:', {
      contract_address: finalContractAddress,
      payment_type: finalPaymentType,
      is_instant: isInstant,
      status: isInstant ? "completed" : "pending",
      beneficiaries_count: beneficiaries.length,
    });

    // ✅ Objet d'insertion avec payment_type garanti
    // IMPORTANT : Définir payment_type AVANT de créer l'objet pour éviter toute perte
    const finalPaymentTypeForInsert = finalPaymentType || 'scheduled'; // Fallback absolu
    
    const insertData = {
      contract_address: finalContractAddress,
      payer_address: payer_address,                    // ✅
      payee_address: beneficiaries[0].address,         // ✅
      token_symbol: "ETH",                             // ✅
      token_address: null,                             // ✅ Ajouter
      amount: total_to_beneficiaries,
      release_time,
      status: isInstant ? "completed" : "pending",     // ✅ Instantané = completed immédiatement
      cancellable: cancellable || false,
      network: network || "base_mainnet",
      transaction_hash,
      is_batch: true,
      is_instant: isInstant || false,
      payment_type: finalPaymentTypeForInsert, // ✅ Utiliser la variable dédiée
      batch_beneficiaries: beneficiaries,
      batch_count: beneficiaries.length,
    };
    
    // ✅ Vérification immédiate après création de l'objet
    console.log('✅ insertData créé - payment_type:', insertData.payment_type);
    console.log('✅ insertData créé - payment_type type:', typeof insertData.payment_type);
    
    // ✅ Double vérification avant insertion : payment_type doit être défini
    if (!insertData.payment_type || (insertData.payment_type !== 'instant' && insertData.payment_type !== 'scheduled')) {
      console.error('❌ ERREUR CRITIQUE: payment_type invalide dans insertData:', insertData.payment_type);
      console.error('❌ Objet insertData complet:', JSON.stringify(insertData, null, 2));
      insertData.payment_type = 'scheduled'; // Fallback absolu
      console.warn('⚠️ Correction appliquée: payment_type = "scheduled"');
    }
    
    console.log('📤 Insertion Supabase - payment_type final:', insertData.payment_type);
    console.log('📤 Insertion Supabase - payment_type type:', typeof insertData.payment_type);
    console.log('📤 Objet COMPLET à insérer (avec payment_type):', JSON.stringify({
      ...insertData,
      batch_beneficiaries: insertData.batch_beneficiaries ? `${Array.isArray(insertData.batch_beneficiaries) ? insertData.batch_beneficiaries.length : 'non-array'} beneficiaries` : 'none',
    }, null, 2));
    
    // ✅ Vérification finale absolue : payment_type DOIT exister
    if (!insertData.payment_type) {
      console.error('🚨 ERREUR FATALE: payment_type est NULL/undefined juste avant insertion!');
      console.error('🚨 insertData:', JSON.stringify(insertData, null, 2));
      console.error('🚨 finalPaymentType:', finalPaymentType);
      console.error('🚨 finalPaymentTypeForInsert:', finalPaymentTypeForInsert);
      return res.status(500).json({ 
        error: "Internal error: payment_type is missing",
        details: "Le champ payment_type est requis mais est null/undefined avant l'insertion"
      });
    }
    
    // ✅ Dernière vérification : s'assurer que payment_type est bien une string valide
    if (typeof insertData.payment_type !== 'string' || 
        (insertData.payment_type !== 'instant' && insertData.payment_type !== 'scheduled')) {
      console.error('🚨 ERREUR: payment_type a une valeur invalide:', insertData.payment_type);
      insertData.payment_type = 'scheduled'; // Forcer une valeur valide
      console.warn('⚠️ Correction: payment_type forcé à "scheduled"');
    }
    
    console.log('🔵🔵🔵 JUSTE AVANT INSERTION SUPABASE 🔵🔵🔵');
    console.log('🔵 payment_type:', insertData.payment_type);
    console.log('🔵 payment_type type:', typeof insertData.payment_type);
    console.log('🔵 is_instant:', insertData.is_instant);
    console.log('🔵 status:', insertData.status);
    
    // Créer UN enregistrement pour le batch avec JSON des bénéficiaires
    const { data, error } = await supabase
  .from("scheduled_payments")
  .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("❌❌❌ ERREUR SUPABASE BATCH ❌❌❌");
      console.error("❌ Error message:", error.message);
      console.error("❌ Error code:", error.code);
      console.error("❌ Error details:", JSON.stringify(error.details, null, 2));
      console.error("❌❌❌ DONNÉES ENVOYÉES À SUPABASE ❌❌❌");
      console.error("❌ payment_type envoyé:", insertData.payment_type);
      console.error("❌ Type de payment_type:", typeof insertData.payment_type);
      console.error("❌ is_instant envoyé:", insertData.is_instant);
      console.error("❌ status envoyé:", insertData.status);
      console.error("❌ Objet complet (sans batch_beneficiaries):", JSON.stringify({
        contract_address: insertData.contract_address,
        payer_address: insertData.payer_address,
        payee_address: insertData.payee_address,
        token_symbol: insertData.token_symbol,
        amount: insertData.amount,
        release_time: insertData.release_time,
        status: insertData.status,
        cancellable: insertData.cancellable,
        network: insertData.network,
        transaction_hash: insertData.transaction_hash,
        is_batch: insertData.is_batch,
        is_instant: insertData.is_instant,
        payment_type: insertData.payment_type,
        batch_count: insertData.batch_count,
      }, null, 2));
      
      return res.status(500).json({ 
        error: error.message,
        details: error.details,
        hint: "Vérifiez que toutes les colonnes existent dans Supabase et que payment_type est bien inclus dans l'objet d'insertion",
        debug: {
          payment_type_sent: insertData.payment_type,
          payment_type_type: typeof insertData.payment_type,
          payment_type_exists: insertData.hasOwnProperty('payment_type'),
          all_keys: Object.keys(insertData),
        }
      });
    }

    console.log("✅ Batch payment enregistré:", data.id);
    console.log(`   👥 ${beneficiaries.length} bénéficiaires`);
    console.log(`   💰 Total: ${total_to_beneficiaries}`);
    
    res.json({ success: true, payment: data });
  } catch (error) {
    console.error("❌ Erreur batch:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payments - Tous les paiements
app.get("/api/payments", async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase.from("scheduled_payments").select("*");

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("release_time", { ascending: true });

    if (error) throw error;

    console.log(`📊 Paiements trouvés: ${data?.length || 0}`);
    if (data && data.length > 0) {
      const now = Math.floor(Date.now() / 1000);
      const readyPayments = data.filter(p => p.status === 'pending' && p.release_time <= now);
      console.log(`⏰ Paiements prêts à exécuter: ${readyPayments.length}`);
    }

    res.json({ payments: data });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/payments/:id - Mettre à jour statut
app.patch("/api/payments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, executed_at, execution_tx_hash, cancelled_at } = req.body;

    console.log('🔄 PATCH /api/payments/:id:', { id, status, cancelled_at, executed_at, execution_tx_hash });

    const updates = {};
    if (status) {
      // Validation du statut
      const validStatuses = ['pending', 'released', 'cancelled', 'failed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: `Status invalide. Valeurs acceptées: ${validStatuses.join(', ')}` 
        });
      }
      updates.status = status;
    }
    if (executed_at) updates.executed_at = executed_at;
    if (execution_tx_hash) updates.execution_tx_hash = execution_tx_hash;
    if (cancelled_at) updates.cancelled_at = cancelled_at;
    updates.updated_at = new Date().toISOString();

    // Si le statut est 'cancelled' et qu'il n'y a pas encore de cancelled_at, l'ajouter automatiquement
    if (status === 'cancelled' && !updates.cancelled_at) {
      updates.cancelled_at = new Date().toISOString();
    }

    // Si le statut est 'released' et qu'il n'y a pas encore de executed_at, l'ajouter automatiquement
    if (status === 'released' && !updates.executed_at) {
      updates.executed_at = new Date().toISOString();
    }

    console.log('📝 Données de mise à jour:', updates);

    const { data, error } = await supabase
      .from("scheduled_payments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    console.log(`✅ Paiement ${id} mis à jour:`, { status: data.status, cancelled_at: data.cancelled_at });
    res.json({ success: true, payment: data });
  } catch (error) {
    console.error("❌ Erreur PATCH /api/payments/:id:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payments/ready - Paiements prêts pour le keeper
app.get("/api/payments/ready", async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    
    const { data, error } = await supabase
      .from("scheduled_payments")
      .select("*")
      .eq("status", "pending")
      .lte("release_time", now)
      .order("release_time", { ascending: true });

    if (error) throw error;

    console.log(`🎯 Paiements prêts pour keeper: ${data?.length || 0}`);
    res.json({ payments: data });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({ error: error.message });
  }
});

// Démarrage
app.listen(PORT, () => {
  console.log(`✅ API démarrée sur http://localhost:${PORT}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Endpoints disponibles:");
  console.log("  GET  /health");
  console.log("  POST /api/payments");
  console.log("  POST /api/payments/batch  🆕");
  console.log("  GET  /api/payments");
  console.log("  GET  /api/payments/ready");
  console.log("  PATCH /api/payments/:id");
  console.log("━━━━━━━━━━━━━━━━━━━━━━");
});

// Gestion erreurs
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error);
});

console.log("⏳ Démarrage du serveur...");

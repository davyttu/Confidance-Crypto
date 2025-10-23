require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

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

// POST /api/payments - Créer un nouveau paiement
app.post("/api/payments", async (req, res) => {
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

    // Validation
    if (!contract_address || !payer_address || !payee_address || !amount || !release_time) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["contract_address", "payer_address", "payee_address", "amount", "release_time"]
      });
    }

    // Insérer dans Supabase
    const { data, error } = await supabase
      .from("scheduled_payments")
      .insert([
        {
          contract_address,
          payer_address,
          payee_address,
          token_symbol: token_symbol || "ETH",
          token_address,
          amount,
          release_time,
          cancellable: cancellable || false,
          network: network || "base_mainnet",
          transaction_hash,
          status: "pending",
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

// GET /api/payments/:address - Paiements d'un utilisateur
app.get("/api/payments/:address", async (req, res) => {
  try {
    const { address } = req.params;

    const { data, error } = await supabase
      .from("scheduled_payments")
      .select("*")
      .or(`payer_address.eq.${address},payee_address.eq.${address}`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ payments: data });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payments - Tous les paiements (pour keeper)
app.get("/api/payments", async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase.from("scheduled_payments").select("*");

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("release_time", { ascending: true });

    if (error) throw error;

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
    const { status, executed_at, execution_tx_hash } = req.body;

    const updates = {};
    if (status) updates.status = status;
    if (executed_at) updates.executed_at = executed_at;
    if (execution_tx_hash) updates.execution_tx_hash = execution_tx_hash;

    const { data, error } = await supabase
      .from("scheduled_payments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Paiement ${id} mis à jour:`, status);
    res.json({ success: true, payment: data });
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
  console.log("  GET  /api/payments");
  console.log("  GET  /api/payments/:address");
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
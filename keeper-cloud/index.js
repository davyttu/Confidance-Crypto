const fs = require("fs");

const networkArg = process.argv[2]; // ex: polygon | arbitrum | avalanche
const envFile = networkArg ? `.env.${networkArg}` : ".env";

if (fs.existsSync(envFile)) {
  require("dotenv").config({ path: envFile });
} else {
  require("dotenv").config();
}

const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

// ============================================================
// CONFIGURATION
// ============================================================

const NETWORK = process.env.NETWORK || "base";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 60000; // 60 secondes
// Délai (ms) entre chaque exécution de paiement pour limiter le rate limit RPC. 0 = désactivé (comportement actuel).
const DELAY_BETWEEN_PAYMENTS_MS = parseInt(process.env.DELAY_BETWEEN_PAYMENTS_MS, 10) || 0;
// Après confirmation on-chain d'un recurring : pause (ms) pour que le RPC mette à jour le nonce avant le prochain envoi (évite "nonce already used").
const RECURRING_POST_CONFIRM_DELAY_MS = parseInt(process.env.RECURRING_POST_CONFIRM_DELAY_MS, 10) || 2000;
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:3001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// ✅ Mapping NETWORK -> network string pour Supabase
const NETWORK_MAP = {
  base: "base_mainnet",
  base_sepolia: "base_sepolia",
  "base-sepolia": "base_sepolia",
  polygon: "polygon_mainnet",
  arbitrum: "arbitrum_mainnet",
  avalanche: "avalanche_mainnet",
};
const NETWORK_STRING = NETWORK_MAP[NETWORK] || `chain_${NETWORK}`;
const EXPLORER_BASE =
  NETWORK_STRING === "base_sepolia" ? "https://sepolia.basescan.org" : "https://basescan.org";

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ ERREUR : Variables SUPABASE_URL et SUPABASE_KEY manquantes !");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function addTimelineEvent(payload) {
  try {
    const required = ["payment_id", "user_id", "event_type", "event_label", "actor_type", "explanation"];
    const missing = required.filter((field) => !payload?.[field]);
    if (missing.length > 0) {
      return;
    }

    const { error } = await supabase
      .from("payment_timeline_events")
      .insert([payload]);

    if (error) {
      console.error("⚠️ Timeline insert failed:", error.message);
    }
  } catch (error) {
    console.error("⚠️ Timeline insert error:", error.message);
  }
}

async function getMonthlyStatus(paymentId, monthIndex) {
  try {
    const { data, error } = await supabase
      .from("recurring_payments")
      .select("monthly_statuses")
      .eq("id", paymentId)
      .single();
    if (error || !data) {
      return null;
    }
    const statuses = data.monthly_statuses || {};
    return statuses[monthIndex] || null;
  } catch (error) {
    console.error("⚠️ getMonthlyStatus error:", error.message);
    return null;
  }
}

async function notifyRecurringFailureEmail({ paymentId, reason, monthNumber }) {
  try {
    if (!BACKEND_API_URL) {
      return;
    }
    const headers = { "Content-Type": "application/json" };
    if (INTERNAL_API_KEY) {
      headers["x-internal-key"] = INTERNAL_API_KEY;
    }
    const response = await fetch(`${BACKEND_API_URL}/api/payments/recurring/notify-failed`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        payment_id: paymentId,
        failure_reason: reason || null,
        month_number: monthNumber || null,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn("⚠️ Failed to notify recurring failure:", response.status, text);
    }
  } catch (error) {
    console.warn("⚠️ notifyRecurringFailureEmail error:", error?.message || error);
  }
}

// ============================================================
// N8N (ALBERT) WEBHOOK - EVENT EMITTER
// ============================================================
// ⚠️ IMPORTANT :
// - Le keeper "émet" seulement des events
// - Albert/n8n décide quoi faire (Telegram, logs, etc.)
// - Node 20+ a fetch natif → pas besoin de node-fetch
//
// Variables à ajouter dans .env.base et .env.polygon :
//   N8N_WEBHOOK_URL=https://.../webhook/xxx
//   KEEPER_NAME=keeper-base (ou keeper-polygon)
//
// Optionnel :
//   N8N_WEBHOOK_SECRET=... (si tu veux ajouter un header secret côté n8n)

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || null;
const KEEPER_NAME = process.env.KEEPER_NAME || `keeper-${NETWORK}`;
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || null;

async function emitEvent(event) {
  try {
    if (!N8N_WEBHOOK_URL) return;
    if (typeof fetch !== "function") return; // sécurité (devrait exister sur Node 20)

    const payload = {
      source: "confidance-keeper",
      keeper: KEEPER_NAME,
      network: NETWORK,
      network_string: NETWORK_STRING,
      timestamp: new Date().toISOString(),
      ...event,
    };

    const headers = { "Content-Type": "application/json" };
    if (N8N_WEBHOOK_SECRET) headers["x-confidance-secret"] = N8N_WEBHOOK_SECRET;

    await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // On ne doit JAMAIS casser le keeper si n8n est down.
    console.error("⚠️ N8N emit failed:", e.message);
  }
}

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

const http = require("http");
const PORT = process.env.PORT || 3000;

let lastCheckTime = null;
let scheduledPayments = [];
let recurringPayments = [];

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        uptime: process.uptime(),
        lastCheck: lastCheckTime,
        scheduledPayments: scheduledPayments.length,
        recurringPayments: recurringPayments.length,
        totalActive: scheduledPayments.length + recurringPayments.length,
        version: "3.2-USDC-FIX+N8N",
        network: NETWORK,
        network_string: NETWORK_STRING,
        keeper_name: KEEPER_NAME,
      })
    );
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Confidance Crypto Keeper V3.2 - USDC FIX + N8N 🚀💰");
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

// ============================================================
// BANNER
// ============================================================

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🚀 CONFIDANCE CRYPTO KEEPER V3.2 - USDC FIX + N8N");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`🌐 Network: ${NETWORK} (${NETWORK_STRING})`);
console.log(`⏰ Check interval: ${CHECK_INTERVAL / 1000}s`);
console.log(`🗄️ Database: Supabase`);
console.log(`🟣 N8N Webhook: ${N8N_WEBHOOK_URL ? "enabled" : "disabled"}`);
console.log(`🧠 Keeper Name: ${KEEPER_NAME}`);
console.log("✨ Features: ETH + ERC20 (USDC/USDT) + Batch + Recurring");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ============================================================
// WEB3 SETUP
// ============================================================

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

console.log("👤 Keeper address:", wallet.address);

// ABI pour ScheduledPayment (single)
const SCHEDULED_PAYMENT_ABI = [
  "function releaseTime() view returns (uint256)",
  "function released() view returns (bool)",
  "function cancelled() view returns (bool)",
  "function release() external",
];

// ABI pour BatchScheduledPayment_V2 (multi)
const BATCH_PAYMENT_ABI = [
  "function releaseTime() view returns (uint256)",
  "function released() view returns (bool)",
  "function release() external",
  "function cancelled() view returns (bool)", // ✅ AJOUTÉ
];

// ABI pour RecurringPaymentERC20 (mensuel)
// ✅ SIMPLIFIÉ : Seulement les fonctions essentielles pour éviter les erreurs
const RECURRING_PAYMENT_ABI = [
  "function executeMonthlyPayment() external",
  "function executedMonths() view returns (uint256)",
  "function totalMonths() view returns (uint256)",
  "function cancelled() view returns (bool)",
  "function startDate() view returns (uint256)",
];

// Constante pour calcul du prochain mois (30 jours)
const MONTH_IN_SECONDS = parseInt(process.env.SECONDS_PER_MONTH, 10) || 2592000;

// ============================================================
// HELPER : FORMATER MONTANT AVEC SYMBOLE
// ============================================================

function formatAmount(amountWei, tokenSymbol) {
  const decimals = getTokenDecimals(tokenSymbol);
  const formatted = ethers.formatUnits(amountWei, decimals);
  return `${parseFloat(formatted).toFixed(4)} ${tokenSymbol}`;
}

function getTokenDecimals(symbol) {
  const decimalsMap = {
    ETH: 18,
    USDC: 6,
    USDT: 6,
    DAI: 18,
  };
  return decimalsMap[symbol] || 18;
}

// ✅ NOUVELLE FONCTION : Vérifier si paiement déjà released
async function checkIfAlreadyReleased(contractAddress) {
  try {
    const contract = new ethers.Contract(contractAddress, SCHEDULED_PAYMENT_ABI, provider);
    const released = await contract.released();
    return released;
  } catch (error) {
    console.error(`   ⚠️ Erreur vérification released:`, error.message);
    return false;
  }
}

// ✅ NOUVELLE FONCTION : Vérifier si paiement annulé
async function checkIfCancelled(contractAddress) {
  try {
    const contract = new ethers.Contract(contractAddress, SCHEDULED_PAYMENT_ABI, provider);
    const cancelled = await contract.cancelled();
    return cancelled;
  } catch (error) {
    console.error(`   ⚠️ Erreur vérification cancelled:`, error.message);
    return false;
  }
}

// ============================================================
// CHARGEMENT PAIEMENTS PROGRAMMÉS (SINGLE + BATCH)
// ⚡ MODIFICATION V3.1: Les paiements instantanés sont IGNORÉS
//    car ils sont déjà exécutés dans le constructor (0 délai)
// ============================================================

async function loadScheduledPayments() {
  try {
    // ✅ FIX : Inclure les paiements où is_instant est false OU null (exclure seulement true)
    // ✅ FIX : Filtrer par réseau pour ne traiter que les paiements du réseau courant
    let query = supabase
      .from("scheduled_payments")
      .select("*")
      .eq("status", "pending")
      .or("is_instant.is.null,is_instant.eq.false") // Inclure null OU false (exclure true)
      .eq("network", NETWORK_STRING) // ✅ Filtrer par réseau
      .order("release_time", { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error("❌ Erreur scheduled_payments:", error.message);

      await emitEvent({
        type: "KEEPER_DB_ERROR",
        scope: "loadScheduledPayments",
        error: error.message,
      });

      return [];
    }

    // ✅ Logs de débogage
    if (!data || data.length === 0) {
      console.log("📋 Aucun paiement scheduled pending trouvé");
      console.log(`   🔍 Filtres appliqués: status=pending, network=${NETWORK_STRING}, is_instant=null|false`);

      // ✅ DEBUG : Vérifier s'il y a des paiements failed récemment
      const { data: failedPayments } = await supabase
        .from("scheduled_payments")
        .select("id, status, error_message, updated_at")
        .eq("network", NETWORK_STRING)
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(3);

      if (failedPayments && failedPayments.length > 0) {
        console.log(`   ⚠️ DEBUG: ${failedPayments.length} paiement(s) failed récent(s) trouvé(s):`);
        failedPayments.forEach((p) => {
          console.log(
            `      - ${p.id.substring(0, 8)}: ${p.error_message?.substring(0, 100) || "no error message"} (${p.updated_at})`
          );
        });
      }

      return [];
    }

    console.log(`📦 ${data.length} paiement(s) scheduled chargé(s) depuis Supabase`);

    // ✅ Log des IDs et réseaux pour débogage
    if (data.length > 0) {
      const ids = data.map((row) => row.id.substring(0, 8)).join(", ");
      const networks = data.map((row) => row.network || "null").join(", ");
      const statuses = data.map((row) => row.status || "null").join(", ");
      console.log(`   IDs: ${ids}`);
      console.log(`   Networks: ${networks}`);
      console.log(`   Statuses: ${statuses}`);
    }

    // ✅ Mapper TOUS les paiements pending (la vérification released se fera dans executeScheduledPayment)
    const now = Math.floor(Date.now() / 1000);
    const payments = data
      .map((row) => {
        const isBatch = row.is_batch === true;
        const batchCount = row.batch_count || 0;
        const tokenSymbol = row.token_symbol || "ETH";
        const isERC20 = tokenSymbol !== "ETH";

        // ✅ FIX : Formater correctement le montant selon le token
        const formattedAmount = formatAmount(row.amount, tokenSymbol);

        return {
          type: "scheduled",
          subType: isBatch ? "batch" : isERC20 ? "single_erc20" : "single_eth",
          id: row.id,
          contractAddress: row.contract_address,
          releaseTime: row.release_time,
          amount: row.amount,
          tokenSymbol: tokenSymbol,
          tokenAddress: row.token_address,
          isERC20: isERC20,
          isBatch: isBatch,
          batchCount: batchCount,
          network: row.network, // ✅ Ajouter network pour vérification
          is_instant: row.is_instant || false, // ✅ Ajouter is_instant pour filtrage
          name: isBatch
            ? `📦 Batch #${row.id.substring(0, 8)} (${batchCount} benef, ${formattedAmount})`
            : `💎 Payment #${row.id.substring(0, 8)} (${formattedAmount})`,
        };
      })
      .filter((payment) => {
        // ✅ FIX CRITIQUE : Filtrer UNIQUEMENT les paiements avec is_instant=true
        // Ne PAS filtrer les paiements programmés avec timeUntil négatif (ceux-là doivent être exécutés !)
        if (payment.is_instant === true) {
          const releaseTime = Number(payment.releaseTime);
          const timeUntil = releaseTime - now;
          console.log(`   ⚠️ Paiement ${payment.id.substring(0, 8)} est instantané (is_instant=true), ignoré`);
          return false; // Exclure les paiements instantanés
        }
        return true; // Inclure tous les autres paiements (même avec timeUntil négatif)
      });

    const filteredCount = data.length - payments.length;
    if (filteredCount > 0) {
      console.log(`   ℹ️ ${filteredCount} paiement(s) instantané(s) filtré(s), ${payments.length} paiement(s) programmé(s) restant(s)`);
    }

    return payments;
  } catch (error) {
    console.error("❌ Erreur loadScheduledPayments:", error.message);

    await emitEvent({
      type: "KEEPER_ERROR",
      scope: "loadScheduledPayments",
      error: error.message || String(error),
    });

    return [];
  }
}

// ============================================================
// CHARGEMENT PAIEMENTS RÉCURRENTS
// ============================================================

async function loadRecurringPayments() {
  try {
    const now = Math.floor(Date.now() / 1000);

    const { data, error } = await supabase
      .from("recurring_payments")
      .select("*")
      .in("status", ["pending", "active"])
      .eq("network", NETWORK_STRING)
      .lte("next_execution_time", now)
      .order("next_execution_time", { ascending: true });

    if (error) {
      console.error("❌ Erreur recurring_payments:", error.message);

      await emitEvent({
        type: "KEEPER_DB_ERROR",
        scope: "loadRecurringPayments",
        error: error.message,
      });

      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const payments = data
      .map((row) => ({
        type: "recurring",
        id: row.id,
        contractAddress: row.contract_address,
        tokenSymbol: row.token_symbol,
        monthlyAmount: row.monthly_amount,
        totalMonths: row.total_months,
        executedMonths: row.executed_months,
        nextExecutionTime: row.next_execution_time,
        status: row.status,
        userId: row.user_id,
        category: row.payment_category || null,
        monthly_statuses: row.monthly_statuses || {},
        name: `🔄 Recurring #${row.id.substring(0, 8)} (${row.token_symbol}, ${row.executed_months}/${row.total_months} mois)`,
      }))
      .filter((p) => {
        // Ne pas appeler le contrat si le prochain mois à traiter est déjà 'failed' (strict skip : pas de retry).
        // Le "prochain mois" = nombre de mois déjà traités (executed + failed), pas seulement executed_months :
        // après un échec le contrat a avancé (nextMonthToProcess++), donc on doit continuer avec le mois suivant.
        const statuses = p.monthly_statuses || {};
        const totalMonths = Number(p.total_months ?? 0);
        let nextMonthIndex = 0;
        for (let i = 0; i < totalMonths; i++) {
          const s = statuses[String(i)];
          if (s === "executed" || s === "failed") nextMonthIndex = i + 1;
          else break;
        }
        if (nextMonthIndex >= totalMonths) return true; // tout traité, le contrat revertera "All payment periods completed"
        const nextStatus = statuses[String(nextMonthIndex)];
        if (nextStatus === "failed") {
          console.log(`   ⏭️ Recurring #${p.id.substring(0, 8)}: next month ${nextMonthIndex + 1} already failed, skipping (no retry)`);
          return false;
        }
        return true;
      });

    return payments;
  } catch (error) {
    console.error("❌ Erreur loadRecurringPayments:", error.message);

    await emitEvent({
      type: "KEEPER_ERROR",
      scope: "loadRecurringPayments",
      error: error.message || String(error),
    });

    return [];
  }
}

// ============================================================
// MISE À JOUR DATABASE - SCHEDULED
// ============================================================

async function markScheduledAsReleased(paymentId, txHash) {
  try {
    const { error } = await supabase
      .from("scheduled_payments")
      .update({
        status: "released",
        tx_hash: txHash,
        executed_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (error) {
      console.error("❌ Erreur update scheduled:", error.message);
    } else {
      console.log(`   ✅ DB updated: scheduled_payments → released`);
    }
  } catch (error) {
    console.error("❌ Erreur markScheduledAsReleased:", error.message);
  }
}

async function markScheduledAsFailed(paymentId, errorMsg) {
  try {
    // ✅ Vérifier d'abord le release_time ET le réseau avant de marquer comme failed
    const { data: paymentData } = await supabase
      .from("scheduled_payments")
      .select("release_time, status, network")
      .eq("id", paymentId)
      .single();

    if (paymentData) {
      // ✅ PROTECTION CRITIQUE : Vérifier que le paiement appartient au bon réseau
      if (paymentData.network && paymentData.network !== NETWORK_STRING) {
        console.log(
          `   🛡️ PROTECTION: Tentative de marquer comme failed un paiement du réseau ${paymentData.network} (keeper configuré pour ${NETWORK_STRING})`
        );
        console.log(`   ✅ Paiement ${paymentId.substring(0, 8)} ne sera PAS marqué comme failed par ce keeper`);
        console.log(`   📋 Raison bloquée: ${errorMsg.substring(0, 200)}`);
        return; // Ne pas marquer comme failed, ce n'est pas notre réseau
      }

      const now = Math.floor(Date.now() / 1000);
      const releaseTime = Number(paymentData.release_time);
      const timeUntil = releaseTime - now;

      // ✅ PROTECTION CRITIQUE : Ne JAMAIS marquer comme failed si le release_time n'est pas encore atteint
      if (timeUntil > 0) {
        console.log(`   🛡️ PROTECTION: Tentative de marquer comme failed AVANT le release_time (${Math.floor(timeUntil / 60)}m restantes)`);
        console.log(`   ✅ Paiement ${paymentId.substring(0, 8)} reste en PENDING, ne sera PAS marqué comme failed`);
        console.log(`   📋 Raison bloquée: ${errorMsg.substring(0, 200)}`);
        return; // Ne pas marquer comme failed
      }

      // ✅ Vérifier aussi que le statut n'est pas déjà "failed" (éviter les doublons)
      if (paymentData.status === "failed") {
        console.log(`   ℹ️ Paiement ${paymentId.substring(0, 8)} est déjà en "failed", pas de mise à jour`);
        return;
      }
    }

    console.log(`   ⚠️ [markScheduledAsFailed] Marquant le paiement ${paymentId.substring(0, 8)} comme FAILED`);
    console.log(`   📋 Raison: ${errorMsg.substring(0, 200)}`);
    console.log(`   📍 Stack trace:`, new Error().stack?.split("\n").slice(1, 4).join("\n"));

    const { error } = await supabase
      .from("scheduled_payments")
      .update({
        status: "failed",
        error_message: errorMsg.substring(0, 500),
        executed_at: new Date().toISOString(), // ✅ FIX : Utiliser executed_at au lieu de failed_at
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (error) {
      console.error("❌ Erreur update failed:", error.message);
    } else {
      console.log(`   ✅ DB updated: scheduled_payments → failed`);

      // 🟣 Emit event (Albert)
      await emitEvent({
        type: "SCHEDULED_FAILED",
        paymentId,
        error: errorMsg.substring(0, 300),
      });
    }
  } catch (error) {
    console.error("❌ Erreur markScheduledAsFailed:", error.message);
  }
}

// ============================================================
// MISE À JOUR DATABASE - RECURRING
// ============================================================

async function markRecurringAsCancelled(paymentId) {
  try {
    const { error } = await supabase
      .from("recurring_payments")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (error) {
      console.error("❌ Erreur update cancelled:", error.message);
    }
  } catch (error) {
    console.error("❌ Erreur markRecurringAsCancelled:", error.message);
  }
}

async function updateRecurringAfterExecution(paymentId, txHash, executedMonths, totalMonths, nextMonthToProcess = null, startDate = null, monthlyStatusUpdate = null, forceStatus = null) {
  try {
    const now = Math.floor(Date.now() / 1000);
    // ✅ FIX: Utiliser nextMonthToProcess pour déterminer si terminé
    // executedMonths ne compte que les succès, pas les échecs
    const isCompleted = (nextMonthToProcess !== null && nextMonthToProcess >= totalMonths) || executedMonths >= totalMonths;

    // ✅ FIX : Calculer next_execution_time basé sur nextMonthToProcess si fourni
    // Sinon, utiliser l'ancienne méthode (now + MONTH_IN_SECONDS)
    let nextExecutionTime;
    if (nextMonthToProcess !== null && startDate !== null && !isCompleted) {
      nextExecutionTime = startDate + (nextMonthToProcess * MONTH_IN_SECONDS);
    } else {
      // NOTE: next_execution_time est NOT NULL en DB → garder une valeur valide
      nextExecutionTime = isCompleted ? now : now + MONTH_IN_SECONDS;
    }

    // ✅ Mois 1 échoué → contrat annulé : forcer status = cancelled
    const newStatus = forceStatus === 'cancelled' ? 'cancelled' : (isCompleted ? "completed" : "active");

    // 🆕 Gérer monthly_statuses
    let updateData = {
      executed_months: executedMonths,
      next_execution_time: nextExecutionTime,
      last_execution_time: now,
      last_execution_hash: txHash,
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...(newStatus === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}),
    };

    // Si on a un update de statut mensuel, lire les statuts existants et merger
    if (monthlyStatusUpdate !== null) {
      try {
        // Lire les statuts existants
        const { data: currentData, error: readError } = await supabase
          .from("recurring_payments")
          .select("monthly_statuses")
          .eq("id", paymentId)
          .single();

        if (!readError && currentData) {
          // Merger avec les statuts existants
          const currentStatuses = currentData.monthly_statuses || {};
          const mergedStatuses = { ...currentStatuses, ...monthlyStatusUpdate };
          updateData.monthly_statuses = mergedStatuses;

          console.log(`   📋 Updated monthly_statuses:`, mergedStatuses);
        } else {
          // Si erreur de lecture, créer un nouvel objet
          updateData.monthly_statuses = monthlyStatusUpdate;
        }
      } catch (e) {
        console.log(`   ⚠️ Could not read existing monthly_statuses, creating new: ${e.message}`);
        updateData.monthly_statuses = monthlyStatusUpdate;
      }
    }

    // ✅ FIX : Ne pas utiliser last_execution_at si la colonne n'existe pas
    const { error } = await supabase
      .from("recurring_payments")
      .update(updateData)
      .eq("id", paymentId);

    if (error) {
      console.error("❌ Erreur update recurring:", error.message);
    } else {
      console.log(`   ✅ DB updated: executed_months = ${executedMonths}/${totalMonths}, status = ${newStatus}`);

      if (newStatus === "completed") {
        try {
          const { data: linkRow, error: linkReadErr } = await supabase
            .from("recurring_payments")
            .select("payment_link_id")
            .eq("id", paymentId)
            .maybeSingle();
          if (!linkReadErr && linkRow?.payment_link_id) {
            const plId = String(linkRow.payment_link_id).trim();
            if (plId) {
              const { error: linkUpdErr } = await supabase
                .from("payment_links")
                .update({
                  status: "completed",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", plId)
                .in("status", ["pending", "active"]);
              if (linkUpdErr) {
                console.warn(`   ⚠️ payment_links → completed: ${linkUpdErr.message}`);
              } else {
                console.log(`   ✅ payment_links ${plId} → completed`);
              }
            }
          }
        } catch (e) {
          console.warn(`   ⚠️ Sync payment_link completed: ${e.message || e}`);
        }
      }

      // 🟣 Emit event (Albert)
      await emitEvent({
        type: "RECURRING_EXECUTED",
        paymentId,
        txHash,
        executedMonths,
        totalMonths,
        status: newStatus,
      });
    }
  } catch (error) {
    console.error("❌ Erreur updateRecurringAfterExecution:", error.message);
  }
}

async function markRecurringAsFailed(paymentId, errorMsg) {
  try {
    // ✅ FIX : Ne pas utiliser error_message ni last_execution_at si les colonnes n'existent pas
    // On met juste le status à "failed" et on log l'erreur
    const { error } = await supabase
      .from("recurring_payments")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (error) {
      console.error("❌ Erreur update failed:", error.message);
      // Log l'erreur même si la DB update échoue
      console.error(`   📋 Erreur du paiement: ${errorMsg.substring(0, 300)}`);
    } else {
      console.log(`   ⚠️ Paiement marqué comme failed: ${errorMsg.substring(0, 200)}`);
      // 🟣 Emit event (Albert)
      await emitEvent({
        type: "RECURRING_FAILED",
        paymentId,
        error: errorMsg.substring(0, 300),
      });
    }
  } catch (error) {
    console.error("❌ Erreur markRecurringAsFailed:", error.message);
    console.error(`   📋 Erreur du paiement (non sauvegardée): ${errorMsg.substring(0, 300)}`);
  }
}

// ============================================================
// EXÉCUTION PAIEMENTS PROGRAMMÉS (SINGLE + BATCH)
// ============================================================

async function executeScheduledPayment(payment) {
  try {
    const now = Math.floor(Date.now() / 1000);

    // ✅ Afficher les détails du paiement
    console.log(`   🔧 Type: ${payment.subType}`);
    console.log(`   💰 Token: ${payment.tokenSymbol}`);
    console.log(`   📍 Contract: ${payment.contractAddress}`);
    console.log(`   📍 Token Address: ${payment.tokenAddress}`);
    console.log(`   🆔 Payment ID: ${payment.id}`);
    console.log(`   🌐 Payment Network: ${payment.network || "null"}`);
    console.log(`   🌐 Keeper Network: ${NETWORK_STRING}`);

    // ✅ FIX CRITIQUE : Vérifier que le paiement appartient au bon réseau
    if (payment.network && payment.network !== NETWORK_STRING) {
      console.log(`   ⚠️ Paiement appartient au réseau ${payment.network} mais keeper est configuré pour ${NETWORK_STRING}`);
      console.log(`   ✅ Ignorant ce paiement (sera traité par le bon keeper)`);

      // 🟣 Emit event (Albert)
      await emitEvent({
        type: "SCHEDULED_SKIPPED",
        reason: "WRONG_NETWORK",
        paymentId: payment.id,
        paymentNetwork: payment.network,
        keeperNetwork: NETWORK_STRING,
      });

      return;
    }

    // ✅ FIX CRITIQUE : Vérifier d'abord le release_time depuis la DB
    const dbReleaseTime = Number(payment.releaseTime);
    const timeUntilFromDB = dbReleaseTime - now;

    console.log(`   ⏰ Release time (DB): ${new Date(dbReleaseTime * 1000).toLocaleString()}`);
    console.log(`   ⏰ Current time: ${new Date(now * 1000).toLocaleString()}`);

    if (timeUntilFromDB > 0) {
      const minutes = Math.floor(timeUntilFromDB / 60);
      const seconds = timeUntilFromDB % 60;
      console.log(`   ⏳ Encore ${minutes}m ${seconds}s (vérification depuis DB, pas d'appel contrat)`);
      console.log(`   ✅ Paiement reste en PENDING, aucun appel au contrat avant le release_time`);
      return;
    }

    // ✅ PROTECTION : Ne jamais appeler le contrat si le release_time n'est pas encore atteint
    if (timeUntilFromDB > 0) {
      console.log(`   ⚠️ PROTECTION: Release_time pas encore atteint, retour anticipé`);
      return;
    }

    // ✅ FIX CRITIQUE : Vérifier que contractAddress n'est pas l'adresse du token
    const knownTokenAddresses = [
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC Base
      "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // USDT Base
      "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", // DAI Base
      "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", // cbBTC Base
      "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c", // WBTC Base
    ];

    const isTokenAddress = knownTokenAddresses.some((addr) => addr.toLowerCase() === payment.contractAddress?.toLowerCase());

    if (isTokenAddress) {
      console.error(`   ❌ ERREUR CRITIQUE: contract_address contient l'adresse du token au lieu du contrat de paiement !`);
      console.error(`   📍 Contract Address (ERREUR): ${payment.contractAddress}`);
      console.error(`   📍 Token Address: ${payment.tokenAddress}`);
      await markScheduledAsFailed(
        payment.id,
        `ERREUR: contract_address contient l'adresse du token (${payment.contractAddress}) au lieu du contrat de paiement. Veuillez corriger manuellement dans la base de données.`
      );

      await emitEvent({
        type: "KEEPER_DATA_ERROR",
        scope: "executeScheduledPayment",
        paymentId: payment.id,
        reason: "CONTRACT_ADDRESS_IS_TOKEN",
        contractAddress: payment.contractAddress,
        tokenAddress: payment.tokenAddress,
      });

      return;
    }

    // ✅ NOUVEAU : Vérifier d'abord si déjà released (paiement instantané)
    const isAlreadyReleased = await checkIfAlreadyReleased(payment.contractAddress);
    if (isAlreadyReleased) {
      console.log(`   ✅ Already released (instant payment)`);
      await markScheduledAsReleased(payment.id, "instant_payment");

      await emitEvent({
        type: "SCHEDULED_ALREADY_RELEASED",
        paymentId: payment.id,
        contractAddress: payment.contractAddress,
      });

      return;
    }

    // ✅ NOUVEAU : Vérifier si annulé
    const isCancelled = await checkIfCancelled(payment.contractAddress);
    if (isCancelled) {
      console.log(`   🚫 Cancelled on-chain`);
      await supabase
        .from("scheduled_payments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", payment.id);

      await emitEvent({
        type: "SCHEDULED_CANCELLED_ONCHAIN",
        paymentId: payment.id,
        contractAddress: payment.contractAddress,
      });

      return;
    }

    // ✅ Vérifier que l'adresse est bien un contrat
    console.log(`   🔍 Vérification du code du contrat à ${payment.contractAddress}...`);
    let code;
    try {
      code = await provider.getCode(payment.contractAddress);
    } catch (codeError) {
      console.error(`   ❌ Erreur lors de la vérification du code: ${codeError.message}`);
      if (timeUntilFromDB > 0) {
        console.log(`   ⚠️ Erreur vérification code mais release_time pas encore atteint, on réessaiera plus tard`);
        return;
      }
      throw codeError;
    }

    if (code === "0x" || code === "0x0" || !code || code.length < 10) {
      const errorMsg = `L'adresse ${payment.contractAddress} n'est pas un contrat valide (code vide ou invalide: ${code?.substring(0, 20)}...)`;
      console.error(`   ❌ ${errorMsg}`);

      if (timeUntilFromDB > 0) {
        console.log(`   ⚠️ Code vide mais release_time pas encore atteint (${Math.floor(timeUntilFromDB / 60)}m restantes), on réessaiera plus tard`);
        return;
      } else if (timeUntilFromDB <= -300) {
        await markScheduledAsFailed(payment.id, errorMsg);
      } else {
        console.log(`   ⚠️ Erreur mais release_time vient d'être atteint, on réessaiera au prochain check`);
      }
      return;
    }

    console.log(`   ✅ Contrat valide (code length: ${code.length})`);

    // Choisir le bon ABI
    const abi = payment.isBatch ? BATCH_PAYMENT_ABI : SCHEDULED_PAYMENT_ABI;
    const contract = new ethers.Contract(payment.contractAddress, abi, wallet);

    // Vérifier si déjà libéré (avec gestion d'erreur spécifique)
    let released = false;
    try {
      console.log(`   🔍 Appel de contract.released() sur ${payment.contractAddress}...`);
      released = await contract.released();
      console.log(`   ✅ contract.released() = ${released}`);
    } catch (error) {
      console.error(`   ❌ Erreur lors de l'appel à contract.released():`, error.message);
      console.error(`   📋 Code du contrat: ${code?.substring(0, 50)}... (length: ${code?.length})`);

      // ✅ FIX : Détecter si c'est un contrat InstantPayment (pas de méthode released())
      if (
        error.message?.includes("execution reverted") ||
        error.message?.includes("require(false)") ||
        error.message?.includes("CALL_EXCEPTION")
      ) {
        try {
          console.log(`   🔍 Tentative d'appel à executed() (paiement instantané?)...`);
          const INSTANT_PAYMENT_ABI = ["function executed() view returns (bool)"];
          const instantContract = new ethers.Contract(payment.contractAddress, INSTANT_PAYMENT_ABI, wallet);
          const executed = await instantContract.executed();

          if (executed) {
            console.log(`   ✅ C'est un paiement instantané déjà exécuté (executed = true)`);
            console.log(`   ✅ Marquant comme released car déjà exécuté dans le constructor`);
            await markScheduledAsReleased(payment.id, "instant_payment_already_executed");

            await emitEvent({
              type: "SCHEDULED_INSTANT_ALREADY_EXECUTED",
              paymentId: payment.id,
              contractAddress: payment.contractAddress,
            });

            return;
          } else {
            console.log(`   ⚠️ Paiement instantané mais executed = false (anormal)`);
          }
        } catch (executedError) {
          console.log(`   ℹ️ Ce n'est pas un InstantPayment (executed() n'existe pas ou erreur: ${executedError.message?.substring(0, 100)})`);
        }
      }

      if (
        error.message?.includes("could not decode result data") ||
        error.message?.includes("BAD_DATA") ||
        error.message?.includes('value="0x"')
      ) {
        const errorMsg = `Le contrat à l'adresse ${payment.contractAddress} n'a pas la méthode released() ou retourne des données invalides. Code length: ${
          code?.length || 0
        }. Vérifiez que c'est bien un contrat ScheduledPayment valide.`;
        console.error(`   ❌ ${errorMsg}`);
        console.error(`   📋 Erreur détaillée: ${error.message}`);

        if (timeUntilFromDB > 0) {
          console.log(`   ⚠️ Erreur de décodage mais release_time pas encore atteint (${Math.floor(timeUntilFromDB / 60)}m restantes)`);
          console.log(`   ✅ Paiement reste en PENDING, on réessaiera plus tard`);
          return;
        } else if (timeUntilFromDB <= -300) {
          console.log(`   ⚠️ Release_time passé depuis ${Math.floor(-timeUntilFromDB / 60)}m, marquant comme failed`);
          await markScheduledAsFailed(payment.id, errorMsg);
        } else {
          console.log(`   ⚠️ Erreur de décodage mais release_time vient d'être atteint, on réessaiera au prochain check`);
          console.log(`   ✅ Paiement reste en PENDING pour le moment`);
        }
        return;
      }

      throw error;
    }

    if (released) {
      console.log(`   ✅ Already released`);
      await markScheduledAsReleased(payment.id, "already_released");
      return;
    }

    // Vérifier le temps depuis le contrat (pour confirmation)
    let releaseTime;
    try {
      releaseTime = await contract.releaseTime();
      const timeUntil = Number(releaseTime) - now;

      console.log(`   ⏰ Release time (on-chain): ${new Date(Number(releaseTime) * 1000).toLocaleString()}`);

      if (timeUntil > 0) {
        const minutes = Math.floor(timeUntil / 60);
        const seconds = timeUntil % 60;
        console.log(`   ⏳ Encore ${minutes}m ${seconds}s (vérification on-chain)`);
        return;
      }
    } catch (error) {
      if (
        error.message?.includes("could not decode result data") ||
        error.message?.includes("BAD_DATA") ||
        error.message?.includes('value="0x"')
      ) {
        const errorMsg = `Le contrat à l'adresse ${payment.contractAddress} n'a pas la méthode releaseTime(). Vérifiez que c'est bien un contrat ScheduledPayment valide.`;
        console.error(`   ❌ ${errorMsg}`);
        console.error(`   📋 Erreur détaillée: ${error.message}`);

        if (timeUntilFromDB <= -300) {
          await markScheduledAsFailed(payment.id, errorMsg);
        } else {
          console.log(`   ⚠️ Erreur de décodage mais release_time vient d'être atteint, on réessaiera au prochain check`);
        }
        return;
      }
      throw error;
    }

    // 🎯 EXÉCUTER
    console.log(`   💸 Executing release()...`);
    const tx = await contract.release();
    console.log(`   📤 TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`   ✅ SUCCESS! Block: ${receipt.blockNumber}`);
    console.log(`   🔗 ${EXPLORER_BASE}/tx/${tx.hash}`);

    await markScheduledAsReleased(payment.id, tx.hash);

    // 🟣 Emit event (Albert)
    await emitEvent({
      type: "SCHEDULED_RELEASED",
      paymentId: payment.id,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      contractAddress: payment.contractAddress,
      tokenSymbol: payment.tokenSymbol,
      isBatch: payment.isBatch,
    });
  } catch (error) {
    const errorMsg = error.message || error.toString();

    console.error(`   ❌ Error dans executeScheduledPayment:`, errorMsg.substring(0, 300));

    if (error.data) console.error(`   📋 Error data:`, error.data);
    if (error.reason) console.error(`   📋 Error reason:`, error.reason);

    try {
      const dbReleaseTime = Number(payment.releaseTime);
      const now = Math.floor(Date.now() / 1000);
      const timeUntilFromDB = dbReleaseTime - now;

      console.log(
        `   🔍 Vérification release_time dans catch: ${new Date(dbReleaseTime * 1000).toLocaleString()}, maintenant: ${new Date(now * 1000).toLocaleString()}, temps restant: ${Math.floor(
          timeUntilFromDB / 60
        )}m ${timeUntilFromDB % 60}s`
      );

      if (errorMsg.includes("Already released")) {
        console.log(`   ✅ Already released`);
        await markScheduledAsReleased(payment.id, "already_released");
      } else if (timeUntilFromDB > 60) {
        console.log(
          `   ⚠️ Erreur mais release_time pas encore atteint (${Math.floor(timeUntilFromDB / 60)}m ${timeUntilFromDB % 60}s restantes), on réessaiera plus tard`
        );
        console.log(`   📋 Erreur capturée: ${errorMsg.substring(0, 200)}`);
        console.log(`   ✅ Paiement reste en PENDING, ne sera PAS marqué comme failed`);

        // 🟣 Emit event (Albert) - optionnel (bruit faible)
        await emitEvent({
          type: "SCHEDULED_TEMP_ERROR",
          paymentId: payment.id,
          error: errorMsg.substring(0, 200),
          note: "release_time_not_reached",
        });

        return;
      } else if (timeUntilFromDB <= -300) {
        console.log(`   ⚠️ Release_time passé depuis ${Math.floor(-timeUntilFromDB / 60)}m, marquant comme failed`);
        await markScheduledAsFailed(payment.id, errorMsg);
      } else {
        console.log(`   ⚠️ Erreur mais release_time vient d'être atteint (${Math.floor(timeUntilFromDB / 60)}m), on réessaiera au prochain check`);
        console.log(`   📋 Erreur: ${errorMsg.substring(0, 200)}`);
        console.log(`   ✅ Paiement reste en PENDING pour le moment`);
        return;
      }
    } catch (timeCheckError) {
      console.error(`   ❌ Erreur lors de la vérification du release_time:`, timeCheckError.message);
      console.log(`   ✅ Par sécurité, on ne marque PAS le paiement comme failed`);
    }
  }
}

// ============================================================
// EXÉCUTION PAIEMENTS RÉCURRENTS
// ============================================================

async function executeRecurringPayment(payment) {
  try {
    const contract = new ethers.Contract(payment.contractAddress, RECURRING_PAYMENT_ABI, wallet);

    // ✅ FIX CRITIQUE : Simplifier au maximum
    // Appeler directement executeMonthlyPayment() - le contrat a toutes les vérifications
    // et revertra avec un message clair si les conditions ne sont pas remplies

    console.log(`   💸 Attempting to execute monthly payment...`);
    console.log(`   📋 Contract will revert with clear message if conditions not met`);

    // 🎯 EXÉCUTER DIRECTEMENT - Le contrat décidera
    const tx = await contract.executeMonthlyPayment();
    console.log(`   📤 TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`   ✅ TX SUCCESS! Block: ${receipt.blockNumber}`);
    console.log(`   🔗 ${EXPLORER_BASE}/tx/${tx.hash}`);

    // Pause après confirmation pour que le RPC mette à jour le nonce avant le prochain recurring (évite "nonce already used")
    if (RECURRING_POST_CONFIRM_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, RECURRING_POST_CONFIRM_DELAY_MS));
    }

    // ✅ FIX CRITIQUE : VÉRIFIER LES EVENTS pour savoir si le paiement a vraiment réussi
    // Le contrat peut retourner SUCCESS même si le transfert a échoué (strict skip)
    console.log(`   🔍 Checking events to verify if payment succeeded or failed...`);

    // Event signatures (contract has monthNumber indexed → in topics, data = 3 uints only)
    const MONTHLY_PAYMENT_EXECUTED_TOPIC = ethers.id("MonthlyPaymentExecuted(uint256,address,uint256,uint256,uint256)");
    const MONTHLY_PAYMENT_FAILED_TOPIC = ethers.id("MonthlyPaymentFailed(uint256,address,string)");

    let paymentSucceeded = false;
    let paymentFailed = false;
    let failureReason = null;
    let failedMonthNumber = null;
    let executedMonthNumber = null;

    for (const log of receipt.logs) {
      if (log.topics[0] === MONTHLY_PAYMENT_EXECUTED_TOPIC) {
        console.log(`   ✅ Event MonthlyPaymentExecuted detected - Payment succeeded!`);
        paymentSucceeded = true;
        try {
          // ✅ Contrat : monthNumber et payee sont indexed → monthNumber dans topics[1]
          const iface = new ethers.Interface([
            "event MonthlyPaymentExecuted(uint256 indexed monthNumber, address indexed payee, uint256 amount, uint256 protocolFee, uint256 nextPaymentDate)"
          ]);
          const decoded = iface.parseLog({ topics: log.topics, data: log.data });
          executedMonthNumber = Number(decoded.args.monthNumber || 0);
          console.log(`   📊 Event decoded: monthNumber=${executedMonthNumber} (1-based from contract)`);
        } catch (e) {
          console.log(`   ⚠️ Could not decode MonthlyPaymentExecuted event: ${e.message}`);
        }
        break;
      } else if (log.topics[0] === MONTHLY_PAYMENT_FAILED_TOPIC) {
        console.log(`   ⚠️ Event MonthlyPaymentFailed detected - Payment failed (strict skip)!`);
        paymentFailed = true;
        // Décoder la raison de l'échec
        try {
          const iface = new ethers.Interface([
            "event MonthlyPaymentFailed(uint256 indexed monthNumber, address indexed payer, string reason)"
          ]);
          const decoded = iface.parseLog({ topics: log.topics, data: log.data });
          failureReason = decoded.args.reason;
          failedMonthNumber = Number(decoded.args.monthNumber || 0);
          console.log(`   📋 Failure reason: ${failureReason}`);
        } catch (e) {
          console.log(`   ⚠️ Could not decode failure reason: ${e.message}`);
        }
        break;
      }
    }

    if (!paymentSucceeded && !paymentFailed) {
      console.log(`   ⚠️ No MonthlyPaymentExecuted or MonthlyPaymentFailed event found - unexpected!`);
      // Fallback: vérifier le statut du contrat
    }

    // Lire le nouveau état du contrat après l'exécution
    try {
      const newExecutedMonths = await contract.executedMonths();
      const totalMonthsOnChain = await contract.totalMonths();
      let nextMonthToProcessOnChain = 0n;
      let startDateOnChain = 0n;

      try {
        // Essayer de lire nextMonthToProcess et startDate si disponibles
        // (peut ne pas exister dans les anciennes versions)
        const nextMonthToProcessFunc = contract.nextMonthToProcess;
        if (nextMonthToProcessFunc) {
          nextMonthToProcessOnChain = await contract.nextMonthToProcess();
        }
        startDateOnChain = await contract.startDate();
      } catch (e) {
        // Si ces fonctions n'existent pas, utiliser les valeurs par défaut
        console.log(`   ⚠️ Impossible de lire nextMonthToProcess/startDate (ancienne version?), utilisation valeurs par défaut`);
      }

      // ✅ FIX CRITIQUE : Mettre à jour la DB selon le résultat réel du paiement
      if (paymentSucceeded) {
        // Paiement réussi : déterminer l'index du mois exécuté (0-based).
        // Après un skip, executedMonths ne correspond pas à l'index du dernier mois exécuté → ne pas l'utiliser.
        let executedMonthIndex = null;
        if (executedMonthNumber !== null && executedMonthNumber > 0) {
          executedMonthIndex = executedMonthNumber - 1;
          console.log(`   📊 Using month from event: ${executedMonthNumber} → index ${executedMonthIndex}`);
        } else if (nextMonthToProcessOnChain > 0n) {
          executedMonthIndex = Number(nextMonthToProcessOnChain) - 1;
          console.log(`   📊 Using nextMonthToProcess: ${Number(nextMonthToProcessOnChain)} → index ${executedMonthIndex}`);
        } else {
          console.warn(`   ⚠️ Cannot determine executed month index (event decode failed, nextMonthToProcess=0). Not updating monthly_statuses to avoid overwriting a failed month.`);
        }

        console.log(`   📊 Executed month index: ${executedMonthIndex} (from event=${executedMonthNumber}, nextMonthToProcess=${Number(nextMonthToProcessOnChain)}, executedMonths=${Number(newExecutedMonths)})`);
        const monthlyStatusUpdate = executedMonthIndex !== null ? { [executedMonthIndex]: 'executed' } : null;

        await updateRecurringAfterExecution(
          payment.id,
          tx.hash,
          Number(newExecutedMonths),
          Number(totalMonthsOnChain),
          nextMonthToProcessOnChain > 0n ? Number(nextMonthToProcessOnChain) : null,
          startDateOnChain > 0n ? Number(startDateOnChain) : null,
          monthlyStatusUpdate
        );

        if (payment.userId) {
          await addTimelineEvent({
            payment_id: payment.id,
            user_id: payment.userId,
            event_type: "payment_executed",
            event_label: "Paiement exécuté",
            actor_type: "system",
            actor_label: "Confidance",
            explanation: "Paiement exécuté avec succès",
            metadata: {
              amount: payment.monthlyAmount,
              currency: payment.tokenSymbol,
              gas_fee: 0,
              protocol_fee: 0,
              payment_type: "recurring",
              category: payment.category || null,
              tx_hash: tx.hash
            }
          });
        }
      } else if (paymentFailed) {
        // Paiement échoué : synchroniser la DB avec l'état du contrat (le mois a été skip)
        console.log(`   ⚠️ Payment failed - synchronizing DB with contract state (month skipped)`);
        // failedMonthNumber est 1-based dans l'événement, convertir en 0-based pour la DB
        const failedMonthIndex = failedMonthNumber > 0 ? failedMonthNumber - 1 : Number(newExecutedMonths) - 1;
        const totalMonthsNum = Number(totalMonthsOnChain);

        // ✅ Mois 1 (index 0) échoué = contrat annulé : status cancelled + toutes les autres échéances cancelled
        const isFirstMonthFailed = failedMonthIndex === 0;
        let monthlyStatusUpdate = { [failedMonthIndex]: 'failed' };
        if (isFirstMonthFailed && totalMonthsNum > 1) {
          for (let i = 1; i < totalMonthsNum; i++) monthlyStatusUpdate[i] = 'cancelled';
          console.log(`   📋 Month 1 failed → recurring cancelled, all future months marked cancelled`);
        }

        const existingStatus = await getMonthlyStatus(payment.id, failedMonthIndex);

        await updateRecurringAfterExecution(
          payment.id,
          "skipped_" + tx.hash, // Préfixe "skipped_" pour indiquer que c'est un skip
          Number(newExecutedMonths),
          totalMonthsNum,
          nextMonthToProcessOnChain > 0n ? Number(nextMonthToProcessOnChain) : null,
          startDateOnChain > 0n ? Number(startDateOnChain) : null,
          monthlyStatusUpdate,
          isFirstMonthFailed ? 'cancelled' : null
        );

        // Émettre un event pour notifier l'échec
        await emitEvent({
          type: "RECURRING_MONTH_SKIPPED",
          paymentId: payment.id,
          txHash: tx.hash,
          reason: failureReason || "Unknown",
          executedMonths: Number(newExecutedMonths),
          totalMonths: Number(totalMonthsOnChain),
        });

        if (existingStatus !== "failed") {
          const monthNumber = failedMonthNumber > 0 ? failedMonthNumber : failedMonthIndex + 1;
          await notifyRecurringFailureEmail({
            paymentId: payment.id,
            reason: failureReason || "Unknown",
            monthNumber,
          });
        }
      } else {
        // Cas inattendu : mettre à jour quand même mais avec un warning
        console.log(`   ⚠️ Unexpected: no clear success or failure event, updating DB anyway`);
        await updateRecurringAfterExecution(
          payment.id,
          tx.hash,
          Number(newExecutedMonths),
          Number(totalMonthsOnChain),
          nextMonthToProcessOnChain > 0n ? Number(nextMonthToProcessOnChain) : null,
          startDateOnChain > 0n ? Number(startDateOnChain) : null
        );
      }
    } catch (e) {
      console.error(`   ⚠️ Erreur lecture état après exécution:`, e.message);
      // Mettre à jour avec ce qu'on a
      await updateRecurringAfterExecution(
        payment.id,
        tx.hash,
        Number(payment.executedMonths) + 1,
        Number(payment.totalMonths)
      );
    }
  } catch (error) {
    const errorMsg = error.message || error.toString();

    // ✅ FIX : Distinguer les vraies erreurs RPC/infra des erreurs de contrat (ne pas marquer failed)
    const rpcErrorCode = error.info?.error?.code;
    const isRealRpcError = (
      rpcErrorCode === -32016 || // over rate limit
      rpcErrorCode === -32011 || // no backend is currently healthy to serve traffic
      (errorMsg.includes("rate limit") && errorMsg.includes("missing revert data"))
    );

    if (isRealRpcError) {
      console.log(`   ⚠️ Erreur RPC temporaire (code=${rpcErrorCode}): ${errorMsg.substring(0, 150)}`);
      if (error.info && error.info.error) {
        console.log(`   📋 Détails RPC: code=${error.info.error.code}, message=${error.info.error.message}`);
      }
      console.log(`   ✅ Réessai automatique au prochain cycle`);
      return; // Ne pas marquer comme failed, juste attendre
    }

    // ✅ FIX : Gérer "Too early for this payment" sans marquer comme failed
    if (
      errorMsg.includes("Too early for this payment") ||
      errorMsg.includes("Payment not started yet") ||
      errorMsg.includes("This month already executed")
    ) {
      console.log(`   ⏳ Payment not ready yet: ${errorMsg.substring(0, 100)}`);
      console.log(`   ✅ Will retry automatically when ready`);
      return; // Ne pas marquer comme failed, juste attendre
    }

    if (errorMsg.includes("All payment periods completed")) {
      console.log(`   ✅ Payment completed on-chain, syncing DB as completed`);
      try {
        const contract = new ethers.Contract(payment.contractAddress, RECURRING_PAYMENT_ABI, wallet);
        const executedMonthsOnChain = await contract.executedMonths();
        const totalMonthsOnChain = await contract.totalMonths();

        await updateRecurringAfterExecution(
          payment.id,
          "completed",
          Number(executedMonthsOnChain),
          Number(totalMonthsOnChain)
        );
      } catch (syncError) {
        console.error(`   ⚠️ Erreur synchronisation DB (completed):`, syncError.message);
      }
      return;
    }

    // ⚠️ Skip-on-failure : Balance insuffisante ou transfert échoué
    // ✅ FIX CRITIQUE : Le contrat a déjà skip le mois (strict skip)
    // Il faut synchroniser la DB avec l'état du contrat
    if (
      errorMsg.includes("Insufficient balance") ||
      errorMsg.includes("ERC20: transfer amount exceeds balance") ||
      errorMsg.includes("Transfer failed") ||
      errorMsg.includes("Insufficient allowance") ||
      errorMsg.includes("ALLOWANCE_TOO_LOW")
    ) {
      console.log(`   ⚠️ Payment failed - month skipped by contract (strict skip)`);
      
      // ✅ FIX CRITIQUE : Synchroniser la DB avec l'état du contrat après le skip
      // Le contrat a déjà marqué le mois comme exécuté et passé au suivant
      try {
        const contract = new ethers.Contract(payment.contractAddress, RECURRING_PAYMENT_ABI, wallet);
        const executedMonthsOnChain = await contract.executedMonths();
        const totalMonthsOnChain = await contract.totalMonths();
        
        console.log(`   📊 Contract state after skip: executedMonths=${Number(executedMonthsOnChain)}`);
        
        // Essayer de lire nextMonthToProcess et startDate si disponibles
        let nextMonthToProcessOnChain = null;
        let startDateOnChain = null;
        
        try {
          const nextMonthToProcessFunc = contract.nextMonthToProcess;
          if (nextMonthToProcessFunc) {
            nextMonthToProcessOnChain = await contract.nextMonthToProcess();
          }
          startDateOnChain = await contract.startDate();
        } catch (e) {
          // Si ces fonctions n'existent pas, utiliser les valeurs par défaut
        }
        
        // Calculer le prochain next_execution_time basé sur nextMonthToProcess
        const now = Math.floor(Date.now() / 1000);
        const isCompleted = Number(executedMonthsOnChain) >= Number(totalMonthsOnChain);
        let nextExecutionTime;
        
        if (nextMonthToProcessOnChain !== null && startDateOnChain !== null && !isCompleted) {
          nextExecutionTime = Number(startDateOnChain) + (Number(nextMonthToProcessOnChain) * MONTH_IN_SECONDS);
        } else {
          nextExecutionTime = isCompleted ? null : now + MONTH_IN_SECONDS;
        }
        
        const newStatus = isCompleted ? "completed" : "active";
        
        // Mettre à jour la DB pour refléter l'état du contrat
        await updateRecurringAfterExecution(
          payment.id, 
          "skipped", 
          Number(executedMonthsOnChain), 
          Number(totalMonthsOnChain),
          nextMonthToProcessOnChain !== null ? Number(nextMonthToProcessOnChain) : null,
          startDateOnChain !== null ? Number(startDateOnChain) : null
        );
        
        console.log(`   ✅ DB synchronized: executed_months=${Number(executedMonthsOnChain)}, status=${newStatus}`);
      } catch (syncError) {
        console.error(`   ⚠️ Erreur synchronisation DB après skip:`, syncError.message);
      }

      // 🟣 Emit event (Albert)
      await emitEvent({
        type: "RECURRING_SKIPPED",
        reason: "INSUFFICIENT_FUNDS",
        paymentId: payment.id,
        error: errorMsg.substring(0, 200),
      });

      return; // Ne pas marquer failed, le mois est déjà skip par le contrat
    }

    console.error(`   ❌ Error:`, errorMsg.substring(0, 300));
    console.error(`   📋 Full error:`, error);

    // 🆕 FIX CRITIQUE: Ne PAS marquer comme "failed" pour les erreurs temporaires
    // Ces erreurs devraient déclencher un retry au prochain cycle
    const isTemporaryError =
      errorMsg.includes('nonce') ||
      errorMsg.includes('NONCE_EXPIRED') ||
      errorMsg.includes('replacement') ||
      errorMsg.includes('REPLACEMENT_UNDERPRICED') ||
      errorMsg.includes('rate limit') ||
      errorMsg.includes('no backend') ||
      errorMsg.includes('healthy to serve traffic') ||
      errorMsg.includes('network') ||
      errorMsg.includes('timeout') ||
      errorMsg.includes('connection') ||
      errorMsg.includes('RPC');

    if (isTemporaryError) {
      console.log(`   ℹ️ Erreur temporaire détectée, le paiement sera réessayé au prochain cycle`);
      console.log(`   ✅ Paiement ${payment.id.substring(0, 8)} reste en "${payment.status}", ne sera PAS marqué comme failed`);

      await emitEvent({
        type: "RECURRING_TEMP_ERROR",
        paymentId: payment.id,
        error: errorMsg.substring(0, 200),
        note: "will_retry_next_cycle"
      });
    } else {
      // Erreur permanente, marquer comme failed
      await markRecurringAsFailed(payment.id, errorMsg);
    }
  }
}

// ============================================================
// FONCTION PRINCIPALE UNIFIÉE
// ============================================================

let cycleInProgress = false;

async function checkAndExecuteAll() {
  if (cycleInProgress) {
    console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Cycle précédent encore en cours, skip ce tick (évite nonce collision)`);
    return;
  }
  cycleInProgress = true;
  try {
    lastCheckTime = new Date().toISOString();
    console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Checking all payments...`);

    // Charger les 2 types de paiements
    scheduledPayments = await loadScheduledPayments();
    recurringPayments = await loadRecurringPayments();

    const totalPayments = scheduledPayments.length + recurringPayments.length;

    if (totalPayments === 0) {
      console.log("😴 No payments to execute");
      return;
    }

    console.log(`📋 Found: ${scheduledPayments.length} scheduled, ${recurringPayments.length} recurring`);

    // EXÉCUTER SCHEDULED (single + batch) — inchangé
    for (const payment of scheduledPayments) {
      console.log(`\n${payment.name}`);
      await executeScheduledPayment(payment);
      if (DELAY_BETWEEN_PAYMENTS_MS > 0) await new Promise((r) => setTimeout(r, DELAY_BETWEEN_PAYMENTS_MS));
    }

    // EXÉCUTER RECURRING : un par un, on attend déjà tx.wait() dans executeRecurringPayment + pause post-confirmation
    for (const payment of recurringPayments) {
      console.log(`\n${payment.name}`);
      await executeRecurringPayment(payment);
      if (DELAY_BETWEEN_PAYMENTS_MS > 0) await new Promise((r) => setTimeout(r, DELAY_BETWEEN_PAYMENTS_MS));
    }
  } finally {
    cycleInProgress = false;
  }
}

// ============================================================
// HEALTH CHECK
// ============================================================

async function healthCheck() {
  try {
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance keeper: ${ethers.formatEther(balance)} ETH`);

    if (balance === 0n) {
      console.warn("⚠️ WARNING: Balance is 0!");

      await emitEvent({
        type: "KEEPER_LOW_BALANCE",
        balanceWei: balance.toString(),
        balanceEth: ethers.formatEther(balance),
      });
    }

    // Vérifier connexion Supabase (2 tables) - Filtrer par réseau
    const { data: scheduled, error: err1 } = await supabase
      .from("scheduled_payments")
      .select("count", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("network", NETWORK_STRING);

    const { data: recurring, error: err2 } = await supabase
      .from("recurring_payments")
      .select("count", { count: "exact", head: true })
      .in("status", ["pending", "active"])
      .eq("network", NETWORK_STRING);

    if (err1 || err2) {
      console.warn("⚠️ WARNING: Supabase connection issue");

      await emitEvent({
        type: "KEEPER_DB_WARNING",
        error1: err1 ? err1.message : null,
        error2: err2 ? err2.message : null,
      });
    } else {
      console.log(`✅ Supabase OK (${scheduled || 0} scheduled, ${recurring || 0} recurring)`);
    }
  } catch (error) {
    console.error("❌ Health check failed:", error.message);

    await emitEvent({
      type: "KEEPER_ERROR",
      scope: "healthCheck",
      error: error.message || String(error),
    });
  }
}

// Self-ping
async function selfPing() {
  try {
    const response = await fetch(`http://localhost:${PORT}/health`);
    if (response.ok) {
      console.log("🏓 Self-ping OK");
    }
  } catch (error) {
    console.log("⚠️ Self-ping failed (normal at startup)");
  }
}

// ============================================================
// DÉMARRAGE
// ============================================================

async function start() {
  console.log("🚀 Starting Keeper V3.2 (USDC Fix + N8N)...\n");
  if (DELAY_BETWEEN_PAYMENTS_MS > 0) {
    console.log(`⏱️ Délai entre paiements: ${DELAY_BETWEEN_PAYMENTS_MS} ms (évite le rate limit RPC)\n`);
  }
  if (RECURRING_POST_CONFIRM_DELAY_MS > 0) {
    console.log(`⏱️ Pause après confirmation recurring: ${RECURRING_POST_CONFIRM_DELAY_MS} ms (évite nonce collision)\n`);
  }

  // 🟣 Notify start (Albert)
  await emitEvent({
    type: "KEEPER_STARTED",
    keeperAddress: wallet.address,
    rpc: RPC_URL,
    port: PORT,
    checkIntervalMs: CHECK_INTERVAL,
  });

  await healthCheck();
  await checkAndExecuteAll();

  setInterval(checkAndExecuteAll, CHECK_INTERVAL);
  setInterval(healthCheck, 5 * 60 * 1000);
  setInterval(selfPing, 5 * 60 * 1000);

  console.log("\n✅ Keeper V3.2 operational! Monitoring ETH + ERC20 + Batch + Recurring...\n");
}

// ============================================================
// ERROR HANDLING
// ============================================================

process.on("unhandledRejection", async (error) => {
  console.error("❌ Unhandled rejection:", error);

  await emitEvent({
    type: "KEEPER_UNHANDLED_REJECTION",
    error: (error?.message || String(error)).substring(0, 500),
  });
});

process.on("SIGTERM", async () => {
  console.log("⚠️ SIGTERM received, graceful shutdown...");

  await emitEvent({
    type: "KEEPER_STOPPED",
    reason: "SIGTERM",
  });

  process.exit(0);
});

// LAUNCH!
start().catch(async (e) => {
  console.error(e);

  await emitEvent({
    type: "KEEPER_FATAL_START_ERROR",
    error: (e?.message || String(e)).substring(0, 500),
  });
});

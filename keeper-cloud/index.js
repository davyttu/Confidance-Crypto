require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require('@supabase/supabase-js');
const fs = require("fs");

// ============================================================
// CONFIGURATION
// ============================================================

const NETWORK = process.env.NETWORK || "base";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 60000; // 60 secondes

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ ERREUR : Variables SUPABASE_URL et SUPABASE_KEY manquantes !");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

const http = require('http');
const PORT = process.env.PORT || 3000;

let lastCheckTime = null;
let scheduledPayments = [];
let recurringPayments = [];

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      uptime: process.uptime(),
      lastCheck: lastCheckTime,
      scheduledPayments: scheduledPayments.length,
      recurringPayments: recurringPayments.length,
      totalActive: scheduledPayments.length + recurringPayments.length,
      version: '3.2-USDC-FIX'
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Confidance Crypto Keeper V3.2 - USDC FIX 🚀💰');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

// ============================================================
// BANNER
// ============================================================

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🚀 CONFIDANCE CRYPTO KEEPER V3.2 - USDC FIX");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`🌐 Network: ${NETWORK}`);
console.log(`⏰ Check interval: ${CHECK_INTERVAL / 1000}s`);
console.log(`🗄️ Database: Supabase`);
console.log(`✨ Features: ETH + ERC20 (USDC/USDT) + Batch + Recurring`);
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
  "function release() external"
];

// ABI pour BatchScheduledPayment_V2 (multi)
const BATCH_PAYMENT_ABI = [
  "function releaseTime() view returns (uint256)",
  "function released() view returns (bool)",
  "function release() external"
];

// ABI pour RecurringPaymentERC20 (mensuel)
const RECURRING_PAYMENT_ABI = [
  "function executeMonthlyPayment() external",
  "function executedMonths() view returns (uint256)",
  "function totalMonths() view returns (uint256)",
  "function cancelled() view returns (bool)",
  "function payer() view returns (address)",
  "function payee() view returns (address)",
  "function tokenAddress() view returns (address)",
  "function monthlyAmount() view returns (uint256)",
  "function startDate() view returns (uint256)",
  "function getStatus() view returns (string memory status, uint256 monthsExecuted, uint256 monthsRemaining, uint256 amountPaid, uint256 monthsFailed)"
];

// Constante pour calcul du prochain mois (30 jours)
const MONTH_IN_SECONDS = 2592000;

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
    'ETH': 18,
    'USDC': 6,
    'USDT': 6,
    'DAI': 18
  };
  return decimalsMap[symbol] || 18;
}

// ============================================================
// CHARGEMENT PAIEMENTS PROGRAMMÉS (SINGLE + BATCH)
// ⚡ MODIFICATION V3.1: Les paiements instantanés sont IGNORÉS
//    car ils sont déjà exécutés dans le constructor (0 délai)
// ============================================================

async function loadScheduledPayments() {
  try {
    const { data, error } = await supabase
      .from('scheduled_payments')
      .select('*')
      .eq('status', 'pending')
      .eq('is_instant', false) // ⚡ Ignorer les paiements instantanés (déjà exécutés)
      .order('release_time', { ascending: true });
    
    if (error) {
      console.error("❌ Erreur scheduled_payments:", error.message);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    const payments = data.map(row => {
      const isBatch = row.is_batch === true;
      const batchCount = row.batch_count || 0;
      const tokenSymbol = row.token_symbol || 'ETH';
      const isERC20 = tokenSymbol !== 'ETH';
      
      // ✅ FIX : Formater correctement le montant selon le token
      const formattedAmount = formatAmount(row.amount, tokenSymbol);
      
      return {
        type: 'scheduled',
        subType: isBatch ? 'batch' : (isERC20 ? 'single_erc20' : 'single_eth'),
        id: row.id,
        contractAddress: row.contract_address,
        releaseTime: row.release_time,
        amount: row.amount,
        tokenSymbol: tokenSymbol,
        tokenAddress: row.token_address,
        isERC20: isERC20,
        isBatch: isBatch,
        batchCount: batchCount,
        name: isBatch 
          ? `📦 Batch #${row.id.substring(0, 8)} (${batchCount} benef, ${formattedAmount})`
          : `💎 Payment #${row.id.substring(0, 8)} (${formattedAmount})`
      };
    });
    
    return payments;
    
  } catch (error) {
    console.error("❌ Erreur loadScheduledPayments:", error.message);
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
      .from('recurring_payments')
      .select('*')
      .in('status', ['pending', 'active'])
      .lte('next_execution_time', now)
      .order('next_execution_time', { ascending: true });
    
    if (error) {
      console.error("❌ Erreur recurring_payments:", error.message);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    const payments = data.map(row => ({
      type: 'recurring',
      id: row.id,
      contractAddress: row.contract_address,
      tokenSymbol: row.token_symbol,
      monthlyAmount: row.monthly_amount,
      totalMonths: row.total_months,
      executedMonths: row.executed_months,
      nextExecutionTime: row.next_execution_time,
      status: row.status,
      name: `🔄 Recurring #${row.id.substring(0, 8)} (${row.token_symbol}, ${row.executed_months}/${row.total_months} mois)`
    }));
    
    return payments;
    
  } catch (error) {
    console.error("❌ Erreur loadRecurringPayments:", error.message);
    return [];
  }
}

// ============================================================
// MISE À JOUR DATABASE - SCHEDULED
// ============================================================

async function markScheduledAsReleased(paymentId, txHash) {
  try {
    const { error } = await supabase
      .from('scheduled_payments')
      .update({ 
        status: 'released',
        tx_hash: txHash,
        executed_at: new Date().toISOString()
      })
      .eq('id', paymentId);
    
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
    const { error } = await supabase
      .from('scheduled_payments')
      .update({ 
        status: 'failed',
        error_message: errorMsg.substring(0, 500),
        executed_at: new Date().toISOString(), // ✅ FIX : Utiliser executed_at au lieu de failed_at
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);
    
    if (error) {
      console.error("❌ Erreur update failed:", error.message);
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
      .from('recurring_payments')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', paymentId);
    
    if (error) {
      console.error("❌ Erreur update cancelled:", error.message);
    }
  } catch (error) {
    console.error("❌ Erreur markRecurringAsCancelled:", error.message);
  }
}

async function updateRecurringAfterExecution(paymentId, txHash, executedMonths, totalMonths) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const isCompleted = executedMonths >= totalMonths;
    const nextExecutionTime = isCompleted ? null : now + MONTH_IN_SECONDS;
    const newStatus = isCompleted ? 'completed' : 'active';
    
    const { error } = await supabase
      .from('recurring_payments')
      .update({
        executed_months: executedMonths,
        next_execution_time: nextExecutionTime,
        last_execution_hash: txHash,
        last_execution_at: new Date().toISOString(),
        status: newStatus
      })
      .eq('id', paymentId);
    
    if (error) {
      console.error("❌ Erreur update recurring:", error.message);
    } else {
      console.log(`   ✅ DB updated: executed_months = ${executedMonths}/${totalMonths}, status = ${newStatus}`);
    }
  } catch (error) {
    console.error("❌ Erreur updateRecurringAfterExecution:", error.message);
  }
}

async function markRecurringAsFailed(paymentId, errorMsg) {
  try {
    const { error } = await supabase
      .from('recurring_payments')
      .update({
        status: 'failed',
        error_message: errorMsg.substring(0, 500),
        last_execution_at: new Date().toISOString(), // ✅ FIX : Utiliser last_execution_at au lieu de failed_at
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);
    
    if (error) {
      console.error("❌ Erreur update failed:", error.message);
    }
  } catch (error) {
    console.error("❌ Erreur markRecurringAsFailed:", error.message);
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
    
    // Choisir le bon ABI
    const abi = payment.isBatch ? BATCH_PAYMENT_ABI : SCHEDULED_PAYMENT_ABI;
    const contract = new ethers.Contract(payment.contractAddress, abi, wallet);

    // Vérifier si déjà libéré
    const released = await contract.released();
    if (released) {
      console.log(`   ✅ Already released`);
      await markScheduledAsReleased(payment.id, 'already_released');
      return;
    }

    // Vérifier le temps
    const releaseTime = await contract.releaseTime();
    const timeUntil = Number(releaseTime) - now;
    
    console.log(`   ⏰ Release time: ${new Date(Number(releaseTime) * 1000).toLocaleString()}`);
    console.log(`   ⏰ Current time: ${new Date(now * 1000).toLocaleString()}`);

    if (timeUntil > 0) {
      const minutes = Math.floor(timeUntil / 60);
      const seconds = timeUntil % 60;
      console.log(`   ⏳ ${minutes}m ${seconds}s remaining`);
      return;
    }

    // 🎯 EXÉCUTER
    console.log(`   💸 Executing release()...`);
    const tx = await contract.release();
    console.log(`   📤 TX sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`   ✅ SUCCESS! Block: ${receipt.blockNumber}`);
    console.log(`   🔗 https://basescan.org/tx/${tx.hash}`);

    await markScheduledAsReleased(payment.id, tx.hash);

  } catch (error) {
    const errorMsg = error.message || error.toString();
    
    console.error(`   ❌ Error:`, errorMsg.substring(0, 300));
    
    // ✅ Afficher détails supplémentaires
    if (error.data) {
      console.error(`   📋 Error data:`, error.data);
    }
    if (error.reason) {
      console.error(`   📋 Error reason:`, error.reason);
    }
    
    if (errorMsg.includes("Already released")) {
      console.log(`   ✅ Already released`);
      await markScheduledAsReleased(payment.id, 'already_released');
    } else {
      await markScheduledAsFailed(payment.id, errorMsg);
    }
  }
}

// ============================================================
// EXÉCUTION PAIEMENTS RÉCURRENTS
// ============================================================

async function executeRecurringPayment(payment) {
  try {
    const contract = new ethers.Contract(
      payment.contractAddress,
      RECURRING_PAYMENT_ABI,
      wallet
    );

    // Vérifier si annulé
    const cancelled = await contract.cancelled();
    if (cancelled) {
      console.log(`   🚫 Cancelled on-chain`);
      await markRecurringAsCancelled(payment.id);
      return;
    }

    // Récupérer le statut complet via getStatus()
    const [status, monthsExecuted, monthsRemaining, amountPaid, monthsFailed] = await contract.getStatus();

    console.log(`   📊 Status: ${status}, Executed: ${monthsExecuted}, Remaining: ${monthsRemaining}, Failed: ${monthsFailed}`);

    // Vérifier si complété
    if (status === 'completed' || monthsRemaining === 0n) {
      console.log(`   ✅ Completed on-chain (${monthsExecuted} months executed)`);
      const totalMonthsOnChain = await contract.totalMonths();
      await updateRecurringAfterExecution(payment.id, 'already_completed', Number(monthsExecuted), Number(totalMonthsOnChain));
      return;
    }

    // 🎯 EXÉCUTER LE MOIS
    console.log(`   💸 Executing month ${Number(monthsExecuted) + 1}...`);
    const tx = await contract.executeMonthlyPayment();
    console.log(`   📤 TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`   ✅ SUCCESS! Block: ${receipt.blockNumber}`);
    console.log(`   🔗 https://basescan.org/tx/${tx.hash}`);

    // Lire le nouveau nombre de mois exécutés
    const newExecutedMonths = await contract.executedMonths();
    const totalMonthsOnChain = await contract.totalMonths();

    await updateRecurringAfterExecution(
      payment.id,
      tx.hash,
      Number(newExecutedMonths),
      Number(totalMonthsOnChain)
    );

  } catch (error) {
    const errorMsg = error.message || error.toString();

    // ⚠️ Skip-on-failure : Balance insuffisante
    if (errorMsg.includes("Insufficient balance") ||
        errorMsg.includes("ERC20: transfer amount exceeds balance") ||
        errorMsg.includes("Transfer failed")) {
      console.log(`   ⚠️ Insufficient balance - skipped (retry next month)`);
      return; // Ne pas marquer failed
    }

    console.error(`   ❌ Error:`, errorMsg.substring(0, 200));
    await markRecurringAsFailed(payment.id, errorMsg);
  }
}

// ============================================================
// FONCTION PRINCIPALE UNIFIÉE
// ============================================================

async function checkAndExecuteAll() {
  const now = Math.floor(Date.now() / 1000);
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

  // EXÉCUTER SCHEDULED (single + batch)
  for (const payment of scheduledPayments) {
    console.log(`\n${payment.name}`);
    await executeScheduledPayment(payment);
  }

  // EXÉCUTER RECURRING
  for (const payment of recurringPayments) {
    console.log(`\n${payment.name}`);
    await executeRecurringPayment(payment);
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
    }
    
    // Vérifier connexion Supabase (2 tables)
    const { data: scheduled, error: err1 } = await supabase
      .from('scheduled_payments')
      .select('count', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    const { data: recurring, error: err2 } = await supabase
      .from('recurring_payments')
      .select('count', { count: 'exact', head: true })
      .in('status', ['pending', 'active']);
      
    if (err1 || err2) {
      console.warn("⚠️ WARNING: Supabase connection issue");
    } else {
      console.log(`✅ Supabase OK (${scheduled || 0} scheduled, ${recurring || 0} recurring)`);
    }
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
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
  console.log("🚀 Starting Keeper V3.2 (USDC Fix)...\n");
  
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

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled rejection:", error);
});

process.on("SIGTERM", () => {
  console.log("⚠️ SIGTERM received, graceful shutdown...");
  process.exit(0);
});

// LAUNCH!
start().catch(console.error);
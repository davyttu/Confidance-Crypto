const fs = require("fs");


const networkArg = process.argv[2]; // ex: polygon | arbitrum | avalanche
const envFile = networkArg ? `.env.${networkArg}` : ".env";

if (fs.existsSync(envFile)) {
  require("dotenv").config({ path: envFile });
} else {
  require("dotenv").config();
}

const { ethers } = require("ethers");
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// CONFIGURATION
// ============================================================

const NETWORK = process.env.NETWORK || "base";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 60000; // 60 secondes

// ✅ Mapping NETWORK -> network string pour Supabase
const NETWORK_MAP = {
  'base': 'base_mainnet',
  'polygon': 'polygon_mainnet',
  'arbitrum': 'arbitrum_mainnet',
  'avalanche': 'avalanche_mainnet'
};
const NETWORK_STRING = NETWORK_MAP[NETWORK] || `chain_${NETWORK}`;

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
console.log(`🌐 Network: ${NETWORK} (${NETWORK_STRING})`);
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
  "function cancelled() view returns (bool)",
  "function release() external"
];

// ABI pour BatchScheduledPayment_V2 (multi)
const BATCH_PAYMENT_ABI = [
  "function releaseTime() view returns (uint256)",
  "function released() view returns (bool)",
  "function release() external",
  "function cancelled() view returns (bool)"  // ✅ AJOUTÉ
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
      .from('scheduled_payments')
      .select('*')
      .eq('status', 'pending')
      .or('is_instant.is.null,is_instant.eq.false') // Inclure null OU false (exclure true)
      .eq('network', NETWORK_STRING) // ✅ Filtrer par réseau
      .order('release_time', { ascending: true });
    
    const { data, error } = await query;
    
    if (error) {
      console.error("❌ Erreur scheduled_payments:", error.message);
      return [];
    }
    
    // ✅ Logs de débogage
    if (!data || data.length === 0) {
      console.log("📋 Aucun paiement scheduled pending trouvé");
      console.log(`   🔍 Filtres appliqués: status=pending, network=${NETWORK_STRING}, is_instant=null|false`);
      
      // ✅ DEBUG : Vérifier s'il y a des paiements failed récemment
      const { data: failedPayments } = await supabase
        .from('scheduled_payments')
        .select('id, status, error_message, updated_at')
        .eq('network', NETWORK_STRING)
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(3);
      
      if (failedPayments && failedPayments.length > 0) {
        console.log(`   ⚠️ DEBUG: ${failedPayments.length} paiement(s) failed récent(s) trouvé(s):`);
        failedPayments.forEach(p => {
          console.log(`      - ${p.id.substring(0, 8)}: ${p.error_message?.substring(0, 100) || 'no error message'} (${p.updated_at})`);
        });
      }
      
      return [];
    }
    
    console.log(`📦 ${data.length} paiement(s) scheduled chargé(s) depuis Supabase`);
    
    // ✅ Log des IDs et réseaux pour débogage
    if (data.length > 0) {
      const ids = data.map(row => row.id.substring(0, 8)).join(', ');
      const networks = data.map(row => row.network || 'null').join(', ');
      const statuses = data.map(row => row.status || 'null').join(', ');
      console.log(`   IDs: ${ids}`);
      console.log(`   Networks: ${networks}`);
      console.log(`   Statuses: ${statuses}`);
    }
    
    // ✅ Mapper TOUS les paiements pending (la vérification released se fera dans executeScheduledPayment)
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
          network: row.network, // ✅ Ajouter network pour vérification
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
    // ✅ Vérifier d'abord le release_time ET le réseau avant de marquer comme failed
    const { data: paymentData } = await supabase
      .from('scheduled_payments')
      .select('release_time, status, network')
      .eq('id', paymentId)
      .single();
    
    if (paymentData) {
      // ✅ PROTECTION CRITIQUE : Vérifier que le paiement appartient au bon réseau
      if (paymentData.network && paymentData.network !== NETWORK_STRING) {
        console.log(`   🛡️ PROTECTION: Tentative de marquer comme failed un paiement du réseau ${paymentData.network} (keeper configuré pour ${NETWORK_STRING})`);
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
      if (paymentData.status === 'failed') {
        console.log(`   ℹ️ Paiement ${paymentId.substring(0, 8)} est déjà en "failed", pas de mise à jour`);
        return;
      }
    }
    
    console.log(`   ⚠️ [markScheduledAsFailed] Marquant le paiement ${paymentId.substring(0, 8)} comme FAILED`);
    console.log(`   📋 Raison: ${errorMsg.substring(0, 200)}`);
    console.log(`   📍 Stack trace:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));
    
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
    } else {
      console.log(`   ✅ DB updated: scheduled_payments → failed`);
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
    console.log(`   📍 Token Address: ${payment.tokenAddress}`);
    console.log(`   🆔 Payment ID: ${payment.id}`);
    console.log(`   🌐 Payment Network: ${payment.network || 'null'}`);
    console.log(`   🌐 Keeper Network: ${NETWORK_STRING}`);
    
    // ✅ FIX CRITIQUE : Vérifier que le paiement appartient au bon réseau
    // Cela évite que le keeper Polygon vérifie un contrat Base (ou vice versa)
    if (payment.network && payment.network !== NETWORK_STRING) {
      console.log(`   ⚠️ Paiement appartient au réseau ${payment.network} mais keeper est configuré pour ${NETWORK_STRING}`);
      console.log(`   ✅ Ignorant ce paiement (sera traité par le bon keeper)`);
      return; // Ne pas traiter ce paiement, il sera traité par le bon keeper
    }
    
    // ✅ FIX CRITIQUE : Vérifier d'abord le release_time depuis la DB
    // Cela évite d'appeler le contrat et de marquer comme failed si ce n'est pas encore l'heure
    const dbReleaseTime = Number(payment.releaseTime);
    const timeUntilFromDB = dbReleaseTime - now;
    
    console.log(`   ⏰ Release time (DB): ${new Date(dbReleaseTime * 1000).toLocaleString()}`);
    console.log(`   ⏰ Current time: ${new Date(now * 1000).toLocaleString()}`);
    
    if (timeUntilFromDB > 0) {
      const minutes = Math.floor(timeUntilFromDB / 60);
      const seconds = timeUntilFromDB % 60;
      console.log(`   ⏳ Encore ${minutes}m ${seconds}s (vérification depuis DB, pas d'appel contrat)`);
      console.log(`   ✅ Paiement reste en PENDING, aucun appel au contrat avant le release_time`);
      return; // Ne pas vérifier le contrat si ce n'est pas encore l'heure
    }
    
    // ✅ PROTECTION : Ne jamais appeler le contrat si le release_time n'est pas encore atteint
    // Cette vérification supplémentaire évite tout appel accidentel
    if (timeUntilFromDB > 0) {
      console.log(`   ⚠️ PROTECTION: Release_time pas encore atteint, retour anticipé`);
      return;
    }

    // ✅ FIX CRITIQUE : Vérifier que contractAddress n'est pas l'adresse du token
    const knownTokenAddresses = [
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC Base
      '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDT Base
      '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', // DAI Base
      '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', // cbBTC Base
      '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', // WBTC Base
    ];
    
    const isTokenAddress = knownTokenAddresses.some(
      addr => addr.toLowerCase() === payment.contractAddress?.toLowerCase()
    );
    
    if (isTokenAddress) {
      console.error(`   ❌ ERREUR CRITIQUE: contract_address contient l'adresse du token au lieu du contrat de paiement !`);
      console.error(`   📍 Contract Address (ERREUR): ${payment.contractAddress}`);
      console.error(`   📍 Token Address: ${payment.tokenAddress}`);
      await markScheduledAsFailed(payment.id, `ERREUR: contract_address contient l'adresse du token (${payment.contractAddress}) au lieu du contrat de paiement. Veuillez corriger manuellement dans la base de données.`);
      return;
    }
    

    // ✅ NOUVEAU : Vérifier d'abord si déjà released (paiement instantané)
const isAlreadyReleased = await checkIfAlreadyReleased(payment.contractAddress);
if (isAlreadyReleased) {
  console.log(`   ✅ Already released (instant payment)`);
  await markScheduledAsReleased(payment.id, 'instant_payment');
  return;
}

// ✅ NOUVEAU : Vérifier si annulé
const isCancelled = await checkIfCancelled(payment.contractAddress);
if (isCancelled) {
  console.log(`   🚫 Cancelled on-chain`);
  await supabase.from('scheduled_payments')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', payment.id);
  return;
}
    // ✅ Vérifier que l'adresse est bien un contrat
    // ⚠️ ATTENTION : On ne vérifie le code que si le release_time est atteint ou proche
    // Si le release_time n'est pas encore atteint, on ne devrait pas être ici (déjà vérifié plus haut)
    console.log(`   🔍 Vérification du code du contrat à ${payment.contractAddress}...`);
    let code;
    try {
      code = await provider.getCode(payment.contractAddress);
    } catch (codeError) {
      console.error(`   ❌ Erreur lors de la vérification du code: ${codeError.message}`);
      // Si on ne peut pas vérifier le code, ne pas marquer comme failed si le release_time n'est pas atteint
      if (timeUntilFromDB > 0) {
        console.log(`   ⚠️ Erreur vérification code mais release_time pas encore atteint, on réessaiera plus tard`);
        return;
      }
      // Si le release_time est atteint, on peut considérer que c'est une erreur réelle
      throw codeError;
    }
    
    if (code === '0x' || code === '0x0' || !code || code.length < 10) {
      const errorMsg = `L'adresse ${payment.contractAddress} n'est pas un contrat valide (code vide ou invalide: ${code?.substring(0, 20)}...)`;
      console.error(`   ❌ ${errorMsg}`);
      // ✅ FIX : Ne marquer comme failed que si le release_time est passé depuis plus de 5 minutes
      // Si le release_time n'est pas encore atteint, on ne devrait pas être ici, mais on double-vérifie
      if (timeUntilFromDB > 0) {
        console.log(`   ⚠️ Code vide mais release_time pas encore atteint (${Math.floor(timeUntilFromDB / 60)}m restantes), on réessaiera plus tard`);
        return; // Ne pas marquer comme failed
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
      // Les contrats InstantPayment ont une méthode executed() au lieu de released()
      if (error.message?.includes('execution reverted') || 
          error.message?.includes('require(false)') ||
          error.message?.includes('CALL_EXCEPTION')) {
        
        // Essayer d'appeler executed() pour vérifier si c'est un InstantPayment
        try {
          console.log(`   🔍 Tentative d'appel à executed() (paiement instantané?)...`);
          const INSTANT_PAYMENT_ABI = ["function executed() view returns (bool)"];
          const instantContract = new ethers.Contract(payment.contractAddress, INSTANT_PAYMENT_ABI, wallet);
          const executed = await instantContract.executed();
          
          if (executed) {
            console.log(`   ✅ C'est un paiement instantané déjà exécuté (executed = true)`);
            console.log(`   ✅ Marquant comme released car déjà exécuté dans le constructor`);
            await markScheduledAsReleased(payment.id, 'instant_payment_already_executed');
            return;
          } else {
            console.log(`   ⚠️ Paiement instantané mais executed = false (anormal)`);
          }
        } catch (executedError) {
          // Ce n'est pas un InstantPayment, continuer avec la gestion d'erreur normale
          console.log(`   ℹ️ Ce n'est pas un InstantPayment (executed() n'existe pas ou erreur: ${executedError.message?.substring(0, 100)})`);
        }
      }
      
      // Si l'erreur est liée au décodage, le contrat n'a probablement pas la méthode released()
      if (error.message?.includes('could not decode result data') || 
          error.message?.includes('BAD_DATA') ||
          error.message?.includes('value="0x"')) {
        const errorMsg = `Le contrat à l'adresse ${payment.contractAddress} n'a pas la méthode released() ou retourne des données invalides. Code length: ${code?.length || 0}. Vérifiez que c'est bien un contrat ScheduledPayment valide.`;
        console.error(`   ❌ ${errorMsg}`);
        console.error(`   📋 Erreur détaillée: ${error.message}`);
        
        // ✅ FIX CRITIQUE : Ne JAMAIS marquer comme failed si le release_time n'est pas encore atteint
        // L'erreur "could not decode" peut arriver si le contrat n'est pas encore complètement déployé
        if (timeUntilFromDB > 0) {
          console.log(`   ⚠️ Erreur de décodage mais release_time pas encore atteint (${Math.floor(timeUntilFromDB / 60)}m restantes)`);
          console.log(`   ✅ Paiement reste en PENDING, on réessaiera plus tard`);
          return; // Ne pas marquer comme failed
        } else if (timeUntilFromDB <= -300) { // 5 minutes après le release_time
          console.log(`   ⚠️ Release_time passé depuis ${Math.floor(-timeUntilFromDB / 60)}m, marquant comme failed`);
          await markScheduledAsFailed(payment.id, errorMsg);
        } else {
          console.log(`   ⚠️ Erreur de décodage mais release_time vient d'être atteint, on réessaiera au prochain check`);
          console.log(`   ✅ Paiement reste en PENDING pour le moment`);
        }
        return;
      }
      // Pour les autres erreurs, re-lancer
      throw error;
    }
    
    if (released) {
      console.log(`   ✅ Already released`);
      await markScheduledAsReleased(payment.id, 'already_released');
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
      if (error.message?.includes('could not decode result data') || 
          error.message?.includes('BAD_DATA') ||
          error.message?.includes('value="0x"')) {
        const errorMsg = `Le contrat à l'adresse ${payment.contractAddress} n'a pas la méthode releaseTime(). Vérifiez que c'est bien un contrat ScheduledPayment valide.`;
        console.error(`   ❌ ${errorMsg}`);
        console.error(`   📋 Erreur détaillée: ${error.message}`);
        
        // Seulement marquer comme failed si le release_time est passé (avec marge de 5 minutes)
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
    console.log(`   🔗 https://basescan.org/tx/${tx.hash}`);

    await markScheduledAsReleased(payment.id, tx.hash);

  } catch (error) {
    const errorMsg = error.message || error.toString();
    
    console.error(`   ❌ Error dans executeScheduledPayment:`, errorMsg.substring(0, 300));
    
    // ✅ Afficher détails supplémentaires
    if (error.data) {
      console.error(`   📋 Error data:`, error.data);
    }
    if (error.reason) {
      console.error(`   📋 Error reason:`, error.reason);
    }
    
    // ✅ FIX CRITIQUE : Ne JAMAIS marquer comme failed si le release_time n'est pas encore atteint
    // Cela évite de marquer comme failed pour des erreurs temporaires ou si le contrat n'est pas encore prêt
    try {
      const dbReleaseTime = Number(payment.releaseTime);
      const now = Math.floor(Date.now() / 1000);
      const timeUntilFromDB = dbReleaseTime - now;
      
      console.log(`   🔍 Vérification release_time dans catch: ${new Date(dbReleaseTime * 1000).toLocaleString()}, maintenant: ${new Date(now * 1000).toLocaleString()}, temps restant: ${Math.floor(timeUntilFromDB / 60)}m ${timeUntilFromDB % 60}s`);
      
      if (errorMsg.includes("Already released")) {
        console.log(`   ✅ Already released`);
        await markScheduledAsReleased(payment.id, 'already_released');
      } else if (timeUntilFromDB > 60) {
        // Le release_time n'est pas encore atteint (avec marge de 1 minute), ne JAMAIS marquer comme failed
        console.log(`   ⚠️ Erreur mais release_time pas encore atteint (${Math.floor(timeUntilFromDB / 60)}m ${timeUntilFromDB % 60}s restantes), on réessaiera plus tard`);
        console.log(`   📋 Erreur capturée: ${errorMsg.substring(0, 200)}`);
        console.log(`   ✅ Paiement reste en PENDING, ne sera PAS marqué comme failed`);
        // Ne pas marquer comme failed, juste logger l'erreur
        return; // Sortir sans marquer comme failed
      } else if (timeUntilFromDB <= -300) {
        // Le release_time est passé depuis plus de 5 minutes, marquer comme failed
        console.log(`   ⚠️ Release_time passé depuis ${Math.floor(-timeUntilFromDB / 60)}m, marquant comme failed`);
        await markScheduledAsFailed(payment.id, errorMsg);
      } else {
        // Le release_time vient juste d'être atteint (entre -5min et +1min), attendre un peu avant de marquer comme failed
        console.log(`   ⚠️ Erreur mais release_time vient d'être atteint (${Math.floor(timeUntilFromDB / 60)}m), on réessaiera au prochain check`);
        console.log(`   📋 Erreur: ${errorMsg.substring(0, 200)}`);
        console.log(`   ✅ Paiement reste en PENDING pour le moment`);
        // Ne pas marquer comme failed immédiatement
        return; // Sortir sans marquer comme failed
      }
    } catch (timeCheckError) {
      // Si on ne peut même pas vérifier le release_time, ne pas marquer comme failed
      console.error(`   ❌ Erreur lors de la vérification du release_time:`, timeCheckError.message);
      console.log(`   ✅ Par sécurité, on ne marque PAS le paiement comme failed`);
      // Ne pas marquer comme failed si on ne peut pas vérifier le release_time
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
    
    // Vérifier connexion Supabase (2 tables) - Filtrer par réseau
    const { data: scheduled, error: err1 } = await supabase
      .from('scheduled_payments')
      .select('count', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('network', NETWORK_STRING); // ✅ Filtrer par réseau
    
    const { data: recurring, error: err2 } = await supabase
      .from('recurring_payments')
      .select('count', { count: 'exact', head: true })
      .in('status', ['pending', 'active'])
      .eq('network', NETWORK_STRING); // ✅ Filtrer par réseau
      
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
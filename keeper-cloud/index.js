require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require('@supabase/supabase-js');
const fs = require("fs");

// Configuration
const NETWORK = process.env.NETWORK || "base";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 60000;

// 🆕 Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ ERREUR : Variables SUPABASE_URL et SUPABASE_KEY manquantes !");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Health check endpoint
const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      uptime: process.uptime(),
      lastCheck: lastCheckTime,
      activePayments: contractsToWatch.length 
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Confidance Crypto Keeper is running! 🚀');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🤖 CONFIDANCE CRYPTO KEEPER v2.0 - DATABASE EDITION");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`🌐 Network: ${NETWORK}`);
console.log(`⏰ Check interval: ${CHECK_INTERVAL / 1000}s`);
console.log(`🗄️  Database: Supabase`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

console.log("👤 Keeper address:", wallet.address);

// ABIs
const SCHEDULED_PAYMENT_ABI = [
  "function releaseTime() view returns (uint256)",
  "function released() view returns (bool)",
  "function release() external"
];

let contractsToWatch = [];
let lastCheckTime = null;

// 🆕 Charger les contrats depuis Supabase
async function loadContractsFromDB() {
  try {
    console.log("📡 Chargement des paiements depuis Supabase...");
    
    const { data, error } = await supabase
      .from('scheduled_payments')
      .select('*')
      .eq('status', 'pending')
      .order('release_time', { ascending: true });
    
    if (error) {
      console.error("❌ Erreur Supabase:", error.message);
      // Fallback sur JSON si DB fail
      return loadContractsFromJSON();
    }
    
    if (!data || data.length === 0) {
      console.log("📋 Aucun paiement en attente dans la DB");
      return [];
    }
    
    const contracts = data.map(row => ({
      id: row.id,
      scheduledPayment: row.contract_address,
      resolver: row.resolver_address,
      beneficiary: row.beneficiary,
      releaseTime: row.release_time,
      amount: row.amount,
      name: `Payment #${row.id} (${row.amount} ETH)`
    }));
    
    console.log(`✅ ${contracts.length} paiement(s) chargé(s) depuis Supabase`);
    return contracts;
    
  } catch (error) {
    console.error("❌ Erreur chargement DB:", error.message);
    return loadContractsFromJSON();
  }
}

// 📄 Fallback JSON (au cas où)
function loadContractsFromJSON() {
  try {
    if (fs.existsSync("deployment-info-base.json")) {
      console.log("⚠️  Fallback sur deployment-info-base.json");
      const info = JSON.parse(fs.readFileSync("deployment-info-base.json", "utf8"));
      return [{
        id: 'json',
        scheduledPayment: info.scheduledPayment,
        resolver: info.resolver,
        releaseTime: info.releaseTime,
        name: `Payment JSON ${new Date(info.releaseTime * 1000).toLocaleString()}`
      }];
    }
  } catch (error) {
    console.error("❌ Erreur chargement JSON:", error.message);
  }
  return [];
}

// 🆕 Marquer un paiement comme exécuté dans la DB
async function markAsReleased(contractId, txHash) {
  try {
    const { error } = await supabase
      .from('scheduled_payments')
      .update({ 
        status: 'released',
        tx_hash: txHash,
        executed_at: new Date().toISOString()
      })
      .eq('id', contractId);
    
    if (error) {
      console.error("❌ Erreur update DB:", error.message);
    } else {
      console.log(`✅ DB mise à jour : Payment #${contractId} → released`);
    }
  } catch (error) {
    console.error("❌ Erreur markAsReleased:", error.message);
  }
}

// 🆕 Marquer un paiement comme échoué
async function markAsFailed(contractId, errorMsg) {
  try {
    const { error } = await supabase
      .from('scheduled_payments')
      .update({ 
        status: 'failed',
        error_message: errorMsg,
        executed_at: new Date().toISOString()
      })
      .eq('id', contractId);
    
    if (error) {
      console.error("❌ Erreur update DB:", error.message);
    }
  } catch (error) {
    console.error("❌ Erreur markAsFailed:", error.message);
  }
}

// Fonction principale de vérification
async function checkAndRelease() {
  const now = Math.floor(Date.now() / 1000);
  lastCheckTime = new Date().toISOString();
  console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Vérification...`);

  // Recharger les contrats depuis la DB à chaque check
  contractsToWatch = await loadContractsFromDB();
  
  if (contractsToWatch.length === 0) {
    console.log("😴 Aucun paiement à surveiller");
    return;
  }

  for (const contract of contractsToWatch) {
    try {
      const scheduledPayment = new ethers.Contract(
        contract.scheduledPayment,
        SCHEDULED_PAYMENT_ABI,
        wallet
      );

      // Vérifier si déjà libéré
      const released = await scheduledPayment.released();
      if (released) {
        console.log(`✅ ${contract.name}: Déjà libéré`);
        // Mettre à jour la DB si pas déjà fait
        if (contract.id !== 'json') {
          await markAsReleased(contract.id, 'already_released');
        }
        continue;
      }

      // Vérifier le temps
      const releaseTime = await scheduledPayment.releaseTime();
      const timeUntil = Number(releaseTime) - now;

      if (timeUntil > 0) {
        const minutes = Math.floor(timeUntil / 60);
        const seconds = timeUntil % 60;
        console.log(`⏱️  ${contract.name}: Encore ${minutes}m ${seconds}s`);
        continue;
      }

      // C'est l'heure ! Exécuter release()
      console.log(`\n🎯 ${contract.name}: PRÊT À LIBÉRER !`);
      console.log(`💸 Exécution de release()...`);

      const tx = await scheduledPayment.release();
      console.log(`📤 Transaction envoyée: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ SUCCÈS ! Block: ${receipt.blockNumber}`);
      console.log(`🔗 https://basescan.org/tx/${tx.hash}\n`);

      // Mettre à jour la DB
      if (contract.id !== 'json') {
        await markAsReleased(contract.id, tx.hash);
      }

    } catch (error) {
      if (error.message.includes("Already released")) {
        console.log(`✅ ${contract.name}: Déjà libéré`);
        if (contract.id !== 'json') {
          await markAsReleased(contract.id, 'already_released');
        }
      } else {
        console.error(`❌ ${contract.name}: Erreur:`, error.message);
        if (contract.id !== 'json') {
          await markAsFailed(contract.id, error.message.substring(0, 500));
        }
      }
    }
  }
}

// Health check
async function healthCheck() {
  try {
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance keeper: ${ethers.formatEther(balance)} ETH`);
    
    if (balance === 0n) {
      console.warn("⚠️  ATTENTION: Balance à 0 !");
    }
    
    // Vérifier connexion Supabase
    const { error } = await supabase.from('scheduled_payments').select('count').single();
    if (error) {
      console.warn("⚠️  ATTENTION: Problème connexion Supabase");
    } else {
      console.log("✅ Connexion Supabase OK");
    }
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
  }
}

// Self-ping pour éviter que Render s'endorme
async function selfPing() {
  try {
    const response = await fetch(`http://localhost:${PORT}/health`);
    if (response.ok) {
      console.log("🏓 Self-ping OK");
    }
  } catch (error) {
    console.log("⚠️  Self-ping failed (normal au démarrage)");
  }
}

// Démarrage
async function start() {
  console.log("🚀 Démarrage du Keeper...\n");
  
  // Health check initial
  await healthCheck();
  
  // Première vérification immédiate
  await checkAndRelease();
  
  // Vérifications périodiques
  setInterval(checkAndRelease, CHECK_INTERVAL);
  
  // Health check toutes les 5 minutes
  setInterval(healthCheck, 5 * 60 * 1000);
  
  // Self-ping toutes les 5 minutes (empêche Render de dormir)
  setInterval(selfPing, 5 * 60 * 1000);
  
  console.log("✅ Keeper opérationnel ! Surveillance active...\n");
}

// Gestion des erreurs
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled rejection:", error);
});

process.on("SIGTERM", () => {
  console.log("⚠️  SIGTERM reçu, arrêt gracieux...");
  process.exit(0);
});

// Lancer !
start().catch(console.error);
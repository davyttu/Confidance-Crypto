require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

// Configuration
const RPC_URL = process.env.RPC_URL || process.env.BASE_RPC || "https://mainnet.base.org";
const CHECK_INTERVAL = 30000; // 30 secondes (plus fréquent)
const API_URL = process.env.API_URL || "http://localhost:3001";

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🤖 CONFIDANCE CRYPTO KEEPER V3");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🌐 Network: Base Mainnet");
console.log(`⏰ Check interval: ${CHECK_INTERVAL / 1000}s`);
console.log(`🔗 API URL: ${API_URL}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Initialiser provider et wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

console.log("👤 Keeper address:", wallet.address);

// ABI pour ScheduledPayment V2
const SCHEDULED_PAYMENT_ABI = [
  "function releaseTime() view returns (uint256)",
  "function released() view returns (bool)",
  "function cancelled() view returns (bool)",
  "function release() external",
  "function getAmounts() view returns (uint256 amountToPayee, uint256 protocolFee, uint256 totalLocked)"
];

// Fonction pour récupérer les paiements depuis l'API
async function fetchReadyPayments() {
  try {
    const response = await fetch(`${API_URL}/api/payments/ready`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.payments || [];
  } catch (error) {
    console.error("❌ Erreur récupération paiements:", error.message);
    return [];
  }
}

// Fonction pour mettre à jour le statut d'un paiement
async function updatePaymentStatus(paymentId, status, executionTxHash = null) {
  try {
    const response = await fetch(`${API_URL}/api/payments/${paymentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        executed_at: new Date().toISOString(),
        execution_tx_hash: executionTxHash
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log(`✅ Statut mis à jour: ${paymentId} → ${status}`);
  } catch (error) {
    console.error("❌ Erreur mise à jour statut:", error.message);
  }
}

// Fonction principale de vérification
async function checkAndRelease() {
  const now = Math.floor(Date.now() / 1000);
  console.log(`⏰ [${new Date().toLocaleTimeString()}] Vérification des paiements...`);

  try {
    // Récupérer les paiements prêts depuis l'API
    const readyPayments = await fetchReadyPayments();
    
    if (readyPayments.length === 0) {
      console.log("😴 Aucun paiement prêt à exécuter\n");
      return;
    }

    console.log(`📋 ${readyPayments.length} paiement(s) prêt(s) à exécuter`);

    for (const payment of readyPayments) {
      try {
        console.log(`\n🔍 Vérification: ${payment.contract_address}`);
        
        const contract = new ethers.Contract(
          payment.contract_address,
          SCHEDULED_PAYMENT_ABI,
          wallet
        );

        // Vérifier le statut
        const released = await contract.released();
        const cancelled = await contract.cancelled();

        if (released) {
          console.log(`✅ Déjà libéré - Mise à jour du statut`);
          await updatePaymentStatus(payment.id, 'executed');
          continue;
        }

        if (cancelled) {
          console.log(`❌ Annulé - Mise à jour du statut`);
          await updatePaymentStatus(payment.id, 'cancelled');
          continue;
        }

        // Vérifier le temps
        const releaseTime = await contract.releaseTime();
        const timeUntil = Number(releaseTime) - now;

        if (timeUntil > 0) {
          const minutes = Math.floor(timeUntil / 60);
          const seconds = timeUntil % 60;
          console.log(`⏱️  Encore ${minutes}m ${seconds}s`);
          continue;
        }

        // C'est l'heure ! Exécuter release()
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🎯 PRÊT À LIBÉRER !`);
        console.log(`📋 ID: ${payment.id}`);
        console.log(`🏠 Contrat: ${payment.contract_address}`);
        console.log(`👤 Payeur: ${payment.payer}`);
        console.log(`👤 Bénéficiaire: ${payment.payee}`);
        console.log(`💰 Montant: ${payment.amount} ${payment.currency}`);
        console.log(`⏰ Date prévue: ${new Date(payment.release_time * 1000).toLocaleString()}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        // Afficher les montants avant release
        try {
          const [amountToPayee, protocolFee, totalLocked] = await contract.getAmounts();
          console.log(`💰 Montants :`);
          console.log(`   Bénéficiaire : ${ethers.formatEther(amountToPayee)} ETH`);
          console.log(`   Protocole : ${ethers.formatEther(protocolFee)} ETH`);
          console.log(`   Total : ${ethers.formatEther(totalLocked)} ETH`);
        } catch (e) {
          console.log(`⚠️  Impossible de lire les montants (contrat V1 ?)`);
        }

        console.log(`\n💸 Exécution de release()...`);
        
        const tx = await contract.release();
        console.log(`📤 Transaction envoyée: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`✅ SUCCÈS ! Block: ${receipt.blockNumber}`);
        console.log(`🔗 https://basescan.org/tx/${tx.hash}`);
        
        // Mettre à jour le statut dans Supabase
        await updatePaymentStatus(payment.id, 'executed', tx.hash);
        
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      } catch (error) {
        console.error(`❌ Erreur traitement paiement ${payment.id}:`, error.message);
        
        // Marquer comme échoué si c'est une erreur critique
        if (error.message.includes("insufficient funds") || 
            error.message.includes("gas") ||
            error.message.includes("revert")) {
          await updatePaymentStatus(payment.id, 'failed');
        }
      }
    }
  } catch (error) {
    console.error("❌ Erreur générale:", error.message);
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
    
    // Test de connexion API
    const response = await fetch(`${API_URL}/health`);
    if (response.ok) {
      console.log(`✅ API connectée: ${API_URL}`);
    } else {
      console.warn(`⚠️  API non accessible: ${API_URL}`);
    }
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
  }
}

// Démarrage
async function start() {
  console.log("🚀 Démarrage du Keeper V3...\n");
  
  // Health check initial
  await healthCheck();
  console.log();
  
  // Première vérification immédiate
  await checkAndRelease();
  
  // Puis vérifications périodiques
  setInterval(checkAndRelease, CHECK_INTERVAL);
  
  // Health check toutes les 5 minutes
  setInterval(healthCheck, 5 * 60 * 1000);
  
  console.log("✅ Keeper V3 opérationnel ! Surveillance Supabase active...\n");
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


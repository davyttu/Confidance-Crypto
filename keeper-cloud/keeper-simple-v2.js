require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require('@supabase/supabase-js');

// Configuration
const RPC_URL = process.env.RPC_URL || process.env.BASE_RPC || "https://mainnet.base.org";
const CHECK_INTERVAL = 60000; // 60 secondes

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🤖 CONFIDANCE CRYPTO KEEPER V2");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🌐 Network: Base Mainnet");
console.log(`⏰ Check interval: ${CHECK_INTERVAL / 1000}s`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Initialiser provider et wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

console.log("👤 Keeper address:", wallet.address);

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ABI pour ScheduledPayment V2
const SCHEDULED_PAYMENT_ABI = [
  "function releaseTime() view returns (uint256)",
  "function released() view returns (bool)",
  "function cancelled() view returns (bool)",
  "function release() external",
  "function getAmounts() view returns (uint256 amountToPayee, uint256 protocolFee, uint256 totalLocked)"
];

// Liste des contrats à surveiller
let contractsToWatch = [];

// Charger les contrats depuis Supabase
async function loadContracts() {
  try {
    const { data, error } = await supabase
      .from('scheduled_payments')
      .select('*')
      .eq('status', 'pending')
      .order('release_time', { ascending: true });

    if (error) throw error;

    contractsToWatch = data.map(payment => ({
      address: payment.contract_address,
      releaseTime: payment.release_time,
      name: `Payment ${new Date(payment.release_time * 1000).toLocaleString()}`,
      id: payment.id
    }));

    console.log(`📋 ${contractsToWatch.length} paiement(s) chargé(s)\n`);
  } catch (error) {
    console.error("❌ Erreur chargement Supabase:", error.message);
  }
}

// Mettre à jour le statut dans Supabase
async function updatePaymentStatus(paymentId, txHash) {
  try {
    const { error } = await supabase
      .from('scheduled_payments')
      .update({
        status: 'released',
        tx_hash: txHash,
        released_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (error) throw error;
    console.log(`✅ Statut mis à jour dans Supabase`);
  } catch (error) {
    console.error(`❌ Erreur mise à jour Supabase:`, error.message);
  }
}

// Fonction principale de vérification
async function checkAndRelease() {
  const now = Math.floor(Date.now() / 1000);
  console.log(`⏰ [${new Date().toLocaleTimeString()}] Vérification...`);

  // Recharger les contrats depuis Supabase
  await loadContracts();

  if (contractsToWatch.length === 0) {
    console.log("😴 Aucun paiement à surveiller\n");
    return;
  }

  for (const contract of contractsToWatch) {
    try {
      const payment = new ethers.Contract(
        contract.address,
        SCHEDULED_PAYMENT_ABI,
        wallet
      );

      // Vérifier le statut
      const released = await payment.released();
      const cancelled = await payment.cancelled();

      if (released) {
        console.log(`✅ ${contract.name}: Déjà libéré`);
        // Mettre à jour Supabase si pas déjà fait
        await updatePaymentStatus(contract.id, 'already_released');
        continue;
      }

      if (cancelled) {
        console.log(`❌ ${contract.name}: Annulé`);
        continue;
      }

      // Vérifier le temps
      const releaseTime = await payment.releaseTime();
      const timeUntil = Number(releaseTime) - now;

      if (timeUntil > 0) {
        const minutes = Math.floor(timeUntil / 60);
        const seconds = timeUntil % 60;
        console.log(`⏱️  ${contract.name}: Encore ${minutes}m ${seconds}s`);
        continue;
      }

      // C'est l'heure ! Exécuter release()
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🎯 ${contract.name}: PRÊT À LIBÉRER !`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Afficher les montants avant release
      try {
        const [amountToPayee, protocolFee, totalLocked] = await payment.getAmounts();
        console.log(`💰 Montants :`);
        console.log(`   Bénéficiaire : ${ethers.formatEther(amountToPayee)} ETH`);
        console.log(`   Protocole : ${ethers.formatEther(protocolFee)} ETH`);
        console.log(`   Total : ${ethers.formatEther(totalLocked)} ETH`);
      } catch (e) {
        console.log(`⚠️  Impossible de lire les montants (contrat V1 ?)`);
      }

      console.log(`\n💸 Exécution de release()...`);
      
      const tx = await payment.release();
      console.log(`📤 Transaction envoyée: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ SUCCÈS ! Block: ${receipt.blockNumber}`);
      console.log(`🔗 https://basescan.org/tx/${tx.hash}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Mettre à jour Supabase
      await updatePaymentStatus(contract.id, tx.hash);

    } catch (error) {
      if (error.message.includes("Already released")) {
        console.log(`✅ ${contract.name}: Déjà libéré`);
      } else if (error.message.includes("Too early")) {
        console.log(`⏱️  ${contract.name}: Pas encore l'heure`);
      } else {
        console.error(`❌ ${contract.name}: Erreur:`, error.message);
      }
    }
  }
  console.log(); // Ligne vide
}

// Health check
async function healthCheck() {
  try {
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance keeper: ${ethers.formatEther(balance)} ETH`);
    
    if (balance === 0n) {
      console.warn("⚠️  ATTENTION: Balance à 0 !");
    }
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
  }
}

// Démarrage
async function start() {
  console.log("🚀 Démarrage du Keeper...\n");
  
  // Health check initial
  await healthCheck();
  console.log();
  
  // Première vérification immédiate
  await checkAndRelease();
  
  // Puis vérifications périodiques
  setInterval(checkAndRelease, CHECK_INTERVAL);
  
  // Health check toutes les 5 minutes
  setInterval(healthCheck, 5 * 60 * 1000);
  
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
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

// Configuration
const NETWORK = process.env.NETWORK || "base"; // ou "sepolia"
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 60000; // 60 secondes par défaut

// Health check endpoint pour Railway
const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      uptime: process.uptime(),
      contracts: contractsToWatch.length 
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
console.log("🤖 CONFIDANCE CRYPTO KEEPER v1.0");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`🌐 Network: ${NETWORK}`);
console.log(`⏰ Check interval: ${CHECK_INTERVAL / 1000}s`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Initialiser provider et wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

console.log("👤 Keeper address:", wallet.address);

// ABI minimal pour ScheduledPayment
const SCHEDULED_PAYMENT_ABI = [
  "function releaseTime() view returns (uint256)",
  "function released() view returns (bool)",
  "function release() external"
];

// ABI pour Resolver
const RESOLVER_ABI = [
  "function checker() view returns (bool canExec, bytes memory execPayload)"
];

// Liste des contrats à surveiller (à charger depuis un fichier JSON)
let contractsToWatch = [];

// Charger les contrats depuis deployment-info-base.json
function loadContracts() {
  try {
    if (fs.existsSync("deployment-info-base.json")) {
      const info = JSON.parse(fs.readFileSync("deployment-info-base.json", "utf8"));
      contractsToWatch = [{
        scheduledPayment: info.scheduledPayment,
        resolver: info.resolver,
        releaseTime: info.releaseTime,
        name: `Payment ${new Date(info.releaseTime * 1000).toLocaleString()}`
      }];
      console.log(`📋 ${contractsToWatch.length} contrat(s) chargé(s)\n`);
    }
  } catch (error) {
    console.error("⚠️  Erreur chargement contrats:", error.message);
  }
}

// Fonction principale de vérification
async function checkAndRelease() {
  const now = Math.floor(Date.now() / 1000);
  console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Vérification...`);

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
        continue;
      }

      // Vérifier le temps
      const releaseTime = await scheduledPayment.releaseTime();
      const timeUntil = Number(releaseTime) - now;

      if (timeUntil > 0) {
        const minutes = Math.floor(timeUntil / 60);
        console.log(`⏱️  ${contract.name}: Encore ${minutes}m ${timeUntil % 60}s`);
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

      // Marquer comme traité (vous pourriez sauvegarder dans une DB)
      contract.processed = true;

    } catch (error) {
      if (error.message.includes("Already released")) {
        console.log(`✅ ${contract.name}: Déjà libéré`);
      } else {
        console.error(`❌ ${contract.name}: Erreur:`, error.message);
      }
    }
  }
}

// Fonction de health check pour Railway
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
  
  // Charger les contrats
  loadContracts();
  
  // Health check initial
  await healthCheck();
  
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
// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  console.log("🚀 Déploiement du contrat PaymentFactory...");

  // Adresse de réception des commissions (modifiable dans le contrat ensuite)
  const platformWallet = process.env.PLATFORM_WALLET;

  if (!platformWallet) {
    throw new Error("❌ Variable PLATFORM_WALLET manquante dans le fichier .env");
  }

  // Récupère la factory du contrat PaymentFactory
  const PaymentFactory = await hre.ethers.getContractFactory("PaymentFactory");

  // Déploie le contrat avec le wallet de la plateforme
  const paymentFactory = await PaymentFactory.deploy(platformWallet);

  await paymentFactory.waitForDeployment();

  console.log(`✅ PaymentFactory déployé à l'adresse : ${await paymentFactory.getAddress()}`);
  console.log(`💰 Wallet des commissions : ${platformWallet}`);
  console.log("🎯 Déploiement terminé avec succès !");
}

// Gestion des erreurs
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT PAYMENTFACTORY_INSTANT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 Compte :", deployer.address);
  console.log("🌐 Réseau :", network.name, `(chainId: ${network.chainId})`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Solde :", hre.ethers.formatEther(balance), "ETH");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Vérifier qu'on est sur Base Mainnet
  if (network.chainId !== 8453n) {
    throw new Error("❌ Pas sur Base Mainnet ! ChainId devrait être 8453");
  }

  console.log("📦 Compilation en cours...");

  const PaymentFactory = await hre.ethers.getContractFactory("PaymentFactory_Instant");

  console.log("🚀 Déploiement PaymentFactory_Instant (Instant Payments 0% fees)...");
  const factory = await PaymentFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("\n✅ Factory déployée avec succès !");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Adresse Factory :", factoryAddress);
  console.log("🔍 Basescan :", `https://basescan.org/address/${factoryAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔎 Fonctions disponibles :");
  console.log("   ✅ createInstantPaymentETH() - Instant payment ETH (0% fees)");
  console.log("   ✅ createInstantPaymentERC20() - Instant payment ERC20 (0% fees)");
  console.log("   ℹ️  Scheduled payments: utiliser PaymentFactory_Scheduled\n");

  const deploymentInfo = {
    version: "INSTANT_ONLY",
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    factoryAddress: factoryAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,

    features: [
      "✅ Instant Payment ETH (0% fees)",
      "✅ Instant Payment ERC20 (0% fees)",
      "❌ Scheduled Payments (disponibles dans PaymentFactory_Scheduled)"
    ],

    constants: {
      fees: "0%",
      note: "Aucun frais sur les paiements instantanés"
    }
  };

  const filename = "factory-instant-deployment.json";
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Info sauvegardée dans ${filename}\n`);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 PROCHAINES ÉTAPES :");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("1️⃣  VÉRIFIER LE CONTRAT SUR BASESCAN");
  console.log(`   npx hardhat verify --network base_mainnet ${factoryAddress}\n`);

  console.log("2️⃣  METTRE À JOUR LE FRONTEND");
  console.log(`   📁 Ajouter l'adresse de la factory instant dans le config\n`);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});

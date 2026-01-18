const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT PAYMENTFACTORY_RECURRING");
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

  const PaymentFactory = await hre.ethers.getContractFactory("PaymentFactory_Recurring");

  console.log("🚀 Déploiement PaymentFactory_Recurring (Recurring Payments ERC20)...");
  const factory = await PaymentFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("\n✅ Factory déployée avec succès !");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Adresse Factory :", factoryAddress);
  console.log("🔍 Basescan :", `https://basescan.org/address/${factoryAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔎 Fonctions disponibles :");
  console.log("   ✅ createRecurringPaymentERC20() - Single recurring payment ERC20");
  console.log("   ✅ createBatchRecurringPaymentERC20() - Batch recurring payment ERC20");
  console.log("   ✅ adminExecutePayment() - Admin fallback pour exécuter un paiement");
  console.log("   ✅ adminCancel() - Admin fallback pour annuler");
  console.log("   ✅ previewFeePerMonth(payer) - Helper pour calculer les fees");
  console.log("   ⚠️  Scheduled payments: utiliser PaymentFactory_Scheduled");
  console.log("   ⚠️  Instant payments: utiliser PaymentFactory_Instant\n");
  console.log("   ⚙️  Fees dynamiques via allowlist PRO (owner)\n");

  const deploymentInfo = {
    version: "RECURRING_ONLY",
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    factoryAddress: factoryAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,

    features: [
      "✅ Single Recurring Payment ERC20 (USDC/USDT)",
      "✅ Batch Recurring Payment ERC20 (multi-bénéficiaires)",
      "✅ Admin fallback functions (execute/cancel)",
      "✅ Fees dynamiques (PRO allowlist)",
      "❌ Scheduled Payments (disponibles dans PaymentFactory_Scheduled)",
      "❌ Instant Payments (disponibles dans PaymentFactory_Instant)"
    ],

    constants: {
      protocolWallet: "0xa34eDf91Cc494450000Eef08e6563062B2F115a9",
      feeBpsParticular: 179,
      feeBpsPro: 156,
      feePercentParticular: "1.79%",
      feePercentPro: "1.56%"
    }
  };

  const filename = "factory-recurring-deployment.json";
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Info sauvegardée dans ${filename}\n`);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 PROCHAINES ÉTAPES :");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("1️⃣  VÉRIFIER LE CONTRAT SUR BASESCAN");
  console.log(`   npx hardhat verify --network base_mainnet ${factoryAddress}\n`);

  console.log("2️⃣  METTRE À JOUR LE FRONTEND");
  console.log(`   📁 confidance-frontend/src/lib/contracts/addresses.ts`);
  console.log(`   📁 confidance-frontend/src/hooks/useCreateRecurringPayment.ts`);
  console.log(`      const PAYMENT_FACTORY_RECURRING = '${factoryAddress}';\n`);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});

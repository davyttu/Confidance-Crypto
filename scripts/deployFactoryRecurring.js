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

  // ✅ Autoriser PROD (Base Mainnet) ou TEST (Base Sepolia)
  const isBaseMainnet = network.chainId === 8453n;
  const isBaseSepolia = network.chainId === 84532n;

  if (!isBaseMainnet && !isBaseSepolia) {
    throw new Error("❌ Réseau non supporté (Base Mainnet ou Base Sepolia requis)");
  }

  // ===============================
  // ⏱️ CONFIG TEMPS (CLÉ DU TEST)
  // ===============================
  const SECONDS_PER_MONTH = isBaseMainnet
    ? 30 * 24 * 60 * 60   // PROD → 30 jours
    : 300;                // TEST → 5 minutes

  console.log("⏱️ Seconds per month :", SECONDS_PER_MONTH);
  console.log("📦 Compilation en cours...");

  const PaymentFactory = await hre.ethers.getContractFactory(
    "PaymentFactory_Recurring"
  );

  console.log("🚀 Déploiement PaymentFactory_Recurring (Recurring Payments ERC20)...");

  // ⚠️ CONSTRUCTOR MODIFIÉ (argument ajouté)
  const factory = await PaymentFactory.deploy(SECONDS_PER_MONTH);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();

  console.log("\n✅ Factory déployée avec succès !");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Adresse Factory :", factoryAddress);
  console.log(
    "🔍 Basescan :",
    isBaseMainnet
      ? `https://basescan.org/address/${factoryAddress}`
      : `https://sepolia.basescan.org/address/${factoryAddress}`
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔎 Fonctions disponibles :");
  console.log("   ✅ createRecurringPaymentERC20()");
  console.log("   ✅ createBatchRecurringPaymentERC20()");
  console.log("   ✅ adminExecutePayment()");
  console.log("   ✅ adminCancel()");
  console.log("   ✅ previewFeePerMonth()");
  console.log("   ⚙️  Fees dynamiques via allowlist PRO\n");

  const deploymentInfo = {
    version: "RECURRING_ONLY",
    environment: isBaseMainnet ? "prod" : "test",
    network: network.name,
    chainId: network.chainId.toString(),
    factoryAddress: factoryAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,

    constants: {
      protocolWallet: "0xa34eDf91Cc494450000Eef08e6563062B2F115a9",
      feeBpsParticular: 179,
      feeBpsPro: 156,
      feePercentParticular: "1.79%",
      feePercentPro: "1.56%",
      secondsPerMonth: SECONDS_PER_MONTH
    }
  };

  const filename = isBaseMainnet
    ? "factory-recurring-deployment.json"
    : "factory-recurring-deployment.test.json";

  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Info sauvegardée dans ${filename}\n`);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 PROCHAINES ÉTAPES :");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("1️⃣  VÉRIFIER LE CONTRAT SUR BASESCAN");
  console.log(
    `   npx hardhat verify --network ${
      isBaseMainnet ? "base_mainnet" : "base_sepolia"
    } ${factoryAddress} ${SECONDS_PER_MONTH}\n`
  );

  console.log("2️⃣  METTRE À JOUR LE FRONTEND");
  console.log("   ↳ utiliser l’adresse correspondant à l’environnement\n");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});

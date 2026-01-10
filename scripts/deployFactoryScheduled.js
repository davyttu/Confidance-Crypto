const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT PAYMENTFACTORY_SCHEDULED");
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

  const PaymentFactory = await hre.ethers.getContractFactory("PaymentFactory_Scheduled");

  console.log("🚀 Déploiement PaymentFactory_Scheduled (Single + Batch + Recurring)...");
  const factory = await PaymentFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("\n✅ Factory déployée avec succès !");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Adresse Factory :", factoryAddress);
  console.log("🔍 Basescan :", `https://basescan.org/address/${factoryAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔎 Fonctions disponibles :");
  console.log("   ✅ createPaymentETH() - Single payment ETH");
  console.log("   ✅ createPaymentERC20() - Single payment ERC20");
  console.log("   ✅ createBatchPaymentETH() - Batch payment ETH");
  console.log("   ✅ createBatchPaymentERC20() - Batch payment ERC20 (NOUVEAU)");
  console.log("   ✅ createRecurringPaymentERC20() - Recurring payment ERC20");
  console.log("   ⚠️  Instant payments: utiliser PaymentFactory_Instant séparée\n");

  const deploymentInfo = {
    version: "SCHEDULED_ONLY",
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    factoryAddress: factoryAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,

    features: [
      "✅ Single Payment ETH (avec protocolOwner)",
      "✅ Single Payment ERC20 (avec protocolOwner)",
      "✅ Batch Payment ETH (avec protocolOwner)",
      "✅ Batch Payment ERC20 (avec protocolOwner) - NOUVEAU",
      "✅ Recurring Payment ERC20 (avec protocolOwner)",
      "❌ Instant Payments (disponibles dans PaymentFactory_Instant)"
    ],
    
    changes: [
      "✅ Ajout de createBatchPaymentERC20() pour les paiements batch programmés en ERC20",
      "✅ Création du contrat BatchScheduledPaymentERC20.sol",
      "✅ Support des paiements batch multi-bénéficiaires en tokens ERC20"
    ],

    constants: {
      protocolWallet: "0xa34eDf91Cc494450000Eef08e6563062B2F115a9",
      feeBasisPoints: 179,
      feePercentage: "1.79%"
    }
  };

  const filename = "factory-scheduled-deployment.json";
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Info sauvegardée dans ${filename}\n`);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 PROCHAINES ÉTAPES :");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("1️⃣  VÉRIFIER LE CONTRAT SUR BASESCAN");
  console.log(`   npx hardhat verify --network base_mainnet ${factoryAddress}\n`);

  console.log("2️⃣  METTRE À JOUR LE FRONTEND");
  console.log(`   📁 confidance-frontend/src/hooks/useCreatePayment.ts`);
  console.log(`      const FACTORY_ADDRESS: \`0x\${string}\` = '${factoryAddress}'\n`);

  console.log("3️⃣  DÉPLOYER PaymentFactory_Instant");
  console.log("   Pour les paiements instantanés (0% fees)\n");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});

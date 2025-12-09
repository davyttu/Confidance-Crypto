const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT PAYMENTFACTORY V2 COMPLET");
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

  // ============================================================
  // DÉPLOYER PAYMENTFACTORY V2
  // ============================================================
  
  console.log("📦 Compilation en cours...");
  
  // La Factory importe automatiquement tous les contrats
  const PaymentFactory = await hre.ethers.getContractFactory("PaymentFactory");
  
  console.log("🚀 Déploiement PaymentFactory V2 (avec Recurring)...");
  const factory = await PaymentFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  
  console.log("\n✅ Factory déployée avec succès !");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Adresse Factory :", factoryAddress);
  console.log("🔍 Basescan :", `https://basescan.org/address/${factoryAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ============================================================
  // VÉRIFIER LES FONCTIONS
  // ============================================================
  
  console.log("🔎 Vérification des fonctions disponibles...\n");
  
  try {
    // Tester previewFee
    const testAmount = hre.ethers.parseUnits("100", 6); // 100 USDC
    const fee = await factory.previewFee(testAmount);
    console.log("   ✅ previewFee(100 USDC) =", hre.ethers.formatUnits(fee, 6), "USDC");
    
    // Tester calculateRecurringTotal
    const [feePerMonth, totalPerMonth, totalRequired] = await factory.calculateRecurringTotal(
      testAmount,
      12
    );
    console.log("   ✅ calculateRecurringTotal(100 USDC × 12 mois) :");
    console.log("      - Fee par mois:", hre.ethers.formatUnits(feePerMonth, 6), "USDC");
    console.log("      - Total par mois:", hre.ethers.formatUnits(totalPerMonth, 6), "USDC");
    console.log("      - Total à approuver:", hre.ethers.formatUnits(totalRequired, 6), "USDC");
    
    console.log("\n   📋 Fonctions disponibles :");
    console.log("      - createPaymentETH()");
    console.log("      - createPaymentERC20()");
    console.log("      - createBatchPaymentETH()");
    console.log("      - createRecurringPaymentERC20() ⭐ NOUVEAU");
    
  } catch (error) {
    console.error("   ⚠️  Erreur vérification:", error.message);
  }

  // ============================================================
  // SAUVEGARDER LES INFOS
  // ============================================================
  
  const deploymentInfo = {
    version: "V2-WITH-RECURRING",
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    factoryAddress: factoryAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
    features: [
      "Single Payment ETH",
      "Single Payment ERC20",
      "Batch Payment ETH",
      "Recurring Payment ERC20 (1-12 mois)"
    ],
    constants: {
      protocolWallet: "0xa34eDf91Cc494450000Eef08e6563062B2F115a9",
      feeBasisPoints: 179,
      feePercentage: "1.79%"
    },
    oldFactoryAddress: "0xFc3435c0cC56E7F9cBeb32Ea664e69fD6750B197"
  };

  const filename = "factory-v2-recurring-deployment.json";
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📄 Info sauvegardée dans ${filename}\n`);
  
  // ============================================================
  // INSTRUCTIONS SUITE
  // ============================================================
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 PROCHAINES ÉTAPES :");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  console.log("1️⃣  VÉRIFIER LE CONTRAT SUR BASESCAN");
  console.log(`   npx hardhat verify --network base_mainnet ${factoryAddress}\n`);
  
  console.log("2️⃣  METTRE À JOUR LE FRONTEND");
  console.log(`   Dans: confidance-frontend/src/hooks/useCreatePayment.ts`);
  console.log(`   Remplacer: const FACTORY_ADDRESS = '0xFc3435c0cC56E7F9cBeb32Ea664e69fD6750B197'`);
  console.log(`   Par:       const FACTORY_ADDRESS = '${factoryAddress}'\n`);
  
  console.log("3️⃣  TESTER LA CRÉATION RECURRING");
  console.log("   - Via frontend : créer un paiement récurrent test");
  console.log("   - Vérifier enregistrement dans recurring_payments table");
  console.log("   - Vérifier que keeper détecte le contrat\n");
  
  console.log("4️⃣  SUPPRIMER L'ANCIENNE FACTORY ?");
  console.log("   ⚠️  ATTENTION : Si des paiements existent encore sur l'ancienne");
  console.log("   Factory, le keeper doit continuer à les surveiller !\n");
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT FACTORY V2 + INSTANT PAYMENTS");
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
  
  console.log("🚀 Déploiement PaymentFactory V2 (avec Instant)...");
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
    // Tester previewFee pour scheduled payments
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
    console.log("      - createRecurringPaymentERC20()");
    console.log("      - createInstantPaymentETH() ⚡ NOUVEAU");
    console.log("      - createInstantPaymentERC20() ⚡ NOUVEAU");
    
  } catch (error) {
    console.error("   ⚠️  Erreur vérification:", error.message);
  }

  // ============================================================
  // SAUVEGARDER LES INFOS
  // ============================================================
  
  const deploymentInfo = {
    version: "V2-WITH-INSTANT-PAYMENTS",
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    factoryAddress: factoryAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
    features: [
      "Single Payment ETH (1.79% fees)",
      "Single Payment ERC20 (1.79% fees)",
      "Batch Payment ETH (1.79% fees)",
      "Recurring Payment ERC20 (1.79% fees)",
      "Instant Payment ETH (0% fees) ⚡ NEW",
      "Instant Payment ERC20 (0% fees) ⚡ NEW"
    ],
    constants: {
      protocolWallet: "0xa34eDf91Cc494450000Eef08e6563062B2F115a9",
      feeBasisPoints: 179,
      feePercentage: "1.79%",
      instantPaymentFees: "0% (gratuit)"
    },
    oldFactoryAddress: "0xd8e57052142b62081687137c44C54F78306547f8"
  };

  const filename = "factory-v2-instant-deployment.json";
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
  console.log(`   Dans: confidance-frontend/src/hooks/`);
  console.log(`   - useCreatePayment.ts`);
  console.log(`   - useCreateBatchPayment.ts`);
  console.log(`   - useCreateRecurringPayment.ts`);
  console.log(`   - useCreateInstantPayment.ts (NOUVEAU à créer)\n`);
  console.log(`   Remplacer: const FACTORY_ADDRESS = '0xd8e57052142b62081687137c44C54F78306547f8'`);
  console.log(`   Par:       const FACTORY_ADDRESS = '${factoryAddress}'\n`);
  
  console.log("3️⃣  METTRE À JOUR L'ABI");
  console.log("   Dans: confidance-frontend/src/lib/contracts/paymentFactoryAbi.ts");
  console.log("   Ajouter les 2 nouvelles fonctions + 2 events :");
  console.log("   - createInstantPaymentETH(address _payee)");
  console.log("   - createInstantPaymentERC20(address _payee, address _token, uint256 _amount)");
  console.log("   - InstantPaymentCreatedETH (event)");
  console.log("   - InstantPaymentCreatedERC20 (event)\n");
  
  console.log("4️⃣  TESTER LES PAIEMENTS INSTANTANÉS");
  console.log("   - Via frontend : créer un paiement instantané ETH (0.01 ETH)");
  console.log("   - Via frontend : créer un paiement instantané USDC (10 USDC)");
  console.log("   - Vérifier 0% fees sur les 2");
  console.log("   - Vérifier enregistrement dans scheduled_payments (is_instant = true)");
  console.log("   - Vérifier contrats sur Basescan\n");
  
  console.log("5️⃣  SUPPRIMER L'ANCIENNE FACTORY ?");
  console.log("   ⚠️  ATTENTION : Si des paiements existent encore sur l'ancienne");
  console.log("   Factory, le keeper doit continuer à les surveiller !");
  console.log("   Ancienne Factory : 0xd8e57052142b62081687137c44C54F78306547f8\n");
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  console.log("💡 RAPPEL - DIFFÉRENCE INSTANT VS SCHEDULED :");
  console.log("   📅 Scheduled : Fees 1.79%, libération future, keeper nécessaire");
  console.log("   ⚡ Instant   : Fees 0%, libération immédiate, pas de keeper\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});
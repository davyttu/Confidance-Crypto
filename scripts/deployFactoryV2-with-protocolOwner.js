const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT PAYMENTFACTORY V2 - AVEC PROTOCOL OWNER");
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
  
  console.log("🚀 Déploiement PaymentFactory V2 (avec paramètre protocolOwner)...");
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
    console.log("   📋 Fonctions disponibles :");
    console.log("      - createPaymentETH() ✅");
    console.log("      - createPaymentERC20() ✅");
    console.log("      - createBatchPaymentETH() ✅");
    console.log("      - createRecurringPaymentERC20() ✅");
    console.log("      - createInstantPaymentETH() ✅");
    console.log("      - createInstantPaymentERC20() ✅");
    
  } catch (error) {
    console.error("   ⚠️  Erreur vérification:", error.message);
  }

  // ============================================================
  // SAUVEGARDER LES INFOS
  // ============================================================
  
  const deploymentInfo = {
    version: "V2-WITH-PROTOCOL-OWNER",
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    factoryAddress: factoryAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
    
    changes: [
      "✅ Ajout paramètre _protocolOwner dans ScheduledPayment_V2.sol constructor",
      "✅ Ajout paramètre _protocolOwner dans ScheduledPaymentERC20.sol constructor",
      "✅ Ajout paramètre _protocolOwner dans RecurringPaymentERC20.sol constructor",
      "✅ PaymentFactory_V2.sol mis à jour pour passer PROTOCOL_WALLET lors de la création des contrats",
      "✅ Tous les contrats de paiement ont maintenant un protocolOwner immutable pour adminExecutePayment()"
    ],
    
    protocolOwner: "0xa34eDf91Cc494450000Eef08e6563062B2F115a9",
    
    features: [
      "✅ Single Payment ETH (avec protocolOwner)",
      "✅ Single Payment ERC20 (avec protocolOwner)",
      "✅ Batch Payment ETH (avec protocolOwner)",
      "✅ Recurring Payment ERC20 (avec protocolOwner)",
      "✅ Instant Payment ETH (inchangé)",
      "✅ Instant Payment ERC20 (inchangé)"
    ],
    
    constants: {
      protocolWallet: "0xa34eDf91Cc494450000Eef08e6563062B2F115a9",
      feeBasisPoints: 179,
      feePercentage: "1.79%"
    },
    
    contractsUpdated: [
      "ScheduledPayment_V2.sol - constructor accepte maintenant _protocolOwner",
      "ScheduledPaymentERC20.sol - constructor accepte maintenant _protocolOwner",
      "RecurringPaymentERC20.sol - constructor accepte maintenant _protocolOwner",
      "PaymentFactory_V2.sol - passe PROTOCOL_WALLET lors de la création des contrats"
    ],
    
    adminFunctions: [
      "adminExecutePayment() - disponible dans ScheduledPayment_V2",
      "adminExecutePayment() - disponible dans ScheduledPaymentERC20",
      "adminExecutePayment() - disponible dans RecurringPaymentERC20 (si applicable)"
    ]
  };

  const filename = "factory-v2-protocol-owner-deployment.json";
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
  console.log(`   📁 confidance-frontend/src/hooks/useCreatePayment.ts`);
  console.log(`      Ligne ~25: const FACTORY_ADDRESS: \`0x\${string}\` = '${factoryAddress}'`);
  console.log(`   📁 confidance-frontend/src/hooks/useCreateBatchPayment.ts`);
  console.log(`      Ligne ~25: const FACTORY_ADDRESS: \`0x\${string}\` = '${factoryAddress}'\n`);
  
  console.log("3️⃣  TESTER LES FONCTIONNALITÉS");
  console.log("   ✅ ÉTAPE 1: Tester ETH (0.001 ETH)");
  console.log("      → Vérifier que le paiement se crée correctement");
  console.log("   ✅ ÉTAPE 2: Tester USDC (10 USDC)");
  console.log("      → Frontend approve Factory pour 10.179 USDC");
  console.log("      → createPaymentERC20(10) doit PASSER");
  console.log("   ✅ ÉTAPE 3: Tester Recurring Payment");
  console.log("      → Créer un paiement récurrent et vérifier le protocolOwner\n");
  
  console.log("4️⃣  NOUVELLES FONCTIONNALITÉS");
  console.log("   🔐 PROTOCOL OWNER:");
  console.log("      - Tous les contrats de paiement ont maintenant un protocolOwner immutable");
  console.log("      - Le protocolOwner peut appeler adminExecutePayment() pour exécuter les paiements");
  console.log("      - Adresse protocolOwner: 0xa34eDf91Cc494450000Eef08e6563062B2F115a9");
  console.log("      - Utile si le keeper ne fonctionne pas correctement\n");
  
  console.log("5️⃣  CONTRATS MODIFIÉS");
  console.log("   ✅ ScheduledPayment_V2.sol - paramètre _protocolOwner ajouté");
  console.log("   ✅ ScheduledPaymentERC20.sol - paramètre _protocolOwner ajouté");
  console.log("   ✅ RecurringPaymentERC20.sol - paramètre _protocolOwner ajouté");
  console.log("   ✅ PaymentFactory_V2.sol - passe PROTOCOL_WALLET lors de la création\n");
  
  console.log("6️⃣  GARDER LES ANCIENNES FACTORIES ACTIVES");
  console.log("   ⚠️  NE PAS supprimer les anciennes !");
  console.log("   Le keeper doit continuer à surveiller les paiements existants");
  console.log(`   Nouvelle Factory: ${factoryAddress}\n`);
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});

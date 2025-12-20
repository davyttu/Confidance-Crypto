const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT PAYMENTFACTORY V2 - FIX CONSTRUCTOR BALANCE CHECK");
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
  
  console.log("🚀 Déploiement PaymentFactory V2 (avec fix Constructor Balance Check)...");
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
    console.log("      - createPaymentERC20() ✅ FIXÉ (Constructor Balance Check supprimé)");
    console.log("      - createBatchPaymentETH()");
    console.log("      - createRecurringPaymentERC20()");
    console.log("      - createInstantPaymentETH()");
    console.log("      - createInstantPaymentERC20()");
    
  } catch (error) {
    console.error("   ⚠️  Erreur vérification:", error.message);
  }

  // ============================================================
  // SAUVEGARDER LES INFOS
  // ============================================================
  
  const deploymentInfo = {
    version: "V2-CONSTRUCTOR-BALANCE-CHECK-FIX",
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    factoryAddress: factoryAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
    
    fix: "Suppression vérification balanceOf dans constructor ScheduledPaymentERC20",
    
    problem: "Constructor vérifiait balanceOf AVANT que Factory transfère les tokens",
    
    bugTimeline: [
      "1. Factory: transferFrom(user → factory, 10179 USDC) ✅",
      "2. Factory: new ScheduledPaymentERC20(...) ← Constructor vérifie balance",
      "   └─ Constructor: balanceOf(this) = 0 ❌ require(0 >= 10179) FAIL",
      "3. [N'arrive jamais] Factory: transfer(factory → contract, 10179)"
    ],
    
    solution: [
      "1. User approve Factory pour totalRequired (10179 USDC)",
      "2. Factory reçoit tokens via safeTransferFrom(user → Factory, 10179)",
      "3. Factory crée ScheduledPaymentERC20 (constructor SANS vérification balance)",
      "4. Factory transfère tokens via safeTransfer(Factory → Contract, 10179)",
      "5. Contract possède maintenant 10179 USDC ✅"
    ],
    
    changes: [
      "ScheduledPaymentERC20.sol ligne 104-106: SUPPRIMÉ balanceOf check",
      "Commentaire ajouté: 'Tokens transférés par Factory APRÈS création'",
      "PaymentFactory.sol ligne 180-193: Pattern Factory-Intermediary (inchangé)",
      "Frontend useCreatePayment.ts: Approval totalRequired déjà implémenté ✅"
    ],
    
    patternComparison: {
      eth: {
        name: "Pattern Direct",
        flow: [
          "Factory: new ScheduledPayment{value: msg.value}(...)",
          "Constructor: require(msg.value == expected) ✅ ETH déjà reçu"
        ],
        note: "ETH arrive PENDANT création via {value: msg.value}"
      },
      erc20: {
        name: "Pattern Factory-Intermediary",
        flow: [
          "Factory: transferFrom(user → factory)",
          "Factory: new ScheduledPaymentERC20(...) ← balance = 0",
          "Factory: transfer(factory → contract)"
        ],
        note: "Tokens arrivent APRÈS création, constructor NE DOIT PAS vérifier"
      }
    },
    
    features: [
      "✅ Single Payment ETH (Pattern Direct - inchangé)",
      "✅ Single Payment ERC20 (Pattern Factory-Intermediary - FIXÉ)",
      "✅ Batch Payment ETH (Pattern Direct - inchangé)",
      "✅ Recurring Payment ERC20 (Pattern paiements mensuels - inchangé)",
      "✅ Instant Payment ETH (Pattern Direct - inchangé)",
      "✅ Instant Payment ERC20 (Pattern Factory-Intermediary - inchangé)"
    ],
    
    constants: {
      protocolWallet: "0xa34eDf91Cc494450000Eef08e6563062B2F115a9",
      feeBasisPoints: 179,
      feePercentage: "1.79%"
    },
    
    previousDeployments: {
      v1: "0x523b378A11400F1A3E8A4482Deb9f0464c64A525",
      v2WithBug: "0x0BD36382637312095a93354b2e5c71B68f570881"
    },
    
    testPlan: {
      step1: "✅ Tester ETH (0.001 ETH) - doit marcher comme avant",
      step2: "✅ Tester USDC (10 USDC)",
      step2a: "   - Frontend approve Factory pour 10.179 USDC",
      step2b: "   - createPaymentERC20(10 USDC) doit PASSER",
      step2c: "   - Vérifier balanceOf(contract) = 10.179 USDC",
      step3: "✅ Attendre releaseTime puis release()",
      step3a: "   - Bénéficiaire reçoit EXACTEMENT 10 USDC",
      step3b: "   - Protocole reçoit EXACTEMENT 0.179 USDC",
      step4: "✅ Tester USDT (1 USDT) - vérifier même logique"
    },
    
    validation: {
      beforeRelease: [
        "getAmounts() retourne (10000000, 179000, 10179000) pour 10 USDC",
        "balanceOf(contract) = 10179000 (10.179 USDC)",
        "getPaymentDetails() affiche toutes les infos"
      ],
      afterRelease: [
        "Bénéficiaire balance += 10000000 (10 USDC exact)",
        "Protocole balance += 179000 (0.179 USDC exact)",
        "Contract balance = 0",
        "released = true"
      ]
    }
  };

  const filename = "factory-v2-constructor-fix-deployment.json";
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
  
  console.log("2️⃣  METTRE À JOUR LE FRONTEND (2 fichiers)");
  console.log(`   📁 src/hooks/useCreatePayment.ts`);
  console.log(`      Ligne ~25: const FACTORY_ADDRESS: \`0x\${string}\` = '${factoryAddress}'`);
  console.log(`   📁 src/hooks/useCreateBatchPayment.ts`);
  console.log(`      Ligne ~25: const FACTORY_ADDRESS: \`0x\${string}\` = '${factoryAddress}'\n`);
  
  console.log("3️⃣  TESTER DANS L'ORDRE (CRITIQUE !)");
  console.log("   ✅ ÉTAPE 1: Tester ETH (0.001 ETH)");
  console.log("      → Confirmer que ça marche toujours (Pattern Direct)");
  console.log("   ✅ ÉTAPE 2: Tester USDC (10 USDC)");
  console.log("      → Frontend approve Factory pour 10.179 USDC");
  console.log("      → createPaymentERC20(10) doit PASSER sans erreur");
  console.log("      → Vérifier sur Basescan: balance contrat = 10.179 USDC");
  console.log("   ✅ ÉTAPE 3: Attendre releaseTime + release()");
  console.log("      → Bénéficiaire reçoit 10 USDC EXACT");
  console.log("      → Protocole reçoit 0.179 USDC EXACT\n");
  
  console.log("4️⃣  COMPRENDRE LE FIX");
  console.log("   🐛 PROBLÈME:");
  console.log("      Constructor vérifiait balanceOf AVANT que Factory transfère");
  console.log("      Timeline: transferFrom → new Contract (check balance=0 ❌) → transfer");
  console.log("");
  console.log("   ✅ SOLUTION:");
  console.log("      Constructor NE vérifie PLUS le balance");
  console.log("      Les tokens sont vérifiés par SafeERC20 lors du transfer Factory→Contract");
  console.log("      Timeline: transferFrom → new Contract → transfer → balance=10.179 ✅\n");
  
  console.log("5️⃣  PATTERN ETH vs ERC20");
  console.log("   💎 ETH (Pattern Direct):");
  console.log("      new ScheduledPayment{value: msg.value}(...)");
  console.log("      → ETH arrive PENDANT création → constructor vérifie msg.value ✅");
  console.log("");
  console.log("   🪙 ERC20 (Pattern Factory-Intermediary):");
  console.log("      1. transferFrom(user → factory)");
  console.log("      2. new ScheduledPaymentERC20(...) ← balance = 0");
  console.log("      3. transfer(factory → contract) ← balance = totalRequired");
  console.log("      → Tokens arrivent APRÈS création → constructor NE vérifie PAS ✅\n");
  
  console.log("6️⃣  GARDER LES ANCIENNES FACTORIES ACTIVES");
  console.log("   ⚠️  NE PAS supprimer les anciennes !");
  console.log("   Le keeper doit continuer à surveiller les paiements existants");
  console.log(`   V1: 0x523b378A11400F1A3E8A4482Deb9f0464c64A525`);
  console.log(`   V2 (buggée): 0x0BD36382637312095a93354b2e5c71B68f570881`);
  console.log(`   V3 (fixée): ${factoryAddress}\n`);
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});
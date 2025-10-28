const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧪 TEST BATCH PAYMENT V2 - BASE MAINNET");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 Deployer :", deployer.address);
  console.log("🌐 Network :", network.name, `(chainId: ${network.chainId})`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance :", hre.ethers.formatEther(balance), "ETH\n");

  if (network.chainId !== 8453n) {
    throw new Error("❌ Pas sur Base Mainnet ! ChainId devrait être 8453");
  }

  // ============================================================
  // ÉTAPE 1 : DÉPLOYER LA FACTORY V2
  // ============================================================
  
  console.log("📦 Déploiement de PaymentFactory V2...");
  const PaymentFactory = await hre.ethers.getContractFactory("PaymentFactory");
  const factory = await PaymentFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ Factory déployée à :", factoryAddress);
  console.log(`🔍 Basescan : https://basescan.org/address/${factoryAddress}\n`);

  // ============================================================
  // ÉTAPE 2 : PRÉPARER UN BATCH PAYMENT TEST
  // ============================================================
  
  console.log("📋 Préparation du Batch Payment...\n");
  
  // 3 bénéficiaires de test
  const payees = [
    "0x8CC0D8f899b0eF553459Aac249b14A95F0470cE9", // Beneficiaire 1
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbE", // Beneficiaire 2  
    "0x123456789abcdef123456789abcdef123456789a"  // Beneficiaire 3 (test)
  ];
  
  // Montants EXACTS que chaque bénéficiaire recevra
  const amounts = [
    hre.ethers.parseEther("0.0001"), // 0.0001 ETH
    hre.ethers.parseEther("0.0001"), // 0.0001 ETH
    hre.ethers.parseEther("0.0001")  // 0.0001 ETH
  ];
  
  // Release dans 10 minutes
  const now = Math.floor(Date.now() / 1000);
  const releaseTime = now + (10 * 60);
  const cancellable = false;
  
  // ============================================================
  // ÉTAPE 3 : CALCULER LE TOTAL À ENVOYER
  // ============================================================
  
  console.log("💰 Calcul des montants...");
  
  // Somme des montants bénéficiaires
  const totalToBeneficiaries = amounts.reduce((a, b) => a + b, 0n);
  console.log("   👥 Total bénéficiaires :", hre.ethers.formatEther(totalToBeneficiaries), "ETH");
  
  // Calculer les fees via la Factory
  const [calcTotalBenef, calcFee, calcTotalRequired] = await factory.calculateBatchTotal(amounts);
  console.log("   💸 Fees protocole (1.79%) :", hre.ethers.formatEther(calcFee), "ETH");
  console.log("   📊 TOTAL à envoyer :", hre.ethers.formatEther(calcTotalRequired), "ETH\n");
  
  // ============================================================
  // ÉTAPE 4 : CRÉER LE BATCH PAYMENT
  // ============================================================
  
  console.log("🚀 Création du Batch Payment...");
  console.log("   📅 Release time :", new Date(releaseTime * 1000).toLocaleString());
  console.log("   👥 Nombre de bénéficiaires :", payees.length);
  console.log("   🔒 Annulable :", cancellable ? "Oui" : "Non\n");
  
  const tx = await factory.createBatchPaymentETH(
    payees,
    amounts,
    releaseTime,
    cancellable,
    { value: calcTotalRequired }
  );
  
  console.log("📤 Transaction envoyée :", tx.hash);
  console.log("⏳ Attente de confirmation...");
  
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmée ! Block :", receipt.blockNumber);
  
  // ============================================================
  // ÉTAPE 5 : EXTRAIRE L'ADRESSE DU BATCH PAYMENT
  // ============================================================
  
  // Chercher l'event BatchPaymentCreatedETH
  const eventSignature = "BatchPaymentCreatedETH(address,address,uint256,uint256,uint256,uint256,uint256,bool)";
  const eventTopic = hre.ethers.id(eventSignature);
  
  const batchPaymentLog = receipt.logs.find(log => log.topics[0] === eventTopic);
  
  let batchPaymentAddress;
  if (batchPaymentLog) {
    // Le 2ème paramètre indexé est l'adresse du contrat
    batchPaymentAddress = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ['address'],
      batchPaymentLog.topics[2]
    )[0];
  } else {
    // Plan B : chercher une adresse qui n'est pas la Factory
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== factoryAddress.toLowerCase()) {
        batchPaymentAddress = log.address;
        break;
      }
    }
  }
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ BATCH PAYMENT CRÉÉ AVEC SUCCÈS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Factory :", factoryAddress);
  console.log("📍 Batch Payment :", batchPaymentAddress);
  console.log(`🔍 Basescan : https://basescan.org/address/${batchPaymentAddress}`);
  console.log(`🔍 Transaction : https://basescan.org/tx/${tx.hash}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // ============================================================
  // ÉTAPE 6 : VÉRIFIER LES DÉTAILS DU BATCH PAYMENT
  // ============================================================
  
  console.log("🔍 Vérification des détails...");
  
  const BatchPayment = await hre.ethers.getContractFactory("BatchScheduledPayment");
  const batchPayment = BatchPayment.attach(batchPaymentAddress);
  
  const [
    payer,
    count,
    totalBenef,
    protocolFee,
    totalLocked,
    releaseTimeContract,
    released,
    cancelled,
    isCancellable,
    canBeReleased,
    canBeCancelled
  ] = await batchPayment.getPaymentDetails();
  
  console.log("   👤 Payer :", payer);
  console.log("   👥 Nombre de bénéficiaires :", count.toString());
  console.log("   💰 Total bénéficiaires :", hre.ethers.formatEther(totalBenef), "ETH");
  console.log("   💸 Fees protocole :", hre.ethers.formatEther(protocolFee), "ETH");
  console.log("   🔒 Total verrouillé :", hre.ethers.formatEther(totalLocked), "ETH");
  console.log("   📅 Release time :", new Date(Number(releaseTimeContract) * 1000).toLocaleString());
  console.log("   ✅ Libéré :", released);
  console.log("   ❌ Annulé :", cancelled);
  console.log("   🔓 Annulable :", isCancellable);
  console.log("   ⏰ Peut être libéré :", canBeReleased);
  console.log("   🚫 Peut être annulé :", canBeCancelled);
  
  console.log("\n📋 Liste des bénéficiaires :");
  for (let i = 0; i < payees.length; i++) {
    const [payee, amount, paid] = await batchPayment.getPayee(i);
    console.log(`   ${i + 1}. ${payee} → ${hre.ethers.formatEther(amount)} ETH (payé: ${paid})`);
  }
  
  // ============================================================
  // ÉTAPE 7 : SAUVEGARDER LES INFOS
  // ============================================================
  
  const fs = require("fs");
  const deploymentInfo = {
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    factory: factoryAddress,
    batchPayment: batchPaymentAddress,
    payer: deployer.address,
    payees: payees,
    amounts: amounts.map(a => hre.ethers.formatEther(a)),
    totalToBeneficiaries: hre.ethers.formatEther(totalBenef),
    protocolFee: hre.ethers.formatEther(protocolFee),
    totalLocked: hre.ethers.formatEther(totalLocked),
    releaseTime: releaseTime,
    releaseTimeReadable: new Date(releaseTime * 1000).toISOString(),
    cancellable: cancellable,
    deployedAt: new Date().toISOString(),
    transactionHash: tx.hash
  };
  
  fs.writeFileSync(
    "batch-payment-test.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n📄 Infos sauvegardées dans batch-payment-test.json");
  
  console.log("\n⚠️  PROCHAINES ÉTAPES :");
  console.log("   1. Vérifier les contrats sur Basescan");
  console.log("   2. Attendre 10 minutes");
  console.log("   3. Lancer le keeper pour exécuter release()");
  console.log("   4. Vérifier que chaque bénéficiaire a reçu son montant EXACT\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});

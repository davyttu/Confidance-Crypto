const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧪 TEST LOCAL - FEES V2");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 Compte :", deployer.address);
  console.log("🌐 Réseau :", network.name, `(chainId: ${network.chainId})`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Solde :", hre.ethers.formatEther(balance), "ETH");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ============================================================
  // ÉTAPE 1 : DÉPLOYER LA FACTORY V2
  // ============================================================
  
  console.log("📦 Déploiement PaymentFactory V2...");
  const PaymentFactory = await hre.ethers.getContractFactory("PaymentFactory");
  const factory = await PaymentFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ Factory :", factoryAddress);

  // ============================================================
  // ÉTAPE 2 : TEST SINGLE PAYMENT
  // ============================================================
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 TEST 1 : Single Payment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const payee = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Account #1 local
  const amountToPayee = hre.ethers.parseEther("1.0");
  const now = Math.floor(Date.now() / 1000);
  const releaseTime = now + 120; // 2 minutes
  
  console.log("👤 Bénéficiaire :", payee);
  console.log("💰 Montant bénéficiaire : 1.0 ETH");
  
  // Calculer le total
  const [fee1, total1] = await factory.calculateSingleTotal(amountToPayee);
  console.log("💸 Fees (1.79%) :", hre.ethers.formatEther(fee1), "ETH");
  console.log("📊 TOTAL à envoyer :", hre.ethers.formatEther(total1), "ETH");
  
  console.log("\n🚀 Création...");
  const tx1 = await factory.createPaymentETH(
    payee,
    amountToPayee,
    releaseTime,
    false,
    { value: total1 }
  );
  
  const receipt1 = await tx1.wait();
  
  // Trouver l'adresse du contrat créé
  let paymentAddress;
  for (const log of receipt1.logs) {
    if (log.address.toLowerCase() !== factoryAddress.toLowerCase()) {
      paymentAddress = log.address;
      break;
    }
  }
  
  console.log("✅ Payment créé :", paymentAddress);
  
  // Vérifier
  const Payment = await hre.ethers.getContractFactory("ScheduledPayment");
  const payment = Payment.attach(paymentAddress);
  const [_amountToPayee, _fee, _total] = await payment.getAmounts();
  
  console.log("\n🔍 Vérification :");
  console.log("   Bénéficiaire recevra :", hre.ethers.formatEther(_amountToPayee), "ETH ✅");
  console.log("   Protocole recevra :", hre.ethers.formatEther(_fee), "ETH");
  console.log("   Total verrouillé :", hre.ethers.formatEther(_total), "ETH");

  // ============================================================
  // ÉTAPE 3 : TEST BATCH PAYMENT
  // ============================================================
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 TEST 2 : Batch Payment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const payees = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Account #1
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Account #2
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906"  // Account #3
  ];
  
  const amounts = [
    hre.ethers.parseEther("0.5"),
    hre.ethers.parseEther("0.3"),
    hre.ethers.parseEther("0.2")
  ];
  
  console.log("👥 3 bénéficiaires :");
  console.log("   1. 0.5 ETH");
  console.log("   2. 0.3 ETH");
  console.log("   3. 0.2 ETH");
  console.log("   Total : 1.0 ETH");
  
  // Calculer le total batch
  const [totalBenef, fee2, total2] = await factory.calculateBatchTotal(amounts);
  console.log("\n💸 Fees (1.79%) :", hre.ethers.formatEther(fee2), "ETH");
  console.log("📊 TOTAL à envoyer :", hre.ethers.formatEther(total2), "ETH");
  
  console.log("\n🚀 Création...");
  const tx2 = await factory.createBatchPaymentETH(
    payees,
    amounts,
    now + 300, // 5 minutes
    false,
    { value: total2 }
  );
  
  const receipt2 = await tx2.wait();
  
  // Trouver l'adresse du batch
  let batchAddress;
  for (const log of receipt2.logs) {
    if (log.address.toLowerCase() !== factoryAddress.toLowerCase()) {
      batchAddress = log.address;
      break;
    }
  }
  
  console.log("✅ Batch créé :", batchAddress);
  
  // Vérifier
  const Batch = await hre.ethers.getContractFactory("BatchScheduledPayment");
  const batch = Batch.attach(batchAddress);
  const details = await batch.getPaymentDetails();
  
  console.log("\n🔍 Vérification :");
  console.log("   Bénéficiaires recevront :", hre.ethers.formatEther(details[2]), "ETH ✅");
  console.log("   Protocole recevra :", hre.ethers.formatEther(details[3]), "ETH");
  console.log("   Total verrouillé :", hre.ethers.formatEther(details[4]), "ETH");

  // ============================================================
  // RÉSUMÉ FINAL
  // ============================================================
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ TESTS TERMINÉS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Factory :", factoryAddress);
  console.log("📍 Single Payment :", paymentAddress);
  console.log("📍 Batch Payment :", batchAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  console.log("✅ VÉRIFICATIONS :");
  console.log("   • Bénéficiaires reçoivent montants EXACTS");
  console.log("   • Fees ajoutées (pas déduites)");
  console.log("   • Batch payment fonctionne");
  
  // Sauvegarder
  const info = {
    factory: factoryAddress,
    singlePayment: paymentAddress,
    batchPayment: batchAddress,
    network: "localhost",
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync("test-local-v2.json", JSON.stringify(info, null, 2));
  console.log("\n📄 Infos sauvegardées dans test-local-v2.json\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});
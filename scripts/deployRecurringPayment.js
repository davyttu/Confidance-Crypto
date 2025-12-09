const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT RECURRING PAYMENT ERC20");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 Compte :", deployer.address);
  console.log("🌐 Réseau :", network.name, `(chainId: ${network.chainId})`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Solde :", hre.ethers.formatEther(balance), "ETH");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (network.chainId !== 8453n) {
    throw new Error("❌ Pas sur Base Mainnet ! ChainId devrait être 8453");
  }

  // ============================================================
  // DÉPLOYER RecurringPaymentERC20
  // ============================================================
  
  console.log("📦 Déploiement RecurringPaymentERC20...");
  
  const RecurringPayment = await hre.ethers.getContractFactory("RecurringPaymentERC20");
  
  // Pas de paramètres au constructeur - c'est une implémentation
  const recurringPayment = await RecurringPayment.deploy();
  await recurringPayment.waitForDeployment();
  
  const contractAddress = await recurringPayment.getAddress();
  
  console.log("\n✅ RecurringPaymentERC20 déployé avec succès !");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Adresse :", contractAddress);
  console.log("🔍 Basescan :", `https://basescan.org/address/${contractAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Sauvegarder les informations
  const deploymentInfo = {
    version: "RECURRING-V1",
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    contractAddress: contractAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
    description: "Recurring monthly payments for USDC/USDT (1-12 months)",
    features: [
      "Monthly automatic payments",
      "USDC/USDT support only",
      "1-12 months duration",
      "Skip-on-failure (if balance insufficient)",
      "Approve-once, deduct-monthly"
    ]
  };

  // Sauvegarder dans un fichier
  fs.writeFileSync(
    "recurring-payment-deployment.json", 
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("📄 Info sauvegardée dans recurring-payment-deployment.json\n");
  
  console.log("⏳ Attente de 30 secondes avant vérification...");
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // ============================================================
  // VÉRIFIER SUR BASESCAN
  // ============================================================
  
  console.log("\n🔍 Vérification sur Basescan...");
  
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });
    console.log("✅ Contrat vérifié sur Basescan !");
  } catch (error) {
    console.log("⚠️  Erreur vérification (normal si déjà vérifié) :", error.message);
  }
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 DÉPLOIEMENT TERMINÉ !");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n⚠️  PROCHAINES ÉTAPES :");
  console.log("   1. Copier l'adresse du contrat");
  console.log("   2. Mettre à jour dans le frontend :");
  console.log("      - hooks/useCreateRecurringPayment.ts");
  console.log("   3. Mettre à jour dans le keeper :");
  console.log("      - keeper-cloud/index.js (RECURRING_PAYMENT_ADDRESS)");
  console.log("   4. Tester avec un vrai paiement récurrent\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});
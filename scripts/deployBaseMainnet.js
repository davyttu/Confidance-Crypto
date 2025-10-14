const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT BASE MAINNET - PRODUCTION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 Compte :", deployer.address);
  console.log("🌐 Réseau :", network.name, `(chainId: ${network.chainId})`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Solde :", hre.ethers.formatEther(balance), "ETH");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (network.chainId !== 8453n) {
    throw new Error("❌ Pas sur Base Mainnet ! ChainId devrait être 8453");
  }

  // Configuration : montant minuscule pour test
  const payee = deployer.address;
  const now = Math.floor(Date.now() / 1000);
  const releaseTime = now + (15 * 60); // 15 minutes
  const amount = hre.ethers.parseEther("0.0001"); // ⚠️ PETIT MONTANT TEST

  console.log("📋 Paramètres :");
  console.log("   👤 Bénéficiaire :", payee);
  console.log("   ⏰ Release time :", new Date(releaseTime * 1000).toLocaleString());
  console.log("   💵 Montant : 0.0001 ETH (TEST)");
  console.log("   ⏱️  Dans 15 minutes !\n");

  // 1. Déployer ScheduledPayment
  console.log("📦 Déploiement de ScheduledPayment...");
  const ScheduledPayment = await hre.ethers.getContractFactory("ScheduledPayment");
  const payment = await ScheduledPayment.deploy(payee, releaseTime, { value: amount });
  await payment.waitForDeployment();
  const paymentAddress = await payment.getAddress();
  console.log("✅ ScheduledPayment déployé à :", paymentAddress);

  // 2. Déployer Resolver
  console.log("\n📦 Déploiement de ScheduledPaymentResolver...");
  const Resolver = await hre.ethers.getContractFactory("ScheduledPaymentResolver");
  const resolver = await Resolver.deploy(paymentAddress);
  await resolver.waitForDeployment();
  const resolverAddress = await resolver.getAddress();
  console.log("✅ Resolver déployé à :", resolverAddress);

  // Résumé
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ DÉPLOIEMENT TERMINÉ");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 ScheduledPayment :", paymentAddress);
  console.log("📍 Resolver :", resolverAddress);
  console.log(`🔍 Basescan : https://basescan.org/address/${paymentAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Sauvegarder
  const deploymentInfo = {
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    scheduledPayment: paymentAddress,
    resolver: resolverAddress,
    beneficiary: payee,
    releaseTime: releaseTime,
    releaseTimeReadable: new Date(releaseTime * 1000).toISOString(),
    amount: hre.ethers.formatEther(amount),
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
  };

  fs.writeFileSync("deployment-info-base.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Infos sauvegardées dans deployment-info-base.json");
  
  console.log("\n⚠️  IMPORTANT : Vérifiez les contrats sur Basescan !");
  console.log("💡 Prochaine étape :");
  console.log("   node external-scripts/createGelatoTaskBase.js\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT DES CONTRATS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 Déploiement par :", deployer.address);
  console.log("🌐 Réseau :", network.name, `(chainId: ${network.chainId})`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Solde :", hre.ethers.formatEther(balance), "ETH");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (balance === 0n) {
    throw new Error("❌ Pas assez d'ETH pour déployer !");
  }

  // Configuration
  const payee = "0xdbA6ABe2aBd4B9E007D102533Be76c460E06A833"; // ton wallet ou destinataire test
  const now = Math.floor(Date.now() / 1000);
  const releaseTime = now + 180; // 3 minutes
  const amount = hre.ethers.parseEther("0.001");

  console.log("📋 Paramètres de déploiement :");
  console.log("   👤 Bénéficiaire :", payee);
  console.log("   ⏰ Release time :", new Date(releaseTime * 1000).toLocaleString());
  console.log("   💵 Montant :", hre.ethers.formatEther(amount), "ETH");
  console.log();

  // 🔹 1. Déployer ScheduledPayment
  console.log("📦 Déploiement de ScheduledPayment...");
  const ScheduledPayment = await hre.ethers.getContractFactory("ScheduledPayment");
  const payment = await ScheduledPayment.deploy(payee, releaseTime, { value: amount });
  await payment.waitForDeployment();
  const paymentAddress = await payment.getAddress();
  console.log("✅ ScheduledPayment déployé à :", paymentAddress);

  // 🔹 2. Déployer Resolver
  console.log("\n📦 Déploiement de ScheduledPaymentResolver...");
  const Resolver = await hre.ethers.getContractFactory("ScheduledPaymentResolver");
  const resolver = await Resolver.deploy(paymentAddress);
  await resolver.waitForDeployment();
  const resolverAddress = await resolver.getAddress();
  console.log("✅ Resolver déployé à :", resolverAddress);

  // 🔹 3. Déployer PaymentFactory
  console.log("\n📦 Déploiement de PaymentFactory...");
  const PaymentFactory = await hre.ethers.getContractFactory("PaymentFactory");
  const factory = await PaymentFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ PaymentFactory déployé à :", factoryAddress);

  // Résumé final
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ DÉPLOIEMENT TERMINÉ");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 ScheduledPayment :", paymentAddress);
  console.log("📍 Resolver :", resolverAddress);
  console.log("📍 PaymentFactory :", factoryAddress);
  console.log("👤 Bénéficiaire :", payee);
  console.log("⏰ Release time :", new Date(releaseTime * 1000).toLocaleString());
  console.log("💵 Montant :", hre.ethers.formatEther(amount), "ETH");

  // Lien Etherscan selon le réseau
  if (network.chainId === 11155111n) {
    console.log("\n🔍 Vérification sur Etherscan :");
    console.log(`   ScheduledPayment: https://sepolia.etherscan.io/address/${paymentAddress}`);
    console.log(`   Resolver: https://sepolia.etherscan.io/address/${resolverAddress}`);
    console.log(`   Factory: https://sepolia.etherscan.io/address/${factoryAddress}`);
  } else if (network.chainId === 8453n) {
    console.log("\n🔍 Vérification sur Basescan :");
    console.log(`   ScheduledPayment: https://basescan.org/address/${paymentAddress}`);
    console.log(`   Resolver: https://basescan.org/address/${resolverAddress}`);
    console.log(`   Factory: https://basescan.org/address/${factoryAddress}`);
  }

  console.log("\n💡 Prochaine étape :");
  console.log("   node external-scripts/createGelatoTask.js");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Sauvegarder les adresses dans un fichier
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    scheduledPayment: paymentAddress,
    resolver: resolverAddress,
    paymentFactory: factoryAddress,
    beneficiary: payee,
    releaseTime: releaseTime,
    releaseTimeReadable: new Date(releaseTime * 1000).toISOString(),
    amount: hre.ethers.formatEther(amount),
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
  };

  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("📄 Infos sauvegardées dans deployment-info.json\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur de déploiement :", error);
  process.exitCode = 1;
});
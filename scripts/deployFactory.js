const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🏭 DÉPLOIEMENT PAYMENT FACTORY - BASE MAINNET");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 Compte :", deployer.address);
  console.log("🌐 Réseau :", network.name, `(chainId: ${network.chainId})`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Solde :", hre.ethers.formatEther(balance), "ETH");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (network.chainId !== 8453n) {
    throw new Error("❌ Pas sur Base Mainnet ! ChainId devrait être 8453");
  }

  // 1. Déployer PaymentFactory
  console.log("📦 Déploiement de PaymentFactory...");
  const PaymentFactory = await hre.ethers.getContractFactory("PaymentFactory");
  const factory = await PaymentFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ PaymentFactory déployé à :", factoryAddress);

  // Attendre quelques confirmations pour Basescan
  console.log("\n⏳ Attente de 5 confirmations pour Basescan...");
  await factory.deploymentTransaction().wait(5);

  // Résumé
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ DÉPLOIEMENT TERMINÉ");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 PaymentFactory :", factoryAddress);
  console.log(`🔍 Basescan : https://basescan.org/address/${factoryAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Sauvegarder
  const deploymentInfo = {
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    factoryAddress: factoryAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
  };

  fs.writeFileSync(
    "factory-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("📄 Infos sauvegardées dans factory-deployment.json");

  console.log("\n⚠️  IMPORTANT :");
  console.log("1. Vérifiez le contrat sur Basescan");
  console.log("2. Copiez l'adresse dans le frontend :");
  console.log(`   const FACTORY_ADDRESS = '${factoryAddress}';`);
  console.log("3. Testez d'abord avec un petit montant !\n");

  // Optionnel : Vérifier sur Basescan
  if (process.env.BASESCAN_API_KEY) {
    console.log("\n🔍 Vérification du contrat sur Basescan...");
    try {
      await hre.run("verify:verify", {
        address: factoryAddress,
        constructorArguments: [],
      });
      console.log("✅ Contrat vérifié sur Basescan");
    } catch (error) {
      console.log("⚠️  Erreur vérification (peut-être déjà vérifié) :", error.message);
    }
  }
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});
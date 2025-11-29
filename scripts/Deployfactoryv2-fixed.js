const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT FACTORY V2 - FIX CANCELLATION");
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
  // DÉPLOYER LA FACTORY V2 (AVEC FIX PAYER)
  // ============================================================
  
  console.log("📦 Déploiement PaymentFactory V2 (version corrigée)...");
  const PaymentFactory = await hre.ethers.getContractFactory("PaymentFactory");
  const factory = await PaymentFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  
  console.log("\n✅ Factory déployée avec succès !");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Adresse Factory :", factoryAddress);
  console.log("🔍 Basescan :", `https://basescan.org/address/${factoryAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Sauvegarder
  const deploymentInfo = {
    version: "V2-FIXED-CANCELLATION",
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    factoryAddress: factoryAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
    fix: "Payer correctement enregistré (msg.sender au lieu de Factory)"
  };

  fs.writeFileSync("factory-v2-fixed.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Info sauvegardée dans factory-v2-fixed.json\n");
  
  console.log("⚠️  PROCHAINES ÉTAPES :");
  console.log("   1. Vérifie le contrat sur Basescan");
  console.log("   2. Remplace l'adresse dans le frontend :");
  console.log(`      ANCIENNE : 0xFc3435c0cC56E7F9cBeb32Ea664e69fD6750B197`);
  console.log(`      NOUVELLE : ${factoryAddress}`);
  console.log("   3. Teste la création + annulation depuis le frontend\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});
/**
 * Vérifie PaymentFactory_Recurring sur Basescan (Base Sepolia ou Base Mainnet).
 * Lit factory-recurring-deployment.test.json ou factory-recurring-deployment.json
 * selon l'environnement.
 */
require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const useTest = process.env.VERIFY_RECURRING_TEST !== "false";
  const filename = useTest ? "factory-recurring-deployment.test.json" : "factory-recurring-deployment.json";
  const filepath = path.join(__dirname, "..", filename);

  if (!fs.existsSync(filepath)) {
    console.error(`❌ Fichier non trouvé : ${filename}`);
    console.log("   Déploie d'abord : npx hardhat run scripts/deployFactoryRecurring.js --network base_sepolia");
    process.exitCode = 1;
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(filepath, "utf8"));
  const { factoryAddress, constants, chainId } = deployment;
  const secondsPerMonth = deployment.constants?.secondsPerMonth ?? (chainId === "8453" ? 2592000 : 300);

  const networkName = chainId === "84532" ? "base_sepolia" : "base_mainnet";
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 VÉRIFICATION PAYMENTFACTORY_RECURRING");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("📍 Adresse :", factoryAddress);
  console.log("⏱️  secondsPerMonth :", secondsPerMonth);
  console.log("🌐 Réseau :", networkName, "\n");

  try {
    await hre.run("verify:verify", {
      address: factoryAddress,
      constructorArguments: [secondsPerMonth],
      network: networkName,
    });
    console.log("\n✅ Contrat vérifié avec succès !");
    console.log(
      chainId === "84532"
        ? `🔗 https://sepolia.basescan.org/address/${factoryAddress}#code\n`
        : `🔗 https://basescan.org/address/${factoryAddress}#code\n`
    );
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("\n✅ Le contrat est déjà vérifié.\n");
    } else {
      console.error("\n❌ Erreur :", err.message);
      console.log("\n💡 Vérification manuelle :");
      console.log(`   npx hardhat verify --network ${networkName} ${factoryAddress} ${secondsPerMonth}\n`);
      process.exitCode = 1;
    }
  }
}

main().catch(console.error);

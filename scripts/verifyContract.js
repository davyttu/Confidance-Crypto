require("dotenv").config();
const hre = require("hardhat");

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 VÉRIFICATION DU CONTRAT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const CONTRACT_ADDRESS = "0x05D44782992c96310133C74eB57b8A84C4CEAe9e";
  const PAYEE = "0x8CC0D8f899b0eF553459Aac249b14A95F0470cE9";
  const RELEASE_TIME = 1760568429;

  console.log("📍 Contrat :", CONTRACT_ADDRESS);
  console.log("👤 Payee :", PAYEE);
  console.log("⏰ Release time :", RELEASE_TIME);
  console.log("\n🔄 Vérification en cours...\n");

  try {
    await hre.run("verify:verify", {
      address: CONTRACT_ADDRESS,
      constructorArguments: [PAYEE, RELEASE_TIME],
    });

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ CONTRAT VÉRIFIÉ AVEC SUCCÈS !");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\n🔗 https://basescan.org/address/${CONTRACT_ADDRESS}#code\n`);

  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ LE CONTRAT EST DÉJÀ VÉRIFIÉ !");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`\n🔗 https://basescan.org/address/${CONTRACT_ADDRESS}#code\n`);
    } else {
      console.error("\n❌ Erreur :", error.message);
      console.log("\n💡 Utilise l'interface web : https://basescan.org/verifyContract\n");
    }
  }
}

main().catch(console.error);
require("dotenv").config();
const hre = require("hardhat");

/**
 * Script pour vérifier un contrat ScheduledPayment sur Basescan
 * 
 * Usage:
 *   npx hardhat run scripts/verifyScheduledPayment.js --network base_mainnet
 * 
 * Le script lit automatiquement les paramètres du contrat depuis la blockchain
 */

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 VÉRIFICATION CONTRAT ScheduledPayment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ⚠️ MODIFIEZ CETTE ADRESSE avec le contrat que vous voulez vérifier
  const CONTRACT_ADDRESS = "0xf4043298c5aeb66ea85ef7da5c30955e26c253c2";

  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    throw new Error("❌ Veuillez modifier CONTRACT_ADDRESS dans le script");
  }

  console.log("📍 Adresse du contrat :", CONTRACT_ADDRESS);
  console.log("🌐 Réseau :", (await hre.ethers.provider.getNetwork()).name);
  console.log("\n🔍 Lecture des paramètres depuis le contrat...\n");

  try {
    // Charger l'ABI du ScheduledPayment
    const ScheduledPayment = await hre.ethers.getContractFactory("ScheduledPayment");
    const contract = ScheduledPayment.attach(CONTRACT_ADDRESS);

    // Lire tous les paramètres du contrat
    const [payee, amountToPayee, protocolFee, releaseTime, cancellable, payer] = await Promise.all([
      contract.payee(),
      contract.amountToPayee(),
      contract.protocolFee(),
      contract.releaseTime(),
      contract.cancellable(),
      contract.payer(),
    ]);

    console.log("📋 Paramètres lus depuis le contrat :");
    console.log("   👤 Payee :", payee);
    console.log("   💰 Amount to Payee :", hre.ethers.formatEther(amountToPayee), "ETH");
    console.log("   💸 Protocol Fee :", hre.ethers.formatEther(protocolFee), "ETH");
    console.log("   ⏰ Release Time :", releaseTime.toString(), `(${new Date(Number(releaseTime) * 1000).toLocaleString()})`);
    console.log("   🔒 Cancellable :", cancellable);
    console.log("   👤 Payer :", payer);
    
    // ⚠️ Avertissement si payer = Factory
    const FACTORY_ADDRESS = "0x7F80CB9c88b1993e8267dab207f33EDf8f4ef744";
    if (payer.toLowerCase() === FACTORY_ADDRESS.toLowerCase()) {
      console.log("\n⚠️  ATTENTION : Le payer du contrat est la Factory !");
      console.log("   Cela signifie que ce contrat a été créé par une ancienne version");
      console.log("   qui ne transmet pas le msg.sender réel au constructeur.");
      console.log("   L'annulation pourrait ne pas fonctionner correctement.\n");
    }
    
    console.log("\n🔄 Vérification sur Basescan...\n");

    // Vérifier le contrat avec les paramètres
    // Hardhat gère automatiquement les imports OpenZeppelin
    await hre.run("verify:verify", {
      address: CONTRACT_ADDRESS,
      constructorArguments: [
        payee,
        amountToPayee,
        releaseTime,
        cancellable,
      ],
      // Ne pas spécifier le contrat, Hardhat le trouve automatiquement
    });

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ CONTRAT VÉRIFIÉ AVEC SUCCÈS !");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\n🔗 https://basescan.org/address/${CONTRACT_ADDRESS}#code\n`);

  } catch (error) {
    if (error.message.includes("Already Verified") || error.message.includes("Contract source code already verified")) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ LE CONTRAT EST DÉJÀ VÉRIFIÉ !");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`\n🔗 https://basescan.org/address/${CONTRACT_ADDRESS}#code\n`);
    } else {
      console.error("\n❌ Erreur lors de la vérification :");
      console.error(error.message);
      
      if (error.message.includes("Invalid API Key") || error.message.includes("BASESCAN_API_KEY")) {
        console.log("\n💡 Solution :");
        console.log("   1. Créez une clé API sur https://basescan.org/myapikey");
        console.log("   2. Ajoutez-la dans votre .env :");
        console.log("      BASESCAN_API_KEY=votre_cle_api");
        console.log("   3. Relancez le script");
      } else if (error.message.includes("Constructor arguments")) {
        console.log("\n💡 Le script n'a pas pu lire les paramètres du contrat.");
        console.log("   Vérifiez que l'adresse est correcte et que le contrat existe.");
      } else {
        console.log("\n💡 Solutions possibles :");
        console.log("   1. Vérifiez que BASESCAN_API_KEY est dans votre .env");
        console.log("   2. Vérifiez que vous êtes sur le bon réseau (Base Mainnet)");
        console.log("   3. Essayez manuellement sur : https://basescan.org/verifyContract");
        console.log("\n   Pour la vérification manuelle :");
        console.log("   - Compiler Version: 0.8.20");
        console.log("   - License: MIT");
        console.log("   - Optimization: Yes, Runs: 200");
        console.log("   - Constructor Arguments (ABI-encoded):");
        console.log("     Utilisez le script pour voir les valeurs ci-dessus");
      }
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error("\n❌ Erreur fatale :", error);
  process.exit(1);
});

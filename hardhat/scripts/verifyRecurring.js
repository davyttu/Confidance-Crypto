const hre = require("hardhat");

async function main() {
  // Adresse du contrat à vérifier (hardcodée pour l'instant)
  const contractAddress = "0xc08dd4390a45f9bf5887828c27f92b3617a90c56";
  
  console.log("ℹ️  Pour vérifier un autre contrat, modifiez l'adresse dans le script");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 VÉRIFICATION CONTRAT SUR BASESCAN");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Contrat:", contractAddress);
  console.log("");

  try {
    // Vérifier le contrat RecurringPaymentERC20
    await hre.run("verify:verify", {
      address: contractAddress,
      contract: "contracts/RecurringPaymentERC20.sol:RecurringPaymentERC20"
    });
    
    console.log("\n✅ Contrat vérifié avec succès !");
    console.log(`🔗 https://basescan.org/address/${contractAddress}#code`);
    
  } catch (error) {
    console.error("\n❌ Erreur lors de la vérification :", error.message);
    
    if (error.message.includes("Already Verified")) {
      console.log("✅ Le contrat est déjà vérifié !");
      console.log(`🔗 https://basescan.org/address/${contractAddress}#code`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

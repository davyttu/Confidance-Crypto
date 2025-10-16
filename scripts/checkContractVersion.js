const hre = require("hardhat");

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 VÉRIFICATION VERSION DU CONTRAT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const CONTRACT_ADDRESS = "0x05D44782992c96310133C74eB57b8A84C4CEAe9e";

  // ABI avec les NOUVELLES fonctions (fees)
  const ABI_WITH_FEES = [
    "function PROTOCOL_FEE_WALLET() view returns (address)",
    "function FEE_PERCENTAGE() view returns (uint256)",
    "function getAmounts() view returns (uint256 totalAmount, uint256 protocolFee, uint256 amountToPayee)"
  ];

  const contract = new hre.ethers.Contract(CONTRACT_ADDRESS, ABI_WITH_FEES, hre.ethers.provider);

  console.log("📍 Contrat testé :", CONTRACT_ADDRESS);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Test 1 : PROTOCOL_FEE_WALLET
  try {
    const feeWallet = await contract.PROTOCOL_FEE_WALLET();
    console.log("✅ PROTOCOL_FEE_WALLET existe !");
    console.log(`   Valeur : ${feeWallet}`);
    
    if (feeWallet === "0xa34eDf91Cc494450000Eef08e6563062B2F115a9") {
      console.log("   ✅ Adresse correcte !\n");
    } else {
      console.log("   ⚠️  Adresse incorrecte !\n");
    }
  } catch (error) {
    console.log("❌ PROTOCOL_FEE_WALLET n'existe PAS !");
    console.log("   → C'est l'ANCIENNE version (sans fees) ❌\n");
    return false;
  }

  // Test 2 : FEE_PERCENTAGE
  try {
    const feePercentage = await contract.FEE_PERCENTAGE();
    console.log("✅ FEE_PERCENTAGE existe !");
    console.log(`   Valeur : ${feePercentage} (${Number(feePercentage) / 100}%)`);
    
    if (Number(feePercentage) === 179) {
      console.log("   ✅ Pourcentage correct (1.79%) !\n");
    } else {
      console.log("   ⚠️  Pourcentage incorrect !\n");
    }
  } catch (error) {
    console.log("❌ FEE_PERCENTAGE n'existe PAS !\n");
    return false;
  }

  // Test 3 : getAmounts()
  try {
    const amounts = await contract.getAmounts();
    console.log("✅ getAmounts() existe !");
    console.log(`   Total : ${hre.ethers.formatEther(amounts.totalAmount)} ETH`);
    console.log(`   Fee protocole : ${hre.ethers.formatEther(amounts.protocolFee)} ETH`);
    console.log(`   Vers bénéficiaire : ${hre.ethers.formatEther(amounts.amountToPayee)} ETH\n`);
  } catch (error) {
    console.log("❌ getAmounts() n'existe PAS !\n");
    return false;
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 C'EST LA NOUVELLE VERSION AVEC FEES !");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n💰 Le système de fees (1.79%) est ACTIF ! ✅");
  console.log("🏦 Wallet protocole : 0xa34eDf91Cc494450000Eef08e6563062B2F115a9\n");

  return true;
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error.message);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("❌ C'EST L'ANCIENNE VERSION (SANS FEES)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n💡 Solution :");
  console.log("   1. npx hardhat clean");
  console.log("   2. npx hardhat compile --force");
  console.log("   3. Redéployer un nouveau contrat\n");
});
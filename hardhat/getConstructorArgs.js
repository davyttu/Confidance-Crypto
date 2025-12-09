const { ethers } = require("ethers");
require("dotenv").config();

// Configuration
const RPC_URL = process.env.BASE_RPC || "https://mainnet.base.org";
const CONTRACT_ADDRESS = "0xc08dd4390a45f9bf5887828c27f92b3617a90c56";

// ABI minimal pour lire les paramètres
const RECURRING_ABI = [
  "function payer() view returns (address)",
  "function payee() view returns (address)",
  "function tokenAddress() view returns (address)",
  "function monthlyAmount() view returns (uint256)",
  "function totalMonths() view returns (uint256)",
  "function dayOfMonth() view returns (uint256)",
  "function firstPaymentTime() view returns (uint256)"
];

async function getConstructorArgs() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 RÉCUPÉRATION ARGUMENTS CONSTRUCTEUR");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, RECURRING_ABI, provider);

  try {
    console.log("Lecture du contrat...\n");
    
    const payer = await contract.payer();
    const payee = await contract.payee();
    const tokenAddress = await contract.tokenAddress();
    const monthlyAmount = await contract.monthlyAmount();
    const totalMonths = await contract.totalMonths();
    const dayOfMonth = await contract.dayOfMonth();
    const firstPaymentTime = await contract.firstPaymentTime();

    console.log("✅ Arguments récupérés :\n");
    console.log("payer           :", payer);
    console.log("payee           :", payee);
    console.log("tokenAddress    :", tokenAddress);
    console.log("monthlyAmount   :", monthlyAmount.toString());
    console.log("totalMonths     :", totalMonths.toString());
    console.log("dayOfMonth      :", dayOfMonth.toString());
    console.log("firstPaymentTime:", firstPaymentTime.toString());
    
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📝 COMMANDE DE VÉRIFICATION");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    console.log("Copie-colle cette commande :\n");
    console.log(`npx hardhat verify --network base_mainnet ${CONTRACT_ADDRESS} "${payer}" "${payee}" "${tokenAddress}" "${monthlyAmount.toString()}" "${totalMonths.toString()}" "${dayOfMonth.toString()}" "${firstPaymentTime.toString()}"`);
    
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  } catch (error) {
    console.error("❌ Erreur :", error.message);
  }
}

getConstructorArgs();

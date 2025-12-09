require("dotenv").config();
const { ethers } = require("ethers");

// Configuration
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const RECURRING_CONTRACT = "0xab18dd9ede43e6aff47e4e236b6185117d89c7b1"; // Votre contrat récurrent
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC sur Base

// ABIs
const RECURRING_ABI = [
  "function payer() view returns (address)",
  "function payee() view returns (address)",
  "function tokenAddress() view returns (address)",
  "function monthlyAmount() view returns (uint256)",
  "function totalMonths() view returns (uint256)",
  "function executedMonths() view returns (uint256)",
  "function getCurrentAllowance() view returns (uint256)",
  "function getStatus() view returns (string memory status, uint256 monthsExecuted, uint256 monthsRemaining, uint256 amountPaid, uint256 monthsFailed)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function checkRecurringPayment() {
  console.log("🔍 Vérification du paiement récurrent...\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const recurringContract = new ethers.Contract(RECURRING_CONTRACT, RECURRING_ABI, provider);
  const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);

  try {
    // Lire les infos du contrat
    console.log("📋 Informations du contrat:");
    const payer = await recurringContract.payer();
    const payee = await recurringContract.payee();
    const tokenAddress = await recurringContract.tokenAddress();
    const monthlyAmount = await recurringContract.monthlyAmount();
    const totalMonths = await recurringContract.totalMonths();
    const executedMonths = await recurringContract.executedMonths();

    console.log(`   Payer: ${payer}`);
    console.log(`   Payee: ${payee}`);
    console.log(`   Token: ${tokenAddress}`);
    console.log(`   Montant mensuel: ${ethers.formatUnits(monthlyAmount, 6)} USDC`);
    console.log(`   Mois total: ${totalMonths}`);
    console.log(`   Mois exécutés: ${executedMonths}`);

    // Vérifier le statut
    console.log("\n📊 Statut du paiement:");
    const [status, monthsExecuted, monthsRemaining, amountPaid, monthsFailed] = await recurringContract.getStatus();
    console.log(`   Status: ${status}`);
    console.log(`   Mois exécutés: ${monthsExecuted}`);
    console.log(`   Mois restants: ${monthsRemaining}`);
    console.log(`   Montant payé: ${ethers.formatUnits(amountPaid, 6)} USDC`);
    console.log(`   Mois échoués: ${monthsFailed}`);

    // Vérifier l'allowance
    console.log("\n💳 Vérification de l'allowance:");
    const allowance = await usdcContract.allowance(payer, RECURRING_CONTRACT);
    const currentAllowance = await recurringContract.getCurrentAllowance();
    console.log(`   Allowance directe (ERC20): ${ethers.formatUnits(allowance, 6)} USDC`);
    console.log(`   Allowance via contrat: ${ethers.formatUnits(currentAllowance, 6)} USDC`);

    // Calculer le montant requis (mensuel + fees)
    const feePerMonth = (monthlyAmount * 179n) / 10000n;
    const totalPerMonth = monthlyAmount + feePerMonth;
    const totalRequired = totalPerMonth * BigInt(totalMonths - executedMonths);

    console.log(`   Montant requis par mois: ${ethers.formatUnits(totalPerMonth, 6)} USDC`);
    console.log(`   Total requis restant: ${ethers.formatUnits(totalRequired, 6)} USDC`);
    console.log(`   Allowance suffisante: ${allowance >= totalRequired ? "✅ OUI" : "❌ NON"}`);

    // Vérifier la balance du payer
    console.log("\n💰 Balance du payer:");
    const balance = await usdcContract.balanceOf(payer);
    console.log(`   Balance USDC: ${ethers.formatUnits(balance, 6)} USDC`);
    console.log(`   Balance suffisante pour 1 mois: ${balance >= totalPerMonth ? "✅ OUI" : "❌ NON"}`);

    // Diagnostic
    console.log("\n🔍 DIAGNOSTIC:");
    if (allowance < totalRequired) {
      console.log("   ❌ PROBLÈME: Allowance insuffisante !");
      console.log(`      Il manque ${ethers.formatUnits(totalRequired - allowance, 6)} USDC d'allowance`);
      console.log(`      Solution: Approuver ${ethers.formatUnits(totalRequired, 6)} USDC pour le contrat ${RECURRING_CONTRACT}`);
    }
    if (balance < totalPerMonth) {
      console.log("   ❌ PROBLÈME: Balance insuffisante !");
      console.log(`      Il manque ${ethers.formatUnits(totalPerMonth - balance, 6)} USDC sur le wallet`);
      console.log(`      Solution: Ajouter au moins ${ethers.formatUnits(totalPerMonth, 6)} USDC au wallet ${payer}`);
    }
    if (allowance >= totalRequired && balance >= totalPerMonth) {
      console.log("   ✅ Tout est OK ! Le prochain paiement devrait fonctionner.");
    }

  } catch (error) {
    console.error("\n❌ Erreur:", error.message);
  }
}

checkRecurringPayment();

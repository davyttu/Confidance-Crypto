const { ethers } = require("ethers");
require("dotenv").config();

// Configuration
const RPC_URL = process.env.BASE_RPC || "https://mainnet.base.org";
const CONTRACT_ADDRESS = process.argv[2];

// Délai entre chaque appel (300ms)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

if (!CONTRACT_ADDRESS) {
  console.error("❌ Usage: node diagRecurring.js <CONTRACT_ADDRESS>");
  process.exit(1);
}

// ABI minimal
const RECURRING_ABI = [
  "function payer() view returns (address)",
  "function payee() view returns (address)",
  "function tokenAddress() view returns (address)",
  "function monthlyAmount() view returns (uint256)",
  "function totalMonths() view returns (uint256)",
  "function monthsPaid() view returns (uint256)",
  "function dayOfMonth() view returns (uint256)",
  "function firstPaymentTime() view returns (uint256)",
  "function nextPaymentTime() view returns (uint256)",
  "function cancelled() view returns (bool)",
  "function isActive() view returns (bool)",
  "function canExecute() view returns (bool)",
  "function getTotalMonthsRemaining() view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

async function checkRecurringPayment() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 DIAGNOSTIC PAIEMENT RÉCURRENT (avec délais)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const recurringContract = new ethers.Contract(CONTRACT_ADDRESS, RECURRING_ABI, provider);

    console.log("📋 Récupération des données (patience...)");
    
    // Appels avec délais
    const payer = await recurringContract.payer();
    await delay(300);
    
    const payee = await recurringContract.payee();
    await delay(300);
    
    const tokenAddress = await recurringContract.tokenAddress();
    await delay(300);
    
    const monthlyAmount = await recurringContract.monthlyAmount();
    await delay(300);
    
    const totalMonths = await recurringContract.totalMonths();
    await delay(300);
    
    const monthsPaid = await recurringContract.monthsPaid();
    await delay(300);
    
    const dayOfMonth = await recurringContract.dayOfMonth();
    await delay(300);
    
    const firstPaymentTime = await recurringContract.firstPaymentTime();
    await delay(300);
    
    const nextPaymentTime = await recurringContract.nextPaymentTime();
    await delay(300);
    
    const cancelled = await recurringContract.cancelled();
    await delay(300);
    
    const isActive = await recurringContract.isActive();
    await delay(300);
    
    const canExecute = await recurringContract.canExecute();
    await delay(300);
    
    const monthsRemaining = await recurringContract.getTotalMonthsRemaining();
    
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 INFORMATIONS CONTRAT");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Payer       :", payer);
    console.log("Payee       :", payee);
    console.log("Token       :", tokenAddress);
    console.log("Montant/mois:", ethers.formatUnits(monthlyAmount, 6), "tokens");
    console.log("Mois total  :", totalMonths.toString());
    console.log("Mois payés  :", monthsPaid.toString());
    console.log("Mois restants:", monthsRemaining.toString());
    console.log("Jour du mois:", dayOfMonth.toString());
    
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⏰ TIMING");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const now = Math.floor(Date.now() / 1000);
    const firstDate = new Date(Number(firstPaymentTime) * 1000);
    const nextDate = new Date(Number(nextPaymentTime) * 1000);
    
    console.log("Premier paiement :", firstDate.toLocaleString('fr-FR'));
    console.log("Prochain paiement:", nextDate.toLocaleString('fr-FR'));
    console.log("Date actuelle    :", new Date(now * 1000).toLocaleString('fr-FR'));
    
    const minutesLeft = Math.floor((Number(nextPaymentTime) - now) / 60);
    if (minutesLeft > 0) {
      console.log("\n⏱️  Temps avant prochain:", minutesLeft, "minutes");
    } else {
      console.log("\n⏱️  Prochain paiement: PRÊT À EXÉCUTER");
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 STATUT");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Annulé       :", cancelled ? "❌ OUI" : "✅ NON");
    console.log("Actif        :", isActive ? "✅ OUI" : "❌ NON");
    console.log("Peut exécuter:", canExecute ? "✅ OUI" : "❌ NON");

    // Token info
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💰 TOKEN (ERC20)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    await delay(300);
    const balance = await tokenContract.balanceOf(payer);
    await delay(300);
    const allowance = await tokenContract.allowance(payer, CONTRACT_ADDRESS);
    await delay(300);
    const decimals = await tokenContract.decimals();
    await delay(300);
    const symbol = await tokenContract.symbol();

    console.log("Symbole      :", symbol);
    console.log("Balance payer:", ethers.formatUnits(balance, decimals), symbol);
    console.log("Allowance    :", ethers.formatUnits(allowance, decimals), symbol);
    console.log("Nécessaire   :", ethers.formatUnits(monthlyAmount, decimals), symbol);

    // Analyse
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 ANALYSE");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const issues = [];

    if (cancelled) issues.push("❌ Le paiement a été annulé");
    if (!isActive) issues.push("❌ Le paiement n'est pas actif");
    if (balance < monthlyAmount) {
      issues.push(`❌ Balance insuffisante (${ethers.formatUnits(balance, decimals)} ${symbol})`);
    }
    if (allowance < monthlyAmount) {
      issues.push(`❌ Allowance insuffisante (${ethers.formatUnits(allowance, decimals)} ${symbol})`);
    }
    if (now < Number(nextPaymentTime)) {
      issues.push(`⏰ Trop tôt (encore ${minutesLeft} minutes)`);
    }
    if (monthsPaid >= totalMonths) {
      issues.push("✅ Tous les mois payés");
    }

    if (issues.length === 0) {
      console.log("✅ Aucun problème détecté !");
    } else {
      console.log("⚠️  Problèmes détectés :\n");
      issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  } catch (error) {
    console.error("\n❌ Erreur :", error.message);
  }
}

checkRecurringPayment();

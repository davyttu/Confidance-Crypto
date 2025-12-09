const { ethers } = require("ethers");
require("dotenv").config();

// Configuration
const RPC_URL = "https://mainnet.base.org";
const CONTRACT_ADDRESS = process.argv[2]; // Adresse du contrat récurrent

if (!CONTRACT_ADDRESS) {
  console.error("❌ Usage: node checkRecurringState.js <CONTRACT_ADDRESS>");
  process.exit(1);
}

// ABI minimal du contrat récurrent
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

// ABI ERC20 pour vérifier balance et allowance
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

async function checkRecurringPayment() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 DIAGNOSTIC PAIEMENT RÉCURRENT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const recurringContract = new ethers.Contract(CONTRACT_ADDRESS, RECURRING_ABI, provider);

    // 1. Récupérer les infos du contrat (séquentiellement pour éviter batch limit)
    console.log("📋 INFORMATIONS CONTRAT");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const payer = await recurringContract.payer();
    const payee = await recurringContract.payee();
    const tokenAddress = await recurringContract.tokenAddress();
    const monthlyAmount = await recurringContract.monthlyAmount();
    const totalMonths = await recurringContract.totalMonths();
    const monthsPaid = await recurringContract.monthsPaid();
    const dayOfMonth = await recurringContract.dayOfMonth();
    const firstPaymentTime = await recurringContract.firstPaymentTime();
    const nextPaymentTime = await recurringContract.nextPaymentTime();
    const cancelled = await recurringContract.cancelled();
    const isActive = await recurringContract.isActive();
    const canExecute = await recurringContract.canExecute();
    const monthsRemaining = await recurringContract.getTotalMonthsRemaining();

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
    console.log("\n⏱️  Temps avant prochain:", Math.floor((Number(nextPaymentTime) - now) / 60), "minutes");

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 STATUT");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Annulé       :", cancelled ? "❌ OUI" : "✅ NON");
    console.log("Actif        :", isActive ? "✅ OUI" : "❌ NON");
    console.log("Peut exécuter:", canExecute ? "✅ OUI" : "❌ NON");

    // 2. Vérifier le token (balance + allowance)
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💰 TOKEN (ERC20)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    const balance = await tokenContract.balanceOf(payer);
    const allowance = await tokenContract.allowance(payer, CONTRACT_ADDRESS);
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();

    console.log("Symbole      :", symbol);
    console.log("Décimales    :", decimals.toString());
    console.log("Balance payer:", ethers.formatUnits(balance, decimals), symbol);
    console.log("Allowance    :", ethers.formatUnits(allowance, decimals), symbol);
    console.log("Nécessaire   :", ethers.formatUnits(monthlyAmount, decimals), symbol);

    // 3. Analyse des problèmes
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 ANALYSE");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const issues = [];

    if (cancelled) {
      issues.push("❌ Le paiement a été annulé");
    }

    if (!isActive) {
      issues.push("❌ Le paiement n'est pas actif");
    }

    if (balance < monthlyAmount) {
      issues.push(`❌ Balance insuffisante (${ethers.formatUnits(balance, decimals)} ${symbol} < ${ethers.formatUnits(monthlyAmount, decimals)} ${symbol})`);
    }

    if (allowance < monthlyAmount) {
      issues.push(`❌ Allowance insuffisante (${ethers.formatUnits(allowance, decimals)} ${symbol} < ${ethers.formatUnits(monthlyAmount, decimals)} ${symbol})`);
    }

    if (now < Number(nextPaymentTime)) {
      const minutesLeft = Math.floor((Number(nextPaymentTime) - now) / 60);
      issues.push(`⏰ Trop tôt pour exécuter (encore ${minutesLeft} minutes)`);
    }

    if (monthsPaid >= totalMonths) {
      issues.push("✅ Tous les mois ont été payés");
    }

    if (issues.length === 0) {
      console.log("✅ Aucun problème détecté !");
      console.log("🤔 Le contrat devrait pouvoir être exécuté.");
    } else {
      console.log("⚠️  Problèmes détectés :\n");
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💡 RECOMMANDATIONS");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (balance < monthlyAmount) {
      console.log("1. Ajouter des tokens au wallet payer :");
      console.log(`   - Adresse : ${payer}`);
      console.log(`   - Token   : ${symbol} (${tokenAddress})`);
      console.log(`   - Montant : ${ethers.formatUnits(monthlyAmount, decimals)} ${symbol}`);
    }

    if (allowance < monthlyAmount) {
      console.log("2. Augmenter l'allowance :");
      console.log(`   - Appeler approve() sur le token`);
      console.log(`   - Spender : ${CONTRACT_ADDRESS}`);
      console.log(`   - Amount  : ${ethers.formatUnits(monthlyAmount * totalMonths, decimals)} ${symbol}`);
    }

    if (now < Number(nextPaymentTime)) {
      console.log("3. Attendre la date du prochain paiement :");
      console.log(`   - ${nextDate.toLocaleString('fr-FR')}`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  } catch (error) {
    console.error("\n❌ Erreur lors du diagnostic :", error.message);
    console.error("\nStack trace :", error);
  }
}

checkRecurringPayment();

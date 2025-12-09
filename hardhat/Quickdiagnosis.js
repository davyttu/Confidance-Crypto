const { ethers } = require("ethers");

async function diagnose() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 DIAGNOSTIC RAPIDE - PAIEMENT RÉCURRENT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Configuration
  const RPC = "https://mainnet.base.org";
  const FACTORY = "0xd8e57052142b62081687137c44C54F78306547f8";
  const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const PAYER = "0x6dA037844b5aF28ACac7E48D43d81469169B50Fe";

  const provider = new ethers.JsonRpcProvider(RPC);

  console.log("📍 Configuration:");
  console.log("   Factory:", FACTORY);
  console.log("   USDC:", USDC);
  console.log("   Payer:", PAYER);
  console.log();

  // 1. Vérifier balance USDC
  console.log("1️⃣ Balance USDC du payer:");
  console.log("   ─────────────────────────────");
  
  const usdcContract = new ethers.Contract(
    USDC,
    ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
    provider
  );

  try {
    const balance = await usdcContract.balanceOf(PAYER);
    const decimals = await usdcContract.decimals();
    const balanceFormatted = ethers.formatUnits(balance, decimals);
    
    console.log("   Balance:", balanceFormatted, "USDC");
    
    const needed = 3; // 3 USDC pour 3 mois
    if (parseFloat(balanceFormatted) < needed) {
      console.log("   ❌ INSUFFISANT ! Il faut au moins", needed, "USDC");
      console.log("   💡 Solution: Ajouter de l'USDC au wallet\n");
      return;
    } else {
      console.log("   ✅ Suffisant pour 3 mois\n");
    }
  } catch (err) {
    console.log("   ❌ Erreur:", err.message, "\n");
    return;
  }

  // 2. Vérifier allowance USDC
  console.log("2️⃣ Allowance USDC pour la Factory:");
  console.log("   ─────────────────────────────");
  
  const usdcFull = new ethers.Contract(
    USDC,
    ["function allowance(address,address) view returns (uint256)"],
    provider
  );

  try {
    const allowance = await usdcFull.allowance(PAYER, FACTORY);
    const decimals = 6; // USDC decimals
    const allowanceFormatted = ethers.formatUnits(allowance, decimals);
    
    console.log("   Allowance:", allowanceFormatted, "USDC");
    
    const needed = 3; // 3 USDC
    if (parseFloat(allowanceFormatted) < needed) {
      console.log("   ⚠️  INSUFFISANT ! Il faut approuver", needed, "USDC");
      console.log("   💡 Solution: L'approbation se fera automatiquement au frontend\n");
    } else {
      console.log("   ✅ Suffisant (déjà approuvé)\n");
    }
  } catch (err) {
    console.log("   ❌ Erreur:", err.message, "\n");
  }

  // 3. Vérifier la Factory
  console.log("3️⃣ Vérification Factory:");
  console.log("   ─────────────────────────────");
  
  try {
    const code = await provider.getCode(FACTORY);
    if (code === "0x") {
      console.log("   ❌ ERREUR CRITIQUE: Factory n'existe pas !");
      console.log("   💡 L'adresse n'est pas un contrat\n");
      return;
    } else {
      console.log("   ✅ Factory existe (bytecode:", code.length, "caractères)");
      console.log("   🔗 Basescan: https://basescan.org/address/" + FACTORY);
      console.log();
    }
  } catch (err) {
    console.log("   ❌ Erreur:", err.message, "\n");
    return;
  }

  // 4. Tester l'appel
  console.log("4️⃣ Test simulation (sans envoyer):");
  console.log("   ─────────────────────────────");
  
  const factory = new ethers.Contract(
    FACTORY,
    [
      "function createRecurringPaymentERC20(address,address,uint256,uint256,uint256,uint256) returns (address)"
    ],
    provider
  );

  const params = {
    payee: "0x8CC0D8f899b0eF553459Aac249b14A95F0470cE9",
    token: USDC,
    monthlyAmount: ethers.parseUnits("1", 6), // 1 USDC
    totalMonths: 3,
    dayOfMonth: 8,
    firstPaymentTime: Math.floor(Date.now() / 1000) + (2 * 24 * 60 * 60) // +2 jours
  };

  console.log("   Paramètres:");
  console.log("   - Payee:", params.payee);
  console.log("   - Monthly:", ethers.formatUnits(params.monthlyAmount, 6), "USDC");
  console.log("   - Durée:", params.totalMonths, "mois");
  console.log("   - Jour:", params.dayOfMonth);
  console.log("   - Premier paiement:", new Date(params.firstPaymentTime * 1000).toLocaleString());
  console.log();

  try {
    // Simulation (callStatic)
    const result = await factory.createRecurringPaymentERC20.staticCall(
      params.payee,
      params.token,
      params.monthlyAmount,
      params.totalMonths,
      params.dayOfMonth,
      params.firstPaymentTime,
      { from: PAYER }
    );

    console.log("   ✅ SIMULATION RÉUSSIE !");
    console.log("   📍 Contrat qui serait créé:", result);
    console.log();
  } catch (err) {
    console.log("   ❌ SIMULATION ÉCHOUÉE !");
    console.log("   Erreur:", err.message);
    
    if (err.message.includes("insufficient")) {
      console.log("\n   💡 Cause probable: Balance ou allowance insuffisante");
    } else if (err.message.includes("Invalid")) {
      console.log("\n   💡 Cause probable: Paramètres invalides");
    } else {
      console.log("\n   💡 Cause inconnue - voir l'erreur ci-dessus");
    }
    console.log();
    return;
  }

  // Conclusion
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ DIAGNOSTIC COMPLET");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n💡 CONCLUSION:");
  console.log("   Tous les tests sont passés ✅");
  console.log("   La création DEVRAIT fonctionner depuis le frontend.");
  console.log("\n🔍 CAUSES POSSIBLES DE L'ÉCHEC:");
  console.log("   1. Gas price trop bas dans MetaMask");
  console.log("   2. Nonce bloqué (transaction en attente)");
  console.log("   3. Hook frontend avec bug");
  console.log("   4. Paramètres mal formatés (BigInt, timestamp)");
  console.log("\n📋 PROCHAINES ÉTAPES:");
  console.log("   1. Vérifie la console navigateur (F12)");
  console.log("   2. Regarde les logs lors de la création");
  console.log("   3. Essaie avec un montant différent (0.5 USDC)");
  console.log();
}

diagnose().catch(console.error);

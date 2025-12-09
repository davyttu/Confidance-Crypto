const hre = require("hardhat");

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔄 CRÉATION MANUELLE - PAIEMENT RÉCURRENT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [signer] = await hre.ethers.getSigners();
  
  // ===== CONFIGURATION =====
  const FACTORY = "0xd8e57052142b62081687137c44C54F78306547f8";
  const USDT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDT sur Base
  const PAYEE = "0x8CC0D8f899b0eF553459Aac249b14A95F0470cE9";
  
  const MONTHLY_AMOUNT = "0.01"; // 0.01 USDT par mois (TEST)
  const TOTAL_MONTHS = 2;
  const DAY_OF_MONTH = 8;
  const FIRST_PAYMENT_DAYS_FROM_NOW = 1; // Dans 1 jour
  
  console.log("👤 Wallet:", signer.address);
  console.log("📍 Factory:", FACTORY);
  console.log("💰 USDT:", USDT);
  console.log("👥 Payee:", PAYEE);
  console.log();
  console.log("📋 Paramètres:");
  console.log("   - Montant mensuel:", MONTHLY_AMOUNT, "USDT");
  console.log("   - Durée:", TOTAL_MONTHS, "mois");
  console.log("   - Jour du mois:", DAY_OF_MONTH);
  console.log("   - Premier paiement: dans", FIRST_PAYMENT_DAYS_FROM_NOW, "jours");
  console.log();

  // ===== 1. VÉRIFIER BALANCE =====
  console.log("1️⃣ Vérification balance USDT...");
  console.log("   ─────────────────────────────────");
  
  const usdt = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function approve(address,uint256) returns (bool)"
    ],
    USDT
  );
  
  const balance = await usdt.balanceOf(signer.address);
  const decimals = await usdt.decimals();
  const balanceFormatted = hre.ethers.formatUnits(balance, decimals);
  
  console.log("   Balance actuelle:", balanceFormatted, "USDT");
  
  const monthlyAmountWei = hre.ethers.parseUnits(MONTHLY_AMOUNT, decimals);
  const totalNeeded = monthlyAmountWei * BigInt(TOTAL_MONTHS);
  const totalNeededFormatted = hre.ethers.formatUnits(totalNeeded, decimals);
  
  console.log("   Montant requis:", totalNeededFormatted, "USDT");
  
  if (balance < totalNeeded) {
    console.log("   ❌ BALANCE INSUFFISANTE !");
    console.log("   💡 Ajoute", hre.ethers.formatUnits(totalNeeded - balance, decimals), "USDT à ton wallet\n");
    return;
  }
  console.log("   ✅ Balance suffisante\n");

  // ===== 2. APPROUVER USDT =====
  console.log("2️⃣ Approbation USDT...");
  console.log("   ─────────────────────────────────");
  console.log("   Montant à approuver:", totalNeededFormatted, "USDT");
  console.log("   Spender:", FACTORY);
  console.log();
  console.log("   ⏳ Envoi transaction approve...");
  
  try {
    const approveTx = await usdt.approve(FACTORY, totalNeeded);
    console.log("   📤 TX Hash:", approveTx.hash);
    console.log("   ⏳ Attente confirmation...");
    
    const approveReceipt = await approveTx.wait();
    console.log("   ✅ Approuvé ! Block:", approveReceipt.blockNumber);
    console.log("   🔗 Basescan:", `https://basescan.org/tx/${approveTx.hash}\n`);
  } catch (err) {
    console.log("   ❌ ERREUR:", err.message, "\n");
    return;
  }

  // ===== 3. CRÉER LE PAIEMENT RÉCURRENT =====
  console.log("3️⃣ Création paiement récurrent...");
  console.log("   ─────────────────────────────────");
  
  const factory = await hre.ethers.getContractAt(
    [
      "function createRecurringPaymentERC20(address _payee, address _tokenAddress, uint256 _monthlyAmount, uint256 _totalMonths, uint256 _dayOfMonth, uint256 _firstPaymentTime) returns (address)"
    ],
    FACTORY
  );
  
  const firstPaymentTime = Math.floor(Date.now() / 1000) + (FIRST_PAYMENT_DAYS_FROM_NOW * 24 * 60 * 60);
  
  console.log("   Paramètres finaux:");
  console.log("   - Payee:", PAYEE);
  console.log("   - Token:", USDT);
  console.log("   - Monthly Amount:", hre.ethers.formatUnits(monthlyAmountWei, decimals), "USDT");
  console.log("   - Total Months:", TOTAL_MONTHS);
  console.log("   - Day of Month:", DAY_OF_MONTH);
  console.log("   - First Payment:", new Date(firstPaymentTime * 1000).toLocaleString());
  console.log();
  console.log("   ⏳ Envoi transaction create...");
  
  try {
    const createTx = await factory.createRecurringPaymentERC20(
      PAYEE,
      USDT,
      monthlyAmountWei,
      TOTAL_MONTHS,
      DAY_OF_MONTH,
      firstPaymentTime
    );
    
    console.log("   📤 TX Hash:", createTx.hash);
    console.log("   ⏳ Attente confirmation...");
    
    const receipt = await createTx.wait();
    console.log("   ✅ Créé ! Block:", receipt.blockNumber);
    console.log("   🔗 Basescan:", `https://basescan.org/tx/${createTx.hash}`);
    console.log();

    // ===== 4. EXTRAIRE L'ADRESSE DU CONTRAT =====
    console.log("4️⃣ Extraction adresse du contrat...");
    console.log("   ─────────────────────────────────");
    
    let contractAddress;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== FACTORY.toLowerCase()) {
        contractAddress = log.address;
        break;
      }
    }
    
    if (!contractAddress) {
      // Méthode 2 : décoder depuis les logs
      const factoryLog = receipt.logs.find(
        log => log.address.toLowerCase() === FACTORY.toLowerCase()
      );
      if (factoryLog && factoryLog.data && factoryLog.data.length >= 66) {
        contractAddress = `0x${factoryLog.data.slice(26, 66)}`;
      }
    }
    
    if (contractAddress) {
      console.log("   ✅ Contrat trouvé:", contractAddress);
      console.log("   🔗 Basescan:", `https://basescan.org/address/${contractAddress}`);
      console.log();

      // ===== RÉSUMÉ =====
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ PAIEMENT RÉCURRENT CRÉÉ AVEC SUCCÈS !");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log();
      console.log("📋 INFORMATIONS:");
      console.log("   Contract:", contractAddress);
      console.log("   Payer:", signer.address);
      console.log("   Payee:", PAYEE);
      console.log("   Token: USDT");
      console.log("   Montant:", MONTHLY_AMOUNT, "USDT/mois");
      console.log("   Durée:", TOTAL_MONTHS, "mois");
      console.log("   Jour:", DAY_OF_MONTH);
      console.log("   Premier:", new Date(firstPaymentTime * 1000).toLocaleString());
      console.log();
      console.log("🔗 LIENS:");
      console.log("   Contrat:", `https://basescan.org/address/${contractAddress}`);
      console.log("   TX Approve:", `https://basescan.org/tx/${approveTx?.hash}`);
      console.log("   TX Create:", `https://basescan.org/tx/${createTx.hash}`);
      console.log();
      console.log("⚠️  IMPORTANT: Enregistre dans Supabase !");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("\nExécute cette requête:");
      console.log("POST http://localhost:3001/api/payments/recurring");
      console.log();
      console.log(JSON.stringify({
        contract_address: contractAddress,
        payer_address: signer.address,
        payee_address: PAYEE,
        token_address: USDT,
        token_symbol: "USDT",
        monthly_amount: monthlyAmountWei.toString(),
        total_months: TOTAL_MONTHS,
        day_of_month: DAY_OF_MONTH,
        first_payment_time: firstPaymentTime,
        next_payment_time: firstPaymentTime,
        status: "active",
        network: "base_mainnet",
        transaction_hash: createTx.hash
      }, null, 2));
      console.log();
      
    } else {
      console.log("   ❌ Impossible d'extraire l'adresse");
      console.log("   💡 Vérifie manuellement sur Basescan\n");
    }
    
  } catch (err) {
    console.log("   ❌ ERREUR:", err.message);
    
    if (err.message.includes("insufficient")) {
      console.log("   💡 Cause: Balance ou allowance insuffisante");
    } else if (err.message.includes("Invalid")) {
      console.log("   💡 Cause: Paramètres invalides");
    }
    console.log();
  }
}

main().catch((error) => {
  console.error("\n❌ Erreur fatale:", error);
  process.exitCode = 1;
});
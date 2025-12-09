require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// CONFIGURATION
// ============================================================

const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Variables SUPABASE_URL et SUPABASE_KEY manquantes !");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ABI du contrat RecurringPaymentERC20
const RECURRING_ABI = [
  "function payer() view returns (address)",
  "function payee() view returns (address)",
  "function tokenAddress() view returns (address)",
  "function monthlyAmount() view returns (uint256)",
  "function totalMonths() view returns (uint256)",
  "function executedMonths() view returns (uint256)",
  "function cancelled() view returns (bool)",
  "function startDate() view returns (uint256)",
  "function getStatus() view returns (string memory status, uint256 monthsExecuted, uint256 monthsRemaining, uint256 amountPaid, uint256 monthsFailed)"
];

const MONTH_IN_SECONDS = 2592000; // 30 jours

// ============================================================
// SYNCHRONISATION
// ============================================================

async function syncRecurringPayment(payment) {
  try {
    console.log(`\n🔄 Sync: ${payment.id.substring(0, 8)} (${payment.contract_address})`);

    const contract = new ethers.Contract(
      payment.contract_address,
      RECURRING_ABI,
      provider
    );

    // Lire l'état du contrat (sans getStatus qui cause des overflow)
    const executedMonthsOnChain = await contract.executedMonths();
    const totalMonthsOnChain = await contract.totalMonths();
    const cancelledOnChain = await contract.cancelled();
    const startDateOnChain = await contract.startDate();

    console.log(`   📊 On-chain: ${Number(executedMonthsOnChain)}/${Number(totalMonthsOnChain)} mois, cancelled: ${cancelledOnChain}`);
    console.log(`   📋 Supabase: ${payment.status}, ${payment.executed_months}/${payment.total_months} mois`);

    // Calculer le prochain timestamp d'exécution
    const now = Math.floor(Date.now() / 1000);
    const monthsSinceStart = now >= Number(startDateOnChain)
      ? Math.floor((now - Number(startDateOnChain)) / MONTH_IN_SECONDS)
      : 0;

    let nextExecutionTime = null;
    let newStatus = payment.status;

    if (cancelledOnChain) {
      newStatus = 'cancelled';
    } else if (Number(executedMonthsOnChain) >= Number(totalMonthsOnChain)) {
      newStatus = 'completed';
      nextExecutionTime = 0;
    } else {
      newStatus = 'active';
      // Calculer le prochain mois
      const nextMonthIndex = Number(executedMonthsOnChain); // Le prochain mois à exécuter
      nextExecutionTime = Number(startDateOnChain) + (nextMonthIndex * MONTH_IN_SECONDS);
    }

    // Vérifier si une mise à jour est nécessaire
    const needsUpdate =
      payment.executed_months !== Number(executedMonthsOnChain) ||
      payment.status !== newStatus ||
      (nextExecutionTime !== null && payment.next_execution_time !== nextExecutionTime);

    if (!needsUpdate) {
      console.log(`   ✅ Déjà synchronisé`);
      return { updated: false };
    }

    // Préparer les données de mise à jour
    const updateData = {
      executed_months: Number(executedMonthsOnChain),
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (nextExecutionTime !== null && newStatus === 'active') {
      updateData.next_execution_time = nextExecutionTime;
    }

    console.log(`   📝 Mise à jour:`, updateData);

    // Mettre à jour Supabase
    const { error } = await supabase
      .from('recurring_payments')
      .update(updateData)
      .eq('id', payment.id);

    if (error) {
      console.error(`   ❌ Erreur update:`, error.message);
      return { updated: false, error: error.message };
    }

    console.log(`   ✅ Synchronisé !`);

    if (newStatus === 'active' && nextExecutionTime) {
      const nextDate = new Date(nextExecutionTime * 1000);
      console.log(`   📅 Prochain paiement: ${nextDate.toLocaleDateString('fr-FR')} à ${nextDate.toLocaleTimeString('fr-FR')}`);
    }

    return {
      updated: true,
      changes: updateData,
      onChainStatus: {
        status: newStatus,
        executedMonths: Number(executedMonthsOnChain),
        totalMonths: Number(totalMonthsOnChain),
        cancelled: cancelledOnChain
      }
    };

  } catch (error) {
    console.error(`   ❌ Erreur sync:`, error.message);
    return { updated: false, error: error.message };
  }
}

async function syncAllRecurringPayments() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔄 SYNCHRONISATION PAIEMENTS RÉCURRENTS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // Charger tous les paiements récurrents actifs ou pending
    const { data: payments, error } = await supabase
      .from('recurring_payments')
      .select('*')
      .in('status', ['pending', 'active', 'completed'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error("❌ Erreur chargement Supabase:", error.message);
      return;
    }

    if (!payments || payments.length === 0) {
      console.log("😴 Aucun paiement récurrent à synchroniser");
      return;
    }

    console.log(`📋 Trouvé: ${payments.length} paiement(s) récurrent(s)\n`);

    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    for (const payment of payments) {
      const result = await syncRecurringPayment(payment);

      if (result.updated) {
        updated++;
      } else if (result.error) {
        errors++;
      } else {
        unchanged++;
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 RÉSUMÉ");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Mis à jour: ${updated}`);
    console.log(`⏭️  Déjà sync: ${unchanged}`);
    console.log(`❌ Erreurs: ${errors}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    if (updated > 0) {
      console.log("🎉 Synchronisation terminée avec succès !");
    } else {
      console.log("✅ Tout était déjà synchronisé !");
    }

  } catch (error) {
    console.error("❌ Erreur globale:", error.message);
  }
}

// ============================================================
// LANCEMENT
// ============================================================

syncAllRecurringPayments().catch(console.error);

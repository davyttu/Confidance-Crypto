const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const MONTH_IN_SECONDS = process.env.NEXT_PUBLIC_CHAIN === 'base_sepolia' ? 300 : 2592000;

(async () => {
  console.log('🔍 Analyse des paiements récurrents pour Février 2026\n');
  console.log(`⏱️  MONTH_IN_SECONDS: ${MONTH_IN_SECONDS} (${MONTH_IN_SECONDS === 300 ? '5 minutes - TESTNET' : '30 jours - MAINNET'})\n`);

  // Récupérer tous les paiements récurrents actifs ou complétés
  const { data: payments, error } = await supabase
    .from('recurring_payments')
    .select('*')
    .in('status', ['active', 'completed', 'released'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  console.log(`📊 Total paiements récurrents: ${payments.length}\n`);

  let totalInstallmentsInFeb = 0;
  const febStart = new Date('2026-02-01T00:00:00Z').getTime() / 1000;
  const febEnd = new Date('2026-03-01T00:00:00Z').getTime() / 1000;

  console.log('📅 Période analysée:');
  console.log(`   Début: ${new Date(febStart * 1000).toLocaleString('fr-FR')}`);
  console.log(`   Fin:   ${new Date(febEnd * 1000).toLocaleString('fr-FR')}\n`);

  payments.forEach((payment, idx) => {
    const executed = Number(payment.executed_months ?? 0);
    const firstPaymentTime = Number(payment.first_payment_time ?? 0);
    
    let installmentsInFeb = 0;
    const installmentDetails = [];

    for (let k = 0; k < executed; k++) {
      const installmentTime = firstPaymentTime + k * MONTH_IN_SECONDS;
      
      if (installmentTime >= febStart && installmentTime < febEnd) {
        installmentsInFeb++;
        installmentDetails.push({
          index: k + 1,
          time: installmentTime,
          date: new Date(installmentTime * 1000).toLocaleString('fr-FR')
        });
      }
    }

    if (installmentsInFeb > 0) {
      totalInstallmentsInFeb += installmentsInFeb;
      
      console.log(`\n${idx + 1}. 💳 Paiement ID: ${payment.id.substring(0, 13)}...`);
      console.log(`   Statut: ${payment.status}`);
      console.log(`   Créé le: ${new Date(payment.created_at).toLocaleString('fr-FR')}`);
      console.log(`   Montant: ${payment.monthly_amount} ${payment.token_symbol}`);
      console.log(`   Échéances exécutées: ${executed}/${payment.total_months || 'illimité'}`);
      console.log(`   Première échéance: ${new Date(firstPaymentTime * 1000).toLocaleString('fr-FR')}`);
      console.log(`   ✅ ${installmentsInFeb} échéance(s) en Février:`);
      
      installmentDetails.forEach(inst => {
        console.log(`      - Échéance ${inst.index}: ${inst.date}`);
      });
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 TOTAL: ${totalInstallmentsInFeb} échéances en Février 2026`);
  console.log(`   (c'est le chiffre qui apparaît dans Analytics)\n`);
  
  if (totalInstallmentsInFeb !== 97) {
    console.log(`⚠️  ATTENTION: Le total calculé (${totalInstallmentsInFeb}) ne correspond pas à ce que vous voyez (97)`);
    console.log('   Cela peut être dû à:');
    console.log('   - Des paiements en statut différent (cancelled, failed)');
    console.log('   - Des différences de timezone');
    console.log('   - Des paiements supprimés depuis');
  }
})();

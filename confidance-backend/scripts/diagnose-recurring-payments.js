require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function diagnoseRecurringPayments() {
  console.log('🔍 DIAGNOSTIC DES PAIEMENTS RÉCURRENTS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Vérifier les paiements récurrents récents
  console.log('1️⃣ Vérification des derniers paiements récurrents créés...\n');

  const { data: payments, error: paymentsError } = await supabase
    .from('scheduled_payments')
    .select('*')
    .eq('payment_type', 'recurring')
    .order('created_at', { ascending: false })
    .limit(10);

  if (paymentsError) {
    console.error('❌ Erreur lecture scheduled_payments:', paymentsError.message);
    return;
  }

  if (!payments || payments.length === 0) {
    console.log('⚠️  Aucun paiement récurrent trouvé dans la base.\n');
    return;
  }

  console.log(`📋 ${payments.length} paiements récurrents trouvés:\n`);

  const now = new Date();

  payments.forEach((payment, i) => {
    const releaseTime = new Date(payment.release_time);
    const isPast = releaseTime < now;
    const diffMs = releaseTime - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    console.log(`${i + 1}. 📦 Paiement ID: ${payment.id}`);
    console.log(`   Contrat: ${payment.contract_address}`);
    console.log(`   De: ${payment.payer_address?.slice(0, 10)}...`);
    console.log(`   Vers: ${payment.payee_address?.slice(0, 10)}...`);
    console.log(`   Montant: ${payment.amount} ${payment.token_symbol}`);
    console.log(`   Statut: ${payment.status}`);
    console.log(`   Date d'échéance: ${releaseTime.toLocaleString('fr-FR')}`);

    if (isPast) {
      console.log(`   ⚠️  ÉCHÉANCE PASSÉE de ${Math.abs(diffHours)}h ${Math.abs(diffMins)}min`);
      if (payment.status === 'pending') {
        console.log(`   ❌ PROBLÈME: Statut toujours "pending" alors que l'échéance est passée !`);
      }
    } else {
      console.log(`   ⏰ Échéance dans ${diffHours}h ${diffMins}min`);
    }

    console.log(`   Créé: ${new Date(payment.created_at).toLocaleString('fr-FR')}`);
    console.log('');
  });

  // 2. Vérifier les paiements en attente dont l'échéance est passée
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('2️⃣ Paiements récurrents en retard (échéance passée + status pending)...\n');

  const overduePayments = payments.filter(p => {
    const releaseTime = new Date(p.release_time);
    return releaseTime < now && p.status === 'pending';
  });

  if (overduePayments.length === 0) {
    console.log('✅ Aucun paiement en retard détecté.\n');
  } else {
    console.log(`❌ ${overduePayments.length} paiement(s) en retard détecté(s):\n`);

    overduePayments.forEach((payment, i) => {
      const releaseTime = new Date(payment.release_time);
      const delayMs = now - releaseTime;
      const delayHours = Math.floor(delayMs / (1000 * 60 * 60));
      const delayMins = Math.floor((delayMs % (1000 * 60 * 60)) / (1000 * 60));

      console.log(`${i + 1}. 🚨 ID: ${payment.id}`);
      console.log(`   Contrat: ${payment.contract_address}`);
      console.log(`   Échéance prévue: ${releaseTime.toLocaleString('fr-FR')}`);
      console.log(`   Retard: ${delayHours}h ${delayMins}min`);
      console.log(`   Montant: ${payment.amount} ${payment.token_symbol}`);
      console.log('');
    });

    console.log('💡 Ces paiements auraient dû être exécutés par le keeper.\n');
  }

  // 3. Vérifier la structure des données
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('3️⃣ Vérification de la structure des données...\n');

  const firstPayment = payments[0];
  console.log('📋 Colonnes disponibles dans scheduled_payments:\n');
  Object.keys(firstPayment).forEach(col => {
    const value = firstPayment[col];
    const valueStr = value === null ? 'null' :
                     typeof value === 'object' ? JSON.stringify(value) :
                     String(value);
    console.log(`   ✓ ${col}: ${typeof value} = ${valueStr.slice(0, 50)}${valueStr.length > 50 ? '...' : ''}`);
  });

  // 4. Vérifier les colonnes critiques pour le keeper
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('4️⃣ Vérification des colonnes critiques pour le keeper...\n');

  const criticalColumns = [
    'contract_address',
    'release_time',
    'status',
    'token_address',
    'amount',
    'payee_address',
    'network'
  ];

  const missingColumns = criticalColumns.filter(col => !(col in firstPayment));
  const nullColumns = criticalColumns.filter(col => firstPayment[col] === null || firstPayment[col] === undefined);

  if (missingColumns.length > 0) {
    console.log('❌ Colonnes manquantes:');
    missingColumns.forEach(col => console.log(`   - ${col}`));
    console.log('');
  } else {
    console.log('✅ Toutes les colonnes critiques existent.\n');
  }

  if (nullColumns.length > 0) {
    console.log('⚠️  Colonnes avec valeurs null/undefined:');
    nullColumns.forEach(col => console.log(`   - ${col}`));
    console.log('');
  }

  // 5. Résumé et recommandations
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 RÉSUMÉ ET RECOMMANDATIONS\n');

  if (overduePayments.length > 0) {
    console.log('❌ PROBLÈME DÉTECTÉ:\n');
    console.log(`   ${overduePayments.length} paiement(s) récurrent(s) n'ont pas été exécutés.\n`);
    console.log('🔍 Causes possibles:\n');
    console.log('   1. Le keeper ne tourne pas');
    console.log('   2. Le keeper n\'a pas accès aux données');
    console.log('   3. Le contract_address est invalide');
    console.log('   4. Le keeper rencontre une erreur silencieuse\n');
    console.log('💡 Actions à faire:\n');
    console.log('   1. Vérifie que le keeper tourne : cherche "KEEPER" dans tes logs backend');
    console.log('   2. Vérifie les logs du keeper pour des erreurs');
    console.log('   3. Teste manuellement l\'exécution d\'un contrat\n');
  } else {
    console.log('✅ Aucun paiement en retard détecté.\n');
    console.log('💡 Si le problème persiste:\n');
    console.log('   - Crée un nouveau paiement récurrent avec échéance dans 2 minutes');
    console.log('   - Surveille les logs du keeper');
    console.log('   - Relance ce diagnostic après l\'échéance\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

diagnoseRecurringPayments();

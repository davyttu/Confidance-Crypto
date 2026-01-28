// Script de diagnostic pour comprendre le problème des paiements
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function diagnose() {
  console.log('🔍 DIAGNOSTIC DES PAIEMENTS\n');
  console.log('=' .repeat(60));

  try {
    // 1. Compter tous les paiements
    const { count: scheduledCount } = await supabase
      .from('scheduled_payments')
      .select('*', { count: 'exact', head: true });

    const { count: recurringCount } = await supabase
      .from('recurring_payments')
      .select('*', { count: 'exact', head: true });

    const { count: linksCount } = await supabase
      .from('payment_links')
      .select('*', { count: 'exact', head: true });

    console.log('\n📊 TOTAL DANS LA DB:');
    console.log(`   scheduled_payments: ${scheduledCount || 0}`);
    console.log(`   recurring_payments: ${recurringCount || 0}`);
    console.log(`   payment_links: ${linksCount || 0}`);

    // 2. Afficher quelques exemples d'adresses
    console.log('\n' + '='.repeat(60));
    console.log('📋 EXEMPLES D\'ADRESSES (scheduled_payments):');
    const { data: scheduledSamples } = await supabase
      .from('scheduled_payments')
      .select('id, payer_address, payee_address, status')
      .limit(3);

    if (scheduledSamples && scheduledSamples.length > 0) {
      scheduledSamples.forEach((p, i) => {
        console.log(`\n   [${i + 1}] ID: ${p.id}`);
        console.log(`       Payer:  "${p.payer_address}"`);
        console.log(`       Payee:  "${p.payee_address}"`);
        console.log(`       Status: ${p.status}`);
        console.log(`       Payer has uppercase? ${/[A-Z]/.test(p.payer_address)}`);
        console.log(`       Payee has uppercase? ${/[A-Z]/.test(p.payee_address)}`);
      });
    } else {
      console.log('   ❌ Aucun paiement trouvé');
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 EXEMPLES D\'ADRESSES (recurring_payments):');
    const { data: recurringSamples } = await supabase
      .from('recurring_payments')
      .select('id, payer_address, payee_address, contract_address, status')
      .limit(3);

    if (recurringSamples && recurringSamples.length > 0) {
      recurringSamples.forEach((p, i) => {
        console.log(`\n   [${i + 1}] ID: ${p.id}`);
        console.log(`       Payer:    "${p.payer_address}"`);
        console.log(`       Payee:    "${p.payee_address}"`);
        console.log(`       Contract: "${p.contract_address}"`);
        console.log(`       Status:   ${p.status}`);
        console.log(`       Payer has uppercase? ${/[A-Z]/.test(p.payer_address)}`);
        console.log(`       Payee has uppercase? ${/[A-Z]/.test(p.payee_address)}`);
      });
    } else {
      console.log('   ❌ Aucun paiement trouvé');
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 EXEMPLES D\'ADRESSES (payment_links):');
    const { data: linksSamples } = await supabase
      .from('payment_links')
      .select('id, creator_address, payer_address, status')
      .limit(3);

    if (linksSamples && linksSamples.length > 0) {
      linksSamples.forEach((p, i) => {
        console.log(`\n   [${i + 1}] ID: ${p.id}`);
        console.log(`       Creator: "${p.creator_address}"`);
        console.log(`       Payer:   "${p.payer_address || 'null'}"`);
        console.log(`       Status:  ${p.status}`);
        console.log(`       Creator has uppercase? ${/[A-Z]/.test(p.creator_address || '')}`);
      });
    } else {
      console.log('   ❌ Aucun payment_link trouvé');
    }

    // 3. Tester une requête avec une adresse exemple
    if (scheduledSamples && scheduledSamples.length > 0) {
      const testAddress = scheduledSamples[0].payer_address;
      console.log('\n' + '='.repeat(60));
      console.log('🧪 TEST DE REQUÊTE:');
      console.log(`   Adresse test: "${testAddress}"`);

      // Test avec .eq() et adresse exacte
      const { data: test1, error: err1 } = await supabase
        .from('scheduled_payments')
        .select('id')
        .eq('payer_address', testAddress);
      console.log(`\n   .eq(exact): ${test1?.length || 0} résultats ${err1 ? '❌ ' + err1.message : '✅'}`);

      // Test avec .ilike() et adresse exacte
      const { data: test2, error: err2 } = await supabase
        .from('scheduled_payments')
        .select('id')
        .ilike('payer_address', testAddress);
      console.log(`   .ilike(exact): ${test2?.length || 0} résultats ${err2 ? '❌ ' + err2.message : '✅'}`);

      // Test avec .ilike() et adresse en lowercase
      const { data: test3, error: err3 } = await supabase
        .from('scheduled_payments')
        .select('id')
        .ilike('payer_address', testAddress.toLowerCase());
      console.log(`   .ilike(lower): ${test3?.length || 0} résultats ${err3 ? '❌ ' + err3.message : '✅'}`);

      // Test avec .or() et .ilike()
      const { data: test4, error: err4 } = await supabase
        .from('scheduled_payments')
        .select('id')
        .or(`payer_address.ilike.${testAddress},payee_address.ilike.${testAddress}`);
      console.log(`   .or(ilike): ${test4?.length || 0} résultats ${err4 ? '❌ ' + err4.message : '✅'}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnostic terminé\n');

  } catch (err) {
    console.error('❌ Erreur:', err);
  }
}

diagnose();

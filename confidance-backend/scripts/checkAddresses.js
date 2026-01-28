// scripts/checkAddresses.js
// Script pour vérifier l'état des adresses dans la DB

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkAddresses() {
  console.log('🔍 Vérification des adresses dans la DB...\n');

  try {
    // Vérifier scheduled_payments
    const { data: scheduledPayments } = await supabase
      .from('scheduled_payments')
      .select('id, payer_address, payee_address')
      .limit(5);

    console.log('📋 scheduled_payments (5 premiers):');
    if (scheduledPayments && scheduledPayments.length > 0) {
      scheduledPayments.forEach(p => {
        console.log(`  - ID: ${p.id}`);
        console.log(`    payer: ${p.payer_address}`);
        console.log(`    payee: ${p.payee_address}`);
      });
    } else {
      console.log('  Aucun paiement trouvé');
    }

    // Vérifier recurring_payments
    const { data: recurringPayments } = await supabase
      .from('recurring_payments')
      .select('id, payer_address, payee_address, contract_address')
      .limit(5);

    console.log('\n📋 recurring_payments (5 premiers):');
    if (recurringPayments && recurringPayments.length > 0) {
      recurringPayments.forEach(p => {
        console.log(`  - ID: ${p.id}`);
        console.log(`    payer: ${p.payer_address}`);
        console.log(`    payee: ${p.payee_address}`);
        console.log(`    contract: ${p.contract_address}`);
      });
    } else {
      console.log('  Aucun paiement trouvé');
    }

    // Vérifier payment_links
    const { data: paymentLinks } = await supabase
      .from('payment_links')
      .select('id, creator_address, payer_address')
      .limit(5);

    console.log('\n📋 payment_links (5 premiers):');
    if (paymentLinks && paymentLinks.length > 0) {
      paymentLinks.forEach(p => {
        console.log(`  - ID: ${p.id}`);
        console.log(`    creator: ${p.creator_address}`);
        console.log(`    payer: ${p.payer_address || 'null'}`);
      });
    } else {
      console.log('  Aucun payment_link trouvé');
    }

  } catch (err) {
    console.error('❌ Erreur:', err);
  }
}

checkAddresses();

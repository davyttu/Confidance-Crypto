// Test de la syntaxe .ilike dans .or()
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testIlike() {
  const testAddress = '0x8Cc0D8f899B0ef553459aAc249b14a95f0470cE9'; // Checksum format
  console.log('🧪 Test avec adresse checksum:', testAddress);
  console.log('');

  try {
    // Test 1: .or() avec .ilike
    console.log('Test 1: .or() avec .ilike');
    const { data: test1, error: err1 } = await supabase
      .from('scheduled_payments')
      .select('id, payer_address, payee_address')
      .or(`payer_address.ilike.${testAddress},payee_address.ilike.${testAddress}`)
      .limit(5);

    console.log(`  Résultats: ${test1?.length || 0}`);
    if (err1) console.error('  Erreur:', err1.message);
    console.log('');

    // Test 2: .or() avec .eq et lowercase
    console.log('Test 2: .or() avec .eq et lowercase');
    const { data: test2, error: err2 } = await supabase
      .from('scheduled_payments')
      .select('id, payer_address, payee_address')
      .or(`payer_address.eq.${testAddress.toLowerCase()},payee_address.eq.${testAddress.toLowerCase()}`)
      .limit(5);

    console.log(`  Résultats: ${test2?.length || 0}`);
    if (err2) console.error('  Erreur:', err2.message);
    console.log('');

    // Test 3: Deux requêtes séparées avec .ilike
    console.log('Test 3: Requête avec .ilike direct');
    const { data: test3a, error: err3a } = await supabase
      .from('scheduled_payments')
      .select('id')
      .ilike('payer_address', testAddress)
      .limit(5);

    const { data: test3b, error: err3b } = await supabase
      .from('scheduled_payments')
      .select('id')
      .ilike('payee_address', testAddress)
      .limit(5);

    console.log(`  Résultats payer: ${test3a?.length || 0}`);
    console.log(`  Résultats payee: ${test3b?.length || 0}`);
    if (err3a) console.error('  Erreur payer:', err3a.message);
    if (err3b) console.error('  Erreur payee:', err3b.message);
    console.log('');

  } catch (err) {
    console.error('❌ Erreur:', err);
  }
}

testIlike();

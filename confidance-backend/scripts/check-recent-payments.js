require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkRecentPayments() {
  const { data, error } = await supabase
    .from('payment_links')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('📋 Derniers liens de paiement modifiés:\n');

  data.forEach((link, i) => {
    console.log(`${i + 1}. ID: ${link.id}`);
    console.log(`   Statut: ${link.status}`);
    console.log(`   Créateur: ${link.creator_address}`);
    console.log(`   Description: ${link.description || 'Sans nom'}`);
    console.log(`   Montant: ${link.amount} ${link.token_symbol}`);
    console.log(`   Créé: ${new Date(link.created_at).toLocaleString()}`);
    console.log(`   Mis à jour: ${new Date(link.updated_at).toLocaleString()}`);
    console.log('');
  });
}

checkRecentPayments();

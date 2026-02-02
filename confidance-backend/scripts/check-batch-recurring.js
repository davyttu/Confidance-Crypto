const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data, error } = await supabase
    .from('recurring_payments')
    .select('id, monthly_amount, batch_count, batch_beneficiaries, token_symbol, status, executed_months, total_months')
    .not('batch_count', 'is', null)
    .gt('batch_count', 1)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Erreur:', error);
    return;
  }
  
  console.log('📦 Paiements batch récurrents:\n');
  data.forEach((p, i) => {
    console.log(`${i+1}. ID: ${p.id.substring(0,13)}...`);
    console.log(`   Statut: ${p.status}`);
    console.log(`   monthly_amount: ${p.monthly_amount} ${p.token_symbol}`);
    console.log(`   batch_count: ${p.batch_count}`);
    console.log(`   executed_months: ${p.executed_months}/${p.total_months}`);
    console.log(`   batch_beneficiaries:`);
    if (p.batch_beneficiaries) {
      p.batch_beneficiaries.forEach((b, j) => {
        console.log(`      - ${b.address?.substring(0,10)}...: ${b.amount} ${p.token_symbol}`);
      });
    }
    console.log();
  });
  
  if (data.length === 0) {
    console.log('Aucun paiement batch récurrent trouvé.');
  }
})();

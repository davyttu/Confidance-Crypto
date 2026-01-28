const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data, error } = await supabase
    .from('recurring_payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Erreur:', error);
    return;
  }

  console.log('📋 Derniers paiements récurrents:\n');
  data.forEach((p, i) => {
    console.log(`${i+1}. ID: ${p.id.substring(0,13)}`);
    console.log(`   Statut: ${p.status}`);
    console.log(`   Payer: ${p.payer_address}`);
    console.log(`   Payee: ${p.payee_address}`);
    console.log(`   Monthly: ${p.monthly_amount} ${p.token_symbol}`);
    console.log(`   First Month: ${p.first_month_amount || 'same'}`);
    console.log(`   Custom First: ${p.is_first_month_custom}`);
    console.log(`   Executed: ${p.executed_months}/${p.total_months}`);
    console.log(`   Next exec: ${p.next_execution_time ? new Date(p.next_execution_time * 1000).toLocaleString('fr-FR') : 'N/A'}`);
    console.log(`   Créé: ${new Date(p.created_at).toLocaleString('fr-FR')}`);
    console.log();
  });
})();

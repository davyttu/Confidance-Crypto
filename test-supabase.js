require("dotenv").config();
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  console.log("\n🧪 Test connexion Supabase...\n");

  const { data, error } = await supabase
    .from('scheduled_payments')
    .select('count');

  if (error) {
    console.error("❌ Erreur:", error.message);
    return;
  }

  console.log("✅ Connexion Supabase OK !");
  
  const { count } = await supabase
    .from('scheduled_payments')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 ${count || 0} paiement(s) dans la base\n`);
}

test();
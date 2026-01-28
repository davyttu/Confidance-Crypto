require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkStructure() {
  console.log('🔍 Vérification de la structure de payment_links...\n');

  // Récupérer un lien exemple pour voir les colonnes
  const { data: links, error } = await supabase
    .from('payment_links')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }

  if (!links || links.length === 0) {
    console.log('⚠️  Aucun lien de paiement trouvé dans la base.');
    console.log('   Crée un lien de paiement d\'abord pour voir la structure.\n');
    return;
  }

  const link = links[0];

  console.log('📋 Colonnes disponibles dans payment_links:\n');
  Object.keys(link).forEach(col => {
    console.log(`   ✓ ${col}: ${typeof link[col]} = ${JSON.stringify(link[col])}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔎 Recherche de la colonne pour le créateur...\n');

  // Chercher les colonnes qui pourraient contenir l'adresse du créateur
  const possibleCreatorColumns = [
    'creator',
    'creator_address',
    'creator_wallet',
    'owner',
    'owner_address',
    'user_address',
    'beneficiary',
    'receiver',
    'receiver_address'
  ];

  const foundColumns = possibleCreatorColumns.filter(col => col in link);

  if (foundColumns.length > 0) {
    console.log('✅ Colonnes potentielles pour le créateur trouvées:');
    foundColumns.forEach(col => {
      console.log(`   → ${col}: ${link[col]}`);
    });
  } else {
    console.log('⚠️  Aucune colonne évidente trouvée pour le créateur.');
    console.log('   Les colonnes disponibles sont listées ci-dessus.');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

checkStructure();

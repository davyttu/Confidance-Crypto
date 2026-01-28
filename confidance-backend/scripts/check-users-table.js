require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkUsersTable() {
  console.log('🔍 Vérification de la table users...\n');

  // Récupérer quelques utilisateurs
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Erreur lecture users:', error.message);
    return;
  }

  if (!users || users.length === 0) {
    console.log('⚠️  Aucun utilisateur trouvé.\n');
    return;
  }

  console.log(`📋 ${users.length} utilisateurs trouvés:\n`);

  users.forEach((user, i) => {
    console.log(`${i + 1}. User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Primary wallet: ${user.primary_wallet || '❌ VIDE !'}`);
    console.log(`   Wallet address: ${user.wallet_address || 'N/A'}`);
    console.log(`   Primary wallet address: ${user.primary_wallet_address || 'N/A'}`);
    console.log(`   Créé: ${new Date(user.created_at).toLocaleString()}`);
    console.log('');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 Colonnes disponibles dans users:\n');
  Object.keys(users[0]).forEach(col => {
    console.log(`   ✓ ${col}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔍 Recherche des wallets des créateurs de liens...\n');

  const targetWallets = [
    '0x8cc0d8f899b0ef553459aac249b14a95f0470ce9',
    '0xea1bc6fe868111ba08edcc27b62619008dac1a13'
  ];

  for (const wallet of targetWallets) {
    console.log(`🔎 Recherche de ${wallet}...\n`);

    // Essayer différentes colonnes
    const searchColumns = ['primary_wallet', 'wallet_address', 'primary_wallet_address'];

    for (const col of searchColumns) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq(col, wallet)
        .maybeSingle();

      if (data) {
        console.log(`   ✅ Trouvé via colonne "${col}"`);
        console.log(`      User ID: ${data.id}`);
        console.log(`      Email: ${data.email}\n`);
        break;
      }
    }

    // Essayer en lowercase
    const walletLower = wallet.toLowerCase();
    for (const col of searchColumns) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq(col, walletLower)
        .maybeSingle();

      if (data) {
        console.log(`   ✅ Trouvé via colonne "${col}" (lowercase)`);
        console.log(`      User ID: ${data.id}`);
        console.log(`      Email: ${data.email}\n`);
        break;
      }
    }

    console.log(`   ❌ Wallet non trouvé dans users\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

checkUsersTable();

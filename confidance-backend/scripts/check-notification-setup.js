require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkSetup() {
  console.log('🔍 Vérification du système de notifications...\n');

  // 1. Vérifier si la table notifications existe
  console.log('1️⃣ Vérification de la table notifications...');
  const { data: notifTable, error: notifError } = await supabase
    .from('notifications')
    .select('*')
    .limit(1);

  if (notifError) {
    console.error('❌ La table notifications n\'existe pas ou n\'est pas accessible !');
    console.error('   Erreur:', notifError.message);
    console.log('\n📝 Action requise:');
    console.log('   1. Va sur https://supabase.com/dashboard');
    console.log('   2. Clique sur SQL Editor');
    console.log('   3. Exécute le contenu de create-notifications-table.sql');
    return;
  }
  console.log('✅ Table notifications existe\n');

  // 2. Vérifier les derniers payment_links créés
  console.log('2️⃣ Vérification des derniers liens de paiement...');
  const { data: links, error: linksError } = await supabase
    .from('payment_links')
    .select('id, creator_address, status, description, amount, token_symbol, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (linksError) {
    console.error('❌ Impossible de lire payment_links:', linksError.message);
  } else {
    console.log(`📋 ${links.length} liens trouvés:\n`);
    links.forEach((link, i) => {
      console.log(`   ${i + 1}. ID: ${link.id}`);
      console.log(`      Créateur: ${link.creator_address}`);
      console.log(`      Statut: ${link.status}`);
      console.log(`      Description: ${link.description || 'Sans nom'}`);
      console.log(`      Montant: ${link.amount} ${link.token_symbol}`);
      console.log(`      Créé: ${new Date(link.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  // 3. Vérifier si les créateurs sont dans la table user_wallets (multi-wallets)
  console.log('3️⃣ Vérification des créateurs dans la table user_wallets...');
  if (links && links.length > 0) {
    const uniqueCreators = [...new Set(links.map(l => l.creator_address.toLowerCase()))];

    for (const creator of uniqueCreators) {
      // Chercher dans user_wallets
      const { data: wallet, error: walletError } = await supabase
        .from('user_wallets')
        .select('user_id')
        .eq('wallet_address', creator)
        .maybeSingle();

      if (wallet) {
        // Récupérer les infos de l'utilisateur
        const { data: user } = await supabase
          .from('users')
          .select('id, email')
          .eq('id', wallet.user_id)
          .single();

        if (user) {
          console.log(`✅ ${creator}`);
          console.log(`   → User ID: ${user.id}, Email: ${user.email}\n`);
        }
      } else {
        // Fallback: chercher dans users.primary_wallet (legacy)
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, email, primary_wallet')
          .eq('primary_wallet', creator)
          .maybeSingle();

        if (user) {
          console.log(`✅ ${creator} (legacy)`);
          console.log(`   → User ID: ${user.id}, Email: ${user.email}`);
          console.log(`   → ⚠️ Wallet dans users.primary_wallet, pas dans user_wallets\n`);
        } else {
          console.log(`❌ ${creator}`);
          console.log(`   → PAS TROUVÉ (ni user_wallets ni users.primary_wallet)`);
          console.log(`   → Raison: Ce wallet n'est pas lié à un compte utilisateur\n`);
        }
      }
    }
  }

  // 4. Vérifier les notifications existantes
  console.log('4️⃣ Vérification des notifications existantes...');
  const { data: notifications, error: notifListError } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (notifListError) {
    console.error('❌ Erreur lecture notifications:', notifListError.message);
  } else {
    console.log(`📬 ${notifications.length} notifications trouvées:\n`);
    if (notifications.length === 0) {
      console.log('   Aucune notification dans la base.\n');
    } else {
      notifications.forEach((notif, i) => {
        console.log(`   ${i + 1}. [${notif.type.toUpperCase()}] ${notif.title}`);
        console.log(`      User ID: ${notif.user_id}`);
        console.log(`      Lu: ${notif.read ? 'Oui' : 'Non'}`);
        console.log(`      Créé: ${new Date(notif.created_at).toLocaleString()}`);
        console.log('');
      });
    }
  }

  // 5. Résumé et recommandations
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RÉSUMÉ\n');

  if (notifError) {
    console.log('❌ PROBLÈME: La table notifications n\'existe pas');
    console.log('   → Crée-la avec le fichier create-notifications-table.sql\n');
  } else {
    console.log('✅ Table notifications OK\n');
  }

  if (links && links.length > 0) {
    const creatorsNotInUsers = [];
    const uniqueCreators = [...new Set(links.map(l => l.creator_address.toLowerCase()))];

    for (const creator of uniqueCreators) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('primary_wallet', creator)
        .maybeSingle();

      if (!user) {
        creatorsNotInUsers.push(creator);
      }
    }

    if (creatorsNotInUsers.length > 0) {
      console.log(`⚠️  PROBLÈME: ${creatorsNotInUsers.length} créateur(s) de liens non trouvé(s) dans users`);
      console.log('   Ces adresses ne peuvent pas recevoir de notifications:');
      creatorsNotInUsers.forEach(addr => console.log(`   - ${addr}`));
      console.log('\n   💡 Solution: Ces utilisateurs doivent se connecter avec ce wallet');
      console.log('      pour lier leur wallet à leur compte.\n');
    } else {
      console.log('✅ Tous les créateurs de liens ont un compte utilisateur\n');
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

checkSetup();

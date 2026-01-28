require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { createNotification } = require('../services/notificationService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Script pour forcer la création d'une notification de test
 * en simulant la validation d'un lien de paiement
 */

async function forceTestNotification() {
  const linkId = process.argv[2];

  if (!linkId) {
    console.error('❌ Usage: node force-test-notification.js <payment_link_id>');
    console.error('   Example: node force-test-notification.js abc123xyz');
    process.exit(1);
  }

  console.log(`🔍 Recherche du lien ${linkId}...\n`);

  // 1. Récupérer le lien
  const { data: link, error: linkError } = await supabase
    .from('payment_links')
    .select('*')
    .eq('id', linkId)
    .single();

  if (linkError || !link) {
    console.error('❌ Lien de paiement non trouvé !');
    console.error('   Erreur:', linkError?.message);
    process.exit(1);
  }

  console.log('✅ Lien trouvé:');
  console.log(`   ID: ${link.id}`);
  console.log(`   Créateur: ${link.creator_address}`);
  console.log(`   Statut actuel: ${link.status}`);
  console.log(`   Description: ${link.description || 'Sans nom'}`);
  console.log(`   Montant: ${link.amount} ${link.token_symbol}\n`);

  // 2. Chercher l'utilisateur
  const creatorAddress = link.creator_address.toLowerCase();
  console.log(`🔍 Recherche de l'utilisateur avec l'adresse ${creatorAddress}...\n`);

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, primary_wallet')
    .eq('primary_wallet', creatorAddress)
    .maybeSingle();

  if (userError || !user) {
    console.error('❌ Utilisateur non trouvé !');
    console.error('   L\'adresse du créateur n\'est pas liée à un compte utilisateur.');
    console.error('   Adresses cherchées:', creatorAddress);

    // Essayer de voir les users existants
    console.log('\n🔍 Vérification des adresses dans la table users...');
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, email, primary_wallet')
      .limit(10);

    if (allUsers && allUsers.length > 0) {
      console.log('\n📋 Premiers utilisateurs de la base:');
      allUsers.forEach(u => {
        console.log(`   - User ${u.id} (${u.email}): ${u.primary_wallet || 'pas de wallet'}`);
      });
    }

    process.exit(1);
  }

  console.log('✅ Utilisateur trouvé:');
  console.log(`   User ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Wallet: ${user.primary_wallet}\n`);

  // 3. Créer la notification
  console.log('🔔 Création de la notification de test...\n');

  const payerAddress = '0x1234567890123456789012345678901234567890';
  const payerShort = `${payerAddress.slice(0, 6)}...${payerAddress.slice(-4)}`;
  const label = link.description || 'Paiement sans nom';
  const amount = link.amount;
  const token = link.token_symbol || 'ETH';

  const result = await createNotification(
    user.id,
    'payment',
    '💰 Lien de paiement validé !',
    `${payerShort} a payé votre lien "${label}" de ${amount} ${token}.`
  );

  if (result.success) {
    console.log('✅ Notification créée avec succès !');
    console.log(`   ID de la notification: ${result.data.id}`);
    console.log('\n🎉 Maintenant, connecte-toi avec le compte du créateur');
    console.log('   et clique sur le bouton de compte pour voir la notification !\n');
  } else {
    console.error('❌ Échec de la création de la notification');
    console.error('   Erreur:', result.error);
  }

  // 4. Mettre à jour le statut du lien à "paid" (optionnel)
  console.log('📝 Mise à jour du statut du lien à "paid"...');

  const { error: updateError } = await supabase
    .from('payment_links')
    .update({
      status: 'paid',
      payer_address: payerAddress,
      updated_at: new Date().toISOString()
    })
    .eq('id', linkId);

  if (updateError) {
    console.error('❌ Erreur mise à jour:', updateError.message);
  } else {
    console.log('✅ Statut du lien mis à jour à "paid"\n');
  }
}

forceTestNotification();

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function simulateInstantPayment() {
  console.log('🧪 Simulation d\'un paiement instantané complet\n');

  // 1. Créer un lien de paiement INSTANTANÉ
  const linkId = `test_${Date.now().toString(36)}`;
  const creatorAddress = '0x8cc0d8f899b0ef553459aac249b14a95f0470ce9';

  console.log('📝 Création d\'un lien de paiement instantané...');

  const { data: newLink, error: createError } = await supabase
    .from('payment_links')
    .insert({
      id: linkId,
      creator_address: creatorAddress,
      amount: '1',
      token_symbol: 'USDC',
      payment_type: 'instant',
      chain_id: 84532,
      description: 'Test notification instantané',
      status: 'pending'
    })
    .select()
    .single();

  if (createError) {
    console.error('❌ Erreur création:', createError);
    return;
  }

  console.log(`✅ Lien créé: ${linkId}\n`);

  // 2. Simuler le paiement en changeant le statut à "paid"
  console.log('💳 Simulation du paiement (statut → paid)...');

  const payerAddress = '0xea1bc6fe868111ba08edcc27b62619008dac1a13';

  const response = await fetch(`http://localhost:${process.env.PORT || 3001}/api/payment-links/${linkId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'paid',
      payer_address: payerAddress
    })
  });

  if (!response.ok) {
    console.error('❌ Erreur PATCH:', await response.text());
    return;
  }

  console.log('✅ Statut mis à jour → paid\n');

  // 3. Attendre 1 seconde et vérifier la notification
  console.log('⏳ Attente de la création de la notification...\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Récupérer l'user_id du créateur
  const { data: wallet } = await supabase
    .from('user_wallets')
    .select('user_id')
    .eq('wallet_address', creatorAddress.toLowerCase())
    .single();

  if (!wallet) {
    console.error('❌ Créateur non trouvé dans user_wallets');
    return;
  }

  // Vérifier la notification
  const { data: notifications, error: notifError } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', wallet.user_id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (notifError) {
    console.error('❌ Erreur lecture notifications:', notifError);
    return;
  }

  if (!notifications || notifications.length === 0) {
    console.error('❌ ÉCHEC: Aucune notification trouvée');
    return;
  }

  const notif = notifications[0];

  // Vérifier que c'est bien notre notification
  if (notif.message.includes('Test notification instantané')) {
    console.log('✅ ✅ ✅ SUCCÈS COMPLET! ✅ ✅ ✅\n');
    console.log('📬 Notification créée:');
    console.log(`   Titre: ${notif.title}`);
    console.log(`   Message: ${notif.message}`);
    console.log(`   Type: ${notif.type}`);
    console.log(`   Lu: ${notif.read ? 'Oui' : 'Non'}`);
    console.log(`   Créé: ${new Date(notif.created_at).toLocaleString()}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Le système de notifications fonctionne parfaitement!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Pour voir la notification dans le frontend:');
    console.log('   1. Rafraîchis la page');
    console.log('   2. Clique sur le bouton compte → Notifications');
    console.log('   3. Tu devrais voir toutes les notifications de test!\n');
  } else {
    console.log('✅ Notification créée, mais pour un autre paiement');
    console.log(`   Message: ${notif.message}\n`);
  }

  // 4. Nettoyer le lien de test
  await supabase
    .from('payment_links')
    .delete()
    .eq('id', linkId);

  console.log('🧹 Lien de test nettoyé');
}

simulateInstantPayment().catch(console.error);

const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { sendMonthlyStatement } = require('../services/monthlyStatementService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Cron job : Envoi des relevés mensuels
 * S'exécute le 1er de chaque mois à 9h00
 * Cron : '0 9 1 * *'
 */
function scheduleMonthlyStatements() {
  cron.schedule('0 9 1 * *', async () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 DÉMARRAGE ENVOI RELEVÉS MENSUELS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const startTime = Date.now();
    const now = new Date();

    const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    console.log(`📅 Période : ${getMonthName(lastMonth)} ${year}\n`);

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('email_verified', true);

      if (error) throw error;

      const userList = users || [];
      console.log(`👥 ${userList.length} utilisateur(s) éligible(s)\n`);

      const stats = {
        total: userList.length,
        sent: 0,
        noTransactions: 0,
        noWallets: 0,
        errors: 0,
      };

      for (let i = 0; i < userList.length; i++) {
        const user = userList[i];
        console.log(`[${i + 1}/${userList.length}] User ${user.email}...`);

        const result = await sendMonthlyStatement(user.id, lastMonth, year);

        if (result.success) {
          stats.sent++;
          console.log('  ✅ Envoyé avec succès\n');
        } else {
          switch (result.reason) {
            case 'no_transactions':
              stats.noTransactions++;
              console.log('  ⚠️  Aucune transaction ce mois\n');
              break;
            case 'no_wallets':
              stats.noWallets++;
              console.log('  ⚠️  Aucun wallet\n');
              break;
            case 'no_email':
              console.log('  ⚠️  Email non vérifié\n');
              break;
            default:
              stats.errors++;
              console.log(`  ❌ Erreur : ${result.error?.message || 'inconnue'}\n`);
          }
        }

        if (i < userList.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 RAPPORT FINAL');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ Envoyés avec succès : ${stats.sent}`);
      console.log(`⚠️  Sans transactions    : ${stats.noTransactions}`);
      console.log(`⚠️  Sans wallets         : ${stats.noWallets}`);
      console.log(`❌ Erreurs              : ${stats.errors}`);
      console.log(`⏱️  Durée totale         : ${duration}s`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error) {
      console.error('\n❌ ERREUR CRITIQUE CRON JOB:', error);
    }
  });

  console.log('⏰ Cron job relevés mensuels activé (1er de chaque mois, 9h00)');
}

function getMonthName(month) {
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];
  return months[month - 1] || month;
}

module.exports = { scheduleMonthlyStatements, sendMonthlyStatement };

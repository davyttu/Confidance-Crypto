/**
 * Envoie le relevé mensuel à un utilisateur par email.
 * Usage: node scripts/send-statement-by-email.js <email> <month> <year>
 * Exemple: node scripts/send-statement-by-email.js davy.vittu@hotmail.fr 1 2026
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { sendMonthlyStatement } = require('../services/monthlyStatementService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  const email = process.argv[2] || 'davy.vittu@hotmail.fr';
  const month = parseInt(process.argv[3] || '1', 10);
  const year = parseInt(process.argv[4] || String(new Date().getFullYear()), 10);

  console.log(`\n📧 Envoi relevé pour ${email} - ${month}/${year}\n`);

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, email_verified')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    console.error('❌ Erreur Supabase:', error.message);
    process.exit(1);
  }
  if (!user) {
    console.error('❌ Utilisateur non trouvé pour cet email.');
    process.exit(1);
  }
  if (!user.email_verified) {
    console.warn('⚠️  Email non vérifié pour cet utilisateur.');
  }

  const result = await sendMonthlyStatement(user.id, month, year);

  if (result.success) {
    console.log('✅ Relevé envoyé avec succès à', user.email);
  } else {
    console.log('❌ Échec:', result.reason, result.error?.message || '');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

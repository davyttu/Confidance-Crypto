require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔍 VÉRIFICATION DU KEEPER\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 1. Vérifier si le keeper est configuré dans index.js
console.log('1️⃣ Vérification du fichier index.js...\n');

const indexPath = path.join(__dirname, '..', 'index.js');

try {
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  // Chercher les références au keeper
  const hasKeeperImport = indexContent.includes('keeper') || indexContent.includes('Keeper');
  const hasCronImport = indexContent.includes('node-cron') || indexContent.includes('cron');
  const hasScheduledCheck = indexContent.includes('scheduled') || indexContent.includes('pending');

  if (hasCronImport) {
    console.log('✅ node-cron est importé');
  } else {
    console.log('❌ node-cron n\'est PAS importé');
  }

  if (hasKeeperImport || hasScheduledCheck) {
    console.log('✅ Code keeper trouvé dans index.js');
  } else {
    console.log('❌ Aucun code keeper trouvé dans index.js');
  }

  // Chercher les tâches cron
  const cronMatches = indexContent.match(/cron\.schedule\(['"](.*?)['"]/g);
  if (cronMatches && cronMatches.length > 0) {
    console.log(`\n📅 ${cronMatches.length} tâche(s) cron trouvée(s):`);
    cronMatches.forEach((match, i) => {
      console.log(`   ${i + 1}. ${match}`);
    });
  } else {
    console.log('\n⚠️  Aucune tâche cron.schedule trouvée');
  }

  console.log('\n');

} catch (error) {
  console.error('❌ Impossible de lire index.js:', error.message);
}

// 2. Instructions pour vérifier les logs
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('2️⃣ Vérification des logs du keeper...\n');

console.log('💡 Pour vérifier si le keeper tourne, regarde les logs de ton backend.\n');
console.log('   Cherche ces messages dans la console:\n');
console.log('   - "🔄 Keeper démarré" ou "Keeper running"');
console.log('   - "✅ Vérification des paiements programmés" (toutes les X minutes)');
console.log('   - "🔍 Recherche des paiements à exécuter"\n');

console.log('   Si tu ne vois AUCUN de ces messages:\n');
console.log('   ❌ Le keeper ne tourne PAS\n');

// 3. Vérifier les variables d'environnement
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('3️⃣ Vérification des variables d\'environnement...\n');

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'PRIVATE_KEY',
  'RPC_URL'
];

const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingEnvVars.length === 0) {
  console.log('✅ Toutes les variables d\'environnement requises sont présentes.\n');
} else {
  console.log('❌ Variables manquantes:');
  missingEnvVars.forEach(v => console.log(`   - ${v}`));
  console.log('\n⚠️  Le keeper ne peut pas fonctionner sans ces variables.\n');
}

// 4. Recommandations
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📊 RECOMMANDATIONS\n');

console.log('Pour diagnostiquer complètement, lance ces commandes:\n');
console.log('1. Script de diagnostic des paiements:');
console.log('   node scripts/diagnose-recurring-payments.js\n');

console.log('2. Regarde les logs de ton backend en temps réel:');
console.log('   - Windows: dans ton terminal backend, cherche "keeper"');
console.log('   - Linux/Mac: tail -f nohup.out | grep -i keeper\n');

console.log('3. Si le keeper ne tourne pas:');
console.log('   - Redémarre ton backend (Ctrl+C puis npm start)');
console.log('   - Vérifie qu\'il n\'y a pas d\'erreur au démarrage\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

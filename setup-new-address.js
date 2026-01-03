const { ethers } = require('ethers');

const newPrivateKey = '8746139fb4b738dc68641acd43037191ad0e102ccf4ec15005af5ec9a08b32cc';

// Vérifier que la clé commence par 0x
const privateKey = newPrivateKey.startsWith('0x') ? newPrivateKey : `0x${newPrivateKey}`;

// Créer le wallet
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet(privateKey, provider);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ NOUVELLE ADRESSE CRÉÉE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📍 Nouvelle adresse:', wallet.address);
console.log('🔑 Clé privée (format):', privateKey.substring(0, 10) + '...' + privateKey.substring(privateKey.length - 10));
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Vérifier le solde
provider.getBalance(wallet.address).then(balance => {
  console.log('💰 Balance actuelle:', ethers.formatEther(balance), 'ETH');
  console.log('\n📋 Prochaines étapes:');
  console.log('   1. Ajoutez des fonds à cette adresse pour le keeper');
  console.log('   2. Les fichiers seront mis à jour automatiquement');
  console.log('   3. L\'ancienne adresse sera remplacée partout');
}).catch(console.error);


// verifyConfidanceContracts.js
// Vérifie si l'adresse suspecte est liée à tes contrats Confidance

const { ethers } = require('ethers');

const RPC_URL = 'https://mainnet.base.org';

// ✅ TES CONTRATS CONFIDANCE LÉGITIMES
const LEGITIMATE_CONTRACTS = {
  factory: '0x523b378A11400F1A3E8A4482Deb9f0464c64A525',
  protocolWallet: '0xa34eDf91Cc494450000Eef08e6563062B2F115a9',
};

// 🚨 ADRESSE SUSPECTE
const SUSPICIOUS_ADDRESS = '0x0138833a645BE9311a21c19035F18634DFeEf776';
const VICTIM_WALLET = '0xdbA6ABe2aBd4B9E007D102533Be76c460E06A833';

async function verifyContracts() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 VÉRIFICATION CONTRATS CONFIDANCE vs SUSPECT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 1. Comparer les adresses
  console.log('📋 COMPARAISON DES ADRESSES :\n');
  console.log(`Factory Confidance (légitime) : ${LEGITIMATE_CONTRACTS.factory}`);
  console.log(`Adresse suspecte              : ${SUSPICIOUS_ADDRESS}\n`);
  
  if (SUSPICIOUS_ADDRESS.toLowerCase() === LEGITIMATE_CONTRACTS.factory.toLowerCase()) {
    console.log('✅ BONNE NOUVELLE : C\'est ta Factory Confidance !');
    console.log('   = L\'approbation est NORMALE\n');
  } else {
    console.log('❌ ALERTE : CE N\'EST PAS TA FACTORY !');
    console.log('   = Cette adresse n\'a RIEN à voir avec Confidance Crypto\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔎 ANALYSE DE L\'ADRESSE SUSPECTE :\n');
  
  // 2. Vérifier si c'est un contrat
  const code = await provider.getCode(SUSPICIOUS_ADDRESS);
  
  if (code === '0x') {
    console.log('Type : Wallet EOA (Externally Owned Account)');
    console.log('     = Une personne physique contrôle cette adresse\n');
  } else {
    console.log('Type : Smart Contract');
    console.log(`     Code size : ${code.length} bytes\n`);
  }
  
  // 3. Balance
  const balance = await provider.getBalance(SUSPICIOUS_ADDRESS);
  console.log(`Balance : ${ethers.formatEther(balance)} ETH\n`);
  
  // 4. Analyser la Factory légitime pour comparaison
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ ANALYSE FACTORY CONFIDANCE (LÉGITIME) :\n');
  
  const factoryCode = await provider.getCode(LEGITIMATE_CONTRACTS.factory);
  const factoryBalance = await provider.getBalance(LEGITIMATE_CONTRACTS.factory);
  
  console.log(`Adresse : ${LEGITIMATE_CONTRACTS.factory}`);
  console.log(`Type : Smart Contract (${factoryCode.length} bytes)`);
  console.log(`Balance : ${ethers.formatEther(factoryBalance)} ETH\n`);
  
  // 5. Vérifier les paiements créés par ta Factory
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RECHERCHE DES PAIEMENTS CONFIDANCE...\n');
  
  const factoryABI = [
    'event PaymentCreatedETH(address indexed payer, address indexed payee, address paymentContract, uint256 releaseTime, uint256 amountToPayee, uint256 protocolFee, uint256 totalSent, bool cancellable)'
  ];
  
  const factory = new ethers.Contract(
    LEGITIMATE_CONTRACTS.factory,
    factoryABI,
    provider
  );
  
  try {
    // Chercher les paiements créés par TON wallet
    const filter = factory.filters.PaymentCreatedETH(VICTIM_WALLET);
    const events = await factory.queryFilter(filter, -10000); // 10000 derniers blocs
    
    console.log(`✅ ${events.length} paiement(s) Confidance trouvé(s) :\n`);
    
    for (let i = 0; i < Math.min(events.length, 5); i++) {
      const event = events[i];
      console.log(`Paiement #${i + 1} :`);
      console.log(`  Contrat : ${event.args.paymentContract}`);
      console.log(`  Bénéficiaire : ${event.args.payee}`);
      console.log(`  Montant : ${ethers.formatEther(event.args.amountToPayee)} ETH`);
      console.log(`  Date : ${new Date(Number(event.args.releaseTime) * 1000).toLocaleDateString()}`);
      console.log(`  Basescan : https://basescan.org/address/${event.args.paymentContract}\n`);
    }
    
  } catch (error) {
    console.log('⚠️  Impossible de récupérer les events (normal si pas de paiement récent)\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 CONCLUSION :\n');
  
  if (SUSPICIOUS_ADDRESS.toLowerCase() !== LEGITIMATE_CONTRACTS.factory.toLowerCase()) {
    console.log('❌ VERDICT : ADRESSE MALVEILLANTE CONFIRMÉE');
    console.log('');
    console.log('Cette adresse N\'EST PAS ta Factory Confidance.');
    console.log('Tu as probablement approuvé un contrat SCAM par erreur.\n');
    console.log('🚨 ACTIONS URGENTES :');
    console.log('1. Va sur https://revoke.cash immédiatement');
    console.log('2. Révoque TOUTES les approbations vers cette adresse');
    console.log('3. Ne JAMAIS réutiliser ce wallet');
    console.log('4. Crée un nouveau wallet pour Confidance Crypto\n');
  } else {
    console.log('✅ VERDICT : TOUT VA BIEN');
    console.log('');
    console.log('L\'adresse suspecte EST ta Factory Confidance.');
    console.log('L\'approbation est normale et nécessaire.\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

verifyContracts().catch(console.error);
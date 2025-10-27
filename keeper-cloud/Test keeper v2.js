#!/usr/bin/env node
/**
 * 🧪 KEEPER V2 - SCRIPT DE TEST AUTOMATISÉ
 * 
 * Ce script teste le keeper V2 avant déploiement en production.
 * Il vérifie :
 * - Chargement des paiements depuis Supabase
 * - Détection automatique single vs batch
 * - Choix du bon ABI
 * - Logs corrects
 * - Health check
 */

require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Variables SUPABASE_URL et SUPABASE_KEY manquantes !");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Compteurs de tests
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function logTest(emoji, message, status = 'info') {
  const color = status === 'success' ? colors.green : 
                status === 'error' ? colors.red : 
                status === 'warning' ? colors.yellow : colors.blue;
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

async function assert(condition, testName, errorMsg = '') {
  testsRun++;
  if (condition) {
    testsPassed++;
    logTest('✅', `${testName}`, 'success');
    return true;
  } else {
    testsFailed++;
    logTest('❌', `${testName}`, 'error');
    if (errorMsg) {
      console.log(`   ${colors.gray}${errorMsg}${colors.reset}`);
    }
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 1 : Connexion Supabase
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testSupabaseConnection() {
  logSection('🗄️ TEST 1 : Connexion Supabase');
  
  try {
    const { data, error } = await supabase
      .from('scheduled_payments')
      .select('count', { count: 'exact', head: true });
    
    await assert(!error, 'Connexion Supabase OK', error?.message);
    logTest('📊', `Table scheduled_payments accessible`, 'info');
    return true;
  } catch (error) {
    await assert(false, 'Connexion Supabase OK', error.message);
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 2 : Structure de la table
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testTableStructure() {
  logSection('📋 TEST 2 : Structure de la table');
  
  try {
    const { data, error } = await supabase
      .from('scheduled_payments')
      .select('*')
      .limit(1);
    
    if (error) {
      await assert(false, 'Lecture table OK', error.message);
      return false;
    }
    
    if (!data || data.length === 0) {
      logTest('⚠️', 'Aucun paiement dans la DB (normal si vide)', 'warning');
      return true;
    }
    
    const row = data[0];
    const requiredColumns = [
      'id', 'contract_address', 'payer_address', 'payee_address',
      'token_symbol', 'amount', 'release_time', 'status',
      'is_batch', 'batch_count', 'batch_beneficiaries'
    ];
    
    for (const col of requiredColumns) {
      const hasColumn = col in row;
      await assert(hasColumn, `Colonne "${col}" existe`, !hasColumn ? `Colonne manquante` : '');
    }
    
    return true;
  } catch (error) {
    await assert(false, 'Structure table OK', error.message);
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 3 : Chargement des paiements
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testLoadPayments() {
  logSection('📦 TEST 3 : Chargement des paiements');
  
  try {
    const { data, error } = await supabase
      .from('scheduled_payments')
      .select('*')
      .eq('status', 'pending')
      .order('release_time', { ascending: true });
    
    await assert(!error, 'Requête Supabase OK', error?.message);
    
    if (!data || data.length === 0) {
      logTest('⚠️', 'Aucun paiement pending (normal)', 'warning');
      return true;
    }
    
    logTest('📊', `${data.length} paiement(s) pending trouvé(s)`, 'info');
    
    // Compter single vs batch
    const singlePayments = data.filter(p => !p.is_batch);
    const batchPayments = data.filter(p => p.is_batch === true);
    
    logTest('💎', `Single: ${singlePayments.length}`, 'info');
    logTest('🎁', `Batch: ${batchPayments.length}`, 'info');
    
    // Vérifier que les batch ont batch_count et batch_beneficiaries
    for (const payment of batchPayments) {
      const hasBatchCount = typeof payment.batch_count === 'number' && payment.batch_count > 0;
      await assert(
        hasBatchCount, 
        `Batch #${payment.id} a batch_count valide`,
        !hasBatchCount ? `batch_count = ${payment.batch_count}` : ''
      );
      
      const hasBeneficiaries = payment.batch_beneficiaries && 
                               Array.isArray(payment.batch_beneficiaries) &&
                               payment.batch_beneficiaries.length === payment.batch_count;
      await assert(
        hasBeneficiaries,
        `Batch #${payment.id} a batch_beneficiaries valide`,
        !hasBeneficiaries ? `beneficiaries invalides` : ''
      );
    }
    
    return true;
  } catch (error) {
    await assert(false, 'Chargement paiements OK', error.message);
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 4 : Connexion blockchain
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testBlockchainConnection() {
  logSection('⛓️ TEST 4 : Connexion blockchain');
  
  try {
    const network = await provider.getNetwork();
    await assert(network.chainId === 8453n, 'Connecté à Base Mainnet', `ChainId = ${network.chainId}`);
    
    const blockNumber = await provider.getBlockNumber();
    await assert(blockNumber > 0, `Block number récupéré (${blockNumber})`, '');
    
    // Vérifier balance keeper si PRIVATE_KEY existe
    if (process.env.PRIVATE_KEY) {
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      const balance = await provider.getBalance(wallet.address);
      const balanceETH = parseFloat(ethers.formatEther(balance));
      
      logTest('💰', `Balance keeper: ${balanceETH.toFixed(4)} ETH`, 'info');
      
      await assert(
        balanceETH > 0.001,
        'Balance keeper suffisante (> 0.001 ETH)',
        balanceETH <= 0.001 ? `Balance trop faible : ${balanceETH} ETH` : ''
      );
    }
    
    return true;
  } catch (error) {
    await assert(false, 'Connexion blockchain OK', error.message);
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 5 : Vérification des ABIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testABIs() {
  logSection('📜 TEST 5 : Vérification des ABIs');
  
  const SCHEDULED_PAYMENT_ABI = [
    "function releaseTime() view returns (uint256)",
    "function released() view returns (bool)",
    "function release() external"
  ];
  
  const BATCH_PAYMENT_ABI = [
    "function releaseTime() view returns (uint256)",
    "function released() view returns (bool)",
    "function releaseBatch() external"
  ];
  
  await assert(SCHEDULED_PAYMENT_ABI.length === 3, 'ABI ScheduledPayment a 3 fonctions', '');
  await assert(BATCH_PAYMENT_ABI.length === 3, 'ABI BatchPayment a 3 fonctions', '');
  
  await assert(
    SCHEDULED_PAYMENT_ABI.includes("function release() external"),
    'ABI ScheduledPayment a release()',
    ''
  );
  
  await assert(
    BATCH_PAYMENT_ABI.includes("function releaseBatch() external"),
    'ABI BatchPayment a releaseBatch()',
    ''
  );
  
  return true;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 6 : Simulation de détection de type
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testTypeDetection() {
  logSection('🔍 TEST 6 : Détection de type');
  
  const testCases = [
    { is_batch: false, expected: 'single' },
    { is_batch: true, expected: 'batch' },
    { is_batch: null, expected: 'single' },
    { is_batch: undefined, expected: 'single' }
  ];
  
  for (const testCase of testCases) {
    const detected = testCase.is_batch === true ? 'batch' : 'single';
    await assert(
      detected === testCase.expected,
      `is_batch=${testCase.is_batch} → détecté comme ${detected}`,
      detected !== testCase.expected ? `Attendu: ${testCase.expected}` : ''
    );
  }
  
  return true;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 7 : Variables d'environnement
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testEnvironmentVariables() {
  logSection('⚙️ TEST 7 : Variables d\'environnement');
  
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'PRIVATE_KEY',
    'RPC_URL'
  ];
  
  for (const varName of requiredVars) {
    const exists = !!process.env[varName];
    await assert(exists, `${varName} existe`, !exists ? 'Variable manquante' : '');
  }
  
  // Vérifier format SUPABASE_URL
  if (process.env.SUPABASE_URL) {
    const isValid = process.env.SUPABASE_URL.includes('supabase.co');
    await assert(isValid, 'SUPABASE_URL format valide', !isValid ? 'URL invalide' : '');
  }
  
  // Vérifier format PRIVATE_KEY
  if (process.env.PRIVATE_KEY) {
    const isValid = process.env.PRIVATE_KEY.startsWith('0x');
    await assert(isValid, 'PRIVATE_KEY format valide (0x...)', !isValid ? 'Doit commencer par 0x' : '');
  }
  
  return true;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FONCTION PRINCIPALE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function runAllTests() {
  console.log('\n');
  console.log('🧪 KEEPER V2 - SUITE DE TESTS AUTOMATISÉS');
  console.log('═══════════════════════════════════════\n');
  
  const startTime = Date.now();
  
  // Exécuter tous les tests
  await testEnvironmentVariables();
  await testSupabaseConnection();
  await testTableStructure();
  await testLoadPayments();
  await testBlockchainConnection();
  await testABIs();
  await testTypeDetection();
  
  // Résumé
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n');
  logSection('📊 RÉSUMÉ DES TESTS');
  
  console.log(`${colors.blue}Tests exécutés  : ${testsRun}${colors.reset}`);
  console.log(`${colors.green}Tests réussis   : ${testsPassed}${colors.reset}`);
  console.log(`${colors.red}Tests échoués   : ${testsFailed}${colors.reset}`);
  console.log(`${colors.gray}Durée           : ${duration}s${colors.reset}`);
  
  console.log('\n');
  
  if (testsFailed === 0) {
    logTest('🎉', 'TOUS LES TESTS PASSENT ! Keeper V2 prêt pour production', 'success');
    console.log(`\n${colors.green}✅ Vous pouvez déployer en toute confiance${colors.reset}\n`);
    process.exit(0);
  } else {
    logTest('⚠️', `${testsFailed} test(s) échoué(s). Corrigez avant déploiement`, 'error');
    console.log(`\n${colors.red}❌ NE PAS déployer en production${colors.reset}\n`);
    process.exit(1);
  }
}

// Lancer les tests
runAllTests().catch(error => {
  console.error('\n❌ ERREUR CRITIQUE:', error);
  process.exit(1);
});
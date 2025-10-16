const hre = require("hardhat");
const fs = require("fs");
const { createClient } = require('@supabase/supabase-js');
require("dotenv").config();

// 🆕 Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("⚠️  Variables Supabase manquantes - sauvegarde JSON uniquement");
}

const supabase = SUPABASE_URL && SUPABASE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT BASE MAINNET - PRODUCTION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 Compte :", deployer.address);
  console.log("🌐 Réseau :", network.name, `(chainId: ${network.chainId})`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Solde :", hre.ethers.formatEther(balance), "ETH");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (network.chainId !== 8453n) {
    throw new Error("❌ Pas sur Base Mainnet ! ChainId devrait être 8453");
  }

  // Configuration
  const payee = "0x8CC0D8f899b0eF553459Aac249b14A95F0470cE9";
  const now = Math.floor(Date.now() / 1000);
  const releaseTime = now + (3 * 60); // 3 minutes  
  const amount = hre.ethers.parseEther("0.0001");

  console.log("📋 Paramètres :");
  console.log("   👤 Bénéficiaire :", payee);
  console.log("   ⏰ Release time :", new Date(releaseTime * 1000).toLocaleString());
  console.log("   💵 Montant : 0.0001 ETH (TEST)");
  console.log("   ⏱️  Dans 8 minutes !\n");

  // 1. Déployer ScheduledPayment
  console.log("📦 Déploiement de ScheduledPayment...");
  const ScheduledPayment = await hre.ethers.getContractFactory("ScheduledPayment");
  const payment = await ScheduledPayment.deploy(payee, releaseTime, { value: amount });
  await payment.waitForDeployment();
  const paymentAddress = await payment.getAddress();
  console.log("✅ ScheduledPayment déployé à :", paymentAddress);

  // 2. Déployer Resolver
  console.log("\n📦 Déploiement de ScheduledPaymentResolver...");
  const Resolver = await hre.ethers.getContractFactory("ScheduledPaymentResolver");
  const resolver = await Resolver.deploy(paymentAddress);
  await resolver.waitForDeployment();
  const resolverAddress = await resolver.getAddress();
  console.log("✅ Resolver déployé à :", resolverAddress);

  // Résumé
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ DÉPLOIEMENT TERMINÉ");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 ScheduledPayment :", paymentAddress);
  console.log("📍 Resolver :", resolverAddress);
  console.log(`🔍 Basescan : https://basescan.org/address/${paymentAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Préparer les données
  const deploymentInfo = {
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    scheduledPayment: paymentAddress,
    resolver: resolverAddress,
    beneficiary: payee,
    releaseTime: releaseTime,
    releaseTimeReadable: new Date(releaseTime * 1000).toISOString(),
    amount: hre.ethers.formatEther(amount),
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
  };

  // 🆕 SAUVEGARDER DANS SUPABASE
  if (supabase) {
    try {
      console.log("💾 Sauvegarde dans Supabase...");
      
      const { data, error } = await supabase
        .from('scheduled_payments')
        .insert([{
          contract_address: paymentAddress,
          resolver_address: resolverAddress,
          beneficiary: payee,
          amount: hre.ethers.formatEther(amount),
          release_time: releaseTime,
          status: 'pending',
          deployed_by: deployer.address,
          network: 'base_mainnet',
          chain_id: 8453,
          metadata: {
            releaseTimeReadable: new Date(releaseTime * 1000).toISOString(),
            deployedAt: new Date().toISOString()
          }
        }])
        .select();
      
      if (error) {
        console.error("❌ Erreur Supabase:", error.message);
        console.log("⚠️  Continuons avec JSON uniquement...");
      } else {
        console.log("✅ Paiement enregistré dans Supabase !");
        console.log(`   ID: ${data[0].id}`);
      }
    } catch (error) {
      console.error("❌ Erreur sauvegarde DB:", error.message);
    }
  } else {
    console.log("⚠️  Supabase non configuré - sauvegarde JSON uniquement");
  }

  // Sauvegarder JSON (backup / transition)
  fs.writeFileSync("deployment-info-base.json", JSON.stringify(deploymentInfo, null, 2));
  fs.writeFileSync("keeper-cloud/deployment-info-base.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Backup JSON sauvegardé");
  
  console.log("\n⚠️  IMPORTANT : Vérifiez les contrats sur Basescan !");
  console.log("💡 Le keeper détectera automatiquement le nouveau paiement");
  console.log("⏰ Exécution prévue dans ~8 minutes\n");
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});
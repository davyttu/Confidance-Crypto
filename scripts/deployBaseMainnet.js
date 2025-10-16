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
  const releaseTime = now + (8 * 60); // 8 minutes  
  const amount = hre.ethers.parseEther("0.0001");
  
  // 🆕 NOUVEAU : Option cancellable
  const cancellable = false; // ⚠️ Change à true pour paiement annulable

  // Calcul des fees
  const FEE_PERCENTAGE = 179;
  const FEE_DENOMINATOR = 10000;
  const protocolFee = (amount * BigInt(FEE_PERCENTAGE)) / BigInt(FEE_DENOMINATOR);
  const amountToPayee = amount - protocolFee;

  console.log("📋 Paramètres :");
  console.log("   👤 Bénéficiaire :", payee);
  console.log("   ⏰ Release time :", new Date(releaseTime * 1000).toLocaleString());
  console.log("   💵 Montant : 0.0001 ETH");
  console.log("");
  console.log("💰 Répartition avec fees (1.79%) :");
  console.log(`   → Bénéficiaire (98.21%) : ${hre.ethers.formatEther(amountToPayee)} ETH`);
  console.log(`   → Protocole (1.79%) : ${hre.ethers.formatEther(protocolFee)} ETH`);
  console.log(`   → Wallet protocole : 0xa34eDf91Cc494450000Eef08e6563062B2F115a9`);
  console.log("");
  console.log(`🔒 Type : ${cancellable ? '✅ ANNULABLE' : '🔒 DÉFINITIF'}`);
  if (cancellable) {
    console.log("   ℹ️  Peut être annulé avant échéance (remboursement intégral)");
  } else {
    console.log("   ⚠️  NON ANNULABLE après création");
  }
  console.log("   ⏱️  Dans 8 minutes !\n");

  // 1. Déployer ScheduledPayment avec le nouveau paramètre
  console.log("📦 Déploiement de ScheduledPayment...");
  const ScheduledPayment = await hre.ethers.getContractFactory("ScheduledPayment");
  const payment = await ScheduledPayment.deploy(
    payee, 
    releaseTime,
    cancellable,  // 🆕 Nouveau paramètre
    { value: amount }
  );
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
    cancellable: cancellable,  // 🆕
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
          cancellable: cancellable,  // 🆕
          metadata: {
            releaseTimeReadable: new Date(releaseTime * 1000).toISOString(),
            deployedAt: new Date().toISOString(),
            protocolFee: hre.ethers.formatEther(protocolFee),
            amountToPayee: hre.ethers.formatEther(amountToPayee)
          }
        }])
        .select();
      
      if (error) {
        console.error("❌ Erreur Supabase:", error.message);
        console.log("⚠️  Continuons avec JSON uniquement...");
      } else {
        console.log("✅ Paiement enregistré dans Supabase !");
        console.log(`   ID: ${data[0].id}`);
        if (cancellable) {
          console.log(`   ⚠️  Ce paiement peut être annulé avant ${new Date(releaseTime * 1000).toLocaleTimeString()}`);
        } else {
          console.log(`   🔒 Paiement DÉFINITIF - Non annulable`);
        }
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
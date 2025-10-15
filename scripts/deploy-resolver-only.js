const hre = require("hardhat");
const { createClient } = require('@supabase/supabase-js');
require("dotenv").config();

// Adresse du ScheduledPayment déjà déployé
const PAYMENT_ADDRESS = "0xc146964875E1121acE90d9CcEfe4626DBD47469d";

// Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔧 DÉPLOIEMENT RESOLVER UNIQUEMENT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 Compte :", deployer.address);
  console.log("📍 ScheduledPayment (existant) :", PAYMENT_ADDRESS);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Récupérer les infos du ScheduledPayment
  console.log("🔍 Récupération des infos du contrat...");
  const ScheduledPayment = await hre.ethers.getContractFactory("ScheduledPayment");
  const payment = ScheduledPayment.attach(PAYMENT_ADDRESS);

  const payee = await payment.payee();
  const releaseTime = await payment.releaseTime();
  const amount = await payment.amount();

  console.log("✅ Infos récupérées :");
  console.log("   Bénéficiaire :", payee);
  console.log("   Montant :", hre.ethers.formatEther(amount), "ETH");
  console.log("   Release :", new Date(Number(releaseTime) * 1000).toLocaleString());
  console.log("");

  // Déployer le Resolver avec gas élevé
  console.log("📦 Déploiement du Resolver avec gas augmenté...");
  const Resolver = await hre.ethers.getContractFactory("ScheduledPaymentResolver");
  
  try {
    const resolver = await Resolver.deploy(PAYMENT_ADDRESS, {
      maxFeePerGas: hre.ethers.parseUnits("0.5", "gwei"),
      maxPriorityFeePerGas: hre.ethers.parseUnits("0.5", "gwei")
    });
    
    await resolver.waitForDeployment();
    const resolverAddress = await resolver.getAddress();
    
    console.log("✅ Resolver déployé à :", resolverAddress);
    console.log("");

    // Sauvegarder dans Supabase
    if (supabase) {
      console.log("💾 Sauvegarde dans Supabase...");
      
      const { data, error } = await supabase
        .from('scheduled_payments')
        .insert([{
          contract_address: PAYMENT_ADDRESS,
          resolver_address: resolverAddress,
          beneficiary: payee,
          amount: hre.ethers.formatEther(amount),
          release_time: Number(releaseTime),
          status: 'pending',
          deployed_by: deployer.address,
          network: 'base_mainnet',
          chain_id: 8453,
          metadata: {
            releaseTimeReadable: new Date(Number(releaseTime) * 1000).toISOString(),
            deployedAt: new Date().toISOString(),
            note: "Deployed in 2 steps (payment then resolver)"
          }
        }])
        .select();
      
      if (error) {
        console.error("❌ Erreur Supabase:", error.message);
        console.log("\n⚠️  AJOUTE MANUELLEMENT DANS SUPABASE :");
        console.log(`   contract_address: ${PAYMENT_ADDRESS}`);
        console.log(`   resolver_address: ${resolverAddress}`);
        console.log(`   beneficiary: ${payee}`);
        console.log(`   amount: ${hre.ethers.formatEther(amount)}`);
        console.log(`   release_time: ${releaseTime}`);
      } else {
        console.log("✅ Paiement enregistré dans Supabase !");
        console.log(`   ID: ${data[0].id}`);
      }
    } else {
      console.log("\n⚠️  Supabase non configuré");
      console.log("AJOUTE MANUELLEMENT DANS SUPABASE :");
      console.log(`   contract_address: ${PAYMENT_ADDRESS}`);
      console.log(`   resolver_address: ${resolverAddress}`);
      console.log(`   beneficiary: ${payee}`);
      console.log(`   amount: ${hre.ethers.formatEther(amount)}`);
      console.log(`   release_time: ${releaseTime}`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ DÉPLOIEMENT TERMINÉ !");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📍 ScheduledPayment :", PAYMENT_ADDRESS);
    console.log("📍 Resolver :", resolverAddress);
    console.log(`🔍 Basescan : https://basescan.org/address/${PAYMENT_ADDRESS}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("💡 Le keeper va détecter ce paiement automatiquement !");
    console.log("⏰ Exécution prévue dans ~8 minutes\n");

  } catch (error) {
    console.error("\n❌ Erreur déploiement Resolver:", error.message);
    
    if (error.message.includes("underpriced")) {
      console.log("\n💡 Le gas est toujours trop bas. Essaie :");
      console.log("   1. Attends 5 minutes");
      console.log("   2. Relance ce script");
      console.log("   3. Ou augmente encore le gas dans le script\n");
    }
    
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});
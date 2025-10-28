const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 DÉPLOIEMENT BASE MAINNET V2 - PRODUCTION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 Compte :", deployer.address);
  console.log("🌐 Réseau :", network.name, `(chainId: ${network.chainId})`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Solde :", hre.ethers.formatEther(balance), "ETH");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (network.chainId !== 8453n) {
    throw new Error("❌ Pas sur Base Mainnet ! ChainId devrait être 8453");
  }

  // ============================================================
  // ÉTAPE 1 : DÉPLOYER LA FACTORY V2
  // ============================================================
  
  console.log("📦 1/2 - Déploiement PaymentFactory V2...");
  const PaymentFactory = await hre.ethers.getContractFactory("PaymentFactory");
  const factory = await PaymentFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ Factory déployée à :", factoryAddress);
  console.log(`🔍 Basescan : https://basescan.org/address/${factoryAddress}`);

  // ============================================================
  // ÉTAPE 2 : CRÉER UN PAIEMENT TEST
  // ============================================================
  
  console.log("\n📦 2/2 - Création d'un paiement test...");
  
  const payee = "0x8CC0D8f899b0eF553459Aac249b14A95F0470cE9";
  const amountToPayee = hre.ethers.parseEther("0.00006"); // Bénéficiaire recevra EXACTEMENT 0.00006 ETH
  const now = Math.floor(Date.now() / 1000);
  const releaseTime = now + (8 * 60); // 8 minutes
  const cancellable = false;
  
  console.log("\n📋 Paramètres :");
  console.log("   👤 Bénéficiaire :", payee);
  console.log("   💰 Montant (bénéficiaire) : 0.00006 ETH");
  
  // Calculer le total avec fees
  const [protocolFee, totalRequired] = await factory.calculateSingleTotal(amountToPayee);
  console.log("   💸 Fees protocole (1.79%) :", hre.ethers.formatEther(protocolFee), "ETH");
  console.log("   📊 TOTAL à envoyer :", hre.ethers.formatEther(totalRequired), "ETH");
  console.log("   ⏰ Release time :", new Date(releaseTime * 1000).toLocaleString());
  console.log("   🔒 Annulable :", cancellable ? "Oui" : "Non");
  
  console.log("\n🚀 Création du paiement...");
  const tx = await factory.createPaymentETH(
    payee,
    amountToPayee,
    releaseTime,
    cancellable,
    { value: totalRequired }
  );
  
  console.log("📤 Transaction envoyée :", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmée ! Block :", receipt.blockNumber);
  
  // Extraire l'adresse du contrat créé
  let paymentAddress;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== factoryAddress.toLowerCase()) {
      paymentAddress = log.address;
      break;
    }
  }
  
  console.log("📍 Payment créé à :", paymentAddress);
  console.log(`🔍 Basescan : https://basescan.org/address/${paymentAddress}`);
  
  // Vérifier les détails
  const ScheduledPayment = await hre.ethers.getContractFactory("ScheduledPayment");
  const payment = ScheduledPayment.attach(paymentAddress);
  const [_amountToPayee, _protocolFee, _totalLocked] = await payment.getAmounts();
  
  console.log("\n🔍 Vérification :");
  console.log("   Bénéficiaire recevra :", hre.ethers.formatEther(_amountToPayee), "ETH ✅");
  console.log("   Protocole recevra :", hre.ethers.formatEther(_protocolFee), "ETH");
  console.log("   Total verrouillé :", hre.ethers.formatEther(_totalLocked), "ETH");

  // Déployer le Resolver
  console.log("\n📦 Déploiement du Resolver...");
  const Resolver = await hre.ethers.getContractFactory("ScheduledPaymentResolver");
  const resolver = await Resolver.deploy(paymentAddress);
  await resolver.waitForDeployment();
  const resolverAddress = await resolver.getAddress();
  console.log("✅ Resolver déployé à :", resolverAddress);

  // ============================================================
  // RÉSUMÉ FINAL
  // ============================================================
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ DÉPLOIEMENT V2 TERMINÉ");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Factory V2 :", factoryAddress);
  console.log("📍 Payment Test :", paymentAddress);
  console.log("📍 Resolver :", resolverAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔗 LIENS BASESCAN :");
  console.log(`   Factory : https://basescan.org/address/${factoryAddress}`);
  console.log(`   Payment : https://basescan.org/address/${paymentAddress}`);
  console.log(`   Tx : https://basescan.org/tx/${tx.hash}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Sauvegarder
  const deploymentInfo = {
    version: "V2",
    network: "base_mainnet",
    chainId: network.chainId.toString(),
    factory: factoryAddress,
    paymentTest: paymentAddress,
    resolver: resolverAddress,
    beneficiary: payee,
    amountToPayee: hre.ethers.formatEther(amountToPayee),
    protocolFee: hre.ethers.formatEther(protocolFee),
    totalSent: hre.ethers.formatEther(totalRequired),
    releaseTime: releaseTime,
    releaseTimeReadable: new Date(releaseTime * 1000).toISOString(),
    cancellable: cancellable,
    transactionHash: tx.hash,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
  };

  // Sauvegarder à la racine ET dans keeper-cloud
  fs.writeFileSync("deployment-info-base-v2.json", JSON.stringify(deploymentInfo, null, 2));
  fs.writeFileSync("keeper-cloud/deployment-info-base-v2.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Infos sauvegardées dans deployment-info-base-v2.json");
  
  console.log("\n⚠️  IMPORTANT :");
  console.log("   1. Vérifiez les contrats sur Basescan");
  console.log("   2. Notez l'adresse de la Factory pour le frontend");
  console.log("   3. Le keeper exécutera le paiement dans 8 minutes");
  console.log("\n💡 Adresse Factory à utiliser dans le frontend :");
  console.log(`   ${factoryAddress}\n`);
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});

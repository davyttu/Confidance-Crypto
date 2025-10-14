require("dotenv").config();
const fs = require("fs");

async function main() {
  const ethers5 = require("@gelatonetwork/automate-sdk/node_modules/ethers");
  const { AutomateSDK } = require("@gelatonetwork/automate-sdk");

  if (!fs.existsSync("deployment-info-base.json")) {
    throw new Error("❌ Fichier deployment-info-base.json introuvable !");
  }

  const deploymentInfo = JSON.parse(fs.readFileSync("deployment-info-base.json", "utf8"));
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🤖 CRÉATION TÂCHE GELATO - BASE MAINNET");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const RPC = process.env.BASE_RPC || "https://mainnet.base.org";
  const provider = new ethers5.providers.JsonRpcProvider(RPC);
  const signer = new ethers5.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("👤 Compte :", signer.address);
  const balance = await signer.getBalance();
  console.log("💰 Solde :", ethers5.utils.formatEther(balance), "ETH");

  const network = await provider.getNetwork();
  console.log("🌐 Réseau :", network.name, `(chainId: ${network.chainId})`);
  
  if (network.chainId !== 8453) {
    throw new Error("❌ Pas sur Base Mainnet ! ChainId devrait être 8453");
  }

  const scheduledPaymentAddress = deploymentInfo.scheduledPayment;
  const resolverAddress = deploymentInfo.resolver;

  console.log("📍 ScheduledPayment :", scheduledPaymentAddress);
  console.log("📍 Resolver :", resolverAddress);
  console.log(`⏰ Exécution prévue : ${deploymentInfo.releaseTimeReadable}\n`);

  console.log("🔧 Initialisation Gelato SDK...");
  const automate = await AutomateSDK.create(network.chainId, signer);

  console.log("🚀 Création de la tâche...\n");

  const releaseSelector = "0x86d1a69f";

  try {
    const { taskId, tx } = await automate.createTask({
      name: `Base Test - ${new Date().toLocaleTimeString()}`,
      execAddress: scheduledPaymentAddress,
      execSelector: releaseSelector,
      dedicatedMsgSender: true,
      resolverAddress,
      resolverData: "0x",
      useTreasury: true,
    });

    console.log("⏳ Attente confirmation...");
    const receipt = await tx.wait();

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎯 TÂCHE CRÉÉE !");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🆔 Task ID :", taskId);
    console.log("🔗 Tx :", tx.hash);
    console.log(`🌐 Dashboard : https://app.gelato.network/task/${taskId}?chainId=${network.chainId}`);
    console.log(`🔍 Contract : https://basescan.org/address/${scheduledPaymentAddress}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("\n⏰ CHRONOMÉTRAGE :");
    const now = Math.floor(Date.now() / 1000);
    const timeUntilRelease = deploymentInfo.releaseTime - now;
    const minutes = Math.floor(timeUntilRelease / 60);
    console.log(`   ⏱️  Il reste ${minutes} minutes !`);
    console.log(`   🎯 Release : ${new Date(deploymentInfo.releaseTime * 1000).toLocaleString()}`);
    
    console.log("\n💡 SURVEILLEZ :");
    console.log("   1. Dashboard Gelato (lien ci-dessus)");
    console.log("   2. Basescan pour la transaction");
    console.log("   3. Dans ~15 min, 0.0001 ETH libérés !\n");
    console.log("⚠️  N'oubliez pas d'alimenter votre Gas Tank :");
    console.log("   https://app.gelato.network/funds\n");

    deploymentInfo.gelatoTaskId = taskId;
    deploymentInfo.gelatoTxHash = tx.hash;
    fs.writeFileSync("deployment-info-base.json", JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Sauvegardé !\n");

  } catch (error) {
    console.error("\n❌ Erreur :", error.message);
    throw error;
  }
}

main()
  .then(() => {
    console.log("✨ Succès ! En attente d'exécution... 🚀\n");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Erreur fatale :", err.message);
    process.exit(1);
  });
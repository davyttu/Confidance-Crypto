require("dotenv").config();
const fs = require("fs");

async function main() {
  const ethers5 = require("@gelatonetwork/automate-sdk/node_modules/ethers");
  const { AutomateSDK } = require("@gelatonetwork/automate-sdk");

  if (!fs.existsSync("deployment-info-test.json")) {
    throw new Error("❌ Fichier deployment-info-test.json introuvable ! Déployez d'abord.");
  }

  const deploymentInfo = JSON.parse(fs.readFileSync("deployment-info-test.json", "utf8"));
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🤖 CRÉATION TÂCHE GELATO - TEST 30 MIN");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const RPC = process.env.SEPOLIA_RPC || "https://rpc.ankr.com/eth_sepolia";
  const provider = new ethers5.providers.JsonRpcProvider(RPC);
  const signer = new ethers5.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("👤 Compte :", signer.address);
  const balance = await signer.getBalance();
  console.log("💰 Solde :", ethers5.utils.formatEther(balance), "ETH");

  const network = await provider.getNetwork();
  console.log("🌐 Réseau :", network.name, `(chainId: ${network.chainId})`);

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
      name: `Test Payment - ${new Date().toLocaleTimeString()}`,
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
    console.log(`🔍 Contract : https://sepolia.etherscan.io/address/${scheduledPaymentAddress}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("\n⏰ CHRONOMÉTRAGE :");
    const now = Math.floor(Date.now() / 1000);
    const timeUntilRelease = deploymentInfo.releaseTime - now;
    const minutes = Math.floor(timeUntilRelease / 60);
    console.log(`   ⏱️  Il reste ${minutes} minutes avant l'exécution !`);
    console.log(`   🎯 Release time : ${new Date(deploymentInfo.releaseTime * 1000).toLocaleString()}`);
    
    console.log("\n💡 SURVEILLEZ :");
    console.log("   1. Le dashboard Gelato (lien ci-dessus)");
    console.log("   2. Le contrat sur Etherscan");
    console.log("   3. Dans ~30 min, les 0.001 ETH seront libérés !\n");

    deploymentInfo.gelatoTaskId = taskId;
    deploymentInfo.gelatoTxHash = tx.hash;
    fs.writeFileSync("deployment-info-test.json", JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Tout est sauvegardé !\n");

  } catch (error) {
    console.error("\n❌ Erreur :", error.message);
    throw error;
  }
}

main()
  .then(() => {
    console.log("✨ Succès ! Rendez-vous dans 30 minutes ! 🚀\n");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Erreur fatale :", err.message);
    process.exit(1);
  });
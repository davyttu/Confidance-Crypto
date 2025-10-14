require("dotenv").config();
const { ethers } = require("ethers");

// 🔧 CONFIG
const RESOLVER_ADDRESS = "0xb29b8cE9404bA6995dAf3936a86E6a5853cbb1d3"; // <-- ton resolver
const RPC_URL = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia.blockpi.network/v1/rpc/public";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// ✅ ABI minimales
const resolverAbi = [
  "function checker() external view returns (bool canExec, bytes memory execPayload)"
];
const scheduledPaymentAbi = [
  "function release() external"
];

async function main() {
  console.log("🚀 Lancement du keeper auto-release...");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const resolver = new ethers.Contract(RESOLVER_ADDRESS, resolverAbi, provider);

  // 🔁 Boucle de surveillance
  async function checkAndRelease() {
    try {
      const [canExec, execPayload] = await resolver.checker();
      console.log("⏱️", new Date().toLocaleTimeString(), "| Peut exécuter :", canExec);

      if (canExec) {
        // ✅ On décode l’adresse du contrat cible depuis execPayload
        // execPayload = selector de la fonction release()
        const iface = new ethers.Interface(scheduledPaymentAbi);

        // On suppose que le contrat ScheduledPayment est connu
        const scheduledPaymentAddress = "0x7d685E01BCc3a176cd600F14CE5CB78027244034"; // <-- ton ScheduledPayment
        const scheduledPayment = new ethers.Contract(scheduledPaymentAddress, scheduledPaymentAbi, wallet);

        const tx = await scheduledPayment.release();
        console.log("💸 Paiement libéré !");
        console.log("🔗 Tx :", tx.hash);
      } else {
        console.log("🕒 Pas encore le moment...");
      }
    } catch (err) {
      console.error("⚠️ Erreur :", err.message);
    }
  }

  // Vérifie toutes les 30 secondes
  setInterval(checkAndRelease, 30_000);
  await checkAndRelease();
}

main();

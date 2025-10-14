require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

  // ✅ Mets ici ton adresse de contrat RESOLVER déployé
  const resolverAddress = "0xb29b8cE9404bA6995dAf3936a86E6a5853cbb1d3"; // <-- à remplacer

  // ✅ ABI minimale : on n’a besoin que de la fonction checker()
  const resolverAbi = [
    "function checker() external view returns (bool canExec, bytes memory execPayload)"
  ];

  const resolver = new ethers.Contract(resolverAddress, resolverAbi, provider);

  console.log("🔍 Lecture du resolver...");
  const [canExec, execPayload] = await resolver.checker();

  console.log("✅ Peut exécuter :", canExec);
  console.log("📦 Données d’exécution (payload) :", execPayload);
}

main().catch((err) => {
  console.error("❌ Erreur :", err);
  process.exitCode = 1;
});

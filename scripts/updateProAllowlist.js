const hre = require("hardhat");

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) return null;
  return process.argv[index + 1];
}

async function main() {
  const factoryAddress = getArgValue("--factory") || process.env.FACTORY_ADDRESS;
  const contractName = getArgValue("--contract") || process.env.CONTRACT_NAME;
  const walletsRaw = getArgValue("--wallets") || process.env.PRO_WALLETS;
  const isProRaw = getArgValue("--isPro") || process.env.IS_PRO;

  if (!factoryAddress || !contractName || !walletsRaw || isProRaw === null) {
    console.error("Usage:");
    console.error(
      "  npx hardhat run scripts/updateProAllowlist.js --network base_mainnet " +
      "--factory <address> --contract <PaymentFactory_Scheduled|PaymentFactory_Recurring> " +
      "--wallets <0x...,0x...> --isPro <true|false>"
    );
    console.error("Or set env vars: FACTORY_ADDRESS, CONTRACT_NAME, PRO_WALLETS, IS_PRO");
    process.exit(1);
  }

  const isPro = String(isProRaw).toLowerCase() === "true" || String(isProRaw) === "1";
  const wallets = walletsRaw.split(",").map((w) => w.trim()).filter(Boolean);

  if (wallets.length === 0) {
    throw new Error("No wallets provided");
  }

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔧 MISE À JOUR ALLOWLIST PRO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 Compte :", deployer.address);
  console.log("🌐 Réseau :", network.name, `(chainId: ${network.chainId})`);
  console.log("🏭 Factory :", factoryAddress);
  console.log("📦 Contract :", contractName);
  console.log("✅ isPro :", isPro);
  console.log("👥 Wallets :", wallets);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const factory = await hre.ethers.getContractAt(contractName, factoryAddress);
  const tx = await factory.setProWallets(wallets, isPro);
  console.log("⏳ Tx envoyée :", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Confirmée dans le bloc :", receipt.blockNumber);
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});

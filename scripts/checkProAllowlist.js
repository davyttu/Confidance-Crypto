const hre = require("hardhat");

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) return null;
  return process.argv[index + 1];
}

async function main() {
  const wallet = getArgValue("--wallet") || process.env.WALLET;
  if (!wallet) {
    console.error("Usage: npx hardhat run scripts/checkProAllowlist.js --network base_mainnet --wallet <address>");
    process.exit(1);
  }

  const scheduledFactory = "0x53D9F5d77155f9154791eF3221c74c8A2C394657";
  const recurringFactory = "0x535FE2BA7F85e1b2aC28d4ccBD5F2d8C54254E2a";

  const Scheduled = await hre.ethers.getContractAt(
    "contracts/PaymentFactory_Scheduled.sol:PaymentFactory_Scheduled",
    scheduledFactory
  );
  const Recurring = await hre.ethers.getContractAt(
    "contracts/PaymentFactory_Recurring.sol:PaymentFactory_Recurring",
    recurringFactory
  );

  const isProScheduled = await Scheduled.isProWallet(wallet);
  const isProRecurring = await Recurring.isProWallet(wallet);

  console.log("Wallet:", wallet);
  console.log("Scheduled allowlist:", isProScheduled);
  console.log("Recurring allowlist:", isProRecurring);
}

main().catch((error) => {
  console.error("\n❌ Erreur :", error);
  process.exitCode = 1;
});

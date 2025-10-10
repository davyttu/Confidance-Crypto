const hre = require("hardhat");

async function main() {
  const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
  const factory = await hre.ethers.getContractAt("PaymentFactory", FACTORY_ADDRESS);

  console.log("🧾 Création d’un paiement test sur la factory :", FACTORY_ADDRESS);

  const recipient = "0x7A764F9dED8CA54A5514023643fE117c6eAddD90"; // adresse de test
  const releaseTime = Math.floor(Date.now() / 1000) + 60 * 2; // +2 min
  const isCancelable = true;
  const isDefinitive = false;

  const tx = await factory.createPayment(recipient, releaseTime, isCancelable, isDefinitive, {
    value: hre.ethers.parseEther("0.001"), // montant test
  });

  const receipt = await tx.wait();
  console.log("✅ Paiement créé avec succès !");
  console.log("📜 Transaction :", receipt.hash);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

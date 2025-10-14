require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const deploymentInfo = JSON.parse(fs.readFileSync("deployment-info-test.json", "utf8"));

  const [deployer] = await ethers.getSigners();
  console.log("🚀 Déploiement du resolver avec :", deployer.address);

  const Resolver = await ethers.getContractFactory("Resolver");
  const resolver = await Resolver.deploy(deploymentInfo.scheduledPayment);
  await resolver.waitForDeployment(); // ✅ Ethers v6 remplace .deployed() par .waitForDeployment()

  const resolverAddress = await resolver.getAddress(); // ✅ Ethers v6 — getAddress() à la place de .address
  console.log("✅ Resolver déployé :", resolverAddress);

  deploymentInfo.resolver = resolverAddress;
  fs.writeFileSync("deployment-info-test.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Adresse sauvegardée dans deployment-info-test.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

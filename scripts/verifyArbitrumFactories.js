const hre = require("hardhat");
const fs = require("fs");

const OUTPUT_FILE = "factory-arbitrum-deployment.json";

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 42161n) {
    throw new Error(`Pas sur Arbitrum One. ChainId reçu : ${network.chainId}`);
  }

  if (!fs.existsSync(OUTPUT_FILE)) {
    throw new Error(`${OUTPUT_FILE} introuvable. Déployer d'abord : npm run deploy:arbitrum`);
  }

  const deployment = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8"));
  if (deployment.chainId !== "42161") {
    throw new Error(`${OUTPUT_FILE} n'est pas un déploiement Arbitrum.`);
  }

  const factories = deployment.factories || {};
  const keys = ["scheduled", "instant", "recurring"];
  const missing = keys.filter((key) => !factories[key]?.address);
  if (missing.length > 0) {
    throw new Error(`Adresses manquantes dans ${OUTPUT_FILE} : ${missing.join(", ")}`);
  }

  const failed = [];

  for (const key of keys) {
    const factory = factories[key];
    const constructorArguments = (factory.constructorArgs || []).map((arg) => BigInt(arg));
    const explorerUrl = `https://arbiscan.io/address/${factory.address}#code`;
    console.log(`\nVérification ${factory.name} (${factory.address})`);

    let verified = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await hre.run("verify:verify", {
          address: factory.address,
          constructorArguments,
          network: "arbitrum_mainnet",
        });
        console.log(explorerUrl);
        verified = true;
        break;
      } catch (error) {
        const message = error.message || String(error);
        if (message.toLowerCase().includes("already verified")) {
          console.log("Déjà vérifié.");
          console.log(explorerUrl);
          verified = true;
          break;
        }
        if (attempt < 3 && message.toLowerCase().includes("timeout")) {
          console.log(`Délai dépassé, nouvel essai ${attempt + 1}/3...`);
          await new Promise((resolve) => setTimeout(resolve, 8000));
          continue;
        }
        console.error(message);
        break;
      }
    }

    if (!verified) failed.push(factory.name);
  }

  if (failed.length > 0) {
    throw new Error(`Vérification incomplète : ${failed.join(", ")}`);
  }
}

main().catch((error) => {
  console.error("\nErreur :", error.message || error);
  process.exitCode = 1;
});

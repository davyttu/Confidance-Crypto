const hre = require("hardhat");
const fs = require("fs");

const ARBITRUM_CHAIN_ID = 42161n;
const SECONDS_PER_MONTH = 30 * 24 * 60 * 60; // 2 592 000 — même valeur que Base mainnet
const OUTPUT_FILE = "factory-arbitrum-deployment.json";
const MIN_BALANCE_ETH = "0.001";
const PROTOCOL_WALLET = "0xa34eDf91Cc494450000Eef08e6563062B2F115a9";

// Référence pour l'étape 2. Ces adresses ne sont pas des arguments de constructeur.
const TOKENS = {
  ETH: "NATIVE",
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
};

const FACTORIES = [
  {
    key: "scheduled",
    name: "PaymentFactory_Scheduled",
    qualified: "contracts/PaymentFactory_Scheduled.sol:PaymentFactory_Scheduled",
    args: [],
  },
  {
    key: "instant",
    name: "PaymentFactory_Instant",
    qualified: "contracts/PaymentFactory_Instant.sol:PaymentFactory_Instant",
    args: [],
  },
  {
    key: "recurring",
    name: "PaymentFactory_Recurring",
    qualified: "contracts/PaymentFactory_Recurring.sol:PaymentFactory_Recurring",
    args: [SECONDS_PER_MONTH],
  },
];

function emptyDeployment(deployer) {
  return {
    version: "ARBITRUM_FACTORIES_V1",
    network: "arbitrum_mainnet",
    chainId: ARBITRUM_CHAIN_ID.toString(),
    deployedBy: deployer,
    frontendUpdated: false,
    factories: {},
    constants: {
      protocolWallet: PROTOCOL_WALLET,
      secondsPerMonth: SECONDS_PER_MONTH,
      feeBpsParticular: 179,
      feeBpsPro: 156,
    },
    tokens: {
      note: "Référence pour l'étape 2. Aucun token n'est passé aux constructeurs.",
      ...TOKENS,
    },
  };
}

function readDeployment() {
  if (!fs.existsSync(OUTPUT_FILE)) return null;
  return JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8"));
}

function writeDeployment(deployment) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(deployment, null, 2));
}

async function assertFactory(key, address) {
  const code = await hre.ethers.provider.getCode(address);
  if (!code || code === "0x") {
    throw new Error(`${key} : aucun bytecode à ${address}`);
  }

  if (key === "scheduled") {
    const factory = await hre.ethers.getContractAt(
      "contracts/PaymentFactory_Scheduled.sol:PaymentFactory_Scheduled",
      address
    );
    const wallet = await factory.PROTOCOL_WALLET();
    const particular = await factory.FEE_BPS_PARTICULAR();
    const pro = await factory.FEE_BPS_PRO();
    if (wallet.toLowerCase() !== PROTOCOL_WALLET.toLowerCase()) {
      throw new Error(`scheduled : PROTOCOL_WALLET inattendu (${wallet})`);
    }
    if (particular !== 179n || pro !== 156n) {
      throw new Error(`scheduled : frais inattendus (${particular} / ${pro})`);
    }
  }

  if (key === "recurring") {
    const factory = await hre.ethers.getContractAt(
      "contracts/PaymentFactory_Recurring.sol:PaymentFactory_Recurring",
      address
    );
    const seconds = await factory.secondsPerMonth();
    const wallet = await factory.PROTOCOL_WALLET();
    if (seconds !== BigInt(SECONDS_PER_MONTH)) {
      throw new Error(`recurring : secondsPerMonth = ${seconds}, attendu ${SECONDS_PER_MONTH}`);
    }
    if (wallet.toLowerCase() !== PROTOCOL_WALLET.toLowerCase()) {
      throw new Error(`recurring : PROTOCOL_WALLET inattendu (${wallet})`);
    }
  }
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("DÉPLOIEMENT FACTORIES ARBITRUM");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Compte :", deployer.address);
  console.log("Réseau :", network.name, `(chainId: ${network.chainId})`);

  if (network.chainId !== ARBITRUM_CHAIN_ID) {
    throw new Error(`Pas sur Arbitrum One. ChainId reçu : ${network.chainId}. Attendu : 42161`);
  }

  const existing = readDeployment();
  const deployment = existing || emptyDeployment(deployer.address);

  if (existing) {
    if (existing.chainId !== ARBITRUM_CHAIN_ID.toString()) {
      throw new Error(`${OUTPUT_FILE} n'est pas un déploiement Arbitrum. Aucune transaction envoyée.`);
    }
    if (existing.deployedBy && existing.deployedBy.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error(
        `${OUTPUT_FILE} a été déployé par ${existing.deployedBy}. Le compte courant est ${deployer.address}. Aucune transaction envoyée.`
      );
    }
  }

  const pending = FACTORIES.filter((factory) => !deployment.factories[factory.key]?.address);
  if (pending.length === 0) {
    console.log(`\n${OUTPUT_FILE} contient déjà les trois factories. Aucune transaction envoyée.`);
    for (const factory of FACTORIES) {
      const address = deployment.factories[factory.key].address;
      console.log(`  ${factory.key} : ${address}`);
      console.log(`  https://arbiscan.io/address/${address}`);
    }
    console.log("\nVérification : npm run verify:arbitrum");
    return;
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Solde :", hre.ethers.formatEther(balance), "ETH");
  if (balance < hre.ethers.parseEther(MIN_BALANCE_ETH)) {
    throw new Error(
      `Solde Arbitrum trop bas (${hre.ethers.formatEther(balance)} ETH). ` +
        `Il faut au moins ${MIN_BALANCE_ETH} ETH sur ${deployer.address} avant d'envoyer une transaction.`
    );
  }

  console.log("À déployer :", pending.map((factory) => factory.name).join(", "));
  console.log("Le site et les fichiers de déploiement Base ne sont pas modifiés.\n");

  for (const factory of pending) {
    console.log(`Déploiement ${factory.name}...`);
    const Contract = await hre.ethers.getContractFactory(factory.qualified);
    const instance = await Contract.deploy(...factory.args);
    await instance.waitForDeployment();
    const address = await instance.getAddress();

    await assertFactory(factory.key, address);

    deployment.factories[factory.key] = {
      name: factory.name,
      address,
      constructorArgs: factory.args.map((arg) => arg.toString()),
      deployedAt: new Date().toISOString(),
    };
    deployment.deployedBy = deployer.address;
    writeDeployment(deployment);

    console.log(`  ${address}`);
    console.log(`  https://arbiscan.io/address/${address}`);
    console.log(`  enregistré dans ${OUTPUT_FILE}\n`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Trois factories enregistrées. Le frontend n'a pas été mis à jour.");
  console.log("Prochaine commande, après quelques confirmations : npm run verify:arbitrum");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((error) => {
  console.error("\nErreur :", error.message || error);
  process.exitCode = 1;
});

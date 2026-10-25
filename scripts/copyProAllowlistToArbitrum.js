const hre = require("hardhat");

const PAIRS = [
  {
    name: "scheduled",
    base: "0x53D9F5d77155f9154791eF3221c74c8A2C394657",
    arbitrum: "0x3746BC33ce743962E2554c962BB4A1d6b2Cf0E4C",
  },
  {
    name: "recurring",
    base: "0x62B2C06C1F1D8e677D0b309E51b25fdDeBF6e781",
    arbitrum: "0xd84e6AE29c492F305f2686C02425242E282DA5E3",
  },
];

const EVENT = "event ProWalletUpdated(address indexed wallet, bool isPro)";

async function proWalletsOnBase(factory) {
  const provider = new hre.ethers.JsonRpcProvider(process.env.BASE_RPC || "https://mainnet.base.org");
  const iface = new hre.ethers.Interface([EVENT]);
  const topic0 = iface.getEvent("ProWalletUpdated").topicHash;
  const latestBlock = await provider.getBlockNumber();

  let low = 0;
  let high = latestBlock;
  let firstCodeBlock = latestBlock;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const code = await provider.getCode(factory, mid);
    if (code && code !== "0x") {
      firstCodeBlock = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  console.log(`Lecture ${factory} depuis le bloc ${firstCodeBlock}`);
  const latest = new Map();
  const step = 50000;
  for (let from = firstCodeBlock; from <= latestBlock; from += step) {
    const to = Math.min(from + step - 1, latestBlock);
    const logs = await provider.getLogs({
      address: factory,
      topics: [topic0],
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      const parsed = iface.parseLog(log);
      const order = log.blockNumber * 100000 + log.index;
      const key = parsed.args.wallet.toLowerCase();
      const prev = latest.get(key);
      if (!prev || order >= prev.order) {
        latest.set(key, {
          wallet: parsed.args.wallet,
          isPro: Boolean(parsed.args.isPro),
          order,
        });
      }
    }
  }

  return [...latest.values()].filter((entry) => entry.isPro).map((entry) => entry.wallet);
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 42161n) {
    throw new Error(`Ce script ne s'exécute que sur Arbitrum. chainId reçu: ${network.chainId}`);
  }

  const [signer] = await hre.ethers.getSigners();
  console.log("Compte:", signer.address);

  for (const pair of PAIRS) {
    const factory = await hre.ethers.getContractAt("PaymentFactory_Scheduled", pair.arbitrum);
    const owner = await factory.FACTORY_OWNER();
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      throw new Error(`${pair.name}: le compte n'est pas le propriétaire ${owner}`);
    }

    const wallets = await proWalletsOnBase(pair.base);
    console.log(`${pair.name}: ${wallets.length} portefeuille(s) Pro sur Base`);
    wallets.forEach((wallet) => console.log(`  ${wallet}`));

    if (wallets.length === 0) {
      console.log(`${pair.name}: rien à inscrire`);
      continue;
    }

    const tx = await factory.setProWallets(wallets, true);
    console.log(`${pair.name}: tx ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`${pair.name}: confirmée au bloc ${receipt.blockNumber}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

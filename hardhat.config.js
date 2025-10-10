require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY, RPC_URL } = process.env;

module.exports = {
  solidity: "0.8.20",
  networks: {
    coretest: {
      url: RPC_URL || "https://rpc.test.btcs.network",
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [],
      chainId: 1115, // Core Testnet
    },
    hardhat: {
      chainId: 31337,
    },
  },
};

// services/aaveService.js
const { ethers } = require('ethers');

// ===== Base Mainnet =====
const AAVE_POOL_ADDRESS = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5';

// ABI minimal READ-ONLY
const POOL_ABI = [
  'function getUserAccountData(address user) external view returns (uint256,uint256,uint256,uint256,uint256,uint256)'
];

// Provider uniquement (AUCUNE clé privée)
const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || 'https://mainnet.base.org'
);

const pool = new ethers.Contract(AAVE_POOL_ADDRESS, POOL_ABI, provider);

/**
 * Health Factor utilisateur (Aave)
 */
exports.getHealthFactor = async (userAddress) => {
  const data = await pool.getUserAccountData(userAddress);
  return Number(ethers.formatUnits(data.healthFactor, 18));
};

/**
 * Données complètes (optionnel mais utile)
 */
exports.getUserAccountData = async (userAddress) => {
  const [
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThreshold,
    ltv,
    healthFactor
  ] = await pool.getUserAccountData(userAddress);

  return {
    totalCollateralBase: Number(totalCollateralBase),
    totalDebtBase: Number(totalDebtBase),
    availableBorrowsBase: Number(availableBorrowsBase),
    ltv: Number(ltv),
    liquidationThreshold: Number(currentLiquidationThreshold),
    healthFactor: Number(ethers.formatUnits(healthFactor, 18))
  };
};

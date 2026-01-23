// utils/liquidityCalculator.js

/**
 * Calcule le montant de liquidité reçu
 */
exports.calculateLiquidityAmount = (ethAmount, ethPrice, ltvPercentage) => {
  const collateralValue = ethAmount * ethPrice;
  return (collateralValue * ltvPercentage) / 100;
};

/**
 * Calcule les intérêts accumulés
 */
exports.calculateInterest = (principal, annualRate, durationMonths) => {
  return (principal * annualRate * durationMonths) / 12;
};

/**
 * Calcule le health factor
 */
exports.calculateHealthFactor = (collateralValue, borrowedAmount, liquidationThreshold = 0.8) => {
  if (borrowedAmount === 0) return Infinity;
  return (collateralValue * liquidationThreshold) / borrowedAmount;
};
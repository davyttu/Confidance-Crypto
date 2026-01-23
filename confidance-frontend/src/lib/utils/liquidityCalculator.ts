/**
 * Calcule le montant de liquidité reçu en fonction du LTV
 * @param ethAmount - Montant d'ETH déposé
 * @param ethPrice - Prix de l'ETH en USD
 * @param ltvPercentage - Loan-to-Value en pourcentage (0-60)
 * @returns Montant de liquidité en USD
 */
export function calculateLiquidityAmount(
  ethAmount: number,
  ethPrice: number,
  ltvPercentage: number
): number {
  const collateralValue = ethAmount * ethPrice;
  const liquidityAmount = (collateralValue * ltvPercentage) / 100;
  return liquidityAmount;
}

/**
 * Calcule les frais d'intérêt
 * @param liquidityAmount - Montant emprunté
 * @param annualRate - Taux annuel (ex: 0.06 pour 6%)
 * @param durationMonths - Durée en mois
 * @returns Montant des intérêts
 */
export function calculateInterest(
  liquidityAmount: number,
  annualRate: number = 0.06,
  durationMonths: number = 12
): number {
  return (liquidityAmount * annualRate * durationMonths) / 12;
}

/**
 * Calcule le health factor (ratio de sécurité)
 * @param collateralValue - Valeur du collatéral en USD
 * @param borrowedAmount - Montant emprunté
 * @param liquidationThreshold - Seuil de liquidation (ex: 0.8 pour 80%)
 * @returns Health factor
 */
export function calculateHealthFactor(
  collateralValue: number,
  borrowedAmount: number,
  liquidationThreshold: number = 0.8
): number {
  if (borrowedAmount === 0) return Infinity;
  return (collateralValue * liquidationThreshold) / borrowedAmount;
}

/**
 * Calcule les frais totaux
 */
export function calculateFees(
  liquidityAmount: number,
  durationMonths: number = 6
): {
  annualCost: number;
  totalCost: number;
} {
  const annualCost = liquidityAmount * 0.06;
  const totalCost = (annualCost * durationMonths) / 12;
  
  return {
    annualCost,
    totalCost
  };
}
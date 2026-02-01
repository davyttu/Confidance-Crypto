/**
 * Utilitaires de formatage de montants pour les relevés mensuels.
 * Les montants en base sont stockés en unités brutes (wei pour ETH, 10^6 pour USDC/USDT).
 */

function getDecimals(symbol) {
  if (!symbol || typeof symbol !== 'string') return 6;
  const s = symbol.toUpperCase();
  if (s === 'ETH') return 18;
  return 6; // USDC, USDT, etc.
}

/**
 * Convertit un montant brut (wei / unités entières) en valeur humaine.
 * @param {string|number|bigint} rawAmount - Montant en unités brutes
 * @param {string} symbol - Token (ETH, USDC, USDT, etc.)
 * @returns {number}
 */
function rawToHuman(rawAmount, symbol) {
  try {
    if (rawAmount === undefined || rawAmount === null || rawAmount === '') return 0;
    const decimals = getDecimals(symbol);
    const divisor = BigInt(10) ** BigInt(decimals);
    const str = String(rawAmount).trim();
    const intPart = str.split('.')[0].replace(/\D/g, '') || '0';
    const value = BigInt(intPart);
    return Number(value) / Number(divisor);
  } catch {
    return 0;
  }
}

/**
 * Formate un montant brut pour affichage (conversion + 4 décimales).
 * @param {string|number|bigint} rawAmount - Montant en unités brutes
 * @param {string} symbol - Token (ETH, USDC, USDT, etc.)
 * @returns {string}
 */
function formatRawAmount(rawAmount, symbol) {
  const human = rawToHuman(rawAmount, symbol);
  return human.toFixed(4);
}

/**
 * Formate un montant déjà en valeur humaine (ex. synthèse).
 * @param {number|string} amount - Montant déjà converti
 * @returns {string}
 */
function formatAmount(amount) {
  const n = parseFloat(amount);
  if (Number.isNaN(n)) return '0.0000';
  return n.toFixed(4);
}

module.exports = {
  getDecimals,
  rawToHuman,
  formatRawAmount,
  formatAmount,
};

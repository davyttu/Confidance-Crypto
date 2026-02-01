/**
 * Utilitaires de formatage d'adresses pour les relevés mensuels
 */

function truncateAddress(address, start = 6, end = 4) {
  if (!address || typeof address !== 'string') return '';
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

module.exports = { truncateAddress };

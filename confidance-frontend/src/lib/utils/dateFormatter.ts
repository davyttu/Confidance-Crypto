// lib/utils/dateFormatter.ts
/**
 * Formate un timestamp Unix en date française
 */
export function formatDate(timestamp: number | string): string {
  const date = typeof timestamp === 'string' 
    ? new Date(parseInt(timestamp) * 1000) 
    : new Date(timestamp * 1000);
  
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Formate avec heure
 */
export function formatDateTime(timestamp: number | string): string {
  const date = typeof timestamp === 'string' 
    ? new Date(parseInt(timestamp) * 1000) 
    : new Date(timestamp * 1000);
  
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Retourne le mois en français
 */
export function getMonthName(monthIndex: number): string {
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return months[monthIndex];
}

/**
 * Génère les options de période (mois de l'année en cours)
 */
export function getCurrentYearMonths() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  const months = [];
  for (let i = 0; i <= currentMonth; i++) {
    months.push({
      label: `${getMonthName(i)} ${currentYear}`,
      value: `${currentYear}-${String(i + 1).padStart(2, '0')}`,
      year: currentYear,
      month: i + 1,
    });
  }
  
  return months.reverse(); // Plus récent en premier
}

/**
 * Génère les années disponibles
 */
export function getAvailableYears(oldestTimestamp: number): number[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const oldestYear = new Date(oldestTimestamp * 1000).getFullYear();
  
  const years = [];
  for (let year = currentYear; year >= oldestYear; year--) {
    years.push(year);
  }
  
  return years;
}

/**
 * Vérifie si un timestamp est dans une période donnée
 */
export function isInPeriod(
  timestamp: number,
  periodType: 'month' | 'year' | 'all',
  periodValue?: string | number
): boolean {
  const date = new Date(timestamp * 1000);
  
  if (periodType === 'all') return true;
  
  if (periodType === 'month' && typeof periodValue === 'string') {
    const [year, month] = periodValue.split('-').map(Number);
    return date.getFullYear() === year && date.getMonth() + 1 === month;
  }
  
  if (periodType === 'year' && typeof periodValue === 'number') {
    return date.getFullYear() === periodValue;
  }
  
  return false;
}
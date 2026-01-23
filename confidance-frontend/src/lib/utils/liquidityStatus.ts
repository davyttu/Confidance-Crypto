export type LiquidityStatus = 'healthy' | 'warning' | 'critical';

interface StatusConfig {
  bg: string;
  icon: string;
  text: string;
  textColor: string;
  gaugeColor: string;
}

export function getStatusConfig(status: LiquidityStatus): StatusConfig {
  const configs: Record<LiquidityStatus, StatusConfig> = {
    healthy: {
      bg: 'bg-green-50 border-green-200',
      icon: '🟢',
      text: 'Position saine',
      textColor: 'text-green-700',
      gaugeColor: 'text-green-500'
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      icon: '🟡',
      text: 'À surveiller',
      textColor: 'text-yellow-700',
      gaugeColor: 'text-yellow-500'
    },
    critical: {
      bg: 'bg-red-50 border-red-200',
      icon: '🔴',
      text: 'Protection activée',
      textColor: 'text-red-700',
      gaugeColor: 'text-red-500'
    }
  };

  return configs[status];
}

/**
 * Calcule le statut basé sur le health factor
 */
export function calculateStatus(healthFactor: number): LiquidityStatus {
  if (healthFactor >= 1.5) return 'healthy';
  if (healthFactor >= 1.2) return 'warning';
  return 'critical';
}

/**
 * Calcule le pourcentage de santé pour la jauge
 */
export function calculateHealthPercentage(healthFactor: number): number {
  // 2.0 ou plus = 100%
  // 1.0 = 50%
  // < 1.0 = proportionnel
  const percentage = Math.min((healthFactor / 2) * 100, 100);
  return Math.round(percentage);
}

/**
 * Génère des événements de timeline exemple
 */
export function generateMockEvents(): any[] {
  return [
    {
      icon: '🎉',
      bgColor: 'bg-blue-100',
      title: 'Liquidité ouverte',
      date: '15 oct. 2024',
      description: 'Vous avez déposé 1 ETH et reçu 1 200 USDC'
    },
    {
      icon: '📊',
      bgColor: 'bg-purple-100',
      title: 'Intérêts accumulés',
      date: '15 nov. 2024',
      description: 'Intérêts : 6 USDC (1 mois)',
      details: 'Taux annuel : 6% sur 1 200 USDC'
    },
    {
      icon: '⚡',
      bgColor: 'bg-yellow-100',
      title: 'Alerte envoyée',
      date: '20 déc. 2024',
      description: 'L\'ETH a baissé. Nous vous avons envoyé une notification.',
      details: 'Prix ETH : 2 000 € → 1 750 €'
    }
  ];
}
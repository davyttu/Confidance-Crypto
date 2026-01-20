// types/payment-identity.ts
/**
 * 💡 PAYMENT IDENTITY SYSTEM
 * Donne une identité à chaque paiement pour l'explicabilité IA
 */

export type PaymentCategory = 
  | 'housing'       // 🏠 Loyer, hypothèque
  | 'salary'        // 💼 Salaires, freelance
  | 'subscription'  // 📺 Abonnements (Netflix, Spotify, etc.)
  | 'utilities'     // 💡 Électricité, eau, internet
  | 'services'      // 🔧 Prestataires, consultants
  | 'transfer'      // 💸 Virements personnels
  | 'other';        // 📌 Autres

export interface PaymentIntent {
  natural_language: string;  // "Payer le loyer tous les mois"
  created_by: 'user' | 'ai'; // Source de l'identité
  confidence_score?: number; // Si IA : confiance (0-1)
}

export interface PaymentMetadata {
  label: string;             // "Loyer appartement Paris"
  category: PaymentCategory; // "housing"
  intent: PaymentIntent;
  tags?: string[];           // Tags additionnels
}

/**
 * Labels de catégories (multilingue)
 */
export const CATEGORY_LABELS: Record<PaymentCategory, Record<string, string>> = {
  housing: {
    en: 'Housing',
    fr: 'Logement',
    es: 'Vivienda',
    ru: 'Жильё',
    zh: '住房'
  },
  salary: {
    en: 'Salary',
    fr: 'Salaire',
    es: 'Salario',
    ru: 'Зарплата',
    zh: '工资'
  },
  subscription: {
    en: 'Subscription',
    fr: 'Abonnement',
    es: 'Suscripción',
    ru: 'Подписка',
    zh: '订阅'
  },
  utilities: {
    en: 'Utilities',
    fr: 'Services publics',
    es: 'Servicios',
    ru: 'Коммунальные',
    zh: '公用事业'
  },
  services: {
    en: 'Services',
    fr: 'Services',
    es: 'Servicios',
    ru: 'Услуги',
    zh: '服务'
  },
  transfer: {
    en: 'Transfer',
    fr: 'Virement',
    es: 'Transferencia',
    ru: 'Перевод',
    zh: '转账'
  },
  other: {
    en: 'Other',
    fr: 'Autre',
    es: 'Otro',
    ru: 'Другое',
    zh: '其他'
  }
};

/**
 * Icônes par catégorie
 */
export const CATEGORY_ICONS: Record<PaymentCategory, string> = {
  housing: '🏠',
  salary: '💼',
  subscription: '📺',
  utilities: '💡',
  services: '🔧',
  transfer: '💸',
  other: '📌'
};

/**
 * Couleurs Tailwind par catégorie
 */
export const CATEGORY_COLORS: Record<PaymentCategory, { bg: string; text: string; border: string }> = {
  housing: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800'
  },
  salary: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800'
  },
  subscription: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800'
  },
  utilities: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800'
  },
  services: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800'
  },
  transfer: {
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    text: 'text-pink-700 dark:text-pink-300',
    border: 'border-pink-200 dark:border-pink-800'
  },
  other: {
    bg: 'bg-gray-50 dark:bg-gray-950/30',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-800'
  }
};

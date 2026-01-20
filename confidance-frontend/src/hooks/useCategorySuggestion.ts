// hooks/useCategorySuggestion.ts
import { useMemo } from 'react';
import { PaymentCategory } from '@/types/payment-identity';

/**
 * 🧠 INTELLIGENCE DE CATÉGORISATION AUTOMATIQUE
 * Analyse le label du paiement pour suggérer une catégorie
 * Support multilingue (fr, en, es, ru, zh)
 */

interface CategoryPattern {
  category: PaymentCategory;
  keywords: string[];
}

const CATEGORY_PATTERNS: CategoryPattern[] = [
  {
    category: 'housing',
    keywords: [
      // Français
      'loyer', 'appartement', 'logement', 'location', 'bail', 'hlm', 'résidence', 'studio', 'immeuble',
      // English
      'rent', 'apartment', 'housing', 'lease', 'accommodation', 'landlord', 'property', 'mortgage',
      // Español
      'alquiler', 'apartamento', 'vivienda', 'renta', 'piso', 'casa',
      // Русский
      'аренда', 'квартира', 'жилье', 'съем',
      // 中文
      '租金', '公寓', '住房', '房租'
    ]
  },
  {
    category: 'salary',
    keywords: [
      // Français
      'salaire', 'paie', 'rémunération', 'freelance', 'prestation', 'honoraire', 'cachet', 'mission',
      // English
      'salary', 'payroll', 'wage', 'payment', 'contractor', 'freelancer', 'invoice', 'fee',
      // Español
      'salario', 'sueldo', 'nómina', 'pago', 'honorario', 'freelance',
      // Русский
      'зарплата', 'оплата', 'гонорар', 'фриланс',
      // 中文
      '工资', '薪水', '报酬', '自由职业'
    ]
  },
  {
    category: 'subscription',
    keywords: [
      // Services communs
      'netflix', 'spotify', 'youtube', 'amazon prime', 'disney', 'apple music', 'deezer',
      // Français
      'abonnement', 'souscription', 'mensualité',
      // English
      'subscription', 'membership', 'premium', 'pro', 'plus',
      // Español
      'suscripción', 'membresía', 'abono',
      // Русский
      'подписка', 'членство',
      // 中文
      '订阅', '会员'
    ]
  },
  {
    category: 'utilities',
    keywords: [
      // Français
      'électricité', 'eau', 'gaz', 'internet', 'téléphone', 'edf', 'engie', 'orange', 'sfr', 'free', 'bouygues',
      // English
      'electricity', 'water', 'gas', 'internet', 'phone', 'utility', 'bill', 'provider',
      // Español
      'electricidad', 'agua', 'gas', 'internet', 'teléfono', 'factura',
      // Русский
      'электричество', 'вода', 'газ', 'интернет', 'телефон', 'коммунальные',
      // 中文
      '电费', '水费', '燃气', '网络', '电话'
    ]
  },
  {
    category: 'services',
    keywords: [
      // Français
      'prestataire', 'service', 'consultant', 'agence', 'expert', 'développeur', 'designer', 'comptable',
      // English
      'service', 'provider', 'consultant', 'agency', 'expert', 'developer', 'designer', 'accountant',
      // Español
      'servicio', 'proveedor', 'consultor', 'agencia', 'experto', 'desarrollador',
      // Русский
      'услуга', 'поставщик', 'консультант', 'агентство', 'эксперт',
      // 中文
      '服务', '供应商', '顾问', '机构', '专家'
    ]
  },
  {
    category: 'transfer',
    keywords: [
      // Français
      'virement', 'transfert', 'envoi', 'remboursement', 'prêt', 'dette',
      // English
      'transfer', 'send', 'wire', 'remittance', 'refund', 'loan', 'debt', 'repayment',
      // Español
      'transferencia', 'envío', 'remesa', 'reembolso', 'préstamo', 'deuda',
      // Русский
      'перевод', 'отправка', 'возврат', 'кредит', 'долг',
      // 中文
      '转账', '汇款', '退款', '贷款', '债务'
    ]
  }
];

/**
 * Normalise le texte pour la comparaison
 * - Lowercase
 * - Supprime accents
 * - Trim espaces
 */
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime accents
    .trim();
};

/**
 * Hook de suggestion de catégorie
 */
export function useCategorySuggestion(label: string): {
  suggestedCategory: PaymentCategory;
  confidence: number;
  matchedKeywords: string[];
} {
  return useMemo(() => {
    // Si label vide → "other"
    if (!label || label.trim().length === 0) {
      return {
        suggestedCategory: 'other',
        confidence: 1,
        matchedKeywords: []
      };
    }

    const normalizedLabel = normalizeText(label);
    let bestMatch: {
      category: PaymentCategory;
      score: number;
      keywords: string[];
    } = {
      category: 'other',
      score: 0,
      keywords: []
    };

    // Chercher les correspondances
    for (const pattern of CATEGORY_PATTERNS) {
      const matchedKeywords: string[] = [];
      let score = 0;

      for (const keyword of pattern.keywords) {
        const normalizedKeyword = normalizeText(keyword);
        
        // Exact match (mot entier)
        const exactMatch = new RegExp(`\\b${normalizedKeyword}\\b`).test(normalizedLabel);
        if (exactMatch) {
          matchedKeywords.push(keyword);
          score += 10; // Score élevé pour match exact
          continue;
        }

        // Partial match (contient le mot)
        if (normalizedLabel.includes(normalizedKeyword)) {
          matchedKeywords.push(keyword);
          score += 5; // Score moyen pour match partiel
        }
      }

      // Mise à jour du meilleur match
      if (score > bestMatch.score) {
        bestMatch = {
          category: pattern.category,
          score,
          keywords: matchedKeywords
        };
      }
    }

    // Calculer confidence (0-1)
    const confidence = Math.min(bestMatch.score / 10, 1);

    return {
      suggestedCategory: bestMatch.category,
      confidence,
      matchedKeywords: bestMatch.keywords
    };
  }, [label]);
}

/**
 * Hook simplifié qui retourne juste la catégorie
 */
export function useSuggestedCategory(label: string): PaymentCategory {
  const { suggestedCategory } = useCategorySuggestion(label);
  return suggestedCategory;
}

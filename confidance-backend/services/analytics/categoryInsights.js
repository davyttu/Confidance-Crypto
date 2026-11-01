const SUPPORTED_LOCALES = ['en', 'fr', 'es', 'zh', 'ru'];

const CATEGORY_LABELS = {
  en: {
    housing: 'Housing',
    salary: 'Salary',
    subscription: 'Subscription',
    utilities: 'Utilities',
    services: 'Services',
    transfer: 'Transfer',
    other: 'Other'
  },
  fr: {
    housing: 'Logement',
    salary: 'Salaire',
    subscription: 'Abonnement',
    utilities: 'Services publics',
    services: 'Services',
    transfer: 'Virement',
    other: 'Autre'
  },
  es: {
    housing: 'Vivienda',
    salary: 'Salario',
    subscription: 'Suscripción',
    utilities: 'Suministros',
    services: 'Servicios',
    transfer: 'Transferencia',
    other: 'Otro'
  },
  zh: {
    housing: '住房',
    salary: '工资',
    subscription: '订阅',
    utilities: '公共事业',
    services: '服务',
    transfer: '转账',
    other: '其他'
  },
  ru: {
    housing: 'Жильё',
    salary: 'Зарплата',
    subscription: 'Подписка',
    utilities: 'Коммунальные услуги',
    services: 'Услуги',
    transfer: 'Перевод',
    other: 'Другое'
  }
};

const INSIGHT_COPY = {
  en: {
    distribution: 'Your main spending this month is {{first}} ({{firstPct}}%) and {{second}} ({{secondPct}}%).',
    unusedOne: 'You have 1 active subscription with no recent activity.',
    unusedMany: 'You have {{count}} active subscriptions with no recent activity.',
    growth: 'Spending on {{label}} is up {{pct}}% this month.'
  },
  fr: {
    distribution: 'Vos principales dépenses ce mois-ci concernent {{first}} ({{firstPct}} %) et {{second}} ({{secondPct}} %).',
    unusedOne: 'Vous avez 1 abonnement actif sans interaction récente.',
    unusedMany: 'Vous avez {{count}} abonnements actifs sans interaction récente.',
    growth: 'Les dépenses liées à {{label}} ont augmenté de +{{pct}} % ce mois-ci.'
  },
  es: {
    distribution: 'Tus principales gastos de este mes son {{first}} ({{firstPct}} %) y {{second}} ({{secondPct}} %).',
    unusedOne: 'Tienes 1 suscripción activa sin actividad reciente.',
    unusedMany: 'Tienes {{count}} suscripciones activas sin actividad reciente.',
    growth: 'Los gastos de {{label}} aumentaron un {{pct}} % este mes.'
  },
  zh: {
    distribution: '本月主要支出是{{first}}（{{firstPct}}%）和{{second}}（{{secondPct}}%）。',
    unusedOne: '您有 1 个近期没有活动的有效订阅。',
    unusedMany: '您有 {{count}} 个近期没有活动的有效订阅。',
    growth: '本月{{label}}相关支出增加了 {{pct}}%。'
  },
  ru: {
    distribution: 'Основные расходы в этом месяце: {{first}} ({{firstPct}} %) и {{second}} ({{secondPct}} %).',
    unusedOne: 'У вас 1 активная подписка без недавней активности.',
    unusedMany: 'У вас {{count}} активных подписок без недавней активности.',
    growth: 'Расходы на {{label}} выросли на {{pct}} % в этом месяце.'
  }
};

const resolveLocale = (locale) => {
  const code = String(locale || 'en').split('-')[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(code) ? code : 'en';
};

const fillTemplate = (template, values) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));

const INSIGHTS = {
  categoryDistribution: {
    id: 'category_distribution',
    icon: '📊'
  },
  unusedSubscriptions: {
    id: 'unused_subscriptions',
    icon: '🔁'
  },
  categoryGrowth: {
    id: 'category_growth',
    icon: '📈'
  }
};

const getMonthRange = (monthKey) => {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end, startIso: start.toISOString(), endIso: end.toISOString() };
};

const getPreviousMonthKey = (monthKey) => {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) return null;
  const prev = new Date(Date.UTC(year, month - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
};

const parseAmount = (value) => {
  const num = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isFinite(num) ? num : 0;
};

const normalizeCategory = (category) => {
  if (typeof category !== 'string') return null;
  const trimmed = category.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const getCategoryLabel = (category, locale) => {
  const normalized = normalizeCategory(category);
  if (!normalized) return null;
  const labels = CATEGORY_LABELS[locale] || CATEGORY_LABELS.en;
  return labels[normalized] || labels.other;
};

const summarizeCategories = (entries) => {
  const totals = new Map();
  let totalAmount = 0;
  let totalCount = 0;

  entries.forEach((entry) => {
    const category = normalizeCategory(entry?.metadata?.category);
    if (!category) return;
    const amount = parseAmount(entry?.metadata?.amount);
    const current = totals.get(category) || { amount: 0, count: 0 };
    current.amount += amount;
    current.count += 1;
    totals.set(category, current);
    totalAmount += amount;
    totalCount += 1;
  });

  if (totals.size === 0) {
    return null;
  }

  const useAmount = totalAmount > 0;
  const totalValue = useAmount ? totalAmount : totalCount;
  const ranked = Array.from(totals.entries())
    .map(([category, values]) => {
      const value = useAmount ? values.amount : values.count;
      return {
        category,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  return ranked;
};

const getCategoryDistributionInsight = async (supabase, userId, monthKey, locale) => {
  const range = getMonthRange(monthKey);
  if (!range) return null;

  const { data: events, error } = await supabase
    .from('payment_timeline_events')
    .select('metadata')
    .eq('user_id', userId)
    .eq('event_type', 'payment_executed')
    .gte('created_at', range.startIso)
    .lt('created_at', range.endIso);

  if (error) {
    console.error('❌ Erreur insight category_distribution:', error);
    return null;
  }

  const ranked = summarizeCategories(events || []);
  if (!ranked || ranked.length < 2) return null;

  const [first, second] = ranked;
  const firstLabel = getCategoryLabel(first.category, locale);
  const secondLabel = getCategoryLabel(second.category, locale);
  if (!firstLabel || !secondLabel) return null;

  const message = fillTemplate(INSIGHT_COPY[locale].distribution, {
    first: firstLabel,
    second: secondLabel,
    firstPct: Math.round(first.percentage),
    secondPct: Math.round(second.percentage)
  });

  return {
    ...INSIGHTS.categoryDistribution,
    message
  };
};

const getUnusedSubscriptionsInsight = async (supabase, userId, monthKey, locale, inactivityMonths = 3) => {
  const range = getMonthRange(monthKey);
  if (!range) return null;

  const { data: subscriptionEvents, error } = await supabase
    .from('payment_timeline_events')
    .select('payment_id, created_at')
    .eq('user_id', userId)
    .eq('metadata->>category', 'subscription')
    .eq('metadata->>payment_type', 'recurring');

  if (error) {
    console.error('❌ Erreur insight unused_subscriptions (seed):', error);
    return null;
  }

  const paymentIds = Array.from(
    new Set((subscriptionEvents || []).map((event) => event.payment_id).filter(Boolean))
  );

  if (paymentIds.length === 0) return null;

  const { data: events, error: eventsError } = await supabase
    .from('payment_timeline_events')
    .select('payment_id, event_type, created_at')
    .eq('user_id', userId)
    .in('payment_id', paymentIds);

  if (eventsError) {
    console.error('❌ Erreur insight unused_subscriptions (events):', eventsError);
    return null;
  }

  const cutoff = new Date(range.end.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - inactivityMonths);

  const grouped = new Map();
  (events || []).forEach((event) => {
    if (!event.payment_id) return;
    const bucket = grouped.get(event.payment_id) || [];
    bucket.push(event);
    grouped.set(event.payment_id, bucket);
  });

  let inactiveCount = 0;
  grouped.forEach((items) => {
    const sorted = items
      .filter((entry) => entry.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const hasCancellation = sorted.some((entry) => entry.event_type === 'payment_cancelled');
    if (hasCancellation) return;

    const lastNonExecuted = sorted.find((entry) => entry.event_type !== 'payment_executed');
    if (!lastNonExecuted) {
      // Aucun événement autre que payment_executed -> considérer comme sans interaction récente
      inactiveCount += 1;
      return;
    }

    const lastInteractionDate = new Date(lastNonExecuted.created_at);
    if (Number.isNaN(lastInteractionDate.getTime())) return;
    if (lastInteractionDate < cutoff) {
      inactiveCount += 1;
    }
  });

  if (inactiveCount === 0) return null;

  const message = inactiveCount > 1
    ? fillTemplate(INSIGHT_COPY[locale].unusedMany, { count: inactiveCount })
    : INSIGHT_COPY[locale].unusedOne;

  return {
    ...INSIGHTS.unusedSubscriptions,
    message
  };
};

const getCategoryGrowthInsight = async (supabase, userId, monthKey, locale) => {
  const range = getMonthRange(monthKey);
  const previousKey = getPreviousMonthKey(monthKey);
  if (!range || !previousKey) return null;

  const previousRange = getMonthRange(previousKey);
  if (!previousRange) return null;

  const [currentResponse, previousResponse] = await Promise.all([
    supabase
      .from('payment_timeline_events')
      .select('metadata')
      .eq('user_id', userId)
      .eq('event_type', 'payment_executed')
      .gte('created_at', range.startIso)
      .lt('created_at', range.endIso),
    supabase
      .from('payment_timeline_events')
      .select('metadata')
      .eq('user_id', userId)
      .eq('event_type', 'payment_executed')
      .gte('created_at', previousRange.startIso)
      .lt('created_at', previousRange.endIso)
  ]);

  if (currentResponse.error) {
    console.error('❌ Erreur insight category_growth (current):', currentResponse.error);
    return null;
  }
  if (previousResponse.error) {
    console.error('❌ Erreur insight category_growth (previous):', previousResponse.error);
    return null;
  }

  const currentTotals = summarizeCategories(currentResponse.data || []);
  const previousTotals = summarizeCategories(previousResponse.data || []);

  if (!currentTotals || !previousTotals) return null;

  const previousMap = new Map(
    previousTotals.map((entry) => [entry.category, entry.value])
  );

  let best = null;
  currentTotals.forEach((entry) => {
    const previousValue = previousMap.get(entry.category);
    if (!previousValue || previousValue <= 0) return;
    const delta = entry.value - previousValue;
    if (delta <= 0) return;
    const increasePct = (delta / previousValue) * 100;
    if (!best || increasePct > best.increasePct) {
      best = { ...entry, increasePct };
    }
  });

  if (!best) return null;

  const label = getCategoryLabel(best.category, locale);
  if (!label) return null;

  const message = fillTemplate(INSIGHT_COPY[locale].growth, {
    label,
    pct: Math.round(best.increasePct)
  });

  return {
    ...INSIGHTS.categoryGrowth,
    message
  };
};

const buildCategoryInsights = async ({ supabase, userId, monthKey, locale }) => {
  const resolvedLocale = resolveLocale(locale);
  const [distribution, unusedSubscriptions, growth] = await Promise.all([
    getCategoryDistributionInsight(supabase, userId, monthKey, resolvedLocale),
    getUnusedSubscriptionsInsight(supabase, userId, monthKey, resolvedLocale),
    getCategoryGrowthInsight(supabase, userId, monthKey, resolvedLocale)
  ]);

  return [distribution, unusedSubscriptions, growth].filter(Boolean);
};

module.exports = {
  buildCategoryInsights
};

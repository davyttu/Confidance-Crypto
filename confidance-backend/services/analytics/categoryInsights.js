const CATEGORY_LABELS_FR = {
  housing: 'Logement',
  salary: 'Salaire',
  subscription: 'Abonnement',
  utilities: 'Services publics',
  services: 'Services',
  transfer: 'Virement',
  other: 'Autre'
};

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

const getCategoryLabel = (category) => {
  const normalized = normalizeCategory(category);
  if (!normalized) return null;
  return CATEGORY_LABELS_FR[normalized] || 'Autre';
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

const getCategoryDistributionInsight = async (supabase, userId, monthKey) => {
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
  const firstLabel = getCategoryLabel(first.category);
  const secondLabel = getCategoryLabel(second.category);
  if (!firstLabel || !secondLabel) return null;

  const message = `Vos principales dépenses ce mois-ci concernent ${firstLabel} (${Math.round(first.percentage)} %) et ${secondLabel} (${Math.round(second.percentage)} %).`;

  return {
    ...INSIGHTS.categoryDistribution,
    message
  };
};

const getUnusedSubscriptionsInsight = async (supabase, userId, monthKey, inactivityMonths = 3) => {
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

  const label = inactiveCount > 1 ? 'abonnements' : 'abonnement';
  const message = `Vous avez ${inactiveCount} ${label} actifs sans interaction récente.`;

  return {
    ...INSIGHTS.unusedSubscriptions,
    message
  };
};

const getCategoryGrowthInsight = async (supabase, userId, monthKey) => {
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

  const label = getCategoryLabel(best.category);
  if (!label) return null;

  const message = `Les dépenses liées à ${label} ont augmenté de +${Math.round(best.increasePct)} % ce mois-ci.`;

  return {
    ...INSIGHTS.categoryGrowth,
    message
  };
};

const buildCategoryInsights = async ({ supabase, userId, monthKey }) => {
  const [distribution, unusedSubscriptions, growth] = await Promise.all([
    getCategoryDistributionInsight(supabase, userId, monthKey),
    getUnusedSubscriptionsInsight(supabase, userId, monthKey),
    getCategoryGrowthInsight(supabase, userId, monthKey)
  ]);

  return [distribution, unusedSubscriptions, growth].filter(Boolean);
};

module.exports = {
  buildCategoryInsights
};

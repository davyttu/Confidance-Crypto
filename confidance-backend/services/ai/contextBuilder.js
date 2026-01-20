const { createClient } = require('@supabase/supabase-js');
const { buildCategoryInsights } = require('../analytics/categoryInsights');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ALLOWED_METADATA_FIELDS = [
  'amount',
  'currency',
  'gas_fee',
  'protocol_fee',
  'payment_type',
  'category',
  'tx_hash',
  'frequency'
];

const getMonthKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const getMonthRange = (monthKey) => {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

const getPreviousMonthKey = (monthKey) => {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) return null;
  const prev = new Date(Date.UTC(year, month - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
};

const parseNumber = (value) => {
  const num = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isFinite(num) ? num : 0;
};

const filterMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return null;
  const filtered = Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) =>
      ALLOWED_METADATA_FIELDS.includes(key) && value !== undefined && value !== null
    )
  );
  return Object.keys(filtered).length > 0 ? filtered : null;
};

const mapBreakdown = (rows = []) => {
  return rows.reduce((acc, row) => {
    const monthKey = getMonthKey(row.month);
    if (!monthKey) return acc;
    if (!acc[monthKey]) {
      acc[monthKey] = {
        instant: { count: 0, volume: 0, avgFees: 0 },
        scheduled: { count: 0, volume: 0, avgFees: 0 },
        recurring: { count: 0, volume: 0, avgFees: 0 }
      };
    }
    const typeKey = row.payment_type || 'scheduled';
    const target = acc[monthKey][typeKey] || acc[monthKey].scheduled;
    acc[monthKey][typeKey] = {
      count: parseNumber(row.transactions_count),
      volume: parseNumber(row.total_volume),
      avgFees: parseNumber(row.avg_fees)
    };
    return acc;
  }, {});
};

const buildMonthlyStats = (row, breakdown) => {
  if (!row) return null;
  const monthKey = getMonthKey(row.month);
  if (!monthKey) return null;

  return {
    month: monthKey,
    transactionCount: parseNumber(row.transactions_count),
    totalVolume: parseNumber(row.total_volume),
    totalFees: parseNumber(row.total_fees),
    feeRatio: parseNumber(row.real_cost_percentage),
    gasFees: parseNumber(row.gas_fees_total),
    protocolFees: parseNumber(row.protocol_fees_total),
    breakdown: breakdown || {
      instant: { count: 0, volume: 0, avgFees: 0 },
      scheduled: { count: 0, volume: 0, avgFees: 0 },
      recurring: { count: 0, volume: 0, avgFees: 0 }
    }
  };
};

const computeMonthlyChanges = (current, previous) => {
  if (!current || !previous) return null;
  const pct = (currentValue, previousValue) => {
    if (!previousValue || previousValue === 0) return 0;
    return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
  };

  return {
    transactionCountPct: pct(current.transactionCount, previous.transactionCount),
    totalVolumePct: pct(current.totalVolume, previous.totalVolume),
    totalFeesPct: pct(current.totalFees, previous.totalFees),
    feeRatioDelta: Number((current.feeRatio - previous.feeRatio).toFixed(2))
  };
};

const fetchMonthlyData = async (userId, monthKey) => {
  const range = getMonthRange(monthKey);
  if (!range) return { stats: null, breakdown: null };

  const [analyticsResponse, breakdownResponse] = await Promise.all([
    supabase
      .from('monthly_payment_analytics_v1')
      .select('*')
      .eq('user_id', userId)
      .gte('month', range.startIso)
      .lt('month', range.endIso),
    supabase
      .from('monthly_payment_breakdown_v1')
      .select('*')
      .eq('user_id', userId)
      .gte('month', range.startIso)
      .lt('month', range.endIso)
  ]);

  if (analyticsResponse.error) {
    console.error('❌ [AdvisorContext] Erreur analytics view:', analyticsResponse.error);
  }
  if (breakdownResponse.error) {
    console.error('❌ [AdvisorContext] Erreur breakdown view:', breakdownResponse.error);
  }

  const breakdownMap = mapBreakdown(breakdownResponse.data || []);
  const row = (analyticsResponse.data || [])[0] || null;
  const breakdown = breakdownMap[monthKey] || null;
  return { stats: buildMonthlyStats(row, breakdown), breakdown };
};

const fetchTimelineEvents = async (userId, monthKey) => {
  const range = getMonthRange(monthKey);
  if (!range) return [];

  const { data, error } = await supabase
    .from('payment_timeline_events')
    .select('id, payment_id, event_type, event_label, actor_label, explanation, created_at, metadata')
    .eq('user_id', userId)
    .gte('created_at', range.startIso)
    .lt('created_at', range.endIso)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ [AdvisorContext] Erreur timeline:', error);
    return [];
  }

  return (data || []).map((event, index) => {
    const sourceId = `timeline:${event.id || event.payment_id || index + 1}`;
    return {
      sourceId,
      type: event.event_type,
      label: event.event_label,
      actor: event.actor_label || null,
      explanation: event.explanation || null,
      createdAt: event.created_at,
      metadata: filterMetadata(event.metadata)
    };
  });
};

async function buildAdvisorContext(userId, monthKey) {
  if (!userId) {
    throw new Error('userId requis');
  }

  const range = getMonthRange(monthKey);
  if (!range) {
    throw new Error('Format de mois invalide (YYYY-MM)');
  }

  const previousMonthKey = getPreviousMonthKey(monthKey);
  const [currentData, previousData, insights, timelineEvents] = await Promise.all([
    fetchMonthlyData(userId, monthKey),
    previousMonthKey ? fetchMonthlyData(userId, previousMonthKey) : { stats: null },
    buildCategoryInsights({ supabase, userId, monthKey }).catch((error) => {
      console.warn('⚠️ [AdvisorContext] Insights indisponibles:', error.message);
      return [];
    }),
    fetchTimelineEvents(userId, monthKey)
  ]);

  const current = currentData.stats;
  const previous = previousData.stats;
  const changes = computeMonthlyChanges(current, previous);

  const availableSources = [
    current ? `analytics:monthly:${monthKey}` : null,
    current ? `analytics:breakdown:${monthKey}` : null,
    previous ? `analytics:monthly:${previousMonthKey}` : null,
    previous ? `analytics:breakdown:${previousMonthKey}` : null,
    ...(Array.isArray(insights) ? insights.map((item) => `insight:${item.id}`) : []),
    ...timelineEvents.map((event) => event.sourceId)
  ].filter(Boolean);

  return {
    version: 'advisor_v1',
    userId,
    month: monthKey,
    analytics: {
      current,
      previous,
      changes
    },
    insights: Array.isArray(insights) ? insights : [],
    timeline: {
      eventCount: timelineEvents.length,
      events: timelineEvents
    },
    availableSources
  };
}

module.exports = {
  buildAdvisorContext
};

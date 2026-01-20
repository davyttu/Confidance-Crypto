const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const REQUIRED_FIELDS = [
  'payment_id',
  'user_id',
  'event_type',
  'event_label',
  'actor_type',
  'explanation'
];

async function addTimelineEvent(payload) {
  try {
    const missingFields = REQUIRED_FIELDS.filter((field) => !payload?.[field]);
    if (missingFields.length > 0) {
      return { success: false, error: 'missing_fields', details: missingFields };
    }

    const insertData = {
      payment_id: payload.payment_id,
      user_id: payload.user_id,
      event_type: payload.event_type,
      event_label: payload.event_label,
      actor_type: payload.actor_type,
      actor_label: payload.actor_label ?? null,
      explanation: payload.explanation,
      metadata: payload.metadata ?? null
    };

    const { data, error } = await supabase
      .from('payment_timeline_events')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: 'timeline_insert_failed' };
  }
}

module.exports = {
  addTimelineEvent
};

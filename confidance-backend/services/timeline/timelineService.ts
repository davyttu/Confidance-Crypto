import { createClient } from '@supabase/supabase-js';

type TimelineEventInput = {
  payment_id: string;
  user_id: string;
  event_type: string;
  event_label: string;
  actor_type: string;
  actor_label?: string | null;
  explanation: string;
  metadata?: Record<string, unknown> | null;
};

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

const REQUIRED_FIELDS: Array<keyof TimelineEventInput> = [
  'payment_id',
  'user_id',
  'event_type',
  'event_label',
  'actor_type',
  'explanation'
];

export async function addTimelineEvent(payload: TimelineEventInput) {
  try {
    const missingFields = REQUIRED_FIELDS.filter((field) => !payload[field]);
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

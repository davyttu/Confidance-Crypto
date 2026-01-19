import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const getAdminClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin credentials missing');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
};

const sanitizeText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 120);
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const language = sanitizeText(url.searchParams.get('lang'));
    if (!language) {
      return Response.json({ error: 'Missing language' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('voice_corrections')
      .select('from_text,to_text,usage_count')
      .eq('language', language)
      .order('usage_count', { ascending: false })
      .limit(200);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const language = sanitizeText(payload?.language);
    const fromText = sanitizeText(payload?.from_text).toLowerCase();
    const toText = sanitizeText(payload?.to_text).toLowerCase();

    if (!language || !fromText || !toText) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: existing, error: fetchError } = await supabase
      .from('voice_corrections')
      .select('id,usage_count')
      .eq('language', language)
      .eq('from_text', fromText)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 500 });
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('voice_corrections')
        .update({
          to_text: toText,
          usage_count: (existing.usage_count || 0) + 1,
        })
        .eq('id', existing.id);

      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 });
      }

      return Response.json({ ok: true, updated: true });
    }

    const { error: insertError } = await supabase
      .from('voice_corrections')
      .insert([
        {
          language,
          from_text: fromText,
          to_text: toText,
          usage_count: 1,
        },
      ]);

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json({ ok: true, created: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

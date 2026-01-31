import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const getClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
};

/** Voix Marilyn : shimmer (chaleureuse, fluide). */
const TTS_VOICE = 'shimmer' as const;
const TTS_MODEL = 'tts-1';
const TTS_SPEED = 0.9;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'Missing or empty text' }, { status: 400 });
    }
    if (text.length > 4096) {
      return NextResponse.json({ error: 'Text too long' }, { status: 400 });
    }

    const openai = getClient();
    const response = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text,
      response_format: 'mp3',
      speed: TTS_SPEED,
    });

    const blob = await response.blob();
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    const message = (error as Error)?.message ?? 'TTS failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

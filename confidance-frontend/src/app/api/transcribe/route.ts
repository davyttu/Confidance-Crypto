import { transcribeAudio } from '@/lib/whisper';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return Response.json({ error: 'Missing audio file' }, { status: 400 });
    }

    const text = await transcribeAudio(file);
    return Response.json({ text });
  } catch (error) {
    const message = (error as Error)?.message || 'Failed to transcribe audio';
    return Response.json({ error: message }, { status: 500 });
  }
}

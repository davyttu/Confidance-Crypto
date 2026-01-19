import OpenAI from 'openai';

let client: OpenAI | null = null;

const getClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
};

export const transcribeAudio = async (file: File): Promise<string> => {
  if (!file) {
    throw new Error('Audio file is required');
  }

  const openai = getClient();
  const response = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
  });

  return response.text ?? '';
};

const axios = require('axios');

const ADVISOR_WEBHOOK_URL = process.env.ADVISOR_WEBHOOK_URL;
const API_KEY = process.env.N8N_API_KEY;

const INSUFFICIENT_RESPONSE = {
  answer: 'I cannot determine this from the available data.',
  sources: []
};

const SYSTEM_PROMPT = `
Tu es l'IA Conseillère Confidance (lecture seule).
Règles strictes :
- Explique uniquement ce qui est présent dans le contexte fourni.
- Aucune action, aucune recommandation d'exécution, aucune décision automatique.
- Pas de jargon blockchain, langage humain et neutre.
- Réponse courte (max 6-8 lignes).
- Toujours traçable : inclure des sources issues de "availableSources".
- Si l'information est insuffisante, renvoyer exactement :
  { "answer": "I cannot determine this from the available data.", "sources": [] }
Format de réponse UNIQUE (JSON) :
{
  "answer": "string",
  "sources": ["timeline:...", "analytics:..."],
  "confidence": "high|medium|low"
}
`.trim();

const limitLines = (text, maxLines) => {
  const lines = String(text || '').split(/\r?\n/);
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n');
};

const normalizeResponse = (raw, context) => {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return INSUFFICIENT_RESPONSE;
    }
  }

  const answer = typeof data?.answer === 'string' ? data.answer.trim() : '';
  if (!answer) return INSUFFICIENT_RESPONSE;
  if (answer === INSUFFICIENT_RESPONSE.answer) return INSUFFICIENT_RESPONSE;

  const availableSources = Array.isArray(context?.availableSources)
    ? context.availableSources
    : [];
  let sources = Array.isArray(data?.sources) ? data.sources : [];
  sources = sources.filter((source) => typeof source === 'string');
  if (availableSources.length > 0) {
    sources = sources.filter((source) => availableSources.includes(source));
  }

  if (sources.length === 0) return INSUFFICIENT_RESPONSE;

  const confidence = ['high', 'medium', 'low'].includes(data?.confidence)
    ? data.confidence
    : 'medium';

  return {
    answer: limitLines(answer, 8),
    sources,
    confidence
  };
};

async function explainQuestion(context, question) {
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    throw new Error('Question requise');
  }

  const hasData =
    context?.analytics?.current ||
    (context?.timeline?.eventCount || 0) > 0 ||
    (context?.insights?.length || 0) > 0;

  if (!hasData) {
    return INSUFFICIENT_RESPONSE;
  }

  if (!ADVISOR_WEBHOOK_URL) {
    throw new Error('ADVISOR_WEBHOOK_URL manquant');
  }

  const payload = {
    systemPrompt: SYSTEM_PROMPT,
    question: question.trim(),
    context
  };

  const response = await axios.post(ADVISOR_WEBHOOK_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'X-Event-API-Key': API_KEY } : {})
    },
    timeout: 15000
  });

  return normalizeResponse(response?.data, context);
}

module.exports = {
  explainQuestion
};

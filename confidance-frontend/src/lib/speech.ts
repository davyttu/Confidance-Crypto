/**
 * Voix partagée Confidance / Marilyn (conseillère chat)
 * -----------------------------------------------
 * OpenAI TTS en priorité (/api/tts), repli SpeechSynthesis si indisponible.
 * Même configuration pour :
 * - la commande vocale paiement (PaymentForm),
 * - Marilyn la conseillère chat (lecture à voix haute des réponses).
 *
 * Réglages pour fluidité et rendu naturel :
 * - rate 0.82 : débit un peu plus lent, moins robotique
 * - pitch 1.0 : ton neutre/chaleureux
 * - Sélection de la voix la plus « naturelle » selon la langue (natural, premium, Google…)
 *
 * Limite navigateur : l’API SpeechSynthesis n’a pas de vrai contrôle de l’intonation.
 * Pour une voix parfaite type Marilyn plus tard : brancher un TTS cloud (ElevenLabs,
 * Azure Neural, Google Cloud TTS) en gardant la même interface speakWithMarilynVoice().
 */

export const MARILYN_VOICE_CONFIG = {
  /** Débit plus lent = plus fluide, moins robotique (0.1–10, 1 = normal) */
  rate: 0.82,
  /** Légèrement au-dessus du neutre pour un ton chaleureux (0–2, 1 = normal) */
  pitch: 1.0,
  volume: 1,
} as const;

/**
 * Choisit la voix la plus naturelle disponible pour la langue.
 * Priorité : natural, premium, Google, puis exclusion des voix "compact" / synthétiques.
 */
export function getPreferredVoice(
  langCode: string,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const lang = langCode.split('-')[0].toLowerCase();
  const forLang = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  if (forLang.length === 0) return voices.find((v) => v.lang.startsWith(lang)) ?? null;

  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (n.includes('natural') || n.includes('premium')) s += 3;
    if (n.includes('google') || n.includes('microsoft hortense') || n.includes('samantha')) s += 2;
    if (n.includes('female') || n.includes('woman')) s += 1;
    if (n.includes('compact') || n.includes('enhanced') && !n.includes('natural')) s -= 2;
    return s;
  };

  forLang.sort((a, b) => score(b) - score(a));
  return forLang[0] ?? null;
}

/**
 * Joue l'audio via OpenAI TTS ; en cas d'échec utilise SpeechSynthesis.
 */
function speakWithBrowserFallback(message: string, lang: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = lang;
  utterance.rate = MARILYN_VOICE_CONFIG.rate;
  utterance.pitch = MARILYN_VOICE_CONFIG.pitch;
  utterance.volume = MARILYN_VOICE_CONFIG.volume;

  const voices = window.speechSynthesis.getVoices();
  const preferred = getPreferredVoice(lang, voices);
  if (preferred) utterance.voice = preferred;

  utterance.onend = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

/**
 * Fait parler le texte avec la voix Marilyn (OpenAI TTS, puis repli navigateur).
 * À utiliser pour la commande vocale paiement et pour Marilyn la conseillère chat.
 */
export function speakWithMarilynVoice(
  message: string,
  lang: string,
  onEnd?: () => void
): void {
  if (typeof window === 'undefined') {
    onEnd?.();
    return;
  }
  if (!message?.trim()) {
    onEnd?.();
    return;
  }

  const done = () => {
    if (url) URL.revokeObjectURL(url);
    onEnd?.();
  };

  let url: string | null = null;

  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message.trim(), lang }),
  })
    .then((res) => {
      if (!res.ok) throw new Error('TTS request failed');
      return res.blob();
    })
    .then((blob) => {
      url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = done;
      audio.onerror = () => {
        if (url) URL.revokeObjectURL(url);
        speakWithBrowserFallback(message, lang, onEnd);
      };
      audio.play().catch(() => {
        if (url) URL.revokeObjectURL(url);
        speakWithBrowserFallback(message, lang, onEnd);
      });
    })
    .catch(() => {
      speakWithBrowserFallback(message, lang, onEnd);
    });
}

/**
 * Charge les voix si nécessaire (Chrome les charge après voiceschanged).
 * À appeler au montage si on veut que le premier speak utilise la bonne voix.
 */
export function ensureVoicesLoaded(cb?: () => void): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cb?.();
    return;
  }
  window.speechSynthesis.addEventListener('voiceschanged', () => cb?.(), { once: true });
}

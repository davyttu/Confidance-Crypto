'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { type TokenSymbol, getToken, getProtocolFeeBps } from '@/config/tokens';
import CurrencySelector from './CurrencySelector';
import DateTimePicker from './DateTimePicker';
import FeeDisplay from './FeeDisplay';
import PaymentProgressModal from './PaymentProgressModal';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useCreatePayment } from '@/hooks/useCreatePayment';
import { useCreateBatchPayment } from '@/hooks/useCreateBatchPayment';
import { useCreateRecurringPayment } from '@/hooks/useCreateRecurringPayment';
import { useCreateBatchRecurringPayment } from '@/hooks/useCreateBatchRecurringPayment';
import { useAuth } from '@/contexts/AuthContext';
import { type PaymentCategory } from '@/types/payment-identity';
import { useSuggestedCategory } from '@/hooks/useCategorySuggestion';
import PaymentIdentitySection from '@/components/payment/PaymentIdentitySection';

interface PaymentFormData {
  tokenSymbol: TokenSymbol;
  beneficiary: string;
  amount: string;
  releaseDate: Date | null;
  label: string;
  category: PaymentCategory;
}

type PaymentTiming = 'instant' | 'scheduled' | 'recurring';

interface BeneficiaryHistoryItem {
  address: string;
  name?: string;
}

export default function PaymentForm() {
  const { t, ready: translationsReady, i18n } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceParsedAmount, setVoiceParsedAmount] = useState('');
  const [voiceHint, setVoiceHint] = useState('');
  const [voiceCorrections, setVoiceCorrections] = useState<Record<string, string>>({});
  const [showVoiceCorrection, setShowVoiceCorrection] = useState(false);
  const [voiceCorrectionFrom, setVoiceCorrectionFrom] = useState('');
  const [voiceCorrectionTo, setVoiceCorrectionTo] = useState('');
  const [lastVoiceCorrection, setLastVoiceCorrection] = useState<string>('');
  const [voiceLanguage, setVoiceLanguage] = useState<string>('');
  const [voiceCommandMode, setVoiceCommandMode] = useState(false);
  const [voiceAwaitingConfirm, setVoiceAwaitingConfirm] = useState(false);
  const [voiceAwaitingDate, setVoiceAwaitingDate] = useState(false);
  const [voiceCommandSummary, setVoiceCommandSummary] = useState('');
  const [useWhisper, setUseWhisper] = useState(true);
  const [isWhisperSupported, setIsWhisperSupported] = useState(false);
  const [isWhisperRecording, setIsWhisperRecording] = useState(false);
  const [voiceHelpShown, setVoiceHelpShown] = useState(false);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const whisperTimeoutRef = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const voiceIdleTimeoutRef = useRef<number | null>(null);
  const pendingVoiceCommandRef = useRef<ReturnType<typeof parseVoiceCommand> | null>(null);
  const lastVoiceRef = useRef<{
    amount?: string;
    meta: { decimalDigits: number; hasDecimal: boolean };
    token?: TokenSymbol;
    transcript: string;
    at: number;
  }>({ meta: { decimalDigits: 0, hasDecimal: false }, transcript: '', at: 0 });
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
  const walletConnected = Boolean(address);
  const { user } = useAuth();
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const translate = (
    key: string,
    defaultValue: string,
    options?: Record<string, string | number>
  ) => (translationsReady ? t(key, { defaultValue, ...(options || {}) }) : defaultValue);

  const locale = (() => {
    const language = i18n?.language?.toLowerCase() || 'en';
    const base = language.split('-')[0];
    switch (base) {
      case 'fr':
        return 'fr-FR';
      case 'es':
        return 'es-ES';
      case 'ru':
        return 'ru-RU';
      case 'zh':
        return 'zh-CN';
      default:
        return 'en-US';
    }
  })();
  const languageKey = (i18n?.language?.toLowerCase() || 'en').split('-')[0];
  const voiceStorageKey = `voiceCorrections.${languageKey}`;
  const voiceLanguageStorageKey = 'voiceRecognitionLang';
  const voiceLanguageOptions = ['fr-FR', 'en-US', 'es-ES', 'ru-RU', 'zh-CN'];

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const normalizeVoiceText = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/’/g, "'")
      .replace(/[^a-z0-9'\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const syncVoiceBeneficiaries = () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('beneficiaryHistory');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => {
              if (typeof item === 'string') {
                return { address: item };
              }
              if (item && typeof item === 'object' && typeof item.address === 'string') {
                return { address: item.address, name: item.name };
              }
              return null;
            })
            .filter((item): item is BeneficiaryHistoryItem => Boolean(item));
          if (normalized.length > 0) {
            setBeneficiaryHistory(normalized);
          }
        }
      }
      const storedFavorites = localStorage.getItem('beneficiaryFavorites');
      if (storedFavorites) {
        const parsedFavorites = JSON.parse(storedFavorites);
        if (Array.isArray(parsedFavorites)) {
          setFavoriteAddresses(parsedFavorites.filter((item) => typeof item === 'string'));
        }
      }
    } catch {
      // ignore storage failures
    }
  };

  const applyCorrections = (text: string, corrections = voiceCorrections) => {
    let output = text;
    Object.entries(corrections).forEach(([from, to]) => {
      if (!from || !to) return;
      if (from.includes(' ')) {
        const pattern = new RegExp(escapeRegExp(from), 'gi');
        output = output.replace(pattern, to);
      } else {
        const pattern = new RegExp(`\\b${escapeRegExp(from)}\\b`, 'gi');
        output = output.replace(pattern, to);
      }
    });
    return output;
  };

  const speak = (message: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = voiceLanguage || locale;
    utterance.rate = 0.95;
    utterance.onend = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
  };

  const startWhisperCapture = async () => {
    if (isWhisperRecording || typeof window === 'undefined') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        setIsWhisperRecording(false);
        try {
          const formData = new FormData();
          formData.append('file', blob, 'voice.webm');
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) {
            throw new Error('Transcription failed');
          }
          const payload = await response.json();
          const text = String(payload?.text || '').trim();
          if (text) {
            handleVoiceCommandTranscript(text);
          }
        } catch (error) {
          setVoiceHint(
            translate(
              'create.voice.whisperError',
              'Impossible de transcrire l’audio. Vérifiez votre connexion.'
            )
          );
        }
      };

      recorder.start();
      setIsWhisperRecording(true);
      whisperTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, 6000);
      mediaRecorderRef.current = recorder;
    } catch {
      setVoiceHint(
        translate(
          'create.voice.whisperError',
          'Impossible d’accéder au micro. Vérifiez les permissions.'
        )
      );
    }
  };

  const extractNumber = (text: string): number | undefined => {
    const normalized = replaceNumberWords(applyCorrections(text));
    const match = normalized.match(/\b(\d+)\b/);
    if (!match) return undefined;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : undefined;
  };

  const parseDateFromVoice = (text: string): Date | null => {
    const normalized = applyCorrections(text)
      .toLowerCase()
      .replace(/’/g, "'")
      .replace(/é/g, 'e');

    const now = new Date();
    if (normalized.includes('apres-demain') || normalized.includes('après-demain')) {
      const date = new Date(now);
      date.setDate(now.getDate() + 2);
      date.setHours(12, 0, 0, 0);
      return date;
    }
    if (normalized.includes('demain')) {
      const date = new Date(now);
      date.setDate(now.getDate() + 1);
      date.setHours(12, 0, 0, 0);
      return date;
    }

    const monthMap: Record<string, number> = {
      janvier: 0,
      fevrier: 1,
      fevrier: 1,
      mars: 2,
      avril: 3,
      mai: 4,
      juin: 5,
      juillet: 6,
      aout: 7,
      septembre: 8,
      octobre: 9,
      novembre: 10,
      decembre: 11,
    };

    const numericMatch = normalized.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    let day: number | undefined;
    let month: number | undefined;
    let year: number | undefined;

    if (numericMatch) {
      day = Number(numericMatch[1]);
      month = Number(numericMatch[2]) - 1;
      year = numericMatch[3] ? Number(numericMatch[3]) : undefined;
    } else {
      const monthMatch = normalized.match(/(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)/);
      if (monthMatch) {
        day = Number(monthMatch[1]);
        month = monthMap[monthMatch[2]];
        const yearMatch = normalized.match(/\b(20\d{2})\b/);
        if (yearMatch) year = Number(yearMatch[1]);
      }
    }

    if (day !== undefined && month !== undefined) {
      const targetYear = year || now.getFullYear();
      const date = new Date(targetYear, month, day, 12, 0, 0, 0);
      if (!year && date < now) {
        date.setFullYear(targetYear + 1);
      }

      const timeMatch = normalized.match(/(\d{1,2})\s*h(?:\s*(\d{1,2}))?/);
      const timeAltMatch = normalized.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const hour = Number(timeMatch[1]);
        const minutes = timeMatch[2] ? Number(timeMatch[2]) : 0;
        date.setHours(hour, minutes, 0, 0);
      } else if (timeAltMatch) {
        date.setHours(Number(timeAltMatch[1]), Number(timeAltMatch[2]), 0, 0);
      }
      return date;
    }

    return null;
  };

  const detectTokenFromTranscript = (text: string): TokenSymbol | undefined => {
    const normalized = applyCorrections(text)
      .toLowerCase()
      .replace(/’/g, "'")
      .replace(/é/g, 'e')
      .replace(/\barsenal team\b/g, 'centime')
      .replace(/\bdetergent\b/g, 'ether')
      .replace(/\b(u s d c|usd c)\b/g, 'usdc')
      .replace(/\b(u s d t|usd t)\b/g, 'usdt')
      .replace(/[^a-z0-9']+/g, ' ');
    const words = normalized
      .split(/\s+/)
      .map((word) => word.replace(/^d'/, ''))
      .filter(Boolean);

    if (words.some((word) => word === 'ethereum' || word === 'ether' || word === 'eth' || word === 'ethere' || word === 'eather')) {
      return 'ETH';
    }
    if (words.some((word) => word === 'usdc')) return 'USDC';
    if (words.some((word) => word === 'usdt' || word === 'tether')) return 'USDT';

    if (words.some((word) => word === 'detector')) {
      if (words.some((word) => word.includes('usd'))) return 'USDC';
      return undefined;
    }
    return undefined;
  };

  const replaceNumberWords = (text: string): string => {
    const mappings: Array<[string, string]> = [
      // fr
      ...[
        ['zéro', '0'], ['zero', '0'], ['un', '1'], ['une', '1'], ['uhn', '1'], ['hun', '1'], ['um', '1'], ['huh', '1'],
        ['deux', '2'], ['de', '2'], ['du', '2'], ['deuh', '2'], ['doux', '2'],
        ['trois', '3'], ['hein', '1'],
        ['quatre', '4'], ['cinq', '5'], ['six', '6'], ['sept', '7'], ['huit', '8'], ['neuf', '9'],
        ['dix', '10'], ['onze', '11'], ['douze', '12'], ['treize', '13'], ['quatorze', '14'],
        ['quinze', '15'], ['seize', '16'], ['vingt', '20'], ['trente', '30'], ['quarante', '40'],
        ['cinquante', '50'], ['soixante', '60'], ['soixante-dix', '70'], ['quatre-vingt', '80'],
        ['quatre-vingt-dix', '90'],
      ],
      // en
      ...[
        ['zero', '0'], ['one', '1'], ['two', '2'], ['three', '3'], ['four', '4'], ['five', '5'],
        ['sank', '5'], ['sink', '5'], ['suck', '5'], ['search', '5'],
        ['do', '2'], ['too', '2'], ['to', '2'],
        ['what', '3'],
        ['cat', '4'], ['get', '4'],
        ['cinque', '5'],
        ['see', '6'],
        ['set', '7'],
        ['six', '6'], ['seven', '7'], ['eight', '8'], ['nine', '9'], ['ten', '10'], ['eleven', '11'],
        ['twelve', '12'], ['thirteen', '13'], ['fourteen', '14'], ['fifteen', '15'], ['sixteen', '16'],
        ['seventeen', '17'], ['eighteen', '18'], ['nineteen', '19'], ['twenty', '20'], ['thirty', '30'],
        ['forty', '40'], ['fifty', '50'], ['sixty', '60'], ['seventy', '70'], ['eighty', '80'], ['ninety', '90'],
      ],
      // es
      ...[
        ['cero', '0'], ['uno', '1'], ['una', '1'], ['dos', '2'], ['tres', '3'], ['cuatro', '4'],
        ['cinco', '5'], ['seis', '6'], ['siete', '7'], ['ocho', '8'], ['nueve', '9'], ['diez', '10'],
        ['once', '11'], ['doce', '12'], ['trece', '13'], ['catorce', '14'], ['quince', '15'],
        ['dieciséis', '16'], ['dieciseis', '16'], ['diecisiete', '17'], ['dieciocho', '18'], ['diecinueve', '19'],
        ['veinte', '20'], ['treinta', '30'], ['cuarenta', '40'], ['cincuenta', '50'], ['sesenta', '60'],
        ['setenta', '70'], ['ochenta', '80'], ['noventa', '90'],
      ],
      // ru
      ...[
        ['ноль', '0'], ['один', '1'], ['два', '2'], ['три', '3'], ['четыре', '4'], ['пять', '5'],
        ['шесть', '6'], ['семь', '7'], ['восемь', '8'], ['девять', '9'], ['десять', '10'],
        ['одиннадцать', '11'], ['двенадцать', '12'], ['тринадцать', '13'], ['четырнадцать', '14'],
        ['пятнадцать', '15'], ['шестнадцать', '16'], ['семнадцать', '17'], ['восемнадцать', '18'],
        ['девятнадцать', '19'], ['двадцать', '20'], ['тридцать', '30'], ['сорок', '40'],
        ['пятьдесят', '50'], ['шестьдесят', '60'], ['семьдесят', '70'], ['восемьдесят', '80'], ['девяносто', '90'],
      ],
    ];

    let out = text;
    mappings.forEach(([word, value]) => {
      const pattern = new RegExp(`\\b${word}\\b`, 'gi');
      out = out.replace(pattern, value);
    });
    return out;
  };

  const extractAmountFromTranscript = (text: string): { amount?: string; decimalDigits: number; hasDecimal: boolean } => {
    const normalized = applyCorrections(text)
      .toLowerCase()
      .replace(/,/g, '.')
      .replace(/\b(virgule|virgil|vehicle|value|point|dot|decimal|comma|coma|punto|точка|点)\b/g, '.')
      .replace(/\barsenal team\b/g, 'centime')
      .replace(/\badd saltine\b/g, 'centime')
      .replace(/\bsaltine\b/g, 'centime')
      .replace(/\bsalty\b/g, 'centime')
      .replace(/\bsomething\b/g, 'centime')
      .replace(/\bcancel\b/g, 'centime')
      .replace(/\bsome team\b/g, 'centime')
      .replace(/\bturn to do\b/g, 'trente deux')
      .replace(/\bturn to\b/g, 'trente')
      .replace(/\btalk to the\b/g, 'trente trois');

    const centsMatch = normalized.match(/\b(centime|centimes|cent|cents)\b/);
    if (centsMatch) {
      const replaced = replaceNumberWords(normalized);
      const numberMatches = replaced.match(/\b(\d+)\b/g) || [];
      let centsValue = 1;
      if (numberMatches.length > 0) {
        const last = Number(numberMatches[numberMatches.length - 1]);
        const prev = numberMatches.length > 1 ? Number(numberMatches[numberMatches.length - 2]) : NaN;
        if (!Number.isNaN(prev) && prev % 10 === 0) {
          centsValue = prev + last;
        } else if (!Number.isNaN(last)) {
          centsValue = last;
        }
      }
      if (!Number.isNaN(centsValue) && centsValue > 0) {
        const amount = (centsValue / 100).toFixed(2);
        return { amount, decimalDigits: 2, hasDecimal: true };
      }
    }
    const replaced = replaceNumberWords(normalized)
      .replace(/\b(and|et|y|e|и)\b/g, ' ')
      .replace(/\s*\.\s*/g, '.')
      .replace(/\s+/g, ' ')
      .trim();
    const combinedTens = replaced.replace(/\b(\d+)\s+(\d)\b/g, (full, tens, unit) => {
      if (tens.endsWith('0')) {
        return String(Number(tens) + Number(unit));
      }
      return full;
    });
    const decimalMatch = combinedTens.match(/(\d+)\.(.+)/);
    if (decimalMatch) {
      const left = decimalMatch[1];
      const rightDigits = decimalMatch[2].replace(/[^\d]/g, '');
      if (rightDigits.length > 0) {
        return { amount: `${left}.${rightDigits}`, decimalDigits: rightDigits.length, hasDecimal: true };
      }
    }
    const match = combinedTens.match(/(\d+(?:\.\d+)?)/);
    if (match?.[1]) {
      const parts = match[1].split('.');
      return {
        amount: match[1],
        decimalDigits: parts[1]?.length || 0,
        hasDecimal: match[1].includes('.'),
      };
    }
    return { amount: undefined, decimalDigits: 0, hasDecimal: false };
  };

  const extractSingleDigit = (text: string): string | undefined => {
    const normalized = replaceNumberWords(
      applyCorrections(text)
        .toLowerCase()
        .replace(/,/g, '.')
        .replace(/\b(virgule|virgil|vehicle|value|point|dot|decimal|comma|coma|punto|точка|点)\b/g, '.')
    );
    const digitMatch = normalized.match(/\b(\d)\b/);
    return digitMatch?.[1];
  };

  const getBeneficiaryFromVoice = (text: string) => {
    const lower = normalizeVoiceText(applyCorrections(text));
    if (lower.includes('favori') || lower.includes('favorite')) {
      const address = favoriteAddresses[0];
      if (address) return { address, label: 'favori' };
    }

    const match = lower.match(/(?:envoyer|envoye|envoie|mets|met|dis|dites)\s+a\s+(.+)/);
    const rawName = match?.[1]?.split(/(\d|\beth\b|\busdc\b|\busdt\b|paiement|instant|program)/)[0]?.trim();
    if (rawName) {
      const candidate = beneficiaryHistory.find((item) => {
        if (!item.name) return false;
        const name = normalizeVoiceText(item.name);
        return name === rawName || name.includes(rawName) || rawName.includes(name);
      });
      if (candidate?.address) {
        return { address: candidate.address, label: candidate.name || rawName };
      }
      if (favoriteAddresses.length >= 1) {
        return { address: favoriteAddresses[0], label: rawName };
      }
    }

    const directMatch = lower.match(/(?:^|\s)a\s+([a-z0-9]+)\b/);
    const directName = directMatch?.[1]?.trim();
    if (directName) {
      const candidate = beneficiaryHistory.find((item) => {
        if (!item.name) return false;
        const name = normalizeVoiceText(item.name);
        return name === directName || name.includes(directName) || directName.includes(name);
      });
      if (candidate?.address) {
        return { address: candidate.address, label: candidate.name || directName };
      }
      if (favoriteAddresses.length === 1) {
        return { address: favoriteAddresses[0], label: directName };
      }
    }

    const foundByName = beneficiaryHistory.find((item) => {
      if (!item.name) return false;
      const name = normalizeVoiceText(item.name);
      return name && lower.includes(name);
    });
    if (foundByName?.address) {
      return { address: foundByName.address, label: foundByName.name || 'beneficiaire' };
    }
    return null;
  };

  const parseVoiceCommand = (text: string) => {
    const normalized = normalizeVoiceText(applyCorrections(text));
    const timing = normalized.includes('recurrent') || normalized.includes('recurr')
      ? 'recurring'
      : normalized.includes('instant')
        ? 'instant'
        : normalized.includes('program') || normalized.includes('programme')
          ? 'scheduled'
          : paymentTiming;
    const cancellable =
      normalized.includes('non annulable') ||
      normalized.includes('irrevocable') ||
      normalized.includes('irrévocable')
        ? false
        : true;
    const amountInfo = extractAmountFromTranscript(normalized);
    const fallbackDigit = amountInfo.amount ? undefined : extractSingleDigit(normalized);
    const amount = amountInfo.amount || fallbackDigit;
    const token = detectTokenFromTranscript(normalized) || formData.tokenSymbol;
    const beneficiary = getBeneficiaryFromVoice(normalized);
    const months = normalized.includes('mois') || normalized.includes('months')
      ? extractNumber(normalized)
      : undefined;
    const date = parseDateFromVoice(normalized);
    return { timing, cancellable, amount, token, beneficiary, months, date };
  };

  const handleVoiceCommandTranscript = (rawText: string) => {
    const bestText = applyCorrections(rawText, voiceCorrections);
    setVoiceTranscript(bestText);
    const normalized = bestText.toLowerCase();
    const normalizedTrimmed = normalized.replace(/\s+/g, ' ').trim();
    if (normalizedTrimmed === 'je vous ecoute' || normalizedTrimmed === 'je vous écoute') {
      return;
    }

    if (voiceAwaitingConfirm) {
      if (normalized.includes('oui') || normalized.includes('yes') || normalized.includes('ok')) {
        setVoiceAwaitingConfirm(false);
        setVoiceCommandMode(false);
        setVoiceHelpShown(false);
        speak(
          translate('create.voice.confirmed', 'Confirmation reçue. Ouverture de MetaMask.'),
          () => {
            formRef.current?.requestSubmit();
          }
        );
        return;
      }
      if (normalized.includes('non') || normalized.includes('no') || normalized.includes('annuler')) {
        setVoiceAwaitingConfirm(false);
        setVoiceCommandMode(false);
        setVoiceHelpShown(false);
        speak(translate('create.voice.cancelled', 'D\'accord, j\'annule.'));
        return;
      }
    }

    if (voiceAwaitingDate) {
      const pending = pendingVoiceCommandRef.current;
      const date = parseDateFromVoice(bestText);
      if (pending && date) {
        pending.date = date;
        setVoiceAwaitingDate(false);
        pendingVoiceCommandRef.current = pending;
      } else {
        speak(
          translate('create.voice.needDate', 'Je n\'ai pas compris la date. Dites par exemple "12 septembre".'),
          () => {
            if (useWhisper && isWhisperSupported) {
              startWhisperCapture();
            } else {
              recognitionRef.current?.start?.();
            }
          }
        );
        return;
      }
    }

    const command = parseVoiceCommand(bestText);
    if (voiceAwaitingDate && pendingVoiceCommandRef.current) {
      return;
    }

    const cleanedText = bestText.replace(/je vous ecoute|je vous écoute/gi, '').trim();
    handlePaymentTimingChange(command.timing as PaymentTiming);
    setCancellable(command.cancellable);
    if (command.months && command.timing === 'recurring') {
      setRecurringMonths(command.months);
    }
    if (command.beneficiary?.address) {
      setFormData((prev) => ({
        ...prev,
        beneficiary: command.beneficiary?.address || prev.beneficiary,
      }));
      setErrors((prev) => ({ ...prev, beneficiary: '' }));
    }
    if (command.date) {
      handleDateChange(command.date);
    }
    if ((command.timing === 'scheduled' || command.timing === 'recurring') && !command.date) {
      pendingVoiceCommandRef.current = command;
      setVoiceAwaitingDate(true);
      speak(translate('create.voice.askDate', 'Quelle date pour le premier paiement ?'));
      return;
    }
    if (!command.beneficiary?.address || !command.amount) {
      if (cleanedText && cleanedText !== bestText) {
        const retryCommand = parseVoiceCommand(cleanedText);
        if (retryCommand.amount || retryCommand.beneficiary?.address) {
          pendingVoiceCommandRef.current = retryCommand;
          setVoiceAwaitingConfirm(false);
          setVoiceAwaitingDate(false);
          const fallbackSummary = `J\'ai compris ${retryCommand.beneficiary?.label ? `le bénéficiaire ${retryCommand.beneficiary.label}` : 'le bénéficiaire'}${retryCommand.amount ? `, montant ${retryCommand.amount} ${retryCommand.token}` : ''}. Continuez.`;
          speak(fallbackSummary, () => {
            if (useWhisper && isWhisperSupported) {
              startWhisperCapture();
            } else {
              recognitionRef.current?.start?.();
            }
          });
          return;
        }
      }
      if (!voiceHelpShown) {
        setVoiceHelpShown(true);
        speak(
          translate(
            'create.voice.help',
            'Dites par exemple : "envoyer à Ali 3 usdc paiement instantané".'
          )
        );
      }
      return;
    }

    if (command.amount) {
      setFormData((prev) => ({
        ...prev,
        amount: command.amount as string,
        tokenSymbol: command.token as TokenSymbol,
      }));
    }

    if (command.amount) {
      setErrors((prev) => ({ ...prev, amount: '' }));
    }

    const summary = `Je vais envoyer ${command.amount || ''} ${command.token} à ${command.beneficiary?.label || 'le bénéficiaire'} en paiement ${
      command.timing === 'instant' ? 'instantané' : command.timing === 'scheduled' ? 'programmé' : 'récurrent'
    }${command.timing === 'recurring' && command.months ? ` pour ${command.months} mois` : ''}${
      command.date ? `, première date ${command.date.toLocaleDateString(locale)}` : ''
    }${command.cancellable ? ', annulable' : ', non annulable'}. Dites oui pour confirmer.`;
    setVoiceCommandSummary(summary);
    setVoiceAwaitingConfirm(true);
    recognitionRef.current?.stop?.();
    speak(summary);
  };

  const handleReconnectWallet = () => {
    disconnect();
    if (openConnectModal) {
      setTimeout(() => openConnectModal(), 50);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let tabPressed = false;
    const triggerVoice = () => {
      amountInputRef.current?.focus();
      if (!isVoiceSupported) return;
      if (isListening) {
        recognitionRef.current?.stop?.();
        return;
      }
      setErrors((prev) => ({ ...prev, amount: '' }));
      try {
        recognitionRef.current?.start?.();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === 'tab') {
        event.preventDefault();
        tabPressed = true;
        amountInputRef.current?.focus();
        return;
      }

      if (key === 'enter' && tabPressed) {
        event.preventDefault();
        triggerVoice();
        return;
      }

      if (event.altKey && key === 'm') {
        event.preventDefault();
        triggerVoice();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'tab') {
        tabPressed = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [isListening, isVoiceSupported]);

  useEffect(() => {
    const handleVoiceStart = () => {
      setVoiceCommandMode(true);
      setVoiceAwaitingConfirm(false);
      setVoiceCommandSummary('');
      setVoiceHelpShown(false);
      setErrors((prev) => ({ ...prev, amount: '', beneficiary: '' }));
      syncVoiceBeneficiaries();
      try {
        recognitionRef.current?.stop?.();
        speak(translate('create.voice.start', 'Je vous écoute.'), () => {
          try {
            if (useWhisper && isWhisperSupported) {
              startWhisperCapture();
            } else {
              recognitionRef.current?.start?.();
              setIsListening(true);
            }
          } catch {
            setIsListening(false);
          }
        });
        if (voiceIdleTimeoutRef.current) {
          window.clearTimeout(voiceIdleTimeoutRef.current);
        }
        voiceIdleTimeoutRef.current = window.setTimeout(() => {
          setVoiceCommandMode(false);
          setVoiceAwaitingConfirm(false);
          setVoiceAwaitingDate(false);
          setIsListening(false);
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          recognitionRef.current?.stop?.();
          speak(translate('create.voice.timeout', 'J’arrête l’écoute.'));
        }, 12000);
      } catch {
        setIsListening(false);
      }
    };

    window.addEventListener('voice-payment-start', handleVoiceStart as EventListener);
    return () => window.removeEventListener('voice-payment-start', handleVoiceStart as EventListener);
  }, [translate, speak]);

  const applyParsedResult = (text: string, corrections?: Record<string, string>) => {
    const corrected = applyCorrections(text, corrections);
    const amountInfo = extractAmountFromTranscript(corrected);
    const token = detectTokenFromTranscript(corrected);
    setVoiceTranscript(corrected);

    const fallbackDigit = amountInfo.amount ? undefined : extractSingleDigit(corrected);
    const finalAmount = amountInfo.amount || fallbackDigit;

    if (finalAmount) {
      setVoiceParsedAmount(finalAmount);
      if (amountInfo.hasDecimal && amountInfo.decimalDigits === 1) {
        setVoiceHint(
          translate(
            'create.amount.voiceDecimalsHint',
            'Décimales détectées. Si vous voulez plus de précision, dites "zéro virgule zéro un".'
          )
        );
      } else {
        setVoiceHint('');
      }
      setFormData((prev) => ({
        ...prev,
        amount: finalAmount as string,
        tokenSymbol: token || 'USDC',
      }));
      setErrors((prev) => ({ ...prev, amount: '' }));
      return;
    }

    setVoiceParsedAmount('');
    if (token) {
      setFormData((prev) => ({
        ...prev,
        tokenSymbol: token,
      }));
      setErrors((prev) => ({ ...prev, amount: '' }));
      setVoiceHint(
        translate(
          'create.amount.voiceTokenOnly',
          'Token détecté. Dites maintenant le montant.'
        )
      );
      return;
    }

    const message = corrected
      ? translate(
          'create.amount.voiceNoAmount',
          'Montant non reconnu. Dites un nombre comme "12.5".'
        )
      : translate(
          'create.amount.voiceEmpty',
          'Aucun montant détecté. Réessayez en articulant clairement.'
        );
    setErrors((prev) => ({ ...prev, amount: message }));
    setVoiceHint('');
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsVoiceSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = voiceLanguage || locale;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    recognition.onresult = (event: any) => {
      const options: Array<{ text: string; isFinal: boolean }> = [];
      const results = event?.results || [];
      for (let i = 0; i < results.length; i += 1) {
        const result = results[i];
        const isFinal = !!result.isFinal;
        for (let j = 0; j < result.length; j += 1) {
          const alt = result[j]?.transcript;
          if (alt && typeof alt === 'string') options.push({ text: alt, isFinal });
        }
      }
      if (options.length === 0) options.push({ text: '', isFinal: false });

      let best = options[0];
      let bestScore = -1;
      let bestAmount: string | undefined;
      let bestAmountMeta: { decimalDigits: number; hasDecimal: boolean } = { decimalDigits: 0, hasDecimal: false };
      let bestToken: TokenSymbol | undefined;
      for (const option of options) {
        const amountInfo = extractAmountFromTranscript(option.text);
        const amount = amountInfo.amount;
        const token = detectTokenFromTranscript(option.text);
        const score =
          (amountInfo.decimalDigits * 10) +
          (amountInfo.hasDecimal ? 5 : 0) +
          (amount ? 1 : 0) +
          (token ? 1 : 0) +
          (option.isFinal ? 1 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = option;
          bestAmount = amount;
          bestAmountMeta = amountInfo;
          bestToken = token;
        }
      }

      if (voiceCommandMode) {
        handleVoiceCommandTranscript(best.text);
        return;
      }

      const now = Date.now();
      const last = lastVoiceRef.current;
      const shouldKeepLast =
        last.amount &&
        now - last.at < 3000 &&
        bestAmount &&
        bestAmountMeta.hasDecimal &&
        last.meta.hasDecimal &&
        last.meta.decimalDigits > bestAmountMeta.decimalDigits;

      if (shouldKeepLast) {
        bestAmount = last.amount;
        bestAmountMeta = last.meta;
        bestToken = bestToken || last.token;
        best = { text: last.transcript, isFinal: true };
      } else if (!bestAmount) {
        const singleDigit = extractSingleDigit(best.text);
        if (
          singleDigit &&
          last.amount &&
          last.meta.hasDecimal &&
          last.meta.decimalDigits < 2 &&
          now - last.at < 5000
        ) {
          const [left, right = ''] = last.amount.split('.');
          const appended = `${left}.${right}${singleDigit}`;
          bestAmount = appended;
          bestAmountMeta = { hasDecimal: true, decimalDigits: right.length + 1 };
          bestToken = bestToken || last.token;
        }
      }

      const correctedBestText = applyCorrections(best.text, voiceCorrections);
      if (correctedBestText !== best.text) {
        const correctedAmountInfo = extractAmountFromTranscript(correctedBestText);
        const correctedToken = detectTokenFromTranscript(correctedBestText);
        if (correctedAmountInfo.amount) {
          bestAmount = correctedAmountInfo.amount;
          bestAmountMeta = correctedAmountInfo;
        }
        if (correctedToken) {
          bestToken = correctedToken;
        }
        best = { ...best, text: correctedBestText };
      }

      if (!bestAmount) {
        const fallbackDigit = extractSingleDigit(best.text);
        if (fallbackDigit) {
          bestAmount = fallbackDigit;
          bestAmountMeta = { hasDecimal: false, decimalDigits: 0 };
        }
      }

      lastVoiceRef.current = {
        amount: bestAmount,
        meta: bestAmountMeta,
        token: bestToken,
        transcript: best.text,
        at: now,
      };

      setVoiceTranscript(best.text);

      if (bestAmount) {
        setVoiceParsedAmount(bestAmount);
        if (bestAmountMeta.hasDecimal && bestAmountMeta.decimalDigits === 1) {
          setVoiceHint(
            translate(
              'create.amount.voiceDecimalsHint',
              'Décimales détectées. Si vous voulez plus de précision, dites "zéro virgule zéro un".'
            )
          );
        } else {
          setVoiceHint('');
        }
        setFormData((prev) => ({
          ...prev,
          amount: bestAmount,
          tokenSymbol: bestToken || 'USDC',
        }));
        setErrors((prev) => ({ ...prev, amount: '' }));
      } else {
        setVoiceParsedAmount('');
        if (bestToken) {
          setFormData((prev) => ({
            ...prev,
            tokenSymbol: bestToken,
          }));
          setErrors((prev) => ({ ...prev, amount: '' }));
          setVoiceHint(
            translate(
              'create.amount.voiceTokenOnly',
              'Token détecté. Dites maintenant le montant.'
            )
          );
        } else {
          const message = best.text
            ? translate(
                'create.amount.voiceNoAmount',
                'Montant non reconnu. Dites un nombre comme "12.5".'
              )
            : translate(
                'create.amount.voiceEmpty',
                'Aucun montant détecté. Réessayez en articulant clairement.'
              );
          setErrors((prev) => ({ ...prev, amount: message }));
          setVoiceHint('');
        }
      }
    };
    recognition.onerror = () => {
      setErrors((prev) => ({
        ...prev,
        amount: translate(
          'create.amount.voiceError',
          'Impossible de lire la saisie vocale. Réessayez.'
        ),
      }));
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsVoiceSupported(true);

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [locale, voiceLanguage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsWhisperSupported(
      typeof MediaRecorder !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedLang = localStorage.getItem(voiceLanguageStorageKey);
      if (storedLang && voiceLanguageOptions.includes(storedLang)) {
        setVoiceLanguage(storedLang);
      } else {
        setVoiceLanguage(locale);
      }
      const stored = localStorage.getItem(voiceStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          setVoiceCorrections(parsed as Record<string, string>);
        }
      }
    } catch {
      // ignore invalid storage
    }
  }, [voiceStorageKey, locale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fetchGlobalCorrections = async () => {
      try {
        const response = await fetch(`/api/voice-corrections?lang=${encodeURIComponent(languageKey)}`);
        if (!response.ok) return;
        const payload = await response.json();
        const data: Array<{ from_text: string; to_text: string }> = payload?.data || [];
        const globalMap = data.reduce<Record<string, string>>((acc, item) => {
          if (item?.from_text && item?.to_text) {
            acc[item.from_text] = item.to_text;
          }
          return acc;
        }, {});
        setVoiceCorrections((prev) => {
          const merged = { ...globalMap, ...prev };
          try {
            localStorage.setItem(voiceStorageKey, JSON.stringify(merged));
          } catch {
            // ignore storage failure
          }
          return merged;
        });
      } catch {
        // ignore fetch error
      }
    };
    fetchGlobalCorrections();
  }, [languageKey]);

  useEffect(() => {
    setCancellable(true);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('beneficiaryHistory');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => {
              if (typeof item === 'string') {
                return { address: item };
              }
              if (item && typeof item === 'object' && typeof item.address === 'string') {
                return { address: item.address, name: item.name };
              }
              return null;
            })
            .filter((item): item is BeneficiaryHistoryItem => Boolean(item));
          setBeneficiaryHistory(normalized);
        }
      }
      const storedFavorites = localStorage.getItem('beneficiaryFavorites');
      if (storedFavorites) {
        const parsedFavorites = JSON.parse(storedFavorites);
        if (Array.isArray(parsedFavorites)) {
          setFavoriteAddresses(parsedFavorites.filter((item) => typeof item === 'string'));
        }
      }
    } catch (error) {
      console.error('Error loading beneficiary history:', error);
    }
  }, []);

  // Hooks de création
  const singlePayment = useCreatePayment();
  const batchPayment = useCreateBatchPayment();
  const recurringPayment = useCreateRecurringPayment();
  const batchRecurringPayment = useCreateBatchRecurringPayment();

  // État: paiement simple ou batch?
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [additionalBeneficiaries, setAdditionalBeneficiaries] = useState<string[]>([]);

  // État du formulaire
  const [formData, setFormData] = useState<PaymentFormData>({
    tokenSymbol: 'USDC',
    beneficiary: '',
    amount: '',
    releaseDate: null,
    label: '',
    category: 'other',
  });

  const { suggestedCategory, confidence, matchedKeywords } = useSuggestedCategory(formData.label);

  // État: paiement récurrent
  const [isRecurringMode, setIsRecurringMode] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState<number>(1);

  // État: type de paiement (instant / programmé / récurrent)
  const [paymentTiming, setPaymentTiming] = useState<PaymentTiming>('instant');

  // ⭐ Option: première mensualité différente
  const [isFirstMonthDifferent, setIsFirstMonthDifferent] = useState(false);
  const [firstMonthAmountInput, setFirstMonthAmountInput] = useState<string>('');

  // État: type de paiement (annulable ou définitif)
  const [cancellable, setCancellable] = useState(true);

  const [beneficiaryHistory, setBeneficiaryHistory] = useState<BeneficiaryHistoryItem[]>([]);
  const [favoriteAddresses, setFavoriteAddresses] = useState<string[]>([]);
  const [showBeneficiaryHistory, setShowBeneficiaryHistory] = useState(false);

  // Erreurs de validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Balance du token sélectionné
  const { balance, formatted: balanceFormatted } = useTokenBalance(
    formData.tokenSymbol
  );

  // Vérifier si la mensualisation est disponible
  const isRecurringAvailable = formData.tokenSymbol === 'USDT' || formData.tokenSymbol === 'USDC';
  
  // Vérifier si les paiements batch sont disponibles (ETH, USDC, USDT)
  const isBatchAvailable = formData.tokenSymbol === 'ETH' || formData.tokenSymbol === 'USDC' || formData.tokenSymbol === 'USDT';

  const isProVerified = user?.accountType === 'professional' && user?.proStatus === 'verified';
  const recurringFeeBps = getProtocolFeeBps({ isInstantPayment: false, isProVerified });
  const recurringFeeRate = recurringFeeBps / 10000;
  const recurringAmountValue = Number.isFinite(parseFloat(formData.amount)) ? parseFloat(formData.amount) : 0;
  const recurringMonthlyFee = recurringAmountValue * recurringFeeRate;
  const recurringTotalPerMonth = recurringAmountValue + recurringMonthlyFee;
  const recurringTotalToApprove = recurringTotalPerMonth * recurringMonths;
  const [hasSyncedPro, setHasSyncedPro] = useState(false);

  useEffect(() => {
    if (!user?.id || !address || hasSyncedPro) return;
    if (user.proStatus !== 'verified' && user.accountType !== 'professional') return;

    const syncPro = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/pro/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            wallet: address,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.allowlist?.ok) {
            setHasSyncedPro(true);
          }
        }
      } catch (error) {
        console.error('Erreur sync PRO:', error);
      }
    };

    syncPro();
  }, [user?.id, user?.proStatus, user?.accountType, address, API_BASE_URL, hasSyncedPro]);

  // Restaurer les données au retour de /create-batch
  useEffect(() => {
    const storedFormData = localStorage.getItem('paymentFormData');
    if (storedFormData) {
      try {
        const data = JSON.parse(storedFormData);
        setFormData({
          tokenSymbol: data.tokenSymbol || 'ETH',
          beneficiary: data.beneficiary || '',
          amount: data.amount || '',
          releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
          label: data.label || '',
          category: data.category || 'other',
        });
        localStorage.removeItem('paymentFormData');
      } catch (error) {
        console.error('Erreur restauration formData:', error);
      }
    }

    const storedBeneficiaries = localStorage.getItem('additionalBeneficiaries');
    if (storedBeneficiaries) {
      try {
        const addresses = JSON.parse(storedBeneficiaries);
        if (Array.isArray(addresses) && addresses.length > 0) {
          setAdditionalBeneficiaries(addresses);
          setIsBatchMode(true);
        }
        localStorage.removeItem('additionalBeneficiaries');
      } catch (error) {
        console.error('Erreur parsing additionalBeneficiaries:', error);
      }
    }
  }, []);

  // Validation adresse Ethereum
  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Validation montant
  const validateAmount = (amount: string): string | null => {
    if (!amount || amount === '0') {
      return translate('create.validation.amountRequired', 'Enter an amount');
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return translate('create.validation.amountInvalid', 'Invalid amount');
    }

    if (balance) {
      const decimals = formData.tokenSymbol === 'ETH' ? 18 : 
                       formData.tokenSymbol === 'USDC' || formData.tokenSymbol === 'USDT' ? 6 : 8;
      const totalBeneficiaries = isBatchMode ? additionalBeneficiaries.length + 1 : 1;
      const totalAmount = amountNum * totalBeneficiaries;
      const amountBigInt = BigInt(Math.floor(totalAmount * 10 ** decimals));
      
      if (amountBigInt > balance) {
        return translate('create.validation.insufficientBalance', 'Insufficient balance');
      }
    }

    return null;
  };

  // Validation date
  const validateDate = (date: Date | null): string | null => {
    if (!date) {
      return translate('create.validation.dateRequired', 'Choose a date');
    }

    const now = new Date();
    const diffInSeconds = (date.getTime() - now.getTime()) / 1000;
    
    // Vérifier si la date est dans le passé
    if (diffInSeconds < 0) {
      return translate(
        'create.validation.datePast',
        'This date is in the past. Please choose a future date.'
      );
    }
    
    // Si c'est un paiement instantané (moins d'1 minute), on ne valide pas
    if (diffInSeconds < 60) {
      return null; // Paiement instantané, pas d'erreur
    }

    const minDate = new Date(now.getTime() + 10 * 60 * 1000);

    if (date < minDate) {
      return translate(
        'create.validation.dateMin',
        'The date must be at least 10 minutes in the future'
      );
    }

    return null;
  };

  const handlePaymentTimingChange = (nextTiming: PaymentTiming) => {
    if (nextTiming === 'recurring' && !isRecurringAvailable) {
      return;
    }

    setPaymentTiming(nextTiming);

    if (nextTiming === 'recurring') {
      setIsRecurringMode(true);
      return;
    }

    if (isRecurringMode) {
      setIsRecurringMode(false);
      setIsFirstMonthDifferent(false);
      setFirstMonthAmountInput('');
    }

    if (nextTiming === 'instant') {
      const date = new Date();
      date.setSeconds(date.getSeconds() + 30);
      handleDateChange(date);
    }

    if (nextTiming === 'scheduled') {
      const date = new Date();
      date.setMinutes(date.getMinutes() + 20);
      date.setSeconds(0, 0);
      handleDateChange(date);
    }
  };

  useEffect(() => {
    if (paymentTiming === 'recurring' && !isRecurringMode) {
      setIsRecurringMode(true);
    }
    if (paymentTiming !== 'recurring' && isRecurringMode) {
      setIsRecurringMode(false);
      setIsFirstMonthDifferent(false);
      setFirstMonthAmountInput('');
    }
  }, [paymentTiming, isRecurringMode]);

  useEffect(() => {
    if (paymentTiming === 'instant' && !formData.releaseDate) {
      const date = new Date();
      date.setSeconds(date.getSeconds() + 30);
      setFormData((prev) => ({ ...prev, releaseDate: date }));
    }
  }, [paymentTiming, formData.releaseDate]);

  useEffect(() => {
    if (paymentTiming === 'scheduled' && !formData.releaseDate) {
      const date = new Date();
      date.setMinutes(date.getMinutes() + 20);
      date.setSeconds(0, 0);
      setFormData((prev) => ({ ...prev, releaseDate: date }));
    }
  }, [paymentTiming, formData.releaseDate]);

  // Handler changement token
  
  const handleLabelChange = (label: string) => {
    setFormData(prev => ({ ...prev, label }));
    if (label.length > 100) {
      setErrors(prev => ({ ...prev, label: 'Maximum 100 characters' }));
    } else {
      setErrors(prev => ({ ...prev, label: '' }));
    }
  };

  const handleCategoryChange = (category: PaymentCategory) => {
    setFormData(prev => ({ ...prev, category }));
  };


  const handleTokenChange = (token: TokenSymbol) => {
    setFormData((prev) => ({ ...prev, tokenSymbol: token }));
    setErrors((prev) => ({ ...prev, amount: '' }));
    
    // Désactiver la mensualisation si on passe à ETH
    if (token === 'ETH' && isRecurringMode) {
      setIsRecurringMode(false);
      setPaymentTiming('scheduled');
      setIsFirstMonthDifferent(false);
      setFirstMonthAmountInput('');
    }
  };

  // Handler changement bénéficiaire
  const handleBeneficiaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, beneficiary: value }));

    if (value && !isValidAddress(value)) {
      setErrors((prev) => ({
        ...prev,
        beneficiary: translate('create.validation.invalidAddress', 'Invalid address')
      }));
    } else {
      setErrors((prev) => ({ ...prev, beneficiary: '' }));
    }
  };

  const updateBeneficiaryHistory = (address: string) => {
    const normalized = address.trim();
    if (!normalized) return;
    setBeneficiaryHistory((prev) => {
      const existing = prev.find(
        (item) => item.address.toLowerCase() === normalized.toLowerCase()
      );
      const next = [
        { address: normalized, name: existing?.name },
        ...prev.filter((item) => item.address.toLowerCase() !== normalized.toLowerCase()),
      ].slice(0, 5);
      localStorage.setItem('beneficiaryHistory', JSON.stringify(next));
      return next;
    });
  };

  const persistFavorites = (next: string[]) => {
    setFavoriteAddresses(next);
    localStorage.setItem('beneficiaryFavorites', JSON.stringify(next));
  };

  const toggleFavorite = (address: string) => {
    const normalized = address.toLowerCase();
    if (favoriteAddresses.some((item) => item.toLowerCase() === normalized)) {
      persistFavorites(favoriteAddresses.filter((item) => item.toLowerCase() !== normalized));
    } else {
      persistFavorites([address, ...favoriteAddresses]);
    }
  };

  const handleSelectBeneficiary = (address: string) => {
    setFormData((prev) => ({ ...prev, beneficiary: address }));
    setErrors((prev) => ({ ...prev, beneficiary: '' }));
    setShowBeneficiaryHistory(false);
  };

  // Handler changement montant
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, amount: value }));

    const error = validateAmount(value);
    setErrors((prev) => ({ ...prev, amount: error || '' }));
  };

  // Handler changement date
  const handleDateChange = (date: Date) => {
    setFormData((prev) => ({ ...prev, releaseDate: date }));

    const error = validateDate(date);
    setErrors((prev) => ({ ...prev, date: error || '' }));
  };

  // Calculer le montant en BigInt
  const getAmountBigInt = (): bigint | null => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) return null;

    const decimals = formData.tokenSymbol === 'ETH' ? 18 : 
                     formData.tokenSymbol === 'USDC' || formData.tokenSymbol === 'USDT' ? 6 : 8;
    
    try {
      return BigInt(Math.floor(parseFloat(formData.amount) * 10 ** decimals));
    } catch {
      return null;
    }
  };

  // Handler redirection vers /create-batch
  const handleAddMultipleBeneficiaries = () => {
    localStorage.setItem('paymentFormData', JSON.stringify({
      tokenSymbol: formData.tokenSymbol,
      beneficiary: formData.beneficiary,
      amount: formData.amount,
      releaseDate: formData.releaseDate?.toISOString(),
        label: formData.label,
        category: formData.category,
    }));

    router.push('/create-batch');
  };

  // Handler suppression d'un bénéficiaire additionnel
  const handleRemoveBeneficiary = (index: number) => {
    const updated = additionalBeneficiaries.filter((_, i) => i !== index);
    setAdditionalBeneficiaries(updated);
    if (updated.length === 0) {
      setIsBatchMode(false);
    }
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🎯🎯🎯 [FORM SUBMIT] handleSubmit appelé');
    console.log('📋 [FORM SUBMIT] formData:', formData);
    console.log('📋 [FORM SUBMIT] isConnected:', isConnected);
    console.log('📋 [FORM SUBMIT] address:', address);

    // Validation complète
    const newErrors: Record<string, string> = {};

    if (!isValidAddress(formData.beneficiary)) {
      newErrors.beneficiary = translate('create.validation.invalidAddress', 'Invalid address');
    }

    const amountError = validateAmount(formData.amount);
    if (amountError) {
      newErrors.amount = amountError;
    }

    const dateError = validateDate(formData.releaseDate);
    if (dateError) {
      newErrors.date = dateError;
    }

    // ⭐ Validation: première mensualité différente (uniquement si mensualisation)
    if (isRecurringMode && isFirstMonthDifferent) {
      if (!firstMonthAmountInput || firstMonthAmountInput === '0') {
        newErrors.firstMonthAmount = translate(
          'create.validation.firstMonthRequired',
          'Enter an amount for the first monthly payment'
        );
      } else {
        const firstNum = parseFloat(firstMonthAmountInput);
        const monthlyNum = parseFloat(formData.amount);
        if (isNaN(firstNum) || firstNum <= 0) {
          newErrors.firstMonthAmount = translate(
            'create.validation.firstMonthInvalid',
            'Invalid amount'
          );
        }
        // Si identique au montant mensuel, on n'a pas besoin d'une première mensualité personnalisée
        if (!isNaN(firstNum) && !isNaN(monthlyNum) && firstNum === monthlyNum) {
          // Pas d'erreur, mais le paramètre sera ignoré
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      console.log('❌ [FORM SUBMIT] Erreurs de validation:', newErrors);
      setErrors(newErrors);
      return;
    }

    console.log('✅ [FORM SUBMIT] Validation passée, préparation des données...');

    if (isValidAddress(formData.beneficiary)) {
      updateBeneficiaryHistory(formData.beneficiary);
    }

    const token = getToken(formData.tokenSymbol);
    const amountBigInt = BigInt(
      Math.floor(parseFloat(formData.amount) * 10 ** token.decimals)
    );

    // ⭐ Calcul optionnel: première mensualité personnalisée
    const firstMonthAmountBigInt = (() => {
      if (!isRecurringMode || !isFirstMonthDifferent) return undefined;
      const firstNum = parseFloat(firstMonthAmountInput);
      const monthlyNum = parseFloat(formData.amount);
      if (!firstMonthAmountInput || isNaN(firstNum) || firstNum <= 0) return undefined;
      // Si identique au montant mensuel, on ignore l'option
      if (!isNaN(monthlyNum) && firstNum === monthlyNum) return undefined;
      return BigInt(Math.floor(firstNum * 10 ** token.decimals));
    })();

    const releaseTime = Math.floor(formData.releaseDate!.getTime() / 1000);

    console.log('📋 [FORM SUBMIT] Données préparées:', {
      tokenSymbol: formData.tokenSymbol,
      beneficiary: formData.beneficiary,
      amountBigInt: amountBigInt.toString(),
      releaseTime,
      releaseDate: new Date(releaseTime * 1000).toISOString(),
      cancellable,
      isRecurringMode,
      isBatchMode,
    });

    try {
      if (isRecurringMode && isBatchMode && additionalBeneficiaries.length > 0) {
        // ✅ NOUVEAU : Paiement récurrent BATCH (plusieurs bénéficiaires)
        console.log('📋 [FORM SUBMIT] Mode: Batch Recurring Payment');

        const dayOfMonth = formData.releaseDate!.getDate();
        const allBeneficiaries = [
          { address: formData.beneficiary, amount: formData.amount },
          ...additionalBeneficiaries.map(addr => ({ address: addr, amount: formData.amount }))
        ];

        await batchRecurringPayment.createBatchRecurringPayment({
          tokenSymbol: formData.tokenSymbol as 'USDC' | 'USDT',
          beneficiaries: allBeneficiaries,
          firstMonthAmount: firstMonthAmountBigInt,
          firstPaymentTime: releaseTime,
          totalMonths: recurringMonths,
          dayOfMonth: dayOfMonth,
          cancellable,
            label: formData.label,
            category: formData.category,
        });
      } else if (isRecurringMode) {
        // ✅ Paiement récurrent SINGLE
        console.log('📋 [FORM SUBMIT] Mode: Single Recurring Payment');

        const dayOfMonth = formData.releaseDate!.getDate(); // Retourne 1-31

        await recurringPayment.createRecurringPayment({
          tokenSymbol: formData.tokenSymbol as 'USDC' | 'USDT',
          beneficiary: formData.beneficiary as `0x${string}`,
          monthlyAmount: amountBigInt,
          firstMonthAmount: firstMonthAmountBigInt, // ⭐ optionnel
          firstPaymentTime: releaseTime,
          totalMonths: recurringMonths,
          dayOfMonth: dayOfMonth, // ✅ AJOUTÉ - Jour extrait automatiquement du calendrier
          cancellable,
            label: formData.label,
            category: formData.category,
        });
      } else if (isBatchMode && additionalBeneficiaries.length > 0) {
        const allBeneficiaries = [
          { address: formData.beneficiary, amount: formData.amount },
          ...additionalBeneficiaries.map(addr => ({ address: addr, amount: formData.amount }))
        ];

        await batchPayment.createBatchPayment({
          beneficiaries: allBeneficiaries,
          releaseTime,
          cancellable,
          tokenSymbol: formData.tokenSymbol, // ✅ Ajouter le token symbol
        });
      } else {
        console.log('📤 [FORM SUBMIT] Appel singlePayment.createPayment()...');
        console.log('📋 [FORM SUBMIT] Paramètres:', {
          tokenSymbol: formData.tokenSymbol,
          beneficiary: formData.beneficiary,
          amount: amountBigInt.toString(),
          releaseTime,
          cancellable,
            label: formData.label,
            category: formData.category,
        });
        await singlePayment.createPayment({
          tokenSymbol: formData.tokenSymbol,
          beneficiary: formData.beneficiary as `0x${string}`,
          amount: amountBigInt,
          releaseTime,
          cancellable,
            label: formData.label,
            category: formData.category,
        });
        console.log('✅ [FORM SUBMIT] singlePayment.createPayment() appelé');
      }
    } catch (err) {
      console.error('❌ [FORM SUBMIT] Erreur lors de la création:', err);
      console.error('❌ [FORM SUBMIT] Stack:', (err as Error)?.stack);
    }
  };

  // Handler fermeture modal
  const handleCloseModal = () => {
    if (isRecurringMode && isBatchMode) {
      batchRecurringPayment.reset();
    } else if (isRecurringMode) {
      recurringPayment.reset();
    } else if (isBatchMode) {
      batchPayment.reset();
    } else {
      singlePayment.reset();
    }
  };

  // Handler voir le paiement
  const handleViewPayment = () => {
    // Pour batch recurring, on redirige vers le dashboard (plusieurs contrats)
    if (isRecurringMode && isBatchMode) {
      router.push('/dashboard');
      return;
    }

    const contractAddr = isRecurringMode
      ? recurringPayment.contractAddress
      : isBatchMode
      ? batchPayment.contractAddress
      : singlePayment.contractAddress;
    if (contractAddr) {
      router.push(`/payment/${contractAddr}`);
    }
  };

  const activePayment = (isRecurringMode && isBatchMode)
    ? batchRecurringPayment
    : isRecurringMode
    ? recurringPayment
    : isBatchMode
    ? batchPayment
    : singlePayment;

  const beneficiaryQuery = formData.beneficiary.trim().toLowerCase();
  const favorites = favoriteAddresses
    .map((fav) => {
      const item = beneficiaryHistory.find(
        (entry) => entry.address.toLowerCase() === fav.toLowerCase()
      );
      return item || { address: fav };
    })
    .filter((item) => {
      if (!beneficiaryQuery) return true;
      return (
        item.address.toLowerCase().includes(beneficiaryQuery) ||
        (item.name ? item.name.toLowerCase().includes(beneficiaryQuery) : false)
      );
    });

  const filteredBeneficiaryHistory = beneficiaryHistory
    .filter((item) => {
      if (!beneficiaryQuery) return true;
      return (
        item.address.toLowerCase().includes(beneficiaryQuery) ||
        (item.name ? item.name.toLowerCase().includes(beneficiaryQuery) : false)
      );
    })
    .filter(
      (item) =>
        !favoriteAddresses.some(
          (fav) => fav.toLowerCase() === item.address.toLowerCase()
        )
    )
    .slice(0, 5);

  if (!walletConnected) {
    return (
      <div className="text-center p-12 glass rounded-2xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {isMounted && translationsReady ? t('common.connectWallet') : 'Connectez votre wallet'}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {isMounted && translationsReady ? t('create.wallet.connectFirst') : 'To create a scheduled payment, first connect your wallet'}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => openConnectModal?.()}
            type="button"
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            {isMounted && translationsReady ? t('common.connectWallet', { defaultValue: 'Connect Wallet' }) : 'Connect Wallet'}
          </button>
          <button
            onClick={handleReconnectWallet}
            type="button"
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all"
          >
            {isMounted && translationsReady ? t('common.resetWallet', { defaultValue: 'Reset wallet connection' }) : 'Reset wallet connection'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
      {/* Section 1 : Choix de la crypto */}
      <div className="glass rounded-2xl p-6">
        <CurrencySelector
          selectedToken={formData.tokenSymbol}
          onSelectToken={handleTokenChange}
        />
        
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          {isMounted && translationsReady ? t('create.summary.balance') : 'Available balance'} : <span className="font-medium">{balanceFormatted}</span>
        </div>
      </div>

      {/* Section 2 : Bénéficiaire(s) */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {isMounted && translationsReady ? t('create.beneficiary.address') : 'Beneficiary address'}
        </label>
        <div className="relative">
          <input
            type="text"
            value={formData.beneficiary}
            onChange={handleBeneficiaryChange}
            onFocus={() => setShowBeneficiaryHistory(true)}
            onBlur={() => setTimeout(() => setShowBeneficiaryHistory(false), 120)}
            placeholder="0x..."
            className={`
              w-full px-4 py-3 rounded-xl border-2 
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-white
              transition-all
              ${
                errors.beneficiary
                  ? 'border-red-500 focus:border-red-600'
                  : 'border-gray-200 dark:border-gray-700 focus:border-primary-500'
              }
              focus:outline-none focus:ring-4 focus:ring-primary-500/20
            `}
          />

          <div
            className={`
              mt-2 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700
              bg-white/90 dark:bg-gray-900/90 backdrop-blur
              shadow-sm transition-all duration-200
              ${showBeneficiaryHistory ? 'max-h-56 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}
            `}
          >
            <div className="max-h-52 overflow-auto">
              {favorites.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {translate('create.beneficiary.favoritesTitle', 'Favorites')}
                  </div>
                  {favorites.map((item) => {
                    const isFavorite = favoriteAddresses.some(
                      (fav) => fav.toLowerCase() === item.address.toLowerCase()
                    );
                    return (
                      <div
                        key={`fav-${item.address}`}
                        className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectBeneficiary(item.address)}
                          className="flex-1 text-left"
                        >
                          <div className="flex flex-col">
                            {item.name && (
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                {item.name}
                              </span>
                            )}
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                              {item.address}
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => toggleFavorite(item.address)}
                          className="p-1 rounded-full hover:bg-yellow-100/60 dark:hover:bg-yellow-500/10"
                          title={translate('create.beneficiary.toggleFavorite', 'Toggle favorite')}
                        >
                          <svg
                            className={`w-4 h-4 ${
                              isFavorite ? 'text-yellow-500 fill-yellow-400' : 'text-gray-400'
                            }`}
                            viewBox="0 0 24 24"
                            fill={isFavorite ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 17.3l-6.18 3.24 1.18-6.88L1 8.96l6.91-1 3.09-6.26 3.09 6.26 6.91 1-5 4.7 1.18 6.88L12 17.3z" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </>
              )}

              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                {translate('create.beneficiary.recentTitle', 'Recent addresses')}
              </div>
              {filteredBeneficiaryHistory.length > 0 ? (
                filteredBeneficiaryHistory.map((item) => {
                  const isFavorite = favoriteAddresses.some(
                    (fav) => fav.toLowerCase() === item.address.toLowerCase()
                  );
                  return (
                    <div
                      key={item.address}
                      className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelectBeneficiary(item.address)}
                        className="flex-1 text-left"
                      >
                        <div className="flex flex-col">
                          {item.name && (
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                              {item.name}
                            </span>
                          )}
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            {item.address}
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => toggleFavorite(item.address)}
                        className="p-1 rounded-full hover:bg-yellow-100/60 dark:hover:bg-yellow-500/10"
                        title={translate('create.beneficiary.toggleFavorite', 'Toggle favorite')}
                      >
                        <svg
                          className={`w-4 h-4 ${
                            isFavorite ? 'text-yellow-500 fill-yellow-400' : 'text-gray-400'
                          }`}
                          viewBox="0 0 24 24"
                          fill={isFavorite ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 17.3l-6.18 3.24 1.18-6.88L1 8.96l6.91-1 3.09-6.26 3.09 6.26 6.91 1-5 4.7 1.18 6.88L12 17.3z" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {translate('create.beneficiary.recentEmpty', 'No recent addresses')}
                </div>
              )}
            </div>
          </div>
        </div>
        {errors.beneficiary && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.beneficiary}
          </p>
        )}
        
        {isBatchMode && additionalBeneficiaries.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              👥 {isMounted && translationsReady
                ? t('create.beneficiary.additional')
                : 'Additional beneficiaries'} ({additionalBeneficiaries.length})
            </h4>
            <div className="space-y-2">
              {additionalBeneficiaries.map((addr, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 font-mono">
                    {addr.slice(0, 6)}...{addr.slice(-4)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBeneficiary(index)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    ✕ {isMounted && translationsReady ? t('create.beneficiary.remove') : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {!isBatchMode && (
          <div className="relative group">
            <button
              type="button"
              onClick={handleAddMultipleBeneficiaries}
              disabled={!isBatchAvailable}
              className={`
                w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed font-medium transition-all duration-200
                ${isBatchAvailable
                  ? 'border-primary-300 dark:border-primary-600 bg-primary-50/50 dark:bg-primary-950/20 hover:bg-primary-100 dark:hover:bg-primary-950/40 hover:border-primary-400 dark:hover:border-primary-500 text-primary-700 dark:text-primary-300 cursor-pointer'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 opacity-60 cursor-not-allowed'
                }
              `}
            >
              <svg 
                className={`w-5 h-5 ${isBatchAvailable ? 'transition-transform group-hover:scale-110 group-hover:rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm">{isMounted && translationsReady ? t('create.beneficiary.addMultiple') : 'Add multiple beneficiaries'}</span>
              {isBatchAvailable && (
                <svg 
                  className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100 transition-opacity" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
            
          </div>
        )}
      </div>

      {/* ✅ SECTION PAYMENT IDENTITY */}
      <PaymentIdentitySection
        label={formData.label}
        category={formData.category}
        onLabelChange={handleLabelChange}
        onCategoryChange={handleCategoryChange}
        suggestedCategory={suggestedCategory}
        confidence={confidence}
        matchedKeywords={matchedKeywords}
        error={errors.label}
      />

      {/* Section 3 : Montant */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {isMounted && translationsReady ? t('create.amount.label') : 'Amount'} {isBatchMode && (isMounted && translationsReady ? t('create.amount.perBeneficiary') : '(per beneficiary)')} {isRecurringMode && (isMounted && translationsReady ? t('create.amount.monthly') : '(monthly)')}
        </label>
        <div className="relative">
          <input
            ref={amountInputRef}
            type="number"
            step="any"
            value={formData.amount}
            onChange={handleAmountChange}
            onWheel={(event) => (event.currentTarget as HTMLInputElement).blur()}
            placeholder="0.0"
            className={`
              w-full px-4 py-3 pr-32 rounded-xl border-2 
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-white
              text-lg font-medium
              transition-all
              ${
                errors.amount
                  ? 'border-red-500 focus:border-red-600'
                  : 'border-gray-200 dark:border-gray-700 focus:border-primary-500'
              }
              focus:outline-none focus:ring-4 focus:ring-primary-500/20
            `}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-500 font-medium">
            <button
              type="button"
              onClick={() => {
                const currentIndex = voiceLanguageOptions.indexOf(voiceLanguage || locale);
                const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % voiceLanguageOptions.length;
                const nextLang = voiceLanguageOptions[nextIndex];
                setVoiceLanguage(nextLang);
                try {
                  localStorage.setItem(voiceLanguageStorageKey, nextLang);
                } catch {
                  // ignore storage failure
                }
              }}
              className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:border-primary-400 hover:text-primary-600"
              title={translate('create.amount.voiceLang', 'Langue de la reconnaissance vocale')}
              aria-label={translate('create.amount.voiceLang', 'Langue de la reconnaissance vocale')}
            >
              {(voiceLanguage || locale).split('-')[0].toUpperCase()}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isVoiceSupported) return;
                if (isListening) {
                  recognitionRef.current?.stop?.();
                  return;
                }
                setErrors((prev) => ({ ...prev, amount: '' }));
                setVoiceHint('');
                setVoiceParsedAmount('');
                setVoiceTranscript('');
              lastVoiceRef.current = {
                amount: undefined,
                meta: { decimalDigits: 0, hasDecimal: false },
                token: undefined,
                transcript: '',
                at: 0,
              };
                try {
                  recognitionRef.current?.start?.();
                  setIsListening(true);
                } catch {
                  setIsListening(false);
                }
              }}
              disabled={!isVoiceSupported}
              aria-label={
                isListening
                  ? translate('create.amount.voiceStop', 'Arrêter la saisie vocale')
                  : translate('create.amount.voiceStart', 'Saisir le montant par la voix')
              }
              title={
                isListening
                  ? translate('create.amount.voiceStop', 'Arrêter la saisie vocale')
                  : translate('create.amount.voiceStart', 'Saisir le montant par la voix')
              }
              className={`
                inline-flex items-center justify-center w-8 h-8 rounded-lg border
                transition-all
                ${
                  isVoiceSupported
                    ? isListening
                      ? 'border-red-300 bg-red-50 text-red-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-primary-400 hover:text-primary-600'
                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v3" />
              </svg>
            </button>
            <span>{formData.tokenSymbol}</span>
          </div>
        </div>
        {errors.amount && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.amount}
          </p>
        )}
        {voiceTranscript && (
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2">
            <div>
              {translate('create.amount.voiceDetected', 'Vocal détecté :')} {voiceTranscript}
            </div>
            {!showVoiceCorrection && (
              <button
                type="button"
                onClick={() => {
                  setShowVoiceCorrection(true);
                  setVoiceCorrectionFrom(voiceTranscript.toLowerCase());
                  setVoiceCorrectionTo('');
                }}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                {translate('create.amount.voiceCorrectionButton', 'Ajouter une correction')}
              </button>
            )}
          </div>
        )}
        {voiceParsedAmount && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {translate('create.amount.voiceParsed', 'Montant interprété :')} {voiceParsedAmount}
          </p>
        )}
        {showVoiceCorrection && (
          <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-xs space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-gray-500 dark:text-gray-400">
                  {translate('create.amount.voiceCorrectionHeard', 'Entendu')}
                </span>
                <input
                  type="text"
                  value={voiceCorrectionFrom}
                  onChange={(e) => setVoiceCorrectionFrom(e.target.value)}
                  className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-500 dark:text-gray-400">
                  {translate('create.amount.voiceCorrectionReplace', 'Remplacer par')}
                </span>
                <input
                  type="text"
                  value={voiceCorrectionTo}
                  onChange={(e) => setVoiceCorrectionTo(e.target.value)}
                  placeholder="centime"
                  className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const from = voiceCorrectionFrom.trim().toLowerCase();
                  const to = voiceCorrectionTo.trim().toLowerCase();
                  if (!from || !to) return;
                  const next = { ...voiceCorrections, [from]: to };
                  setVoiceCorrections(next);
                  try {
                    localStorage.setItem(voiceStorageKey, JSON.stringify(next));
                  } catch {
                    // ignore storage failure
                  }
                  try {
                    await fetch('/api/voice-corrections', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        language: languageKey,
                        from_text: from,
                        to_text: to,
                      }),
                    });
                  } catch {
                    // ignore network errors for now
                  }
                  setLastVoiceCorrection(`${from} → ${to}`);
                  setShowVoiceCorrection(false);
                  setVoiceCorrectionFrom('');
                  setVoiceCorrectionTo('');
                  applyParsedResult(voiceTranscript, next);
                }}
                className="px-2 py-1 rounded-md bg-primary-600 text-white hover:bg-primary-700"
              >
                {translate('create.amount.voiceCorrectionSave', 'Enregistrer')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowVoiceCorrection(false);
                  setVoiceCorrectionFrom('');
                  setVoiceCorrectionTo('');
                }}
                className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700"
              >
                {translate('create.amount.voiceCorrectionCancel', 'Annuler')}
              </button>
            </div>
          </div>
        )}
        {voiceHint && (
          <p className="text-xs text-blue-600 dark:text-blue-400">
            {voiceHint}
          </p>
        )}
        {lastVoiceCorrection && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {translate('create.amount.voiceCorrectionLast', 'Dernière correction :')} {lastVoiceCorrection}
          </p>
        )}
        
        {isBatchMode && formData.amount && parseFloat(formData.amount) > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {isMounted && translationsReady ? t('create.amount.total') : 'Total'} : <span className="font-semibold">
              {(parseFloat(formData.amount) * (additionalBeneficiaries.length + 1)).toFixed(4)} {formData.tokenSymbol}
            </span>
            {' '}{isMounted && translationsReady ? t('create.amount.forBeneficiaries', { count: additionalBeneficiaries.length + 1 }) : `for ${additionalBeneficiaries.length + 1} beneficiaries`}
          </div>
        )}

        {isRecurringMode && formData.amount && parseFloat(formData.amount) > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {translate('create.amount.totalMonths', 'Total over {{months}} months', {
              months: recurringMonths
            })}{' '}
            <span className="font-semibold">
              {(parseFloat(formData.amount) * recurringMonths).toFixed(4)} {formData.tokenSymbol}
            </span>
          </div>
        )}
      </div>

      {/* Section 4 : Timing */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {isMounted && translationsReady
            ? t('create.date.paymentTypeLabel', { defaultValue: 'Payment type' })
            : 'Payment type'}
        </label>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handlePaymentTimingChange('instant')}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              paymentTiming === 'instant'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-purple-300'
            }`}
          >
            <span className="text-lg">⚡</span>
            {isMounted && translationsReady ? t('links.types.instant', { defaultValue: 'Instant' }) : 'Instant'}
          </button>

          <button
            type="button"
            onClick={() => handlePaymentTimingChange('scheduled')}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              paymentTiming === 'scheduled'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-purple-300'
            }`}
          >
            <span className="text-lg">🗓️</span>
            {isMounted && translationsReady ? t('links.types.scheduled', { defaultValue: 'Scheduled' }) : 'Scheduled'}
          </button>

          <div className="relative group">
            <button
              type="button"
              onClick={() => handlePaymentTimingChange('recurring')}
              disabled={!isRecurringAvailable}
              className={`w-full px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                paymentTiming === 'recurring'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : isRecurringAvailable
                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-purple-300'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 opacity-50 cursor-not-allowed'
              }`}
            >
              <span className="text-lg">🔄</span>
              {isMounted && translationsReady ? t('links.types.recurring', { defaultValue: 'Recurring' }) : 'Recurring'}
            </button>

            {!isRecurringAvailable && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {isMounted && translationsReady ? t('create.date.recurringTooltip') : '⚠️ Feature only available for USDT/USDC'}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        </div>

        {paymentTiming !== 'instant' && (
          <>
            {/* Sélecteur nombre de mois si mensualisation active */}
            {isRecurringMode && (
              <>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl space-y-3 mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isMounted && translationsReady ? t('create.date.monthsLabel') : 'Number of monthly payments'}
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                    <button
                      key={month}
                      type="button"
                      onClick={() => setRecurringMonths(month)}
                      className={`
                        py-2 rounded-lg text-sm font-medium transition-all
                        ${recurringMonths === month
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900'
                        }
                      `}
                    >
                      {month}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {isMounted && translationsReady
                    ? t('create.date.monthsInfo', { months: recurringMonths })
                    : `💡 The amount will be debited each month for ${recurringMonths} months. Your treasury remains available.`}
                </p>
              </div>

              {/* ⭐ Option: première mensualité différente */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl space-y-3 mb-4 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {isMounted && translationsReady ? t('create.firstMonth.title') : 'First monthly payment'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {isMounted && translationsReady
                        ? t('create.firstMonth.description')
                        : 'By default, it is the same as the following months. Useful for a different first rent or upfront fees.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFirstMonthDifferent(false);
                        setFirstMonthAmountInput('');
                        setErrors((prev) => ({ ...prev, firstMonthAmount: '' }));
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        !isFirstMonthDifferent
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                      }`}
                    >
                      {isMounted && translationsReady ? t('create.firstMonth.same') : 'Same'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFirstMonthDifferent(true);
                        setFirstMonthAmountInput(formData.amount || '');
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        isFirstMonthDifferent
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                      }`}
                    >
                      {isMounted && translationsReady ? t('create.firstMonth.custom') : 'Custom'}
                    </button>
                  </div>
                </div>

                {isFirstMonthDifferent && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {isMounted && translationsReady ? t('create.firstMonth.amountLabel') : 'First monthly amount'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={firstMonthAmountInput}
                        onChange={(e) => {
                          setFirstMonthAmountInput(e.target.value);
                          setErrors((prev) => ({ ...prev, firstMonthAmount: '' }));
                        }}
                        placeholder="0.0"
                        className={`w-full px-4 py-3 pr-20 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg font-medium transition-all ${
                          errors.firstMonthAmount
                            ? 'border-red-500 focus:border-red-600'
                            : 'border-indigo-200 dark:border-indigo-800 focus:border-indigo-500'
                        } focus:outline-none focus:ring-4 focus:ring-indigo-500/20`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                        {formData.tokenSymbol}
                      </div>
                    </div>
                    {errors.firstMonthAmount && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {errors.firstMonthAmount}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {isMounted && translationsReady
                        ? t('create.firstMonth.info')
                        : '💡 If you enter the same amount as the monthly payment, this option will be ignored automatically.'}
                    </p>
                  </div>
                )}
              </div>
              </>
            )}

            <DateTimePicker
              value={formData.releaseDate}
              onChange={handleDateChange}
              error={errors.date}
              label=""
              hidePresets={true}
              disabled={paymentTiming === 'instant'}
            />

            {/* Info jour du mois si mensualisation */}
            {isRecurringMode && formData.releaseDate && (
              <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg">📅</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {isMounted && translationsReady
                      ? t('create.date.dayOfMonth', { day: formData.releaseDate.getDate() })
                      : `Debits will occur on the ${formData.releaseDate.getDate()} of each month`}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Section 4.5 : Type de paiement */}
      <div className="glass rounded-2xl p-6">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {isMounted && translationsReady ? t('create.paymentType.label') : '🔒 Payment type'}
          </label>
          
          {/* ✅ Message si paiement instantané */}
          {formData.releaseDate && (formData.releaseDate.getTime() - Date.now()) / 1000 < 60 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                <span className="text-lg">⚡</span>
                <span className="font-medium">
                  {translate('create.paymentType.instantDetected', 'Instant payment detected')}
                </span>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 ml-7">
                {translate(
                  'create.paymentType.instantDisabled',
                  'Cancellation options are disabled because the payment will be executed immediately.'
                )}
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            {/* ✅ Option Annulable - grisée si instantané */}
            <label
              className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
                formData.releaseDate && (formData.releaseDate.getTime() - Date.now()) / 1000 < 60
                  ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
                  : cancellable
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 cursor-pointer'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="paymentType"
                checked={cancellable}
                onChange={() => setCancellable(true)}
                disabled={formData.releaseDate && (formData.releaseDate.getTime() - Date.now()) / 1000 < 60}
                className="mt-1 w-5 h-5 text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔓</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {isMounted && translationsReady ? t('create.paymentType.cancellable.title') : 'Cancellable (before the date)'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isMounted && translationsReady
                    ? t('create.paymentType.cancellable.description')
                    : 'You will be able to cancel before the release date and recover the amount + protocol fees'}
                </p>
              </div>
            </label>

            {/* ✅ Option Définitif - grisée si instantané */}
            <label
              className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
                formData.releaseDate && (formData.releaseDate.getTime() - Date.now()) / 1000 < 60
                  ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
                  : !cancellable
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 cursor-pointer'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="paymentType"
                checked={!cancellable}
                onChange={() => setCancellable(false)}
                disabled={formData.releaseDate && (formData.releaseDate.getTime() - Date.now()) / 1000 < 60}
                className="mt-1 w-5 h-5 text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔒</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {isMounted && translationsReady ? t('create.paymentType.definitive.title') : 'Definitive (non-cancellable)'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isMounted && translationsReady ? t('create.paymentType.definitive.description') : 'Once created, impossible to cancel. Funds will be automatically released on the chosen date'}
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Section 5 : Récapitulatif frais */}
      {getAmountBigInt() && (
        <div className="glass rounded-2xl p-6">
          {/* Affichage spécifique pour paiement récurrent */}
          {isRecurringMode ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isMounted && translationsReady ? t('create.summary.title') : '💰 Summary'}
                </h3>
              </div>
              {/* Détails par mensualité */}
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    {isMounted && translationsReady ? t('create.date.beneficiaryWillReceive') : 'Beneficiary will receive (per month)'}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {recurringAmountValue.toFixed(2)} {formData.tokenSymbol}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    + {isMounted && translationsReady 
                      ? t('create.summary.protocolFees', { percentage: (recurringFeeBps / 100).toString() })
                      : `Protocol fees (${recurringFeeBps / 100}%)`}
                  </span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {recurringMonthlyFee.toFixed(6)} {formData.tokenSymbol}
                  </span>
                </div>

                <div className="border-t border-blue-200 dark:border-blue-800 pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {isMounted && translationsReady ? t('create.date.totalPerMonth') : 'TOTAL per monthly payment'}
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {recurringTotalPerMonth.toFixed(6)} {formData.tokenSymbol}
                  </span>
                </div>
              </div>

              {/* Calcul total */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    {isMounted && translationsReady ? t('create.date.numberOfMonths') : 'Number of months'}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    × {recurringMonths}
                  </span>
                </div>

                <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-3 flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {isMounted && translationsReady ? t('create.date.totalToApprove') : 'TOTAL to approve'}
                  </span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {recurringTotalToApprove.toFixed(6)} {formData.tokenSymbol}
                  </span>
                </div>
              </div>

              {/* Dates première et dernière échéance */}
              {formData.releaseDate && (
                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">🗓️</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {isMounted && translationsReady ? t('create.date.firstDueDate') : 'First due date:'}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formData.releaseDate.toLocaleDateString(locale, {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">📅</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {isMounted && translationsReady ? t('create.date.lastDueDate') : 'Last due date:'}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {(() => {
                        const lastDate = new Date(formData.releaseDate);
                        lastDate.setMonth(lastDate.getMonth() + recurringMonths - 1);
                        return lastDate.toLocaleDateString(locale, {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        });
                      })()}
                    </span>
                  </div>
                </div>
              )}

              {/* Message trésorerie */}
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="flex-1 text-sm text-green-800 dark:text-green-200">
                    <p className="font-semibold mb-1">
                      {isMounted && translationsReady ? t('create.date.treasuryRemainsAvailable') : 'Your treasury remains available'}
                    </p>
                    <p>
                      {isMounted && translationsReady ? (
                        <span dangerouslySetInnerHTML={{ __html: t('create.date.onlyAmountDebitedMonthly', { 
                          amount: recurringTotalPerMonth.toFixed(2),
                          token: formData.tokenSymbol,
                          defaultValue: `Only <strong>${recurringTotalPerMonth.toFixed(2)} ${formData.tokenSymbol}</strong> will be debited each month from your wallet.`
                        }) }} />
                      ) : (
                        <>
                          Only <span className="font-bold">{recurringTotalPerMonth.toFixed(2)} {formData.tokenSymbol}</span> will be debited each month from your wallet.
                        </>
                      )}
                    </p>
                    <p className="mt-2">
                      {isMounted && translationsReady
                        ? t('create.date.refundRemainingMonths', { defaultValue: 'If you cancel before execution, remaining months and their protocol fees are refunded.' })
                        : 'If you cancel before execution, remaining months and their protocol fees are refunded.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message d'avertissement SKIP */}
              <div className="bg-orange-50 dark:bg-orange-950/30 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">⚠️</span>
                  <div className="flex-1 space-y-2 text-sm text-orange-900 dark:text-orange-100">
                    <p className="font-bold text-base">
                      {isMounted && translationsReady
                        ? t('create.date.importantTitle', { defaultValue: 'Important information:' })
                        : 'Important information:'}
                    </p>
                    
                    <ul className="space-y-2 list-none">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: isMounted && translationsReady
                              ? t('create.date.important.balanceMonthly', {
                                  defaultValue:
                                    'Make sure you have enough balance <strong>EACH MONTH</strong> in your wallet to cover the debits'
                                })
                              : 'Make sure you have enough balance <strong>EACH MONTH</strong> in your wallet to cover the debits'
                          }}
                        />
                      </li>
                      
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: isMounted && translationsReady
                              ? t('create.date.important.failedMonth', {
                                  defaultValue:
                                    'If a debit fails (insufficient balance), that month is <strong class="text-red-600 dark:text-red-400">LOST</strong> and the system moves to the next month automatically'
                                })
                              : 'If a debit fails (insufficient balance), that month is <strong class="text-red-600 dark:text-red-400">LOST</strong> and the system moves to the next month automatically'
                          }}
                        />
                      </li>

                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: isMounted && translationsReady
                              ? t('create.date.important.firstMonthFailed', {
                                  defaultValue:
                                    'Important: if the first monthly payment fails, the contract <strong class="text-red-600 dark:text-red-400">stops</strong> and no further monthly payments will be executed.'
                                })
                              : 'Important: if the first monthly payment fails, the contract <strong class="text-red-600 dark:text-red-400">stops</strong> and no further monthly payments will be executed.'
                          }}
                        />
                      </li>
                      
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: isMounted && translationsReady
                              ? t('create.date.important.nextMonthsContinue', {
                                  defaultValue:
                                    'Next monthly payments will continue normally even if one month failed'
                                })
                              : 'Next monthly payments will continue normally even if one month failed'
                          }}
                        />
                      </li>
                      
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span>
                          {isMounted && translationsReady 
                            ? t('create.date.cancellableStopsPayments')
                            : <>Seule l'option <strong className="text-blue-600 dark:text-blue-400">"Annulable"</strong> dans le type de paiement permet de stopper définitivement la suite des mensualités via le dashboard</>}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Affichage normal pour paiement one-time ou batch */
            <FeeDisplay 
              amount={getAmountBigInt()! * BigInt(isBatchMode ? additionalBeneficiaries.length + 1 : 1)} 
              tokenSymbol={formData.tokenSymbol}
              releaseDate={formData.releaseDate}
            />
          )}
        </div>
      )}

      {/* Bouton submit */}
      <button
        type="submit"
        disabled={Object.values(errors).some((e) => e !== '') || activePayment.status !== 'idle'}
        className="w-full py-4 px-6 rounded-xl font-bold text-lg bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 text-white hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {activePayment.status !== 'idle' 
          ? (isMounted && translationsReady ? t('common.loading') : 'Creating...')
          : isRecurringMode
          ? (isMounted && translationsReady ? t('create.submit') + ` (${recurringMonths} ${isMounted && translationsReady ? t('create.date.monthsLabel').toLowerCase() : 'months'})` : `Create recurring payment (${recurringMonths} months)`)
          : isBatchMode 
          ? (isMounted && translationsReady ? t('create.submit') + ` (${additionalBeneficiaries.length + 1} ${isMounted && translationsReady ? t('create.beneficiary.additional').toLowerCase() : 'beneficiaries'})` : `Create batch payment (${additionalBeneficiaries.length + 1} beneficiaries)`)
          : (isMounted && translationsReady ? t('create.submit') : 'Create scheduled payment')}
      </button>

      {/* Modal de progression */}
      <PaymentProgressModal
        isOpen={activePayment.status !== 'idle'}
        status={activePayment.status}
        currentStep={activePayment.currentStep || 1}
        totalSteps={activePayment.totalSteps || 1}
        progressMessage={activePayment.progressMessage}
        error={activePayment.error}
        approveTxHash={(isRecurringMode && isBatchMode)
          ? undefined // Batch recurring n'expose pas l'approveTxHash
          : isRecurringMode
          ? recurringPayment.approveTxHash
          : (isBatchMode ? batchPayment.approveTxHash : singlePayment.approveTxHash)}
        createTxHash={activePayment.createTxHash}
        contractAddress={activePayment.contractAddress}
        tokenSymbol={formData.tokenSymbol}
        onClose={handleCloseModal}
        onViewPayment={handleViewPayment}
      />
    </form>
  );
}

/**
 * CHAT-OWN-016 — jedno zrodlo komunikatu o bledzie dostawcy AI w Czacie.
 *
 * Przed naprawa kazde wolanie modelu tlumaczylo blad po swojemu: `api.ts` mialo
 * zagniezdzony ternary z twardymi napisami PL/EN, `teresaRuntimeCopy.ts` swoje
 * dwa zdania bez `t()`, a kanwa Czatu (`useCanvasAIStream`) pokazywala WPROST
 * tresc z serwera (`data.message`, `err.message`). Ta funkcja jest jedynym
 * miejscem, ktore zamienia kod bledu na zdanie dla czlowieka.
 *
 * Zasada: uzytkownik dostaje CO SIE STALO + CO MOZE ZROBIC. Zero technikaliow —
 * nazw modeli, adresow, kodow HTTP, nazw zmiennych srodowiskowych.
 * Diagnostyka administratora jest osobna sciezka (`formatTeresaAdminDiagnostic`).
 */

export type AiErrorCode =
  | 'AI_RATE_LIMIT'
  | 'AI_UNAVAILABLE'
  | 'AI_CONFIG'
  | 'AI_TIMEOUT'
  | 'AI_STREAM_INTERRUPTED'
  | 'AI_EMPTY'
  | 'AI_ERROR';

export type AiErrorTone = 'danger' | 'warning';

export interface AiErrorCopy {
  code: AiErrorCode;
  /** Co sie stalo — jedno zdanie. */
  message: string;
  /** Co uzytkownik moze z tym zrobic — jedno zdanie. */
  action: string;
  /** Semantyka koloru: `c-warning` dla przejsciowych, `c-danger` dla trwalych. */
  tone: AiErrorTone;
}

type TFunc = (key: string, defaultValue?: string) => string;

/**
 * Kody, ktore serwer emitowal PRZED naprawa (pole `code`) — mapujemy je na
 * kanoniczne, zeby stare wdrozenie backendu tez dostalo zrozumiale zdanie.
 */
const LEGACY_TO_CANONICAL: Record<string, AiErrorCode> = {
  RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  CIRCUIT_OPEN: 'AI_UNAVAILABLE',
  PROVIDER_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  NO_LLM_PROVIDER: 'AI_CONFIG',
  INVALID_API_KEY: 'AI_CONFIG',
  LOCAL_LLM_DISABLED: 'AI_CONFIG',
  LOCAL_LLM_ENDPOINT_NOT_ALLOWED: 'AI_CONFIG',
  MODEL_NOT_FOUND: 'AI_CONFIG',
  AI_CONFIG: 'AI_CONFIG',
  AI_TIMEOUT: 'AI_TIMEOUT',
  TIMEOUT: 'AI_TIMEOUT',
  EMPTY_STREAM: 'AI_EMPTY',
  EMPTY_LLM_RESPONSE: 'AI_EMPTY',
  AI_EMPTY: 'AI_EMPTY',
  PARTIAL_RECOVERY_NOT_FOUND: 'AI_STREAM_INTERRUPTED',
  PARTIAL_RECOVERY_UNAVAILABLE: 'AI_STREAM_INTERRUPTED',
  PARTIAL_RECOVERY_SUPERSEDED: 'AI_STREAM_INTERRUPTED',
  AI_STREAM_INTERRUPTED: 'AI_STREAM_INTERRUPTED',
  STREAM_ERROR: 'AI_ERROR',
  AI_STREAM_ERROR: 'AI_ERROR',
  AI_PIPELINE_ERROR: 'AI_ERROR',
  LLM_CALL_FAILED: 'AI_ERROR',
  E2E_STREAM_ERROR: 'AI_ERROR',
  AI_ERROR: 'AI_ERROR',
  UNKNOWN_ERROR: 'AI_ERROR',
};

const TONE: Record<AiErrorCode, AiErrorTone> = {
  AI_RATE_LIMIT: 'warning',
  AI_UNAVAILABLE: 'warning',
  AI_TIMEOUT: 'warning',
  AI_STREAM_INTERRUPTED: 'warning',
  AI_EMPTY: 'warning',
  AI_CONFIG: 'danger',
  AI_ERROR: 'danger',
};

/** Segment klucza i18n dla danego kodu. */
const SLUG: Record<AiErrorCode, string> = {
  AI_RATE_LIMIT: 'rateLimit',
  AI_UNAVAILABLE: 'unavailable',
  AI_CONFIG: 'config',
  AI_TIMEOUT: 'timeout',
  AI_STREAM_INTERRUPTED: 'interrupted',
  AI_EMPTY: 'empty',
  AI_ERROR: 'generic',
};

/** Awaryjne teksty EN — gdy `t()` nie znajdzie klucza. */
const FALLBACK_EN: Record<AiErrorCode, { message: string; action: string }> = {
  AI_RATE_LIMIT: {
    message: 'The assistant is handling too many requests right now.',
    action: 'Please wait a moment and send your message again.',
  },
  AI_UNAVAILABLE: {
    message: 'The assistant is temporarily unavailable.',
    action: 'Try again shortly, or switch to a different model.',
  },
  AI_CONFIG: {
    message: 'The assistant is not available on this account.',
    action: 'Please contact your administrator.',
  },
  AI_TIMEOUT: {
    message: 'The assistant took too long to answer.',
    action: 'Try again, or shorten your question.',
  },
  AI_STREAM_INTERRUPTED: {
    message: 'The answer was interrupted before it finished.',
    action: 'Send the message again to get the full answer.',
  },
  AI_EMPTY: {
    message: 'The assistant returned no answer.',
    action: 'Try again, or rephrase your question.',
  },
  AI_ERROR: {
    message: 'The assistant could not complete this request.',
    action: 'Try again. If it keeps happening, contact your administrator.',
  },
};

/** Sprowadza dowolny kod (nowy `errorCode` lub stary `code`) do kanonicznego. */
export function resolveAiErrorCode(raw?: unknown): AiErrorCode {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  return LEGACY_TO_CANONICAL[key] || 'AI_ERROR';
}

/** Odczytuje kod z obiektu bledu / ramki SSE — `errorCode` ma pierwszenstwo. */
export function readAiErrorCode(source: unknown): AiErrorCode {
  const s = (source || {}) as Record<string, unknown>;
  const candidate = s.errorCode ?? s.code ?? source;
  return resolveAiErrorCode(candidate);
}

/** JEDYNE wejscie widoku: kod -> zdanie dla czlowieka + podpowiedz dzialania. */
export function getAiErrorCopy(t: TFunc, source: unknown): AiErrorCopy {
  const code = readAiErrorCode(source);
  const slug = SLUG[code];
  const fb = FALLBACK_EN[code];
  return {
    code,
    message: t(`aiChat.providerError.${slug}.message`, fb.message),
    action: t(`aiChat.providerError.${slug}.action`, fb.action),
    tone: TONE[code],
  };
}

/** Jedno-liniowa wersja do dymkow/toastow, gdzie nie ma miejsca na dwa wiersze. */
export function getAiErrorLine(t: TFunc, source: unknown): string {
  const copy = getAiErrorCopy(t, source);
  return `${copy.message} ${copy.action}`.trim();
}

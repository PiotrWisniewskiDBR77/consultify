/**
 * CHAT-OWN-016 — jeden mapper bledow dostawcy AI.
 *
 * Powod (pomiar 2026-09-03, `evidence/grafika/chat-blad-dostawcy-20260903.md`):
 * `/api/ai/chat/stream` odsylalo do klienta SUROWA tresc bledu dostawcy
 * (`error: (err as Error).message`) w dwoch miejscach — glownym `catch` streamu
 * i galezi „pipeline zwrocil success:false". Trafialy tam m.in. identyfikatory
 * modeli, adresy endpointow, tekst wylacznika („Circuit [openrouter] is OPEN")
 * oraz komunikaty dostawcy echa klucza („Incorrect API key provided: sk-...").
 * Dodatkowo ramka `NO_LLM_PROVIDER` dyktowala uzytkownikowi nazwy zmiennych
 * srodowiskowych i tabeli `llm_providers`.
 *
 * Kontrakt: tresc dostawcy zostaje w LOGU SERWERA (`logMessage`), do klienta
 * idzie wylacznie `safeMessage` + `errorCode`. `legacyCode` zachowuje istniejacy
 * kontrakt drutu (`code`), zeby nie zerwac klientow i testow sprzed naprawy.
 */

export type AiErrorCode =
  | 'AI_RATE_LIMIT'
  | 'AI_UNAVAILABLE'
  | 'AI_CONFIG'
  | 'AI_TIMEOUT'
  | 'AI_STREAM_INTERRUPTED'
  | 'AI_EMPTY'
  | 'AI_ERROR';

export interface MappedProviderError {
  /** Kod HTTP dla odpowiedzi nie-strumieniowych. */
  httpStatus: number;
  /** Kanoniczny kod dla frontu (klucz komunikatu). */
  errorCode: AiErrorCode;
  /** Dotychczasowy kod na drucie — zachowany dla zgodnosci wstecz. */
  legacyCode: string;
  /** Krotki, bezpieczny komunikat. ZERO tresci dostawcy. */
  safeMessage: string;
  /** Surowa tresc — WYLACZNIE do logu serwera, nigdy do odpowiedzi. */
  logMessage: string;
  /** Czy uzytkownik ma sens ponawiac. */
  retryable: boolean;
}

/** Bezpieczne komunikaty. Zero nazw modeli, endpointow, zmiennych i kluczy. */
const SAFE_MESSAGE: Record<AiErrorCode, string> = {
  AI_RATE_LIMIT: 'The AI assistant is busy right now. Please try again in a moment.',
  AI_UNAVAILABLE: 'The AI assistant is temporarily unavailable. Please try again shortly.',
  AI_CONFIG: 'The AI assistant is not available on this account. Please contact your administrator.',
  AI_TIMEOUT: 'The AI assistant took too long to answer. Please try again.',
  AI_STREAM_INTERRUPTED: 'The answer was interrupted before it finished. Please try again.',
  AI_EMPTY: 'The AI assistant returned no answer. Please try again.',
  AI_ERROR: 'The AI assistant could not complete this request. Please try again.',
};

const HTTP_STATUS: Record<AiErrorCode, number> = {
  AI_RATE_LIMIT: 429,
  AI_UNAVAILABLE: 503,
  AI_CONFIG: 503,
  AI_TIMEOUT: 504,
  AI_STREAM_INTERRUPTED: 502,
  AI_EMPTY: 502,
  AI_ERROR: 502,
};

const RETRYABLE: Record<AiErrorCode, boolean> = {
  AI_RATE_LIMIT: true,
  AI_UNAVAILABLE: true,
  AI_CONFIG: false,
  AI_TIMEOUT: true,
  AI_STREAM_INTERRUPTED: true,
  AI_EMPTY: true,
  AI_ERROR: true,
};

/** Kody, ktore juz gdzies w kodzie krazyly — mapowane wprost. */
const CODE_TO_CANONICAL: Record<string, AiErrorCode> = {
  NO_LLM_PROVIDER: 'AI_CONFIG',
  INVALID_API_KEY: 'AI_CONFIG',
  LOCAL_LLM_DISABLED: 'AI_CONFIG',
  LOCAL_LLM_ENDPOINT_NOT_ALLOWED: 'AI_CONFIG',
  MODEL_NOT_FOUND: 'AI_CONFIG',
  RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  CIRCUIT_OPEN: 'AI_UNAVAILABLE',
  PROVIDER_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_TIMEOUT: 'AI_TIMEOUT',
  TIMEOUT: 'AI_TIMEOUT',
  EMPTY_STREAM: 'AI_EMPTY',
  EMPTY_LLM_RESPONSE: 'AI_EMPTY',
  AI_EMPTY: 'AI_EMPTY',
  PARTIAL_RECOVERY_NOT_FOUND: 'AI_STREAM_INTERRUPTED',
  PARTIAL_RECOVERY_UNAVAILABLE: 'AI_STREAM_INTERRUPTED',
  PARTIAL_RECOVERY_SUPERSEDED: 'AI_STREAM_INTERRUPTED',
  AI_STREAM_INTERRUPTED: 'AI_STREAM_INTERRUPTED',
};

function readStatus(err: unknown): number | null {
  const e = (err || {}) as Record<string, any>;
  const raw = e?.status ?? e?.statusCode ?? e?.httpStatus ?? e?.response?.status;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 100 && n <= 599 ? n : null;
}

function readRawMessage(err: unknown): string {
  if (err instanceof Error) return String(err.message || '');
  const e = (err || {}) as Record<string, any>;
  if (typeof e?.message === 'string') return e.message;
  if (typeof e?.error === 'string') return e.error;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err ?? '');
  } catch {
    return String(err ?? '');
  }
}

/**
 * Klasyfikacja: najpierw jawny `code`, potem status HTTP dostawcy, na koncu
 * wzorce w surowej tresci. Kolejnosc ma znaczenie — 429 wygrywa z „unavailable".
 */
export function classifyProviderError(err: unknown): AiErrorCode {
  const e = (err || {}) as Record<string, any>;
  const explicit = typeof e?.code === 'string' ? e.code.trim().toUpperCase() : '';
  if (explicit && CODE_TO_CANONICAL[explicit]) return CODE_TO_CANONICAL[explicit];

  const msg = readRawMessage(err);
  const status = readStatus(err);

  if (status === 429 || /\b429\b|rate[ _-]?limit|too many requests|quota/i.test(msg)) {
    return 'AI_RATE_LIMIT';
  }
  if (
    status === 401 ||
    status === 403 ||
    /invalid[_ ]?api[_ ]?key|incorrect api key|unauthorized|authentication|no llm provider|not configured|model .*(not found|does not exist)|unknown model/i.test(
      msg
    )
  ) {
    return 'AI_CONFIG';
  }
  if (/timeout|timed out|etimedout|esockettimedout|deadline exceeded/i.test(msg)) {
    return 'AI_TIMEOUT';
  }
  if (
    /econnreset|socket hang up|premature close|aborted|stream (closed|interrupted)|epipe|incomplete/i.test(
      msg
    )
  ) {
    return 'AI_STREAM_INTERRUPTED';
  }
  if (
    (status !== null && status >= 500) ||
    /circuit.*open|service unavailable|bad gateway|econnrefused|enotfound|fetch failed|overloaded/i.test(
      msg
    )
  ) {
    return 'AI_UNAVAILABLE';
  }
  return 'AI_ERROR';
}

/**
 * Jedyne wejscie dla tras. `legacyCode` pozwala trasie zachowac kod, ktory juz
 * jest na drucie (np. `AI_STREAM_ERROR`), nie tracac kanonicznego `errorCode`.
 */
export function mapProviderError(
  err: unknown,
  options?: { legacyCode?: string | null }
): MappedProviderError {
  const errorCode = classifyProviderError(err);
  const legacyFromErr =
    typeof (err as any)?.code === 'string' && (err as any).code.trim().length > 0
      ? String((err as any).code).trim()
      : null;
  return {
    httpStatus: HTTP_STATUS[errorCode],
    errorCode,
    legacyCode: options?.legacyCode || legacyFromErr || errorCode,
    safeMessage: SAFE_MESSAGE[errorCode],
    logMessage: readRawMessage(err).slice(0, 500),
    retryable: RETRYABLE[errorCode],
  };
}

/** Cialo odpowiedzi HTTP (nie-strumieniowej) — nic poza bezpieczna trescia. */
export function toSafeErrorBody(mapped: MappedProviderError): Record<string, unknown> {
  return { error: mapped.safeMessage, code: mapped.legacyCode, errorCode: mapped.errorCode };
}

/** Ramka SSE — ten sam ksztalt co dotad plus kanoniczny `errorCode`. */
export function toSafeSseFrame(
  mapped: MappedProviderError,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    error: mapped.safeMessage,
    code: mapped.legacyCode,
    errorCode: mapped.errorCode,
    ...(extra || {}),
  };
}

/**
 * Bezpiecznik testowy: czy ciag zawiera cokolwiek, co pachnie trescia dostawcy.
 * Uzywany przez test negatywny — gdy do odpowiedzi wroci surowa tresc, czerwono.
 */
export function looksLikeProviderDetail(value: string): boolean {
  return /sk-[a-z0-9-]{6,}|openrouter|openai|anthropic|api\.[a-z0-9.-]+\/|https?:\/\/|circuit \[|gpt-[0-9]|claude-[0-9]|gemma|llama|at .*\(.*:\d+:\d+\)|OPENROUTER_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|llm_providers/i.test(
    String(value || '')
  );
}

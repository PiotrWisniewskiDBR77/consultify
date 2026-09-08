/**
 * J17 — JEDEN helper tłumaczący błąd z API na zdanie w języku interfejsu.
 *
 * PROBLEM, KTÓRY ROZWIĄZUJE (pomiar 2026-09-08, kategoria K5pl = 258):
 * serwer w 222 z 258 miejsc JUŻ wysyłał maszynowy `code`, a front i tak renderował
 * pole `error` — czyli polskie zdanie. Użytkownik wersji angielskiej widział polski
 * komunikat błędu. Mechanizmu NIE budujemy od nowa: korzystamy z istniejącego
 * `normalizeApiError` (czyta `code` i `errorCode`) i dokładamy warstwę tłumaczenia.
 *
 * KONTRAKT (celowo w tej kolejności):
 *   1. jest kod i znamy go  -> t('errors.<KOD>', angielski fallback z kodu)
 *   2. jest kod, nie znamy go -> t('errors.API_ERROR_GENERIC', generyczne EN)
 *      — NIGDY nie pokazujemy zdania z serwera, bo bywa po polsku.
 *   3. nie ma kodu w ogóle  -> stare pole `error`/`message` (dług, patrz niżej)
 *
 * Punkt 3 to ŚWIADOMY DŁUG, nie niedopatrzenie: 36 z 258 miejsc serwera nie miało
 * kodu w chwili pisania tego pliku, a bez tej gałęzi ekran pokazałby pustkę zamiast
 * czegokolwiek. Gałąź znika, gdy każdy `res.status(4xx)` ma kod — pilnuje tego test
 * źródłowy `tests/unit/i18n/serverErrorCodeRatchet.test.mjs`.
 */
import { normalizeApiError, type NormalizedApiError } from './apiError';
import { API_ERROR_FALLBACKS_EN, API_ERROR_GENERIC_EN } from './apiErrorFallbacks';

export type TranslateFn = (key: string, defaultValue: string) => string;

export const API_ERROR_GENERIC_KEY = 'errors.API_ERROR_GENERIC';

export interface TranslatedApiError {
  /** Zdanie do pokazania użytkownikowi — zawsze w języku interfejsu. */
  message: string;
  /** Kod maszynowy, gdy serwer go przysłał (do dziennika i do testów). */
  code?: string;
  status?: number;
  /** `true`, gdy zdanie pochodzi z pola `error`/`message` serwera (dług J17). */
  fromServerText: boolean;
}

/** Czy kod ma autoryzowane angielskie zdanie (a więc i wpis w `errors.*`). */
export function isKnownApiErrorCode(code: string | undefined | null): boolean {
  return Boolean(code && Object.prototype.hasOwnProperty.call(API_ERROR_FALLBACKS_EN, code));
}

/**
 * Pełny wynik — gdy wołający potrzebuje też kodu (dziennik, telemetria, test).
 * Do samego renderowania użyj `translateApiError`.
 */
export function resolveApiError(input: unknown, t: TranslateFn): TranslatedApiError {
  // `fallback` puste, żeby odróżnić „serwer nic nie przysłał" od realnego zdania:
  // `normalizeApiError` przy braku treści wstawia własny angielski domyślny tekst,
  // a my chcemy w tym wypadku wejść w gałąź generyczną, nie renderować jego stałej.
  const normalized: NormalizedApiError = normalizeApiError(input, '');
  const code = normalized.code;

  if (isKnownApiErrorCode(code)) {
    return {
      message: t(`errors.${code}`, API_ERROR_FALLBACKS_EN[code as string]),
      code,
      status: normalized.status,
      fromServerText: false,
    };
  }

  if (code) {
    return {
      message: t(API_ERROR_GENERIC_KEY, API_ERROR_GENERIC_EN),
      code,
      status: normalized.status,
      fromServerText: false,
    };
  }

  const serverText = normalized.message?.trim();
  if (serverText) {
    return { message: serverText, status: normalized.status, fromServerText: true };
  }

  return {
    message: t(API_ERROR_GENERIC_KEY, API_ERROR_GENERIC_EN),
    status: normalized.status,
    fromServerText: false,
  };
}

/** Zdanie dla użytkownika. Nigdy nie zwraca pustki i nigdy samego kodu. */
export function translateApiError(input: unknown, t: TranslateFn): string {
  return resolveApiError(input, t).message;
}

/**
 * SSOT języka odpowiedzi Teresy (2026-09-06).
 *
 * PRZYCZYNA (zmierzona na stanowisku lokalnym 05.09, `/private/tmp/stanowisko-noc/teresa-stream.txt`):
 * `POST /api/ai/chat/stream` z polskim pytaniem odpowiadał po angielsku —
 * "I operate in English; please continue in that language."
 *
 * Rozjazd był w CZTERECH miejscach, każde z własnym `|| 'en'`:
 *   - `routes/ai.routes.ts` (`/chat/stream`, `/chat/confirm`) — `(language || 'en').split('-')[0]`
 *     czytane WYŁĄCZNIE z `req.body.language`; wołacz, który go nie poda (a takich jest
 *     kilkanaście: `useIndependentAI`, `AICommandPrompt`, `useCanvasAIStream`, każde
 *     wywołanie API spoza UI), dostaje angielski.
 *   - `services/ai/AIPipeline.ts` — `authoritativeLanguage` i `langBaseFinal` domyślnie `'en'`.
 *   - `ai/persona.ts` — `detectLanguage()` domyślnie `'en'`.
 *
 * SSOT (`docs/ssot/ZASADY_AI_TERESA_SSOT.md` §8 J1) mówi wprost:
 * „**Polski jest domyślny** dla całego UI Teresy i dla treści generowanych;
 *  angielski tylko na jawne żądanie użytkownika."
 *
 * Ten moduł jest jedynym miejscem, w którym rozstrzyga się język odpowiedzi
 * i buduje instrukcję językową dla modelu. Kolejność rozstrzygania:
 *   1. jawny wybór z żądania (`body.language` / `options.language` / `context.language`)
 *   2. język wątku (`conversationLanguage`)
 *   3. profil użytkownika (`users.language` — migracja `20260726_users_language_preference.sql`)
 *   4. nagłówek `Accept-Language`
 *   5. `pl` (domyślny — NIE `en`)
 */

export type AiLanguage = 'pl' | 'en' | 'de' | 'es' | 'ja' | 'ar';

/** Domyślny język Teresy. Zmiana tej stałej zmienia zachowanie CAŁEJ aplikacji. */
export const DEFAULT_AI_LANGUAGE: AiLanguage = 'pl';

/** Etykiety podawane modelowi — pełna nazwa + endonim, żeby model nie zgadywał. */
export const AI_LANGUAGE_LABELS: Record<AiLanguage, string> = {
  pl: 'Polish (Polski)',
  en: 'English',
  de: 'German (Deutsch)',
  es: 'Spanish (Español)',
  ja: 'Japanese (日本語)',
  ar: 'Arabic (العربية)',
};

const ALIASES: Record<string, AiLanguage> = {
  jp: 'ja',
  pol: 'pl',
  eng: 'en',
};

/**
 * Sprowadza dowolny zapis locale (`pl-PL`, `PL`, `pl_PL`, `jp`) do wspieranego kodu.
 * Zwraca `null`, gdy wejście jest puste / nieznane — WOŁAJĄCY decyduje o domyślce,
 * dzięki czemu `resolveAiLanguage` potrafi przejść do kolejnego kandydata.
 */
export function normalizeAiLanguage(raw: unknown): AiLanguage | null {
  if (typeof raw !== 'string') return null;
  const base = raw.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
  if (!base) return null;
  if (base in AI_LANGUAGE_LABELS) return base as AiLanguage;
  if (base in ALIASES) return ALIASES[base];
  return null;
}

/**
 * Pierwszy kandydat, który daje się znormalizować, wygrywa.
 * Gdy żaden — `DEFAULT_AI_LANGUAGE` (`pl`).
 */
export function resolveAiLanguage(...candidates: Array<unknown>): AiLanguage {
  for (const candidate of candidates) {
    const normalized = normalizeAiLanguage(candidate);
    if (normalized) return normalized;
  }
  return DEFAULT_AI_LANGUAGE;
}

/**
 * `Accept-Language: pl-PL,pl;q=0.9,en-US;q=0.8` → `pl`.
 * Bierze pod uwagę wagi `q` i pomija `*`.
 */
export function parseAcceptLanguage(header: unknown): AiLanguage | null {
  if (typeof header !== 'string' || !header.trim()) return null;
  const entries = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((e) => e.tag && e.tag !== '*')
    .sort((a, b) => b.q - a.q);
  for (const entry of entries) {
    const normalized = normalizeAiLanguage(entry.tag);
    if (normalized) return normalized;
  }
  return null;
}

/**
 * Instrukcja językowa wstrzykiwana do promptu systemowego.
 *
 * MUTACJA (test `languagePolicy.test.ts`): usunięcie z tego napisu nazwy języka
 * albo słowa `LANGUAGE INSTRUCTION` wywraca test — to jedyny mechanizm, który
 * wymusza język odpowiedzi na modelu, więc nie wolno go „uprościć".
 */
export function buildLanguageInstruction(language: AiLanguage): string {
  const label = AI_LANGUAGE_LABELS[language];
  return (
    `[LANGUAGE INSTRUCTION: You MUST always respond in ${label}. ` +
    `This is the user's application language and takes absolute priority over any other hint ` +
    `(memory, organization terminology, prior conversation, the language of the question). ` +
    `Even if the user writes their message in a different language, your response must be in ${label}. ` +
    `Never mix languages within a single response. Never answer with a meta-remark about which ` +
    `language you operate in — just answer in ${label}. This is non-negotiable.]`
  );
}

/** Kształt żądania, jakiego potrzebujemy — celowo minimalny, żeby test nie musiał budować Expressa. */
export interface LanguageRequestLike {
  body?: Record<string, unknown> | null;
  headers?: Record<string, unknown> | null;
  get?: (name: string) => string | undefined;
  userId?: string | null;
  user?: { id?: string | null; language?: string | null; preferred_language?: string | null } | null;
}

/**
 * Synchroniczne rozstrzygnięcie języka z samego żądania (bez zapytania do bazy).
 * Używane wszędzie tam, gdzie nie chcemy dokładać zapytania na ścieżce gorącej.
 */
export function resolveAiLanguageFromRequest(
  req: LanguageRequestLike | null | undefined,
  explicit?: unknown
): AiLanguage {
  const body = (req?.body || {}) as Record<string, unknown>;
  const headers = (req?.headers || {}) as Record<string, unknown>;
  const acceptLanguage =
    (typeof req?.get === 'function' ? req.get('Accept-Language') : undefined) ??
    (headers['accept-language'] as string | undefined) ??
    (headers['Accept-Language'] as string | undefined);

  return resolveAiLanguage(
    explicit,
    body.language,
    (body.context as Record<string, unknown> | undefined)?.language,
    req?.user?.language,
    req?.user?.preferred_language,
    parseAcceptLanguage(acceptLanguage)
  );
}

/**
 * Pełne rozstrzygnięcie: jak wyżej, ale gdy nic z żądania nie wskazuje języka,
 * dociąga `users.language` z bazy (SSOT preferencji — migracja 20260726).
 *
 * Odczyt jest best-effort: błąd bazy NIE wywraca czatu, tylko cofa nas do
 * `Accept-Language` → `pl`. Fail-safe jest tu polski, nie angielski.
 */
export async function resolveAiLanguageForRequest(
  req: LanguageRequestLike | null | undefined,
  explicit?: unknown
): Promise<AiLanguage> {
  const body = (req?.body || {}) as Record<string, unknown>;
  const fromRequest = resolveAiLanguage(
    explicit,
    body.language,
    (body.context as Record<string, unknown> | undefined)?.language,
    req?.user?.language,
    req?.user?.preferred_language
  );
  // Wprost wybrany język (albo profil już w tokenie) — nie ruszamy bazy.
  if (
    normalizeAiLanguage(explicit) ||
    normalizeAiLanguage(body.language) ||
    normalizeAiLanguage((body.context as Record<string, unknown> | undefined)?.language) ||
    normalizeAiLanguage(req?.user?.language) ||
    normalizeAiLanguage(req?.user?.preferred_language)
  ) {
    return fromRequest;
  }

  const userId = req?.userId || req?.user?.id || null;
  if (userId) {
    try {
      const { get: dbGet } = await import('../../utils/DbPromise.js');
      const row: any = await dbGet('SELECT language FROM users WHERE id = ?', [userId]);
      const fromProfile = normalizeAiLanguage(row?.language);
      if (fromProfile) return fromProfile;
    } catch {
      // Kolumna/baza niedostępna — schodzimy do nagłówka i domyślnego `pl`.
    }
  }

  return resolveAiLanguageFromRequest(req, explicit);
}

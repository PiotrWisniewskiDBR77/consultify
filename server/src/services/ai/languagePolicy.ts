/**
 * SSOT języka odpowiedzi Teresy (DEC-510, 2026-09-14).
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
 * Ten moduł jest jedynym miejscem, w którym rozstrzyga się locale odpowiedzi
 * i buduje końcową instrukcję językową dla modelu. Jawny wybór w żądaniu jest
 * zachowaną ścieżką kompatybilności. Bez niego obowiązuje kolejność DEC-510:
 * `users.language` → legacy `users.locale` → `organizations.default_language` → `en`.
 */

export type AiLanguage = 'pl' | 'en' | 'de' | 'es' | 'ja' | 'ar';

/** Domyślny język Teresy. Zmiana tej stałej zmienia zachowanie CAŁEJ aplikacji. */
export const DEFAULT_AI_LANGUAGE: AiLanguage = 'en';

export type ResolvedLocale = AiLanguage;

/**
 * Języki, które wolno przyjąć BEZ jawnego wyboru użytkownika (DEC-511, 2026-09-14).
 *
 * PRZYCZYNA (zgłoszenie testera `78e8df54`, staging 14.09 06:31 UTC): pytanie po
 * angielsku przy UI=EN dostało odpowiedź po niemiecku. Front wysyła w
 * `body.language` język WĄTKU (`chatLanguageByConversationId`), a
 * `resolveLocale()` traktuje każdą wartość z żądania jako „jawny wybór", więc
 * `users.language` nigdy nie było czytane — język raz przyklejony do wątku
 * wygrywał z profilem użytkownika na zawsze.
 *
 * Decyzja CTO: profil (`users.language`) ma pierwszeństwo przed językiem wątku,
 * a język spoza tej listy może wejść WYŁĄCZNIE jako jawny wybór użytkownika.
 */
export const IMPLICIT_THREAD_LANGUAGES: readonly AiLanguage[] = ['en', 'pl'];

export function isImplicitThreadLanguage(language: unknown): boolean {
  const normalized = normalizeAiLanguage(language);
  return !!normalized && IMPLICIT_THREAD_LANGUAGES.includes(normalized);
}

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

const FINAL_LOCALE_MARKER = '[FINAL RESPONSE LANGUAGE]';
const FINAL_LOCALE_BLOCK = new RegExp(
  `\\n*\\${FINAL_LOCALE_MARKER}\\n\\[LANGUAGE INSTRUCTION:[^\\n]*\\]\\nAnswer in (?:pl|en|de|es|ja|ar)\\.\\n*`,
  'g'
);

/**
 * Dopina jedną, idempotentną instrukcję na sam koniec promptu systemowego.
 * Ostatnia linia jest celowo krótka i jednoznaczna dla każdego providera.
 */
export function withResolvedLocaleInstruction(systemPrompt: string, locale: unknown): string {
  const resolvedLocale = resolveAiLanguage(locale);
  const undecorated = String(systemPrompt || '').replace(FINAL_LOCALE_BLOCK, '\n\n').trim();
  const finalBlock = `${FINAL_LOCALE_MARKER}\n${buildLanguageInstruction(resolvedLocale)}\nAnswer in ${resolvedLocale}.`;
  return undecorated ? `${undecorated}\n\n${finalBlock}` : finalBlock;
}

/** Kształt żądania, jakiego potrzebujemy — celowo minimalny, żeby test nie musiał budować Expressa. */
export interface LanguageRequestLike {
  body?: Record<string, unknown> | null;
  headers?: Record<string, unknown> | null;
  get?: (name: string) => string | undefined;
  userId?: string | null;
  organizationId?: string | null;
  resolvedLocale?: ResolvedLocale;
  user?: {
    id?: string | null;
    language?: string | null;
    locale?: string | null;
    preferred_language?: string | null;
    organizationId?: string | null;
    organization_id?: string | null;
  } | null;
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
 * Ogólny resolver DEC-510. Jawny wybór żądania jest kompatybilnym override'em;
 * poza nim kolejność jest stała: profil kanoniczny, profil legacy, organizacja,
 * angielski. Wynik zapisujemy również na `req.resolvedLocale`.
 */
export async function resolveLocale(
  req: LanguageRequestLike | null | undefined,
  explicit?: unknown
): Promise<ResolvedLocale> {
  const body = (req?.body || {}) as Record<string, unknown>;
  const explicitRequestLocale =
    normalizeAiLanguage(explicit) ||
    normalizeAiLanguage(body.language) ||
    normalizeAiLanguage((body.context as Record<string, unknown> | undefined)?.language);
  if (explicitRequestLocale) {
    if (req) req.resolvedLocale = explicitRequestLocale;
    return explicitRequestLocale;
  }

  const profileLocale = await resolveProfileLocale(req);
  if (profileLocale) return profileLocale;

  if (req) req.resolvedLocale = DEFAULT_AI_LANGUAGE;
  return DEFAULT_AI_LANGUAGE;
}

/**
 * Locale wynikające z TOŻSAMOŚCI użytkownika (token → `users.language` → legacy
 * `users.locale` → `organizations.default_language`). Zwraca `null`, gdy żadne
 * z tych źródeł nic nie mówi — dzięki temu wołający może rozstrzygnąć sam
 * (np. dopuścić język wątku), zamiast dostać przedwczesną domyślkę `en`.
 */
export async function resolveProfileLocale(
  req: LanguageRequestLike | null | undefined
): Promise<ResolvedLocale | null> {
  const alreadyResolved = normalizeAiLanguage(req?.resolvedLocale);
  if (alreadyResolved) return alreadyResolved;

  const tokenLanguage = normalizeAiLanguage(req?.user?.language);
  if (tokenLanguage) {
    if (req) req.resolvedLocale = tokenLanguage;
    return tokenLanguage;
  }
  const tokenLegacyLocale = normalizeAiLanguage(req?.user?.locale ?? req?.user?.preferred_language);
  if (tokenLegacyLocale) {
    if (req) req.resolvedLocale = tokenLegacyLocale;
    return tokenLegacyLocale;
  }

  let organizationId =
    req?.organizationId || req?.user?.organizationId || req?.user?.organization_id || null;
  const userId = req?.userId || req?.user?.id || null;
  try {
    const { get: dbGet } = await import('../../utils/DbPromise.js');
    if (userId) {
      // `to_jsonb` keeps the legacy locale read compatible with installations
      // where the physical `users.locale` column has already been removed.
      const row: any = await dbGet(
        `SELECT to_jsonb(u)->>'language' AS language,
                to_jsonb(u)->>'locale' AS locale,
                organization_id
           FROM users u
          WHERE id = ?`,
        [userId]
      );
      organizationId = organizationId || row?.organization_id || null;
      const userLanguage = normalizeAiLanguage(row?.language);
      const legacyLocale = normalizeAiLanguage(row?.locale);
      const profileLocale = userLanguage || legacyLocale;
      if (profileLocale) {
        if (req) req.resolvedLocale = profileLocale;
        return profileLocale;
      }
    }

    if (organizationId) {
      const organization: any = await dbGet(
        'SELECT default_language FROM organizations WHERE id = ?',
        [organizationId]
      );
      const organizationLocale = normalizeAiLanguage(organization?.default_language);
      if (organizationLocale) {
        if (req) req.resolvedLocale = organizationLocale;
        return organizationLocale;
      }
    }
  } catch {
    // Locale lookup is fail-open for chat availability; DEC-510 fallback remains `en`.
  }

  return null;
}

export type ChatLanguageSource = 'explicit' | 'profile' | 'thread' | 'default';

export interface ChatLanguageDecision {
  language: ResolvedLocale;
  source: ChatLanguageSource;
}

/**
 * Język odpowiedzi czatu (DEC-511). Kolejność, w odróżnieniu od `resolveLocale`,
 * rozdziela JAWNY wybór użytkownika od języka WĄTKU przysłanego przez front:
 *
 *   1. `explicit`  — użytkownik sam wybrał język (selektor w czacie). Dowolny wspierany kod.
 *   2. profil      — `users.language` → legacy `users.locale` → `organizations.default_language`.
 *   3. `thread`    — język wątku, ale TYLKO gdy należy do `IMPLICIT_THREAD_LANGUAGES`.
 *   4. `en`.
 *
 * Skutek dla zgłoszenia `78e8df54`: wątek z historią DE przy `users.language='en'`
 * odpowiada po angielsku, a DE może wrócić wyłącznie po jawnym wyborze.
 */
export async function resolveChatResponseLanguage(
  req: LanguageRequestLike | null | undefined,
  options?: { explicit?: unknown; thread?: unknown }
): Promise<ChatLanguageDecision> {
  const explicit = normalizeAiLanguage(options?.explicit);
  if (explicit) {
    if (req) req.resolvedLocale = explicit;
    return { language: explicit, source: 'explicit' };
  }

  const profile = await resolveProfileLocale(req);
  if (profile) {
    if (req) req.resolvedLocale = profile;
    return { language: profile, source: 'profile' };
  }

  const thread = normalizeAiLanguage(options?.thread);
  if (thread && IMPLICIT_THREAD_LANGUAGES.includes(thread)) {
    if (req) req.resolvedLocale = thread;
    return { language: thread, source: 'thread' };
  }

  if (req) req.resolvedLocale = DEFAULT_AI_LANGUAGE;
  return { language: DEFAULT_AI_LANGUAGE, source: 'default' };
}

/** Compatibility alias retained for existing callers. */
export async function resolveAiLanguageForRequest(
  req: LanguageRequestLike | null | undefined,
  explicit?: unknown
): Promise<AiLanguage> {
  return resolveLocale(req, explicit);
}

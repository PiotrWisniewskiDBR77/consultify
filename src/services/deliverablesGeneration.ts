/**
 * Deliverables — lekki runtime: klient kontraktu generacji (L1, krok 5)
 *
 * Cienki klient async kontraktu POST /api/deliverables/generations
 * (plan → generate → poll) — docs/plans/DELIVERABLES_LIGHT_TARGET.md §2.2.
 * Włączany flagą VITE_ENABLE_DELIVERABLES_LIGHT (frontend) w parze
 * z ENABLE_DELIVERABLES_LIGHT (backend); obie off ⇒ legacy nawigacja
 * do /prezentacje pozostaje bez zmian.
 */

import { Api } from '@/services/api';

export type DeliverableGenerationState =
  | 'requested'
  | 'planning'
  | 'plan_ready'
  | 'generating'
  | 'validating'
  | 'draft'
  | 'error';

export interface DeliverableGenerationPlanItem {
  key: string;
  title: string;
  enabled: boolean;
  sourceRef?: string;
  hint?: string;
}

export interface DeliverableGenerationStatus {
  generationId: string;
  format: 'deck' | 'doc' | 'sheet';
  state: DeliverableGenerationState;
  plan?: DeliverableGenerationPlanItem[];
  artifact?: {
    artifactId: string;
    originRecordId: string;
    format: 'deck' | 'doc' | 'sheet';
    title: string;
    unitCount: number;
  };
  error?: string;
}

// ── [ODMROZENIE 13_CHAT DEC-397] Uczciwość flagi + polskie powody ────────────
// Zgłoszenie właściciela 06.09 (1.1-D): czat pokazał kartę „Dokument: …" i padł
// napisem „❌ Generacja nie powiodła się: Not found". Zmierzona przyczyna: FRONT
// ma `VITE_ENABLE_DELIVERABLES_LIGHT=true`, a SERWER nie ma `ENABLE_DELIVERABLES_LIGHT`
// (staging: railway-staging.json ma tylko wariant VITE_*), więc router
// `deliverablesGenerations.routes.ts:68` odpowiada 404 `{"error":"Not found"}`
// PRZED uwierzytelnieniem (stąd `userId: null` w logu). Czat pokazywał tę
// angielską odpowiedź serwera dosłownie.
//
// Dwie konsekwencje, obie tu obsłużone:
//  1. Flaga frontu sama w sobie NIE jest dowodem, że powierzchnia istnieje.
//     Gdy serwer raz udowodni, że jej nie ma (404 na kontrakcie), zapamiętujemy
//     to na czas życia karty i czat wraca na ścieżkę „flaga wyłączona".
//  2. Użytkownik nigdy nie widzi surowego komunikatu serwera — powód jest po polsku.

/**
 * Ustawiane, gdy serwer odpowie 404 na kontrakcie generacji. Świadomie tylko
 * w pamięci karty: restart serwera z włączoną flagą wraca do normy po odświeżeniu.
 */
let surfaceProvenMissing = false;

/** Serwerowa powierzchnia generacji udowodniła, że jej nie ma. */
export function markDeliverablesSurfaceUnavailable(): void {
  surfaceProvenMissing = true;
}

/** Tylko do testów — zeruje pamięć niedostępności. */
export function resetDeliverablesSurfaceProbe(): void {
  surfaceProvenMissing = false;
}

/**
 * True, gdy błąd oznacza BRAK powierzchni generacji na serwerze (404 na kontrakcie),
 * a nie zwykłą awarię generacji. Rozpoznajemy po statusie z `ApiError`; napis
 * „Not found" jest tylko zapasowym rozpoznaniem, gdy status nie dojechał.
 */
export function isDeliverablesSurfaceMissing(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (status === 404) return true;
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /^\s*not found\s*$/i.test(message);
}

/**
 * Powód niepowodzenia generacji PO POLSKU. Nigdy nie przepuszcza surowego
 * komunikatu serwera (to on dał właścicielowi „Not found").
 */
export function opisBleduGeneracji(err: unknown, lang: 'pl' | 'en' = 'pl'): string {
  const pl = lang === 'pl';
  if (isDeliverablesSurfaceMissing(err)) {
    return pl
      ? 'generator dokumentów jest wyłączony na tym środowisku'
      : 'the document generator is switched off in this environment';
  }
  const status = (err as { status?: number } | null)?.status;
  if (status === 401 || status === 403) {
    return pl ? 'brak uprawnień do tworzenia artefaktów' : 'no permission to create artifacts';
  }
  if (status === 429) {
    return pl ? 'limit zapytań do AI został wyczerpany' : 'the AI request limit is exhausted';
  }
  if (typeof status === 'number' && status >= 500) {
    return pl ? 'serwer zgłosił błąd generacji' : 'the server reported a generation error';
  }
  return pl ? 'generacja nie doszła do skutku' : 'the generation did not complete';
}

export function isDeliverablesLightEnabled(): boolean {
  if (surfaceProvenMissing) return false;
  return import.meta.env.VITE_ENABLE_DELIVERABLES_LIGHT === 'true';
}

/**
 * Tytuł roboczy artefaktu z intencji czatu — pierwsza linia, bez czasownika
 * komendy („Napisz raport: X" → „X"), z wielką literą, przycięta do 80 znaków.
 */
export function deckTitleFromIntent(intent: string, fallback: string): string {
  let line = String(intent || '')
    .split('\n')[0]
    .replace(/^\/(prezentacja|presentation|deck)\s*/i, '')
    .trim();
  // P3 (audyt): zdejmij frazę-komendę z początku — tytuł ma brzmieć jak tytuł.
  line = line
    .replace(
      // [\p{L}]* zamiast \w* — \w nie obejmuje polskich diakrytyków, więc
      // "prezentacj\w*" zostawiało "ę" z "prezentację" (tytuł "Ę o …").
      /^(napisz|przygotuj|stwórz|utwórz|zrób|wygeneruj|opracuj|create|write|make|prepare|generate|build)\s+(mi\s+|me\s+|a\s+|an\s+)?(raport|dokument|notatk[\p{L}]*|prezentacj[\p{L}]*|arkusz[\p{L}]*|deck|tabel[\p{L}]*|budżet|plik\s*excel|skoroszyt|report|document|memo|presentation|sheet|spreadsheet|table|budget)?\s*[:,-]?\s*/iu,
      ''
    )
    .trim();
  if (!line) return fallback;
  line = line.charAt(0).toUpperCase() + line.slice(1);
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}

interface DeckGenerationSetup {
  title: string;
  language: 'pl' | 'en';
  /** Temat/brief z prośby użytkownika — nieść do generateDeck, patrz niżej. */
  brief?: string;
}

function buildDeckSetup({ title, language, brief }: DeckGenerationSetup): Record<string, unknown> {
  // Minimalny DeckSetup (presentationGeneratorService) — bez źródeł generator
  // tworzy outline z default szablonu i oznacza deck jako częściowo ugruntowany.
  // `brief` (temat prośby) MUSI tu być — inaczej `setup.brief` nie dociera do
  // generateDeck (ten sam setup jest reużyty w start()), useBriefRewrite=false
  // i deck pisze „brak danych" (root-cause 2026-07-22). audience/goal derywuje
  // backend z briefu (resolveDeckBrief w deliverablesGenerationService).
  return {
    title,
    audience: 'internal',
    goal: 'inform',
    language,
    theme: 'corporate',
    confidentiality: 'internal',
    sourceArtifacts: [],
    ...(brief && brief.trim() ? { brief: brief.trim() } : {}),
  };
}

export async function planDeckGeneration(params: {
  intent: string;
  title: string;
  language: 'pl' | 'en';
}): Promise<{
  generationId: string;
  plan: DeliverableGenerationPlanItem[];
  warnings: string[];
  setup: Record<string, unknown>;
  sources: Array<{ sourceType: string; sourceId: string; sourceTitle?: string }>;
}> {
  const setup = buildDeckSetup({
    title: params.title,
    language: params.language,
    brief: params.intent,
  });
  const res = (await Api.post('/deliverables/generations', {
    format: 'deck',
    setup,
    intent: params.intent,
  })) as any;
  const data = res?.data?.data && typeof res.data.data === 'object' ? res.data.data : res?.data;
  if (!data?.generationId) {
    throw new Error(data?.error || 'Generation plan failed');
  }
  return {
    generationId: String(data.generationId),
    plan: Array.isArray(data.plan) ? data.plan : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    setup,
    sources: Array.isArray(data.sources) ? data.sources : [],
  };
}

// ── Gałąź doc (L2) ──────────────────────────────────────────────────────────

/**
 * Krok PLAN dla dokumentu: wejściem jest sama intencja + opcjonalny wycinek
 * rozmowy (D-L2-2b) i/lub sourceRefs z encji (D-L2-2a). Zwraca generationId
 * == draftId canvasa — po stanie 'draft' montujemy go w starterze 'document'.
 */
export async function planDocGeneration(params: {
  intent: string;
  title?: string;
  language: 'pl' | 'en';
  conversationId?: string | null;
  conversationContext?: string;
  sourceRefs?: Array<Record<string, unknown>>;
}): Promise<{
  generationId: string;
  plan: DeliverableGenerationPlanItem[];
  warnings: string[];
  setup: Record<string, unknown>;
  sources: Array<{ sourceType: string; sourceId: string; sourceTitle?: string }>;
}> {
  const setup: Record<string, unknown> = {
    intent: params.intent,
    title: params.title,
    language: params.language,
    conversationId: params.conversationId || undefined,
    conversationContext: params.conversationContext,
    sourceRefs: params.sourceRefs,
  };
  const res = (await Api.post('/deliverables/generations', {
    format: 'doc',
    setup,
    intent: params.intent,
  })) as any;
  const data = res?.data?.data && typeof res.data.data === 'object' ? res.data.data : res?.data;
  if (!data?.generationId) {
    throw new Error(data?.error || 'Generation plan failed');
  }
  return {
    generationId: String(data.generationId),
    plan: Array.isArray(data.plan) ? data.plan : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    setup,
    sources: Array.isArray(data.sources) ? data.sources : [],
  };
}

export async function startDocGeneration(params: {
  generationId: string;
  setup: Record<string, unknown>;
  plan?: DeliverableGenerationPlanItem[];
}): Promise<void> {
  await Api.post(`/deliverables/generations/${params.generationId}/generate`, {
    format: 'doc',
    setup: params.setup,
    plan: params.plan,
  });
}

// ── Gałąź sheet (L3) ────────────────────────────────────────────────────────

/** Krok PLAN dla arkusza — wejście jak doc; artefakt = canvas draft kind='table'. */
export async function planSheetGeneration(params: {
  intent: string;
  title?: string;
  language: 'pl' | 'en';
  conversationId?: string | null;
  conversationContext?: string;
}): Promise<{
  generationId: string;
  plan: DeliverableGenerationPlanItem[];
  warnings: string[];
  setup: Record<string, unknown>;
  sources: Array<{ sourceType: string; sourceId: string; sourceTitle?: string }>;
}> {
  const setup: Record<string, unknown> = {
    intent: params.intent,
    title: params.title,
    language: params.language,
    conversationId: params.conversationId || undefined,
    conversationContext: params.conversationContext,
  };
  const res = (await Api.post('/deliverables/generations', {
    format: 'sheet',
    setup,
    intent: params.intent,
  })) as any;
  const data = res?.data?.data && typeof res.data.data === 'object' ? res.data.data : res?.data;
  if (!data?.generationId) {
    throw new Error(data?.error || 'Generation plan failed');
  }
  return {
    generationId: String(data.generationId),
    plan: Array.isArray(data.plan) ? data.plan : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    setup,
    sources: Array.isArray(data.sources) ? data.sources : [],
  };
}

export async function startSheetGeneration(params: {
  generationId: string;
  setup: Record<string, unknown>;
}): Promise<void> {
  await Api.post(`/deliverables/generations/${params.generationId}/generate`, {
    format: 'sheet',
    setup: params.setup,
  });
}

export async function startDeckGeneration(params: {
  generationId: string;
  setup: Record<string, unknown>;
  plan?: DeliverableGenerationPlanItem[];
}): Promise<void> {
  await Api.post(`/deliverables/generations/${params.generationId}/generate`, {
    format: 'deck',
    setup: params.setup,
    plan: params.plan,
  });
}

export async function getDeckGenerationStatus(
  generationId: string
): Promise<DeliverableGenerationStatus> {
  const res = (await Api.get(`/deliverables/generations/${generationId}`)) as any;
  const data = res?.data?.data && typeof res.data.data === 'object' ? res.data.data : res?.data;
  return data as DeliverableGenerationStatus;
}

/**
 * Polluje status aż do stanu terminalnego ('draft' | 'error'). Każda zmiana
 * stanu wywołuje onUpdate (checklista Task-Progress w czacie, wzorzec Kimi).
 */
export async function pollDeckGenerationUntilDone(params: {
  generationId: string;
  onUpdate: (status: DeliverableGenerationStatus) => void;
  intervalMs?: number;
  timeoutMs?: number;
  /** P2-2 (audyt): abort przy odmontowaniu czatu — poll nie żyje po wyjściu z widoku. */
  signal?: AbortSignal;
}): Promise<DeliverableGenerationStatus> {
  const intervalMs = params.intervalMs ?? 2500;
  const timeoutMs = params.timeoutMs ?? 5 * 60 * 1000;
  const startedAt = Date.now();
  let lastState: DeliverableGenerationState | null = null;

  for (;;) {
    if (params.signal?.aborted) {
      throw new DOMException('Generation poll aborted', 'AbortError');
    }
    const status = await getDeckGenerationStatus(params.generationId);
    if (status.state !== lastState) {
      lastState = status.state;
      params.onUpdate(status);
    }
    if (status.state === 'draft' || status.state === 'error') return status;
    if (Date.now() - startedAt > timeoutMs) {
      // N-11 (P2): backend bywa gotowy (state:'draft') zanim klient zdąży go
      // odpytać — zwł. przy wolnym DB. Zamiast od razu osierocić artefakt,
      // zrób kilka dodatkowych prób (fallback) przed ostatecznym timeoutem.
      // Jeśli którakolwiek zwróci stan gotowości — to sukces, nie error.
      const fallbackAttempts = 2;
      const fallbackDelayMs = 2000;
      let lastFallback: DeliverableGenerationStatus = status;
      for (let attempt = 0; attempt < fallbackAttempts; attempt += 1) {
        if (params.signal?.aborted) {
          throw new DOMException('Generation poll aborted', 'AbortError');
        }
        try {
          lastFallback = await getDeckGenerationStatus(params.generationId);
        } catch {
          // sieć/serwer chwilowo niedostępny — spróbuj jeszcze raz w pętli
        }
        if (lastFallback.state === 'draft' || lastFallback.state === 'error') {
          if (lastFallback.state !== lastState) {
            lastState = lastFallback.state;
            params.onUpdate(lastFallback);
          }
          return lastFallback;
        }
        if (attempt < fallbackAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, fallbackDelayMs));
        }
      }
      const timedOut: DeliverableGenerationStatus = {
        ...lastFallback,
        state: 'error',
        error: 'Generation timed out',
      };
      params.onUpdate(timedOut);
      return timedOut;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

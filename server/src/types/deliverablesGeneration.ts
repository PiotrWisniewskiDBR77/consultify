/**
 * Deliverables — lekki runtime: KONTRAKT GENERACJI (SSOT typów)
 *
 * Jeden kontrakt generacji dla 3 klas artefaktów (Document / Presentation / Sheet),
 * sparametryzowany formatem — zgodnie z `docs/plans/DELIVERABLES_LIGHT_TARGET.md` §2.2
 * i doktryną V8.1 (`docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md` §7).
 *
 * Wzorzec async: POST /generations → plan (edytowalny outline) → POST /:id/generate (w tle)
 * → GET /:id (poll). Dla `deck` w v1 owijamy istniejące generateOutline()/generateDeck()
 * BEZ przepisywania ich; status czytamy z wiersza `presentation_decks`.
 *
 * v1 implementuje WYŁĄCZNIE format `deck`. `doc` i `sheet` są w kontrakcie, ale runtime
 * zwraca `not_implemented` aż do faz L2/L3.
 */

/**
 * Klasa artefaktu generowanego przez lekki runtime.
 *
 * `mindmap` (M06 Fala 2 · 2.3, ff_teresaMindmap): mapa myśli NIE przechodzi przez
 * DB-bound runtime deck/doc/sheet (`deliverablesGenerationService`). Zamiast wiersza
 * `presentation_decks` handler generuje graf {nodes,edges} inline i emituje go do
 * frontu, który montuje mapę w Ideas (workspace M06). Dlatego `mindmap` jest w tym
 * typie tylko jako etykieta formatu deliverable — nie jest obsługiwany przez
 * plan()/start()/status() serwisu generacji (tam pozostają deck/doc/sheet).
 */
export type DeliverableFormat = 'deck' | 'doc' | 'sheet' | 'mindmap';

/**
 * Stan generacji — podzbiór cyklu życia artefaktu z V8.1 §7, rozszerzony o checkpoint
 * `plan_ready` (bramka edytowalnego outline) i stan `error`.
 *
 *   requested → planning → plan_ready → generating → validating → draft
 *                                                              ↘ error
 */
export type GenerationState =
  | 'requested'
  | 'planning'
  | 'plan_ready'
  | 'generating'
  | 'validating'
  | 'draft'
  | 'error';

/**
 * Format-agnostyczny element planu (outline). Dla `deck` mapuje się 1:1 na
 * `OutlineItem` z presentationGeneratorService (intent/title/enabled/sourceRef).
 * Dla `doc` = sekcja, dla `sheet` = arkusz/sekcja kolumn (L2/L3).
 */
export interface GenerationPlanItem {
  /** Identyfikator kroku/sekcji w obrębie planu (intent dla decku). */
  key: string;
  title: string;
  enabled: boolean;
  /** Referencja do źródłowego artefaktu/rekordu org (grounding). */
  sourceRef?: string;
  /** Krótki opis/keyMessage — pomocniczy dla użytkownika przy edycji planu. */
  hint?: string;
}

/** Odwołanie do gotowego artefaktu w kanonicznym rejestrze (Outputs Library). */
export interface GenerationArtifactRef {
  artifactId: string;
  /** ID rekordu w runtime formatu (deckId dla presentation). */
  originRecordId: string;
  format: DeliverableFormat;
  title: string;
  /** Liczba kart/sekcji (slideCount dla decku). */
  unitCount: number;
}

/** Zużycie (kredyty/tokeny) — wzorzec Gamma (GET zwraca usage). Opcjonalne w v1. */
export interface GenerationUsage {
  creditsSpent?: number;
  tokensIn?: number;
  tokensOut?: number;
}

// ── Request DTOs ────────────────────────────────────────────────────────────

/**
 * POST /api/deliverables/generations
 * Krok PLAN: z kontekstu (sourceRefs + intencja) buduje edytowalny outline.
 * `setup` jest format-specyficzny i przekazywany do generatora danego formatu
 * (dla `deck` = DeckSetup z presentationGeneratorService).
 */
export interface CreateGenerationRequest {
  format: DeliverableFormat;
  /** Format-specyficzna konfiguracja generacji (DeckSetup dla `deck`). */
  setup: Record<string, unknown>;
  /** Intencja/prompt użytkownika z czatu (opcjonalna, do logu/groundingu). */
  intent?: string;
}

/**
 * POST /api/deliverables/generations/:id/generate
 * Krok GENERATE: po akceptacji (i ewentualnej edycji) planu uruchamia generację w tle.
 */
export interface StartGenerationRequest {
  setup: Record<string, unknown>;
  /** Plan po edycji użytkownika; jeśli pominięty — używamy planu z kroku PLAN. */
  plan?: GenerationPlanItem[];
}

// ── Response DTOs ───────────────────────────────────────────────────────────

/** Źródło organizacji użyte do groundingu (wskazane albo z auto-skanu). */
export interface GenerationSourceRef {
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
}

/** Odpowiedź kroku PLAN. */
export interface CreateGenerationResponse {
  generationId: string;
  format: DeliverableFormat;
  state: GenerationState; // 'plan_ready' przy sukcesie
  plan: GenerationPlanItem[];
  /** Ostrzeżenia walidacji planu (np. brakujące źródła). */
  warnings: string[];
  /** B4: źródła groundingu (auto-skan org, gdy użytkownik nie wskazał własnych). */
  sources?: GenerationSourceRef[];
}

/** Odpowiedź GET /:id (poll). */
export interface GenerationStatusResponse {
  generationId: string;
  format: DeliverableFormat;
  state: GenerationState;
  plan?: GenerationPlanItem[];
  /** Wypełnione gdy state = 'draft' (artefakt gotowy w rejestrze). */
  artifact?: GenerationArtifactRef;
  /** Wypełnione gdy state = 'error'. */
  error?: string;
  usage?: GenerationUsage;
}

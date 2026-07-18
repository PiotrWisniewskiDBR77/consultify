/**
 * Deliverables — lekki runtime: SERWIS GENERACJI (L1, format `deck`)
 *
 * Cienki serwis owijający istniejące generateOutline()/generateDeck()
 * z presentationGeneratorService w jeden async kontrakt generacji
 * (`docs/plans/DELIVERABLES_LIGHT_TARGET.md` §2.2, §10.2 pkt 2).
 *
 * ZERO przepisywania generatora deck: plan = generateOutline, start = generateDeck
 * odpalony w tle (nie await). SSOT stanu = wiersz `presentation_decks.status`
 * (draft → generating → ready|failed); mapa in-memory dodaje jedynie stany
 * przejściowe niewidoczne w DB (`validating`) i treść błędu po restarcie nieobecną.
 *
 * `doc` i `sheet` są W PEŁNI zaimplementowane (L2/L3) i delegowane do
 * `docGenerationRuntime` (planDoc/startDoc/statusDoc, planSheet/startSheet). Gałąź
 * DOC jest KANONICZNIE zunifikowana z Document Studio: startDoc materializuje encję
 * `document_studio_artifacts` przez `materializeDocumentArtifact` (ten sam pipeline
 * intake→plan→schema→Wave5 co Studio i most „Send to Document Studio"), więc
 * artefakt z czatu jest tożsamy z artefaktem Studio (ten sam typ encji, eksport
 * DOCX/PDF, rejestr Outputs). `not_implemented` pada TYLKO dla nieznanego formatu.
 */

import type {
  CreateGenerationResponse,
  DeliverableFormat,
  GenerationArtifactRef,
  GenerationPlanItem,
  GenerationState,
  GenerationStatusResponse,
} from '../../types/deliverablesGeneration.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type { DeckSetup, OutlineItem } from '../presentationGeneratorService.js';
import { generateDeck, generateOutline } from '../presentationGeneratorService.js';
import { getArtifactByOriginUnscoped } from '../v8/artifactRegistryService.js';
import { trackDeliverableEvent } from './deliverablesTelemetryService.js';
import { planDoc, planSheet, startDoc, startSheet, statusDoc } from './docGenerationRuntime.js';
import { DeliverablesGenerationError } from './errors.js';
import { newCorrelationId, withTransientRetry } from './transientRetry.js';

const LOG_PREFIX = '[DeliverablesGen]';

// Błędy domenowe re-eksportowane dla zgodności (router, testy).
export { DeliverablesGenerationError, type DeliverablesGenerationErrorCode } from './errors.js';

function assertImplementedFormat(format: DeliverableFormat): void {
  if (format === 'deck' || format === 'doc' || format === 'sheet') return;
  throw new DeliverablesGenerationError(
    'not_implemented',
    `Nieznany format '${format}' — kontrakt obsługuje deck, doc i sheet.`
  );
}

// ── Stan przejściowy generacji (uzupełnia DB, nie zastępuje) ────────────────

interface RuntimeGenerationEntry {
  state: Extract<GenerationState, 'generating' | 'validating' | 'draft' | 'error'>;
  error?: string;
  warnings: string[];
  slideCount?: number;
}

const runtimeState = new Map<string, RuntimeGenerationEntry>();

// ── Mapowania plan ↔ outline ────────────────────────────────────────────────

function outlineToPlan(outline: OutlineItem[]): GenerationPlanItem[] {
  return outline.map((item, index) => ({
    // intent może się powtarzać między slajdami — klucz musi być unikalny w planie
    key: `${index}:${item.intent}`,
    title: item.title,
    enabled: item.enabled,
    sourceRef: item.sourceRef,
    hint: item.keyMessage,
  }));
}

/**
 * Nakłada edycje użytkownika (tytuł/enabled) na pełny OutlineItem[] z DB.
 * Dopasowanie po kluczu `index:intent`; nieznane klucze są ignorowane z warningiem —
 * plan użytkownika nie może wstrzyknąć slajdów spoza wygenerowanego outline.
 */
function applyPlanEdits(
  outline: OutlineItem[],
  plan: GenerationPlanItem[]
): { outline: OutlineItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const byKey = new Map(plan.map((p) => [p.key, p]));
  const merged = outline.map((item, index) => {
    const edit = byKey.get(`${index}:${item.intent}`);
    if (!edit) return item;
    byKey.delete(`${index}:${item.intent}`);
    return { ...item, title: edit.title || item.title, enabled: edit.enabled };
  });
  if (byKey.size > 0) {
    warnings.push(
      `Pominięto ${byKey.size} pozycji planu bez odpowiednika w outline (klucze: ${[...byKey.keys()].join(', ')})`
    );
  }
  return { outline: merged, warnings };
}

// ── Odczyt decka (SSOT stanu po restarcie) ──────────────────────────────────

interface DeckRow {
  id: string;
  organization_id: string;
  status: string;
  outline_json: string | null;
  slide_count: number | null;
  validation_warnings: string | null;
  title: string;
}

async function getDeckRow(deckId: string, organizationId: string): Promise<DeckRow> {
  const row = (await dbGet(
    `SELECT id, organization_id, status, outline_json, slide_count, validation_warnings, title
     FROM presentation_decks WHERE id = ? AND organization_id = ?`,
    [deckId, organizationId]
  )) as DeckRow | undefined;
  if (!row) {
    throw new DeliverablesGenerationError('not_found', `Generacja ${deckId} nie istnieje`);
  }
  return row;
}

function parseStoredOutline(row: DeckRow): OutlineItem[] {
  try {
    const parsed = row.outline_json ? JSON.parse(row.outline_json) : null;
    const outline = Array.isArray(parsed?.outline) ? parsed.outline : null;
    if (outline) return outline as OutlineItem[];
  } catch {
    /* fallthrough */
  }
  throw new DeliverablesGenerationError(
    'invalid_state',
    `Generacja ${row.id} nie ma zapisanego planu (outline_json) — uruchom najpierw krok PLAN`
  );
}

/**
 * deck.status → GenerationState. Uwaga na kolizję nazw: status decka 'draft'
 * = świeży outline (kontraktowo `plan_ready`), a stan kontraktu 'draft'
 * = gotowy artefakt (deck.status 'ready').
 */
function deckStatusToState(status: string): GenerationState {
  switch (status) {
    case 'draft':
      return 'plan_ready';
    case 'generating':
      return 'generating';
    case 'ready':
      return 'draft';
    case 'failed':
      return 'error';
    default:
      return 'plan_ready';
  }
}

// ── API serwisu ─────────────────────────────────────────────────────────────

/**
 * Krok PLAN: buduje edytowalny outline i wiersz decka (status 'draft').
 * `generationId` == `deckId` — celowo, żeby status() czytał DB bez tabeli mapującej.
 */
export async function plan(params: {
  format: DeliverableFormat;
  setup: Record<string, unknown>;
  organizationId: string;
  intent?: string;
  /** Wymagane dla format='doc' (canvas draft ma created_by). */
  userId?: string;
}): Promise<CreateGenerationResponse> {
  assertImplementedFormat(params.format);
  if (params.format === 'doc' || params.format === 'sheet') {
    const branch = params.format === 'doc' ? planDoc : planSheet;
    return branch({
      setup: { intent: params.intent, ...params.setup },
      organizationId: params.organizationId,
      userId: params.userId || 'system',
    });
  }
  const setup = params.setup as unknown as DeckSetup;
  if (!setup?.title || !setup?.language) {
    throw new DeliverablesGenerationError(
      'invalid_setup',
      `setup dla 'deck' wymaga co najmniej title i language (DeckSetup)`
    );
  }
  const { outline, deckId, validationWarnings } = await generateOutline(
    setup,
    params.organizationId
  );
  void trackDeliverableEvent({
    organizationId: params.organizationId,
    userId: params.userId,
    generationId: deckId,
    format: 'deck',
    event: 'plan_ready',
    language: setup.language,
    groundingMode: setup.sourceArtifacts?.length ? 'source_refs' : 'conversation',
  });
  logger.info(
    `${LOG_PREFIX} plan ready: generation=${deckId} format=deck items=${outline.length} warnings=${validationWarnings.length}` +
      (params.intent ? ` intent="${params.intent.slice(0, 120)}"` : '')
  );
  return {
    generationId: deckId,
    format: 'deck',
    state: 'plan_ready',
    plan: outlineToPlan(outline),
    warnings: validationWarnings,
  };
}

/**
 * Krok GENERATE: nakłada ewentualne edycje planu i odpala generateDeck W TLE.
 * Zwraca natychmiast stan 'generating'; postęp przez status() (poll).
 */
export async function start(params: {
  generationId: string;
  format: DeliverableFormat;
  setup: Record<string, unknown>;
  organizationId: string;
  plan?: GenerationPlanItem[];
  userId?: string;
}): Promise<GenerationStatusResponse> {
  assertImplementedFormat(params.format);
  if (params.format === 'doc') {
    return startDoc({
      generationId: params.generationId,
      setup: params.setup,
      organizationId: params.organizationId,
      userId: params.userId || 'system',
      plan: params.plan,
    });
  }
  if (params.format === 'sheet') {
    return startSheet({
      generationId: params.generationId,
      setup: params.setup,
      organizationId: params.organizationId,
      userId: params.userId || 'system',
    });
  }
  const row = await getDeckRow(params.generationId, params.organizationId);
  if (row.status === 'generating' || runtimeState.get(row.id)?.state === 'generating') {
    throw new DeliverablesGenerationError(
      'invalid_state',
      `Generacja ${row.id} już trwa — odpytuj status zamiast startować ponownie`
    );
  }

  const stored = parseStoredOutline(row);
  const { outline, warnings } = params.plan?.length
    ? applyPlanEdits(stored, params.plan)
    : { outline: stored, warnings: [] };
  const enabledCount = outline.filter((o) => o.enabled).length;
  if (enabledCount === 0) {
    throw new DeliverablesGenerationError(
      'invalid_state',
      `Plan generacji ${row.id} nie ma żadnej włączonej pozycji`
    );
  }

  // P0.3 — lock atomowy: dwa równoległe start() dla tego samego decka (np. dublet
  // kliknięcia / retry FE) muszą wyłonić dokładnie jednego wykonawcę. Sam odczyt
  // row.status wyżej jest TOCTOU (dwa requesty mogą przejść go równocześnie), więc
  // faktyczna bramka to warunkowy UPDATE — wygrywa ten request, dla którego DB
  // zwróci wiersz; przegrany dostaje 'invalid_state' zamiast dublować generateDeck().
  const lock = await dbRun(
    `UPDATE presentation_decks SET status = 'generating', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ? AND status != 'generating'
     RETURNING id`,
    [row.id, params.organizationId]
  );
  if (!lock.success || !lock.changes) {
    throw new DeliverablesGenerationError(
      'invalid_state',
      `Generacja ${row.id} już trwa — odpytuj status zamiast startować ponownie`
    );
  }

  const setup = params.setup as unknown as DeckSetup;
  runtimeState.set(row.id, { state: 'generating', warnings });

  // Świadomie bez await — wzorzec Gamma (202 + poll). Błąd ląduje w mapie
  // ORAZ w presentation_decks.status='failed' (generateDeck robi to sam).
  // H3.6 (pipeline): korelacja logów + 1 retry na błąd PRZEJŚCIOWY (timeout/429/5xx).
  // Błędy trwałe (zła prośba, refusal) propagują natychmiast — bez maskowania.
  const generationStartedAt = Date.now();
  const correlationId = newCorrelationId('deck');
  logger.info(`${LOG_PREFIX} generation start: generation=${row.id} cid=${correlationId}`);
  void withTransientRetry(
    () => generateDeck(row.id, outline, setup, params.organizationId),
    { label: 'deck', correlationId }
  )
    .then((result) => {
      runtimeState.set(row.id, {
        state: 'draft',
        warnings: [...warnings, ...(result.warnings || [])],
        slideCount: result.slideCount,
      });
      void trackDeliverableEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        generationId: row.id,
        format: 'deck',
        event: 'completed',
        durationMs: Date.now() - generationStartedAt,
        unitCount: result.slideCount,
        language: setup.language,
        groundingMode: setup.sourceArtifacts?.length ? 'source_refs' : 'conversation',
      });
      logger.info(`${LOG_PREFIX} draft ready: generation=${row.id} slides=${result.slideCount}`);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      runtimeState.set(row.id, { state: 'error', error: message, warnings });
      void trackDeliverableEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        generationId: row.id,
        format: 'deck',
        event: 'failed',
        durationMs: Date.now() - generationStartedAt,
        error: message,
      });
      logger.error(`${LOG_PREFIX} generation failed: generation=${row.id} — ${message}`);
    });

  return {
    generationId: row.id,
    format: 'deck',
    state: 'generating',
    plan: outlineToPlan(outline),
  };
}

/**
 * Poll stanu. DB (presentation_decks.status) jest źródłem prawdy — mapa
 * in-memory dokłada tylko treść błędu i warningi bieżącego procesu.
 * Przy state='draft' dokleja referencję artefaktu z kanonicznego rejestru.
 */
export async function status(params: {
  generationId: string;
  organizationId: string;
}): Promise<GenerationStatusResponse> {
  // GET nie niesie formatu — generationId to deckId (deck) albo draftId (doc).
  // Najpierw deck (L1); brak wiersza ⇒ próbujemy gałęzi doc.
  let row: DeckRow;
  try {
    row = await getDeckRow(params.generationId, params.organizationId);
  } catch (err) {
    if (err instanceof DeliverablesGenerationError && err.code === 'not_found') {
      return statusDoc(params);
    }
    throw err;
  }
  const runtime = runtimeState.get(row.id);
  const state = deckStatusToState(row.status);

  const response: GenerationStatusResponse = {
    generationId: row.id,
    format: 'deck',
    state,
  };

  if (state === 'plan_ready') {
    try {
      response.plan = outlineToPlan(parseStoredOutline(row));
    } catch {
      /* plan opcjonalny w odpowiedzi statusu */
    }
  }

  if (state === 'error') {
    let storedWarning: string | undefined;
    try {
      const parsed = row.validation_warnings ? JSON.parse(row.validation_warnings) : null;
      if (Array.isArray(parsed) && parsed.length) storedWarning = String(parsed[parsed.length - 1]);
    } catch {
      /* brak szczegółów w DB */
    }
    response.error = runtime?.error || storedWarning || 'Generacja nie powiodła się';
  }

  if (state === 'draft') {
    response.artifact = await resolveArtifactRef(row);
  }

  return response;
}

async function resolveArtifactRef(row: DeckRow): Promise<GenerationArtifactRef | undefined> {
  try {
    const artifact = await getArtifactByOriginUnscoped({
      organizationId: row.organization_id,
      originRuntime: 'presentation',
      originRecordId: row.id,
    });
    if (!artifact) return undefined;
    return {
      artifactId: artifact.artifactId,
      originRecordId: row.id,
      format: 'deck',
      title: artifact.resolvedTitle || row.title,
      unitCount:
        artifact.slideCount ?? row.slide_count ?? runtimeState.get(row.id)?.slideCount ?? 0,
    };
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} artifact ref unavailable for generation=${row.id}: ${err instanceof Error ? err.message : err}`
    );
    return undefined;
  }
}

/** Wyłącznie do testów — czyści stan przejściowy między przypadkami. */
export function __clearRuntimeStateForTests(): void {
  runtimeState.clear();
}

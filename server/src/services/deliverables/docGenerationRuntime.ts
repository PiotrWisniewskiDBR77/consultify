/**
 * Deliverables — lekki runtime: GAŁĄŹ DOC (L2, kroki 1+2)
 *
 * Realna treść zamiast rusztowania (decyzje D-L2-1…3, plan §11):
 * - plan  = deterministyczny outline z documentStudio.planDocument (instant),
 *           artefakt = canvas draft (markdown canonical) tworzony od razu —
 *           generationId == draftId, jak deckId w gałęzi deck.
 * - start = materializeDocumentArtifact z **useLlm: true** (uśpiony silnik D11 —
 *           generateBlockProse) w tle; render schema→markdown do draftu.
 * - D-L2-3: generateBlockProse przy KAŻDYM błędzie po cichu wraca do placeholderów
 *           „MVP-1…" — dlatego po renderze jest twarda bramka anty-placeholder:
 *           wykryty placeholder ⇒ uczciwy stan `error`, nigdy wydmuszka u użytkownika.
 *
 * Grounding (D-L2-2): sourceRefs z encji org → DocumentIntake.sourceHints
 * (documentSourcePack), a kontekst rozmowy z czatu dokleja się do description.
 */

import type {
  CreateGenerationResponse,
  GenerationPlanItem,
  GenerationStatusResponse,
} from '../../types/deliverablesGeneration.js';
import logger from '../../utils/Logger.js';
import { isPlaceholderDocumentProse } from '../documentStudio/documentContentGenerator.js';
import { renderSchemaToMarkdown } from '../documentStudio/documentSchemaRenderer.js';
import {
  materializeDocumentArtifact,
  planDocument,
} from '../documentStudio/documentStudioService.js';
import type {
  DocumentIntake,
  DocumentOutline,
  DocumentSourceRef,
} from '../documentStudio/documentStudioTypes.js';
import { registerArtifactOrigin } from '../v8/artifactRegistryService.js';
import {
  createDraft,
  getDraft,
  updateDraft,
  type WorkCanvasDraftRecord,
} from '../workCanvasService.js';
import { trackDeliverableEvent } from './deliverablesTelemetryService.js';
import { DeliverablesGenerationError } from './errors.js';

const LOG_PREFIX = '[DeliverablesGen:doc]';

/** Marker szkieletu — obecny w treści draftu dopóki generacja nie skończy. */
const GENERATION_PENDING_MARKER = 'po zakończeniu generacji';

interface DocRuntimeEntry {
  state: 'plan_ready' | 'generating' | 'validating' | 'draft' | 'error';
  error?: string;
  warnings: string[];
  sectionCount?: number;
  documentArtifactId?: string;
}

const docRuntimeState = new Map<string, DocRuntimeEntry & { updatedAtMs?: number }>();

// P2-1 (audyt): mapa nie może rosnąć do restartu — wpisy starsze niż TTL są
// zbędne (SSOT stanu po czasie = treść draftu; statusDoc ma fallback z DB).
const RUNTIME_ENTRY_TTL_MS = 6 * 60 * 60 * 1000;

function setDocRuntime(id: string, entry: DocRuntimeEntry): void {
  docRuntimeState.set(id, { ...entry, updatedAtMs: Date.now() });
  if (docRuntimeState.size % 50 === 0) {
    const cutoff = Date.now() - RUNTIME_ENTRY_TTL_MS;
    for (const [key, value] of docRuntimeState) {
      if ((value.updatedAtMs || 0) < cutoff) docRuntimeState.delete(key);
    }
  }
}

/** Setup kontraktu dla format='doc' (przychodzi z czatu / encji). */
export interface DocGenerationSetup {
  /** Intencja użytkownika — jedyne wymagane pole (wejście = rozmowa, D-L2-1). */
  intent: string;
  language?: 'pl' | 'en';
  title?: string;
  /** Wycinek rozmowy z Teresą — grounding trybu (b) z D-L2-2. */
  conversationContext?: string;
  /** Encje org (notatki/idee/inicjatywy/…) — grounding trybu (a) z D-L2-2. */
  sourceRefs?: DocumentSourceRef[];
  /** Id rozmowy czatu — canvas draft jest do niej przypięty. */
  conversationId?: string;
  audience?: string[];
}

function parseSetup(setup: Record<string, unknown>): DocGenerationSetup {
  const intent = typeof setup.intent === 'string' ? setup.intent.trim() : '';
  if (!intent) {
    throw new DeliverablesGenerationError(
      'invalid_setup',
      `setup dla 'doc' wymaga pola intent (treść prośby użytkownika)`
    );
  }
  const conversationId =
    typeof setup.conversationId === 'string' && setup.conversationId.trim()
      ? setup.conversationId.trim()
      : undefined;
  // P2-4 (audyt): draft bez prawdziwej rozmowy = sierota z conversationId='chat'.
  // Frontend zawsze bootstrapuje rozmowę przed wywołaniem — brak = błąd wołającego.
  if (!conversationId) {
    throw new DeliverablesGenerationError(
      'invalid_setup',
      `setup wymaga conversationId — artefakt musi być przypięty do rozmowy`
    );
  }
  return {
    intent,
    language: setup.language === 'en' ? 'en' : 'pl',
    title: typeof setup.title === 'string' && setup.title.trim() ? setup.title.trim() : undefined,
    conversationContext:
      typeof setup.conversationContext === 'string' ? setup.conversationContext : undefined,
    sourceRefs: Array.isArray(setup.sourceRefs)
      ? (setup.sourceRefs as DocumentSourceRef[])
      : undefined,
    conversationId,
    audience: Array.isArray(setup.audience) ? (setup.audience as string[]) : undefined,
  };
}

/** P2-3 (audyt): nieudana generacja nie zostawia anonimowej sieroty na liście draftów. */
function markDraftFailedBestEffort(organizationId: string, draftId: string, title: string): void {
  const suffix = ' — generacja nieudana';
  if (title.endsWith(suffix)) return;
  void updateDraft({
    organizationId,
    draftId,
    patch: { title: `${title.slice(0, 200 - suffix.length)}${suffix}` },
  }).catch(() => {
    /* best-effort — stan error i tak niesie komunikat */
  });
}

/**
 * B2 (plan wykonawczy): grounding trybu source_refs — fakty z encji org
 * (ContextPack) wstrzykiwane do promptu generatora. Best-effort: brak
 * ekstraktora dla typu encji ⇒ pomijamy z warningiem, generacja biegnie dalej
 * na trybie rozmowy (spec §4: dokument nigdy nie jest pusty przez braki źródeł).
 */
async function buildGroundingFacts(
  organizationId: string,
  sourceRefs: DocumentSourceRef[] | undefined,
  language: 'pl' | 'en'
): Promise<string | null> {
  if (!sourceRefs?.length) return null;
  try {
    const { buildContextPack } = await import('../contextPackBuilder.js');
    const pack = await buildContextPack(
      organizationId,
      sourceRefs.map((ref) => ({
        artifact_id: ref.sourceId,
        artifact_type: ref.sourceType,
        artifact_name: ref.sourceTitle || ref.sourceId,
      })),
      language
    );
    const keyPoints = (pack.key_points || []).slice(0, 20);
    const dataPoints = (pack.data_points || [])
      .slice(0, 20)
      .map((d) => `${d.label}: ${d.value}${d.unit ? ` ${d.unit}` : ''}`);
    const lines = [...keyPoints, ...dataPoints].map((l) => String(l).trim()).filter(Boolean);
    if (lines.length === 0) return null;
    const header =
      language === 'en'
        ? 'Facts from organization sources (treat as the factual basis; do not contradict them):'
        : 'Fakty ze źródeł organizacji (traktuj jako podstawę faktograficzną; nie zaprzeczaj im):';
    return `${header}\n- ${lines.join('\n- ')}`.slice(0, 4000);
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} grounding facts unavailable (continuing conversation-grounded): ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}

function buildIntake(parsed: DocGenerationSetup): DocumentIntake {
  const description = parsed.conversationContext
    ? `${parsed.intent}\n\nKontekst rozmowy:\n${parsed.conversationContext.slice(0, 4000)}`
    : parsed.intent;
  return {
    title: parsed.title,
    description,
    language: parsed.language,
    audience: parsed.audience,
    sourceHints: parsed.sourceRefs,
  };
}

/**
 * C7 — initiative linkage z sourceRefs groundingu (D-L2-2a): jeśli encje org
 * przekazane z czatu zawierają ref inicjatywy, artefakt rejestruje się w
 * kanonicznym rejestrze z sourceInitiativeId (sekcja „Artefakty" w widoku
 * inicjatywy czyta to przez GET /api/artifacts?sourceInitiativeId=…).
 */
function extractInitiativeIdFromSourceRefs(refs?: DocumentSourceRef[]): string | null {
  for (const ref of refs || []) {
    if (!ref || typeof ref !== 'object') continue;
    if (String(ref.sourceType || '').toLowerCase() !== 'initiative') continue;
    if (typeof ref.sourceId === 'string' && ref.sourceId.trim()) return ref.sourceId.trim();
  }
  return null;
}

/**
 * C7 — best-effort rejestracja gotowego dokumentu w kanonicznym rejestrze
 * Outputs (ta sama konwencja co G5 w document-studio.routes.ts: dokumenty =
 * outputType 'report' + family 'document' + runtime 'native_artifact').
 * Gałąź doc omija router DocumentStudio (woła materializeDocumentArtifact
 * bezpośrednio), więc bez tego kroku chatowe dokumenty nie istnieją w
 * rejestrze. Błąd rejestru NIGDY nie psuje generacji — log + kontynuacja.
 */
async function registerDocArtifactBestEffort(params: {
  organizationId: string;
  userId: string;
  documentArtifactId: string;
  title: string;
  generationDraftId: string;
  sourceRefs?: DocumentSourceRef[];
}): Promise<void> {
  try {
    await registerArtifactOrigin({
      organizationId: params.organizationId,
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'native_artifact',
      originRecordId: params.documentArtifactId,
      titleSnapshot: params.title,
      ownerUserId: params.userId,
      createdBy: params.userId,
      sourceInitiativeId: extractInitiativeIdFromSourceRefs(params.sourceRefs),
      originSummary: {
        sourceType: 'deliverables_doc_generation',
        generationId: params.generationDraftId,
        sourceTable: 'document_studio_artifacts',
      },
    });
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} outputs registration failed (document still saved): generation=${params.generationDraftId} — ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * B4 (plan wykonawczy): auto-skan organizacji, gdy użytkownik nie wskazał źródeł.
 * Reuse narzędzi retrieval Teresy (insighty + notatki; flaga ENABLE_TERESA_RETRIEVAL
 * — wyłączona ⇒ puste wyniki, generacja biegnie trybem rozmowy). Snippety hitów
 * stają się faktami groundingu (ContextPack nie ma jeszcze ekstraktorów tych encji).
 */
async function autoScanOrgSources(
  organizationId: string,
  intent: string,
  language: 'pl' | 'en'
): Promise<{ refs: DocumentSourceRef[]; facts: string | null }> {
  try {
    const [{ searchInsights }, { searchOrgNotes }] = await Promise.all([
      import('../ai/tools/searchInsights.js'),
      import('../ai/tools/searchOrgNotes.js'),
    ]);
    const [insights, notes] = await Promise.all([
      searchInsights({ query: intent, limit: 3 }, { organizationId }),
      searchOrgNotes({ query: intent, limit: 3 }, { organizationId }),
    ]);
    const hits = [
      ...insights.results.map((h) => ({
        type: 'insight',
        id: h.id,
        title: h.title,
        snippet: h.snippet,
      })),
      ...notes.results.map((h) => ({
        type: 'note',
        id: h.pageId,
        title: h.title,
        snippet: h.snippet,
      })),
    ].slice(0, 6);
    if (hits.length === 0) return { refs: [], facts: null };
    const refs: DocumentSourceRef[] = hits.map((h) => ({
      sourceType: h.type,
      sourceId: h.id,
      sourceTitle: h.title,
    }));
    const header =
      language === 'en'
        ? 'Facts from organization sources found for this request (factual basis):'
        : 'Fakty ze źródeł organizacji znalezionych dla tej prośby (podstawa faktograficzna):';
    const lines = hits
      .map((h) => `${h.title}: ${String(h.snippet || '').trim()}`)
      .filter((l) => l.length > 5);
    const facts = lines.length ? `${header}\n- ${lines.join('\n- ')}`.slice(0, 4000) : null;
    return { refs, facts };
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} auto-scan unavailable (continuing conversation-grounded): ${err instanceof Error ? err.message : err}`
    );
    return { refs: [], facts: null };
  }
}

function outlineToPlanItems(outline: DocumentOutline): GenerationPlanItem[] {
  return outline.sections.map((section, index) => ({
    key: `${index}:${section.title}`,
    title: section.title,
    enabled: true,
    hint: section.purpose,
  }));
}

function applyPlanToOutline(outline: DocumentOutline, plan: GenerationPlanItem[]): DocumentOutline {
  const byKey = new Map(plan.map((p) => [p.key, p]));
  const sections = outline.sections
    .map((section, index) => {
      const edit = byKey.get(`${index}:${section.title}`);
      if (!edit) return section;
      if (!edit.enabled) return null;
      return { ...section, title: edit.title || section.title };
    })
    .filter((s): s is DocumentOutline['sections'][number] => s !== null);
  return { ...outline, sections: sections.length > 0 ? sections : outline.sections };
}

function outlineSkeletonMarkdown(title: string, outline: DocumentOutline): string {
  const lines = [`# ${title}`, ''];
  for (const section of outline.sections) {
    lines.push(`## ${section.title}`, '', `*${section.purpose}*`, '');
  }
  lines.push('', '> Teresa pisze treść — sekcje wypełnią się po zakończeniu generacji.');
  return lines.join('\n');
}

// ── Gałąź SHEET (L3) ────────────────────────────────────────────────────────
// Doktryna §2.1: Sheet = jeden blok `table` na całą powierzchnię. Artefakt to
// canvas draft kind='table' (markdown canonical, tabela GFM) — dzięki temu za
// darmo dostaje istniejący edytor, eksport XLSX/CSV i bridge „Send to Table
// Studio". Status/poll współdzielony ze ścieżką doc (format po kind draftu).

function sheetSkeletonMarkdown(title: string): string {
  return [
    `# ${title}`,
    '',
    `> Teresa buduje tabelę — struktura i dane pojawią się po zakończeniu generacji.`,
  ].join('\n');
}

/** Walidacja: wynik MUSI zawierać tabelę GFM (nagłówek + separator + ≥1 wiersz). */
function extractGfmTable(markdown: string): { ok: boolean; rowCount: number } {
  const lines = markdown.split('\n').map((l) => l.trim());
  const separatorIdx = lines.findIndex(
    (l) => /^\|?[\s:-]*-{3,}[\s|:-]*\|?$/.test(l) && l.includes('-')
  );
  if (separatorIdx < 1) return { ok: false, rowCount: 0 };
  const header = lines[separatorIdx - 1];
  if (!header.includes('|')) return { ok: false, rowCount: 0 };
  const rows = lines.slice(separatorIdx + 1).filter((l) => l.startsWith('|'));
  return { ok: rows.length >= 1, rowCount: rows.length };
}

export async function planSheet(params: {
  setup: Record<string, unknown>;
  organizationId: string;
  userId: string;
}): Promise<CreateGenerationResponse> {
  const parsed = parseSetup(params.setup);
  const title = parsed.title || (parsed.language === 'en' ? 'Sheet from chat' : 'Arkusz z czatu');

  // B4: brak wskazanych źródeł ⇒ auto-skan org (jak w planDoc).
  const auto = parsed.sourceRefs?.length
    ? { refs: [] as DocumentSourceRef[], facts: null as string | null }
    : await autoScanOrgSources(
        params.organizationId,
        parsed.intent,
        parsed.language === 'en' ? 'en' : 'pl'
      );

  const draft = await createDraft({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    input: {
      conversationId: parsed.conversationId!,
      kind: 'table',
      title,
      content: sheetSkeletonMarkdown(title),
      sources: parsed.sourceRefs?.length ? parsed.sourceRefs : auto.refs,
      provenance: {
        deliverablesGeneration: {
          sheetSetup: { ...parsed, title },
          autoGrounding: auto.refs.length ? { refs: auto.refs, facts: auto.facts } : undefined,
        },
      },
    },
  });

  setDocRuntime(draft.id, { state: 'plan_ready', warnings: [] });
  void trackDeliverableEvent({
    organizationId: params.organizationId,
    userId: params.userId,
    generationId: draft.id,
    format: 'sheet',
    event: 'plan_ready',
    language: parsed.language,
    groundingMode: parsed.sourceRefs?.length
      ? 'source_refs'
      : auto.refs.length
        ? 'auto_scan'
        : 'conversation',
  });
  logger.info(
    `${LOG_PREFIX} sheet plan ready: generation=${draft.id} autoSources=${auto.refs.length}`
  );
  const usedSheetRefs = parsed.sourceRefs?.length ? parsed.sourceRefs : auto.refs;
  return {
    generationId: draft.id,
    format: 'sheet',
    state: 'plan_ready',
    sources: usedSheetRefs.map((r) => ({
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      sourceTitle: r.sourceTitle,
    })),
    plan: [
      {
        key: '0:sheet',
        title,
        enabled: true,
        hint:
          parsed.language === 'en'
            ? 'Columns and rows generated by Teresa from your request'
            : 'Kolumny i wiersze wygeneruje Teresa z Twojej prośby',
      },
    ],
    warnings: [],
  };
}

export async function startSheet(params: {
  generationId: string;
  setup: Record<string, unknown>;
  organizationId: string;
  userId: string;
}): Promise<GenerationStatusResponse> {
  const draft = await getDocDraft(params.generationId, params.organizationId);
  if (docRuntimeState.get(draft.id)?.state === 'generating') {
    throw new DeliverablesGenerationError(
      'invalid_state',
      `Generacja ${draft.id} już trwa — odpytuj status zamiast startować ponownie`
    );
  }
  const provenance = (draft.provenance || {}) as Record<string, any>;
  const stored = provenance.deliverablesGeneration?.sheetSetup as DocGenerationSetup | undefined;
  if (!stored?.intent) {
    throw new DeliverablesGenerationError(
      'invalid_state',
      `Generacja ${draft.id} nie ma zapisanego setupu — uruchom najpierw krok PLAN`
    );
  }

  setDocRuntime(draft.id, { state: 'generating', warnings: [] });
  const generationStartedAt = Date.now();

  void (async () => {
    try {
      const pl = stored.language !== 'en';
      const systemPrompt = pl
        ? 'Jesteś analitykiem danych w Consultify. Tworzysz arkusz roboczy jako tabelę Markdown (GFM). Zwracasz WYŁĄCZNIE: linię tytułu "# <tytuł>" i jedną tabelę GFM (wiersz nagłówków, separator, wiersze danych). Maksymalnie 10 kolumn i 15 wierszy. Kolumny dobierz pod intencję użytkownika. Jeśli kontekst zawiera konkretne dane — użyj ich; w przeciwnym razie wypełnij realistycznymi wierszami startowymi (bez lorem ipsum). Bez komentarzy, bez bloków kodu.'
        : 'You are a data analyst at Consultify. You create a working sheet as a Markdown (GFM) table. Return ONLY: a title line "# <title>" and one GFM table (header row, separator, data rows). At most 10 columns and 15 rows. Choose columns to fit the user intent. If the context contains concrete data, use it; otherwise fill with realistic seed rows (no lorem ipsum). No commentary, no code fences.';
      const explicitSheetFacts = await buildGroundingFacts(
        params.organizationId,
        stored.sourceRefs,
        pl ? 'pl' : 'en'
      );
      const sheetFacts =
        explicitSheetFacts || provenance.deliverablesGeneration?.autoGrounding?.facts || null;
      const userPromptBase = stored.conversationContext
        ? `${stored.intent}\n\n${pl ? 'Kontekst rozmowy' : 'Conversation context'}:\n${stored.conversationContext.slice(0, 3000)}`
        : stored.intent;
      const userPrompt = sheetFacts ? `${userPromptBase}\n\n${sheetFacts}` : userPromptBase;

      const { generateChatResponse } = await import('../aiService.js');
      const response = await generateChatResponse({
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        model: 'standard',
        maxTokens: 2400,
      });

      setDocRuntime(draft.id, { state: 'validating', warnings: [] });

      const markdown = String(response.content || '')
        .replace(/^```(?:markdown)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      const table = extractGfmTable(markdown);
      if (!table.ok) {
        throw new Error(
          pl
            ? 'Generacja tabeli nie powiodła się — odpowiedź nie zawiera poprawnej tabeli'
            : 'Sheet generation failed — response does not contain a valid table'
        );
      }

      const baseContent = markdown.startsWith('#') ? markdown : `# ${draft.title}\n\n${markdown}`;
      const sheetRefs = stored.sourceRefs?.length
        ? stored.sourceRefs
        : provenance.deliverablesGeneration?.autoGrounding?.refs;
      const content = appendSourcesSection(baseContent, sheetRefs, pl ? 'pl' : 'en');
      await updateDraft({
        organizationId: params.organizationId,
        draftId: draft.id,
        patch: { content },
      });
      setDocRuntime(draft.id, {
        state: 'draft',
        warnings: [],
        sectionCount: table.rowCount,
      });
      // P1-4 (audyt): bez tego arkusze z czatu nie istnieją w Outputs Library.
      try {
        await registerArtifactOrigin({
          organizationId: params.organizationId,
          outputType: 'sheet',
          artifactFamily: 'sheet',
          originRuntime: 'native_artifact',
          originRecordId: draft.id,
          titleSnapshot: draft.title,
          ownerUserId: params.userId,
          createdBy: params.userId,
          originSummary: {
            sourceType: 'deliverables_sheet_generation',
            generationId: draft.id,
            sourceTable: 'work_canvas_drafts',
          },
        });
      } catch (registryErr) {
        logger.warn(
          `${LOG_PREFIX} outputs registration failed (sheet still saved): generation=${draft.id} — ${registryErr instanceof Error ? registryErr.message : String(registryErr)}`
        );
      }
      void trackDeliverableEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        generationId: draft.id,
        format: 'sheet',
        event: 'completed',
        durationMs: Date.now() - generationStartedAt,
        unitCount: table.rowCount,
        language: stored.language,
        groundingMode: stored.sourceRefs?.length ? 'source_refs' : 'conversation',
      });
      logger.info(`${LOG_PREFIX} sheet ready: generation=${draft.id} rows=${table.rowCount}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setDocRuntime(draft.id, { state: 'error', error: message, warnings: [] });
      markDraftFailedBestEffort(params.organizationId, draft.id, draft.title);
      void trackDeliverableEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        generationId: draft.id,
        format: 'sheet',
        event: 'failed',
        durationMs: Date.now() - generationStartedAt,
        error: message,
      });
      logger.error(`${LOG_PREFIX} sheet generation failed: generation=${draft.id} — ${message}`);
    }
  })();

  return {
    generationId: draft.id,
    format: 'sheet',
    state: 'generating',
  };
}

interface DraftProvenance {
  deliverablesGeneration?: {
    intake: DocumentIntake;
    outline: DocumentOutline;
    /** B4: źródła znalezione auto-skanem + fakty (snippety) do promptu. */
    autoGrounding?: { refs: DocumentSourceRef[]; facts: string | null };
  };
  [key: string]: unknown;
}

/**
 * B3 (plan wykonawczy): artefakt niesie swoje źródła — sekcja na końcu treści
 * (typ + tytuł). Klikalne chipy per sekcja = przyszła iteracja UI; v1 czytelny tekst.
 */
function appendSourcesSection(
  markdown: string,
  refs: DocumentSourceRef[] | undefined,
  language: 'pl' | 'en'
): string {
  if (!refs?.length) return markdown;
  const typeLabels: Record<string, { pl: string; en: string }> = {
    initiative: { pl: 'Inicjatywa', en: 'Initiative' },
    insight: { pl: 'Insight', en: 'Insight' },
    note: { pl: 'Notatka', en: 'Note' },
    decision: { pl: 'Decyzja', en: 'Decision' },
    task: { pl: 'Zadanie', en: 'Task' },
    report: { pl: 'Raport', en: 'Report' },
  };
  const items = refs
    .slice(0, 10)
    .map((r) => {
      const label = typeLabels[String(r.sourceType)]?.[language] || r.sourceType;
      return `- ${label}: ${r.sourceTitle || r.sourceId}`;
    })
    .join('\n');
  const heading = language === 'en' ? '## Sources' : '## Źródła';
  return `${markdown}\n\n${heading}\n\n${items}`;
}

async function getDocDraft(
  draftId: string,
  organizationId: string
): Promise<WorkCanvasDraftRecord> {
  const draft = await getDraft({ organizationId, draftId });
  if (!draft) {
    throw new DeliverablesGenerationError('not_found', `Generacja ${draftId} nie istnieje`);
  }
  return draft;
}

/**
 * Kimi-parity: deliverable w canvasie ma wyglądać jak dokument, nie jak zrzut
 * wewnętrznego schematu. Renderer (renderSchemaToMarkdown) zostaje bez zmian
 * dla eksportu/legacy — tu czyścimy jego output dla użytkownika:
 *  - blok metadanych intake'u (Document type/Audience/Goal/…),
 *  - notki `_Purpose: …_` per sekcja (scaffolding, nie treść),
 *  - techniczne etykiety calloutów (`> **KEY_MESSAGE:**` → ludzka, w języku dokumentu).
 */
export function polishMarkdownForCanvas(markdown: string, language: 'pl' | 'en'): string {
  let out = markdown;
  out = out.replace(
    /^- \*\*(Document type|Audience|Goal|Register|Density|Language style|Confidentiality):\*\*.*$\n?/gm,
    ''
  );
  out = out.replace(/^_Purpose: .*_$\n?/gm, '');
  const calloutLabels: Record<string, { pl: string; en: string }> = {
    KEY_MESSAGE: { pl: 'Kluczowa myśl', en: 'Key message' },
    NOTE: { pl: 'Uwaga', en: 'Note' },
    WARNING: { pl: 'Ostrzeżenie', en: 'Warning' },
  };
  out = out.replace(/> \*\*([A-Z_]+):\*\*/g, (_match, raw: string) => {
    const label = calloutLabels[raw]?.[language] || raw.replace(/_/g, ' ').toLowerCase();
    return `> **${label}:**`;
  });
  // Zbite puste linie po usunięciach.
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

// ── API gałęzi doc ──────────────────────────────────────────────────────────

export async function planDoc(params: {
  setup: Record<string, unknown>;
  organizationId: string;
  userId: string;
}): Promise<CreateGenerationResponse> {
  const parsed = parseSetup(params.setup);
  const intake = buildIntake(parsed);
  const { outline } = planDocument({ intake });
  const title = parsed.title || outline.title;

  // B4: brak wskazanych źródeł ⇒ Teresa sama szuka w organizacji.
  const auto = parsed.sourceRefs?.length
    ? { refs: [] as DocumentSourceRef[], facts: null as string | null }
    : await autoScanOrgSources(
        params.organizationId,
        parsed.intent,
        parsed.language === 'en' ? 'en' : 'pl'
      );

  const draft = await createDraft({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    input: {
      conversationId: parsed.conversationId!,
      kind: 'document',
      title,
      content: outlineSkeletonMarkdown(title, outline),
      sources: parsed.sourceRefs?.length ? parsed.sourceRefs : auto.refs,
      provenance: {
        deliverablesGeneration: {
          intake: { ...intake, title },
          outline,
          autoGrounding: auto.refs.length ? { refs: auto.refs, facts: auto.facts } : undefined,
        },
      } satisfies DraftProvenance,
    },
  });

  setDocRuntime(draft.id, { state: 'plan_ready', warnings: [] });
  void trackDeliverableEvent({
    organizationId: params.organizationId,
    userId: params.userId,
    generationId: draft.id,
    format: 'doc',
    event: 'plan_ready',
    language: parsed.language,
    groundingMode: parsed.sourceRefs?.length
      ? 'source_refs'
      : auto.refs.length
        ? 'auto_scan'
        : 'conversation',
  });
  logger.info(
    `${LOG_PREFIX} plan ready: generation=${draft.id} sections=${outline.sections.length} autoSources=${auto.refs.length}`
  );
  const usedRefs = parsed.sourceRefs?.length ? parsed.sourceRefs : auto.refs;
  return {
    generationId: draft.id,
    format: 'doc',
    state: 'plan_ready',
    plan: outlineToPlanItems(outline),
    warnings: [],
    sources: usedRefs.map((r) => ({
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      sourceTitle: r.sourceTitle,
    })),
  };
}

export async function startDoc(params: {
  generationId: string;
  setup: Record<string, unknown>;
  organizationId: string;
  userId: string;
  plan?: GenerationPlanItem[];
}): Promise<GenerationStatusResponse> {
  const draft = await getDocDraft(params.generationId, params.organizationId);
  if (docRuntimeState.get(draft.id)?.state === 'generating') {
    throw new DeliverablesGenerationError(
      'invalid_state',
      `Generacja ${draft.id} już trwa — odpytuj status zamiast startować ponownie`
    );
  }

  const provenance = (draft.provenance || {}) as DraftProvenance;
  const stored = provenance.deliverablesGeneration;
  if (!stored?.intake || !stored?.outline) {
    throw new DeliverablesGenerationError(
      'invalid_state',
      `Generacja ${draft.id} nie ma zapisanego planu — uruchom najpierw krok PLAN`
    );
  }
  const outline = params.plan?.length
    ? applyPlanToOutline(stored.outline, params.plan)
    : stored.outline;

  setDocRuntime(draft.id, { state: 'generating', warnings: [] });
  const generationStartedAt = Date.now();

  // W tle (wzorzec Gamma, jak deck w L1). Stan przez status() (poll).
  void (async () => {
    try {
      // B2: fakty z encji org (jeśli wskazane) wzbogacają opis dla silnika prozy.
      const explicitFacts = await buildGroundingFacts(
        params.organizationId,
        stored.intake.sourceHints,
        stored.intake.language === 'en' ? 'en' : 'pl'
      );
      const groundingFacts = explicitFacts || stored.autoGrounding?.facts || null;
      const intake = groundingFacts
        ? { ...stored.intake, description: `${stored.intake.description}\n\n${groundingFacts}` }
        : stored.intake;
      const result = await materializeDocumentArtifact({
        organizationId: params.organizationId,
        userId: params.userId,
        intake,
        outline,
        sourceRefs: stored.intake.sourceHints,
        useLlm: true,
      });
      setDocRuntime(draft.id, {
        state: 'validating',
        warnings: [],
        sectionCount: outline.sections.length,
      });

      const rendered = renderSchemaToMarkdown(result.schema);
      // D-L2-3: silnik D11 przy błędzie LLM po cichu oddaje stuby —
      // tu zamieniamy cichą degradację na uczciwy błąd.
      if (isPlaceholderDocumentProse(rendered)) {
        throw new Error(
          'Generacja treści nie powiodła się (LLM niedostępny) — dokument nie został wypełniony'
        );
      }
      const markdown = polishMarkdownForCanvas(
        rendered,
        stored.intake.language === 'en' ? 'en' : 'pl'
      );
      const docLang = stored.intake.language === 'en' ? ('en' as const) : ('pl' as const);
      const usedRefs = stored.intake.sourceHints?.length
        ? stored.intake.sourceHints
        : stored.autoGrounding?.refs;
      const markdownWithSources = appendSourcesSection(markdown, usedRefs, docLang);

      await updateDraft({
        organizationId: params.organizationId,
        draftId: draft.id,
        patch: { content: markdownWithSources, artifactId: result.artifactId },
      });
      // C7 — zarejestruj gotowy dokument w rejestrze Outputs (best-effort).
      await registerDocArtifactBestEffort({
        organizationId: params.organizationId,
        userId: params.userId,
        documentArtifactId: result.artifactId,
        title: String(result.schema?.title || stored.intake.title || draft.title),
        generationDraftId: draft.id,
        sourceRefs: stored.intake.sourceHints,
      });
      setDocRuntime(draft.id, {
        state: 'draft',
        warnings: [],
        sectionCount: outline.sections.length,
        documentArtifactId: result.artifactId,
      });
      void trackDeliverableEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        generationId: draft.id,
        format: 'doc',
        event: 'completed',
        durationMs: Date.now() - generationStartedAt,
        unitCount: outline.sections.length,
        language: stored.intake.language,
        groundingMode: stored.intake.sourceHints?.length ? 'source_refs' : 'conversation',
      });
      logger.info(
        `${LOG_PREFIX} draft ready: generation=${draft.id} sections=${outline.sections.length} artifact=${result.artifactId}`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setDocRuntime(draft.id, { state: 'error', error: message, warnings: [] });
      markDraftFailedBestEffort(params.organizationId, draft.id, draft.title);
      void trackDeliverableEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        generationId: draft.id,
        format: 'doc',
        event: 'failed',
        durationMs: Date.now() - generationStartedAt,
        error: message,
      });
      logger.error(`${LOG_PREFIX} generation failed: generation=${draft.id} — ${message}`);
    }
  })();

  return {
    generationId: draft.id,
    format: 'doc',
    state: 'generating',
    plan: outlineToPlanItems(outline),
  };
}

export async function statusDoc(params: {
  generationId: string;
  organizationId: string;
}): Promise<GenerationStatusResponse> {
  const draft = await getDocDraft(params.generationId, params.organizationId);
  const runtime = docRuntimeState.get(draft.id);
  // L3: ta sama ścieżka statusu obsługuje doc i sheet — format po kind draftu.
  const format = draft.kind === 'table' ? ('sheet' as const) : ('doc' as const);

  // Po restarcie serwera mapa jest pusta — wnioskujemy z draftu: wypełniona
  // treść bez markera szkieletu ⇒ draft gotowy; inaczej plan_ready.
  const content = typeof draft.content === 'string' ? draft.content : '';
  const fallbackState: DocRuntimeEntry['state'] = content.includes(GENERATION_PENDING_MARKER)
    ? 'plan_ready'
    : 'draft';
  const state = runtime?.state || fallbackState;

  const response: GenerationStatusResponse = {
    generationId: draft.id,
    format,
    state,
  };
  if (state === 'error') {
    response.error = runtime?.error || 'Generacja nie powiodła się';
  }
  if (state === 'draft') {
    response.artifact = {
      artifactId: runtime?.documentArtifactId || draft.artifactId || draft.id,
      originRecordId: draft.id,
      format,
      title: draft.title,
      unitCount:
        runtime?.sectionCount ??
        (format === 'sheet'
          ? Math.max(0, (content.match(/^\|/gm) || []).length - 2)
          : (content.match(/^## /gm) || []).length),
    };
  }
  return response;
}

/** Czy generationId należy do gałęzi doc (draft istnieje w work_canvas_drafts)? */
export async function isDocGeneration(
  generationId: string,
  organizationId: string
): Promise<boolean> {
  if (docRuntimeState.has(generationId)) return true;
  const draft = await getDraft({ organizationId, draftId: generationId });
  return Boolean(draft);
}

/** Wyłącznie do testów. */
export function __clearDocRuntimeStateForTests(): void {
  docRuntimeState.clear();
}

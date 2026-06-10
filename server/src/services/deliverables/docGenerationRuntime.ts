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

const docRuntimeState = new Map<string, DocRuntimeEntry>();

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
  return {
    intent,
    language: setup.language === 'en' ? 'en' : 'pl',
    title: typeof setup.title === 'string' && setup.title.trim() ? setup.title.trim() : undefined,
    conversationContext:
      typeof setup.conversationContext === 'string' ? setup.conversationContext : undefined,
    sourceRefs: Array.isArray(setup.sourceRefs)
      ? (setup.sourceRefs as DocumentSourceRef[])
      : undefined,
    conversationId:
      typeof setup.conversationId === 'string' && setup.conversationId
        ? setup.conversationId
        : undefined,
    audience: Array.isArray(setup.audience) ? (setup.audience as string[]) : undefined,
  };
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

  const draft = await createDraft({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    input: {
      conversationId: parsed.conversationId || 'chat',
      kind: 'table',
      title,
      content: sheetSkeletonMarkdown(title),
      sources: parsed.sourceRefs || [],
      provenance: {
        deliverablesGeneration: { sheetSetup: { ...parsed, title } },
      },
    },
  });

  docRuntimeState.set(draft.id, { state: 'plan_ready', warnings: [] });
  logger.info(`${LOG_PREFIX} sheet plan ready: generation=${draft.id}`);
  return {
    generationId: draft.id,
    format: 'sheet',
    state: 'plan_ready',
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

  docRuntimeState.set(draft.id, { state: 'generating', warnings: [] });

  void (async () => {
    try {
      const pl = stored.language !== 'en';
      const systemPrompt = pl
        ? 'Jesteś analitykiem danych w Consultify. Tworzysz arkusz roboczy jako tabelę Markdown (GFM). Zwracasz WYŁĄCZNIE: linię tytułu "# <tytuł>" i jedną tabelę GFM (wiersz nagłówków, separator, wiersze danych). Maksymalnie 10 kolumn i 15 wierszy. Kolumny dobierz pod intencję użytkownika. Jeśli kontekst zawiera konkretne dane — użyj ich; w przeciwnym razie wypełnij realistycznymi wierszami startowymi (bez lorem ipsum). Bez komentarzy, bez bloków kodu.'
        : 'You are a data analyst at Consultify. You create a working sheet as a Markdown (GFM) table. Return ONLY: a title line "# <title>" and one GFM table (header row, separator, data rows). At most 10 columns and 15 rows. Choose columns to fit the user intent. If the context contains concrete data, use it; otherwise fill with realistic seed rows (no lorem ipsum). No commentary, no code fences.';
      const userPrompt = stored.conversationContext
        ? `${stored.intent}\n\n${pl ? 'Kontekst rozmowy' : 'Conversation context'}:\n${stored.conversationContext.slice(0, 3000)}`
        : stored.intent;

      const { generateChatResponse } = await import('../aiService.js');
      const response = await generateChatResponse({
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        model: 'standard',
        maxTokens: 2400,
      });

      docRuntimeState.set(draft.id, { state: 'validating', warnings: [] });

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

      const content = markdown.startsWith('#') ? markdown : `# ${draft.title}\n\n${markdown}`;
      await updateDraft({
        organizationId: params.organizationId,
        draftId: draft.id,
        patch: { content },
      });
      docRuntimeState.set(draft.id, {
        state: 'draft',
        warnings: [],
        sectionCount: table.rowCount,
      });
      logger.info(`${LOG_PREFIX} sheet ready: generation=${draft.id} rows=${table.rowCount}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      docRuntimeState.set(draft.id, { state: 'error', error: message, warnings: [] });
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
  };
  [key: string]: unknown;
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

  const draft = await createDraft({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    input: {
      conversationId: parsed.conversationId || 'chat',
      kind: 'document',
      title,
      content: outlineSkeletonMarkdown(title, outline),
      sources: parsed.sourceRefs || [],
      provenance: {
        deliverablesGeneration: { intake: { ...intake, title }, outline },
      } satisfies DraftProvenance,
    },
  });

  docRuntimeState.set(draft.id, { state: 'plan_ready', warnings: [] });
  logger.info(
    `${LOG_PREFIX} plan ready: generation=${draft.id} sections=${outline.sections.length}`
  );
  return {
    generationId: draft.id,
    format: 'doc',
    state: 'plan_ready',
    plan: outlineToPlanItems(outline),
    warnings: [],
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

  docRuntimeState.set(draft.id, { state: 'generating', warnings: [] });

  // W tle (wzorzec Gamma, jak deck w L1). Stan przez status() (poll).
  void (async () => {
    try {
      const result = await materializeDocumentArtifact({
        organizationId: params.organizationId,
        userId: params.userId,
        intake: stored.intake,
        outline,
        sourceRefs: stored.intake.sourceHints,
        useLlm: true,
      });
      docRuntimeState.set(draft.id, {
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

      await updateDraft({
        organizationId: params.organizationId,
        draftId: draft.id,
        patch: { content: markdown, artifactId: result.artifactId },
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
      docRuntimeState.set(draft.id, {
        state: 'draft',
        warnings: [],
        sectionCount: outline.sections.length,
        documentArtifactId: result.artifactId,
      });
      logger.info(
        `${LOG_PREFIX} draft ready: generation=${draft.id} sections=${outline.sections.length} artifact=${result.artifactId}`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      docRuntimeState.set(draft.id, { state: 'error', error: message, warnings: [] });
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

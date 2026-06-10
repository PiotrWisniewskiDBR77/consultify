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
import type {
  DocumentIntake,
  DocumentOutline,
  DocumentSourceRef,
} from '../documentStudio/documentStudioTypes.js';
import { renderSchemaToMarkdown } from '../documentStudio/documentSchemaRenderer.js';
import {
  materializeDocumentArtifact,
  planDocument,
} from '../documentStudio/documentStudioService.js';
import {
  createDraft,
  getDraft,
  updateDraft,
  type WorkCanvasDraftRecord,
} from '../workCanvasService.js';
import { DeliverablesGenerationError } from './errors.js';

const LOG_PREFIX = '[DeliverablesGen:doc]';

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

      const markdown = renderSchemaToMarkdown(result.schema);
      // D-L2-3: silnik D11 przy błędzie LLM po cichu oddaje stuby —
      // tu zamieniamy cichą degradację na uczciwy błąd.
      if (isPlaceholderDocumentProse(markdown)) {
        throw new Error(
          'Generacja treści nie powiodła się (LLM niedostępny) — dokument nie został wypełniony'
        );
      }

      await updateDraft({
        organizationId: params.organizationId,
        draftId: draft.id,
        patch: { content: markdown, artifactId: result.artifactId },
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

  // Po restarcie serwera mapa jest pusta — wnioskujemy z draftu: wypełniona
  // treść bez markera szkieletu ⇒ draft gotowy; inaczej plan_ready.
  const content = typeof draft.content === 'string' ? draft.content : '';
  const fallbackState: DocRuntimeEntry['state'] = content.includes(
    'sekcje wypełnią się po zakończeniu generacji'
  )
    ? 'plan_ready'
    : 'draft';
  const state = runtime?.state || fallbackState;

  const response: GenerationStatusResponse = {
    generationId: draft.id,
    format: 'doc',
    state,
  };
  if (state === 'error') {
    response.error = runtime?.error || 'Generacja nie powiodła się';
  }
  if (state === 'draft') {
    response.artifact = {
      artifactId: runtime?.documentArtifactId || draft.artifactId || draft.id,
      originRecordId: draft.id,
      format: 'doc',
      title: draft.title,
      unitCount: runtime?.sectionCount ?? (content.match(/^## /gm) || []).length,
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

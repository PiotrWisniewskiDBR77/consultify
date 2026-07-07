/**
 * Tool: generate_deliverable (SPEC_01 — kręgosłup czat→deliverable, Tryb A)
 *
 * Daje Teresie REALNE narzędzie do utworzenia artefaktu (dokument / arkusz /
 * prezentacja) i otwarcia go w canvasie — zamiast halucynowania „dodałem do
 * Canvasa". Function-calling rozwiązuje słabość wąskiego regexu na froncie:
 * model sam decyduje, że prośba wymaga deliverable, i dopiero PO zwrocie tool
 * (z generationId) potwierdza wykonanie.
 *
 * Wykonanie tworzy SZKIELET draftu (odwracalny, lifecycle='draft') i odpala
 * generację treści w tle — bramka approval dotyczy dopiero EKSPORTU (M17 L-01),
 * nie utworzenia draftu. Dlatego tool jest typu READ (auto-exec), nie MUTATION.
 *
 * Most do frontu: handler woła `context.onDeliverable({...})`, które route
 * mapuje na SSE event `{type:'deliverable'}`; front montuje panel canvasa tą
 * samą sekwencją co istniejący przechwytywacz intencji (Tryb B, już zamknięty).
 */

import { featureFlags } from '../../../config/FeatureFlags.js';
import type { DeliverableFormat } from '../../../types/deliverablesGeneration.js';
import logger from '../../../utils/Logger.js';
import {
  plan as planGeneration,
  start as startGeneration,
} from '../../deliverables/deliverablesGenerationService.js';
import { createNote } from '../../notebookService.js';
import { hasPresentationCapability } from '../../presentationAccessPolicyService.js';
import {
  buildIdeasTableSkeleton,
  buildProcessFlowSkeleton,
  buildWhiteboardSkeleton,
  type CanvasSkeletonGraph,
} from '../canvasToolSkeletons.js';
import { buildMindmapSkeleton, type MindmapSkeletonGraph } from '../mindmapSkeleton.js';

type DeliverableKind =
  | 'document'
  | 'sheet'
  | 'presentation'
  | 'mindmap'
  | 'process_flow'
  | 'table'
  | 'whiteboard'
  | 'note';

type GenerateDeliverableParams = {
  type: DeliverableKind;
  intent: string;
  title?: string;
};

/**
 * Side-channel emitter wstrzyknięty przez warstwę route (ai.routes.ts) —
 * tłumaczy zdarzenie tool na SSE `{type:'deliverable'}`. In-process, więc
 * funkcja w kontekście jest dozwolona (nie jest serializowana).
 */
export type DeliverableEmit = (payload: {
  draftId: string;
  generationId: string;
  kind: 'doc' | 'sheet' | 'deck' | 'mindmap' | 'process_flow' | 'table' | 'whiteboard' | 'note';
  format: DeliverableFormat;
  title: string;
  /**
   * Only present for `kind:'mindmap'|'process_flow'|'table'|'whiteboard'` — the
   * pre-built skeleton graph the FE seeds into the Ideas workspace mount for
   * that tool. Absent for doc/sheet/deck (those hydrate their content from the
   * DB-bound generation runtime via draftId) and for `note` (already a real
   * DB row by the time this fires).
   */
  graph?: MindmapSkeletonGraph | CanvasSkeletonGraph;
  /** Only present for canvas-tool kinds — the topic seed text for AI expansion. */
  seedText?: string;
  /**
   * Only present for canvas-tool kinds — which idea-workspace tool to open
   * (`preferredSystem` on the seed intent). Mirrors `kind` 1:1 except mindmap
   * keeps its historical bare `kind:'mindmap'` wiring.
   */
  preferredSystem?: 'mindmap' | 'process_flow' | 'table' | 'whiteboard';
  /** Only present for `kind:'note'` — the real notebook_pages id. */
  noteId?: string;
  /**
   * Best-effort SYNCHRONOUS content signal for the post-stream quality scorer
   * (BUG2). doc/sheet/deck generate their body in the BACKGROUND, so the real
   * artifact text is not available when this fires — `intent` is the model's own
   * rich restatement of what the artifact must contain and is the strongest
   * synchronous proxy. For canvas tools this is the seed text. The route feeds
   * this (not the thin "Utworzyłem…" chat-confirmation) to qc.check so mece/
   * actionability reflect the ARTIFACT scope, not the confirmation sentence.
   */
  scorerContent?: string;
}) => void;

type GenerateDeliverableContext = {
  organizationId?: string;
  userId?: string;
  conversationId?: string | null;
  language?: string;
  role?: string;
  onDeliverable?: DeliverableEmit;
};

const KIND_TO_FORMAT: Record<DeliverableKind, DeliverableFormat> = {
  document: 'doc',
  sheet: 'sheet',
  presentation: 'deck',
  mindmap: 'mindmap',
  process_flow: 'process_flow',
  table: 'table',
  whiteboard: 'whiteboard',
  note: 'note',
};

/** Canvas-tool kinds that follow the mind-map skeleton→FE-mount wiring. */
const CANVAS_TOOL_FORMATS = new Set<DeliverableFormat>(['process_flow', 'table', 'whiteboard']);

function deriveTitle(rawTitle: string | undefined, intent: string, language: 'pl' | 'en'): string {
  const t = String(rawTitle || '').trim();
  if (t) return t.slice(0, 200);
  const cleaned = String(intent || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) return cleaned.slice(0, 80);
  return language === 'en' ? 'Document from chat' : 'Dokument z czatu';
}

export async function generateDeliverable(
  params: GenerateDeliverableParams,
  context: GenerateDeliverableContext = {}
): Promise<Record<string, unknown>> {
  const orgId = String(context.organizationId || '').trim();
  const userId = String(context.userId || '').trim();
  if (!orgId || !userId) {
    return {
      ok: false,
      error: 'missing_context',
      message: 'Nie mogę utworzyć artefaktu bez kontekstu organizacji/użytkownika.',
    };
  }

  // Flaga musi być ON — inaczej runtime draftów nie żyje (legacy redirect na froncie).
  if (!featureFlags.ENABLE_DELIVERABLES_LIGHT) {
    return {
      ok: false,
      error: 'feature_disabled',
      message:
        'Generacja artefaktów w canvasie jest wyłączona w tym środowisku — skieruj użytkownika do właściwego modułu (Dokumenty / Tabele / Prezentacje).',
    };
  }

  // Bramka uprawnień — VIEWER nie generuje (parytet z route ensureGenerateCapability).
  const role = String(context.role || 'VIEWER');
  if (!hasPresentationCapability(role, 'presentation_create')) {
    return {
      ok: false,
      error: 'permission_denied',
      message: 'Twoja rola nie pozwala na generowanie artefaktów. Poproś administratora o dostęp.',
    };
  }

  const kind = params.type;
  const format = KIND_TO_FORMAT[kind];
  if (!format) {
    return {
      ok: false,
      error: 'invalid_type',
      message: `Nieznany typ artefaktu '${String(kind)}' — dozwolone: document, sheet, presentation, mindmap, process_flow, table, whiteboard, note.`,
    };
  }

  const language: 'pl' | 'en' = context.language === 'en' ? 'en' : 'pl';
  const intent = String(params.intent || '').trim();
  const title = deriveTitle(params.title, intent, language);
  const conversationId = context.conversationId ? String(context.conversationId) : undefined;

  // ── M06 Fala 2 · 2.3 — mind map (ff_teresaMindmap) ──────────────────────────
  // Mapa NIE przechodzi przez DB-bound runtime deck/doc/sheet. Handler self-gate
  // na ENABLE_TERESA_MINDMAP (OFF ⇒ feature_disabled, parytet z resztą), buduje
  // realny szkielet grafu z intentu i emituje go do frontu, który montuje mapę
  // w Ideas. Brak wiersza `presentation_decks`, brak planGeneration/startGeneration.
  if (format === 'mindmap') {
    if (!featureFlags.ENABLE_TERESA_MINDMAP) {
      return {
        ok: false,
        error: 'feature_disabled',
        message:
          language === 'en'
            ? 'Mind-map generation is disabled in this environment — point the user to the Ideas module.'
            : 'Generacja map myśli jest wyłączona w tym środowisku — skieruj użytkownika do modułu Pomysły (Ideas).',
      };
    }

    // TODO (M06 Fala 2 · [REAL-AI] nightly): swap this deterministic skeleton for
    // an LLM-backed generator (semantic branches + sub-nodes + notes). Wiring is
    // format-stable; only buildMindmapSkeleton changes. Tracked as risk R1.
    const graph: MindmapSkeletonGraph = buildMindmapSkeleton(intent, params.title);
    // Client-generated id — the real idea/map rows are created on the FE mount
    // path (setMyWorkIntent → IdeaMapWorkspace), which owns idea/map persistence.
    const mindmapId = `chat-mindmap-${Date.now()}`;

    try {
      context.onDeliverable?.({
        draftId: mindmapId,
        generationId: mindmapId,
        kind: 'mindmap',
        format: 'mindmap',
        title,
        graph,
        seedText: intent || title,
        scorerContent: `${title}\n\n${intent || ''}`.trim(),
      });
    } catch (emitErr) {
      logger.warn(
        `[generate_deliverable] mindmap onDeliverable emit failed id=${mindmapId}: ${
          emitErr instanceof Error ? emitErr.message : String(emitErr)
        }`
      );
    }

    logger.info(
      `[generate_deliverable] mindmap skeleton id=${mindmapId} nodes=${graph.nodes.length} title="${title.slice(0, 80)}"`
    );

    return {
      ok: true,
      kind: 'mindmap',
      format: 'mindmap',
      title,
      generationId: mindmapId,
      draftId: mindmapId,
      message:
        language === 'en'
          ? `A mind map titled "${title}" was created and opened in the Ideas workspace on the right. You can expand any branch with AI.`
          : `Utworzyłem mapę myśli „${title}" i otworzyłem ją w module Pomysły po prawej. Każdą gałąź możesz rozwinąć z AI.`,
    };
  }

  // ── Teresa "all 8 tools" · process_flow / table (M08) / whiteboard ──────────
  // Same non-DB-bound wiring as mindmap: self-gate on ENABLE_TERESA_CANVAS_TOOLS,
  // build a real skeleton {nodes,edges} from the intent, emit it to the FE which
  // mounts it on the idea-workspace "new idea" path (real my_ideas +
  // my_idea_maps row, preferred_tool set to the format — survives reload).
  if (CANVAS_TOOL_FORMATS.has(format)) {
    if (!featureFlags.ENABLE_TERESA_CANVAS_TOOLS) {
      return {
        ok: false,
        error: 'feature_disabled',
        message:
          language === 'en'
            ? 'Canvas-tool generation is disabled in this environment — point the user to the Ideas module.'
            : 'Generacja narzędzi canvasu jest wyłączona w tym środowisku — skieruj użytkownika do modułu Pomysły (Ideas).',
      };
    }

    const isPolish = language === 'pl';
    const preferredSystem = kind as 'process_flow' | 'table' | 'whiteboard';
    const graph: CanvasSkeletonGraph =
      preferredSystem === 'process_flow'
        ? buildProcessFlowSkeleton(intent, params.title, isPolish)
        : preferredSystem === 'table'
          ? buildIdeasTableSkeleton(intent, params.title, isPolish)
          : buildWhiteboardSkeleton(intent, params.title, isPolish);

    // Client-generated id — the real idea/map rows are created on the FE mount
    // path (setMyWorkIntent → IdeaMapWorkspace), which owns idea/map persistence
    // (identical contract to the mindmap branch above).
    const draftId = `chat-${preferredSystem}-${Date.now()}`;

    try {
      context.onDeliverable?.({
        draftId,
        generationId: draftId,
        kind: preferredSystem,
        format,
        title,
        graph,
        seedText: intent || title,
        preferredSystem,
        scorerContent: `${title}\n\n${intent || ''}`.trim(),
      });
    } catch (emitErr) {
      logger.warn(
        `[generate_deliverable] ${preferredSystem} onDeliverable emit failed id=${draftId}: ${
          emitErr instanceof Error ? emitErr.message : String(emitErr)
        }`
      );
    }

    logger.info(
      `[generate_deliverable] ${preferredSystem} skeleton id=${draftId} nodes=${graph.nodes.length} title="${title.slice(0, 80)}"`
    );

    const kindLabelPl =
      preferredSystem === 'process_flow'
        ? 'przepływ procesu'
        : preferredSystem === 'table'
          ? 'tabelę pomysłów'
          : 'tablicę';
    const kindLabelEn =
      preferredSystem === 'process_flow'
        ? 'process flow'
        : preferredSystem === 'table'
          ? 'ideas table'
          : 'whiteboard';

    return {
      ok: true,
      kind: preferredSystem,
      format,
      title,
      generationId: draftId,
      draftId,
      message:
        language === 'en'
          ? `A ${kindLabelEn} titled "${title}" was created and opened in the Ideas workspace on the right.`
          : `Utworzyłem ${kindLabelPl} „${title}" i otworzyłem ją w module Pomysły po prawej.`,
    };
  }

  // ── Teresa "all 8 tools" · note (real notebook_pages row) ───────────────────
  // Unlike the canvas tools above, a note is NOT a skeleton the FE materializes
  // later — notebookService.createNote writes the row synchronously (same path
  // "save message as note" already uses), so onDeliverable carries the real id.
  if (format === 'note') {
    if (!featureFlags.ENABLE_TERESA_NOTE_CREATE) {
      return {
        ok: false,
        error: 'feature_disabled',
        message:
          language === 'en'
            ? 'Note generation is disabled in this environment — point the user to the Notebook module.'
            : 'Generacja notatek jest wyłączona w tym środowisku — skieruj użytkownika do modułu Notatnik.',
      };
    }

    try {
      const created = await createNote({
        organizationId: orgId,
        userId,
        title,
        body: intent,
        source: 'chat',
      });

      try {
        context.onDeliverable?.({
          draftId: created.id,
          generationId: created.id,
          kind: 'note',
          format: 'note',
          title: created.title,
          noteId: created.id,
          scorerContent: `${created.title}\n\n${intent || ''}`.trim(),
        });
      } catch (emitErr) {
        logger.warn(
          `[generate_deliverable] note onDeliverable emit failed id=${created.id}: ${
            emitErr instanceof Error ? emitErr.message : String(emitErr)
          }`
        );
      }

      logger.info(
        `[generate_deliverable] note created id=${created.id} title="${title.slice(0, 80)}"`
      );

      return {
        ok: true,
        kind: 'note',
        format: 'note',
        title: created.title,
        generationId: created.id,
        draftId: created.id,
        message:
          language === 'en'
            ? `A note titled "${created.title}" was saved to the Notebook.`
            : `Zapisałem notatkę „${created.title}" w Notatniku.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[generate_deliverable] note creation failed: ${message}`);
      return {
        ok: false,
        error: 'generation_failed',
        message:
          language === 'en'
            ? `I could not create the note. ${message}`
            : `Nie udało się utworzyć notatki. ${message}`,
      };
    }
  }

  // Setup per format. doc/sheet biorą intent+conversation; deck wymaga pełnego
  // DeckSetup (enumy) — wypełniamy bezpiecznymi domyślnymi, użytkownik dostroi
  // w studiu prezentacji. Zgodne z DeckSetupSchema w deliverablesGenerations.routes.
  const setup: Record<string, unknown> =
    format === 'deck'
      ? {
          title,
          language,
          audience: 'internal',
          goal: 'inform',
          theme: 'corporate',
          confidentiality: 'internal',
          sourceArtifacts: [],
        }
      : {
          intent,
          title,
          language,
          conversationId,
        };

  try {
    const planned = await planGeneration({
      format,
      setup,
      intent,
      organizationId: orgId,
      userId,
    });

    const generationId = String(planned.generationId);

    // Odpal generację treści w tle (202 + poll) — nie czekamy; panel canvasa
    // hydratuje treść po zamontowaniu. Błąd startu nie blokuje montażu szkieletu.
    try {
      await startGeneration({
        generationId,
        format,
        setup,
        organizationId: orgId,
        userId,
      });
    } catch (startErr) {
      logger.warn(
        `[generate_deliverable] start failed (skeleton still mounted) gen=${generationId}: ${
          startErr instanceof Error ? startErr.message : String(startErr)
        }`
      );
    }

    const shortKind: 'doc' | 'sheet' | 'deck' =
      format === 'doc' ? 'doc' : format === 'sheet' ? 'sheet' : 'deck';

    // Most do frontu — montaż panelu canvasa.
    try {
      context.onDeliverable?.({
        draftId: generationId,
        generationId,
        kind: shortKind,
        format,
        title,
        scorerContent: `${title}\n\n${intent || ''}`.trim(),
      });
    } catch (emitErr) {
      logger.warn(
        `[generate_deliverable] onDeliverable emit failed gen=${generationId}: ${
          emitErr instanceof Error ? emitErr.message : String(emitErr)
        }`
      );
    }

    logger.info(
      `[generate_deliverable] created format=${format} gen=${generationId} title="${title.slice(0, 80)}"`
    );

    // Zwrot dla modelu — KRÓTKI, zgodny z kontraktem persony (potwierdzaj fakt,
    // nie zmyślaj). Model ma na tej podstawie napisać 1 zdanie potwierdzenia.
    return {
      ok: true,
      kind: shortKind,
      format,
      title,
      generationId,
      draftId: generationId,
      message:
        language === 'en'
          ? `A ${shortKind} draft titled "${title}" was created and opened in the canvas on the right. Content is being generated now.`
          : `Utworzyłem ${shortKind === 'doc' ? 'dokument' : shortKind === 'sheet' ? 'arkusz' : 'prezentację'} „${title}" i otworzyłem go w canvasie po prawej. Treść jest właśnie generowana.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[generate_deliverable] failed format=${format}: ${message}`);
    return {
      ok: false,
      error: 'generation_failed',
      message:
        language === 'en'
          ? `I could not create the ${kind}. ${message}`
          : `Nie udało się utworzyć artefaktu. ${message}`,
    };
  }
}

export default { generateDeliverable };

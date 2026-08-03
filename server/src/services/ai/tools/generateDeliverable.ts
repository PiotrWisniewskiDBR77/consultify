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
import type { EvidenceContract } from '../../evidence/evidenceContract.js';
import { safePersistEvidenceContract } from '../../evidence/evidenceContractBridge.js';
import { createNote } from '../../notebookService.js';
import { hasPresentationCapability } from '../../presentationAccessPolicyService.js';
import {
  buildMindmapEvidenceContract,
  buildNoteEvidenceContract,
  buildProcessFlowEvidenceContract,
  generateMindmapGraph,
  generateNoteContent,
  generateProcessFlowGraph,
  generateTableGraph,
  generateWhiteboardGraph,
  type LlmGraph,
} from '../canvasGraphLlm.js';
import {
  buildIdeasTableSkeleton,
  buildProcessFlowSkeleton,
  buildWhiteboardSkeleton,
  type CanvasSkeletonGraph,
} from '../canvasToolSkeletons.js';
import { inferAudienceLabel, type ResolvedDeckBrief, resolveDeckBrief } from '../deckChatBrief.js';
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
  /**
   * Deck only — jawny odbiorca/cel podany przez model (opcjonalnie). Gdy obecne,
   * WYGRYWA z wnioskowaniem z `intent` (patrz `resolveDeckBrief`). Ignorowane dla
   * pozostałych typów.
   */
  audience?: string;
  goal?: string;
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
  graph?: MindmapSkeletonGraph | CanvasSkeletonGraph | LlmGraph;
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
  /**
   * HP-16 (7/8, 8/8) — only present for `kind:'mindmap'|'process_flow'` — the
   * real `EvidenceContract` built from the FINAL graph (LLM or skeleton
   * fallback), see `buildMindmapEvidenceContract`/`buildProcessFlowEvidenceContract`
   * in `canvasGraphLlm.ts`. FE render (ArtifactRightPanel) is out of scope here
   * (HP-16 doctrine — mirrors the other 6 wired tools); this is the backend
   * contract surface only.
   */
  evidence?: EvidenceContract;
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
  // Deck: wyprowadź brief (audience·goal·tytuł) z prośby zamiast hardkodu
  // `internal/inform` i tytułu-polecenia (audyt 2026-07-22). Reszta typów bez zmian.
  const deckBrief: ResolvedDeckBrief | null =
    format === 'deck'
      ? resolveDeckBrief(intent, {
          audience: params.audience,
          goal: params.goal,
          title: params.title,
        })
      : null;
  const title =
    deckBrief && deckBrief.title ? deckBrief.title : deriveTitle(params.title, intent, language);
  // Word (doc): audience do promptu (audyt 2026-07-22) — downstream już wpięty
  // (documentBlockProseGenerator „written for the audience: …"), brakowało tylko
  // wejścia z czatu. Jawny audience od modelu WYGRYWA; inaczej etykieta z intentu.
  // Bez sygnału → undefined (runtime spada na „internal stakeholders", bez regresji).
  const docAudience: string[] | undefined =
    format === 'doc'
      ? params.audience && params.audience.trim()
        ? [params.audience.trim()]
        : (() => {
            const label = inferAudienceLabel(intent, language === 'pl');
            return label ? [label] : undefined;
          })()
      : undefined;
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

    // naprawa-c1Graph: LLM-generate a real hierarchical mind map (concise center
    // + semantic pillars + goal/risk sub-nodes) instead of the seedText splitter
    // (which produced fragment labels + flat stars). Fail-soft: on any LLM error /
    // parse failure / anti-fragment rejection, fall back to the deterministic
    // skeleton so the map always opens.
    const llmGraph: LlmGraph | null = await generateMindmapGraph(
      intent,
      params.title,
      language === 'pl'
    );
    const graph: MindmapSkeletonGraph | LlmGraph =
      llmGraph ?? buildMindmapSkeleton(intent, params.title);
    const graphSource: 'llm' | 'skeleton' = llmGraph ? 'llm' : 'skeleton';
    logger.info(`[generate_deliverable] mindmap graph source=${graphSource}`);
    // HP-16 (7/8) — realny EvidenceContract z FINALNEGO grafu (LLM lub skeleton
    // fallback), zero LLM-zgadywania — patrz `buildMindmapEvidenceContract`.
    const evidence = buildMindmapEvidenceContract(graph, {
      source: graphSource,
      seedText: intent || title,
    });
    // Materialize a REAL my_ideas/my_idea_maps row server-side (mirrors the
    // note branch below) so persistence is not FE-contingent — the FE mount
    // path (IdeaMapWorkspace.hydrate) simply loads this id instead of creating
    // it. Fail-soft: on any materialize error, fall back to the old
    // client-generated-id contract (FE creates it on mount) so a transient DB
    // error never breaks the chat turn.
    let mindmapId = `chat-mindmap-${Date.now()}`;
    try {
      const { materializeOrThrow } = await import('../../canvasMaterialize.js');
      const materialized = await materializeOrThrow(
        {
          organizationId: orgId,
          actorUserId: userId,
          target: 'idea',
          title,
          contentMd: intent || title,
          summary: intent || title,
          projectId: null,
          sourceDraftId: conversationId || `chat-mindmap-${Date.now()}`,
          sourceConversationId: conversationId,
          graph: {
            nodes: graph.nodes,
            edges: graph.edges,
            // HP-16 (7/8) — evidence rides along in extensions so it survives
            // reload (my_idea_maps.extensions_json), same slot other canvas
            // metadata (source/draftId) already uses.
            extensions: { ...(graph as LlmGraph).extensions, evidence },
          },
          preferredTool: 'mindmap',
          sourceType: 'teresa_chat',
        },
        { writer: 'chat_deliverable' }
      );
      mindmapId = materialized.id;
      // HP-17 bridge — persist the inline EvidenceContract (built above) as an
      // EvidenceEnvelope (`artifact_evidence`, artifactType='canvas') so the
      // evidence panel has something to render for mind maps. Previously: the
      // contract rode along only in `my_idea_maps.extensions_json` — never
      // persisted to the polymorphic evidence table the panel actually fetches
      // from. Fire-and-forget + fail-safe: never blocks the chat turn.
      void safePersistEvidenceContract(evidence, {
        organizationId: orgId,
        artifactType: 'canvas',
        artifactId: mindmapId,
        service: 'canvasGraphLlm.generateMindmapGraph',
        createdBy: userId,
      }).catch(() => {});
    } catch (materializeErr) {
      logger.warn(
        `[generate_deliverable] mindmap server-side materialize failed, falling back to FE-mount id: ${
          materializeErr instanceof Error ? materializeErr.message : String(materializeErr)
        }`
      );
    }

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
        evidence,
      });
    } catch (emitErr) {
      logger.warn(
        `[generate_deliverable] mindmap onDeliverable emit failed id=${mindmapId}: ${
          emitErr instanceof Error ? emitErr.message : String(emitErr)
        }`
      );
    }

    logger.info(
      `[generate_deliverable] mindmap skeleton id=${mindmapId} nodes=${graph.nodes.length} title="${title.slice(0, 80)}" evidence=${evidence.confidence}`
    );

    return {
      ok: true,
      kind: 'mindmap',
      format: 'mindmap',
      title,
      generationId: mindmapId,
      draftId: mindmapId,
      evidence,
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

    // naprawa-c1Graph: LLM-generate the structured graph (verb-first steps with
    // decision diamonds + yes/no branches; linked whiteboard blocks; populated
    // table rows) instead of the seedText splitter. Fail-soft to the skeleton.
    const llmGraph: LlmGraph | null =
      preferredSystem === 'process_flow'
        ? await generateProcessFlowGraph(intent, params.title, isPolish)
        : preferredSystem === 'table'
          ? await generateTableGraph(intent, params.title, isPolish)
          : await generateWhiteboardGraph(intent, params.title, isPolish);

    const graph: CanvasSkeletonGraph | LlmGraph =
      llmGraph ??
      (preferredSystem === 'process_flow'
        ? buildProcessFlowSkeleton(intent, params.title, isPolish)
        : preferredSystem === 'table'
          ? buildIdeasTableSkeleton(intent, params.title, isPolish)
          : buildWhiteboardSkeleton(intent, params.title, isPolish));
    const graphSource: 'llm' | 'skeleton' = llmGraph ? 'llm' : 'skeleton';
    logger.info(`[generate_deliverable] ${preferredSystem} graph source=${graphSource}`);

    // HP-16 (8/8) — realny EvidenceContract dla Process Flow, TYLKO to
    // narzędzie (z 8 oficjalnych) — table/whiteboard poza zakresem HP-16.
    // Zero LLM-zgadywania — patrz `buildProcessFlowEvidenceContract`.
    const evidence: EvidenceContract | undefined =
      preferredSystem === 'process_flow'
        ? buildProcessFlowEvidenceContract(graph, {
            source: graphSource,
            seedText: intent || title,
          })
        : undefined;

    // Materialize a REAL my_ideas/my_idea_maps row server-side — identical
    // contract to the mindmap branch above (fail-soft to the old
    // client-generated-id / FE-mount contract on any materialize error).
    let draftId = `chat-${preferredSystem}-${Date.now()}`;
    try {
      const { materializeOrThrow } = await import('../../canvasMaterialize.js');
      const materialized = await materializeOrThrow(
        {
          organizationId: orgId,
          actorUserId: userId,
          target: 'idea',
          title,
          contentMd: intent || title,
          summary: intent || title,
          projectId: null,
          sourceDraftId: conversationId || `chat-${preferredSystem}-${Date.now()}`,
          sourceConversationId: conversationId,
          graph: {
            nodes: graph.nodes,
            edges: graph.edges,
            // HP-16 (8/8) — process_flow evidence rides along in extensions
            // (survives reload via my_idea_maps.extensions_json), mirrors mindmap.
            extensions: evidence
              ? { ...(graph as LlmGraph).extensions, evidence }
              : (graph as LlmGraph).extensions,
          },
          preferredTool: preferredSystem,
          sourceType: 'teresa_chat',
        },
        { writer: 'chat_deliverable' }
      );
      draftId = materialized.id;
      // HP-17 bridge — same as the mindmap branch above, persist the inline
      // EvidenceContract as an EvidenceEnvelope. Only process_flow builds a
      // real contract today (HP-16 8/8 scope) — table/whiteboard get
      // `evidence === undefined`, so there is nothing to persist for those.
      if (evidence) {
        void safePersistEvidenceContract(evidence, {
          organizationId: orgId,
          artifactType: 'canvas',
          artifactId: draftId,
          service: 'canvasGraphLlm.generateProcessFlowGraph',
          createdBy: userId,
        }).catch(() => {});
      }
    } catch (materializeErr) {
      logger.warn(
        `[generate_deliverable] ${preferredSystem} server-side materialize failed, falling back to FE-mount id: ${
          materializeErr instanceof Error ? materializeErr.message : String(materializeErr)
        }`
      );
    }

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
        evidence,
      });
    } catch (emitErr) {
      logger.warn(
        `[generate_deliverable] ${preferredSystem} onDeliverable emit failed id=${draftId}: ${
          emitErr instanceof Error ? emitErr.message : String(emitErr)
        }`
      );
    }

    logger.info(
      `[generate_deliverable] ${preferredSystem} skeleton id=${draftId} nodes=${graph.nodes.length} title="${title.slice(0, 80)}"${
        evidence ? ` evidence=${evidence.confidence}` : ''
      }`
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
      ...(evidence ? { evidence } : {}),
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
      // naprawa-c1Graph: LLM-generate real prose (thesis + sections) for the note
      // body instead of dumping the model's short restatement (which left the note
      // an empty shell). Fail-soft to the raw intent if generation fails.
      const proseBody = await generateNoteContent(intent, params.title, language === 'pl');
      const noteBody = proseBody || intent;
      const noteContentSource: 'llm' | 'intent' = proseBody ? 'llm' : 'intent';
      logger.info(`[generate_deliverable] note content source=${noteContentSource}`);

      const created = await createNote({
        organizationId: orgId,
        userId,
        title,
        body: noteBody,
        source: 'chat',
      });

      // HP-16 domknięcie — realny EvidenceContract dla notatki (wcześniej BRAK,
      // patrz `Harvard/wdrozenie-100/.../PANEL_HP16_REAL.md` pkt 5: commit
      // `2cd4c674b8` twierdził że note ma evidence, ale nie miała — 0 kodu, 0
      // asercji). Zero LLM-zgadywania — patrz `buildNoteEvidenceContract`.
      const evidence = buildNoteEvidenceContract({
        source: noteContentSource,
        seedText: intent || title,
        bodyLength: noteBody.length,
      });
      // HP-17 bridge — fire-and-forget persist do `artifact_evidence`
      // (artifactType='note'), mirror wzorca mindmap/process_flow powyżej.
      void safePersistEvidenceContract(evidence, {
        organizationId: orgId,
        artifactType: 'note',
        artifactId: created.id,
        service: 'canvasGraphLlm.generateNoteContent',
        createdBy: userId,
      }).catch(() => {});

      try {
        context.onDeliverable?.({
          draftId: created.id,
          generationId: created.id,
          kind: 'note',
          format: 'note',
          title: created.title,
          noteId: created.id,
          scorerContent: `${created.title}\n\n${intent || ''}`.trim(),
          evidence,
        });
      } catch (emitErr) {
        logger.warn(
          `[generate_deliverable] note onDeliverable emit failed id=${created.id}: ${
            emitErr instanceof Error ? emitErr.message : String(emitErr)
          }`
        );
      }

      logger.info(
        `[generate_deliverable] note created id=${created.id} title="${title.slice(0, 80)}" evidence=${evidence.confidence}`
      );

      return {
        ok: true,
        kind: 'note',
        format: 'note',
        title: created.title,
        generationId: created.id,
        draftId: created.id,
        evidence,
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
          // Brief z prośby użytkownika (audyt 2026-07-22) — audience='executive'/
          // 'sponsor' zapala register 'executive' w Narrative Engine; wcześniej
          // sztywne 'internal'/'inform' gasiło go zawsze. `deckBrief` zawsze !== null
          // w tej gałęzi (format === 'deck').
          audience: deckBrief?.audience ?? 'internal',
          goal: deckBrief?.goal ?? 'inform',
          theme: 'corporate',
          confidentiality: 'internal',
          sourceArtifacts: [],
          // Temat z prośby → Narrative Engine (user_instruction) w generateDeck,
          // żeby treść slajdów nie była generyczna (audyt 2026-07-22, Deck #2).
          // NIE jest źródłem faktów — anty-fabrykacja odrzuci zmyślone liczby.
          brief: intent,
        }
      : {
          intent,
          title,
          language,
          conversationId,
          // Word tylko — audience trafia do parseSetup→buildIntake→normalizeAudience
          // →prompt. Sheet ignoruje (jego prompt nie używa audience).
          ...(docAudience ? { audience: docAudience } : {}),
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

    // H1.11 (S6.1) — register the deliverable in the M17 Outputs library with a
    // back-reference to its source conversation, SERVER-SIDE at materialization
    // time. Previously M17 registration happened only when the FE called
    // POST /artifacts/register-chat (UnifiedChatPanel) — a split-brain where a
    // non-v8 org, an FE crash, or an API-only client left the deliverable absent
    // from Materiały. This mirrors register-chat's taxonomy exactly and is
    // idempotent per (org, originRuntime, generationId), so the FE call (if it
    // fires) updates the SAME artifact rather than duplicating. Fire-and-forget +
    // fail-soft: registry errors must never break the chat deliverable flow.
    {
      const mapping =
        shortKind === 'deck'
          ? {
              outputType: 'presentation' as const,
              artifactFamily: 'presentation' as const,
              originRuntime: 'presentation' as const,
            }
          : shortKind === 'sheet'
            ? {
                outputType: 'sheet' as const,
                artifactFamily: 'sheet' as const,
                originRuntime: 'sheet' as const,
              }
            : {
                outputType: 'report' as const,
                artifactFamily: 'document' as const,
                originRuntime: 'native_artifact' as const,
              };
      void import('../../v8/artifactRegistryService.js')
        .then(({ registerArtifactOrigin }) =>
          registerArtifactOrigin({
            organizationId: orgId,
            outputType: mapping.outputType,
            artifactFamily: mapping.artifactFamily,
            originRuntime: mapping.originRuntime,
            originRecordId: generationId,
            titleSnapshot: title,
            ownerUserId: userId,
            createdBy: userId,
            originSummary: {
              sourceType: 'chat',
              sourceId: conversationId || null,
              sourceTable: 'conversations',
              kind: shortKind,
              generationId,
              writer: 'generate_deliverable',
            },
          })
        )
        .catch((registerErr: unknown) => {
          logger.warn(
            `[generate_deliverable] M17 origin registration failed (non-blocking) gen=${generationId}: ${
              registerErr instanceof Error ? registerErr.message : String(registerErr)
            }`
          );
        });
    }

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
      `[generate_deliverable] created format=${format} gen=${generationId} title="${title.slice(0, 80)}"` +
        (deckBrief
          ? ` audience=${deckBrief.audience}(${deckBrief.audienceSource}) goal=${deckBrief.goal}(${deckBrief.goalSource})`
          : '')
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

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

import { hasPresentationCapability } from '../../presentationAccessPolicyService.js';
import {
  plan as planGeneration,
  start as startGeneration,
} from '../../deliverables/deliverablesGenerationService.js';
import type { DeliverableFormat } from '../../../types/deliverablesGeneration.js';
import { featureFlags } from '../../../config/FeatureFlags.js';
import logger from '../../../utils/Logger.js';
import {
  buildMindmapSkeleton,
  type MindmapSkeletonGraph,
} from '../mindmapSkeleton.js';

type DeliverableKind = 'document' | 'sheet' | 'presentation' | 'mindmap';

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
  kind: 'doc' | 'sheet' | 'deck' | 'mindmap';
  format: DeliverableFormat;
  title: string;
  /**
   * Only present for `kind:'mindmap'` — the pre-built skeleton graph the FE
   * seeds into the Ideas mind-map workspace. Absent for doc/sheet/deck (those
   * hydrate their content from the DB-bound generation runtime via draftId).
   */
  graph?: MindmapSkeletonGraph;
  /** Only present for `kind:'mindmap'` — the topic seed text for AI expansion. */
  seedText?: string;
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
};

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
      message: `Nieznany typ artefaktu '${String(kind)}' — dozwolone: document, sheet, presentation, mindmap.`,
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

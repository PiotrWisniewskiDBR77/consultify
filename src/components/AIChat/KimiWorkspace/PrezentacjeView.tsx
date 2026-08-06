/**
 * PrezentacjeView — Gamma-style presentation generation workspace (P20-B).
 *
 * Split-screen: chat left ↔ deck preview right.
 * Wired to the real V8 artifact run pipeline via useKimiArtifactPipeline.
 * Auto-triggers pipeline when user sends first message in chat.
 *
 * SSOT: FINAL_IMPLEMENTATION_PLAN_20_PREZENTACJE_2026-03-29.md
 */

import { Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { BlankCreationState } from '@/components/shared/BlankCreationState';
import { TriModeChooser } from '@/components/shared/TriModeChooser';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { deriveDeckLifecycleBadge } from '@/utils/deckLifecycleBadge';
import { isMelsPrezentacjeEnabled } from '@/utils/melsPrezentacjeFlag';
import { isTriModeEnabled } from '@/utils/triModeFlag';

import { ArtifactModuleHome } from './ArtifactModuleHome';
import type { ArtifactPreview } from './KimiWorkspaceShell';
import { KimiWorkspaceShell } from './KimiWorkspaceShell';
import { PrezentacjeMelsView } from './prezentacjeShell/PrezentacjeMelsView';
import { useKimiArtifactPipeline } from './useKimiArtifactPipeline';

const PREZENTACJE_SYSTEM_PROMPT = `You are a professional presentation creation assistant in Consultify — think Gamma.app meets Beautiful.ai.
Your role is to help users create high-quality slide decks: strategy presentations, project updates, executive briefings, pitch decks, and workshop materials.

When the user describes a presentation they want:
1. Understand the requirements (topic, audience, slide count, style, key messages)
2. Create a structured outline with slide intents (cover, executive summary, key messages, insights, roadmap, etc.)
3. Generate the deck content slide by slide with clear structure
4. Provide a summary with key metrics (slide count, sections, estimated duration)

Always be transparent about each step. Show your work process clearly.
Structure each slide with: title, key points/bullets, speaker notes suggestion, and recommended layout intent.`;

function parseDeckSlides(deckData: any): {
  slides: Array<{ slideId: string; intent: string; title: string; bulletPoints?: string[] }>;
  status: string;
} {
  const mapCardsToSlides = (cards: any[]) =>
    cards.map((card: any, index: number) => {
      const blocks = Array.isArray(card?.blocks) ? card.blocks : [];
      const bulletPoints = blocks
        .map((block: any) => {
          if (typeof block?.content === 'string') return block.content;
          if (typeof block?.content?.text === 'string') return block.content.text;
          if (Array.isArray(block?.content?.items)) return block.content.items.join(' ');
          return '';
        })
        .map((value: string) => value.trim())
        .filter(Boolean)
        .slice(0, 4);
      return {
        slideId: card?.card_id || card?.id || String(index + 1),
        intent: card?.intent || 'content',
        title: card?.title || card?.key_message || `Slide ${index + 1}`,
        bulletPoints,
      };
    });

  const unifiedJson =
    typeof deckData?.deck_json === 'string'
      ? JSON.parse(deckData.deck_json)
      : deckData?.deck_json || deckData?.unified_json;
  const rawSlides =
    unifiedJson?.slides ||
    (Array.isArray(unifiedJson?.cards) && unifiedJson.cards.length > 0
      ? mapCardsToSlides(unifiedJson.cards)
      : null) ||
    (Array.isArray(deckData?.outline_json)
      ? deckData.outline_json.map((item: any, index: number) => ({
          id: item?.slideId || String(index + 1),
          intent: item?.intent || 'content',
          title: item?.title || `Slide ${index + 1}`,
          blocks: item?.keyMessage ? [{ type: 'text', text: item.keyMessage }] : [],
        }))
      : []);
  const slides: Array<{ slideId: string; intent: string; title: string; bulletPoints?: string[] }> =
    [];
  for (const s of rawSlides) {
    const blocks = s.blocks || s.content_blocks || [];
    const bulletPoints = blocks
      .filter((b: any) => b.type === 'bullet_list' || b.type === 'text')
      .flatMap((b: any) => (Array.isArray(b.items) ? b.items : [b.text || b.content]))
      .filter(Boolean)
      .slice(0, 4);
    slides.push({
      slideId: s.slide_id || s.id || String(slides.length),
      intent: s.intent || s.layout || 'content',
      title: s.title || s.heading || `Slide ${slides.length + 1}`,
      bulletPoints,
    });
  }
  const status = deckData?.status || 'draft';
  return { slides, status };
}

function unwrapApiData<T = unknown>(response: unknown): T {
  const data = (response as { data?: unknown } | null)?.data;
  if (data && typeof data === 'object' && 'data' in data) return data.data as T;
  return data as T;
}

async function resolvePresentationDeckId(id: string): Promise<string> {
  try {
    await Api.get(`/presentations/decks/${id}`);
    return id;
  } catch (error: unknown) {
    if ((error as { status?: number })?.status !== 404) throw error;
  }

  const actionTarget = unwrapApiData<{ originRuntime?: string; originRecordId?: string }>(
    await Api.get(`/artifacts/${id}/action-target`)
  );
  const originRuntime = String(actionTarget?.originRuntime || '');
  const originRecordId = String(actionTarget?.originRecordId || '').trim();
  if (originRuntime === 'presentation' && originRecordId) return originRecordId;
  throw new Error('Presentation deck not found');
}

type PresentationDeckResponse = Record<string, unknown> & {
  title?: string;
};

async function loadPresentationDeck(
  id: string
): Promise<{ deckId: string; deckData: PresentationDeckResponse }> {
  const deckId = await resolvePresentationDeckId(id);
  const deckData = unwrapApiData<PresentationDeckResponse>(
    await Api.get(`/presentations/decks/${deckId}`)
  );
  return { deckId, deckData };
}

export const PrezentacjeView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pipeline = useKimiArtifactPipeline('prezentacje');
  const activeMessages = useConversationStore((s) => s.activeMessages);
  // AGT/kickoff fix (fala 1c, 2026-07-27) — see the kickoff effect below.
  const chatKickoffMessage = useAppStore((s) => s.chatKickoffMessage);
  const clearChatKickoffMessage = useAppStore((s) => s.clearChatKickoffMessage);
  const [searchParams] = useSearchParams();
  const artifactId = searchParams.get('artifactId');
  const templateArtifactId = searchParams.get('templateArtifactId');
  const templatePrompt = searchParams.get('templatePrompt');
  const viewParam = searchParams.get('view');
  // Materiały wspólny launcher (2026-07-24) — `?entry=blank|ai` sygnalizuje
  // tryb wybrany w KROK 2 tablicy Materiałów, żeby wejście z Materiałów lądowało
  // od razu w tym trybie zamiast ponownie pytać o wybór na tym ekranie.
  const entryParam = searchParams.get('entry');
  // Kickoff fix: a pending cross-module message must not flash the "home"
  // gate before the effect below has a chance to start the pipeline — same
  // reasoning as `!templatePrompt` right below.
  const hasPendingKickoff = Boolean(chatKickoffMessage && chatKickoffMessage.trim());

  // Eksport raportu Execution → prezentacja (2026-07-27): „Export as presentation"
  // (ReportCompactPanel.tsx / ReportDocumentView.tsx) nawiguje tu z
  // `?sourceType=execution_report&sourceName=…&content=…` (markdown raportu).
  // Te parametry nie były dotąd nigdzie czytane — ekran otwierał goły hub,
  // a treść raportu ginęła. Konsumpcja = ścieżka „Z AI" z prefil-em treści
  // (ten sam mechanizm co `templatePrompt` niżej).
  const sourceTypeParam = searchParams.get('sourceType');
  const sourceNameParam = searchParams.get('sourceName');
  const sourceContentParam = searchParams.get('content');

  const sourcePrompt = useMemo((): string | null => {
    if (sourceTypeParam !== 'execution_report' || !sourceContentParam?.trim()) return null;
    const title = sourceNameParam?.trim();
    return [
      'Create a slide deck presentation from the following execution report.',
      ...(title ? [`Report title: ${title}`] : []),
      'Map the report sections to slides, preserve key metrics and RAG statuses, and write the slides in the same language as the report content.',
      '',
      '--- REPORT CONTENT (markdown) ---',
      sourceContentParam.trim(),
    ].join('\n');
  }, [sourceTypeParam, sourceNameParam, sourceContentParam]);

  const showHome =
    !artifactId &&
    !templateArtifactId &&
    !templatePrompt &&
    !hasPendingKickoff &&
    !sourcePrompt &&
    viewParam !== 'new' &&
    !pipeline.currentRun &&
    !pipeline.isGenerating;

  const advanceRef = useRef(pipeline.advancePipeline);
  advanceRef.current = pipeline.advancePipeline;
  const autoTriggered = useRef(false);
  const startRef = useRef(pipeline.startGeneration);
  startRef.current = pipeline.startGeneration;

  const [reopenPreview, setReopenPreview] = useState<ArtifactPreview | null>(null);
  const [reopenDeckId, setReopenDeckId] = useState<string | null>(null);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const reopenLoaded = useRef(false);

  // D2 (roboty tri-tryby): jawny wybór 3 trybów na wejściu `?view=new`, tylko za
  // flagą `ff_tri_tryby`. OFF → `triMode` false → widok renderuje się bajt-
  // identycznie (od razu czat/pipeline AI). 'choose' = ekran wyboru; 'ai' =
  // przejście do dotychczasowego czatu (pipeline AI).
  const triMode = isTriModeEnabled();
  // 'blank' = auto-tworzenie pustego decku (wejście z Materiałów, `?entry=blank`
  // + `?view=new` — patrz efekt niżej i _MATERIALY_INWENTARYZACJA_2026-07-24.md §8).
  const [entryMode, setEntryMode] = useState<'choose' | 'ai' | 'blank'>(
    entryParam === 'ai' ? 'ai' : entryParam === 'blank' ? 'blank' : 'choose'
  );
  const [creatingBlank, setCreatingBlank] = useState(false);
  // 2026-07-28 fix (żywy odbiór — identyczna klasa błędu jak w ExceleView):
  // failure in `handleCreateEmptyDeck` used to fire only a toast (gone in a
  // few seconds) with `entryMode` stuck at 'blank' forever — no permanent
  // affordance to retry or leave. Success is fine here (`openInDeckBuilder`
  // navigates to a DIFFERENT route, `/presentations/builder/:id`, which
  // unmounts this view), but failure needed the same fix as Excele.
  const [blankCreateFailed, setBlankCreateFailed] = useState(false);

  // Auto-trigger from builtin template prompt
  const promptTriggered = useRef(false);
  useEffect(() => {
    if (!templatePrompt || promptTriggered.current || pipeline.currentRun || pipeline.isGenerating)
      return;
    promptTriggered.current = true;
    autoTriggered.current = true;
    void startRef.current(templatePrompt);
  }, [templatePrompt, pipeline.currentRun, pipeline.isGenerating]);

  // Kickoff fix (fala 1c, 2026-07-27): cross-module flows (Notebook/Task/
  // Decision/Help "ask Teresa about X") call `setChatKickoffMessage` + navigate
  // expecting the ONE Teresa panel to open with a seeded first message. That
  // works on ordinary views (MainLayout wires `kickoffMessage` into the split
  // `UnifiedChatPanel`), but on `/prezentacje` `hasEmbeddedModuleChat` turns
  // the global panel off entirely, and this Studio has no embedded chat of its
  // own ("Teresa is the single chat surface" — KimiWorkspaceShell) — the
  // message was silently dropped, the pipeline never started. Consume it the
  // same way as `templatePrompt` above (the pipeline's `startGeneration` IS
  // the "send first message" channel for this lane — there is no separate
  // chat-input component to seed), then clear the store so it can't re-fire on
  // a later visit or leak into another module.
  const kickoffTriggered = useRef(false);
  useEffect(() => {
    const message = (chatKickoffMessage || '').trim();
    if (
      !message ||
      kickoffTriggered.current ||
      artifactId ||
      templateArtifactId ||
      templatePrompt ||
      // Scalenie 2026-07-28 (tor MVP): eksport raportu Execution ma własny
      // auto-start niżej. Bez tego wykluczenia oba efekty mogłyby wystartować
      // pipeline w tym samym renderze (`isGenerating` ustawia się dopiero
      // asynchronicznie) — ta sama logika, dla której wykluczony jest
      // `templatePrompt`.
      sourcePrompt ||
      pipeline.currentRun ||
      pipeline.isGenerating
    )
      return;
    kickoffTriggered.current = true;
    autoTriggered.current = true;
    void startRef.current(message);
    clearChatKickoffMessage();
  }, [
    chatKickoffMessage,
    artifactId,
    templateArtifactId,
    templatePrompt,
    sourcePrompt,
    pipeline.currentRun,
    pipeline.isGenerating,
    clearChatKickoffMessage,
  ]);

  // Auto-trigger z eksportu raportu Execution (`?sourceType=execution_report`).
  // Ref guard: fire-once, jak `promptTriggered` wyżej.
  const sourceTriggered = useRef(false);
  useEffect(() => {
    if (!sourcePrompt || sourceTriggered.current || pipeline.currentRun || pipeline.isGenerating)
      return;
    sourceTriggered.current = true;
    autoTriggered.current = true;
    void startRef.current(sourcePrompt);
  }, [sourcePrompt, pipeline.currentRun, pipeline.isGenerating]);

  // R11 deck slice (2026-07-26) — "Użyj wzorca" z Biblioteki dla PREZENTACJI.
  // ★ Był tu najważniejszy bug funkcjonalny programu Materiały: ten efekt
  // czytał `originSummary.template.description` (sam OPIS TEKSTOWY) i wołał
  // `startGeneration(desc, templateArtifactId)` — struktura szablonu
  // (`outline_json`) nigdy nie docierała do generacji, bo `templateArtifactId`
  // ginął w `POST /api/artifact-runs/from-chat` (brak go w Zod-schemacie i w
  // `createArtifactRunFromChat`). Naprawa PONIŻEJ (po deklaracji
  // `openInDeckBuilder`) pomija pipeline AI dla tej ścieżki całkowicie —
  // `POST /presentations/decks/from-template` kopiuje `outline_json` do kart
  // deterministycznie, po stronie serwera, z serwerowo zwalidowanym
  // `templateArtifactId` (patrz `resolvePresentationTemplateForCreation`).
  const templateTriggered = useRef(false);
  const [templateCreateState, setTemplateCreateState] = useState<'idle' | 'loading' | 'error'>(
    'idle'
  );
  const [templateCreateErrorCode, setTemplateCreateErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (!artifactId || reopenLoaded.current) return;
    reopenLoaded.current = true;

    loadPresentationDeck(artifactId)
      .then(async ({ deckId, deckData: row }) => {
        const { slides, status } = parseDeckSlides(row);
        if (slides.length === 0) throw new Error('presentation_content_missing');
        const title = row.title || t('prezentacje.defaultTitle', 'Presentation');

        let statusLabel = deriveDeckLifecycleBadge(null, null);
        try {
          const originRes = (await Api.get(`/artifacts/origin/presentation/${deckId}`)) as any;
          const artId = originRes?.data?.artifactId || originRes?.artifactId;
          if (artId) {
            const trustRes = (await Api.get(`/artifacts/${artId}/trust-state`)) as any;
            const trust = trustRes?.data || trustRes;
            statusLabel = deriveDeckLifecycleBadge(trust?.publishState, trust?.exportHistory);
          }
        } catch {
          statusLabel = deriveDeckLifecycleBadge(
            status === 'reviewed' ? 'reviewed' : null,
            status === 'ready' || status === 'exported' ? [{ status: 'completed' }] : null
          );
        }

        setReopenDeckId(deckId);
        setReopenError(null);
        setReopenPreview({
          type: 'deck',
          title,
          fileName: `${title.replace(/\s+/g, '_')}.pptx`,
          summary: t('prezentacje.reopenSummary', {
            title,
            count: slides.length,
            defaultValue: `Presentation "${title}" — ${slides.length} slides.`,
          }),
          kpiItems: [
            { label: t('prezentacje.kpi.slides', 'Slides'), value: String(slides.length) },
            { label: t('prezentacje.kpi.status', 'Status'), value: statusLabel },
            { label: t('prezentacje.kpi.format', 'Format'), value: 'PPTX / PDF' },
          ],
          deckId,
          deckSlides: slides,
        });
      })
      .catch(() => {
        // Fail closed: a missing/corrupt deck is not a valid empty deck. Keep
        // every builder/export target unset and render a blocking state below.
        setReopenDeckId(null);
        setReopenPreview(null);
        setReopenError(
          t(
            'prezentacje.reopenFailedBlocking',
            'Nie udało się otworzyć prezentacji. Jej treść jest niedostępna lub uszkodzona.'
          )
        );
      });
  }, [artifactId, t]);

  useEffect(() => {
    if (!pipeline.isGenerating || pipeline.isBusy) return undefined;
    const timer = setInterval(() => {
      void advanceRef.current();
    }, 3000);
    return () => clearInterval(timer);
  }, [pipeline.isGenerating, pipeline.isBusy]);

  useEffect(() => {
    if (
      autoTriggered.current ||
      templatePrompt ||
      sourcePrompt ||
      templateArtifactId ||
      artifactId ||
      viewParam === 'new' ||
      pipeline.currentRun ||
      pipeline.isGenerating ||
      reopenDeckId
    )
      return;
    const userMessages = activeMessages.filter((m) => m.role === 'user');
    const aiMessages = activeMessages.filter((m) => m.role === 'ai');
    if (userMessages.length >= 1 && aiMessages.length >= 1) {
      const lastUserMsg = userMessages[userMessages.length - 1]?.content;
      if (lastUserMsg && lastUserMsg.trim().length > 5) {
        autoTriggered.current = true;
        void startRef.current(lastUserMsg.trim());
      }
    }
  }, [
    activeMessages,
    artifactId,
    templateArtifactId,
    templatePrompt,
    sourcePrompt,
    viewParam,
    pipeline.currentRun,
    pipeline.isGenerating,
    reopenDeckId,
  ]);

  // Single source of truth for "Open in Deck Builder" navigation.
  // Same-tab navigation via React Router avoids the silent popup-blocker
  // failure mode that QA hit in `2026-05-08_1853_presentations-p2-alignment-retest`
  // (button looked frozen because window.open was blocked / opened a tab the
  // tester never focused). Toast + structured console log give the operator
  // an immediate, observable signal that the click registered.
  const openInDeckBuilder = useCallback(
    (deckId: string | null | undefined) => {
      if (!deckId) {
        toast.error(
          t(
            'prezentacje.builderUnreachable',
            'Deck identifier is missing — cannot open Deck Builder yet.'
          )
        );
        // Deliberate observability log so operators / QA see the click
        // registered even when the navigation cannot proceed. Required
        // by the BLOCKED_P1 follow-up (`2026-05-08_1853_…`).
        // eslint-disable-next-line no-console
        console.warn('[Prezentacje] openInDeckBuilder called without deckId');
        return;
      }
      const route = `/presentations/builder/${deckId}`;
      // Deliberate observability log so operators / QA can confirm in
      // DevTools that the button click reached the navigation handler.
      // eslint-disable-next-line no-console
      console.info('[Prezentacje] Open in Deck Builder', { deckId, route });
      toast.success(t('prezentacje.openingBuilder', 'Opening Deck Builder...'));
      navigate(route);
    },
    [navigate, t]
  );

  // R11 deck slice — deterministyczne tworzenie decka z szablonu Biblioteki.
  // `templateArtifactId` (id WIERSZA INDEKSU) jest jedynym wskaźnikiem, jaki
  // klient wysyła — serwer sam rozwiązuje i rewaliduje kanoniczny rekord
  // `presentation_templates` (org/scope/status/orphan) w
  // `POST /presentations/decks/from-template`, świeżo, bez zaufania do
  // czegokolwiek z URL-a. Brak AI: struktura szablonu jest już znana, więc
  // (jak przy trybie „Czysto") nowy deck ląduje wprost w Deck Builderze.
  useEffect(() => {
    if (
      !templateArtifactId ||
      templateTriggered.current ||
      pipeline.currentRun ||
      pipeline.isGenerating
    )
      return;
    templateTriggered.current = true;
    autoTriggered.current = true;
    setTemplateCreateState('loading');
    setTemplateCreateErrorCode(null);
    void (async () => {
      try {
        const res = await Api.post('/presentations/decks/from-template', { templateArtifactId });
        const deckId = unwrapApiData<{ id?: string }>(res)?.id;
        if (!deckId) throw new Error('missing deckId in from-template response');
        setTemplateCreateState('idle');
        openInDeckBuilder(deckId);
      } catch (err: any) {
        // ★ Żaden fallback do promptu AI ani do pickera — wzorzec, którego nie
        // da się rozwiązać, musi zatrzymać przepływ z uczciwym komunikatem
        // (wzorowane na DocumentStudioView.tsx templateResolveMessage).
        const code =
          typeof err?.data?.error === 'string' ? err.data.error : 'TEMPLATE_RESOLVE_FAILED';
        setTemplateCreateErrorCode(code);
        setTemplateCreateState('error');
      }
    })();
  }, [templateArtifactId, pipeline.currentRun, pipeline.isGenerating, openInDeckBuilder]);

  // Uczciwy komunikat po polsku per kod odrzucenia — patrz
  // DocumentStudioView.tsx `templateResolveMessage` (ten sam wzorzec).
  const templateCreateMessage = useMemo((): string | null => {
    if (templateCreateState !== 'error') return null;
    switch (templateCreateErrorCode) {
      case 'TEMPLATE_ORPHANED':
        return t('prezentacje.templateOrphaned', {
          defaultValue:
            'Ten wzorzec nie ma już kanonicznego rekordu — nie ma z czego generować. Wybierz inny wzorzec w Bibliotece.',
        });
      case 'TEMPLATE_NOT_INDEXED':
        return t('prezentacje.templateNotIndexed', {
          defaultValue: 'Tego wzorca nie ma w Twoim indeksie Biblioteki. Wybierz inny wzorzec.',
        });
      case 'TEMPLATE_FORBIDDEN':
        return t('prezentacje.templateForbidden', {
          defaultValue: 'Nie masz dostępu do tego wzorca.',
        });
      case 'TEMPLATE_DEPRECATED':
        return t('prezentacje.templateDeprecated', {
          defaultValue:
            'Ten wzorzec został wycofany i nie może już sterować generacją. Wybierz aktualny wzorzec.',
        });
      case 'TEMPLATE_FORMAT_UNSUPPORTED':
        return t('prezentacje.templateFormatUnsupported', {
          defaultValue: 'Ten wzorzec nie tworzy prezentacji.',
        });
      default:
        return t('prezentacje.templateResolveFailed', {
          defaultValue: 'Nie udało się rozwiązać wzorca. Spróbuj ponownie.',
        });
    }
  }, [templateCreateState, templateCreateErrorCode, t]);

  // D2 tryb ①CZYSTO — pusty deck (1 slajd tytułowy) utworzony BEZ pipeline'u AI
  // przez istniejący `POST /api/presentations/decks` (create-from-structured-JSON),
  // po czym od razu otwarty w Deck Builderze. Zero kroków generacji AI.
  const handleCreateEmptyDeck = useCallback(async (): Promise<void> => {
    if (creatingBlank) return;
    setCreatingBlank(true);
    setBlankCreateFailed(false);
    try {
      const title = t('prezentacje.blank.title', 'Nowa prezentacja');
      const res = await Api.post('/presentations/decks', {
        title,
        theme: 'modern',
        source: 'blank_manual',
        slides: [
          {
            type: 'cover',
            content: {
              title,
              intent: 'cover',
              blocks: [{ type: 'heading', content: title }],
            },
          },
        ],
      });
      const deckId = unwrapApiData<{ id?: string }>(res)?.id;
      if (deckId) {
        openInDeckBuilder(deckId);
      } else {
        toast.error(t('prezentacje.blankFailed', 'Nie udało się utworzyć pustej prezentacji.'));
        setBlankCreateFailed(true);
      }
    } catch {
      // `Api.post` already carries a hard 20s transport timeout (see
      // ExceleView's equivalent comment) — this catch is deterministic, not a
      // hang. The bug was that nothing downstream gave the failure a
      // permanent, visible state; see `blankCreateFailed` above.
      toast.error(t('prezentacje.blankFailed', 'Nie udało się utworzyć pustej prezentacji.'));
      setBlankCreateFailed(true);
    } finally {
      setCreatingBlank(false);
    }
  }, [creatingBlank, openInDeckBuilder, t]);

  // Materiały wspólny launcher — `?entry=blank`: materializuj pusty deck
  // automatycznie, bez wymagania drugiego kliknięcia „Czysto" na tym ekranie.
  // Ref guard: fire-once (StrictMode double-invoke / re-renders bezpieczne).
  const blankAutoTriggered = useRef(false);
  useEffect(() => {
    if (entryMode !== 'blank' || blankAutoTriggered.current) return;
    blankAutoTriggered.current = true;
    void handleCreateEmptyDeck();
  }, [entryMode, handleCreateEmptyDeck]);

  // Post-generation chat intent routing (P20 audit §1.1)
  const lastRoutedMsgRef = useRef<string | null>(null);
  useEffect(() => {
    const deckTarget = pipeline.currentRun?.materializationOrigin?.originRecordId || reopenDeckId;
    if (!deckTarget || !pipeline.isCompleted) return;
    const userMessages = activeMessages.filter((m) => m.role === 'user');
    const lastMsg = userMessages[userMessages.length - 1];
    if (!lastMsg || lastMsg.id === lastRoutedMsgRef.current) return;
    if (userMessages.length <= 1) return;

    const text = lastMsg.content.trim().toLowerCase();
    lastRoutedMsgRef.current = lastMsg.id;

    const intentHandlers: Array<{ match: RegExp; handler: () => Promise<void> }> = [
      {
        match: /export\s*pdf|pobierz\s*pdf|download\s*pdf/,
        handler: async () => {
          window.open(`/api/presentations/decks/${deckTarget}/export/pdf`, '_blank');
          toast.success(t('prezentacje.intentRouted.exportPdf', 'PDF export started'));
        },
      },
      {
        match: /export\s*pptx|download\s*pptx|pobierz\s*pptx/,
        handler: async () => {
          window.open(`/api/presentations/decks/${deckTarget}/download`, '_blank');
          toast.success(t('prezentacje.intentRouted.exportPptx', 'PPTX download started'));
        },
      },
      {
        match: /add\s*summ|dodaj\s*podsum|executive\s*summ/,
        handler: async () => {
          await Api.post(`/presentations/decks/${deckTarget}/agent-edit`, {
            prompt: 'add executive summary slide',
          });
          toast.success(t('prezentacje.intentRouted.agentEdit', 'Agent edit applied'));
        },
      },
      {
        match: /make.*concise|skróć|shorten/,
        handler: async () => {
          await Api.post(`/presentations/decks/${deckTarget}/agent-edit`, {
            prompt: 'make the deck concise',
          });
          toast.success(t('prezentacje.intentRouted.agentEdit', 'Agent edit applied'));
        },
      },
      {
        match: /add\s*note|dodaj\s*notat|speaker\s*note/,
        handler: async () => {
          await Api.post(`/presentations/decks/${deckTarget}/agent-edit`, {
            prompt: 'add speaker notes to all slides',
          });
          toast.success(t('prezentacje.intentRouted.agentEdit', 'Agent edit applied'));
        },
      },
      {
        match: /change\s*theme|zmień\s*motyw|styl/,
        handler: async () => {
          openInDeckBuilder(deckTarget);
          toast.success(
            t('prezentacje.intentRouted.openBuilder', 'Opening Deck Builder for theme changes')
          );
        },
      },
      {
        match: /open\s*builder|edytuj|otwórz\s*builder/,
        handler: async () => {
          openInDeckBuilder(deckTarget);
        },
      },
    ];

    for (const { match, handler } of intentHandlers) {
      if (match.test(text)) {
        handler().catch(() => {
          toast.error(t('prezentacje.intentRouted.failed', 'Could not process that instruction'));
        });
        return;
      }
    }
  }, [
    activeMessages,
    pipeline.isCompleted,
    pipeline.currentRun,
    reopenDeckId,
    t,
    openInDeckBuilder,
  ]);

  const effectivePreview = pipeline.preview || reopenPreview;
  const effectiveDeckId =
    pipeline.currentRun?.materializationOrigin?.originRecordId || reopenDeckId;
  const effectiveCompleted = pipeline.isCompleted || (!!reopenPreview && !pipeline.currentRun);

  const ensureExportAllowed = useCallback(
    async (deckId: string): Promise<boolean> => {
      try {
        const qualityRes = await Api.post(`/presentations/decks/${deckId}/quality-gates`, {});
        const quality = unwrapApiData<{
          canExport?: boolean;
          gates?: Array<{ gateType?: string }>;
        }>(qualityRes);
        if (quality?.canExport === false) {
          const gateTypes = Array.from(
            new Set(
              (quality.gates || [])
                .map((gate) => String(gate?.gateType || '').trim())
                .filter(Boolean)
            )
          );
          toast.error(
            gateTypes.length > 0
              ? t(
                  'prezentacje.qualityGateBlockedDetailed',
                  `Export blocked by Quality Gate: ${gateTypes.join(', ')}`
                )
              : t('prezentacje.qualityGateBlocked', 'Export blocked by Quality Gate')
          );
          return false;
        }
      } catch {
        // Non-blocking: if quality check endpoint is unavailable, keep legacy export path.
      }
      return true;
    },
    [t]
  );

  const handlePreviewFile = useCallback(() => {
    openInDeckBuilder(effectiveDeckId);
  }, [effectiveDeckId, openInDeckBuilder]);

  const handleAllFiles = useCallback(() => {
    navigate('/prezentacje');
  }, [navigate]);

  const handleDownload = useCallback(async () => {
    if (effectiveDeckId) {
      const allowed = await ensureExportAllowed(effectiveDeckId);
      if (!allowed) return;
      window.open(`/api/presentations/decks/${effectiveDeckId}/download`, '_blank');
      return;
    }
    await pipeline.handleDownload();
  }, [effectiveDeckId, ensureExportAllowed, pipeline]);

  const handleDownloadPdf = useCallback(() => {
    if (!effectiveDeckId) return;
    void ensureExportAllowed(effectiveDeckId).then((allowed) => {
      if (!allowed) return;
      window.open(`/api/presentations/decks/${effectiveDeckId}/export/pdf`, '_blank');
    });
  }, [effectiveDeckId, ensureExportAllowed]);

  if (showHome) {
    return <ArtifactModuleHome lane="prezentacje" />;
  }

  // Materiały wspólny launcher — `?entry=blank`: pokaż lekki loading zamiast
  // brama-wyboru/czatu, dopóki handleCreateEmptyDeck (efekt wyżej) nie
  // przełączy nawigacji do Deck Buildera z realną, pustą prezentacją.
  //
  // 2026-07-28 fix: on success `openInDeckBuilder` navigates to a DIFFERENT
  // route (unmounts this view), so `entryMode` staying 'blank' never bit
  // there — but on FAILURE it used to leave only a toast (gone in seconds)
  // with this spinner stuck here forever. `blankCreateFailed` gives that
  // failure a permanent, actionable state instead.
  if (entryMode === 'blank') {
    return (
      <BlankCreationState
        status={blankCreateFailed ? 'failed' : 'creating'}
        creatingLabel={t('prezentacje.blank.creating', 'Tworzenie pustej prezentacji…')}
        failedMessage={t(
          'prezentacje.blankFailedPermanent',
          'Nie udało się utworzyć pustej prezentacji. Spróbuj ponownie albo wróć do Materiałów.'
        )}
        onRetry={() => void handleCreateEmptyDeck()}
        retryLabel={t('prezentacje.blank.retry', 'Spróbuj ponownie')}
        onBack={() => navigate('/presentations?tab=presentations')}
        backLabel={t('documentStudio.view.backToMaterials', 'Wróć do Materiałów')}
        testId="prezentacje-blank"
      />
    );
  }

  // R11 deck slice — "Użyj wzorca": stan ładowania podczas materializacji
  // decka z szablonu (`POST /presentations/decks/from-template`). Sukces
  // nawiguje od razu do Deck Buildera (patrz efekt wyżej) — ten branch nigdy
  // nie zostaje wyrenderowany po sukcesie.
  if (templateArtifactId && templateCreateState !== 'error') {
    return (
      <div className="flex h-full flex-1 items-center justify-center gap-2 text-c-text-secondary">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">
          {t('prezentacje.template.creating', 'Tworzenie prezentacji z szablonu…')}
        </span>
      </div>
    );
  }

  // R11 deck slice — stan BLOKUJĄCY dla wzorca, którego nie da się rozwiązać
  // (orphaned/forbidden/deprecated/not_indexed/unsupported). ★ Zero cichego
  // fallbacku do promptu AI ani do pickera — użytkownik musi wrócić do
  // Biblioteki i wybrać inny wzorzec.
  if (templateArtifactId && templateCreateState === 'error') {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-md text-sm text-c-text-secondary">{templateCreateMessage}</p>
        <button
          type="button"
          onClick={handleAllFiles}
          className="rounded-md border border-c-border px-3 py-1.5 text-sm text-c-text-primary hover:bg-c-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {t('prezentacje.template.backToLibrary', 'Wróć do Biblioteki')}
        </button>
      </div>
    );
  }

  if (artifactId && reopenError) {
    return (
      <div
        data-testid="prezentacje-reopen-error"
        role="alert"
        className="flex h-full flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <p className="max-w-md text-sm text-c-text-secondary">{reopenError}</p>
        <button
          type="button"
          onClick={handleAllFiles}
          className="rounded-md border border-c-border px-3 py-1.5 text-sm text-c-text-primary hover:bg-c-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {t('prezentacje.reopenBackToLibrary', 'Wróć do prezentacji')}
        </button>
      </div>
    );
  }

  // D2 tri-tryby: brama wyboru na wejściu „Start new" (`?view=new`). Poprzedza
  // czat/pipeline; OFF (triMode false) → warunek fałszywy → od razu czat jak dziś.
  const showTriChooser =
    triMode &&
    entryMode === 'choose' &&
    viewParam === 'new' &&
    !artifactId &&
    !templateArtifactId &&
    !templatePrompt &&
    !sourcePrompt &&
    !pipeline.currentRun &&
    !pipeline.isGenerating &&
    !reopenPreview;

  if (showTriChooser) {
    return (
      <TriModeChooser
        busy={creatingBlank}
        showTemplate
        heading={t('prezentacje.tri.heading', 'Jak chcesz zacząć prezentację?')}
        subheading={t(
          'prezentacje.tri.subheading',
          'Wybierz tryb — wszystkie trzy są równorzędne.'
        )}
        clean={{
          title: t('prezentacje.tri.cleanTitle', 'Czysto'),
          desc: t(
            'prezentacje.tri.cleanDesc',
            'Pusty deck (1 slajd) w Deck Builderze. Budujesz sam, bez AI.'
          ),
        }}
        ai={{
          title: t('prezentacje.tri.aiTitle', 'Z AI'),
          desc: t('prezentacje.tri.aiDesc', 'Opisz deck — AI zbuduje slajdy i treść.'),
        }}
        template={{
          title: t('prezentacje.tri.templateTitle', 'Z szablonu'),
          desc: t('prezentacje.tri.templateDesc', 'Zacznij od gotowego szablonu prezentacji.'),
        }}
        onClean={handleCreateEmptyDeck}
        onAi={() => setEntryMode('ai')}
        onTemplate={() => navigate('/prezentacje')}
      />
    );
  }

  if (isMelsPrezentacjeEnabled()) {
    const deckPreview =
      effectivePreview && effectivePreview.type === 'deck'
        ? (effectivePreview as ArtifactPreview & { type: 'deck' })
        : null;
    return (
      <PrezentacjeMelsView
        preview={deckPreview}
        topBarHandlers={{
          onShare: handleAllFiles,
          onExportPdf: effectiveDeckId ? handleDownloadPdf : undefined,
          onRun: handleDownload,
        }}
        onOpenBuilder={handlePreviewFile}
        onRunPrimary={handleDownload}
      />
    );
  }

  return (
    <KimiWorkspaceShell
      lane="prezentacje"
      taskSteps={pipeline.taskSteps}
      totalSteps={pipeline.totalSteps}
      completedSteps={pipeline.completedSteps}
      isGenerating={pipeline.isGenerating}
      isCompleted={effectiveCompleted}
      isFailed={pipeline.isFailed}
      failureReason={pipeline.failureReason}
      preview={effectivePreview}
      onReplay={pipeline.handleReplay}
      onRemix={pipeline.handleRemix}
      onDownload={handleDownload}
      onDownloadPdf={effectiveDeckId ? handleDownloadPdf : undefined}
      onPreviewFile={handlePreviewFile}
      onAllFiles={handleAllFiles}
      onStartGeneration={pipeline.startGeneration}
      chatSystemPrompt={PREZENTACJE_SYSTEM_PROMPT}
    />
  );
};

export default PrezentacjeView;

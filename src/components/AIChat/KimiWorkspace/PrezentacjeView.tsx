/**
 * PrezentacjeView — Gamma-style presentation generation workspace (P20-B).
 *
 * Split-screen: chat left ↔ deck preview right.
 * Wired to the real V8 artifact run pipeline via useKimiArtifactPipeline.
 * Auto-triggers pipeline when user sends first message in chat.
 *
 * SSOT: FINAL_IMPLEMENTATION_PLAN_20_PREZENTACJE_2026-03-29.md
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { TriModeChooser } from '@/components/shared/TriModeChooser';
import { Api } from '@/services/api';
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
  const [searchParams] = useSearchParams();
  const artifactId = searchParams.get('artifactId');
  const templateArtifactId = searchParams.get('templateArtifactId');
  const templatePrompt = searchParams.get('templatePrompt');
  const viewParam = searchParams.get('view');

  const showHome =
    !artifactId &&
    !templateArtifactId &&
    !templatePrompt &&
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
  const reopenLoaded = useRef(false);

  // D2 (roboty tri-tryby): jawny wybór 3 trybów na wejściu `?view=new`, tylko za
  // flagą `ff_tri_tryby`. OFF → `triMode` false → widok renderuje się bajt-
  // identycznie (od razu czat/pipeline AI). 'choose' = ekran wyboru; 'ai' =
  // przejście do dotychczasowego czatu (pipeline AI).
  const triMode = isTriModeEnabled();
  const [entryMode, setEntryMode] = useState<'choose' | 'ai'>('choose');
  const [creatingBlank, setCreatingBlank] = useState(false);

  // Auto-trigger from builtin template prompt
  const promptTriggered = useRef(false);
  useEffect(() => {
    if (!templatePrompt || promptTriggered.current || pipeline.currentRun || pipeline.isGenerating)
      return;
    promptTriggered.current = true;
    autoTriggered.current = true;
    void startRef.current(templatePrompt);
  }, [templatePrompt, pipeline.currentRun, pipeline.isGenerating]);

  // Auto-trigger from API template
  const templateTriggered = useRef(false);
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
    Api.get(`/artifacts/${templateArtifactId}`)
      .then((tmpl: any) => {
        const desc =
          tmpl?.originSummary?.template?.description || tmpl?.title || 'Presentation from template';
        void startRef.current(desc, templateArtifactId);
      })
      .catch(() => {
        void startRef.current('Create presentation from template', templateArtifactId);
      });
  }, [templateArtifactId, pipeline.currentRun, pipeline.isGenerating]);

  useEffect(() => {
    if (!artifactId || reopenLoaded.current) return;
    reopenLoaded.current = true;

    loadPresentationDeck(artifactId)
      .then(async ({ deckId, deckData: row }) => {
        const { slides, status } = parseDeckSlides(row);
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
        setReopenDeckId(artifactId);
        setReopenPreview({
          type: 'deck',
          title: t('prezentacje.defaultTitle', 'Presentation'),
          fileName: 'presentation.pptx',
          summary: t('prezentacje.loadPreviewFailed', 'Could not load deck preview.'),
          kpiItems: [],
          deckId: artifactId,
          deckSlides: [],
        });
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

  // D2 tryb ①CZYSTO — pusty deck (1 slajd tytułowy) utworzony BEZ pipeline'u AI
  // przez istniejący `POST /api/presentations/decks` (create-from-structured-JSON),
  // po czym od razu otwarty w Deck Builderze. Zero kroków generacji AI.
  const handleCreateEmptyDeck = useCallback(async (): Promise<void> => {
    if (creatingBlank) return;
    setCreatingBlank(true);
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
      }
    } catch {
      toast.error(t('prezentacje.blankFailed', 'Nie udało się utworzyć pustej prezentacji.'));
    } finally {
      setCreatingBlank(false);
    }
  }, [creatingBlank, openInDeckBuilder, t]);

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

  // D2 tri-tryby: brama wyboru na wejściu „Start new" (`?view=new`). Poprzedza
  // czat/pipeline; OFF (triMode false) → warunek fałszywy → od razu czat jak dziś.
  const showTriChooser =
    triMode &&
    entryMode === 'choose' &&
    viewParam === 'new' &&
    !artifactId &&
    !templateArtifactId &&
    !templatePrompt &&
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

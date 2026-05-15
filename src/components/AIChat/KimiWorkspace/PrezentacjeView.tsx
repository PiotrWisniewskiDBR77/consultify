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
import { useSearchParams } from 'react-router-dom';

import { Api } from '@/services/api';
import { useConversationStore } from '@/store/useConversationStore';
import { deriveDeckLifecycleBadge } from '@/utils/deckLifecycleBadge';

import { ArtifactModuleHome } from './ArtifactModuleHome';
import type { ArtifactPreview } from './KimiWorkspaceShell';
import { KimiWorkspaceShell } from './KimiWorkspaceShell';
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
  const unifiedJson =
    typeof deckData?.deck_json === 'string'
      ? JSON.parse(deckData.deck_json)
      : deckData?.deck_json || deckData?.unified_json;
  const rawSlides =
    unifiedJson?.slides ||
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

export const PrezentacjeView: React.FC = () => {
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

    Api.get(`/presentations/decks/${artifactId}`)
      .then(async (deckData: any) => {
        const { slides, status } = parseDeckSlides(deckData);
        const title = deckData?.title || t('prezentacje.defaultTitle', 'Presentation');

        let statusLabel = deriveDeckLifecycleBadge(null, null);
        try {
          const originRes = (await Api.get(`/artifacts/orig/presentation/${artifactId}`)) as any;
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

        setReopenDeckId(artifactId);
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
          deckId: artifactId,
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
  }, [artifactId]);

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

  // Post-generation chat intent routing (P20 audit §1.1)
  const lastRoutedMsgRef = useRef<string | null>(null);
  const { t } = useTranslation();
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
          window.open(`/presentations/builder/${deckTarget}`, '_blank');
          toast.success(
            t('prezentacje.intentRouted.openBuilder', 'Opening Deck Builder for theme changes')
          );
        },
      },
      {
        match: /open\s*builder|edytuj|otwórz\s*builder/,
        handler: async () => {
          window.open(`/presentations/builder/${deckTarget}`, '_blank');
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
  }, [activeMessages, pipeline.isCompleted, pipeline.currentRun, reopenDeckId, t]);

  const effectivePreview = pipeline.preview || reopenPreview;
  const effectiveDeckId =
    pipeline.currentRun?.materializationOrigin?.originRecordId || reopenDeckId;
  const effectiveCompleted = pipeline.isCompleted || (!!reopenPreview && !pipeline.currentRun);

  const handlePreviewFile = useCallback(() => {
    if (effectiveDeckId) {
      window.open(`/presentations/builder/${effectiveDeckId}`, '_blank');
    }
  }, [effectiveDeckId]);

  const handleAllFiles = useCallback(() => {
    window.open('/presentations', '_blank');
  }, []);

  const handleDownload = useCallback(async () => {
    if (effectiveDeckId) {
      window.open(`/api/presentations/decks/${effectiveDeckId}/download`, '_blank');
      return;
    }
    await pipeline.handleDownload();
  }, [effectiveDeckId, pipeline]);

  const handleDownloadPdf = useCallback(() => {
    if (effectiveDeckId) {
      window.open(`/api/presentations/decks/${effectiveDeckId}/export/pdf`, '_blank');
    }
  }, [effectiveDeckId]);

  if (showHome) {
    return <ArtifactModuleHome lane="prezentacje" />;
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

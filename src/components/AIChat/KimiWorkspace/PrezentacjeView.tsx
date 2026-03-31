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
import { useSearchParams } from 'react-router-dom';

import { Api } from '@/services/api';
import { useConversationStore } from '@/store/useConversationStore';

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
  const rawSlides = unifiedJson?.slides || [];
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
  const { activeMessages } = useConversationStore();
  const [searchParams] = useSearchParams();
  const artifactId = searchParams.get('artifactId');
  const advanceRef = useRef(pipeline.advancePipeline);
  advanceRef.current = pipeline.advancePipeline;
  const autoTriggered = useRef(false);
  const startRef = useRef(pipeline.startGeneration);
  startRef.current = pipeline.startGeneration;

  const [reopenPreview, setReopenPreview] = useState<ArtifactPreview | null>(null);
  const [reopenDeckId, setReopenDeckId] = useState<string | null>(null);
  const reopenLoaded = useRef(false);

  useEffect(() => {
    if (!artifactId || reopenLoaded.current) return;
    reopenLoaded.current = true;

    Api.get(`/presentations/decks/${artifactId}`)
      .then((deckData: any) => {
        const { slides, status } = parseDeckSlides(deckData);
        const title = deckData?.title || 'Presentation';
        const statusLabel =
          status === 'ready' || status === 'exported'
            ? 'Exported'
            : status === 'reviewed'
              ? 'Reviewed'
              : 'Draft';
        setReopenDeckId(artifactId);
        setReopenPreview({
          type: 'deck',
          title,
          fileName: `${title.replace(/\s+/g, '_')}.pptx`,
          summary: `Presentation "${title}" — ${slides.length} slides.`,
          kpiItems: [
            { label: 'Slides', value: String(slides.length) },
            { label: 'Status', value: statusLabel },
            { label: 'Format', value: 'PPTX / PDF' },
          ],
          deckId: artifactId,
          deckSlides: slides,
        });
      })
      .catch(() => {
        setReopenDeckId(artifactId);
        setReopenPreview({
          type: 'deck',
          title: 'Presentation',
          fileName: 'presentation.pptx',
          summary: 'Could not load deck preview.',
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
    if (autoTriggered.current || pipeline.currentRun || pipeline.isGenerating || reopenDeckId)
      return;
    const userMessages = activeMessages.filter((m) => m.role === 'user');
    const aiMessages = activeMessages.filter((m) => m.role === 'ai');
    if (userMessages.length >= 1 && aiMessages.length >= 1) {
      const firstUserMsg = userMessages[0].content;
      if (firstUserMsg && firstUserMsg.trim().length > 5) {
        autoTriggered.current = true;
        void startRef.current(firstUserMsg.trim());
      }
    }
  }, [activeMessages, pipeline.currentRun, pipeline.isGenerating, reopenDeckId]);

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

  return (
    <KimiWorkspaceShell
      lane="prezentacje"
      taskSteps={pipeline.taskSteps}
      totalSteps={pipeline.totalSteps}
      completedSteps={pipeline.completedSteps}
      isGenerating={pipeline.isGenerating}
      isCompleted={effectiveCompleted}
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

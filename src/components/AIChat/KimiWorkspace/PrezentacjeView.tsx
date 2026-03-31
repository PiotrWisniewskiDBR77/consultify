/**
 * PrezentacjeView — Gamma-style presentation generation workspace (P20-B).
 *
 * Split-screen: chat left ↔ deck preview right.
 * Wired to the real V8 artifact run pipeline via useKimiArtifactPipeline.
 * Auto-triggers pipeline when user sends first message in chat.
 *
 * SSOT: FINAL_IMPLEMENTATION_PLAN_20_PREZENTACJE_2026-03-29.md
 */

import React, { useCallback, useEffect, useRef } from 'react';

import { useConversationStore } from '@/store/useConversationStore';

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

export const PrezentacjeView: React.FC = () => {
  const pipeline = useKimiArtifactPipeline('prezentacje');
  const { activeMessages } = useConversationStore();
  const advanceRef = useRef(pipeline.advancePipeline);
  advanceRef.current = pipeline.advancePipeline;
  const autoTriggered = useRef(false);
  const startRef = useRef(pipeline.startGeneration);
  startRef.current = pipeline.startGeneration;

  useEffect(() => {
    if (!pipeline.isGenerating || pipeline.isBusy) return undefined;
    const timer = setInterval(() => {
      void advanceRef.current();
    }, 3000);
    return () => clearInterval(timer);
  }, [pipeline.isGenerating, pipeline.isBusy]);

  useEffect(() => {
    if (autoTriggered.current || pipeline.currentRun || pipeline.isGenerating) return;
    const userMessages = activeMessages.filter((m) => m.role === 'user');
    const aiMessages = activeMessages.filter((m) => m.role === 'ai');
    if (userMessages.length >= 1 && aiMessages.length >= 1) {
      const firstUserMsg = userMessages[0].content;
      if (firstUserMsg && firstUserMsg.trim().length > 5) {
        autoTriggered.current = true;
        void startRef.current(firstUserMsg.trim());
      }
    }
  }, [activeMessages, pipeline.currentRun, pipeline.isGenerating]);

  const handlePreviewFile = useCallback(() => {
    if (pipeline.currentRun?.materializationOrigin?.originRecordId) {
      const deckId = pipeline.currentRun.materializationOrigin.originRecordId;
      window.open(`/presentations/builder/${deckId}`, '_blank');
    }
  }, [pipeline.currentRun]);

  const handleAllFiles = useCallback(() => {
    window.open('/presentations', '_blank');
  }, []);

  return (
    <KimiWorkspaceShell
      lane="prezentacje"
      taskSteps={pipeline.taskSteps}
      totalSteps={pipeline.totalSteps}
      completedSteps={pipeline.completedSteps}
      isGenerating={pipeline.isGenerating}
      isCompleted={pipeline.isCompleted}
      preview={pipeline.preview}
      onReplay={pipeline.handleReplay}
      onRemix={pipeline.handleRemix}
      onDownload={pipeline.handleDownload}
      onPreviewFile={handlePreviewFile}
      onAllFiles={handleAllFiles}
      onStartGeneration={pipeline.startGeneration}
      chatSystemPrompt={PREZENTACJE_SYSTEM_PROMPT}
    />
  );
};

export default PrezentacjeView;

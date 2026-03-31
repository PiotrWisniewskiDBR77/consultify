/**
 * WordyView — KIMI-style document generation workspace (P22-B).
 *
 * Split-screen: chat left ↔ PDF/doc preview right.
 * Wired to the real V8 artifact run pipeline via useKimiArtifactPipeline.
 * Auto-triggers pipeline when user sends first message in chat.
 *
 * SSOT: FINAL_IMPLEMENTATION_PLAN_22_WORDY_2026-03-29.md
 */

import React, { useCallback, useEffect, useRef } from 'react';

import { useConversationStore } from '@/store/useConversationStore';

import { KimiWorkspaceShell } from './KimiWorkspaceShell';
import { useKimiArtifactPipeline } from './useKimiArtifactPipeline';

const WORDY_SYSTEM_PROMPT = `You are a professional document creation assistant in Consultify.
Your role is to help users create high-quality documents: reports, articles, analyses, briefs, and professional papers.

When the user describes a document they want:
1. Understand the requirements (topic, audience, length, format, style)
2. Create a structured plan with sections
3. Generate the document content step by step
4. Provide a summary with key metrics (word count, sections, references)

Always be transparent about each step. Show your work process clearly.
Format your final output as a well-structured document with proper headings, paragraphs, and citations where appropriate.`;

export const WordyView: React.FC = () => {
  const pipeline = useKimiArtifactPipeline('wordy');
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
      const reportId = pipeline.currentRun.materializationOrigin.originRecordId;
      window.open(`/api/report-builder/reports/${reportId}/export/pdf`, '_blank');
    }
  }, [pipeline.currentRun]);

  const handleDownloadPdf = useCallback(() => {
    if (pipeline.currentRun?.materializationOrigin?.originRecordId) {
      const reportId = pipeline.currentRun.materializationOrigin.originRecordId;
      window.open(`/api/report-builder/reports/${reportId}/export/pdf`, '_blank');
    }
  }, [pipeline.currentRun]);

  const handleAllFiles = useCallback(() => {
    window.open('/results', '_blank');
  }, []);

  return (
    <KimiWorkspaceShell
      lane="wordy"
      taskSteps={pipeline.taskSteps}
      totalSteps={pipeline.totalSteps}
      completedSteps={pipeline.completedSteps}
      isGenerating={pipeline.isGenerating}
      isCompleted={pipeline.isCompleted}
      preview={pipeline.preview}
      onReplay={pipeline.handleReplay}
      onRemix={pipeline.handleRemix}
      onDownload={pipeline.handleDownload}
      onDownloadPdf={handleDownloadPdf}
      onPreviewFile={handlePreviewFile}
      onAllFiles={handleAllFiles}
      onStartGeneration={pipeline.startGeneration}
      chatSystemPrompt={WORDY_SYSTEM_PROMPT}
    />
  );
};

export default WordyView;

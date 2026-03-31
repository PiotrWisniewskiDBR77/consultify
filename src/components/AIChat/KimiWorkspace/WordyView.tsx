/**
 * WordyView — KIMI-style document generation workspace (P22-B).
 *
 * Split-screen: chat left ↔ PDF/doc preview right.
 * Wired to the real V8 artifact run pipeline via useKimiArtifactPipeline.
 *
 * SSOT: FINAL_IMPLEMENTATION_PLAN_22_WORDY_2026-03-29.md
 */

import React, { useCallback, useEffect, useRef } from 'react';

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
  const advanceRef = useRef(pipeline.advancePipeline);
  advanceRef.current = pipeline.advancePipeline;

  useEffect(() => {
    if (!pipeline.isGenerating || pipeline.isBusy) return undefined;
    const timer = setInterval(() => {
      void advanceRef.current();
    }, 3000);
    return () => clearInterval(timer);
  }, [pipeline.isGenerating, pipeline.isBusy]);

  const handlePreviewFile = useCallback(() => {
    if (pipeline.currentRun?.materializationOrigin?.originRecordId) {
      const reportId = pipeline.currentRun.materializationOrigin.originRecordId;
      window.open(`/api/report-builder/reports/${reportId}/export/pdf`, '_blank');
    }
  }, [pipeline.currentRun]);

  const handleAllFiles = useCallback(() => {
    window.open('/reports-hub', '_blank');
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
      onPreviewFile={handlePreviewFile}
      onAllFiles={handleAllFiles}
      onStartGeneration={pipeline.startGeneration}
      chatSystemPrompt={WORDY_SYSTEM_PROMPT}
    />
  );
};

export default WordyView;

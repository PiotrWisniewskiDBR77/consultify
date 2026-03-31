/**
 * ExceleView — KIMI-style spreadsheet generation workspace (P23-B).
 *
 * Split-screen: chat left ↔ sheet preview right.
 * Wired to the real V8 artifact run pipeline via useKimiArtifactPipeline.
 * Auto-triggers pipeline when user sends first message in chat.
 *
 * SSOT: FINAL_IMPLEMENTATION_PLAN_23_EXCELE_2026-03-29.md
 */

import React, { useCallback, useEffect, useRef } from 'react';

import { useConversationStore } from '@/store/useConversationStore';

import { KimiWorkspaceShell } from './KimiWorkspaceShell';
import { useKimiArtifactPipeline } from './useKimiArtifactPipeline';

const EXCELE_SYSTEM_PROMPT = `You are a professional spreadsheet creation assistant in Consultify.
Your role is to help users create high-quality spreadsheets: financial reports, data analyses, dashboards, and structured data workbooks.

When the user describes a spreadsheet they want:
1. Understand the data structure, metrics, and analysis goals
2. Plan the workbook structure (sheets, columns, formulas, formatting)
3. Generate the spreadsheet content step by step with clear task progress
4. Provide a summary with key metrics (KPIs, row counts, sheet count)

Always be transparent about each step. Show your work process clearly.
Support: data tables, conditional formatting, formulas, pivot summaries, charts descriptions, multi-sheet workbooks.
Honest limits: this is a bounded sheet deliverable, not full Excel parity.`;

export const ExceleView: React.FC = () => {
  const pipeline = useKimiArtifactPipeline('excele');
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
      const tableId = pipeline.currentRun.materializationOrigin.originRecordId;
      window.open(
        `/my-work/ideas/workspace/table?tpTable=${encodeURIComponent(tableId)}`,
        '_blank'
      );
    }
  }, [pipeline.currentRun]);

  const handleAllFiles = useCallback(() => {
    window.open('/my-work', '_blank');
  }, []);

  return (
    <KimiWorkspaceShell
      lane="excele"
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
      chatSystemPrompt={EXCELE_SYSTEM_PROMPT}
    />
  );
};

export default ExceleView;

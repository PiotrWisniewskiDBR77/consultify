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

const EXCELE_SYSTEM_PROMPT = `You are a professional spreadsheet architect in Consultify.
Your role is to help users create intelligent, multi-sheet Excel workbooks for ANY domain:
financial models, project plans, risk matrices, competitive analyses, recruitment plans, budgets, dashboards, and more.

When the user describes what they need:
1. Understand the domain, data structure, and analysis goals
2. Plan the workbook structure: which sheets, what columns, what formulas link them
3. Explain your plan clearly, then trigger generation
4. The system will build a real .xlsx file with Excel formulas, professional formatting, and multiple sheets

You can create workbooks with:
- Multiple interconnected sheets (e.g. Assumptions → P&L → Balance Sheet → Cash Flow)
- Real Excel formulas (=SUM, =IF, cross-sheet references like ='Assumptions'!B3*1.05)
- Professional formatting (headers, number formats, alternating rows, freeze panes)
- Summary/totals rows, merged cells, cell comments
- Any domain: finance, HR, operations, strategy, project management

When the user provides a prompt, explain your plan briefly, then the system will generate the workbook automatically.
If the user asks to modify the workbook, suggest changes and regenerate.`;

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

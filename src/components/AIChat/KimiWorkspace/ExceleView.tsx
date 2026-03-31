/**
 * ExceleView — KIMI-style spreadsheet generation workspace (P23-B).
 *
 * Split-screen: chat left ↔ sheet preview right.
 * Governed artifact creation via V8 artifact run pipeline (sheet family).
 *
 * SSOT: FINAL_IMPLEMENTATION_PLAN_23_EXCELE_2026-03-29.md
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import {
  KimiWorkspaceShell,
  type ArtifactPreview,
  type TaskStep,
} from './KimiWorkspaceShell';

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
  const { t } = useTranslation();

  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [preview, setPreview] = useState<ArtifactPreview | null>(null);

  const handleReplay = useCallback(() => {
    setTaskSteps([]);
    setIsGenerating(false);
    setIsCompleted(false);
    setPreview(null);
    toast.success(t('kimi.replayStarted', 'Starting replay...'));
  }, [t]);

  const handleRemix = useCallback(() => {
    toast.success(t('kimi.remixHint', 'Modify your prompt and regenerate'));
  }, [t]);

  const handleDownload = useCallback(() => {
    if (preview?.url) {
      const a = document.createElement('a');
      a.href = preview.url;
      a.download = preview.fileName || 'spreadsheet.xlsx';
      a.click();
    } else {
      toast.error(t('kimi.noFileToDownload', 'No file available for download'));
    }
  }, [preview, t]);

  const handlePreviewFile = useCallback(() => {
    if (preview?.url) {
      window.open(preview.url, '_blank');
    }
  }, [preview]);

  const handleAllFiles = useCallback(() => {
    toast.success(t('kimi.allFilesHint', 'Opening file manager...'));
  }, [t]);

  const totalSteps = taskSteps.length || 0;
  const completedSteps = taskSteps.filter((s) => s.status === 'completed').length;

  return (
    <KimiWorkspaceShell
      lane="excele"
      taskSteps={taskSteps}
      totalSteps={totalSteps}
      completedSteps={completedSteps}
      isGenerating={isGenerating}
      isCompleted={isCompleted}
      preview={preview}
      onReplay={handleReplay}
      onRemix={handleRemix}
      onDownload={handleDownload}
      onPreviewFile={handlePreviewFile}
      onAllFiles={handleAllFiles}
      chatSystemPrompt={EXCELE_SYSTEM_PROMPT}
    />
  );
};

export default ExceleView;

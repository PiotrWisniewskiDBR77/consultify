/**
 * WordyView — KIMI-style document generation workspace (P22-B).
 *
 * Split-screen: chat left ↔ PDF/doc preview right.
 * Governed artifact creation via V8 artifact run pipeline.
 *
 * SSOT: FINAL_IMPLEMENTATION_PLAN_22_WORDY_2026-03-29.md
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import {
  KimiWorkspaceShell,
  type ArtifactPreview,
  type TaskStep,
} from './KimiWorkspaceShell';

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
      a.download = preview.fileName || 'document.pdf';
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
      lane="wordy"
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
      chatSystemPrompt={WORDY_SYSTEM_PROMPT}
    />
  );
};

export default WordyView;

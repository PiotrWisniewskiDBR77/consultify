/**
 * WordyView — KIMI-style document generation workspace (P22-B).
 *
 * Split-screen: chat left ↔ PDF/doc preview right.
 * Wired to the real V8 artifact run pipeline via useKimiArtifactPipeline.
 * Auto-triggers pipeline when user sends first message in chat.
 * Supports reopen via ?artifactId= query param from Outputs Library.
 *
 * SSOT: FINAL_IMPLEMENTATION_PLAN_22_WORDY_2026-03-29.md
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';

import { ArtifactModuleHome } from './ArtifactModuleHome';
import type { ArtifactPreview } from './KimiWorkspaceShell';
import { KimiWorkspaceShell } from './KimiWorkspaceShell';
import { useKimiArtifactPipeline } from './useKimiArtifactPipeline';

const WORDY_SYSTEM_PROMPT_BASE = `You are a professional document creation assistant in Consultify.
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
  const activeMessages = useConversationStore((s) => s.activeMessages);
  const currentOrganization = useAppStore((s) => s.currentOrganization);

  const systemPrompt = useMemo(() => {
    const orgName = currentOrganization?.name;
    if (!orgName) return WORDY_SYSTEM_PROMPT_BASE;
    return `${WORDY_SYSTEM_PROMPT_BASE}\n\nOrganization context: You are working within "${orgName}". Tailor document style, terminology, and structure to this organization's needs when relevant.`;
  }, [currentOrganization?.name]);
  const [searchParams] = useSearchParams();
  const artifactId = searchParams.get('artifactId');
  const templateArtifactId = searchParams.get('templateArtifactId');
  const templatePrompt = searchParams.get('templatePrompt');
  const viewParam = searchParams.get('view');

  const showHome = !artifactId && !templateArtifactId && !templatePrompt && viewParam !== 'new' && !pipeline.currentRun && !pipeline.isGenerating;

  const advanceRef = useRef(pipeline.advancePipeline);
  advanceRef.current = pipeline.advancePipeline;
  const autoTriggered = useRef(false);
  const startRef = useRef(pipeline.startGeneration);
  startRef.current = pipeline.startGeneration;

  const [reopenPreview, setReopenPreview] = useState<ArtifactPreview | null>(null);
  const [reopenReportId, setReopenReportId] = useState<string | null>(null);
  const reopenLoaded = useRef(false);

  // Auto-trigger from builtin template prompt
  const promptTriggered = useRef(false);
  useEffect(() => {
    if (!templatePrompt || promptTriggered.current || pipeline.currentRun || pipeline.isGenerating) return;
    promptTriggered.current = true;
    autoTriggered.current = true;
    void startRef.current(templatePrompt);
  }, [templatePrompt, pipeline.currentRun, pipeline.isGenerating]);

  // Auto-trigger from API template
  const templateTriggered = useRef(false);
  useEffect(() => {
    if (!templateArtifactId || templateTriggered.current || pipeline.currentRun || pipeline.isGenerating) return;
    templateTriggered.current = true;
    autoTriggered.current = true;
    Api.get(`/artifacts/${templateArtifactId}`)
      .then((tmpl: any) => {
        const desc = tmpl?.originSummary?.template?.description || tmpl?.title || 'Document from template';
        void startRef.current(desc, templateArtifactId);
      })
      .catch(() => {
        void startRef.current('Create document from template', templateArtifactId);
      });
  }, [templateArtifactId, pipeline.currentRun, pipeline.isGenerating]);

  useEffect(() => {
    if (!artifactId || reopenLoaded.current) return;
    reopenLoaded.current = true;

    Api.get(`/report-builder/${artifactId}`)
      .then((reportData: any) => {
        const title = reportData?.title || 'Document';
        const pdfUrl = `/api/report-builder/${artifactId}/export/pdf`;
        setReopenReportId(artifactId);
        setReopenPreview({
          type: 'pdf',
          title,
          url: pdfUrl,
          fileName: `${title.replace(/\s+/g, '_')}.pdf`,
        });
      })
      .catch(() => {
        setReopenReportId(artifactId);
        setReopenPreview({
          type: 'pdf',
          title: 'Document',
          url: `/api/report-builder/${artifactId}/export/pdf`,
          fileName: 'document.pdf',
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
      reopenReportId
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
    reopenReportId,
  ]);

  const effectivePreview = pipeline.preview || reopenPreview;
  const effectiveReportId =
    pipeline.currentRun?.materializationOrigin?.originRecordId || reopenReportId;
  const effectiveCompleted = pipeline.isCompleted || (!!reopenPreview && !pipeline.currentRun);

  const handlePreviewFile = useCallback(() => {
    if (effectiveReportId) {
      window.open(`/api/report-builder/${effectiveReportId}/export/pdf`, '_blank');
    }
  }, [effectiveReportId]);

  const handleDownloadPdf = useCallback(() => {
    if (effectiveReportId) {
      window.open(`/api/report-builder/${effectiveReportId}/export/pdf`, '_blank');
    }
  }, [effectiveReportId]);

  const handleAllFiles = useCallback(() => {
    window.open('/presentations', '_blank');
  }, []);

  if (showHome) {
    return <ArtifactModuleHome lane="wordy" />;
  }

  return (
    <KimiWorkspaceShell
      lane="wordy"
      taskSteps={pipeline.taskSteps}
      totalSteps={pipeline.totalSteps}
      completedSteps={pipeline.completedSteps}
      isGenerating={pipeline.isGenerating}
      isCompleted={effectiveCompleted}
      preview={effectivePreview}
      onReplay={pipeline.handleReplay}
      onRemix={pipeline.handleRemix}
      onDownload={pipeline.handleDownload}
      onDownloadPdf={effectiveReportId ? handleDownloadPdf : undefined}
      onPreviewFile={handlePreviewFile}
      onAllFiles={handleAllFiles}
      onStartGeneration={pipeline.startGeneration}
      chatSystemPrompt={systemPrompt}
    />
  );
};

export default WordyView;

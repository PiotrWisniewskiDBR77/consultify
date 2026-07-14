/**
 * ReportBuilderWorkspace
 *
 * Main workspace for the DRD Audit Report Builder.
 * Uses SplitLayout with:
 * - Left side: Full document with all sections
 * - Right side: AI Chat for editing
 *
 * Features:
 * - Table of Contents navigation
 * - Inline section editing
 * - AI-assisted content generation
 * - PDF/Excel export
 * - Section reordering
 */

import {
  AlertCircle,
  FileWarning,
  Loader2,
  Maximize2,
  MessageCircle,
  MessageSquare,
  Minimize2,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/shared/states';

import { type AIAction, useReportSections } from '../../hooks/useReportSections';
import { useAppStore } from '../../store/useAppStore';
import { UnifiedChatPanel } from '../AIChat/UnifiedChatPanel';
import { SplitLayout } from '../layout/SplitLayout';
import { ReportBuilder } from '../Reports/ReportBuilder';
import { ReportCommentPanel } from '../Reports/ReportCommentPanel';
import { ReportHeader } from '../Reports/ReportHeader';
import { StickyNavigation } from '../Reports/StickyNavigation';
import { TableOfContents } from '../Reports/TableOfContents';

interface ReportBuilderWorkspaceProps {
  reportId: string;
  onClose: () => void;
}

export const ReportBuilderWorkspace: React.FC<ReportBuilderWorkspaceProps> = ({
  reportId,
  onClose,
}) => {
  const { t } = useTranslation();

  // Global state for chat
  const { addChatMessage, setIsBotTyping, isBotTyping, activeChatMessages } = useAppStore();

  // Report sections hook
  const {
    report,
    sections,
    isLoading,
    isSaving,
    error,
    hasUnsavedChanges,
    activeSection,
    fetchReport,
    updateSection,
    addSection,
    deleteSection,
    reorderSections,
    aiAction,
    regenerateReport,
    finalizeReport,
    approveReport,
    exportPdf,
    exportExcel,
    setActiveSection,
    clearError,
    markChangesSaved,
  } = useReportSections(reportId);

  // Local state
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showComments, setShowComments] = useState(false);

  // Memoize section info for StickyNavigation
  const sectionInfos = useMemo(() => {
    if (!sections) return [];
    return sections.map((s) => ({
      id: s.id,
      title: s.title,
      sectionType: s.sectionType,
      orderIndex: s.orderIndex,
    }));
  }, [sections]);

  // Handle section update from ReportBuilder
  const handleSectionUpdate = useCallback(
    async (sectionId: string, content: string, title?: string) => {
      const success = await updateSection(sectionId, content, title);
      if (success) {
        toast.success(t('assessment.reportBuilder.sectionSaved', 'Section saved'));
      } else {
        toast.error(t('assessment.reportBuilder.sectionSaveFailed', 'Failed to save section'));
      }
    },
    [updateSection, t]
  );

  // Handle section add
  const handleSectionAdd = useCallback(
    async (sectionType: string, afterIndex: number) => {
      const newSection = await addSection(sectionType as any, {
        orderIndex: afterIndex + 1,
      });
      if (newSection) {
        toast.success(t('assessment.reportBuilder.sectionAdded', 'Section added'));
        setFocusSectionId(newSection.id);
      }
      return newSection;
    },
    [addSection, t]
  );

  // Handle section delete
  const handleSectionDelete = useCallback(
    async (sectionId: string) => {
      const success = await deleteSection(sectionId);
      if (success) {
        toast.success(t('assessment.reportBuilder.sectionDeleted', 'Section deleted'));
      } else {
        toast.error(t('assessment.reportBuilder.sectionDeleteFailed', 'Failed to delete section'));
      }
    },
    [deleteSection, t]
  );

  // Handle section reorder
  const handleSectionReorder = useCallback(
    async (newOrder: { id: string; orderIndex: number }[]) => {
      const sectionIds = newOrder.sort((a, b) => a.orderIndex - b.orderIndex).map((o) => o.id);
      const success = await reorderSections(sectionIds);
      if (!success) {
        toast.error(t('assessment.reportBuilder.reorderFailed', 'Failed to reorder sections'));
      }
    },
    [reorderSections, t]
  );

  // Handle AI action on section
  const handleAIAction = useCallback(
    async (sectionId: string, action: string) => {
      toast.loading(t('assessment.reportBuilder.aiProcessing', 'AI processing...'), {
        id: 'ai-action',
      });

      const success = await aiAction(sectionId, action as AIAction);

      if (success) {
        toast.success(t('assessment.reportBuilder.aiUpdated', 'Section updated by AI'), {
          id: 'ai-action',
        });
      } else {
        toast.error(t('assessment.reportBuilder.aiFailed', 'AI failed to process section'), {
          id: 'ai-action',
        });
      }
    },
    [aiAction, t]
  );

  // Handle save
  const handleSave = useCallback(() => {
    // Sections are auto-saved, this just marks them as saved
    markChangesSaved();
    toast.success(t('assessment.reportBuilder.reportSaved', 'Report saved'));
  }, [markChangesSaved, t]);

  // Handle finalize
  const handleFinalize = useCallback(async () => {
    const confirmed = window.confirm(
      t(
        'assessment.reportBuilder.confirmFinalize',
        'Submit the report for approval (set status FINAL)? You can still edit it until it is approved.'
      )
    );

    if (!confirmed) return;

    setIsFinalizing(true);
    const success = await finalizeReport();
    setIsFinalizing(false);

    if (success) {
      toast.success(t('assessment.reportBuilder.reportFinalized', 'Report finalized'));
    } else {
      toast.error(t('assessment.reportBuilder.finalizeFailed', 'Failed to finalize report'));
    }
  }, [finalizeReport, t]);

  const handleApprove = useCallback(async () => {
    const confirmed = window.confirm(
      t(
        'assessment.reportBuilder.confirmApprove',
        'Approve the report? It will become globally visible and locked for editing.'
      )
    );
    if (!confirmed) return;

    setIsFinalizing(true);
    const success = await approveReport();
    setIsFinalizing(false);

    if (success) {
      toast.success(t('assessment.reportBuilder.reportApproved', 'Report approved'));
    } else {
      toast.error(t('assessment.reportBuilder.approveFailed', 'Failed to approve report'));
    }
  }, [approveReport, t]);

  // Handle regenerate
  const handleRegenerate = useCallback(async () => {
    const confirmed = window.confirm(
      t(
        'assessment.reportBuilder.confirmRegenerate',
        'Are you sure you want to regenerate the report? All edits will be lost.'
      )
    );

    if (!confirmed) return;

    setIsRegenerating(true);
    toast.loading(t('assessment.reportBuilder.generating', 'Generating report...'), {
      id: 'regenerate',
    });

    const success = await regenerateReport();
    setIsRegenerating(false);

    if (success) {
      toast.success(t('assessment.reportBuilder.reportRegenerated', 'Report regenerated'), {
        id: 'regenerate',
      });
    } else {
      toast.error(t('assessment.reportBuilder.regenerateFailed', 'Failed to regenerate report'), {
        id: 'regenerate',
      });
    }
  }, [regenerateReport, t]);

  // Handle export PDF
  const handleExportPdf = useCallback(async () => {
    toast.loading(t('assessment.reportBuilder.exportingPdf', 'Exporting PDF...'), {
      id: 'export-pdf',
    });
    await exportPdf();
    toast.success(t('assessment.reportBuilder.pdfDownloaded', 'PDF downloaded'), {
      id: 'export-pdf',
    });
  }, [exportPdf, t]);

  // Handle export Excel
  const handleExportExcel = useCallback(async () => {
    toast.loading(t('assessment.reportBuilder.exportingExcel', 'Exporting Excel...'), {
      id: 'export-excel',
    });
    await exportExcel();
    toast.success(t('assessment.reportBuilder.excelDownloaded', 'Excel downloaded'), {
      id: 'export-excel',
    });
  }, [exportExcel, t]);

  // Handle TOC section click
  const handleTocSectionClick = useCallback(
    (sectionId: string) => {
      setFocusSectionId(sectionId);
      setActiveSection(sectionId);
    },
    [setActiveSection]
  );

  // Handle focus change from ReportBuilder
  const handleFocusChange = useCallback(
    (sectionId: string | null) => {
      setActiveSection(sectionId);
    },
    [setActiveSection]
  );

  // Handle unsaved change
  const handleUnsavedChange = useCallback((hasChanges: boolean) => {
    // This is tracked by the hook
  }, []);

  // Handle sticky nav section click
  const handleStickySectionClick = useCallback(
    (sectionId: string) => {
      setFocusSectionId(sectionId);
      setActiveSection(sectionId);
      // Scroll to section
      const element = document.querySelector(`[data-section-id="${sectionId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [setActiveSection]
  );

  // Toggle reading mode
  const handleToggleReadingMode = useCallback(() => {
    setIsReadingMode((prev) => !prev);
    if (!isReadingMode) {
      document.body.classList.add('reading-mode');
    } else {
      document.body.classList.remove('reading-mode');
    }
  }, [isReadingMode]);

  // Handle chat message for AI editing
  useEffect(() => {
    const lastMessage = activeChatMessages[activeChatMessages.length - 1];
    if (lastMessage?.role === 'user' && activeSection) {
      // Check if this is an edit command
      const text = (lastMessage as any).content?.toLowerCase() || '';
      const isEditCommand =
        text.includes('rozwiń') ||
        text.includes('expand') ||
        text.includes('skróć') ||
        text.includes('summarize') ||
        text.includes('ulepsz') ||
        text.includes('improve') ||
        text.includes('przetłumacz') ||
        text.includes('translate') ||
        text.includes('regeneruj') ||
        text.includes('regenerate');

      if (isEditCommand) {
        // Determine action
        let action: AIAction = 'improve';
        if (text.includes('rozwiń') || text.includes('expand')) action = 'expand';
        if (text.includes('skróć') || text.includes('summarize')) action = 'summarize';
        if (text.includes('przetłumacz') || text.includes('translate')) action = 'translate';
        if (text.includes('regeneruj') || text.includes('regenerate')) action = 'regenerate';

        // Execute AI action
        handleAIAction(activeSection, action);

        // Add bot response
        setIsBotTyping(true);
        setTimeout(() => {
          // Use addMessage from useConversationStore if possible, but for now addChatMessage is fine
          addChatMessage({
            id: `ai-edit-${Date.now()}`,
            role: 'ai',
            content: t(
              'assessment.reportBuilder.executingAction',
              `Executing "${action}" on the selected section...`,
              { action }
            ),
            timestamp: new Date(),
          });
          setIsBotTyping(false);
        }, 500);
      }
    }
  }, [activeChatMessages, activeSection, handleAIAction, addChatMessage, setIsBotTyping, t]);

  // Loading state
  if (isLoading && !report) {
    return (
      <div className="h-full bg-[var(--c-surface)]">
        <LoadingState
          variant="progress"
          label={t('assessment.reportBuilder.loading', 'Loading report…')}
        />
      </div>
    );
  }

  // Error state
  if (error && !report) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--c-surface)]">
        <EmptyState
          variant="error"
          icon={FileWarning}
          title={t('assessment.reportBuilder.errorLoading', 'Error loading report')}
          description={error}
          secondaryAction={{
            label: t('assessment.reportBuilder.goBack', 'Go back'),
            onClick: onClose,
          }}
          onRetry={() => {
            clearError();
            fetchReport();
          }}
        />
      </div>
    );
  }

  // Empty report state
  if (report && (!sections || sections.length === 0)) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
        <ReportHeader
          name={report.name}
          status={report.status}
          organizationName={report.organizationName}
          assessmentName={report.assessmentName}
          progress={0}
          hasUnsavedChanges={false}
          isSaving={isSaving}
          isLoading={isLoading || isRegenerating}
          createdAt={report.createdAt}
          updatedAt={report.updatedAt}
          onBack={onClose}
          onSave={handleSave}
          onFinalize={handleFinalize}
          onRegenerate={handleRegenerate}
          onExportPdf={handleExportPdf}
          onExportExcel={handleExportExcel}
        />

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <Sparkles className="w-16 h-16 text-primary-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-2">
              {t('assessment.reportBuilder.emptyReport', 'Report is empty')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {t(
                'assessment.reportBuilder.emptyReportDesc',
                'This report has no sections yet. Generate the report to get started.'
              )}
            </p>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-crimson-600 hover:from-primary-700 hover:to-crimson-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
            >
              {isRegenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              {t('assessment.reportBuilder.generateWithAI', 'Generate report with AI')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main workspace
  if (!report) return null;

  const readOnly = report.status === 'APPROVED' || report.status === 'ARCHIVED';

  // Build the report content for SplitLayout
  const reportContent = (
    <div className="h-full flex flex-col">
      {/* Sticky Navigation - appears on scroll */}
      <StickyNavigation
        sections={sectionInfos}
        currentSection={focusSectionId || activeSection}
        reportTitle={report.name}
        isReadingMode={isReadingMode}
        onSectionClick={handleStickySectionClick}
        onToggleReadingMode={handleToggleReadingMode}
      />

      {/* Header */}
      <ReportHeader
        reportId={report.id}
        name={report.name}
        status={report.status}
        organizationName={report.organizationName}
        assessmentName={report.assessmentName}
        progress={report.progress}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        isLoading={isLoading || isRegenerating || isFinalizing}
        createdAt={report.createdAt}
        updatedAt={report.updatedAt}
        isFullscreen={isFullscreen}
        onBack={isFullscreen ? () => setIsFullscreen(false) : onClose}
        onSave={handleSave}
        onFinalize={handleFinalize}
        onApprove={handleApprove}
        onRegenerate={handleRegenerate}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        onFullscreen={() => setIsFullscreen(!isFullscreen)}
      />

      {/* Main content */}
      <div className="flex-1 overflow-auto bg-slate-50 dark:bg-navy-950">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          {/* Table of Contents */}
          <div className="mb-6">
            <TableOfContents
              sections={(sections || []).map((s) => ({
                id: s.id,
                sectionType: s.sectionType,
                axisId: s.axisId,
                title: s.title,
                isAiGenerated: s.isAiGenerated,
                orderIndex: s.orderIndex,
              }))}
              activeSection={focusSectionId || activeSection}
              readOnly={readOnly}
              onSectionClick={handleTocSectionClick}
            />
          </div>

          {/* Report Builder */}
          <ReportBuilder
            report={{
              id: report.id,
              name: report.name,
              status: (report.status === 'APPROVED' ? 'FINAL' : report.status) as 'DRAFT' | 'FINAL',
              assessmentId: report.assessmentId,
              assessmentName: report.assessmentName,
              projectName: report.projectName,
              organizationName: report.organizationName,
              axisData: report.axisData,
              sections: (sections || []).map((s) => ({
                id: s.id,
                reportId: s.reportId,
                sectionType: s.sectionType,
                axisId: s.axisId,
                areaId: s.areaId,
                title: s.title,
                content: s.content,
                dataSnapshot: s.dataSnapshot,
                orderIndex: s.orderIndex,
                isAiGenerated: s.isAiGenerated,
                version: s.version || 1,
                updatedAt: s.updatedAt || new Date().toISOString(),
              })),
              templateId: report.templateId,
              createdAt: report.createdAt || new Date().toISOString(),
              updatedAt: report.updatedAt || new Date().toISOString(),
            }}
            readOnly={readOnly}
            focusSectionId={focusSectionId}
            onSectionUpdate={handleSectionUpdate}
            onSectionAdd={handleSectionAdd}
            onSectionDelete={handleSectionDelete}
            onSectionReorder={handleSectionReorder}
            onAIAction={handleAIAction}
            onFocusChange={handleFocusChange}
            onUnsavedChange={handleUnsavedChange}
          />
        </div>
      </div>

      {/* Comments toggle button */}
      {!showComments && (
        <button
          onClick={() => setShowComments(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl shadow-lg hover:shadow-xl transition-all"
          title={t('assessment.reportBuilder.showComments', 'Show comments')}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium">
            {t('assessment.reportBuilder.comments', 'Comments')}
          </span>
        </button>
      )}

      {/* Comments panel (slide-in from right) */}
      {showComments && (
        <div className="fixed top-0 right-0 bottom-0 w-[400px] z-40 bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 shadow-2xl flex flex-col">
          <ReportCommentPanel
            reportId={reportId}
            sectionId={activeSection || undefined}
            sectionName={
              activeSection
                ? sections?.find((s) => s.id === activeSection)?.title || undefined
                : undefined
            }
            onClose={() => setShowComments(false)}
            onRegenerateSection={
              activeSection
                ? (sectionId, feedback) => {
                    handleAIAction(sectionId, 'regenerate');
                  }
                : undefined
            }
          />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/30 rounded-lg p-4 flex items-start gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-danger-700 dark:text-danger-400">{error}</p>
            <button
              onClick={clearError}
              className="text-xs text-danger-600 dark:text-danger-400 hover:underline mt-1"
            >
              {t('assessment.reportBuilder.dismiss', 'Dismiss')}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Fullscreen overlay (portal-like modal over existing content)
  const fullscreenOverlay =
    isFullscreen && report ? (
      <div className="fixed inset-0 z-modal bg-slate-50 dark:bg-navy-950 flex">
        {/* Chat sidebar - left */}
        {showChat && (
          <div className="w-96 shadow-sm flex flex-col bg-white dark:bg-navy-900 flex-shrink-0">
            <div className="p-4 border-b border-slate-200 dark:border-navy-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary-500" />
                <span className="font-semibold text-navy-900 dark:text-white">
                  {t('assessment.reportBuilder.aiChat', 'AI Chat')}
                </span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                title={t('assessment.reportBuilder.hideChat', 'Hide chat')}
              >
                <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <UnifiedChatPanel
                mode="split"
                customMessages={activeChatMessages}
                onMessageSent={(text: string) => {
                  addChatMessage({
                    id: `user-${Date.now()}`,
                    role: 'user',
                    content: text,
                    timestamp: new Date(),
                  });
                }}
                showModeToggle={false}
                showHistoryTrigger={false}
                showFocusMode={false}
                title={t('assessment.reportBuilder.aiChat', 'AI Chat')}
              />
            </div>
          </div>
        )}

        {/* Main report area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Show chat toggle if hidden */}
          {!showChat && (
            <div className="absolute top-4 left-4 z-10">
              <button
                onClick={() => setShowChat(true)}
                className="flex items-center gap-2 px-3 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg shadow-lg transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {t('assessment.reportBuilder.showChat', 'Show chat')}
                </span>
              </button>
            </div>
          )}

          {/* Report content - uses the same reportContent which has the ReportHeader */}
          <div className="flex-1 overflow-auto">{reportContent}</div>
        </div>
      </div>
    ) : null;

  // Normal mode - fullscreen button is now in the ReportHeader
  return (
    <>
      {fullscreenOverlay}
      <SplitLayout
        title={
          <span className="flex items-center gap-2">
            <span>{report.name}</span>
            {report.status === 'FINAL' && (
              <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full">
                {t('assessment.reportBuilder.statusFinal', 'Final')}
              </span>
            )}
          </span>
        }
        subtitle={t('assessment.reportBuilder.editorTitle', 'DRD Report Editor')}
        hideSidebar={true}
      >
        {reportContent}
      </SplitLayout>
    </>
  );
};

export default ReportBuilderWorkspace;

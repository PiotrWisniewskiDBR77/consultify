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

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { SplitLayout } from '../SplitLayout';
import { ReportBuilder } from '../Reports/ReportBuilder';
import { TableOfContents } from '../Reports/TableOfContents';
import { ReportHeader } from '../Reports/ReportHeader';
import { StickyNavigation } from '../Reports/StickyNavigation';
import { ChatPanel } from '../ChatPanel';
import { useReportSections, type AIAction } from '../../hooks/useReportSections';
import { useAppStore } from '../../store/useAppStore';
import { Loader2, FileWarning, RefreshCw, Sparkles, AlertCircle, Maximize2, Minimize2, MessageSquare, X } from 'lucide-react';

interface ReportBuilderWorkspaceProps {
    reportId: string;
    onClose: () => void;
}

export const ReportBuilderWorkspace: React.FC<ReportBuilderWorkspaceProps> = ({
    reportId,
    onClose
}) => {
    const { t, i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';
    
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
        exportPdf,
        exportExcel,
        setActiveSection,
        clearError,
        markChangesSaved
    } = useReportSections(reportId);

    // Local state
    const [focusSectionId, setFocusSectionId] = useState<string | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isReadingMode, setIsReadingMode] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showChat, setShowChat] = useState(true);

    // Memoize section info for StickyNavigation
    const sectionInfos = useMemo(() => {
        if (!sections) return [];
        return sections.map(s => ({
            id: s.id,
            title: s.title,
            sectionType: s.sectionType,
            orderIndex: s.orderIndex
        }));
    }, [sections]);

    // Handle section update from ReportBuilder
    const handleSectionUpdate = useCallback(async (sectionId: string, content: string, title?: string) => {
        const success = await updateSection(sectionId, content, title);
        if (success) {
            toast.success(isPolish ? 'Sekcja zapisana' : 'Section saved');
        } else {
            toast.error(isPolish ? 'Błąd zapisu sekcji' : 'Failed to save section');
        }
    }, [updateSection, isPolish]);

    // Handle section add
    const handleSectionAdd = useCallback(async (sectionType: string, afterIndex: number) => {
        const newSection = await addSection(sectionType as any, {
            orderIndex: afterIndex + 1
        });
        if (newSection) {
            toast.success(isPolish ? 'Sekcja dodana' : 'Section added');
            setFocusSectionId(newSection.id);
        }
        return newSection;
    }, [addSection, isPolish]);

    // Handle section delete
    const handleSectionDelete = useCallback(async (sectionId: string) => {
        const success = await deleteSection(sectionId);
        if (success) {
            toast.success(isPolish ? 'Sekcja usunięta' : 'Section deleted');
        } else {
            toast.error(isPolish ? 'Błąd usuwania sekcji' : 'Failed to delete section');
        }
    }, [deleteSection, isPolish]);

    // Handle section reorder
    const handleSectionReorder = useCallback(async (newOrder: { id: string; orderIndex: number }[]) => {
        const sectionIds = newOrder.sort((a, b) => a.orderIndex - b.orderIndex).map(o => o.id);
        const success = await reorderSections(sectionIds);
        if (!success) {
            toast.error(isPolish ? 'Błąd zmiany kolejności' : 'Failed to reorder sections');
        }
    }, [reorderSections, isPolish]);

    // Handle AI action on section
    const handleAIAction = useCallback(async (sectionId: string, action: string) => {
        toast.loading(isPolish ? 'AI przetwarza...' : 'AI processing...', { id: 'ai-action' });
        
        const success = await aiAction(sectionId, action as AIAction);
        
        if (success) {
            toast.success(isPolish ? 'Sekcja zaktualizowana przez AI' : 'Section updated by AI', { id: 'ai-action' });
        } else {
            toast.error(isPolish ? 'AI nie mogło przetworzyć sekcji' : 'AI failed to process section', { id: 'ai-action' });
        }
    }, [aiAction, isPolish]);

    // Handle save
    const handleSave = useCallback(() => {
        // Sections are auto-saved, this just marks them as saved
        markChangesSaved();
        toast.success(isPolish ? 'Raport zapisany' : 'Report saved');
    }, [markChangesSaved, isPolish]);

    // Handle finalize
    const handleFinalize = useCallback(async () => {
        const confirmed = window.confirm(
            isPolish 
                ? 'Czy na pewno chcesz sfinalizować raport? Po finalizacji nie będzie można go edytować.'
                : 'Are you sure you want to finalize this report? It cannot be edited after finalization.'
        );
        
        if (!confirmed) return;
        
        setIsFinalizing(true);
        const success = await finalizeReport();
        setIsFinalizing(false);
        
        if (success) {
            toast.success(isPolish ? 'Raport sfinalizowany' : 'Report finalized');
        } else {
            toast.error(isPolish ? 'Błąd finalizacji raportu' : 'Failed to finalize report');
        }
    }, [finalizeReport, isPolish]);

    // Handle regenerate
    const handleRegenerate = useCallback(async () => {
        const confirmed = window.confirm(
            isPolish 
                ? 'Czy na pewno chcesz wygenerować raport od nowa? Wszystkie edycje zostaną utracone.'
                : 'Are you sure you want to regenerate the report? All edits will be lost.'
        );
        
        if (!confirmed) return;
        
        setIsRegenerating(true);
        toast.loading(isPolish ? 'Generowanie raportu...' : 'Generating report...', { id: 'regenerate' });
        
        const success = await regenerateReport();
        setIsRegenerating(false);
        
        if (success) {
            toast.success(isPolish ? 'Raport wygenerowany' : 'Report regenerated', { id: 'regenerate' });
        } else {
            toast.error(isPolish ? 'Błąd generowania raportu' : 'Failed to regenerate report', { id: 'regenerate' });
        }
    }, [regenerateReport, isPolish]);

    // Handle export PDF
    const handleExportPdf = useCallback(async () => {
        toast.loading(isPolish ? 'Eksportowanie PDF...' : 'Exporting PDF...', { id: 'export-pdf' });
        await exportPdf();
        toast.success(isPolish ? 'PDF pobrany' : 'PDF downloaded', { id: 'export-pdf' });
    }, [exportPdf, isPolish]);

    // Handle export Excel
    const handleExportExcel = useCallback(async () => {
        toast.loading(isPolish ? 'Eksportowanie Excel...' : 'Exporting Excel...', { id: 'export-excel' });
        await exportExcel();
        toast.success(isPolish ? 'Excel pobrany' : 'Excel downloaded', { id: 'export-excel' });
    }, [exportExcel, isPolish]);

    // Handle TOC section click
    const handleTocSectionClick = useCallback((sectionId: string) => {
        setFocusSectionId(sectionId);
        setActiveSection(sectionId);
    }, [setActiveSection]);

    // Handle focus change from ReportBuilder
    const handleFocusChange = useCallback((sectionId: string | null) => {
        setActiveSection(sectionId);
    }, [setActiveSection]);

    // Handle unsaved change
    const handleUnsavedChange = useCallback((hasChanges: boolean) => {
        // This is tracked by the hook
    }, []);

    // Handle sticky nav section click
    const handleStickySectionClick = useCallback((sectionId: string) => {
        setFocusSectionId(sectionId);
        setActiveSection(sectionId);
        // Scroll to section
        const element = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [setActiveSection]);

    // Toggle reading mode
    const handleToggleReadingMode = useCallback(() => {
        setIsReadingMode(prev => !prev);
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
            const text = lastMessage.text.toLowerCase();
            const isEditCommand = 
                text.includes('rozwiń') || text.includes('expand') ||
                text.includes('skróć') || text.includes('summarize') ||
                text.includes('ulepsz') || text.includes('improve') ||
                text.includes('przetłumacz') || text.includes('translate') ||
                text.includes('regeneruj') || text.includes('regenerate');

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
                    addChatMessage({
                        role: 'assistant',
                        text: isPolish 
                            ? `Wykonuję akcję "${action}" na wybranej sekcji...`
                            : `Executing "${action}" on the selected section...`
                    });
                    setIsBotTyping(false);
                }, 500);
            }
        }
    }, [activeChatMessages, activeSection, handleAIAction, addChatMessage, setIsBotTyping, isPolish]);

    // Loading state
    if (isLoading && !report) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-400">
                        {isPolish ? 'Ładowanie raportu...' : 'Loading report...'}
                    </p>
                </div>
            </div>
        );
    }

    // Error state
    if (error && !report) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
                <div className="text-center max-w-md px-6">
                    <FileWarning className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-2">
                        {isPolish ? 'Błąd ładowania raportu' : 'Error loading report'}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        {error}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                        >
                            {isPolish ? 'Wróć' : 'Go back'}
                        </button>
                        <button
                            onClick={() => { clearError(); fetchReport(); }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {isPolish ? 'Spróbuj ponownie' : 'Try again'}
                        </button>
                    </div>
                </div>
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
                        <Sparkles className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-2">
                            {isPolish ? 'Raport jest pusty' : 'Report is empty'}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            {isPolish 
                                ? 'Ten raport nie ma jeszcze sekcji. Wygeneruj raport, aby rozpocząć.'
                                : 'This report has no sections yet. Generate the report to get started.'}
                        </p>
                        <button
                            onClick={handleRegenerate}
                            disabled={isRegenerating}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                        >
                            {isRegenerating ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Sparkles className="w-5 h-5" />
                            )}
                            {isPolish ? 'Generuj raport z AI' : 'Generate report with AI'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Main workspace
    if (!report) return null;

    const readOnly = report.status !== 'DRAFT';

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
                            sections={(sections || []).map(s => ({
                                id: s.id,
                                sectionType: s.sectionType,
                                axisId: s.axisId,
                                title: s.title,
                                isAiGenerated: s.isAiGenerated,
                                orderIndex: s.orderIndex
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
                            status: report.status,
                            assessmentId: report.assessmentId,
                            assessmentName: report.assessmentName,
                            projectName: report.projectName,
                            organizationName: report.organizationName,
                            axisData: report.axisData,
                            sections: (sections || []).map(s => ({
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
                                updatedAt: s.updatedAt || new Date().toISOString()
                            })),
                            templateId: report.templateId,
                            createdAt: report.createdAt || new Date().toISOString(),
                            updatedAt: report.updatedAt || new Date().toISOString()
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

            {/* Error banner */}
            {error && (
                <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 flex items-start gap-3 shadow-lg">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                        <button
                            onClick={clearError}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1"
                        >
                            {isPolish ? 'Zamknij' : 'Dismiss'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    // Fullscreen overlay (portal-like modal over existing content)
    const fullscreenOverlay = isFullscreen && report ? (
        <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-navy-950 flex">
            {/* Chat sidebar - left */}
            {showChat && (
                <div className="w-96 border-r border-slate-200 dark:border-white/10 flex flex-col bg-white dark:bg-navy-900 flex-shrink-0">
                    <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-purple-500" />
                            <span className="font-semibold text-navy-900 dark:text-white">
                                {isPolish ? 'Czat AI' : 'AI Chat'}
                            </span>
                        </div>
                        <button
                            onClick={() => setShowChat(false)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                            title={isPolish ? 'Ukryj czat' : 'Hide chat'}
                        >
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <ChatPanel
                            messages={activeChatMessages}
                            onSendMessage={(text) => {
                                addChatMessage({ role: 'user', text });
                            }}
                            onOptionSelect={() => {}}
                            isTyping={isBotTyping}
                            title={isPolish ? 'Czat AI' : 'AI Chat'}
                            subtitle={isPolish ? 'Edytuj raport przez czat' : 'Edit report via chat'}
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
                            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg transition-colors"
                        >
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-sm font-medium">{isPolish ? 'Pokaż czat' : 'Show chat'}</span>
                        </button>
                    </div>
                )}

                {/* Report content - uses the same reportContent which has the ReportHeader */}
                <div className="flex-1 overflow-auto">
                    {reportContent}
                </div>
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
                                {isPolish ? 'Finalny' : 'Final'}
                            </span>
                        )}
                    </span>
                }
                subtitle={isPolish ? 'Edytor Raportu DRD' : 'DRD Report Editor'}
                hideSidebar={true}
            >
                {reportContent}
            </SplitLayout>
        </>
    );
};

export default ReportBuilderWorkspace;


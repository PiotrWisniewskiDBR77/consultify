import {
  CheckCircle,
  ChevronLeft,
  Download,
  FileText,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  RefreshCw,
  Save,
  Settings,
  Wand2,
  X,
} from 'lucide-react';
import { Send, User } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { InitiativeSuggestionBadge } from '@/components/Initiatives/InitiativeSuggestionBadge';
import { api } from '@/services/api';
import {
  areaScoresFromAxisData,
  openDrdReportForPrint,
  openHtmlForPrint,
} from '@/services/report/drdReportClient';

import { ReportBuilder } from '../components/Reports/ReportBuilder';
import TeresaMark from '../components/shared/TeresaMark';
import { useAppStore } from '../store/useAppStore';
// Types
interface ReportSection {
  id: string;
  reportId: string;
  sectionType: string;
  axisId?: string;
  areaId?: string;
  title: string;
  content: string;
  dataSnapshot: Record<string, unknown>;
  orderIndex: number;
  isAiGenerated: boolean;
  version: number;
  updatedAt: string;
}

interface FullReport {
  id: string;
  name: string;
  status: 'DRAFT' | 'FINAL';
  assessmentId: string;
  assessmentName?: string;
  projectName?: string;
  organizationName?: string;
  axisData: Record<string, { actual?: number; target?: number; justification?: string }>;
  sections: ReportSection[];
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

// Simple inline chat panel for the report builder
interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface ReportChatPanelProps {
  onSendMessage: (text: string) => Promise<void>;
  onClose: () => void;
  focusSectionTitle?: string;
}

const ReportChatPanel: React.FC<ReportChatPanelProps> = ({
  onSendMessage,
  onClose,
  focusSectionTitle,
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      await onSendMessage(userMessage.content);
      // The parent component will handle the AI response
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: t('reports.aiThinking', 'Processing your request...'),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: t('reports.aiError', 'Sorry, I could not process your request.'),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-96 border-l border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
        <div>
          <h3 className="font-medium text-navy-900 dark:text-white">
            {t('reports.aiAssistant', 'AI Report Assistant')}
          </h3>
          {focusSectionTitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('reports.focusedOn', 'Focused on')}: {focusSectionTitle}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label={t('common.close', 'Close')}
          className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 dark:text-slate-400 text-sm py-8">
            <TeresaMark className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>{t('reports.chatWelcome', 'Hi! I can help you edit and improve your report.')}</p>
            <p className="mt-2 text-xs">
              {t(
                'reports.chatExamples',
                'Try: "Expand the executive summary" or "Make it more formal"'
              )}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'ai' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                <TeresaMark className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-white/5 text-navy-900 dark:text-white'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <TeresaMark className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-100 dark:bg-white/5 rounded-xl px-4 py-2">
              <div className="flex gap-1">
                <span
                  className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-navy-700">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('reports.chatPlaceholder', 'Ask me to edit or improve any section...')}
            rows={1}
            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            aria-label={t('common.send', 'Send')}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface DRDAuditReportViewProps {
  reportId?: string;
}

export const DRDAuditReportView: React.FC<DRDAuditReportViewProps> = ({
  reportId: propReportId,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { addChatMessage, setIsBotTyping, currentReportId, setCurrentReport } = useAppStore();

  // Use prop reportId first, then store reportId
  const reportId = propReportId || currentReportId;

  // State
  const [report, setReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch report data
  const fetchReport = useCallback(async () => {
    if (!reportId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.getFullReport(reportId);
      setReport(data);
    } catch (err) {
      console.error('Failed to fetch report:', err);
      setError(t('reports.errorLoading', 'Failed to load report'));
    } finally {
      setLoading(false);
    }
  }, [reportId, t]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Generate full report from template
  const handleGenerateReport = async () => {
    if (!reportId) return;

    setGenerating(true);
    try {
      await api.generateReport(reportId, { language: 'pl' });
      await fetchReport();
      addChatMessage({
        id: Date.now().toString(),
        role: 'ai',
        content: t(
          'reports.generated',
          'Report has been generated with all sections. You can now edit each section individually.'
        ),
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('Failed to generate report:', err);
      setError(t('reports.generateError', 'Failed to generate report'));
    } finally {
      setGenerating(false);
    }
  };

  // Update section content
  const handleSectionUpdate = async (sectionId: string, content: string, title?: string) => {
    if (!reportId) return;

    setSaving(true);
    try {
      await api.updateReportSection(reportId, sectionId, { content, title });

      // Update local state
      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId
              ? { ...s, content, title: title || s.title, isAiGenerated: false }
              : s
          ),
        };
      });
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to update section:', err);
    } finally {
      setSaving(false);
    }
  };

  // AI action on section
  const handleAIAction = async (sectionId: string, action: string) => {
    if (!reportId) return;

    setSaving(true);
    try {
      const result = await api.aiSectionAction(reportId, sectionId, { action });

      // Update local state with AI-generated content
      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId ? { ...s, content: result.content, isAiGenerated: true } : s
          ),
        };
      });

      addChatMessage({
        id: Date.now().toString(),
        role: 'ai',
        content: t(
          'reports.aiActionComplete',
          `AI has ${action}ed the section "${report?.sections.find((s) => s.id === sectionId)?.title}".`
        ),
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('AI action failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // Reorder sections
  const handleReorderSections = async (newOrder: { id: string; orderIndex: number }[]) => {
    if (!reportId) return;

    try {
      await api.reorderReportSections(reportId, newOrder);

      // Update local state
      setReport((prev) => {
        if (!prev) return prev;
        const reorderedSections = [...prev.sections];
        newOrder.forEach(({ id, orderIndex }) => {
          const section = reorderedSections.find((s) => s.id === id);
          if (section) section.orderIndex = orderIndex;
        });
        reorderedSections.sort((a, b) => a.orderIndex - b.orderIndex);
        return { ...prev, sections: reorderedSections };
      });
    } catch (err) {
      console.error('Failed to reorder sections:', err);
    }
  };

  // Add new section
  const handleAddSection = async (sectionType: string, afterIndex: number) => {
    if (!reportId) return;

    try {
      const result = await api.addReportSection(reportId, {
        sectionType,
        orderIndex: afterIndex + 1,
      });

      // Refresh report to get updated sections
      await fetchReport();
      return result;
    } catch (err) {
      console.error('Failed to add section:', err);
    }
  };

  // Delete section
  const handleDeleteSection = async (sectionId: string) => {
    if (!reportId) return;

    try {
      await api.deleteReportSection(reportId, sectionId);

      // Update local state
      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.filter((s) => s.id !== sectionId),
        };
      });
    } catch (err) {
      console.error('Failed to delete section:', err);
    }
  };

  // Export to PDF
  // Contract fix (2026-07-26): the endpoint (GET /assessment-reports/:id/export/pdf)
  // streams the PDF bytes directly (`Content-Type: application/pdf`, `res.sendFile`)
  // — it does NOT return `{ pdfUrl }`. `api.exportReportPDF` already reflects this
  // (returns a `Blob`); the view previously destructured a non-existent `pdfUrl`
  // field, which produced a silently broken download (`href="undefined"`).
  const handleExportPDF = async () => {
    if (!reportId) return;

    try {
      const blob = await api.exportReportPDF(reportId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report?.name || 'report'}_DRD_Audit.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    }
  };

  // Generate the publishing-grade DRD client report (HTML → print → PDF).
  // Numbers-from-engine: derived from the report's per-axis assessment data.
  const handleGenerateClientReport = async () => {
    if (!report || !reportId) return;
    const lang = (i18n.language === 'en' ? 'en' : 'pl') as 'pl' | 'en';
    // Prefer the server route: it wires the live LLM narrator (AI-authored
    // executive summary + narratives) with a deterministic fallback. If it is
    // unavailable, fall back to the fully client-side generator (deterministic).
    try {
      const { html } = await api.getDrdReportHtml(reportId, { lang });
      openHtmlForPrint(html, { autoPrint: false });
      return;
    } catch (err) {
      console.warn('DRD server report unavailable, falling back to client generator:', err);
    }
    try {
      const areaScores = areaScoresFromAxisData(report.axisData || {});
      await openDrdReportForPrint(
        areaScores,
        {
          organizationName: report.organizationName || report.name || 'Organizacja',
          language: lang,
          assessmentName: report.assessmentName,
        },
        { autoPrint: false }
      );
    } catch (err) {
      console.error('Failed to generate DRD client report:', err);
    }
  };

  // Finalize report
  const handleFinalize = async () => {
    if (!reportId || !report || report.status === 'FINAL') return;

    const confirmed = window.confirm(
      t(
        'reports.finalizeConfirm',
        'Are you sure you want to finalize this report? This action cannot be undone.'
      )
    );

    if (!confirmed) return;

    try {
      await api.finalizeReport(reportId);
      setReport((prev) => (prev ? { ...prev, status: 'FINAL' } : prev));
    } catch (err) {
      console.error('Failed to finalize report:', err);
    }
  };

  // AI Chat handler
  const handleAiChat = async (text: string) => {
    addChatMessage({
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    });
    setIsBotTyping(true);

    try {
      const result = await api.aiEditReport(reportId!, { message: text, focusSectionId });

      addChatMessage({
        id: Date.now().toString(),
        role: 'ai',
        content: result.message,
        timestamp: new Date(),
      });

      // If AI identified a section to edit, offer to apply changes
      if (result.interpretation?.targetSection) {
        setFocusSectionId(result.interpretation.targetSection);
      }
    } catch (err) {
      addChatMessage({
        id: Date.now().toString(),
        role: 'ai',
        content: t('reports.aiError', 'Sorry, I could not process your request. Please try again.'),
        timestamp: new Date(),
      });
    } finally {
      setIsBotTyping(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-navy-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-slate-500 dark:text-slate-400">{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-navy-950">
        <div className="text-center max-w-md p-8 bg-white dark:bg-navy-900 rounded-xl border border-danger-200 dark:border-danger-500/20">
          <p className="text-danger-500 mb-4">{error}</p>
          <button
            onClick={fetchReport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  // Empty report state - offer to generate
  if (report && (!report.sections || report.sections.length === 0)) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setCurrentReport(null, 'view');
                // Contract fix (2026-07-26): this view no longer lives behind the
                // legacy AppView.FULL_STEP6_REPORTS surface — it's mounted as a
                // real route under Audits (/audit-programs/drd-report/:reportId).
                // Back must return there, not to the unrelated Report Builder.
                navigate('/audit-programs');
              }}
              aria-label={t('common.back', 'Back')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-navy-900 dark:text-white">{report.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {report.organizationName} • {report.assessmentName}
              </p>
            </div>
          </div>
        </div>

        {/* Generate prompt */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-lg text-center">
            <FileText className="w-16 h-16 mx-auto mb-6 text-slate-600 dark:text-slate-400" />
            <h2 className="text-2xl font-bold mb-4 text-navy-900 dark:text-white">
              {t('reports.emptyReport', 'Report is empty')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">
              {t(
                'reports.generatePrompt',
                'Generate a complete DRD audit report based on the assessment data. The report will include all 7 axes, gap analysis, and recommendations.'
              )}
            </p>
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('reports.generating', 'Generating...')}
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  {t('reports.generateReport', 'Generate Full Report')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      // The only stable marker on this surface: the whole view previously had
      // zero data-testid and no ARIA role, so a browser gate could identify it
      // only by translated literal text. Added while proving the DRD report
      // route in the UI-CANON G4 Audits sweep.
      data-testid="drd-audit-report"
      className={`flex flex-col h-full bg-slate-50 dark:bg-navy-950 ${fullScreen ? 'fixed inset-0 z-50' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setCurrentReport(null, 'view');
              // See contract-fix note above (empty-report header) — back goes to
              // the real host route, not the legacy AppView.
              navigate('/audit-programs');
            }}
            aria-label={t('common.back', 'Back')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-navy-900 dark:text-white">
                {report?.name}
              </h1>
              {report?.status === 'FINAL' && (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full">
                  {t('reports.finalized', 'Finalized')}
                </span>
              )}
              {hasUnsavedChanges && (
                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded-full">
                  {t('reports.unsaved', 'Unsaved')}
                </span>
              )}
              {reportId && <InitiativeSuggestionBadge sourceType="audit" sourceId={reportId} />}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {report?.organizationName} • {report?.sections.length}{' '}
              {t('reports.sections', 'sections')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saving && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.saving', 'Saving...')}
            </div>
          )}

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`p-2 rounded-lg transition-colors ${
              chatOpen
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600'
                : 'hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
            title={t('reports.toggleChat', 'Toggle AI Chat')}
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            onClick={() => setFullScreen(!fullScreen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            title={
              fullScreen
                ? t('common.exitFullscreen', 'Exit Fullscreen')
                : t('common.fullscreen', 'Fullscreen')
            }
          >
            {fullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />

          <button
            onClick={handleGenerateReport}
            disabled={generating || report?.status === 'FINAL'}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
            title={t('reports.regenerate', 'Regenerate Report')}
          >
            <RefreshCw className={`w-5 h-5 ${generating ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleGenerateClientReport}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors text-sm font-medium"
            title={t('reports.generateClientReport', 'Generate DRD client report (print/PDF)')}
          >
            <FileText className="w-4 h-4" />
            {t('reports.clientReport', 'Raport DRD')}
          </button>

          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>

          {report?.status === 'DRAFT' && (
            <button
              onClick={handleFinalize}
              // `bg-green-600` (#16a34a) only clears ~3.3:1 against white text —
              // under the 4.5:1 AA floor (axe color-contrast, serious). The
              // `--c-success` token was tried first, but it flips lightness
              // per theme (a bright, foreground-only green in dark mode) and
              // fails as a solid white-text fill there (~2.5:1). Using
              // `green-700` instead — already this button's own hover shade —
              // is a static hex (same in both themes) that clears AA on its
              // own (white text ~5.0:1); the hover state steps one shade
              // darker (`green-800`, ~7.1:1) instead of repeating green-700.
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <CheckCircle className="w-4 h-4" />
              {t('reports.finalize', 'Finalize')}
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Report Builder */}
        <div className={`flex-1 overflow-auto ${chatOpen ? 'pr-0' : ''}`}>
          {report && (
            <ReportBuilder
              report={report}
              readOnly={report.status === 'FINAL'}
              focusSectionId={focusSectionId}
              onSectionUpdate={handleSectionUpdate}
              onSectionAdd={handleAddSection}
              onSectionDelete={handleDeleteSection}
              onSectionReorder={handleReorderSections}
              onAIAction={handleAIAction}
              onFocusChange={setFocusSectionId}
              onUnsavedChange={setHasUnsavedChanges}
            />
          )}
        </div>

        {/* AI Chat Panel */}
        {chatOpen && (
          <ReportChatPanel
            onSendMessage={handleAiChat}
            onClose={() => setChatOpen(false)}
            focusSectionTitle={
              focusSectionId
                ? report?.sections.find((s) => s.id === focusSectionId)?.title
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
};

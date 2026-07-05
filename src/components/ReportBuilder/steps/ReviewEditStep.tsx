/**
 * ReviewEditStep
 *
 * Step 4: Review and edit generated content. Finalize the report.
 */

import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import { ExportSharePanel } from '../ExportSharePanel';
import type { Report, ReportSection } from '../useReportBuilder';
import { AssessmentMatrix, type AssessmentMatrixData } from '../visuals/AssessmentMatrix';

// ==========================================
// TYPES
// ==========================================

interface ShareLink {
  id: string;
  token: string;
  url: string;
  hasPassword: boolean;
  expiresAt?: string;
  viewCount: number;
  createdAt: string;
}

interface ReviewEditStepProps {
  report: Report | null;
  sections: ReportSection[];
  onUpdateContent: (sectionKey: string, content: string) => Promise<void>;
  onRegenerateSection: (sectionKey: string, customPrompt?: string) => Promise<void>;
  onFinalize: () => Promise<void>;
  onApprove?: () => Promise<void>;
  onSendBack?: () => Promise<void>;
  onMarkSentInternal?: () => Promise<void>;
  onMarkSentExternal?: () => Promise<void>;
  onExportPdf?: () => Promise<void>;
  onCreateShareLink?: (options?: {
    password?: string;
    expiresInDays?: number;
    showCompanyLogo?: boolean;
    showConsultifyBranding?: boolean;
    customMessage?: string;
  }) => Promise<{
    id: string;
    token: string;
    url: string;
    hasPassword: boolean;
    expiresAt?: string;
  } | null>;
  onGetShareLinks?: () => Promise<ShareLink[] | null>;
  onRevokeShareLink?: (linkId: string) => Promise<boolean>;
  isLoading: boolean;
}

// ==========================================
// SECTION EDITOR
// ==========================================

interface SectionEditorProps {
  section: ReportSection;
  onSave: (content: string) => Promise<void>;
  onRegenerate: (customPrompt?: string) => Promise<void>;
  isPl: boolean;
}

const SectionEditor: React.FC<SectionEditorProps> = ({ section, onSave, onRegenerate, isPl }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');

  // Get current content (edited takes precedence)
  const currentContent = section.editedContent || section.generatedContent || '';

  const maybeMatrixData = (() => {
    const wantsMatrix = section.sectionType === 'matrix' || section.renderKind === 'matrix';
    if (!wantsMatrix) return null;
    try {
      const parsed = JSON.parse(currentContent || '{}') as AssessmentMatrixData;
      if (parsed && (parsed as any).type === 'assessment_matrix') return parsed;
      return null;
    } catch {
      return null;
    }
  })();

  // Start editing
  const handleStartEdit = useCallback(() => {
    setEditContent(currentContent);
    setIsEditing(true);
  }, [currentContent]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent('');
  }, []);

  // Save edited content
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(editContent);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [editContent, onSave]);

  // Regenerate section
  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate(regeneratePrompt || undefined);
      setShowRegeneratePrompt(false);
      setRegeneratePrompt('');
    } finally {
      setIsRegenerating(false);
    }
  }, [onRegenerate, regeneratePrompt]);

  // Copy content
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(currentContent);
  }, [currentContent]);

  return (
    <div className="border border-c-border-subtle rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 bg-c-surface-raised cursor-pointer"
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-c-text-secondary" />
          ) : (
            <ChevronRight className="w-5 h-5 text-c-text-secondary" />
          )}
          <div>
            <h4 className="font-medium text-c-text">{section.title}</h4>
            <div className="text-xs text-c-text-secondary flex items-center gap-2 mt-0.5">
              <span>
                {section.length} • {section.language}
              </span>
              {section.editedContent && (
                <span className="text-blue-500 flex items-center gap-1">
                  <Edit3 className="w-3 h-3" />
                  {isPl ? 'Edytowane' : 'Edited'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {!isEditing && (
            <>
              <button
                onClick={handleCopy}
                className="p-2 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface rounded"
                title={isPl ? 'Kopiuj' : 'Copy'}
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowRegeneratePrompt(true)}
                disabled={isRegenerating}
                className="flex items-center gap-1 px-2 py-1.5 text-sm text-c-text-secondary hover:bg-c-surface rounded"
              >
                {isRegenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isPl ? 'Regeneruj' : 'Regenerate'}
              </button>
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-c-text rounded hover:bg-blue-700"
              >
                <Edit3 className="w-4 h-4" />
                {isPl ? 'Edytuj' : 'Edit'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {isEditing ? (
            <div className="space-y-4">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-64 p-4 border border-c-border-subtle rounded-lg bg-c-surface text-c-text font-mono text-sm focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised rounded-lg"
                >
                  {isPl ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-c-text rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isPl ? 'Zapisz' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {maybeMatrixData ? (
                <AssessmentMatrix data={maybeMatrixData} />
              ) : (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown>{currentContent || '*No content generated*'}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Regenerate Prompt Modal */}
      {showRegeneratePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-c-surface rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-c-border-subtle">
              <h3 className="font-semibold text-c-text flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                {isPl ? 'Regeneruj Sekcję' : 'Regenerate Section'}
              </h3>
              <button
                onClick={() => setShowRegeneratePrompt(false)}
                className="text-c-text-secondary hover:text-c-text-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-c-text mb-1">
                  {isPl ? 'Dodatkowe Wskazówki (opcjonalnie)' : 'Additional Guidance (optional)'}
                </label>
                <textarea
                  value={regeneratePrompt}
                  onChange={(e) => setRegeneratePrompt(e.target.value)}
                  placeholder={
                    isPl
                      ? 'Np. "Użyj bardziej formalnego języka", "Dodaj więcej szczegółów technicznych"...'
                      : 'E.g., "Use more formal language", "Add more technical details"...'
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-c-border-subtle rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-c-border-subtle">
              <button
                onClick={() => setShowRegeneratePrompt(false)}
                className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised rounded-lg"
              >
                {isPl ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-c-text rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isRegenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isPl ? 'Regeneruj' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const ReviewEditStep: React.FC<ReviewEditStepProps> = ({
  report,
  sections,
  onUpdateContent,
  onRegenerateSection,
  onFinalize,
  onApprove,
  onSendBack,
  onMarkSentInternal,
  onMarkSentExternal,
  onExportPdf,
  onCreateShareLink,
  onGetShareLinks,
  onRevokeShareLink,
  isLoading,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  // Get enabled sections sorted
  const enabledSections = useMemo(
    () => sections.filter((s) => s.enabled).sort((a, b) => a.orderIndex - b.orderIndex),
    [sections]
  );

  // Check if all sections have content
  const allSectionsReady = useMemo(
    () => enabledSections.every((s) => s.generatedContent || s.editedContent),
    [enabledSections]
  );

  // Render full preview
  const renderPreview = () => (
    <div className="bg-c-surface rounded-lg border border-c-border-subtle p-8 prose prose-slate dark:prose-invert max-w-none">
      {enabledSections.map((section) => (
        <div key={section.sectionKey} className="mb-8">
          <h2>{section.title}</h2>
          <ReactMarkdown>
            {section.editedContent || section.generatedContent || '*No content*'}
          </ReactMarkdown>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 p-1 bg-c-surface-raised rounded-lg">
          <button
            onClick={() => setViewMode('edit')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                viewMode === 'edit'
                  ? 'bg-c-surface text-c-text shadow'
                  : 'text-c-text-secondary hover:text-c-text'
              }
            `}
          >
            <Edit3 className="w-4 h-4" />
            {isPl ? 'Edycja' : 'Edit'}
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                viewMode === 'preview'
                  ? 'bg-c-surface text-c-text shadow'
                  : 'text-c-text-secondary hover:text-c-text'
              }
            `}
          >
            <Eye className="w-4 h-4" />
            {isPl ? 'Podgląd' : 'Preview'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Export & Share Panel */}
          {report && onExportPdf && onCreateShareLink && onGetShareLinks && onRevokeShareLink && (
            <ExportSharePanel
              reportId={report.id}
              reportTitle={report.title}
              reportStatus={report.status}
              onExportPdf={onExportPdf}
              onCreateShareLink={onCreateShareLink}
              onGetShareLinks={onGetShareLinks}
              onRevokeShareLink={onRevokeShareLink}
              isLoading={isLoading}
            />
          )}

          {/* Status Badge */}
          {report && (
            <div
              className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
              ${
                report.status === 'APPROVED'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : report.status === 'IN_REVIEW'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                    : report.status === 'SENT_INTERNAL'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : report.status === 'SENT_EXTERNAL'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              }
            `}
            >
              {report.status === 'APPROVED' && <CheckCircle2 className="w-4 h-4" />}
              {report.status === 'SENT_INTERNAL' && <Send className="w-4 h-4" />}
              {report.status === 'SENT_EXTERNAL' && <ArrowRight className="w-4 h-4" />}
              {report.status}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'edit' ? (
        <div className="space-y-4">
          {enabledSections.map((section) => (
            <SectionEditor
              key={section.sectionKey}
              section={section}
              onSave={(content) => onUpdateContent(section.sectionKey, content)}
              onRegenerate={(prompt) => onRegenerateSection(section.sectionKey, prompt)}
              isPl={isPl}
            />
          ))}
        </div>
      ) : (
        renderPreview()
      )}

      {/* Finalize Section */}
      {report?.status !== 'APPROVED' && report?.status !== 'IN_REVIEW' && (
        <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 dark:text-green-100">
                {isPl ? 'Gotowy do finalizacji?' : 'Ready to Finalize?'}
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {isPl
                  ? 'Po finalizacji raport przejdzie do statusu "W przeglądzie". Nadal będziesz mógł go edytować.'
                  : 'After finalizing, the report will move to "In Review" status. You can still edit it.'}
              </p>

              {!allSectionsReady && (
                <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-sm text-amber-700 dark:text-amber-300">
                  {isPl
                    ? 'Uwaga: Niektóre sekcje nie mają jeszcze treści.'
                    : 'Warning: Some sections do not have content yet.'}
                </div>
              )}

              <button
                onClick={onFinalize}
                disabled={isLoading}
                className="mt-4 flex items-center gap-2 px-6 py-2 bg-green-600 text-c-text rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {isPl ? 'Finalizuj Raport' : 'Finalize Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review actions */}
      {report?.status === 'IN_REVIEW' && (
        <div className="mt-8 p-6 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-yellow-700 dark:text-yellow-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                {isPl ? 'Weryfikacja' : 'In Review'}
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {isPl
                  ? 'Raport jest w weryfikacji. Możesz go zatwierdzić lub odesłać do poprawek.'
                  : 'This report is in review. You can approve it or send it back for changes.'}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {onSendBack && (
                  <button
                    onClick={onSendBack}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-lg border border-c-border-subtle bg-c-surface text-c-text hover:bg-c-surface-raised disabled:opacity-50"
                  >
                    {isPl ? 'Odeślij do poprawek' : 'Send back'}
                  </button>
                )}
                {onApprove && (
                  <button
                    onClick={onApprove}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-c-text hover:bg-green-700 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {isPl ? 'Zatwierdź' : 'Approve'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approved actions - Mark as sent internally */}
      {report?.status === 'APPROVED' && onMarkSentInternal && (
        <div className="mt-8 p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
                {isPl ? 'Raport zatwierdzony' : 'Report Approved'}
              </h3>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                {isPl
                  ? 'Raport został zatwierdzony. Oznacz jako wysłany wewnętrznie, gdy przekażesz go do zespołu.'
                  : 'Report has been approved. Mark as sent internally when you share it with the team.'}
              </p>

              <button
                onClick={onMarkSentInternal}
                disabled={isLoading}
                className="mt-4 flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-c-text hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isPl ? 'Oznacz jako wysłany wewnętrznie' : 'Mark as Sent Internally'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sent Internal actions - Mark as sent externally */}
      {report?.status === 'SENT_INTERNAL' && onMarkSentExternal && (
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Send className="w-6 h-6 text-blue-700 dark:text-blue-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                {isPl ? 'Wysłany wewnętrznie' : 'Sent Internally'}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {isPl
                  ? 'Raport został wysłany wewnętrznie. Oznacz jako wysłany zewnętrznie, gdy przekażesz go do klienta.'
                  : 'Report has been sent internally. Mark as sent externally when you share it with the client.'}
              </p>

              <button
                onClick={onMarkSentExternal}
                disabled={isLoading}
                className="mt-4 flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-c-text hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                {isPl ? 'Oznacz jako wysłany zewnętrznie' : 'Mark as Sent Externally'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sent External - Final status info */}
      {report?.status === 'SENT_EXTERNAL' && (
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <ArrowRight className="w-6 h-6 text-blue-700 dark:text-blue-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                {isPl ? 'Wysłany zewnętrznie' : 'Sent Externally'}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {isPl
                  ? 'Raport został wysłany do klienta. Cykl życia raportu został zakończony.'
                  : 'Report has been sent to the client. The report lifecycle is complete.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewEditStep;

/**
 * ReviewEditStep
 *
 * Step 4: Review and edit generated content. Finalize the report.
 */

import {
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
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import type { Report, ReportSection } from '../useReportBuilder';

// ==========================================
// TYPES
// ==========================================

interface ReviewEditStepProps {
  report: Report | null;
  sections: ReportSection[];
  onUpdateContent: (sectionKey: string, content: string) => Promise<void>;
  onRegenerateSection: (sectionKey: string, customPrompt?: string) => Promise<void>;
  onFinalize: () => Promise<void>;
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
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 cursor-pointer"
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
          <div>
            <h4 className="font-medium text-slate-900 dark:text-white">{section.title}</h4>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
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
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-slate-700 rounded"
                title={isPl ? 'Kopiuj' : 'Copy'}
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowRegeneratePrompt(true)}
                disabled={isRegenerating}
                className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-white dark:hover:bg-slate-700 rounded"
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
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
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
                className="w-full h-64 p-4 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  {isPl ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown>{currentContent || '*No content generated*'}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Regenerate Prompt Modal */}
      {showRegeneratePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                {isPl ? 'Regeneruj Sekcję' : 'Regenerate Section'}
              </h3>
              <button
                onClick={() => setShowRegeneratePrompt(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowRegeneratePrompt(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                {isPl ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
    <div className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-slate-700 p-8 prose prose-slate dark:prose-invert max-w-none">
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
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            onClick={() => setViewMode('edit')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                viewMode === 'edit'
                  ? 'bg-white dark:bg-navy-900 text-slate-900 dark:text-white shadow'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
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
                  ? 'bg-white dark:bg-navy-900 text-slate-900 dark:text-white shadow'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }
            `}
          >
            <Eye className="w-4 h-4" />
            {isPl ? 'Podgląd' : 'Preview'}
          </button>
        </div>

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
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            }
          `}
          >
            {report.status === 'APPROVED' && <CheckCircle2 className="w-4 h-4" />}
            {report.status}
          </div>
        )}
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
                className="mt-4 flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
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
    </div>
  );
};

export default ReviewEditStep;

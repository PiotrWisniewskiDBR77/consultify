/**
 * GenerateStep
 *
 * Step 3: AI generates content for all enabled sections.
 */

import { AlertCircle, Check, Clock, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Report, ReportSection } from '../useReportBuilder';

// ==========================================
// TYPES
// ==========================================

interface GenerateStepProps {
  report: Report | null;
  sections: ReportSection[];
  isGenerating: boolean;
  progress: number;
  onGenerate: () => Promise<void>;
  onRegenerateSection: (sectionKey: string, customPrompt?: string) => Promise<void>;
}

// ==========================================
// COMPONENT
// ==========================================

export const GenerateStep: React.FC<GenerateStepProps> = ({
  report,
  sections,
  isGenerating,
  progress,
  onGenerate,
  onRegenerateSection,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);

  // Get only enabled sections
  const enabledSections = useMemo(
    () => sections.filter((s) => s.enabled).sort((a, b) => a.orderIndex - b.orderIndex),
    [sections]
  );

  // Calculate stats
  const stats = useMemo(() => {
    const total = enabledSections.length;
    const generated = enabledSections.filter((s) => s.generatedContent || s.editedContent).length;
    return { total, generated, pending: total - generated };
  }, [enabledSections]);

  // Handle section regenerate
  const handleRegenerate = useCallback(
    async (sectionKey: string) => {
      setRegeneratingKey(sectionKey);
      try {
        await onRegenerateSection(sectionKey);
      } finally {
        setRegeneratingKey(null);
      }
    },
    [onRegenerateSection]
  );

  // Section status icon
  const getSectionStatus = (section: ReportSection) => {
    if (regeneratingKey === section.sectionKey) {
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    }
    if (section.generatedContent || section.editedContent) {
      return <Check className="w-4 h-4 text-green-500" />;
    }
    if (isGenerating) {
      return <Clock className="w-4 h-4 text-c-text-secondary animate-pulse" />;
    }
    return <Clock className="w-4 h-4 text-c-text-secondary" />;
  };

  // Already generated
  const isGenerated =
    report?.status === 'GENERATED' ||
    report?.status === 'IN_REVIEW' ||
    report?.status === 'APPROVED' ||
    report?.status === 'SENT_INTERNAL' ||
    report?.status === 'SENT_EXTERNAL' ||
    report?.status === 'UTILIZED';

  return (
    <div className="space-y-6">
      {/* Generate Button / Progress */}
      <div className="text-center py-8">
        {isGenerating ? (
          <div className="space-y-4">
            {/* Progress Animation */}
            <div className="relative inline-flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-blue-500 animate-pulse" />
                </div>
              </div>
              <svg className="absolute w-36 h-36 -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="68"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-c-text"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="68"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={2 * Math.PI * 68}
                  strokeDashoffset={2 * Math.PI * 68 * (1 - progress / 100)}
                  className="text-blue-500 transition-all duration-300"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div>
              <div className="text-xl font-semibold text-c-text">
                {t('reportBuilder.generateStep.generatingReport', 'Generating report...')}
              </div>
              <div className="text-sm text-c-text-secondary mt-1">
                {Math.round(progress)}% {t('reportBuilder.generateStep.complete', 'complete')}
              </div>
            </div>
          </div>
        ) : isGenerated ? (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <div className="text-xl font-semibold text-c-text">
                {t('reportBuilder.generateStep.reportGenerated', 'Report Generated!')}
              </div>
              <div className="text-sm text-c-text-secondary mt-1">
                {t(
                  'reportBuilder.generateStep.youCanNowProceedToReview',
                  'You can now proceed to review and edit the content'
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Sparkles className="w-10 h-10 text-blue-600" />
            </div>
            <div>
              <div className="text-xl font-semibold text-c-text">
                {t('reportBuilder.generateStep.readyToGenerate', 'Ready to Generate')}
              </div>
              <div className="text-sm text-c-text-secondary mt-1">
                {t('reportBuilder.generateStep.aiWillGenerateForNSections', {
                  defaultValue: `AI will generate content for ${stats.total} report sections`,
                  count: stats.total,
                })}
              </div>
            </div>

            <button
              onClick={onGenerate}
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-c-text rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
            >
              <Sparkles className="w-5 h-5" />
              {t('reportBuilder.generateStep.generateReport', 'Generate Report')}
            </button>
          </div>
        )}
      </div>

      {/* Sections Status List */}
      <div className="border-t border-c-border-subtle pt-6">
        <h3 className="font-medium text-c-text mb-4">
          {t('reportBuilder.generateStep.reportSections', 'Report Sections')}
        </h3>

        <div className="space-y-2">
          {enabledSections.map((section) => (
            <div
              key={section.sectionKey}
              className="flex items-center gap-3 p-3 rounded-lg bg-c-surface-raised"
            >
              {/* Status */}
              {getSectionStatus(section)}

              {/* Title */}
              <div className="flex-1">
                <span className="text-sm text-c-text">{section.title}</span>
                {section.generatedAt && (
                  <span className="ml-2 text-xs text-c-text-secondary">
                    {new Date(section.generatedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {/* Regenerate Button */}
              {(section.generatedContent || section.editedContent) && !isGenerating && (
                <button
                  onClick={() => handleRegenerate(section.sectionKey)}
                  disabled={regeneratingKey !== null}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  {t('reportBuilder.generateStep.regenerate', 'Regenerate')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          {t(
            'reportBuilder.generateStep.youCanRegenerateIndividualSectionsAfter',
            "You can regenerate individual sections after the report is generated. In the next step, you'll be able to edit content and add additional AI guidance."
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerateStep;

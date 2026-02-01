/**
 * InterviewContextBanner
 *
 * Shows a banner indicating available interview context.
 * Used in Tools and Assessment to indicate that context is available.
 */

import { Brain, ChevronRight, ExternalLink, Sparkles, X } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  InterviewInsight,
  OrganizationContext,
  useInterviewContext,
} from '@/hooks/useInterviewContext';

interface InterviewContextBannerProps {
  /**
   * Whether to show in compact mode (single line)
   */
  compact?: boolean;

  /**
   * Callback when context is imported
   */
  onImportContext?: (context: OrganizationContext, insights: InterviewInsight[]) => void;

  /**
   * Whether import has been done for this session
   */
  isImported?: boolean;

  /**
   * Target type for export
   */
  targetType?: 'tool_session' | 'assessment_session';

  /**
   * Target session ID for export
   */
  targetId?: string;
}

export const InterviewContextBanner: React.FC<InterviewContextBannerProps> = ({
  compact = false,
  onImportContext,
  isImported = false,
  targetType,
  targetId,
}) => {
  const navigate = useNavigate();
  const { context, insights, hasContext, completenessPercent, exportToTarget } =
    useInterviewContext();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Don't show if dismissed, no context, or already imported
  if (isDismissed || !hasContext) {
    return null;
  }

  const handleImport = async () => {
    if (!context) return;

    if (targetType && targetId) {
      setIsExporting(true);
      try {
        await exportToTarget(targetType, targetId);
      } catch (error) {
        console.error('[InterviewContextBanner] Export failed:', error);
      } finally {
        setIsExporting(false);
      }
    }

    if (onImportContext) {
      onImportContext(context, insights);
    }
  };

  const goToInterview = () => {
    navigate('/interview');
  };

  // Compact version
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/30 rounded-lg">
        <Brain className="text-purple-500" size={16} />
        <span className="text-sm text-purple-700 dark:text-purple-300 flex-1">
          Interview context available ({completenessPercent}% complete)
        </span>
        {!isImported && onImportContext && (
          <button
            onClick={handleImport}
            disabled={isExporting}
            className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
          >
            {isExporting ? 'Importing...' : 'Use context'}
          </button>
        )}
        {isImported && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            ✓ Imported
          </span>
        )}
      </div>
    );
  }

  // Full version
  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800/30 rounded-xl p-4">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg shrink-0">
          <Brain className="text-purple-600 dark:text-purple-400" size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-navy-900 dark:text-white">
              Interview Context Available
            </h4>
            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full">
              {completenessPercent}% complete
            </span>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
            You have organizational context from a previous interview session. Use it to enrich your
            analysis.
          </p>

          {/* Context preview */}
          {context && (
            <div className="flex flex-wrap gap-2 mb-3">
              {context.transformationGoals.length > 0 && (
                <span className="px-2 py-1 text-xs bg-white dark:bg-navy-800 rounded border border-slate-200 dark:border-navy-700">
                  {context.transformationGoals.length} goals
                </span>
              )}
              {context.currentChallenges.length > 0 && (
                <span className="px-2 py-1 text-xs bg-white dark:bg-navy-800 rounded border border-slate-200 dark:border-navy-700">
                  {context.currentChallenges.length} challenges
                </span>
              )}
              {insights.length > 0 && (
                <span className="px-2 py-1 text-xs bg-white dark:bg-navy-800 rounded border border-slate-200 dark:border-navy-700">
                  {insights.length} insights
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!isImported && onImportContext && (
              <button
                onClick={handleImport}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <Sparkles size={14} />
                {isExporting ? 'Importing...' : 'Use this context'}
              </button>
            )}
            {isImported && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-lg">
                ✓ Context imported
              </span>
            )}
            <button
              onClick={goToInterview}
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium hover:bg-white/50 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              View Interview
              <ExternalLink size={14} />
            </button>
          </div>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default InterviewContextBanner;

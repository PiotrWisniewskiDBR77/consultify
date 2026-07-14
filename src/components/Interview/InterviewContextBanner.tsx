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
      <div className="flex items-center gap-2 px-3 py-2 bg-c-info/10 border border-c-info/20 rounded-token-md">
        <Brain className="text-[var(--c-info)]" size={16} />
        <span className="text-sm text-[var(--c-text-secondary)] flex-1">
          Interview context available ({completenessPercent}% complete)
        </span>
        {!isImported && onImportContext && (
          <button
            onClick={handleImport}
            disabled={isExporting}
            className="text-xs font-medium text-[var(--c-info)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] rounded-token-xs"
          >
            {isExporting ? 'Importing...' : 'Use context'}
          </button>
        )}
        {isImported && (
          <span className="text-xs font-medium text-[var(--c-success)]">✓ Imported</span>
        )}
      </div>
    );
  }

  // Full version
  return (
    <div className="bg-c-info/8 border border-c-info/20 rounded-token-lg p-4">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-c-info/12 rounded-token-md shrink-0">
          <Brain className="text-[var(--c-info)]" size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-[var(--c-text)]">Interview Context Available</h4>
            <span className="px-2 py-0.5 text-xs font-medium bg-c-info/12 text-[var(--c-info)] rounded-token-pill">
              {completenessPercent}% complete
            </span>
          </div>

          <p className="text-sm text-[var(--c-text-secondary)] mb-3">
            You have organizational context from a previous interview session. Use it to enrich your
            analysis.
          </p>

          {/* Context preview */}
          {context && (
            <div className="flex flex-wrap gap-2 mb-3">
              {context.keyMetrics.length > 0 && (
                <span className="px-2 py-1 text-xs bg-[var(--c-surface)] text-[var(--c-text-secondary)] rounded-token-xs border border-[var(--c-border-subtle)]">
                  {context.keyMetrics.length} metrics
                </span>
              )}
              {context.stakeholders.length > 0 && (
                <span className="px-2 py-1 text-xs bg-[var(--c-surface)] text-[var(--c-text-secondary)] rounded-token-xs border border-[var(--c-border-subtle)]">
                  {context.stakeholders.length} stakeholders
                </span>
              )}
              {context.openGaps.length > 0 && (
                <span className="px-2 py-1 text-xs bg-[var(--c-surface)] text-[var(--c-text-secondary)] rounded-token-xs border border-[var(--c-border-subtle)]">
                  {context.openGaps.length} gaps
                </span>
              )}
              {insights.length > 0 && (
                <span className="px-2 py-1 text-xs bg-[var(--c-surface)] text-[var(--c-text-secondary)] rounded-token-xs border border-[var(--c-border-subtle)]">
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--c-text)] text-[var(--c-surface)] hover:brightness-110 text-sm font-medium rounded-token-md transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
              >
                <Sparkles size={14} />
                {isExporting ? 'Importing...' : 'Use this context'}
              </button>
            )}
            {isImported && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-c-success/12 text-[var(--c-success)] text-sm font-medium rounded-token-md">
                ✓ Context imported
              </span>
            )}
            <button
              onClick={goToInterview}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--c-text-secondary)] hover:text-[var(--c-text)] text-sm font-medium hover:bg-[var(--c-surface-raised)] rounded-token-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
            >
              View Interview
              <ExternalLink size={14} />
            </button>
          </div>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 text-[var(--c-text-muted)] hover:text-[var(--c-text)] rounded-token-xs transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default InterviewContextBanner;

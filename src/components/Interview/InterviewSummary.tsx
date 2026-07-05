/**
 * InterviewSummary
 *
 * Displays a summary of the interview session with all collected context.
 * Allows export to Tools/Assessment.
 * Uses the canonical 5 categories: Strategy, Operations, Digital, People, Finance.
 */

import {
  CheckCircle,
  DollarSign,
  Download,
  ExternalLink,
  Monitor,
  Settings,
  Target,
  Users,
} from 'lucide-react';
import React from 'react';

import { InterviewInsight, OrganizationContext } from '@/hooks/useInterviewContext';

import { type InterviewCategory } from './CategorySidebar';

const SUMMARY_CATEGORY_CONFIG: Record<
  InterviewCategory,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    bgColor: string;
    /** Solid dot colour (category identity) for the insight-count dots. */
    dot: string;
  }
> = {
  strategy: {
    label: 'Strategy',
    icon: Target,
    color: 'text-[var(--c-tag-1)]',
    bgColor: 'bg-c-tag-1/12',
    dot: 'bg-[var(--c-tag-1)]',
  },
  operations: {
    label: 'Operations',
    icon: Settings,
    color: 'text-[var(--c-tag-3)]',
    bgColor: 'bg-c-tag-3/12',
    dot: 'bg-[var(--c-tag-3)]',
  },
  digital: {
    label: 'Digital',
    icon: Monitor,
    color: 'text-[var(--c-tag-5)]',
    bgColor: 'bg-c-tag-5/12',
    dot: 'bg-[var(--c-tag-5)]',
  },
  people: {
    label: 'People',
    icon: Users,
    color: 'text-[var(--c-tag-7)]',
    bgColor: 'bg-c-tag-7/12',
    dot: 'bg-[var(--c-tag-7)]',
  },
  finance: {
    label: 'Finance',
    icon: DollarSign,
    color: 'text-[var(--c-tag-9)]',
    bgColor: 'bg-c-tag-9/12',
    dot: 'bg-[var(--c-tag-9)]',
  },
  general: {
    label: 'General',
    icon: CheckCircle,
    color: 'text-[var(--c-text-secondary)]',
    bgColor: 'bg-[var(--c-surface-raised)]',
    dot: 'bg-[var(--c-text-muted)]',
  },
};

const CATEGORY_KEYS = Object.keys(SUMMARY_CATEGORY_CONFIG) as InterviewCategory[];

interface InterviewSummaryProps {
  sessionId: string;
  insights: InterviewInsight[];
  context: OrganizationContext | null;
  completedCategories: string[];
  onExportToTools?: () => void;
  onExportToAssessment?: () => void;
  onViewDetails?: (category: string) => void;
}

export const InterviewSummary: React.FC<InterviewSummaryProps> = ({
  sessionId,
  insights,
  context,
  completedCategories,
  onExportToTools,
  onExportToAssessment,
  onViewDetails,
}) => {
  const insightsByCategory = insights.reduce(
    (acc, insight) => {
      const cat = insight.category as InterviewCategory;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(insight);
      return acc;
    },
    {} as Record<InterviewCategory, InterviewInsight[]>
  );

  const totalInsights = insights.length;
  const confirmedInsights = insights.filter((i) => i.status === 'confirmed').length;
  const highImpactInsights = insights.filter((i) => i.impactLevel === 'high').length;

  return (
    <div className="bg-[var(--c-surface)] rounded-token-lg border border-[var(--c-border-subtle)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--c-border-subtle)] bg-[var(--c-surface-raised)]">
        <h3 className="font-bold text-[var(--c-text)]">Interview Summary</h3>
        <p className="text-sm text-[var(--c-text-muted)] mt-1">
          {completedCategories.length} of {CATEGORY_KEYS.length} categories completed
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 border-b border-[var(--c-border-subtle)]">
        <div className="text-center">
          <div className="text-2xl font-bold text-[var(--c-text)]">{totalInsights}</div>
          <div className="text-xs text-[var(--c-text-muted)]">Total Insights</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-[var(--c-success)]">
            {confirmedInsights}
          </div>
          <div className="text-xs text-[var(--c-text-muted)]">Confirmed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-[var(--c-warning)]">
            {highImpactInsights}
          </div>
          <div className="text-xs text-[var(--c-text-muted)]">High Impact</div>
        </div>
      </div>

      {/* Categories Overview */}
      <div className="p-4 space-y-3">
        {CATEGORY_KEYS.map((category) => {
          const config = SUMMARY_CATEGORY_CONFIG[category];
          const CategoryIcon = config.icon;
          const categoryInsights = insightsByCategory[category] || [];
          const isCompleted = completedCategories.includes(category);

          return (
            <div
              key={category}
              onClick={() => onViewDetails?.(category)}
              className={`
                flex items-center gap-3 p-3 rounded-token-md cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]
                ${
                  isCompleted
                    ? 'bg-[var(--c-surface-raised)] hover:bg-[var(--c-surface)] border border-[var(--c-border-subtle)]'
                    : 'bg-[var(--c-surface-raised)] opacity-60'
                }
              `}
            >
              <div
                className={`w-8 h-8 rounded-token-md ${config.bgColor} flex items-center justify-center`}
              >
                <CategoryIcon size={16} className={config.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[var(--c-text)]">
                    {config.label}
                  </span>
                  {isCompleted && <CheckCircle size={14} className="text-[var(--c-success)]" />}
                </div>
                <span className="text-xs text-[var(--c-text-muted)]">
                  {categoryInsights.length} insights
                </span>
              </div>
              {categoryInsights.length > 0 && (
                <div className="flex gap-1">
                  {categoryInsights.slice(0, 3).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-token-pill ${config.dot}`}
                    />
                  ))}
                  {categoryInsights.length > 3 && (
                    <span className="text-xs text-[var(--c-text-muted)]">+{categoryInsights.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Organization Context Preview */}
      {context && context.completenessPercent > 0 && (
        <div className="p-4 border-t border-[var(--c-border-subtle)]">
          <h4 className="font-medium text-sm text-[var(--c-text)] mb-3">
            Organization Context
          </h4>
          <div className="space-y-2">
            {context.keyMetrics.length > 0 && (
              <div className="text-xs">
                <span className="text-[var(--c-text-muted)]">Key Metrics:</span>
                <span className="ml-1 text-[var(--c-text-secondary)]">
                  {context.keyMetrics
                    .slice(0, 2)
                    .map((m) => `${m.name}: ${m.value}`)
                    .join(', ')}
                  {context.keyMetrics.length > 2 && ` +${context.keyMetrics.length - 2} more`}
                </span>
              </div>
            )}
            {context.stakeholders.length > 0 && (
              <div className="text-xs">
                <span className="text-[var(--c-text-muted)]">Stakeholders:</span>
                <span className="ml-1 text-[var(--c-text-secondary)]">
                  {context.stakeholders
                    .slice(0, 2)
                    .map((s) => `${s.name} (${s.role})`)
                    .join(', ')}
                  {context.stakeholders.length > 2 && ` +${context.stakeholders.length - 2} more`}
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[var(--c-border-subtle)] rounded-token-pill overflow-hidden">
              <div
                className="h-full bg-[var(--c-text)] rounded-token-pill"
                style={{ width: `${context.completenessPercent}%` }}
              />
            </div>
            <span className="text-xs text-[var(--c-text-muted)]">
              {context.completenessPercent}%
            </span>
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="p-4 border-t border-[var(--c-border-subtle)] bg-[var(--c-surface-raised)]">
        <p className="text-xs text-[var(--c-text-muted)] mb-3">
          Export this context to enrich your Tools or Assessment
        </p>
        <div className="flex gap-2">
          <button
            onClick={onExportToTools}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)] hover:bg-[var(--c-surface-raised)] text-sm font-medium rounded-token-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
          >
            <Download size={14} />
            Export to Tools
          </button>
          <button
            onClick={onExportToAssessment}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--c-text)] text-[var(--c-surface)] hover:brightness-110 text-sm font-medium rounded-token-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
          >
            <ExternalLink size={14} />
            Export to Assessment
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewSummary;

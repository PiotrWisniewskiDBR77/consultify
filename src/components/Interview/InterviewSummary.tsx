/**
 * InterviewSummary
 *
 * Displays a summary of the interview session with all collected context.
 * Allows export to Tools/Assessment.
 * Uses the canonical 5 categories: Strategy, Operations, Digital, People, Finance.
 */

import { CheckCircle, DollarSign, Download, ExternalLink, Monitor, Settings, Target, Users } from 'lucide-react';
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
  }
> = {
  strategy: {
    label: 'Strategy',
    icon: Target,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  operations: {
    label: 'Operations',
    icon: Settings,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  digital: {
    label: 'Digital',
    icon: Monitor,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  people: {
    label: 'People',
    icon: Users,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  finance: {
    label: 'Finance',
    icon: DollarSign,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
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
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-navy-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
        <h3 className="font-bold text-navy-900 dark:text-white">Interview Summary</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {completedCategories.length} of {CATEGORY_KEYS.length} categories completed
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 border-b border-slate-200 dark:border-navy-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-navy-900 dark:text-white">{totalInsights}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Insights</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {confirmedInsights}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Confirmed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {highImpactInsights}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">High Impact</div>
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
                flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                ${
                  isCompleted
                    ? 'bg-slate-50 dark:bg-navy-800/50 hover:bg-slate-100 dark:hover:bg-navy-800'
                    : 'bg-slate-50/50 dark:bg-navy-950/50 opacity-60'
                }
              `}
            >
              <div
                className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center`}
              >
                <CategoryIcon size={16} className={config.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-navy-900 dark:text-white">
                    {config.label}
                  </span>
                  {isCompleted && <CheckCircle size={14} className="text-emerald-500" />}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {categoryInsights.length} insights
                </span>
              </div>
              {categoryInsights.length > 0 && (
                <div className="flex gap-1">
                  {categoryInsights.slice(0, 3).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${config.bgColor.replace('100', '400').replace('900/30', '500')}`}
                    />
                  ))}
                  {categoryInsights.length > 3 && (
                    <span className="text-xs text-slate-400">+{categoryInsights.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Organization Context Preview */}
      {context && context.completenessPercent > 0 && (
        <div className="p-4 border-t border-slate-200 dark:border-navy-700">
          <h4 className="font-medium text-sm text-navy-900 dark:text-white mb-3">
            Organization Context
          </h4>
          <div className="space-y-2">
            {context.keyMetrics.length > 0 && (
              <div className="text-xs">
                <span className="text-slate-500 dark:text-slate-400">Key Metrics:</span>
                <span className="ml-1 text-slate-700 dark:text-slate-300">
                  {context.keyMetrics
                    .slice(0, 2)
                    .map((m) => `${m.name}: ${m.value}`)
                    .join(', ')}
                  {context.keyMetrics.length > 2 &&
                    ` +${context.keyMetrics.length - 2} more`}
                </span>
              </div>
            )}
            {context.stakeholders.length > 0 && (
              <div className="text-xs">
                <span className="text-slate-500 dark:text-slate-400">Stakeholders:</span>
                <span className="ml-1 text-slate-700 dark:text-slate-300">
                  {context.stakeholders
                    .slice(0, 2)
                    .map((s) => `${s.name} (${s.role})`)
                    .join(', ')}
                  {context.stakeholders.length > 2 &&
                    ` +${context.stakeholders.length - 2} more`}
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${context.completenessPercent}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {context.completenessPercent}%
            </span>
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="p-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Export this context to enrich your Tools or Assessment
        </p>
        <div className="flex gap-2">
          <button
            onClick={onExportToTools}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Download size={14} />
            Export to Tools
          </button>
          <button
            onClick={onExportToAssessment}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
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

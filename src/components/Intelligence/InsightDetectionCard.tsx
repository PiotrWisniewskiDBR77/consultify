import { Check, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import React from 'react';

import { CategoryIcon, getCategoryLabel, type InsightCategory } from './CategoryIcon';

interface DetectedInsight {
  id: string;
  category: InsightCategory;
  title: string;
  content: Record<string, unknown>;
  confidence: 'high' | 'medium' | 'low';
  sourceText: string;
}

interface InsightDetectionCardProps {
  insight: DetectedInsight;
  onConfirm: (insight: DetectedInsight) => void;
  onDismiss: (insightId: string) => void;
  onEdit?: (insight: DetectedInsight) => void;
}

const CONFIDENCE_STYLES = {
  high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

export function InsightDetectionCard({
  insight,
  onConfirm,
  onDismiss,
  onEdit,
}: InsightDetectionCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <CategoryIcon category={insight.category} size={18} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {getCategoryLabel(insight.category)}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLES[insight.confidence]}`}
            >
              {insight.confidence}
            </span>
          </div>

          <h4 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">
            {insight.title}
          </h4>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Sparkles size={14} className="text-purple-500 animate-pulse" />
        </div>
      </div>

      {/* Source Preview */}
      <div className="px-4 pb-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
          "{insight.sourceText}"
        </p>
      </div>

      {/* Expandable Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-navy-700 pt-3">
          <div className="space-y-2">
            {Object.entries(insight.content).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 capitalize min-w-[80px]">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value || '—')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center border-t border-slate-100 dark:border-navy-700">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Less' : 'Details'}
        </button>

        <div className="w-px h-8 bg-slate-100 dark:bg-white/5" />

        <button
          onClick={() => onDismiss(insight.id)}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <X size={14} />
          Dismiss
        </button>

        <div className="w-px h-8 bg-slate-100 dark:bg-white/5" />

        <button
          onClick={() => onConfirm(insight)}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
        >
          <Check size={14} />
          Confirm
        </button>
      </div>
    </div>
  );
}

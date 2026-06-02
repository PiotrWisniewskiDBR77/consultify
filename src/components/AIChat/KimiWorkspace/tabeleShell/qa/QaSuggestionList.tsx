/**
 * QaSuggestionList — list of actionable QA suggestions surfaced from a
 * `QaReport`. Each card has:
 *   - severity dot
 *   - axis label + description
 *   - "Open in AI Editor" button (callback wired by the panel)
 *   - "Mark not applicable" button (callback wired by the panel)
 *
 * Block C · EPIC-T11 · Sprint C-S5.
 */

import { Sparkles, X } from 'lucide-react';
import React from 'react';

import type { AiEditorLevel, QaSuggestion } from '@/services/api/tablePlatform.api';

const SEVERITY_DOT: Record<QaSuggestion['severity'], string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-400',
};

const AXIS_SHORT: Record<QaSuggestion['axis'], string> = {
  completeness: 'completeness',
  freshness: 'freshness',
  sourceCoverage: 'sources',
  methodology: 'methodology',
  formulaConsistency: 'formula',
};

export interface QaSuggestionListProps {
  suggestions: QaSuggestion[];
  onOpenInAiEditor?: (suggestion: QaSuggestion) => void;
  onDismiss?: (suggestion: QaSuggestion) => void;
  emptyLabel?: string;
}

export const QaSuggestionList: React.FC<QaSuggestionListProps> = ({
  suggestions,
  onOpenInAiEditor,
  onDismiss,
  emptyLabel,
}) => {
  if (suggestions.length === 0) {
    return (
      <div
        className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"
        data-testid="qa-suggestion-list-empty"
      >
        {emptyLabel ?? 'No actionable suggestions. Table is in great shape.'}
      </div>
    );
  }

  return (
    <ul className="space-y-2" data-testid="qa-suggestion-list">
      {suggestions.map((s) => (
        <li
          key={s.id}
          className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3"
          data-testid="qa-suggestion-card"
        >
          <div className="flex items-start gap-2">
            <span
              className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[s.severity]}`}
              aria-label={`severity ${s.severity}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {AXIS_SHORT[s.axis]}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  → {labelLevel(s.recommendedAction.level)}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{s.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {onOpenInAiEditor && (
                  <button
                    type="button"
                    onClick={() => onOpenInAiEditor(s)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    data-testid="qa-suggestion-open-ai"
                  >
                    <Sparkles className="h-3 w-3" /> Open in AI Editor
                  </button>
                )}
                {onDismiss && (
                  <button
                    type="button"
                    onClick={() => onDismiss(s)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    data-testid="qa-suggestion-dismiss"
                  >
                    <X className="h-3 w-3" /> Mark not applicable
                  </button>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

function labelLevel(level: AiEditorLevel): string {
  switch (level) {
    case 'cell':
      return 'cell';
    case 'record':
      return 'record';
    case 'column':
      return 'column';
    case 'structure':
      return 'structure';
    case 'view':
      return 'view';
    case 'relational':
      return 'relations';
    case 'methodological':
      return 'methodology';
    case 'source':
      return 'sources';
    default:
      return level;
  }
}

export default QaSuggestionList;

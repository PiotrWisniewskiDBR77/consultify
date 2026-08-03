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
import { useTranslation } from 'react-i18next';

import type { AiEditorLevel, QaSuggestion } from '@/services/api/tablePlatform.api';

const SEVERITY_DOT: Record<QaSuggestion['severity'], string> = {
  high: 'bg-danger-500',
  medium: 'bg-amber-500',
  low: 'bg-c-text-muted',
};

const SEVERITY_LABEL_KEY: Record<QaSuggestion['severity'], string> = {
  high: 'kimi.tabeleShell.qa.severity.high',
  medium: 'kimi.tabeleShell.qa.severity.medium',
  low: 'kimi.tabeleShell.qa.severity.low',
};

const SEVERITY_LABEL_EN: Record<QaSuggestion['severity'], string> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const AXIS_SHORT_KEY: Record<QaSuggestion['axis'], string> = {
  completeness: 'kimi.tabeleShell.qa.axisShort.completeness',
  freshness: 'kimi.tabeleShell.qa.axisShort.freshness',
  sourceCoverage: 'kimi.tabeleShell.qa.axisShort.sourceCoverage',
  methodology: 'kimi.tabeleShell.qa.axisShort.methodology',
  formulaConsistency: 'kimi.tabeleShell.qa.axisShort.formulaConsistency',
};

const AXIS_SHORT_EN: Record<QaSuggestion['axis'], string> = {
  completeness: 'completeness',
  freshness: 'freshness',
  sourceCoverage: 'sources',
  methodology: 'methodology',
  formulaConsistency: 'formula',
};

const LEVEL_LABEL_KEY: Record<AiEditorLevel, string> = {
  cell: 'kimi.tabeleShell.qa.level.cell',
  record: 'kimi.tabeleShell.qa.level.record',
  column: 'kimi.tabeleShell.qa.level.column',
  structure: 'kimi.tabeleShell.qa.level.structure',
  view: 'kimi.tabeleShell.qa.level.view',
  relational: 'kimi.tabeleShell.qa.level.relational',
  methodological: 'kimi.tabeleShell.qa.level.methodological',
  source: 'kimi.tabeleShell.qa.level.source',
};

const LEVEL_LABEL_EN: Record<AiEditorLevel, string> = {
  cell: 'cell',
  record: 'record',
  column: 'column',
  structure: 'structure',
  view: 'view',
  relational: 'relations',
  methodological: 'methodology',
  source: 'sources',
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
  const { t } = useTranslation();

  if (suggestions.length === 0) {
    return (
      <div
        className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"
        data-testid="qa-suggestion-list-empty"
      >
        {emptyLabel ??
          t(
            'kimi.tabeleShell.qa.noSuggestions',
            'No actionable suggestions. Table is in great shape.'
          )}
      </div>
    );
  }

  return (
    <ul className="space-y-2" data-testid="qa-suggestion-list">
      {suggestions.map((s) => (
        <li
          key={s.id}
          className="rounded-md border border-c-border-subtle bg-c-surface p-3"
          data-testid="qa-suggestion-card"
        >
          <div className="flex items-start gap-2">
            <span
              className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[s.severity]}`}
              aria-label={t('kimi.tabeleShell.qa.severityAriaLabel', {
                defaultValue: 'severity {{severity}}',
                severity: t(SEVERITY_LABEL_KEY[s.severity], SEVERITY_LABEL_EN[s.severity]),
              })}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-c-text-secondary">
                  {t(AXIS_SHORT_KEY[s.axis], AXIS_SHORT_EN[s.axis])}
                </span>
                <span className="text-[11px] text-c-text-secondary">
                  →{' '}
                  {t(
                    LEVEL_LABEL_KEY[s.recommendedAction.level],
                    LEVEL_LABEL_EN[s.recommendedAction.level]
                  )}
                </span>
              </div>
              <p className="mt-1 text-sm text-c-text">{s.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {onOpenInAiEditor && (
                  <button
                    type="button"
                    onClick={() => onOpenInAiEditor(s)}
                    className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle bg-c-surface-raised px-2 py-1 text-xs text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    data-testid="qa-suggestion-open-ai"
                  >
                    <Sparkles className="h-3 w-3" />{' '}
                    {t('kimi.tabeleShell.qa.openInAiEditor', 'Open in AI Editor')}
                  </button>
                )}
                {onDismiss && (
                  <button
                    type="button"
                    onClick={() => onDismiss(s)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-c-text-secondary hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    data-testid="qa-suggestion-dismiss"
                  >
                    <X className="h-3 w-3" />{' '}
                    {t('kimi.tabeleShell.qa.markNotApplicable', 'Mark not applicable')}
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

export default QaSuggestionList;

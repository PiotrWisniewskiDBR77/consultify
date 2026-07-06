import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';

import { Button } from '@/components/ui/Button';

import type { ValidationIssue, ValidationResult } from './useProcessFlowValidation';

export type { ValidationIssue, ValidationResult };

interface ValidationResultsPanelProps {
  result: ValidationResult | null;
  isValidating: boolean;
  isPl: boolean;
  onClickIssue: (objectId: string) => void;
  onValidate: () => void;
}

const LAYER_ORDER: ValidationIssue['layer'][] = ['semantic_first', 'structural_bounded'];

const LAYER_LABEL: Record<ValidationIssue['layer'], { en: string; pl: string }> = {
  semantic_first: { en: 'Semantic', pl: 'Semantyka' },
  structural_bounded: { en: 'Structure', pl: 'Struktura' },
};

export const ValidationResultsPanel: React.FC<ValidationResultsPanelProps> = ({
  result,
  isValidating,
  isPl,
  onClickIssue,
  onValidate,
}) => {
  const grouped = useMemo(() => {
    const issues = result?.issues ?? [];
    const map = new Map<ValidationIssue['layer'], ValidationIssue[]>();
    for (const layer of LAYER_ORDER) map.set(layer, []);
    for (const issue of issues) {
      const list = map.get(issue.layer);
      if (list) list.push(issue);
    }
    return map;
  }, [result?.issues]);

  const validBadge =
    result && result.valid ? (
      <span className="rounded-full bg-success-100 px-2 py-0.5 text-xs font-semibold text-success-800 dark:bg-success-900/40 dark:text-success-200">
        {isPl ? 'Poprawny' : 'Valid'}
      </span>
    ) : result && !result.valid ? (
      <span className="rounded-full bg-danger-100 px-2 py-0.5 text-xs font-semibold text-danger-800 dark:bg-danger-900/40 dark:text-danger-200">
        {isPl ? 'Błędy' : 'Invalid'}
      </span>
    ) : (
      <span className="rounded-full bg-c-surface-raised px-2 py-0.5 text-xs font-semibold text-c-text-secondary">
        {isPl ? 'Brak wyniku' : 'No result'}
      </span>
    );

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-sm text-c-text shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-c-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-c-text">
            {isPl ? 'Walidacja' : 'Validation'}
          </h2>
          {validBadge}
        </div>
        <Button variant="outline" size="sm" onClick={onValidate} disabled={isValidating}>
          {isPl ? 'Uruchom walidację' : 'Run validation'}
        </Button>
      </div>

      <div className="p-4">
        {isValidating ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-c-text-muted">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-c-border-subtle border-t-primary-500 dark:border-t-primary-400"
              role="status"
              aria-label={isPl ? 'Ładowanie' : 'Loading'}
            />
            <span className="text-xs">{isPl ? 'Sprawdzanie…' : 'Validating…'}</span>
          </div>
        ) : !result ? (
          <p className="py-6 text-center text-xs text-c-text-muted">
            {isPl ? 'Uruchom walidację, aby zobaczyć wyniki.' : 'Run validation to see results.'}
          </p>
        ) : result.issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-success-600 dark:text-success-400">
            <CheckCircle2 className="h-10 w-10" strokeWidth={1.5} />
            <p className="text-sm font-medium">{isPl ? 'Brak problemów' : 'No issues found'}</p>
            {result.validated_at && (
              <p className="text-xs text-c-text-muted">
                {new Date(result.validated_at).toLocaleString(isPl ? 'pl-PL' : 'en-US')}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {result.validated_at && (
              <p className="text-xs text-c-text-muted">
                {isPl ? 'Ostatnia walidacja: ' : 'Last validated: '}
                {new Date(result.validated_at).toLocaleString(isPl ? 'pl-PL' : 'en-US')}
              </p>
            )}
            {LAYER_ORDER.map((layer) => {
              const list = grouped.get(layer) ?? [];
              if (list.length === 0) return null;
              return (
                <div key={layer}>
                  <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-c-text-muted">
                    <ChevronRight size={14} className="text-c-text-secondary" aria-hidden />
                    {LAYER_LABEL[layer][isPl ? 'pl' : 'en']}
                  </div>
                  <ul className="space-y-1">
                    {list.map((issue, idx) => {
                      const clickable = Boolean(issue.object_id);
                      const Icon = issue.severity === 'error' ? AlertCircle : AlertTriangle;
                      const iconClass =
                        issue.severity === 'error'
                          ? 'text-danger-500 dark:text-danger-400'
                          : 'text-warning-500 dark:text-warning-400';
                      const rowClass = `flex w-full items-start gap-2 rounded-lg border border-transparent px-2 py-2 text-left text-xs ${
                        clickable
                          ? 'cursor-pointer hover:border-c-border-subtle hover:bg-c-surface-raised'
                          : ''
                      }`;
                      const body = (
                        <>
                          <Icon className={`mt-0.5 shrink-0 ${iconClass}`} size={16} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold text-c-text">
                              {issue.rule}
                            </span>
                            <span className="mt-0.5 block text-c-text-secondary">
                              {issue.message}
                            </span>
                          </span>
                        </>
                      );
                      return (
                        <li key={`${issue.rule}-${issue.object_id ?? 'global'}-${idx}`}>
                          {clickable ? (
                            <button
                              type="button"
                              onClick={() => issue.object_id && onClickIssue(issue.object_id)}
                              className={rowClass}
                            >
                              {body}
                            </button>
                          ) : (
                            <div className={rowClass}>{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

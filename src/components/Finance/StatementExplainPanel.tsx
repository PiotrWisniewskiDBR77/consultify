import React from 'react';

import { type FinanceStatementExplain } from '../Economics/financeTypes';

interface Props {
  explain: FinanceStatementExplain | null;
  title: string;
  emptyLabel: string;
  mappingLabel: string;
  originLabel: string;
  confidenceLabel: string;
  sourceLabel: string;
  noEvidenceLabel: string;
}

export const StatementExplainPanel: React.FC<Props> = ({
  explain,
  title,
  emptyLabel,
  mappingLabel,
  originLabel,
  confidenceLabel,
  sourceLabel,
  noEvidenceLabel,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</div>
      {!explain ? (
        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</div>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">{explain.originalLabel}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {mappingLabel}: {explain.mappedTo || explain.lineCode || '—'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {originLabel}: {explain.valueOrigin}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {confidenceLabel}: {Math.round(Number(explain.mappingConfidence || 0) * 100)}%
            </div>
          </div>

          {explain.evidences.length > 0 ? (
            <div className="space-y-2">
              {explain.evidences.map((evidence, index) => (
                <div
                  key={`${evidence.evidenceType}-${index}`}
                  className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-xs dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <div className="font-medium text-slate-900 dark:text-white">
                    {evidence.explanation || evidence.evidenceType}
                  </div>
                  {evidence.source && (
                    <div className="mt-1 text-slate-500 dark:text-slate-400">
                      {sourceLabel}: {evidence.source.rowLabel || '—'}
                      {evidence.source.sourcePage != null ? ` • p.${evidence.source.sourcePage}` : ''}
                      {evidence.source.sourceRow != null ? ` • row ${evidence.source.sourceRow}` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">{noEvidenceLabel}</div>
          )}
        </div>
      )}
    </div>
  );
};

import { ArrowRight, ChevronDown, ChevronRight, FileSearch, GitMerge, Layers, PenLine, Sparkles, Zap } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type FinanceStatementExplain, type FinanceStatementExplainEvidence } from '../Economics/financeTypes';

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

const EVIDENCE_ICONS: Record<string, React.ReactNode> = {
  direct: <Zap size={13} className="text-emerald-500" />,
  aggregated: <Layers size={13} className="text-blue-500" />,
  split: <GitMerge size={13} className="text-violet-500" />,
  derived: <Sparkles size={13} className="text-amber-500" />,
  manual_note: <PenLine size={13} className="text-cyan-500" />,
};

const EVIDENCE_LABELS: Record<string, { en: string; pl: string }> = {
  direct: { en: 'Direct match', pl: 'Bezpośrednie dopasowanie' },
  aggregated: { en: 'Aggregated', pl: 'Zagregowane' },
  split: { en: 'Split/Merged', pl: 'Rozdzielone/Scalone' },
  derived: { en: 'Derived', pl: 'Obliczone' },
  manual_note: { en: 'Manual note', pl: 'Notatka ręczna' },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? 'bg-emerald-500 dark:bg-emerald-400'
      : pct >= 50
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-rose-500 dark:bg-rose-400';
  const textColor =
    pct >= 80
      ? 'text-emerald-700 dark:text-emerald-300'
      : pct >= 50
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-rose-700 dark:text-rose-300';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.08]">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[11px] font-semibold tabular-nums ${textColor}`}>{pct}%</span>
    </div>
  );
}

function EvidenceCard({
  evidence,
  index,
  sourceLabel,
  isPl,
}: {
  evidence: FinanceStatementExplainEvidence;
  index: number;
  sourceLabel: string;
  isPl: boolean;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const icon = EVIDENCE_ICONS[evidence.evidenceType] || EVIDENCE_ICONS.direct;
  const typeLabel = EVIDENCE_LABELS[evidence.evidenceType]?.[isPl ? 'pl' : 'en'] || evidence.evidenceType;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.03]"
        aria-expanded={expanded}
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="flex-1 text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
          {evidence.explanation || typeLabel}
        </span>
        {evidence.weight > 0 && (
          <span className="flex-shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {Math.round(evidence.weight * 100)}%
          </span>
        )}
        {expanded ? (
          <ChevronDown size={12} className="flex-shrink-0 text-slate-400" />
        ) : (
          <ChevronRight size={12} className="flex-shrink-0 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-slate-200/50 bg-slate-50/40 px-3 py-2 dark:border-white/[0.04] dark:bg-white/[0.01]">
          <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            {evidence.contributionValue != null && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {isPl ? 'Wkład' : 'Contribution'}
                </span>
                <span className="font-mono font-medium tabular-nums">
                  {Number(evidence.contributionValue).toLocaleString()}
                </span>
              </div>
            )}
            {evidence.source && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {sourceLabel}
                </div>
                {evidence.source.rowLabel && (
                  <div className="text-slate-700 dark:text-slate-200">{evidence.source.rowLabel}</div>
                )}
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                  {evidence.source.sourcePage != null && <span>p. {evidence.source.sourcePage}</span>}
                  {evidence.source.sourceRow != null && <span>row {evidence.source.sourceRow}</span>}
                  {evidence.source.rawValue && (
                    <span className="font-mono">{evidence.source.rawValue}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const panelRef = useRef<HTMLDivElement>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setAnimKey((prev) => prev + 1);
  }, [explain?.valueId]);

  return (
    <div
      ref={panelRef}
      className="sticky top-0 self-start rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/90"
      aria-live="polite"
      aria-label={title}
    >
      {/* Header */}
      <div className="border-b border-slate-200/70 px-4 py-3 dark:border-white/[0.06]">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {title}
        </div>
      </div>

      {!explain ? (
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100/80 dark:bg-white/[0.05]">
            <FileSearch size={20} className="text-slate-400 dark:text-slate-500" />
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 max-w-[220px] leading-relaxed">
            {emptyLabel}
          </div>
        </div>
      ) : (
        <div
          key={animKey}
          className="animate-in fade-in slide-in-from-right-2 space-y-4 px-4 py-4 duration-200"
        >
          {/* Value header */}
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
              {explain.originalLabel}
            </div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {Number(explain.value || 0).toLocaleString()}
            </div>
          </div>

          {/* Mapping flow */}
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              {mappingLabel}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="truncate rounded-md bg-white px-2 py-1 font-medium text-slate-700 shadow-sm dark:bg-white/[0.06] dark:text-slate-200">
                {explain.originalLabel}
              </span>
              <ArrowRight size={12} className="flex-shrink-0 text-slate-400" />
              <span className="truncate rounded-md bg-cyan-50 px-2 py-1 font-medium text-cyan-700 shadow-sm dark:bg-cyan-500/10 dark:text-cyan-300">
                {explain.mappedTo || explain.lineCode || '—'}
              </span>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-1">
                {originLabel}
              </div>
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                {explain.valueOrigin}
              </span>
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-1">
                {confidenceLabel}
              </div>
              <ConfidenceBar value={Number(explain.mappingConfidence || 0)} />
            </div>
          </div>

          {/* Evidence */}
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {sourceLabel}
            </div>
            {explain.evidences.length > 0 ? (
              <div className="space-y-2">
                {explain.evidences.map((evidence, index) => (
                  <EvidenceCard
                    key={`${evidence.evidenceType}-${index}`}
                    evidence={evidence}
                    index={index}
                    sourceLabel={sourceLabel}
                    isPl={isPl}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200/70 px-3 py-4 text-center text-xs text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
                {noEvidenceLabel}
              </div>
            )}
          </div>

          {/* Selected mapping candidate */}
          {explain.selectedMappingCandidate && (
            <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                {isPl ? 'Wybrany kandydat' : 'Selected candidate'}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700 dark:text-slate-200">
                  Score: <span className="font-mono font-semibold">{Math.round(explain.selectedMappingCandidate.score * 100)}%</span>
                </span>
              </div>
              {explain.selectedMappingCandidate.reason && (
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {explain.selectedMappingCandidate.reason}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

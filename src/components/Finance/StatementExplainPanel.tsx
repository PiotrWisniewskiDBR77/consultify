import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Cog,
  FileSearch,
  GitMerge,
  Hash,
  Layers,
  Link2,
  MessageSquare,
  Minus,
  PenLine,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type FinanceStatementExplain,
  type FinanceStatementExplainEvidence,
  type FinanceStatementTableRow,
} from '../Economics/financeTypes';

interface Props {
  explain: FinanceStatementExplain | null;
  selectedRow?: FinanceStatementTableRow | null;
  currency?: string;
  title: string;
  emptyLabel: string;
  mappingLabel: string;
  originLabel: string;
  confidenceLabel: string;
  sourceLabel: string;
  noEvidenceLabel: string;
}

const EVIDENCE_ICONS: Record<string, React.ReactNode> = {
  direct: <Zap size={12} className="text-emerald-500" />,
  aggregated: <Layers size={12} className="text-blue-500" />,
  split: <GitMerge size={12} className="text-primary-500" />,
  derived: <Sparkles size={12} className="text-amber-500" />,
  manual_note: <PenLine size={12} className="text-blue-500" />,
};

const EVIDENCE_TYPE_I18N_KEYS: Record<string, string> = {
  direct: 'finance.explainPanel.evidenceType.direct',
  aggregated: 'finance.explainPanel.evidenceType.aggregated',
  split: 'finance.explainPanel.evidenceType.split',
  derived: 'finance.explainPanel.evidenceType.derived',
  manual_note: 'finance.explainPanel.evidenceType.manualNote',
};

const EVIDENCE_TYPE_FALLBACKS: Record<string, string> = {
  direct: 'Direct match',
  aggregated: 'Aggregated',
  split: 'Split/Merged',
  derived: 'Derived',
  manual_note: 'Manual note',
};

const MAPPING_STATUS_CONFIG: Record<
  string,
  { i18nKey: string; fallback: string; icon: React.ReactNode; dotColor: string }
> = {
  auto: {
    i18nKey: 'finance.explainPanel.mappingStatus.auto',
    fallback: 'Auto',
    icon: <Zap size={10} />,
    dotColor: 'bg-c-text-muted',
  },
  manual: {
    i18nKey: 'finance.explainPanel.mappingStatus.manual',
    fallback: 'Manual',
    icon: <PenLine size={10} />,
    dotColor: 'bg-blue-400',
  },
  computed: {
    i18nKey: 'finance.explainPanel.mappingStatus.computed',
    fallback: 'Computed',
    icon: <Sparkles size={10} />,
    dotColor: 'bg-violet-400',
  },
  unmapped: {
    i18nKey: 'finance.explainPanel.mappingStatus.unmapped',
    fallback: 'Unmapped',
    icon: <Minus size={10} />,
    dotColor: 'bg-amber-400',
  },
  mapped: {
    i18nKey: 'finance.explainPanel.mappingStatus.mapped',
    fallback: 'Mapped',
    icon: <Link2 size={10} />,
    dotColor: 'bg-emerald-400',
  },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? 'bg-emerald-500 dark:bg-emerald-400'
      : pct >= 50
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-danger-500 dark:bg-danger-400';
  const textColor =
    pct >= 80
      ? 'text-emerald-600 dark:text-emerald-300'
      : pct >= 50
        ? 'text-amber-600 dark:text-amber-300'
        : 'text-danger-600 dark:text-danger-300';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.08]">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold tabular-nums ${textColor}`}>{pct}%</span>
    </div>
  );
}

function EvidenceCard({
  evidence,
  index,
  sourceLabel,
}: {
  evidence: FinanceStatementExplainEvidence;
  index: number;
  sourceLabel: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(index === 0);
  const icon = EVIDENCE_ICONS[evidence.evidenceType] || EVIDENCE_ICONS.direct;
  const evidenceTypeI18nKey = EVIDENCE_TYPE_I18N_KEYS[evidence.evidenceType];
  const typeLabel = evidenceTypeI18nKey
    ? t(evidenceTypeI18nKey, EVIDENCE_TYPE_FALLBACKS[evidence.evidenceType])
    : evidence.evidenceType;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/50 dark:border-white/[0.05]">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.03]"
        aria-expanded={expanded}
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="flex-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
          {evidence.explanation || typeLabel}
        </span>
        {evidence.weight > 0 && (
          <span className="flex-shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {Math.round(evidence.weight * 100)}%
          </span>
        )}
        {expanded ? (
          <ChevronDown size={11} className="flex-shrink-0 text-slate-600" />
        ) : (
          <ChevronRight size={11} className="flex-shrink-0 text-slate-600" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-slate-200/40 bg-slate-50/30 px-2.5 py-2 dark:border-white/[0.03] dark:bg-white/[0.01]">
          <div className="space-y-1 text-[10px] text-slate-600 dark:text-slate-300">
            {evidence.contributionValue != null && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('finance.explainPanel.contribution', 'Contribution')}
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {Number(evidence.contributionValue).toLocaleString('pl-PL')}
                </span>
              </div>
            )}
            {evidence.source && (
              <div className="space-y-0.5">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                  {sourceLabel}
                </div>
                {evidence.source.rowLabel && (
                  <div className="text-slate-700 dark:text-slate-200">
                    {evidence.source.rowLabel}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 text-[9px] text-slate-500 dark:text-slate-400">
                  {evidence.source.sourcePage != null && (
                    <span>p. {evidence.source.sourcePage}</span>
                  )}
                  {evidence.source.sourceRow != null && (
                    <span>row {evidence.source.sourceRow}</span>
                  )}
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

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-[3px]">
      <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">{children}</span>
    </div>
  );
}

export const StatementExplainPanel: React.FC<Props> = ({
  explain,
  selectedRow,
  currency,
  title,
  emptyLabel,
  mappingLabel,
  originLabel,
  confidenceLabel,
  sourceLabel,
  noEvidenceLabel,
}) => {
  const { t } = useTranslation();

  const panelRef = useRef<HTMLDivElement>(null);
  const [animKey, setAnimKey] = useState(0);
  const [techOpen, setTechOpen] = useState(true);

  useEffect(() => {
    setAnimKey((prev) => prev + 1);
  }, [explain?.valueId]);

  const mappingStatusKey = String(explain?.mappingStatus || 'auto').toLowerCase();
  const mappingCfg = MAPPING_STATUS_CONFIG[mappingStatusKey] || MAPPING_STATUS_CONFIG.auto;

  const periodValues = selectedRow?.periodValues;
  const hasPeriods = Array.isArray(periodValues) && periodValues.length >= 2;
  const newerVal = hasPeriods ? periodValues![0]?.value : null;
  const olderVal = hasPeriods ? periodValues![1]?.value : null;
  const delta =
    newerVal != null && olderVal != null && olderVal !== 0
      ? ((newerVal - olderVal) / Math.abs(olderVal)) * 100
      : null;

  return (
    <div
      ref={panelRef}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/90"
      aria-live="polite"
      aria-label={title}
    >
      {!explain ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100/80 dark:bg-white/[0.05]">
            <FileSearch size={20} className="text-slate-600 dark:text-slate-500" />
          </div>
          <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400 max-w-[220px] leading-relaxed">
            {emptyLabel}
          </div>
        </div>
      ) : (
        <div
          key={animKey}
          className="animate-in fade-in slide-in-from-right-2 flex flex-1 flex-col overflow-hidden duration-200"
        >
          {/* ═══════════════════════════════════════════
              UPPER: Analytical context
              ═══════════════════════════════════════════ */}
          <div className="flex-shrink-0 space-y-3 border-b border-slate-200/60 px-4 py-4 dark:border-white/[0.06]">
            {/* Line item name + value */}
            <div>
              <div className="flex items-start gap-2">
                <BookOpen
                  size={14}
                  className="mt-0.5 flex-shrink-0 text-slate-600 dark:text-slate-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-snug text-slate-900 dark:text-white">
                    {explain.originalLabel}
                  </div>
                  {explain.mappedTo && explain.mappedTo !== explain.originalLabel && (
                    <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                      → {explain.mappedTo}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Big value + delta */}
            <div className="flex items-end justify-between">
              <div>
                <div className="font-mono text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
                  {new Intl.NumberFormat('pl-PL', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                    useGrouping: true,
                  }).format(explain.value || 0)}
                </div>
                {currency && (
                  <div className="text-[10px] font-medium text-slate-600 dark:text-slate-500">
                    {currency}
                  </div>
                )}
              </div>
              {delta != null && (
                <div
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold tabular-nums ${
                    delta > 0
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : delta < 0
                        ? 'bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-400'
                        : 'bg-slate-50 text-slate-500 dark:bg-white/[0.04] dark:text-slate-400'
                  }`}
                >
                  {delta > 0 ? (
                    <TrendingUp size={13} />
                  ) : delta < 0 ? (
                    <TrendingDown size={13} />
                  ) : null}
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(1)}%
                </div>
              )}
            </div>

            {/* Period comparison mini-table */}
            {hasPeriods && (
              <div className="grid grid-cols-2 gap-2">
                {periodValues!
                  .slice(0, 2)
                  .reverse()
                  .map((pv: any, i: number) => (
                    <div
                      key={i}
                      className={`rounded-lg px-2.5 py-1.5 ${
                        i === 1
                          ? 'bg-slate-100/80 dark:bg-white/[0.05]'
                          : 'bg-slate-50/60 dark:bg-white/[0.025]'
                      }`}
                    >
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                        {pv.periodLabel ||
                          (i === 0
                            ? t('finance.explainPanel.priorPeriod', 'Prior')
                            : t('finance.explainPanel.currentPeriod', 'Current'))}
                      </div>
                      <div
                        className={`font-mono text-[13px] tabular-nums ${
                          i === 1
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-medium text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {pv.value != null
                          ? new Intl.NumberFormat('pl-PL', { useGrouping: true }).format(pv.value)
                          : '—'}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Analyst comment placeholder */}
            <div className="rounded-lg border border-dashed border-slate-200/60 px-2.5 py-2 dark:border-white/[0.05]">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-500">
                <MessageSquare size={11} />
                <span className="italic">
                  {t('finance.explainPanel.addAnalystComment', 'Click to add analyst comment...')}
                </span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              LOWER: Technical details (collapsible)
              ═══════════════════════════════════════════ */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <button
              type="button"
              onClick={() => setTechOpen((prev) => !prev)}
              className="flex flex-shrink-0 items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-slate-50/40 dark:hover:bg-white/[0.02]"
            >
              <Cog size={12} className="text-slate-600 dark:text-slate-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                {t('finance.explainPanel.technicalDetails', 'Technical details')}
              </span>
              {techOpen ? (
                <ChevronDown size={11} className="ml-auto text-slate-600" />
              ) : (
                <ChevronRight size={11} className="ml-auto text-slate-600" />
              )}
            </button>

            {techOpen && (
              <div className="flex-1 overflow-auto px-4 pb-4">
                <div className="space-y-3">
                  {/* Mapping flow */}
                  <div className="rounded-lg bg-slate-50/60 p-2.5 dark:bg-white/[0.02]">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500 mb-1.5">
                      {mappingLabel}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="truncate rounded bg-white px-1.5 py-0.5 font-medium text-slate-700 shadow-sm dark:bg-white/[0.06] dark:text-slate-200">
                        {explain.originalLabel}
                      </span>
                      <ArrowRight size={10} className="flex-shrink-0 text-slate-600" />
                      <span className="truncate rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700 shadow-sm dark:bg-blue-500/10 dark:text-blue-300">
                        {explain.mappedTo || explain.lineCode || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Metadata grid */}
                  <div className="space-y-0 divide-y divide-slate-200/40 dark:divide-white/[0.04]">
                    <MetaRow label="Status">
                      <span className="inline-flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${mappingCfg.dotColor}`} />
                        {t(mappingCfg.i18nKey, mappingCfg.fallback)}
                      </span>
                    </MetaRow>
                    <MetaRow label={originLabel}>{explain.valueOrigin || 'source'}</MetaRow>
                    {explain.lineCode && (
                      <MetaRow label={t('finance.explainPanel.lineCode', 'Line code')}>
                        <span className="inline-flex items-center gap-1 font-mono text-[10px]">
                          <Hash size={9} className="text-slate-600" />
                          {explain.lineCode}
                        </span>
                      </MetaRow>
                    )}
                    <div className="py-[3px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {confidenceLabel}
                        </span>
                      </div>
                      <ConfidenceBar value={Number(explain.mappingConfidence || 0)} />
                    </div>
                  </div>

                  {/* Evidence */}
                  <div>
                    <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                      {sourceLabel}
                    </div>
                    {explain.evidences.length > 0 ? (
                      <div className="space-y-1.5">
                        {explain.evidences.map((evidence, index) => (
                          <EvidenceCard
                            key={`${evidence.evidenceType}-${index}`}
                            evidence={evidence}
                            index={index}
                            sourceLabel={sourceLabel}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200/50 px-2.5 py-3 text-center text-[11px] text-slate-500 dark:border-white/[0.05] dark:text-slate-400">
                        {noEvidenceLabel}
                      </div>
                    )}
                  </div>

                  {/* Selected mapping candidate */}
                  {explain.selectedMappingCandidate && (
                    <div className="rounded-lg bg-slate-50/60 p-2.5 dark:bg-white/[0.02]">
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500 mb-1">
                        {t('finance.explainPanel.selectedCandidate', 'Selected candidate')}
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-200">
                        Score:{' '}
                        <span className="font-mono font-bold">
                          {Math.round(explain.selectedMappingCandidate.score * 100)}%
                        </span>
                      </div>
                      {explain.selectedMappingCandidate.reason && (
                        <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          {explain.selectedMappingCandidate.reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * InitiativeCoverageWaveView — portfolio-hygiene view for the Initiative Generator
 * (Formula §5 + Faza 5). Two lenses on a "Propose" run after triage:
 *
 *  1) Coverage (MECE) — surfaces strategic goals with NO initiative (gaps / white
 *     spots) and flags heavy-overlap MECE violations, so the portfolio stays
 *     mutually-exclusive & collectively-exhaustive.
 *  2) Waves — sequences the ACCEPTED items into Now / Next / Later using a simple
 *     impact×effort heuristic, with a per-wave WIP capacity guard.
 *
 * Props-decoupled & additive: takes an already-computed CoverageReport (from
 * services/initiatives/proposalReconciliation) + a flat list of accepted items.
 * Knows nothing about hubs or the rebuilt initiative model — composes anywhere.
 */
import { AlertTriangle, CheckCircle2, Layers, Rocket, ShieldCheck } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CoverageReport } from '@/services/initiatives/proposalReconciliation';

export interface AcceptedItem {
  title: string;
  impact?: 'low' | 'medium' | 'high' | 'very_high';
  effort?: 'S' | 'M' | 'L';
  goalKey?: string;
}

export interface InitiativeCoverageWaveViewProps {
  coverage: CoverageReport;
  accepted: AcceptedItem[];
  /** Max items per wave before a capacity warning shows. Default 3. */
  wipLimit?: number;
  isPolish?: boolean;
}

type WaveId = 'now' | 'next' | 'later';

type WaveMeta = {
  id: WaveId;
  pl: string;
  en: string;
  dot: string;
  chip: string;
};

const WAVES: WaveMeta[] = [
  {
    id: 'now',
    pl: 'Teraz',
    en: 'Now',
    dot: 'bg-emerald-500',
    chip: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15',
  },
  {
    id: 'next',
    pl: 'Następne',
    en: 'Next',
    dot: 'bg-blue-500',
    chip: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15',
  },
  {
    id: 'later',
    pl: 'Później',
    en: 'Later',
    dot: 'bg-slate-400',
    chip: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-navy-800',
  },
];

const isHighImpact = (impact?: AcceptedItem['impact']): boolean =>
  impact === 'high' || impact === 'very_high';

/**
 * Bucket one item into a wave via impact×effort:
 *  - high-impact + low-effort (S)           → Now   (quick win)
 *  - high-impact + high-effort, or medium   → Next
 *  - UNSIZED (no impact yet — sized later in the Charter) → Next (plan it, size it there)
 *  - explicitly low-impact                  → Later
 *
 * NOTE: at the proposal stage candidates are not yet sized (impact/effort are set in
 * the Charter), so treating "unsized" as Later would dump everything into Later. We
 * default unsized items to Next so the wave view stays meaningful pre-sizing.
 */
const bucketOf = (item: AcceptedItem): WaveId => {
  if (isHighImpact(item.impact)) {
    return item.effort === 'S' ? 'now' : 'next';
  }
  if (item.impact === 'medium') return 'next';
  if (item.impact === undefined) return 'next'; // unsized → plan Next, size in Charter
  return 'later'; // explicitly low impact
};

export const InitiativeCoverageWaveView: React.FC<InitiativeCoverageWaveViewProps> = ({
  coverage,
  accepted,
  wipLimit = 3,
  isPolish: isPolishProp,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = isPolishProp ?? i18n.language === 'pl';

  const buckets = useMemo(() => {
    const map: Record<WaveId, AcceptedItem[]> = { now: [], next: [], later: [] };
    for (const item of accepted) map[bucketOf(item)].push(item);
    return map;
  }, [accepted]);

  const hasGaps = coverage.gaps.length > 0;
  const overlapCount = coverage.overlaps.length;
  const isClean = !hasGaps && overlapCount === 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* ── 1) Coverage (MECE) ─────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck size={16} className="text-c-info" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('initiatives.initiativeCoverageWaveView.coverageMece')}
          </h3>
          {overlapCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-700 dark:bg-danger-500/15 dark:text-danger-300">
              {t('initiatives.initiativeCoverageWaveView.overlapsCount', { count: overlapCount })}
            </span>
          )}
        </div>

        {isClean ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-300/50 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-slate-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-slate-300">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
            <span>{t('initiatives.initiativeCoverageWaveView.cleanMece')}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {hasGaps && (
              <div className="rounded-xl border border-amber-300/50 bg-amber-50/70 px-3.5 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={14} className="shrink-0" />
                  {t('initiatives.initiativeCoverageWaveView.goalsWithNoInitiative')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {coverage.gaps.map((gap) => (
                    <span
                      key={gap}
                      className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                    >
                      {gap}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {overlapCount > 0 && (
              <div className="rounded-xl border border-danger-300/50 bg-danger-50/70 px-3.5 py-2.5 text-xs text-danger-700 dark:border-danger-500/20 dark:bg-danger-500/10 dark:text-danger-300">
                {t('initiatives.initiativeCoverageWaveView.overlappingScopesDetected')}{' '}
                <span className="font-semibold">{overlapCount}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 2) Waves ───────────────────────────────────────────────────── */}
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center gap-2">
          <Layers size={16} className="text-c-info" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('initiatives.initiativeCoverageWaveView.waves')}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('initiatives.initiativeCoverageWaveView.acceptedCountLimit', {
              count: accepted.length,
              wipLimit,
            })}
          </span>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-3">
          {WAVES.map((wave) => {
            const items = buckets[wave.id];
            const overCapacity = items.length > wipLimit;
            return (
              <div
                key={wave.id}
                className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3 dark:border-navy-700/60 dark:bg-navy-800/40"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${wave.chip}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${wave.dot}`} />
                    {isPolish ? wave.pl : wave.en}
                  </span>
                  <span className="text-[11px] text-slate-400">{items.length}</span>
                </div>

                {overCapacity && (
                  <div className="mb-2 flex items-start gap-1.5 rounded-lg border border-danger-300/50 bg-danger-50/70 px-2 py-1.5 text-[11px] font-medium text-danger-700 dark:border-danger-500/20 dark:bg-danger-500/10 dark:text-danger-300">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>
                      {t('initiatives.initiativeCoverageWaveView.overCapacity', {
                        count: items.length,
                        wipLimit,
                      })}
                    </span>
                  </div>
                )}

                <div className="min-h-0 flex-1 space-y-1.5 overflow-auto pr-0.5">
                  {items.length === 0 ? (
                    <div className="flex h-full min-h-[60px] flex-col items-center justify-center text-slate-300 dark:text-navy-600">
                      <Rocket size={18} className="mb-1 opacity-50" />
                      <span className="text-[11px] text-slate-400">
                        {t('initiatives.initiativeCoverageWaveView.empty')}
                      </span>
                    </div>
                  ) : (
                    items.map((item, idx) => (
                      <div
                        key={`${item.title}-${idx}`}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 dark:border-navy-700/60 dark:bg-navy-950/30"
                      >
                        <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                          {item.title}
                        </div>
                        {(item.impact || item.effort || item.goalKey) && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                            {item.impact && <span>{item.impact}</span>}
                            {item.effort && <span>· {item.effort}</span>}
                            {item.goalKey && <span>· {item.goalKey}</span>}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default InitiativeCoverageWaveView;

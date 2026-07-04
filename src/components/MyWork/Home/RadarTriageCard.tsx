import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Clock,
  Eye,
  FileWarning,
  Lock,
  Shield,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { HomeScreenAction, TriageSignal, TriageState } from './homeV2Types';

const TK = 'myWork.radar.triage';

const PRIORITY_BADGE: Record<TriageSignal['priorityLevel'], string> = {
  P0: 'border-danger-400/45 bg-danger-500/15 text-danger-200',
  P1: 'border-amber-400/40 bg-amber-500/12 text-amber-100',
  P2: 'border-slate-500/40 bg-slate-500/12 text-slate-200',
};

const PRIORITY_BORDER: Record<TriageSignal['priorityLevel'], string> = {
  P0: 'border-l-danger-400',
  P1: 'border-l-amber-400',
  P2: 'border-l-slate-400',
};

const DEGRADED_META: Record<
  Exclude<TriageState, 'ready'>,
  { icon: React.ReactNode; bannerClass: string }
> = {
  degraded_missing_data: {
    icon: <AlertTriangle className="size-3.5 shrink-0 text-amber-300" aria-hidden />,
    bannerClass: 'border-amber-400/25 bg-amber-500/10 text-amber-100',
  },
  degraded_conflict: {
    icon: <FileWarning className="size-3.5 shrink-0 text-danger-300" aria-hidden />,
    bannerClass: 'border-danger-400/25 bg-danger-500/10 text-danger-100',
  },
  degraded_stale: {
    icon: <Clock className="size-3.5 shrink-0 text-slate-300" aria-hidden />,
    bannerClass: 'border-slate-400/25 bg-slate-500/12 text-slate-200',
  },
  blocked_permission: {
    icon: <Lock className="size-3.5 shrink-0 text-slate-300" aria-hidden />,
    bannerClass: 'border-primary-400/25 bg-primary-500/10 text-primary-100',
  },
};

const DEGRADED_TKEY: Record<Exclude<TriageState, 'ready'>, string> = {
  degraded_missing_data: `${TK}.degraded.missing_data`,
  degraded_conflict: `${TK}.degraded.conflict`,
  degraded_stale: `${TK}.degraded.stale`,
  blocked_permission: `${TK}.degraded.permission`,
};

interface RadarTriageCardProps {
  signal: TriageSignal;
  onAction: (action: HomeScreenAction) => void;
}

export function RadarTriageCard({ signal, onAction }: RadarTriageCardProps) {
  const { t } = useTranslation();
  const hasHardGate = signal.triggeredRules.length > 0;
  const u = signal.uncertaintyBoundary;
  const hasUncertainty =
    u.missingInputs.length > 0 || u.conflicts.length > 0 || u.whatWouldChangeRanking.length > 0;

  const handleHandoff = () => {
    onAction({
      type: 'handoff',
      signalId: signal.signalId,
      targetModule: signal.nextAction.targetModule,
      handoffIntent: signal.nextAction.handoffIntent,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {signal.triageState !== 'ready' && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
            DEGRADED_META[signal.triageState].bannerClass
          )}
          role="status"
        >
          {DEGRADED_META[signal.triageState].icon}
          <span className="leading-snug">{t(DEGRADED_TKEY[signal.triageState])}</span>
        </div>
      )}

      <div
        className={cn(
          'rounded-xl border border-c-border-subtle bg-white/[0.04] pl-3 pr-2.5 py-2.5 shadow-sm backdrop-blur-sm',
          'border-l-[3px]',
          PRIORITY_BORDER[signal.priorityLevel]
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 gap-y-1">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              PRIORITY_BADGE[signal.priorityLevel]
            )}
          >
            {signal.priorityLevel}
            <span className="font-semibold normal-case tracking-normal text-white/90">
              {t(`${TK}.score`, { score: signal.score })}
            </span>
          </span>
          <span className="rounded-md border border-c-border-subtle bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">
            {t(`${TK}.category.${signal.category}`)}
          </span>
          {hasHardGate && (
            <span className="rounded-md border border-danger-400/35 bg-danger-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-danger-200">
              {t(`${TK}.hardGate`)}
            </span>
          )}
        </div>

        <div className="mt-2 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {t(`${TK}.whyNow`)}
          </div>
          <p className="text-xs leading-relaxed text-slate-200">{signal.whyNow.rationaleText}</p>
          <div className="flex flex-wrap gap-1">
            <span className="inline-flex items-center gap-1 rounded border border-c-border-subtle bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-300">
              <Clock className="size-3 opacity-70" aria-hidden />
              {t(`${TK}.timeWindow.${signal.whyNow.timeWindow}`)}
            </span>
            <span className="rounded border border-c-border-subtle bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-300">
              {t(`${TK}.driver.${signal.whyNow.primaryDriver}`)}
            </span>
          </div>
        </div>

        <div className="mt-2 border-t border-white/[0.08] pt-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <Eye className="size-3" aria-hidden />
            {t(`${TK}.evidence`)}
            <span
              className={cn(
                'ml-auto rounded px-1 py-0.5 text-[9px] font-semibold normal-case tracking-normal',
                signal.evidence.sourceCoverage === 'complete'
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'bg-amber-500/12 text-amber-100'
              )}
            >
              {signal.evidence.sourceCoverage === 'complete'
                ? t(`${TK}.evidenceComplete`)
                : t(`${TK}.evidencePartial`)}
            </span>
          </div>
          <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
            {signal.evidence.evidencePointers.map((p, i) => (
              <li key={`${p.ref}-${i}`} className="flex gap-1.5 leading-snug">
                <span className="shrink-0 text-slate-500">{p.type}</span>
                <span className="min-w-0 break-words text-slate-200">{p.ref}</span>
              </li>
            ))}
          </ul>
        </div>

        {hasUncertainty && (
          <div className="mt-2 border-t border-white/[0.08] pt-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Shield className="size-3" aria-hidden />
              {t(`${TK}.uncertainty`)}
            </div>
            {u.missingInputs.length > 0 && (
              <div className="mt-1">
                <div className="text-[10px] font-semibold text-slate-400">
                  {t(`${TK}.missingInputs`)}
                </div>
                <ul className="mt-0.5 list-inside list-disc text-[11px] text-slate-300">
                  {u.missingInputs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {u.conflicts.length > 0 && (
              <div className="mt-1">
                <div className="text-[10px] font-semibold text-slate-400">
                  {t(`${TK}.conflicts`)}
                </div>
                <ul className="mt-0.5 list-inside list-disc text-[11px] text-slate-300">
                  {u.conflicts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {u.whatWouldChangeRanking.length > 0 && (
              <div className="mt-1">
                <div className="text-[10px] font-semibold text-slate-400">
                  {t(`${TK}.wouldChange`)}
                </div>
                <ul className="mt-0.5 list-inside list-disc text-[11px] text-slate-300">
                  {u.whatWouldChangeRanking.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-2 border-t border-white/[0.08] pt-2">
          <div className="text-[10px] text-slate-400">
            <span className="font-semibold text-slate-500">{t(`${TK}.owner`)}</span>
            <span className="text-slate-300"> · {signal.ownership.ownerRole}</span>
          </div>
          <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {t(`${TK}.nextAction`)}
          </div>
          <div className="mt-1 flex gap-1.5">
            <button
              type="button"
              onClick={handleHandoff}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-c-border-subtle bg-white/[0.08] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.12]"
            >
              {t(`${TK}.goTo`, { module: signal.nextAction.targetModule })}
              <ArrowRight className="size-3.5 opacity-80" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onAction({ type: 'create', target: 'note' })}
              title={t(`${TK}.saveToNotebook`, 'Save to Notebook')}
              className="flex items-center justify-center gap-1 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-2 py-1.5 text-[11px] font-medium text-indigo-200 transition hover:bg-indigo-500/20"
            >
              <BookOpen className="size-3.5" aria-hidden />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
            {t(`${TK}.fallback`, { fallback: signal.nextAction.safeFallback })}
          </p>
        </div>
      </div>
    </div>
  );
}

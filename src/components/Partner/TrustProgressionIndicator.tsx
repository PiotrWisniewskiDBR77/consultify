/**
 * TrustProgressionIndicator Component
 *
 * Displays partner trust progression through ecosystem phases
 * Aligned with Consultinity's Trust Progression Model
 */

import { Check, ChevronRight, Circle, Loader2 } from 'lucide-react';
import React from 'react';

import { PartnerTrustPhase, PartnerTrustProgression } from '../../views/partner/types';

interface TrustProgressionIndicatorProps {
  trustProgression: PartnerTrustProgression[];
  currentPhase: PartnerTrustPhase;
  compact?: boolean;
}

const PHASE_ICONS: Record<PartnerTrustPhase, string> = {
  G1_DISCOVERY: '🔍',
  G2_QUALIFICATION: '📚',
  G3_ONBOARDING: '📝',
  G4_ACTIVATION: '🚀',
  G5_ECOSYSTEM: '🌐',
};

export const TrustProgressionIndicator: React.FC<TrustProgressionIndicatorProps> = ({
  trustProgression,
  currentPhase,
  compact = false,
}) => {
  const currentIndex = trustProgression.findIndex((p) => p.phase === currentPhase);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {trustProgression.map((phase, index) => {
          const isCompleted = phase.completedAt;
          const isCurrent = phase.phase === currentPhase;

          return (
            <React.Fragment key={phase.phase}>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-all ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-brand text-white ring-4 ring-brand/20'
                      : 'bg-slate-100 text-slate-400 dark:text-slate-500 dark:bg-white/10'
                }`}
                title={phase.label}
              >
                {isCompleted ? <Check size={14} /> : PHASE_ICONS[phase.phase]}
              </div>
              {index < trustProgression.length - 1 && (
                <div
                  className={`h-0.5 w-4 ${
                    isCompleted ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 p-6 dark:border-navy-700 dark:bg-navy-900/60">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
          Partner Trust Progression
        </h3>
        <div className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          Phase {currentIndex + 1} of {trustProgression.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Progress</span>
          <span>{Math.round(((currentIndex + 1) / trustProgression.length) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-500 transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / trustProgression.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Phase Steps */}
      <div className="space-y-4">
        {trustProgression.map((phase, index) => {
          const isCompleted = phase.completedAt;
          const isCurrent = phase.phase === currentPhase;
          const isFuture = index > currentIndex;

          return (
            <div
              key={phase.phase}
              className={`relative flex gap-4 rounded-xl border p-4 transition-all ${
                isCurrent
                  ? 'border-brand bg-brand/5 dark:bg-brand/10'
                  : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5'
                    : 'border-slate-100 bg-slate-50/50 dark:border-navy-700 dark:bg-navy-950/20'
              }`}
            >
              {/* Status Icon */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-brand text-white'
                      : 'bg-slate-100 text-slate-400 dark:text-slate-500 dark:bg-white/10'
                }`}
              >
                {isCompleted ? (
                  <Check size={18} />
                ) : isCurrent ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <span className="text-lg">{PHASE_ICONS[phase.phase]}</span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4
                    className={`font-semibold ${
                      isFuture
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-navy-900 dark:text-white'
                    }`}
                  >
                    {phase.label}
                  </h4>
                  {isCompleted && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                      Completed
                    </span>
                  )}
                  {isCurrent && (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                      In Progress
                    </span>
                  )}
                </div>
                <p
                  className={`mt-1 text-sm ${
                    isFuture
                      ? 'text-slate-400 dark:text-slate-500'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {phase.description}
                </p>

                {/* Requirements */}
                {(isCurrent || isCompleted) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {phase.requirements.map((req, reqIndex) => (
                      <div
                        key={reqIndex}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                        }`}
                      >
                        {isCompleted ? <Check size={10} /> : <Circle size={10} />}
                        {req}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Arrow to next */}
              {index < trustProgression.length - 1 && !isFuture && (
                <ChevronRight
                  size={20}
                  className={`absolute -right-3 top-1/2 -translate-y-1/2 ${
                    isCompleted ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Next Steps CTA */}
      {currentIndex < trustProgression.length - 1 && (
        <div className="mt-6 rounded-xl bg-gradient-to-r from-brand/10 to-emerald-500/10 p-4 dark:from-brand/20 dark:to-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-navy-900 dark:text-white">Next Step</div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Complete remaining requirements to advance to{' '}
                <span className="font-semibold">{trustProgression[currentIndex + 1]?.label}</span>
              </div>
            </div>
            <button className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
              View Tasks
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrustProgressionIndicator;

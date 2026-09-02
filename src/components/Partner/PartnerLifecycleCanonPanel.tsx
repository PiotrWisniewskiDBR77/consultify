import {
  ArrowRight,
  CreditCard,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import React from 'react';

import type { V8PartnerOnboardingStatus } from '@/services/api/v8';

interface PartnerLifecycleCanonPanelProps {
  status?: V8PartnerOnboardingStatus | null;
  compact?: boolean;
  className?: string;
}

type StepCopy = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
};

function buildSteps(status?: V8PartnerOnboardingStatus | null): StepCopy[] {
  const hasPortalState = Boolean(status);
  const agreementReady = Boolean(status?.termsAccepted && status?.privacyAccepted);
  const tierReady = Boolean(status?.pricingTier);
  const payoutReady = Boolean(status?.paymentSetup);
  const activeReady = Boolean(status?.completed);

  return [
    {
      id: 'apply',
      title: 'Apply and qualify',
      description:
        'Application, fit review, and first ecosystem qualification happen before activation.',
      icon: Users,
      completed: hasPortalState,
    },
    {
      id: 'activate',
      title: 'Activate partner profile',
      description:
        'Accept the agreement and lock the commercial tier before deeper workspace access.',
      icon: UserCheck,
      completed: agreementReady && tierReady,
    },
    {
      id: 'workspace',
      title: 'Finish workspace and payouts',
      description:
        'Enable onboarding operations, payout readiness, and partner workspace ownership.',
      icon: CreditCard,
      completed: payoutReady,
    },
    {
      id: 'grow',
      title: 'Grow through academy and progression',
      description:
        'Enablement, certification, and tier progression turn activation into an active partner lifecycle.',
      icon: GraduationCap,
      completed: activeReady,
    },
  ];
}

export const PartnerLifecycleCanonPanel: React.FC<PartnerLifecycleCanonPanelProps> = ({
  status,
  compact = false,
  className = '',
}) => {
  const steps = buildSteps(status);
  const completedCount = steps.filter((step) => step.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <section
      className={[
        'rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-white/90 dark:bg-navy-900/80 shadow-sm',
        compact ? 'p-4' : 'p-6 lg:p-8',
        className,
      ].join(' ')}
    >
      <div className={`flex ${compact ? 'flex-col gap-4' : 'flex-col gap-6'}`}>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-c-border bg-c-surface-raised px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
            <ShieldCheck size={14} />
            Partner lifecycle canon
          </div>
          <h2
            className={`mt-3 font-semibold tracking-tight text-slate-900 dark:text-white ${compact ? 'text-lg' : 'text-2xl lg:text-3xl'}`}
          >
            One path from application to active partner
          </h2>
          <p
            className={`mt-2 max-w-3xl text-slate-600 dark:text-slate-400 ${compact ? 'text-sm' : 'text-base'}`}
          >
            Recruitment, activation, enablement, and earnings should read as one governed ecosystem
            lifecycle rather than separate partner pages.
          </p>
        </div>

        <div
          className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.3fr_0.9fr]'}`}
        >
          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              Canonical partner journey
            </div>
            <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.id}
                    className="rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          step.completed
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300'
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            step.completed
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300'
                          }`}
                        >
                          {step.completed ? 'Done' : 'Open'}
                        </span>
                        {index < steps.length - 1 ? (
                          <ArrowRight size={14} className="text-slate-300 dark:text-slate-600" />
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                      {step.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {step.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              What closure must include
            </div>
            <div className="space-y-3">
              {[
                'Application, activation, and enablement need one visible ownership chain.',
                'Tier progression, academy, and earnings should reinforce each other instead of living in separate silos.',
                'Active partner status should unlock a real workspace, not just a bounded shell.',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-3"
                >
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <ShieldCheck size={14} />
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-c-border bg-c-surface-raised p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
                Lifecycle progress
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-navy-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-navy-900 to-blue-600"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {progress}%
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Application', 'Activation', 'Academy', 'Earnings'].map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm dark:bg-navy-900 dark:text-slate-200"
                  >
                    <Sparkles size={12} />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

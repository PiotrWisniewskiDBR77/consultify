import {
  ArrowRight,
  CheckCircle2,
  Link2,
  Radar,
  Settings2,
  ShieldCheck,
  TestTube2,
} from 'lucide-react';
import React from 'react';

interface EasySyncSetupShellPanelProps {
  compact?: boolean;
  className?: string;
}

const STEPS = [
  {
    id: 'choose',
    title: 'Choose provider',
    description:
      'Start from one catalog of supported providers and pick the governed connector lane.',
    icon: Link2,
  },
  {
    id: 'authorize',
    title: 'Connect and authorize',
    description: 'Run the provider auth step before the integration can claim a ready state.',
    icon: ShieldCheck,
  },
  {
    id: 'map',
    title: 'Configure scope and mapping',
    description: 'Complete required fields, scope, and ownership before sync becomes operational.',
    icon: Settings2,
  },
  {
    id: 'test',
    title: 'Test and enable',
    description:
      'Validation and trial runs should happen before opening the connector for real use.',
    icon: TestTube2,
  },
  {
    id: 'monitor',
    title: 'Monitor and recover',
    description: 'Health, reauth, and recovery belong to the same user journey after setup.',
    icon: Radar,
  },
];

export const EasySyncSetupShellPanel: React.FC<EasySyncSetupShellPanelProps> = ({
  compact = false,
  className = '',
}) => {
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
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200/80 dark:border-primary-500/20 bg-primary-50 dark:bg-primary-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
            <ShieldCheck size={14} />
            Easy-sync setup shell
          </div>
          <h2
            className={`mt-3 font-semibold tracking-tight text-slate-900 dark:text-white ${compact ? 'text-lg' : 'text-2xl lg:text-3xl'}`}
          >
            One canonical provider connect journey
          </h2>
          <p
            className={`mt-2 max-w-3xl text-slate-600 dark:text-slate-400 ${compact ? 'text-sm' : 'text-base'}`}
          >
            Users should be able to choose, connect, authorize, configure, test, and monitor a
            provider without guessing which sync surface owns the next step.
          </p>
        </div>

        <div
          className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.3fr_0.9fr]'}`}
        >
          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              Canonical setup path
            </div>
            <div
              className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}
            >
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.id}
                    className="rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                        <Icon size={16} />
                      </div>
                      {index < STEPS.length - 1 ? (
                        <ArrowRight size={14} className="text-slate-600 dark:text-slate-400" />
                      ) : null}
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
              Setup closure rules
            </div>
            <div className="space-y-3">
              {[
                'A provider is not truly connected until authorization and required configuration both finish.',
                'Validation and monitoring belong to the same setup contract, not a separate admin-only world.',
                'Recovery steps should be visible from the same setup shell that started the connection.',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-3"
                >
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <CheckCircle2 size={14} />
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

import { ArrowRight, BellRing, Mail, MessageSquare, ShieldCheck, Workflow } from 'lucide-react';
import React from 'react';

interface CommunicationSurfaceModelPanelProps {
  compact?: boolean;
  className?: string;
}

const FLOWS = [
  {
    id: 'internal',
    title: 'Internal discussion -> work',
    description:
      'Internal messages should route into tasks, decisions, approvals, and execution signals.',
    icon: MessageSquare,
  },
  {
    id: 'external',
    title: 'External delivery -> context',
    description:
      'Client-facing updates must stay tied to business context, artifacts, and delivery state.',
    icon: Mail,
  },
  {
    id: 'routing',
    title: 'Policy-aware channel routing',
    description:
      'The product must show which channels are allowed, who can send, and what path owns delivery.',
    icon: ShieldCheck,
  },
  {
    id: 'conversion',
    title: 'Message -> action conversion',
    description:
      'Communication becomes governed work when extraction, triage, and follow-up are explicit.',
    icon: Workflow,
  },
];

export const CommunicationSurfaceModelPanel: React.FC<CommunicationSurfaceModelPanelProps> = ({
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
            Communication surface model
          </div>
          <h2
            className={`mt-3 font-semibold tracking-tight text-slate-900 dark:text-white ${compact ? 'text-lg' : 'text-2xl lg:text-3xl'}`}
          >
            One governed communication family, not a chat clone
          </h2>
          <p
            className={`mt-2 max-w-3xl text-slate-600 dark:text-slate-400 ${compact ? 'text-sm' : 'text-base'}`}
          >
            Communication should preserve context, separate internal from external channels, and
            convert messages into visible governed work.
          </p>
        </div>

        <div
          className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.3fr_0.9fr]'}`}
        >
          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              Canonical communication flows
            </div>
            <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
              {FLOWS.map((flow, index) => {
                const Icon = flow.icon;
                return (
                  <div
                    key={flow.id}
                    className="rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                        <Icon size={16} />
                      </div>
                      {index < FLOWS.length - 1 ? (
                        <ArrowRight size={14} className="text-slate-600 dark:text-slate-400" />
                      ) : null}
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                      {flow.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {flow.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              Surface family rules
            </div>
            <div className="space-y-3">
              {[
                'Chat remains the AI conversation shell, not the communication product itself.',
                'Inbox remains the action queue where routed messages become work.',
                'Sync remains channel mechanics, while communication owns routing clarity and delivery meaning.',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-3"
                >
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <BellRing size={14} />
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

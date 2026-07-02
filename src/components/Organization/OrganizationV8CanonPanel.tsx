import {
  BadgeCheck,
  Building2,
  Globe2,
  MapPinned,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import React from 'react';

interface OrganizationV8CanonPanelProps {
  compact?: boolean;
  className?: string;
}

const PILLARS = [
  {
    id: 'identity',
    title: 'Profile and branding',
    description:
      'Define who the organization is, how it presents itself, and the tenant identity others trust.',
    icon: Building2,
  },
  {
    id: 'ownership',
    title: 'Ownership and lifecycle',
    description:
      'Make ownership, roles, invitations, and tenant continuity explicit rather than implicit.',
    icon: Users,
  },
  {
    id: 'regional',
    title: 'Regional and fiscal defaults',
    description:
      'Country, currency, language, and fiscal assumptions should govern downstream runtime behavior.',
    icon: MapPinned,
  },
  {
    id: 'trust',
    title: 'Domains and trust controls',
    description:
      'Approved domains and related controls make the tenant boundary visible and enforceable.',
    icon: ShieldCheck,
  },
];

export const OrganizationV8CanonPanel: React.FC<OrganizationV8CanonPanelProps> = ({
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
            <BadgeCheck size={14} />
            Organization v8 canon
          </div>
          <h2
            className={`mt-3 font-semibold tracking-tight text-slate-900 dark:text-white ${compact ? 'text-lg' : 'text-2xl lg:text-3xl'}`}
          >
            One canonical tenant organization product
          </h2>
          <p
            className={`mt-2 max-w-3xl text-slate-600 dark:text-slate-400 ${compact ? 'text-sm' : 'text-base'}`}
          >
            Organization should define identity, operating defaults, trust boundaries, and reusable
            tenant context before wider settings and admin surfaces branch out.
          </p>
        </div>

        <div
          className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.35fr_0.9fr]'}`}
        >
          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              Canonical organization model
            </div>
            <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
              {PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.id}
                    className="rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-4"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                      <Icon size={18} />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                      {pillar.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {pillar.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              Downstream reuse contract
            </div>
            <div className="space-y-3">
              {[
                {
                  icon: Sparkles,
                  text: 'AI context and assistance should inherit org identity, language, and operating defaults.',
                },
                {
                  icon: Globe2,
                  text: 'Partner, sync, and external trust surfaces should reuse domains, locale, and tenant metadata.',
                },
                {
                  icon: ShieldCheck,
                  text: 'Admin and settings layers should extend organization truth, not duplicate or redefine it.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.text}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-3"
                  >
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Icon size={14} />
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

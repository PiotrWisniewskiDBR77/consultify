import { Activity, Bot, Building2, LifeBuoy, ShieldCheck, Waypoints } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface SuperadminRootClosurePanelProps {
  compact?: boolean;
  className?: string;
}

type Locale = 'en' | 'pl';

interface RootCopy {
  badge: string;
  title: string;
  subtitle: string;
  branchesTitle: string;
  closureTitle: string;
  branches: Array<{ id: string; title: string; description: string }>;
  rules: string[];
}

const COPY: Record<Locale, RootCopy> = {
  en: {
    badge: 'Superadmin root closure',
    title: 'One visible platform control plane',
    subtitle:
      'Superadmin should mount the major operator branches in one clear root so cross-tenant health, governance, and intervention do not depend on hidden paths.',
    branchesTitle: 'Mounted platform branches',
    closureTitle: 'Control-plane closure rules',
    branches: [
      {
        id: 'tenants',
        title: 'Tenants and customers',
        description: 'Organizations, users, communication, and support operations must stay visible as one cross-tenant branch.',
      },
      {
        id: 'ai',
        title: 'AI and connector platform ops',
        description: 'AI platform, fleet health, and connector governance belong to the same operator root.',
      },
      {
        id: 'control',
        title: 'Security, revenue, and configuration',
        description: 'Revenue, auditability, compliance, and platform configuration should read as mounted control towers, not hidden fragments.',
      },
    ],
    rules: [
      'Superadmin owns cross-tenant intervention and never collapses back into tenant admin.',
      'Root visibility matters: critical branches must be discoverable without hidden legacy routes.',
      'Health, support, and emergency controls should reinforce one platform operator model.',
    ],
  },
  pl: {
    badge: 'Superadmin root closure',
    title: 'Jeden widoczny platform control plane',
    subtitle:
      'Superadmin powinien montowac glowne galezie operatorskie w jednym rootcie, aby health, governance i interwencje cross-tenant nie zalezaly od ukrytych sciezek.',
    branchesTitle: 'Zamontowane galezie platformy',
    closureTitle: 'Reguly domkniecia control plane',
    branches: [
      {
        id: 'tenants',
        title: 'Tenants i customers',
        description: 'Organizacje, users, komunikacja i support musza byc widoczne jako jedna galaz cross-tenant.',
      },
      {
        id: 'ai',
        title: 'AI i connector platform ops',
        description: 'AI platform, fleet health i connector governance naleza do tego samego operator rootu.',
      },
      {
        id: 'control',
        title: 'Security, revenue i configuration',
        description: 'Revenue, auditability, compliance i platform configuration powinny byc widoczne jako control towers, a nie ukryte fragmenty.',
      },
    ],
    rules: [
      'Superadmin odpowiada za interwencje cross-tenant i nie moze zlewac sie z tenant adminem.',
      'Widocznosc rootu ma znaczenie: krytyczne galezie musza byc odkrywalne bez ukrytych legacy routes.',
      'Health, support i emergency controls powinny wzmacniac jeden model operatora platformy.',
    ],
  },
};

export const SuperadminRootClosurePanel: React.FC<SuperadminRootClosurePanelProps> = ({
  compact = false,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const locale: Locale = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const copy = COPY[locale];
  const icons = [Building2, Bot, Activity];

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
            <Waypoints size={14} />
            {copy.badge}
          </div>
          <h2
            className={`mt-3 font-semibold tracking-tight text-slate-900 dark:text-white ${compact ? 'text-lg' : 'text-2xl lg:text-3xl'}`}
          >
            {copy.title}
          </h2>
          <p className={`mt-2 max-w-3xl text-slate-600 dark:text-slate-400 ${compact ? 'text-sm' : 'text-base'}`}>
            {copy.subtitle}
          </p>
        </div>

        <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.3fr_0.95fr]'}`}>
          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              {copy.branchesTitle}
            </div>
            <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
              {copy.branches.map((branch, index) => {
                const Icon = icons[index] || LifeBuoy;
                return (
                  <div
                    key={branch.id}
                    className="rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-4"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                      <Icon size={18} />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                      {branch.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {branch.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              {copy.closureTitle}
            </div>
            <div className="space-y-3">
              {copy.rules.map((rule) => (
                <div
                  key={rule}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-3"
                >
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <ShieldCheck size={14} />
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{rule}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

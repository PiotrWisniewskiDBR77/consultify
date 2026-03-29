import { BellRing, Building2, Gauge, Settings2, Sparkles, UserRound } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface SettingsTaxonomyPanelProps {
  compact?: boolean;
  className?: string;
}

type Locale = 'en' | 'pl';

interface TaxonomyCopy {
  badge: string;
  title: string;
  subtitle: string;
  scopeTitle: string;
  impactTitle: string;
  scopes: Array<{ id: string; title: string; description: string }>;
  impacts: string[];
}

const COPY: Record<Locale, TaxonomyCopy> = {
  en: {
    badge: 'Settings taxonomy',
    title: 'One settings root with clear ownership',
    subtitle:
      'Users should understand what changes only their experience, what belongs to the tenant, and what stays inside a specific module.',
    scopeTitle: 'Canonical settings scopes',
    impactTitle: 'Runtime-impact controls',
    scopes: [
      {
        id: 'personal',
        title: 'Personal settings',
        description: 'Profile, preferences, security, and AI behavior that affect only the current user.',
      },
      {
        id: 'tenant',
        title: 'Tenant handoff',
        description:
          'Organization and admin defaults own branding, locale, trust boundaries, and shared operating rules.',
      },
      {
        id: 'module',
        title: 'Module settings',
        description:
          'Notifications, integrations, and similar controls should stay discoverable but inherit the root ownership model.',
      },
    ],
    impacts: [
      'Language, timezone, and regional defaults should visibly change runtime behavior.',
      'Notifications, memory, and AI controls should explain what signals and automations they affect.',
      'Tenant-owned defaults should hand off to organization and admin surfaces instead of duplicating them here.',
    ],
  },
  pl: {
    badge: 'Taksonomia ustawien',
    title: 'Jeden root ustawien z jasnym ownership',
    subtitle:
      'Uzytkownik powinien rozumiec, co zmienia tylko jego runtime, co nalezy do tenantu, a co pozostaje ustawieniem konkretnego modulu.',
    scopeTitle: 'Kanoniczne scope ustawien',
    impactTitle: 'Kontrole wplywajace na runtime',
    scopes: [
      {
        id: 'personal',
        title: 'Ustawienia osobiste',
        description: 'Profil, preferencje, bezpieczenstwo i zachowanie AI, ktore dotycza tylko biezacego uzytkownika.',
      },
      {
        id: 'tenant',
        title: 'Handoff do tenantu',
        description:
          'Organization i admin odpowiadaja za branding, locale, granice zaufania i wspolne zasady operacyjne.',
      },
      {
        id: 'module',
        title: 'Ustawienia modulowe',
        description:
          'Notyfikacje, integracje i podobne kontrole powinny byc latwe do znalezienia, ale dzialac w ramach jednego modelu ownership.',
      },
    ],
    impacts: [
      'Jezyk, strefa czasowa i ustawienia regionalne powinny widocznie zmieniac runtime.',
      'Kontrole notyfikacji, memory i AI powinny wyjasniac, na jakie sygnaly i automatyzacje wplywaja.',
      'Defaulty tenantowe powinny przekazywac ownership do organization i admin zamiast dublowac je tutaj.',
    ],
  },
};

export const SettingsTaxonomyPanel: React.FC<SettingsTaxonomyPanelProps> = ({
  compact = false,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const locale: Locale = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const copy = COPY[locale];
  const scopeIcons = [UserRound, Building2, Settings2];

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
            <Gauge size={14} />
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
              {copy.scopeTitle}
            </div>
            <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
              {copy.scopes.map((scope, index) => {
                const Icon = scopeIcons[index] || Settings2;
                return (
                  <div
                    key={scope.id}
                    className="rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-4"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                      <Icon size={18} />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                      {scope.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {scope.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              {copy.impactTitle}
            </div>
            <div className="space-y-3">
              {copy.impacts.map((impact, index) => {
                const Icon = index === 0 ? BellRing : index === 1 ? Sparkles : Building2;
                return (
                  <div
                    key={impact}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-3"
                  >
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Icon size={14} />
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{impact}</p>
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

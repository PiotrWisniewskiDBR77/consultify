import { BellRing, Building2, Gauge, Settings2, Sparkles, UserRound } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface SettingsTaxonomyPanelProps {
  compact?: boolean;
  className?: string;
}

export const SettingsTaxonomyPanel: React.FC<SettingsTaxonomyPanelProps> = ({
  compact = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const scopeIcons = [UserRound, Building2, Settings2];
  const scopes = ['personal', 'tenant', 'module'] as const;
  const impacts = ['regional', 'automation', 'tenantOwned'] as const;

  return (
    <section
      className={[
        'rounded-2xl border border-c-border-subtle dark:border-navy-700 bg-c-surface-raised shadow-sm',
        compact ? 'p-4' : 'p-6 lg:p-8',
        className,
      ].join(' ')}
    >
      <div className={`flex ${compact ? 'flex-col gap-4' : 'flex-col gap-6'}`}>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-c-accent dark:border-c-accent bg-c-accent-soft dark:bg-c-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-c-accent">
            <Gauge size={14} />
            {t('settings.taxonomy.badge', 'Settings taxonomy')}
          </div>
          <h2
            className={`mt-3 font-semibold tracking-tight text-c-text ${compact ? 'text-lg' : 'text-2xl lg:text-3xl'}`}
          >
            {t('settings.taxonomy.title', 'One settings root with clear ownership')}
          </h2>
          <p
            className={`mt-2 max-w-3xl text-c-text-secondary ${compact ? 'text-sm' : 'text-base'}`}
          >
            {t(
              'settings.taxonomy.subtitle',
              'Users should understand what changes only their experience, what belongs to the tenant, and what stays inside a specific module.'
            )}
          </p>
        </div>

        <div
          className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.3fr_0.95fr]'}`}
        >
          <div className="rounded-2xl border border-c-border-subtle dark:border-navy-700 bg-c-surface-raised p-4">
            <div className="mb-4 text-sm font-semibold text-c-text">
              {t('settings.taxonomy.scopeTitle', 'Canonical settings scopes')}
            </div>
            <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
              {scopes.map((scope, index) => {
                const Icon = scopeIcons[index] || Settings2;
                return (
                  <div
                    key={scope}
                    className="rounded-xl border border-c-border-subtle dark:border-navy-700 bg-c-surface p-4"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-c-accent-soft text-c-accent dark:bg-c-accent-soft">
                      <Icon size={18} />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-c-text">
                      {t(`settings.taxonomy.scopes.${scope}.title`, scope)}
                    </div>
                    <div className="mt-1 text-sm text-c-text-secondary">
                      {t(`settings.taxonomy.scopes.${scope}.description`, '')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-c-border-subtle dark:border-navy-700 bg-c-surface-raised p-4">
            <div className="mb-4 text-sm font-semibold text-c-text">
              {t('settings.taxonomy.impactTitle', 'Runtime-impact controls')}
            </div>
            <div className="space-y-3">
              {impacts.map((impact, index) => {
                const Icon = index === 0 ? BellRing : index === 1 ? Sparkles : Building2;
                return (
                  <div
                    key={impact}
                    className="flex items-start gap-3 rounded-xl border border-c-border-subtle dark:border-navy-700 bg-c-surface p-3"
                  >
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Icon size={14} />
                    </div>
                    <p className="text-sm text-c-text-secondary">
                      {t(`settings.taxonomy.impacts.${impact}`, '')}
                    </p>
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

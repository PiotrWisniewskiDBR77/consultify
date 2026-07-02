import { Building2, Settings2, ShieldCheck, Users2, Wrench } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface AdminV8CanonPanelProps {
  compact?: boolean;
  className?: string;
}

type Locale = 'en' | 'pl';

interface CanonCopy {
  badge: string;
  title: string;
  subtitle: string;
  pillarsTitle: string;
  boundaryTitle: string;
  pillars: Array<{ id: string; title: string; description: string }>;
  boundaries: string[];
}

const COPY: Record<Locale, CanonCopy> = {
  en: {
    badge: 'Admin v8 canon',
    title: 'One tenant operator cockpit',
    subtitle:
      'Admin should package team operations, organization controls, and sync ownership into one tenant layer that stays separate from superadmin.',
    pillarsTitle: 'Canonical admin system',
    boundaryTitle: 'Ownership and boundary rules',
    pillars: [
      {
        id: 'team',
        title: 'Team operations',
        description:
          'Membership, access, profiling, and day-to-day tenant operations should live in one operator layer.',
      },
      {
        id: 'org',
        title: 'Organization controls',
        description:
          'Admin extends organization truth with operational control rather than redefining tenant identity.',
      },
      {
        id: 'sync',
        title: 'Sync and integration controls',
        description:
          'Connector setup, health, and recovery belong inside the tenant operator model, not as isolated tooling.',
      },
    ],
    boundaries: [
      'Settings owns personal preferences, while admin owns tenant-scoped operational control.',
      'Organization defines tenant identity and defaults, while admin runs the operating cockpit around them.',
      'Superadmin stays the platform layer for cross-tenant escalation and global control.',
    ],
  },
  pl: {
    badge: 'Admin v8 canon',
    title: 'Jeden cockpit operatora tenantu',
    subtitle:
      'Admin powinien laczyc operacje zespolowe, kontrole organizacyjne i ownership sync w jednej warstwie tenantowej, oddzielonej od superadmina.',
    pillarsTitle: 'Kanoniczny system admin',
    boundaryTitle: 'Reguly ownership i granic',
    pillars: [
      {
        id: 'team',
        title: 'Operacje zespolowe',
        description:
          'Membership, access, profiling i codzienne operacje tenantu powinny byc skupione w jednej warstwie operatora.',
      },
      {
        id: 'org',
        title: 'Kontrole organizacyjne',
        description:
          'Admin rozszerza truth organizacji o kontrole operacyjne zamiast na nowo definiowac tozsamosc tenantu.',
      },
      {
        id: 'sync',
        title: 'Kontrole sync i integracji',
        description:
          'Setup connectorow, health i recovery powinny nalezec do modelu operatora tenantu, a nie do osobnych narzedzi.',
      },
    ],
    boundaries: [
      'Settings odpowiada za preferencje osobiste, a admin za tenantowe kontrole operacyjne.',
      'Organization definiuje tozsamosc tenantu i defaulty, a admin uruchamia wokol nich cockpit operacyjny.',
      'Superadmin pozostaje warstwa platformowa dla eskalacji cross-tenant i globalnego sterowania.',
    ],
  },
};

export const AdminV8CanonPanel: React.FC<AdminV8CanonPanelProps> = ({
  compact = false,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const locale: Locale = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const copy = COPY[locale];
  const pillarIcons = [Users2, Building2, Wrench];

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
            {copy.badge}
          </div>
          <h2
            className={`mt-3 font-semibold tracking-tight text-slate-900 dark:text-white ${compact ? 'text-lg' : 'text-2xl lg:text-3xl'}`}
          >
            {copy.title}
          </h2>
          <p
            className={`mt-2 max-w-3xl text-slate-600 dark:text-slate-400 ${compact ? 'text-sm' : 'text-base'}`}
          >
            {copy.subtitle}
          </p>
        </div>

        <div
          className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.3fr_0.95fr]'}`}
        >
          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              {copy.pillarsTitle}
            </div>
            <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
              {copy.pillars.map((pillar, index) => {
                const Icon = pillarIcons[index] || Settings2;
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
              {copy.boundaryTitle}
            </div>
            <div className="space-y-3">
              {copy.boundaries.map((boundary) => (
                <div
                  key={boundary}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-3"
                >
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <ShieldCheck size={14} />
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{boundary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

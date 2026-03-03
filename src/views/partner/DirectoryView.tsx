import { Briefcase, Globe, Star } from 'lucide-react';
import React, { useCallback } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

const profileStats = [
  { label: 'Company size', value: '11-50' },
  { label: 'Regions', value: 'EMEA, APAC' },
  { label: 'Languages', value: 'English, Polish' },
];

const services = [
  'Digital transformation roadmap',
  'HubSpot implementations',
  'Co-selling enablement',
];

export const DirectoryView: React.FC = () => {
  const { setCurrentView } = useAppStore();
  const handleNavigate = useCallback(
    (view: AppView) => () => setCurrentView(view),
    [setCurrentView]
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-950">
      <div className="space-y-6 px-6 py-4">
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <Briefcase size={16} />
            Company information
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
            Consultify Partners Group
          </p>
          <p className="text-sm text-slate-400">
            Wsparcie dla firm chcących wdrożyć Meta-PMO, przygotować roadmaps i przeprowadzić shared
            selling z klientem.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {profileStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950/40 p-3 text-xs text-slate-600 dark:text-slate-300"
              >
                <p className="font-semibold text-slate-900 dark:text-white">{stat.value}</p>
                <p>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <Globe size={16} />
              Description & coverage
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Dostarczamy wdrożenia w regionie EMEA i APAC. Jesteśmy specjalistami w sprzedaży
              wspólnej, nie tylko wdrożeniowej.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Budżety service packages: &lt;$50k, $50k-$150k, $150k+
            </p>
          </section>
          <section className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <Star size={16} />
              Services
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {services.map((service) => (
                <li
                  key={service}
                  className="rounded-xl border border-slate-200 dark:border-navy-700 px-3 py-2"
                >
                  {service}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Jak budujemy profil katalogowy
          </h3>
          <p className="mt-2 text-xs text-slate-400">
            Każdy profil jest oceniany przez Solutions Directory pod kątem wartości dla
            BENEFITS_REALIZATION, compliance z SCOPE_CHANGE_CONTROL i readiness do co-sellingu.
          </p>
          <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <li>Zawieraj konkretne service bundles i budżety (&lt;$50k / $50k-$150k / $150k+).</li>
            <li>
              Opisuj regiony i języki, aby matching algorytm polecał Ciebie klientom w EMEA/APAC.
            </li>
            <li>
              Dodawaj case studies, aby weryfikować impact i wartość w ramach PRINCE2 Economic case.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-slate-900 dark:text-white">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Directory CTA</p>
              <h3 className="text-lg font-semibold text-brand">
                Zaktualizuj profil i zwiększ widoczność
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleNavigate(AppView.PARTNER_PROVIDER_HOME)}
                className="rounded-xl border border-white/60 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-white transition hover:bg-white/10"
              >
                Wróć do landing
              </button>
              <button
                onClick={handleNavigate(AppView.PARTNER_RESOURCES)}
                className="rounded-xl bg-slate-50 dark:bg-navy-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-white shadow-sm"
              >
                Otwórz resources
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectoryView;

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PortfolioInitiative } from '@/types';
import { getLocalizedStatusLabel } from '@/services/initiativeLifecycle';

/** I01/I02 read-only preparation facts. Durable report runs belong to I06/IE07. */
export function InitiativePreparationReadView({
  initiatives,
  onOpen,
}: {
  initiatives: PortfolioInitiative[];
  onOpen: (initiative: PortfolioInitiative) => void;
}) {
  const { i18n, t } = useTranslation();
  const pl = i18n.language.startsWith('pl');
  const counts = new Map<string, number>();
  initiatives.forEach((item) => counts.set(item.status, (counts.get(item.status) || 0) + 1));
  return (
    <section
      className="h-full overflow-auto p-4 space-y-4 text-c-text"
      aria-label="Preparation overview"
    >
      <h2 className="text-lg font-semibold">
        {pl ? 'Przegląd przygotowania' : 'Preparation overview'}
      </h2>
      <p>
        {initiatives.length}{' '}
        {pl ? 'inicjatyw w bieżącym zakresie' : 'initiatives in the current scope'}
      </p>
      <p className="text-sm text-c-text-muted">
        {pl
          ? 'Bieżący odczyt rejestru. Otwórz inicjatywę, aby sprawdzić braki jakości, przeglądy i decyzje. To podsumowanie nie potwierdza gotowości bramki.'
          : 'Current register facts. Open an initiative to inspect quality findings, reviews and decisions. This summary does not establish gate readiness.'}
      </p>
      <dl className="flex flex-wrap gap-4">
        {[...counts].map(([status, count]) => (
          <div key={status} className="rounded border border-c-border p-3">
            <dt>{getLocalizedStatusLabel(status as PortfolioInitiative['status'], t)}</dt>
            <dd className="text-lg font-semibold">{count}</dd>
          </div>
        ))}
      </dl>
      <ul className="divide-y divide-c-border">
        {initiatives.map((item) => (
          <li key={item.id} className="py-3">
            <button
              className="text-left font-semibold underline focus-visible:ring-2 focus-visible:ring-c-focus"
              onClick={() => onOpen(item)}
            >
              {item.name || item.title || item.id}
            </button>
            <p className="text-sm text-c-text-muted">
              {item.projectName ||
                (pl ? 'Nazwa projektu: brak danych' : 'Project name: unavailable')}{' '}
              ·{' '}
              {item.ownerBusiness
                ? `${item.ownerBusiness.firstName} ${item.ownerBusiness.lastName}`.trim()
                : pl
                  ? 'Właściciel: brak danych'
                  : 'Owner: unavailable'}{' '}
              · {getLocalizedStatusLabel(item.status, t)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

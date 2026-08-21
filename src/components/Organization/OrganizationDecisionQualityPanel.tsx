import { AlertTriangle, CalendarClock, FileQuestion, Scale, UserRound } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const polishDimensions = [
  {
    label: 'Zakres i przeznaczenie decyzji',
    icon: Scale,
    detail: 'Wymagany jest jawny podmiot, okres, jednostki i zamierzony downstream use case.',
  },
  {
    label: 'Źródła i aktualność',
    icon: CalendarClock,
    detail: 'Materiałowe fakty wymagają źródła, daty obowiązywania i terminu przeglądu.',
  },
  {
    label: 'Odpowiedzialność',
    icon: UserRound,
    detail: 'Każdy blocker i konflikt musi mieć właściciela oraz warunek zamknięcia.',
  },
  {
    label: 'Konflikty i braki',
    icon: AlertTriangle,
    detail: 'Brak danych, dane sprzeczne i nieudokumentowane są osobnymi stanami.',
  },
];

const englishDimensions = [
  {
    label: 'Decision scope and intended use',
    icon: Scale,
    detail: 'The subject, period, units, and intended downstream use case must be explicit.',
  },
  {
    label: 'Sources and freshness',
    icon: CalendarClock,
    detail: 'Material facts require a source, effective date, and review date.',
  },
  {
    label: 'Accountability',
    icon: UserRound,
    detail: 'Every blocker and conflict needs an owner and a closure condition.',
  },
  {
    label: 'Conflicts and gaps',
    icon: AlertTriangle,
    detail: 'Missing, conflicting, and undocumented data are distinct states.',
  },
];

export const OrganizationDecisionQualityPanel: React.FC<{ screen: string }> = ({ screen }) => {
  const { i18n } = useTranslation();
  const isPolish = (i18n.resolvedLanguage || i18n.language || 'pl').toLowerCase().startsWith('pl');
  const dimensions = isPolish ? polishDimensions : englishDimensions;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--c-text)]">
              {isPolish ? 'Gotowość decyzyjna' : 'Decision readiness'}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--c-text-secondary)]">
              {isPolish
                ? 'Gotowość nie jest procentem wypełnienia formularza. Wymaga wiarygodnego zakresu, aktualnych źródeł, rozstrzygniętych konfliktów i właścicieli braków.'
                : 'Readiness is not a form-completion percentage. It requires a credible scope, current sources, resolved conflicts, and owners for remaining gaps.'}
            </p>
          </div>
          <span className="rounded-full border border-[var(--c-border)] bg-[var(--c-surface-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--c-text-muted)]">
            UNKNOWN
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {dimensions.map(({ label, icon: Icon, detail }) => (
            <article
              key={label}
              className="rounded-lg border border-[var(--c-border-subtle)] bg-[var(--c-bg)] p-4"
            >
              <div className="flex items-center gap-2">
                <Icon aria-hidden="true" className="h-4 w-4 text-[var(--c-info)]" />
                <h3 className="text-sm font-medium text-[var(--c-text)]">{label}</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--c-text-muted)]">{detail}</p>
            </article>
          ))}
        </div>
      </section>
      <section
        role="status"
        className="flex items-start gap-3 rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-4"
      >
        <FileQuestion
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--c-warning)]"
        />
        <div>
          <h3 className="text-sm font-semibold text-[var(--c-text)]">
            {isPolish ? 'Brak podstaw do deklaracji READY' : 'No basis for a READY declaration'}
          </h3>
          <p className="mt-1 text-sm text-[var(--c-text-secondary)]">
            {isPolish
              ? `Ekran „${screen}” nie publikuje pozytywnego wyniku, dopóki powyższe kryteria nie mają trwałego readbacku. Completeness profilu pozostaje pomocniczą metryką danych.`
              : `“${screen}” does not publish a positive outcome until these criteria have durable readback. Profile completeness remains a supporting data metric.`}
          </p>
        </div>
      </section>
    </div>
  );
};

export const OrganizationFilesBoundary: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = (i18n.resolvedLanguage || i18n.language || 'pl').toLowerCase().startsWith('pl');

  return (
    <section
      role="status"
      className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-6"
    >
      <h2 className="text-base font-semibold text-[var(--c-text)]">
        {isPolish ? 'Pliki organizacji' : 'Organization files'}
      </h2>
      <span className="mt-3 inline-flex rounded-full border border-[var(--c-border)] px-2 py-0.5 text-xs font-semibold text-[var(--c-text-muted)]">
        {isPolish ? 'NIEZWERYFIKOWANE' : 'NOT VERIFIED'}
      </span>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--c-text-secondary)]">
        {isPolish
          ? 'Obecna ekstrakcja dokumentu tworzy wyłącznie propozycje pól. Nie potwierdzono trwałej, wersjonowanej kolekcji plików, dlatego ekran nie pokazuje fikcyjnej listy ani przycisku upload.'
          : 'The current document extraction creates field proposals only. A durable, versioned file collection has not been verified, so this screen shows neither a fictional list nor an upload action.'}
      </p>
    </section>
  );
};

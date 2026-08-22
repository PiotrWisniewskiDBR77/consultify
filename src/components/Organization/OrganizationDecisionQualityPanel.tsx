import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/primitives';
import {
  type GovernedClaim,
  type GovernedSnapshotVersion,
  organizationGovernedContextApi,
} from '@/services/organizationGovernedContextApi';
import type { OrganizationScreen } from './OrganizationSidebar';

function renderValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const OrganizationDecisionQualityPanel: React.FC<{
  screen: OrganizationScreen;
  title: string;
}> = ({ screen, title }) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isPolish = (i18n.resolvedLanguage || i18n.language || 'pl').toLowerCase().startsWith('pl');
  const [claims, setClaims] = useState<GovernedClaim[]>([]);
  const [versions, setVersions] = useState<GovernedSnapshotVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextClaims, nextVersions] = await Promise.all([
        organizationGovernedContextApi.listClaims(),
        organizationGovernedContextApi.listVersions(),
      ]);
      setClaims(nextClaims);
      setVersions(nextVersions);
    } catch {
      setError(
        isPolish
          ? 'Nie udało się odczytać bieżącego stanu organizacji. Dane nie zostały zmienione.'
          : 'The current organization state could not be read. No data was changed.'
      );
    } finally {
      setLoading(false);
    }
  }, [isPolish]);

  useEffect(() => {
    void load();
  }, [load]);

  const conflicts = useMemo(() => {
    const byPath = new Map<string, GovernedClaim[]>();
    claims.forEach((claim) =>
      byPath.set(claim.claimPath, [...(byPath.get(claim.claimPath) ?? []), claim])
    );
    return [...byPath.entries()]
      .map(([path, entries]) => ({
        path,
        entries,
        values: [...new Set(entries.map((entry) => renderValue(entry.value)))],
      }))
      .filter((item) => item.values.length > 1);
  }, [claims]);
  const pending = claims.filter((claim) => claim.reviewState === 'pending');
  const rejected = claims.filter((claim) => claim.reviewState === 'rejected');
  const approved = claims.filter((claim) => claim.approved);
  const lowConfidence = claims.filter((claim) => claim.confidence < 0.7);
  const latestVersion = versions[0] ?? null;
  const ready =
    !loading &&
    !error &&
    approved.length > 0 &&
    pending.length === 0 &&
    conflicts.length === 0 &&
    !!latestVersion;
  const blockerCount = conflicts.length + pending.length + (latestVersion ? 0 : 1);

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)]">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin text-[var(--c-info)]" />
        <span className="text-sm text-[var(--c-text-secondary)]">
          {isPolish
            ? 'Sprawdzam aktualny stan organizacji…'
            : 'Checking the current organization state…'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <section
        role="alert"
        className="rounded-xl border border-[var(--c-danger)] bg-[var(--c-surface)] p-5"
      >
        <h2 className="font-semibold text-[var(--c-text)]">
          {isPolish ? 'Nie można potwierdzić gotowości' : 'Readiness cannot be confirmed'}
        </h2>
        <p className="mt-2 text-sm text-[var(--c-text-secondary)]">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => void load()}>
          {isPolish ? 'Spróbuj ponownie' : 'Try again'}
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-4" data-screen={screen} aria-label={title}>
      <section className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--c-text-muted)]">
              {isPolish ? 'Stan organizacji' : 'Organization status'}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--c-text)]">
              {ready
                ? isPolish
                  ? 'Organizacja jest gotowa do dalszej pracy'
                  : 'The organization is ready for downstream work'
                : isPolish
                  ? `${blockerCount} ${blockerCount === 1 ? 'blokada wymaga' : 'blokady wymagają'} działania`
                  : `${blockerCount} blocker${blockerCount === 1 ? '' : 's'} need attention`}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--c-text-secondary)]">
              {isPolish
                ? 'Poniżej widzisz rzeczywisty stan zatwierdzonych danych, konfliktów i opublikowanej wersji. Każda blokada prowadzi do miejsca, w którym można ją usunąć.'
                : 'Below is the current state of approved data, conflicts, and the published version. Every blocker links to the place where it can be resolved.'}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              ready
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            }`}
          >
            {ready ? 'READY' : isPolish ? 'WYMAGA UWAGI' : 'NEEDS ATTENTION'}
          </span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [isPolish ? 'Zatwierdzone fakty' : 'Approved facts', approved.length, CheckCircle2],
            [isPolish ? 'Otwarte konflikty' : 'Open conflicts', conflicts.length, ShieldAlert],
            [isPolish ? 'Oczekuje na decyzję' : 'Awaiting decision', pending.length, Clock3],
            [
              isPolish ? 'Opublikowana wersja' : 'Published version',
              latestVersion ? `v${latestVersion.version}` : '—',
              FileCheck2,
            ],
          ].map(([label, value, Icon]) => (
            <article
              key={String(label)}
              className="rounded-lg border border-[var(--c-border-subtle)] bg-[var(--c-bg)] p-4"
            >
              {React.createElement(Icon as typeof CheckCircle2, {
                className: 'h-4 w-4 text-[var(--c-info)]',
                'aria-hidden': true,
              })}
              <div className="mt-3 text-2xl font-semibold text-[var(--c-text)]">
                {String(value)}
              </div>
              <div className="mt-1 text-xs text-[var(--c-text-muted)]">{String(label)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--c-text)]">
              {isPolish ? 'Co wymaga działania' : 'What needs action'}
            </h3>
            <p className="mt-1 text-sm text-[var(--c-text-secondary)]">
              {isPolish
                ? 'Tylko pozycje, które wpływają na wiarygodność dalszych analiz.'
                : 'Only items that affect the reliability of downstream analysis.'}
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {isPolish ? 'Odśwież' : 'Refresh'}
          </Button>
        </div>

        {ready ? (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
            <p className="text-sm text-[var(--c-text-secondary)]">
              {isPolish
                ? 'Nie ma otwartych konfliktów ani oczekujących decyzji.'
                : 'There are no open conflicts or pending decisions.'}
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {conflicts.map((conflict) => (
              <article
                key={conflict.path}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <h4 className="font-medium text-[var(--c-text)]">
                        {isPolish ? 'Sprzeczne wartości' : 'Conflicting values'} · {conflict.path}
                      </h4>
                    </div>
                    <p className="mt-2 text-sm text-[var(--c-text-secondary)]">
                      {conflict.values.join('  ↔  ')}
                    </p>
                    <p className="mt-2 text-xs text-[var(--c-text-muted)]">
                      {isPolish ? 'Źródła' : 'Sources'}:{' '}
                      {[...new Set(conflict.entries.map((entry) => entry.sourceType))].join(', ')} ·{' '}
                      {isPolish
                        ? 'Właściciel rozstrzygnięcia: nie przypisano'
                        : 'Resolution owner: not assigned'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/organization/sources/source-conflicts')}
                  >
                    {isPolish ? 'Rozstrzygnij' : 'Resolve'} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))}
            {pending.length > 0 && (
              <article className="rounded-lg border border-[var(--c-border)] bg-[var(--c-bg)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-[var(--c-text-secondary)]">
                    {pending.length}{' '}
                    {isPolish
                      ? 'faktów oczekuje na zatwierdzenie.'
                      : 'facts are awaiting approval.'}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/organization/sources/claims-sources')}
                  >
                    {isPolish ? 'Przejrzyj fakty' : 'Review facts'}{' '}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </article>
            )}
            {!latestVersion && (
              <article className="rounded-lg border border-[var(--c-border)] bg-[var(--c-bg)] p-4 text-sm text-[var(--c-text-secondary)]">
                {isPolish
                  ? 'Nie opublikowano jeszcze wersji kontekstu organizacji.'
                  : 'No organization context version has been published yet.'}
              </article>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-4">
          <div className="text-xs text-[var(--c-text-muted)]">
            {isPolish ? 'Odrzucone fakty' : 'Rejected facts'}
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--c-text)]">{rejected.length}</div>
        </article>
        <article className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-4">
          <div className="text-xs text-[var(--c-text-muted)]">
            {isPolish ? 'Niska pewność (<70%)' : 'Low confidence (<70%)'}
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--c-text)]">
            {lowConfidence.length}
          </div>
        </article>
        <article className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-4">
          <div className="text-xs text-[var(--c-text-muted)]">
            {isPolish ? 'Ostatnia publikacja' : 'Latest publication'}
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--c-text)]">
            {latestVersion
              ? new Date(latestVersion.createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US')
              : '—'}
          </div>
        </article>
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

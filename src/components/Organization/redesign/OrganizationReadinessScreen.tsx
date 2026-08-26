/**
 * „Gotowość organizacji" — DZIESIĄTY realny ekran redesignu v1 (etap B),
 * PRZEBUDOWANY wg DEC-2026-08-26-78 (prototyp `organization-prototyp-
 * gotowosc.html`): pięć wymiarów gotowości OSOBNO, nigdy jedna liczba
 * zbiorcza — to jest „Wariant A — rekomendacja" z prototypu, zaakceptowany
 * przez właściciela zamiast „Wariant B" (jeden % z wagami).
 *
 * Ekran samodzielny (mapa konsolidacji §4: „1 → 1"), przejmuje treść
 * WSZYSTKICH czterech legacy tras modułu „Gotowość i nadzór" — patrz
 * `REDESIGN_SCREEN_REDIRECTS` w `organizationRedesignNav.ts`.
 *
 * DANE SĄ REALNE, zero fabrykacji:
 *   - Kompletność → `completenessDetail()` z taksonomii profilu (te same 15
 *     pól, które liczy `computeCompleteness` — jedno źródło prawdy z API).
 *   - Pokrycie dowodami → `organizationGovernedContextApi.listClaims()`:
 *     zatwierdzone (`approved`) na tle wszystkich twierdzeń.
 *   - Spójność → te same twierdzenia zgrupowane po `claimPath`, ścieżki
 *     z >1 rozbieżną wartością (identyczna logika co
 *     `OrganizationDecisionQualityPanel.conflicts`).
 *   - Aktualność → twierdzenia starsze niż `FRESHNESS_THRESHOLD_DAYS` (180)
 *     dni. To ŚWIADOMIE UDOKUMENTOWANY próg zastępczy — model danych NIE MA
 *     pola „termin przeglądu" per fakt (prototyp to nazywa wprost: „Minimalny
 *     zestaw pól per zastosowanie" to OTWARTA decyzja, nie zbudowana funkcja).
 *     Licznik jest prawdziwy (realne `createdAt`), próg jest interpretacją.
 *   - Zatwierdzenie → `organizationGovernedContextApi.listVersions()`:
 *     istnienie opublikowanej wersji kontekstu (realne, to samo co `ready`
 *     w legacy panelu).
 *
 * ŚWIADOMIE POZA ZAKRESEM tej przebudowy: „Minimalny zestaw pól per
 * zastosowanie" (inny dla oceny DRD, inny dla modelu finansowego) —
 * prototyp sam to nazywa nierozstrzygniętą decyzją produktową, nie
 * zaimplementowaną funkcją. Dopóki jej nie ma, „Kompletność" mierzy
 * kompletność PROFILU (to samo pole `profile_completeness`, które już
 * zasila resztę produktu), nie hipotetyczny check-listę per użycie.
 */

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { cn } from '../../../lib/utils';
import { Api } from '../../../services/api';
import {
  type GovernedClaim,
  type GovernedSnapshotVersion,
  organizationGovernedContextApi,
} from '../../../services/organizationGovernedContextApi';
import { useAppStore } from '../../../store/useAppStore';
import {
  completenessDetail,
  EMPTY_PROFILE,
  type OrgProfile,
} from '../../../views/ContextBuilder/modules/organizationProfileTaxonomy';
import { ORG_L1, OrgStatusChip, type OrgStatusTone } from './OrganizationCardPrimitives';

const FRESHNESS_THRESHOLD_DAYS = 180;

interface ReadinessDimension {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: OrgStatusTone;
  actionLabel?: string;
  onAction?: () => void;
}

function renderClaimValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

const DIM_CARD =
  'flex flex-col gap-1 rounded-xl border border-c-border-subtle bg-c-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]';

const BLOCKER_ICON: Record<OrgStatusTone, LucideIcon> = {
  ok: CheckCircle2,
  warning: AlertTriangle,
  info: Clock3,
  muted: ShieldAlert,
};

export const OrganizationReadinessScreen: React.FC<{ title: string }> = ({ title }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, currentOrganization } = useAppStore();
  const orgId = currentOrganization?.id || currentUser?.organizationId;

  const [profile, setProfile] = useState<OrgProfile>(EMPTY_PROFILE);
  const [claims, setClaims] = useState<GovernedClaim[]>([]);
  const [versions, setVersions] = useState<GovernedSnapshotVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const [profileRes, claimRows, versionRows] = await Promise.all([
        Api.get(`/organization-profiles/${orgId}`),
        organizationGovernedContextApi.listClaims(),
        organizationGovernedContextApi.listVersions(),
      ]);
      if (profileRes?.exists && profileRes.profile) {
        setProfile((previous) => ({ ...previous, ...profileRes.profile }));
      }
      setClaims(Array.isArray(claimRows) ? claimRows : []);
      setVersions(Array.isArray(versionRows) ? versionRows : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

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
        values: [...new Set(entries.map((entry) => renderClaimValue(entry.value)))],
      }))
      .filter((entry) => entry.values.length > 1);
  }, [claims]);

  const pending = useMemo(
    () => claims.filter((claim) => claim.reviewState === 'pending'),
    [claims]
  );
  const approved = useMemo(() => claims.filter((claim) => claim.approved), [claims]);
  const stale = useMemo(
    () => claims.filter((claim) => daysSince(claim.createdAt) > FRESHNESS_THRESHOLD_DAYS),
    [claims]
  );
  const latestVersion = versions[0] ?? null;
  const completeness = useMemo(() => completenessDetail(profile), [profile]);

  const goToConflicts = useCallback(
    () => navigate('/organization/sources/claims-sources'),
    [navigate]
  );
  const goToClaims = useCallback(
    () => navigate('/organization/sources/claims-sources'),
    [navigate]
  );

  const dimensions: ReadinessDimension[] = useMemo(
    () => [
      {
        id: 'completeness',
        label: t('organization.readiness.dim.completeness.label', 'Kompletność'),
        value: `${completeness.filled} z ${completeness.total}`,
        detail: t(
          'organization.readiness.dim.completeness.detail',
          '{{missing}} pól profilu bez wartości.',
          { missing: completeness.total - completeness.filled }
        ),
        tone:
          completeness.percent === 100 ? 'ok' : completeness.percent >= 60 ? 'warning' : 'muted',
      },
      {
        id: 'evidence',
        label: t('organization.readiness.dim.evidence.label', 'Pokrycie dowodami'),
        value:
          claims.length > 0
            ? `${approved.length} z ${claims.length}`
            : t('organization.readiness.dim.evidence.none', 'Brak twierdzeń'),
        detail: t(
          'organization.readiness.dim.evidence.detail',
          '{{count}} faktów bez zatwierdzenia źródła.',
          { count: claims.length - approved.length }
        ),
        tone: claims.length === 0 ? 'muted' : approved.length === claims.length ? 'ok' : 'warning',
        actionLabel: t('organization.readiness.dim.evidence.action', 'Pokaż fakty →'),
        onAction: goToClaims,
      },
      {
        id: 'consistency',
        label: t('organization.readiness.dim.consistency.label', 'Spójność'),
        value:
          conflicts.length === 0
            ? t('organization.readiness.dim.consistency.none', 'Brak')
            : t('organization.readiness.dim.consistency.count', '{{count}} rozbieżności', {
                count: conflicts.length,
              }),
        detail:
          conflicts.length > 0
            ? conflicts
                .slice(0, 2)
                .map((conflict) => conflict.path)
                .join(', ')
            : t(
                'organization.readiness.dim.consistency.detailOk',
                'Żadne twierdzenie nie ma sprzecznych wartości ze źródeł.'
              ),
        tone: conflicts.length === 0 ? 'ok' : 'warning',
        actionLabel:
          conflicts.length > 0
            ? t('organization.readiness.dim.consistency.action', 'Rozstrzygnij →')
            : undefined,
        onAction: conflicts.length > 0 ? goToConflicts : undefined,
      },
      {
        id: 'freshness',
        label: t('organization.readiness.dim.freshness.label', 'Aktualność'),
        value:
          stale.length === 0
            ? t('organization.readiness.dim.freshness.none', 'Aktualne')
            : t('organization.readiness.dim.freshness.count', '{{count}} przeterminowanych', {
                count: stale.length,
              }),
        detail: t(
          'organization.readiness.dim.freshness.detail',
          'Twierdzenia starsze niż {{days}} dni ({{count}} z {{total}}).',
          { days: FRESHNESS_THRESHOLD_DAYS, count: stale.length, total: claims.length }
        ),
        tone: stale.length === 0 ? 'ok' : 'warning',
        actionLabel:
          stale.length > 0
            ? t('organization.readiness.dim.freshness.action', 'Odśwież →')
            : undefined,
        onAction: stale.length > 0 ? goToClaims : undefined,
      },
      {
        id: 'approval',
        label: t('organization.readiness.dim.approval.label', 'Zatwierdzenie'),
        value: latestVersion
          ? `v${latestVersion.version}`
          : t('organization.readiness.dim.approval.none', 'Brak'),
        detail: latestVersion
          ? t('organization.readiness.dim.approval.detail', 'Opublikowano {{date}}.', {
              date: new Date(latestVersion.createdAt).toLocaleDateString('pl-PL'),
            })
          : t(
              'organization.readiness.dim.approval.detailNone',
              'Nikt nie opublikował jeszcze wersji kontekstu.'
            ),
        tone: latestVersion ? 'ok' : 'muted',
        actionLabel: !latestVersion
          ? t('organization.readiness.dim.approval.action', 'Wskaż osobę →')
          : undefined,
        onAction: !latestVersion ? goToConflicts : undefined,
      },
    ],
    [
      approved.length,
      claims.length,
      completeness,
      conflicts,
      goToClaims,
      goToConflicts,
      latestVersion,
      stale.length,
      t,
    ]
  );

  const blockers = useMemo(() => {
    const items: Array<{
      id: string;
      tone: OrgStatusTone;
      title: string;
      detail: string;
      actionLabel: string;
      onAction: () => void;
    }> = [];
    conflicts.forEach((conflict) => {
      items.push({
        id: `conflict-${conflict.path}`,
        tone: 'warning',
        title: t('organization.readiness.blocker.conflict.title', 'Konflikt: {{path}}', {
          path: conflict.path,
        }),
        detail: conflict.values.join('  ↔  '),
        actionLabel: t('organization.readiness.blocker.conflict.action', 'Rozstrzygnij →'),
        onAction: goToConflicts,
      });
    });
    if (pending.length > 0) {
      items.push({
        id: 'pending',
        tone: 'info',
        title: t('organization.readiness.blocker.pending.title', 'Oczekuje na zatwierdzenie'),
        detail: t(
          'organization.readiness.blocker.pending.detail',
          '{{count}} faktów bez decyzji.',
          {
            count: pending.length,
          }
        ),
        actionLabel: t('organization.readiness.blocker.pending.action', 'Przejrzyj →'),
        onAction: goToClaims,
      });
    }
    if (!latestVersion) {
      items.push({
        id: 'no-version',
        tone: 'muted',
        title: t('organization.readiness.blocker.noVersion.title', 'Brak opublikowanej wersji'),
        detail: t(
          'organization.readiness.blocker.noVersion.detail',
          'Nikt nie zatwierdził jeszcze wersji kontekstu organizacji.'
        ),
        actionLabel: t('organization.readiness.blocker.noVersion.action', 'Opublikuj →'),
        onAction: goToConflicts,
      });
    }
    return items;
  }, [conflicts, goToClaims, goToConflicts, latestVersion, pending.length, t]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-48 items-center justify-center gap-2 rounded-xl border border-c-border-subtle bg-c-surface text-[13px] text-c-text-secondary"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin text-c-info" />
        {t('organization.readiness.loading', 'Sprawdzam aktualny stan organizacji…')}
      </div>
    );
  }

  if (error) {
    return (
      <section
        role="alert"
        className="rounded-xl border border-c-danger bg-c-surface p-5"
        aria-label={title}
      >
        <h2 className="text-[15px] font-semibold text-c-text">
          {t('organization.readiness.error.title', 'Nie można potwierdzić gotowości')}
        </h2>
        <p className="mt-2 text-[13px] text-c-text-secondary">
          {t(
            'organization.readiness.error.detail',
            'Nie udało się odczytać bieżącego stanu organizacji. Dane nie zostały zmienione.'
          )}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-c-border px-3 text-[13px] font-medium text-c-text hover:border-c-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
        >
          {t('organization.readiness.error.retry', 'Spróbuj ponownie')}
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4" aria-label={title} data-testid="org-readiness-screen">
      <section aria-labelledby="org-readiness-dims-heading">
        <h2 id="org-readiness-dims-heading" className={cn(ORG_L1, 'mb-2')}>
          {t('organization.readiness.dimsHeading', 'Pięć wymiarów gotowości')}
        </h2>
        <div
          data-testid="org-readiness-dimgrid"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
        >
          {dimensions.map((dim) => (
            <article key={dim.id} className={DIM_CARD} data-testid={`org-readiness-dim-${dim.id}`}>
              <span className={ORG_L1}>{dim.label}</span>
              <span className="text-[20px] font-semibold tabular-nums tracking-tight text-c-text">
                {dim.value}
              </span>
              <p className="text-[11px] leading-4 text-c-text-secondary">{dim.detail}</p>
              {dim.actionLabel && dim.onAction && (
                <button
                  type="button"
                  onClick={dim.onAction}
                  className="mt-1 self-start text-[11px] font-medium text-c-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
                >
                  {dim.actionLabel}
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="org-readiness-blockers-heading"
        className="rounded-xl border border-c-border-subtle bg-c-surface"
      >
        <header className="flex items-center justify-between gap-2 border-b border-c-border-subtle px-4 py-3">
          <div>
            <h2
              id="org-readiness-blockers-heading"
              className="text-[13px] font-semibold text-c-text"
            >
              {t('organization.readiness.blockersHeading', 'Co blokuje i kogo zatrzymuje')}
            </h2>
            <p className="text-[11px] text-c-text-muted">
              {t(
                'organization.readiness.blockersSubheading',
                'Każda pozycja mówi, czego dotyczy i co zrobić dalej.'
              )}
            </p>
          </div>
          <OrgStatusChip tone={blockers.length === 0 ? 'ok' : 'warning'}>
            {blockers.length === 0
              ? t('organization.readiness.ready', 'Gotowe')
              : t('organization.readiness.blockersCount', '{{count}} blokad', {
                  count: blockers.length,
                })}
          </OrgStatusChip>
        </header>
        <div className="p-3">
          {blockers.length === 0 ? (
            <div className="flex items-start gap-2 p-2 text-[13px] text-c-text-secondary">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-c-success" />
              {t(
                'organization.readiness.noBlockers',
                'Nie ma otwartych konfliktów ani oczekujących decyzji.'
              )}
            </div>
          ) : (
            <ul className="space-y-1">
              {blockers.map((blocker) => {
                const Icon = BLOCKER_ICON[blocker.tone];
                return (
                  <li
                    key={blocker.id}
                    className="flex items-start gap-2.5 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3"
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        blocker.tone === 'warning' && 'text-c-warning',
                        blocker.tone === 'info' && 'text-c-info',
                        blocker.tone === 'muted' && 'text-c-text-muted'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-c-text">{blocker.title}</p>
                      <p className="text-[11px] text-c-text-secondary">{blocker.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={blocker.onAction}
                      className="shrink-0 text-[11px] font-medium text-c-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
                    >
                      {blocker.actionLabel}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
          <p className={ORG_L1}>{t('organization.readiness.footer.claims', 'Twierdzenia razem')}</p>
          <p className="mt-1 text-[15px] font-semibold text-c-text">{claims.length}</p>
        </article>
        <article className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
          <p className={ORG_L1}>{t('organization.readiness.footer.rejected', 'Odrzucone')}</p>
          <p className="mt-1 text-[15px] font-semibold text-c-text">
            {claims.filter((claim) => claim.reviewState === 'rejected').length}
          </p>
        </article>
        <article className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
          <p className={ORG_L1}>
            {t('organization.readiness.footer.publication', 'Ostatnia publikacja')}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-c-text">
            <FileCheck2 aria-hidden="true" className="mr-1.5 inline h-4 w-4 text-c-text-muted" />
            {latestVersion ? new Date(latestVersion.createdAt).toLocaleDateString('pl-PL') : '—'}
          </p>
        </article>
      </section>
    </div>
  );
};

export default OrganizationReadinessScreen;

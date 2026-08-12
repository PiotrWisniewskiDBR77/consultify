/**
 * `/results/kpi/:kpiId` — RN-G3 lane: full KPI tool, klasa L (D03 — resolves
 * `RN_G2_UI_SCOPE.md` open question #2 FOR KPI SPECIFICALLY: klasa S's
 * 4-section limit is implausible given the real sub-resource count uncovered
 * there — Measurements, Deviations, Corrective Actions, Initiative Impacts
 * are all independent CRUD surfaces, same precedent that already forced
 * Task/Decision S->L in `src/components/standard/registry.ts`).
 *
 * -- SHELL CHOICE: uses `NModeShell` + `ArtifactRightPanel` DIRECTLY, not the
 * `StandardArtifactShell` wrapper. Reason: `StandardArtifactShell` requires
 * `karta: KartaNKey`, a CLOSED registry (`src/components/standard/registry.ts`)
 * that does not include a KPI/ROI/OKR full-tool entry today — extending it is
 * explicitly a Platform-owned edit outside this package's allowlist. This is
 * the SAME choice `../kpiScorecards/ResultsKpiScorecardDetailPage.tsx`
 * documents (its own header, "ARCHETYPE DECISION") for the sibling Scorecard
 * detail screen, and the same pattern `InitiativeDocumentView.tsx`/
 * `KnownToolDetailView.tsx` already use in this codebase (`NModeShell`
 * directly, no `StandardArtifactShell`). `ArtifactRightPanel` — the actual
 * shared SPEC-A contract (`ARTIFACT_ANATOMY_STANDARD.md` §10.2/§11.2) — is
 * used unmodified, satisfying CLAUDE.md rule #6's "powłoka wspólna" without
 * touching the closed registry.
 *
 * Sections (plan `02_KPI_IMPLEMENTATION_PLAN.md` §6.8, 8 named — this
 * package builds the 6 that have a real backend read surface; the other 2
 * are honestly disclosed as unavailable, never fabricated):
 *   1. Performance         — real (latest measurement + KPI-level lifecycle)
 *   2. Contract             — PARTIAL: no GET anywhere returns the joined
 *                             `rvn_kpi_definition_versions` row (name/unit/
 *                             target geometry/approval status) — see
 *                             `../kpiApi.ts` file header, "HONEST-DATA
 *                             CAVEAT". This section shows only the fields
 *                             that ARE reachable from `GET /kpi/:kpiId`.
 *   3. Record / Measurements — real, embeds the EXISTING
 *                             `ResultsKpiMeasurementsPanel` (task brief:
 *                             "panel istnieje, wepnij go w pełne narzędzie")
 *                             unmodified.
 *   4. Deviations           — real, `listDeviationCases({kpiId})`; cases are
 *                             ONLY ever created by the server
 *                             (`openOrEscalateDeviationCase`, called from
 *                             inside `recordMeasurement`/`correctMeasurement`
 *                             — verified: no `POST /deviation-cases` route
 *                             exists anywhere), so this section has NO
 *                             "create case" affordance — inventing one would
 *                             be a fabricated capability.
 *   5. Corrective Actions   — PARTIAL: no cross-case aggregate read endpoint
 *                             exists (`kpiDeviationApi.ts` "KNOWN GAP #2");
 *                             this section links into each open case's own
 *                             subview instead of faking a rollup table.
 *   6. Initiatives affecting KPI — real,
 *                             `GET /kpi/:kpiId/initiative-impacts` + the
 *                             full propose/commit/review/supersede command
 *                             set.
 *   7. Scorecards and contexts — UNAVAILABLE: grepped
 *                             `kpiScorecard.routes.ts` in full — only
 *                             `GET /:scorecardId/items` (forward, scorecard
 *                             -> items) exists; no `kpi -> scorecards`
 *                             reverse route anywhere. Honest "not available"
 *                             notice, never a fabricated list.
 *   8. History / Lineage    — UNAVAILABLE: no `GET .../history` or
 *                             `GET .../events` route exists anywhere in
 *                             `kpi.routes.ts`/`kpiDeviation.routes.ts`/
 *                             `kpiScorecard.routes.ts` (grepped). Honest
 *                             "not available" notice.
 *
 * D07 (scorecard snapshot payload filtering) does not apply to this screen —
 * it never renders `snapshot_payload`; that's `kpiScorecardPresenters.tsx`'s
 * concern, unmodified here.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertTriangle,
  ArchiveIcon,
  Blocks,
  FileText,
  GitBranch,
  LayoutGrid,
  Link2,
  ListChecks,
  Play,
  Settings2,
  ShieldAlert,
} from 'lucide-react';

import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import type { NModeHeaderConfig, NModeHeaderPrimaryAction, NModeSection } from '@/components/shared/NModeLayout/types';
import { ArtifactRightPanel, type ArtifactRightPanelSection } from '@/components/standard/ArtifactRightPanel';
import { ArtifactPropertiesTable, type ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { StatusChip } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';
import { ROUTES } from '@/routes/routeConfig';
import { EmptyState } from '@/components/shared/states';

import { HonestValueCell } from '../HonestValue';
import { ResultsVNextForbiddenState } from '../ResultsVNextForbiddenState';
import type { ResultsVNextForbiddenDetail } from '../types';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import {
  activateKpi,
  archiveKpi,
  getKpi,
  listKpiMeasurements,
  suspendKpi,
  type KpiDefinitionDto,
  type KpiMeasurementDto,
  type KpiStatus,
} from '../kpiApi';
import { ResultsKpiMeasurementsPanel } from '../kpiMeasurements/ResultsKpiMeasurementsPanel';
import {
  listDeviationCases,
  type DeviationCaseDto,
} from './kpiDeviationApi';
import {
  commitInitiativeKpiImpact,
  listInitiativeImpactsForKpi,
  proposeInitiativeKpiImpact,
  recordReviewedAttribution,
  type InitiativeKpiImpactDto,
} from './kpiInitiativeImpactApi';
import { KpiReviewedAttributionDialog } from './KpiReviewedAttributionDialog';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import {
  DEVIATION_CASE_STATUS_TONE,
  DEVIATION_SEVERITY_TONE,
  INITIATIVE_KPI_IMPACT_STATUS_TONE,
  deviationCaseStatusLabel,
  deviationSeverityLabel,
  escalatedOverlayLabel,
  initiativeKpiImpactStatusLabel,
} from './kpiToolMappers';

const STATUS_TONE: Record<KpiStatus, 'info' | 'warning' | 'success' | 'neutral'> = {
  draft: 'info',
  pending_approval: 'warning',
  active: 'success',
  suspended: 'warning',
  archived: 'neutral',
};

const STATUS_LABEL: Record<KpiStatus, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  pending_approval: { pl: 'Do zatwierdzenia', en: 'Pending approval' },
  active: { pl: 'Aktywny', en: 'Active' },
  suspended: { pl: 'Zawieszony', en: 'Suspended' },
  archived: { pl: 'Zarchiwizowany', en: 'Archived' },
};

function statusLabel(status: KpiStatus, isPolish: boolean): string {
  return isPolish ? STATUS_LABEL[status].pl : STATUS_LABEL[status].en;
}

const FIELD_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const TEXTAREA_CLASS =
  'w-full min-h-[64px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';
const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY_BUTTON_CLASS = `${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`;

function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function formatDate(iso: string | null | undefined, isPolish: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const GapNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    role="note"
    className="flex items-start gap-2 rounded-lg border border-c-warning/30 bg-c-warning/10 px-3 py-2 text-[11px] text-c-text-secondary"
  >
    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-warning" />
    <span>{children}</span>
  </div>
);

export const KpiToolPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);
  const navigate = useNavigate();
  const { kpiId } = useParams<{ kpiId: string }>();
  const enabled = isResultsVNextFlagEnabled('kpiRegistry');

  const [kpi, setKpi] = useState<KpiDefinitionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<ResultsVNextForbiddenDetail | null>(null);
  const [pending, setPending] = useState<'activate' | 'suspend' | 'archive' | null>(null);

  const [measurement, setMeasurement] = useState<KpiMeasurementDto | null | 'loading'>(null);
  const [deviationCases, setDeviationCases] = useState<DeviationCaseDto[] | 'loading'>('loading');
  const [initiativeImpacts, setInitiativeImpacts] = useState<InitiativeKpiImpactDto[] | 'loading'>('loading');
  const [impactBusy, setImpactBusy] = useState(false);

  // "Record reviewed attribution" dialog (replaces `window.prompt` — RN-G3
  // prompt-removal pass, 2026-08-11, extended scope). Kept OUTSIDE
  // `impactBusy`/toast on purpose: a rejected submit must keep the dialog
  // open with the server's error shown inline, not bounce the user to a
  // toast and lose the typed value.
  const [attributionTarget, setAttributionTarget] = useState<InitiativeKpiImpactDto | null>(null);
  const [attributionBusy, setAttributionBusy] = useState(false);
  const [attributionError, setAttributionError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState('performance');

  // Propose-impact form state.
  const [proposeInitiativeId, setProposeInitiativeId] = useState('');
  const [proposeContributionValue, setProposeContributionValue] = useState('');
  const [proposeDirection, setProposeDirection] = useState<'increase' | 'decrease'>('increase');

  const loadKpi = useCallback(async () => {
    if (!kpiId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const record = await getKpi(kpiId);
      if (!record) {
        setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
        setKpi(null);
        return;
      }
      setForbidden(null);
      setKpi(record);
    } catch (err) {
      setLoadError(toUserFacingErrorMessage(err, isPolish));
    } finally {
      setLoading(false);
    }
  }, [kpiId]);

  useEffect(() => {
    if (!enabled) return;
    void loadKpi();
  }, [enabled, loadKpi]);

  useEffect(() => {
    if (!enabled || !kpiId) return;
    setMeasurement('loading');
    listKpiMeasurements(kpiId, { limit: 1 })
      .then((list) => setMeasurement(list[0] ?? null))
      .catch(() => setMeasurement(null));
  }, [enabled, kpiId]);

  const loadDeviationCases = useCallback(() => {
    if (!kpiId) return;
    setDeviationCases('loading');
    listDeviationCases({ kpiId })
      .then(setDeviationCases)
      .catch(() => setDeviationCases([]));
  }, [kpiId]);

  useEffect(() => {
    if (!enabled) return;
    loadDeviationCases();
  }, [enabled, loadDeviationCases]);

  const loadInitiativeImpacts = useCallback(() => {
    if (!kpiId) return;
    setInitiativeImpacts('loading');
    listInitiativeImpactsForKpi(kpiId)
      .then(setInitiativeImpacts)
      .catch(() => setInitiativeImpacts([]));
  }, [kpiId]);

  useEffect(() => {
    if (!enabled) return;
    loadInitiativeImpacts();
  }, [enabled, loadInitiativeImpacts]);

  const submitReviewedAttribution = useCallback(
    (value: number) => {
      if (!attributionTarget) return;
      setAttributionBusy(true);
      setAttributionError(null);
      recordReviewedAttribution(attributionTarget.impactId, {
        expectedVersion: attributionTarget.rowVersion,
        reviewedAttributionValue: value,
        reviewRationale: t('Przegląd z narzędzia KPI', 'Review from KPI tool'),
      })
        .then(() => {
          toast.success(t('Atrybucja zapisana', 'Attribution recorded'));
          setAttributionTarget(null);
          loadInitiativeImpacts();
        })
        .catch((err) => setAttributionError(toUserFacingErrorMessage(err, isPolish)))
        .finally(() => setAttributionBusy(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attributionTarget, t, loadInitiativeImpacts]
  );

  const runLifecycleAction = useCallback(
    async (action: 'activate' | 'suspend' | 'archive') => {
      if (!kpi) return;
      setPending(action);
      try {
        const runner = action === 'activate' ? activateKpi : action === 'suspend' ? suspendKpi : archiveKpi;
        await runner({ kpiId: kpi.kpiId, expectedVersion: kpi.rowVersion });
        await loadKpi();
      } catch (err) {
        toast.error(toUserFacingErrorMessage(err, isPolish));
      } finally {
        setPending(null);
      }
    },
    [kpi, loadKpi]
  );

  const openCasesCount = useMemo(
    () => (Array.isArray(deviationCases) ? deviationCases.filter((c) => c.status !== 'closed').length : 0),
    [deviationCases]
  );

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-kpi-tool-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={t('Narzędzie KPI — jeszcze nie włączone', 'KPI tool — not yet enabled')}
          description={t(
            'Ten ekran jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.',
            'This screen is still being built. Check back later, or ask an administrator for flag access.'
          )}
          compact
        />
      </div>
    );
  }

  if (forbidden) {
    return <ResultsVNextForbiddenState forbidden={forbidden} onBack={() => navigate(ROUTES.RESULTS_KPI.ROOT)} />;
  }

  if (loading || (!kpi && !loadError)) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="results-vnext-kpi-tool-loading">
        <div className="text-sm text-c-text-muted">{t('Ładowanie KPI…', 'Loading KPI…')}</div>
      </div>
    );
  }

  if (loadError || !kpi) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-kpi-tool-error">
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title={t('Nie udało się wczytać KPI', 'Could not load the KPI')}
          description={loadError ?? undefined}
          onRetry={() => void loadKpi()}
          compact
        />
      </div>
    );
  }

  const isBusy = pending !== null;
  const noApprovedVersionReason = t(
    'Aktywacja wymaga zatwierdzonej wersji definicji KPI (sprawdzane przez serwer — brak GET dla wersji, żeby zweryfikować to po stronie klienta).',
    'Activation requires an approved KPI definition version (server-enforced — no GET exists for the version to verify this client-side).'
  );
  const archivedReason = t('KPI zarchiwizowane — stan końcowy, tylko odczyt.', 'KPI archived — terminal state, read-only.');

  // NModeHeaderPrimaryAction.label/title are BILINGUAL objects
  // ({ pl, en }), never a pre-resolved string — a real, visually-caught bug
  // (dev-render screenshot showed a blank primary CTA button) fixed here:
  // the earlier `t('Aktywuj', 'Activate')` call resolves to a single string,
  // which NModeHeader then reads as `label.pl`/`label.en` (both undefined).
  let primaryAction: NModeHeaderPrimaryAction | undefined;
  if (kpi.status === 'suspended') {
    primaryAction = { label: { pl: 'Aktywuj', en: 'Activate' }, onClick: () => void runLifecycleAction('activate'), disabled: isBusy };
  } else if (kpi.status === 'active') {
    primaryAction = { label: { pl: 'Zawieś', en: 'Suspend' }, onClick: () => void runLifecycleAction('suspend'), disabled: isBusy };
  } else if (kpi.status === 'draft' || kpi.status === 'pending_approval') {
    primaryAction = {
      label: { pl: 'Aktywuj', en: 'Activate' },
      onClick: () => void runLifecycleAction('activate'),
      disabled: true,
      title: { pl: noApprovedVersionReason, en: noApprovedVersionReason },
    };
  } else {
    primaryAction = {
      label: { pl: 'Aktywuj', en: 'Activate' },
      onClick: () => {},
      disabled: true,
      title: { pl: archivedReason, en: archivedReason },
    };
  }

  const header: NModeHeaderConfig = {
    title: kpi.kpiCode,
    onTitleChange: () => {},
    titleReadOnly: true,
    artifactType: 'kpi',
    artifactId: kpi.kpiId,
    onSave: () => {},
    saveState: 'saved',
    onClose: () => navigate(ROUTES.RESULTS_KPI.ROOT),
    primaryAction,
    extraOverflowItems:
      kpi.status !== 'archived'
        ? [
            {
              id: 'archive',
              label: t('Archiwizuj', 'Archive'),
              icon: ArchiveIcon,
              onClick: () => void runLifecycleAction('archive'),
              danger: true,
            },
          ]
        : [],
  };

  const propertyRows: ArtifactPropertyRow[] = [
    { id: 'owner', label: t('Właściciel', 'Owner'), value: shortId(kpi.ownerUserId) },
    { id: 'process', label: t('Proces', 'Process'), value: shortId(kpi.primaryProcessId) },
    { id: 'responsePolicy', label: t('Polityka odpowiedzi', 'Response policy'), value: shortId(kpi.responsePolicyId) },
    { id: 'definitionVersion', label: t('Bieżąca wersja definicji', 'Current definition version'), value: shortId(kpi.currentDefinitionVersionId), mono: true },
    { id: 'created', label: t('Utworzono', 'Created'), value: formatDate(kpi.createdAt, isPolish) },
    { id: 'updated', label: t('Zaktualizowano', 'Updated'), value: formatDate(kpi.updatedAt, isPolish) },
    { id: 'rowVersion', label: t('Wersja (CAS)', 'Version (CAS)'), value: String(kpi.rowVersion), mono: true },
  ];

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: t('Akcje', 'Actions'),
      icon: Settings2,
      defaultOpen: true,
      children: (
        <div className="flex flex-col gap-2">
          {kpi.status === 'active' ? (
            <button type="button" disabled={isBusy} className={GHOST_BUTTON_CLASS} onClick={() => void runLifecycleAction('suspend')}>
              {t('Zawieś', 'Suspend')}
            </button>
          ) : kpi.status === 'suspended' ? (
            <button type="button" disabled={isBusy} className={GHOST_BUTTON_CLASS} onClick={() => void runLifecycleAction('activate')}>
              {t('Aktywuj', 'Activate')}
            </button>
          ) : (
            <p className="text-[11px] text-c-text-muted">
              {kpi.status === 'archived' ? archivedReason : noApprovedVersionReason}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('Właściwości', 'Properties'),
      icon: ListChecks,
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable rows={propertyRows} propertyLabel={t('Właściwość', 'Property')} valueLabel={t('Wartość', 'Value')} />
      ),
    },
    {
      id: 'relations',
      label: t('Powiązania', 'Relations'),
      icon: Link2,
      defaultOpen: false,
      isEmpty: openCasesCount === 0 && (!Array.isArray(initiativeImpacts) || initiativeImpacts.length === 0),
      emptyLabel: t('Brak powiązań', 'No relations'),
      badge: openCasesCount,
      children: (
        <div className="space-y-1.5">
          {openCasesCount > 0 ? (
            <button type="button" className="text-xs text-c-info underline" onClick={() => setActiveSection('deviations')}>
              {t(`${openCasesCount} otwarta(-e) sprawa(-y) odchylenia`, `${openCasesCount} open deviation case(s)`)}
            </button>
          ) : null}
          {Array.isArray(initiativeImpacts) && initiativeImpacts.length > 0 ? (
            <button type="button" className="text-xs text-c-info underline block" onClick={() => setActiveSection('initiatives')}>
              {t(`${initiativeImpacts.length} powiązana(-e) inicjatywa(-y)`, `${initiativeImpacts.length} linked initiative(s)`)}
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  // ── Section 1: Performance ──
  const performanceSection: NModeSection = {
    id: 'performance',
    icon: Activity,
    label: { pl: 'Wyniki', en: 'Performance' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusChip label={statusLabel(kpi.status, isPolish)} tone={STATUS_TONE[kpi.status]} />
        </div>
        <div className="rounded-xl border border-c-border-subtle p-4">
          <p className={LABEL_CLASS}>{t('Ostatni pomiar', 'Latest measurement')}</p>
          {measurement === 'loading' ? (
            <span className="text-sm text-c-text-muted">{t('Ładowanie…', 'Loading…')}</span>
          ) : (
            <div className="flex items-center gap-4">
              <HonestValueCell
                value={measurement ? measurement.actualValue : null}
                format={(v) => <span className="text-2xl font-semibold tabular-nums text-c-text">{v.toLocaleString(isPolish ? 'pl-PL' : 'en-US')}</span>}
              />
              {measurement ? (
                <div className="text-xs text-c-text-muted">
                  <div>
                    {t('Okres: ', 'Period: ')}
                    {formatDate(measurement.periodStart, isPolish)} – {formatDate(measurement.periodEnd, isPolish)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusChip label={measurement.performanceStatus} tone={measurement.performanceStatus === 'critical' ? 'danger' : measurement.performanceStatus === 'warning' ? 'warning' : measurement.performanceStatus === 'on_target' ? 'success' : 'neutral'} />
                    <StatusChip label={measurement.dataQualityStatus} tone={measurement.dataQualityStatus === 'disputed' ? 'danger' : measurement.dataQualityStatus === 'verified' ? 'success' : 'neutral'} />
                  </div>
                  <p className="mt-2 text-[11px] text-c-text-muted">
                    {t(
                      'Wynik i jakość danych to DWA NIEZALEŻNE wymiary (plan §4.3/§4.4) — nigdy jedno pole.',
                      'Performance and data quality are TWO INDEPENDENT dimensions (plan §4.3/§4.4) — never one field.'
                    )}
                  </p>
                </div>
              ) : (
                <span className="text-xs text-c-text-muted">{t('Brak zarejestrowanych pomiarów.', 'No measurements recorded yet.')}</span>
              )}
            </div>
          )}
        </div>
        <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => setActiveSection('measurements')}>
          {t('Otwórz pełną historię pomiarów', 'Open full measurement history')}
        </button>
      </div>
    ),
  };

  // ── Section 2: Contract ──
  const contractSection: NModeSection = {
    id: 'contract',
    icon: FileText,
    label: { pl: 'Kontrakt', en: 'Contract' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="space-y-3">
        <GapNotice>
          {t(
            'Żaden GET nie zwraca złączonej wersji definicji (nazwa/jednostka/geometria celu żyją wyłącznie w rvn_kpi_definition_versions, zwracane tylko jako efekt uboczny zapisu — createKpiDraft/approveDefinitionVersion/rejectDefinitionVersion). Poniżej wyłącznie pola dostępne z GET /kpi/:kpiId.',
            'No GET returns the joined definition version (name/unit/target geometry live only on rvn_kpi_definition_versions, returned only as a write side-effect — createKpiDraft/approveDefinitionVersion/rejectDefinitionVersion). Below are only the fields reachable from GET /kpi/:kpiId.'
          )}
        </GapNotice>
        <ArtifactPropertiesTable
          rows={[
            { id: 'kpiCode', label: t('Kod KPI', 'KPI code'), value: kpi.kpiCode },
            { id: 'status', label: t('Cykl życia', 'Lifecycle'), value: statusLabel(kpi.status, isPolish) },
            { id: 'definitionVersion', label: t('ID bieżącej wersji', 'Current version id'), value: shortId(kpi.currentDefinitionVersionId), mono: true },
          ]}
          propertyLabel={t('Właściwość', 'Property')}
          valueLabel={t('Wartość', 'Value')}
        />
      </div>
    ),
  };

  // ── Section 3: Measurements (embeds the real existing panel) ──
  const measurementsSection: NModeSection = {
    id: 'measurements',
    icon: ListChecks,
    label: { pl: 'Pomiary', en: 'Measurements' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="h-[70vh] rounded-xl border border-c-border-subtle overflow-hidden">
        <ResultsKpiMeasurementsPanel kpi={kpi} isPolish={isPolish} onBack={() => setActiveSection('performance')} />
      </div>
    ),
  };

  // ── Section 4: Deviations ──
  const deviationsSection: NModeSection = {
    id: 'deviations',
    icon: ShieldAlert,
    label: { pl: 'Sprawy odchyleń', en: 'Deviations' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="space-y-3">
        <GapNotice>
          {t(
            'Sprawy odchyleń tworzy WYŁĄCZNIE serwer, automatycznie, przy krytycznym/ostrzegawczym pomiarze (openOrEscalateDeviationCase, wołane z recordMeasurement/correctMeasurement) — brak POST do ręcznego utworzenia sprawy, więc ten ekran nie ma przycisku „Nowa sprawa".',
            'Deviation cases are created ONLY by the server, automatically, on a critical/warning measurement (openOrEscalateDeviationCase, called from recordMeasurement/correctMeasurement) — no POST exists to create one manually, so this screen has no "New case" button.'
          )}
        </GapNotice>
        {deviationCases === 'loading' ? (
          <p className="text-sm text-c-text-muted">{t('Ładowanie…', 'Loading…')}</p>
        ) : deviationCases.length === 0 ? (
          <EmptyState
            variant="new"
            icon={ShieldAlert}
            title={t('Brak spraw odchyleń', 'No deviation cases')}
            description={t('Ten KPI nie miał jeszcze krytycznego/ostrzegawczego pomiaru.', 'This KPI has not had a critical/warning measurement yet.')}
            compact
          />
        ) : (
          <ul className="space-y-2">
            {deviationCases.map((c) => (
              <li key={c.caseId}>
                <button
                  type="button"
                  className="w-full text-left rounded-xl border border-c-border-subtle p-3 hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  onClick={() => navigate(`${ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', kpi.kpiId)}/deviation-cases/${c.caseId}`)}
                  data-testid={`kpi-deviation-case-row-${c.caseId}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-c-text">{shortId(c.caseId)}</span>
                    <StatusChip label={deviationCaseStatusLabel(c.status, isPolish)} tone={DEVIATION_CASE_STATUS_TONE[c.status]} />
                    <StatusChip label={deviationSeverityLabel(c.severity, isPolish)} tone={DEVIATION_SEVERITY_TONE[c.severity]} />
                    {c.escalated ? <StatusChip label={escalatedOverlayLabel(isPolish)} tone="danger" /> : null}
                  </div>
                  <p className="mt-1 text-[11px] text-c-text-muted">
                    {t('Wykryto ', 'Detected ')}
                    {formatDate(c.detectedAt, isPolish)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    ),
  };

  // ── Section 5: Corrective actions (rollup notice + links) ──
  const correctiveActionsSection: NModeSection = {
    id: 'correctiveActions',
    icon: Play,
    label: { pl: 'Działania korygujące', en: 'Corrective actions' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="space-y-3">
        <GapNotice>
          {t(
            'Brak zbiorczego GET dla działań korygujących ponad wszystkimi sprawami tego KPI (kpiDeviationRepository.listCorrectiveActions istnieje, ale żaden route go nie wystawia — patrz kpiDeviation.routes.ts, sekcja „DESIGN NOTE"). Działania żyją WEWNĄTRZ każdej sprawy odchylenia — otwórz sprawę poniżej.',
            'No aggregate GET exists for corrective actions across this KPI\'s cases (kpiDeviationRepository.listCorrectiveActions exists but no route exposes it — see kpiDeviation.routes.ts "DESIGN NOTE"). Actions live INSIDE each deviation case — open a case below.'
          )}
        </GapNotice>
        {Array.isArray(deviationCases) && deviationCases.filter((c) => c.status !== 'closed').length > 0 ? (
          <ul className="space-y-1.5">
            {deviationCases
              .filter((c) => c.status !== 'closed')
              .map((c) => (
                <li key={c.caseId}>
                  <button
                    type="button"
                    className="text-xs text-c-info underline"
                    onClick={() => navigate(`${ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', kpi.kpiId)}/deviation-cases/${c.caseId}`)}
                  >
                    {t('Otwórz sprawę ', 'Open case ')}
                    {shortId(c.caseId)} ({deviationCaseStatusLabel(c.status, isPolish)})
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-xs text-c-text-muted">{t('Brak otwartych spraw z działaniami do pokazania.', 'No open cases with actions to show.')}</p>
        )}
      </div>
    ),
  };

  // ── Section 6: Initiatives affecting KPI ──
  const initiativesSection: NModeSection = {
    id: 'initiatives',
    icon: GitBranch,
    label: { pl: 'Inicjatywy wpływające na KPI', en: 'Initiatives affecting KPI' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="space-y-4">
        {initiativeImpacts === 'loading' ? (
          <p className="text-sm text-c-text-muted">{t('Ładowanie…', 'Loading…')}</p>
        ) : initiativeImpacts.length === 0 ? (
          <EmptyState
            variant="new"
            icon={GitBranch}
            title={t('Brak powiązanych inicjatyw', 'No linked initiatives')}
            description={t('Żadna inicjatywa nie zaproponowała jeszcze wpływu na ten KPI.', 'No initiative has proposed an impact on this KPI yet.')}
            compact
          />
        ) : (
          <ul className="space-y-2">
            {initiativeImpacts.map((imp) => (
              <li key={imp.impactId} className="rounded-xl border border-c-border-subtle p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-medium text-c-text">{shortId(imp.initiativeId)}</span>
                  <StatusChip label={initiativeKpiImpactStatusLabel(imp.status, isPolish)} tone={INITIATIVE_KPI_IMPACT_STATUS_TONE[imp.status]} />
                </div>
                <p className="mt-1 text-[11px] text-c-text-muted">
                  {t('Oczekiwany wpływ: ', 'Expected contribution: ')}
                  {imp.expectedContributionValue ?? '—'} ({imp.expectedContributionDirection ?? '—'})
                </p>
                {imp.baselineValueAtCommitment !== null ? (
                  <p className="text-[11px] text-c-text-muted">
                    {t('Baseline (zamrożony przy commit): ', 'Baseline (frozen at commit): ')}
                    {imp.baselineValueAtCommitment}
                  </p>
                ) : null}
                {imp.reviewedAttributionValue !== null ? (
                  <p className="text-[11px] text-c-text-muted">
                    {t('Zweryfikowana atrybucja: ', 'Reviewed attribution: ')}
                    {imp.reviewedAttributionValue}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  {imp.status === 'proposed' ? (
                    <button
                      type="button"
                      disabled={impactBusy}
                      className={GHOST_BUTTON_CLASS}
                      onClick={() => {
                        setImpactBusy(true);
                        commitInitiativeKpiImpact(imp.impactId, { expectedVersion: imp.rowVersion })
                          .then(() => {
                            toast.success(t('Wpływ zatwierdzony (baseline zamrożony)', 'Impact committed (baseline frozen)'));
                            loadInitiativeImpacts();
                          })
                          .catch((err) => toast.error(toUserFacingErrorMessage(err, isPolish)))
                          .finally(() => setImpactBusy(false));
                      }}
                    >
                      {t('Zatwierdź (commit)', 'Commit')}
                    </button>
                  ) : null}
                  {(imp.status === 'committed' || imp.status === 'superseded') && !imp.reviewedAttributionValue ? (
                    <button
                      type="button"
                      disabled={impactBusy}
                      className={GHOST_BUTTON_CLASS}
                      onClick={() => {
                        setAttributionError(null);
                        setAttributionTarget(imp);
                      }}
                      data-testid={`kpi-tool-record-reviewed-attribution-${imp.impactId}`}
                    >
                      {t('Zapisz zweryfikowaną atrybucję', 'Record reviewed attribution')}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-xl border border-c-border-subtle p-4 space-y-2">
          <p className={LABEL_CLASS}>{t('Zaproponuj wpływ inicjatywy', 'Propose an initiative impact')}</p>
          <input
            value={proposeInitiativeId}
            onChange={(e) => setProposeInitiativeId(e.target.value)}
            placeholder={t('ID inicjatywy', 'Initiative id')}
            className={FIELD_CLASS}
            data-testid="kpi-tool-propose-initiative-id"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={proposeContributionValue}
              onChange={(e) => setProposeContributionValue(e.target.value)}
              placeholder={t('Oczekiwana wartość (opcjonalnie)', 'Expected value (optional)')}
              className={FIELD_CLASS}
            />
            <select value={proposeDirection} onChange={(e) => setProposeDirection(e.target.value as 'increase' | 'decrease')} className={FIELD_CLASS}>
              <option value="increase">{t('Wzrost', 'Increase')}</option>
              <option value="decrease">{t('Spadek', 'Decrease')}</option>
            </select>
          </div>
          <button
            type="button"
            disabled={impactBusy || !proposeInitiativeId.trim()}
            className={PRIMARY_BUTTON_CLASS}
            data-testid="kpi-tool-propose-initiative-submit"
            onClick={() => {
              setImpactBusy(true);
              proposeInitiativeKpiImpact({
                kpiId: kpi.kpiId,
                initiativeId: proposeInitiativeId.trim(),
                expectedContributionValue: proposeContributionValue ? Number(proposeContributionValue) : null,
                expectedContributionDirection: proposeDirection,
              })
                .then(() => {
                  toast.success(t('Wpływ zaproponowany', 'Impact proposed'));
                  setProposeInitiativeId('');
                  setProposeContributionValue('');
                  loadInitiativeImpacts();
                })
                .catch((err) => toast.error(toUserFacingErrorMessage(err, isPolish)))
                .finally(() => setImpactBusy(false));
            }}
          >
            {t('Zaproponuj', 'Propose')}
          </button>
        </div>
      </div>
    ),
  };

  // ── Section 7: Scorecards and contexts — UNAVAILABLE (see file header) ──
  const scorecardsSection: NModeSection = {
    id: 'scorecards',
    icon: LayoutGrid,
    label: { pl: 'Karty wyników i konteksty', en: 'Scorecards and contexts' },
    hasData: false,
    alwaysShow: true,
    component: (
      <GapNotice>
        {t(
          'Brak odwrotnego endpointu kpi -> karty wyników (kpiScorecard.routes.ts ma wyłącznie GET /:scorecardId/items, nigdy w drugą stronę). Ta sekcja celowo nie pokazuje żadnej listy zamiast zmyślać.',
          'No reverse kpi -> scorecards endpoint exists (kpiScorecard.routes.ts only has GET /:scorecardId/items, never the reverse). This section intentionally shows no list rather than fabricating one.'
        )}
      </GapNotice>
    ),
  };

  // ── Section 8: History / Lineage — UNAVAILABLE (see file header) ──
  const historySection: NModeSection = {
    id: 'history',
    icon: FileText,
    label: { pl: 'Historia / rodowód', en: 'History / lineage' },
    hasData: false,
    alwaysShow: true,
    component: (
      <GapNotice>
        {t(
          'Brak GET dla historii/eventów KPI w całej domenie (sprawdzono kpi.routes.ts, kpiDeviation.routes.ts, kpiScorecard.routes.ts) — eventy istnieją w rvn_platform_events, ale żaden route ich nie czyta.',
          'No GET exists for KPI history/events anywhere in the domain (checked kpi.routes.ts, kpiDeviation.routes.ts, kpiScorecard.routes.ts) — events exist in rvn_platform_events, but no route reads them.'
        )}
      </GapNotice>
    ),
  };

  const sections: NModeSection[] = [
    performanceSection,
    contractSection,
    measurementsSection,
    deviationsSection,
    correctiveActionsSection,
    initiativesSection,
    scorecardsSection,
    historySection,
  ];

  return (
    <div className="h-full" data-testid="results-vnext-kpi-tool-page">
      <NModeShell
        header={header}
        sections={sections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        presentationMode="n"
        onPresentationModeChange={() => {}}
        showModeSwitcher={false}
        rightPanel={<ArtifactRightPanel sections={rightPanelSections} ariaLabel={t('Panel KPI', 'KPI panel')} />}
      />
      <KpiReviewedAttributionDialog
        open={!!attributionTarget}
        isPolish={isPolish}
        onClose={() => (attributionBusy ? undefined : setAttributionTarget(null))}
        onSubmit={submitReviewedAttribution}
        busy={attributionBusy}
        errorMessage={attributionError}
      />
    </div>
  );
};

export default KpiToolPage;

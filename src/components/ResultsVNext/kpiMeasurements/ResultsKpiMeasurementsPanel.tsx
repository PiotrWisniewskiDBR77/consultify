/**
 * ResultsKpiMeasurementsPanel — RN-G2 §G #7 "pomiary KPI" sub-view.
 *
 * -- PLACEMENT DECISION (task brief explicitly requires justifying this,
 * "nie twórz nowych tras"): rendered as a SUB-VIEW of a selected KPI inside
 * the EXISTING `/results/kpi` route, not a new Menu 2 tab and not a new
 * route. Reasons:
 *   1. Measurements are inherently scoped to ONE KPI (`GET/POST
 *      .../kpi/:kpiId/measurements`) — there is no cross-KPI "all
 *      measurements" listing endpoint anywhere in `kpi.routes.ts`, so a
 *      registry-level Menu 2 tab (the pattern `ResultsKpiRegistryPage.tsx`
 *      already uses for "Scorecards" — a REAL separate registry with its own
 *      `GET /kpi/scorecards`) would have nothing to list until a KPI is
 *      picked first. A tab that's empty/disabled until a row is selected
 *      elsewhere is a worse fit than a drill-down.
 *   2. Master plan §11's routing contract (`RN_G2_UI_SCOPE.md` §E) enumerates
 *      exactly `/results/kpi`, `/results/kpi/scorecards/:id`,
 *      `/results/roi(/cases/:id)`, `/results/okr(/sets/:id)` — no
 *      `/results/kpi/:kpiId/measurements` route. Adding one would be
 *      inventing a route the architecture owner hasn't decided on (§G open
 *      question #2, full-tool archetype, is explicitly unresolved) — the
 *      task brief forbids this.
 *   3. `ResultsKpiRegistryPage.tsx`'s own preview pane already surfaces a
 *      KPI's *latest* measurement inline (`buildPreview`'s "measurement"
 *      property row) — this panel is the natural "see the rest" expansion
 *      of that same context, entered from the SAME selected-row state
 *      (a preview action + a row-menu entry both call `onOpenMeasurements`),
 *      not a sibling top-level surface.
 * Internal-state drill-down (like `ResultsKpiRegistryPage.tsx`'s own
 * `tab === 'scorecards'` branch swaps in a different registry) is the
 * established in-repo precedent for "a different view of the same route
 * without a URL change" — this component follows the exact same shape one
 * level deeper: a KPI-scoped sub-view instead of a KPI-registry tab.
 *
 * Reuses `ResultsVNextRegistryShell` (Menu 1 `breadcrumbs` for the
 * "KPI registry > <code> > Pomiary" back-path — the shell's own doc
 * explicitly names `breadcrumbs` for exactly this "embedded hub" case) with
 * Menu 2 tabs for "Bieżące"/"Pełna historia"
 * (`listKpiMeasurements`'s `includeSuperseded` toggle — see `../kpiApi.ts`
 * doc) and Menu 3 chips for `dataQualityStatus` (counts always shown,
 * including 0 — TRIADA §Menu3.1).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import type { StandardCounterChip, StandardModuleTab } from '@/components/standard';

import {
  correctKpiMeasurement,
  disputeKpiMeasurement,
  httpErrorCode,
  KPI_DATA_QUALITY_STATUSES,
  type KpiDataQualityStatus,
  type KpiDefinitionDto,
  type KpiMeasurementDto,
  listKpiMeasurements,
  recordKpiMeasurement,
  verifyKpiMeasurement,
} from '../kpiApi';
import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import { KpiMeasurementCorrectionModal } from './KpiMeasurementCorrectionModal';
import {
  KpiMeasurementDataQualityModal,
  type KpiMeasurementDataQualityMode,
} from './KpiMeasurementDataQualityModal';
import { KpiMeasurementRecordModal } from './KpiMeasurementRecordModal';
import { kpiDataQualityStatusLabel } from './kpiMeasurementMappers';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import {
  buildKpiMeasurementColumns,
  buildKpiMeasurementPreview,
  buildKpiMeasurementRowMenu,
  withMeasurementId,
} from './kpiMeasurementPresenters';

type MeasurementTab = 'current' | 'history';

export interface ResultsKpiMeasurementsPanelProps {
  kpi: KpiDefinitionDto;
  isPolish: boolean;
  onBack: () => void;
}

function errMessage(err: unknown, isPolish: boolean): string {
  return toUserFacingErrorMessage(err, isPolish);
}

export const ResultsKpiMeasurementsPanel: React.FC<ResultsKpiMeasurementsPanelProps> = ({
  kpi,
  isPolish,
  onBack,
}) => {
  const [tab, setTab] = useState<MeasurementTab>('current');
  const [rows, setRows] = useState<KpiMeasurementDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dqChip, setDqChip] = useState<'all' | KpiDataQualityStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const [correctionTarget, setCorrectionTarget] = useState<KpiMeasurementDto | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  const [dqTarget, setDqTarget] = useState<{ mode: KpiMeasurementDataQualityMode; measurement: KpiMeasurementDto } | null>(
    null
  );
  const [dqError, setDqError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listKpiMeasurements(kpi.kpiId, {
        includeSuperseded: tab === 'history',
        limit: 200,
      });
      setRows(items);
    } catch (err) {
      setError(errMessage(err, isPolish));
    } finally {
      setLoading(false);
    }
  }, [kpi.kpiId, tab]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const visibleRows = useMemo(() => {
    if (dqChip === 'all') return rows;
    return rows.filter((r) => r.dataQualityStatus === dqChip);
  }, [rows, dqChip]);

  const chips: StandardCounterChip[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of KPI_DATA_QUALITY_STATUSES) counts[s] = 0;
    for (const r of rows) counts[r.dataQualityStatus] = (counts[r.dataQualityStatus] ?? 0) + 1;
    return [
      { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: rows.length },
      ...KPI_DATA_QUALITY_STATUSES.map((s) => ({
        id: s,
        label: kpiDataQualityStatusLabel(s, isPolish),
        count: counts[s] ?? 0,
      })),
    ];
  }, [rows, isPolish]);

  const tableRows = useMemo(() => visibleRows.map((r) => withMeasurementId(r)), [visibleRows]);
  const selectedRow = visibleRows.find((r) => r.measurementId === selectedId) ?? null;

  const openVerify = useCallback((row: KpiMeasurementDto) => {
    setDqError(null);
    setDqTarget({ mode: 'verify', measurement: row });
  }, []);
  const openDispute = useCallback((row: KpiMeasurementDto) => {
    setDqError(null);
    setDqTarget({ mode: 'dispute', measurement: row });
  }, []);
  const openCorrection = useCallback((row: KpiMeasurementDto) => {
    setCorrectionError(null);
    setCorrectionTarget(row);
  }, []);

  const runRecord = useCallback(
    async (values: { periodStart: string; periodEnd: string; actualValue: number | null; source: string; notes: string | null; reason: string | null }) => {
      setBusy(true);
      setRecordError(null);
      try {
        const created = await recordKpiMeasurement(kpi.kpiId, values);
        setRecordOpen(false);
        await fetchRows();
        setSelectedId(created.measurementId);
      } catch (err) {
        setRecordError(errMessage(err, isPolish));
      } finally {
        setBusy(false);
      }
    },
    [kpi.kpiId, fetchRows]
  );

  const runCorrection = useCallback(
    async (values: { actualValue: number | null; correctionReason: string }) => {
      if (!correctionTarget) return;
      setBusy(true);
      setCorrectionError(null);
      try {
        const { measurement } = await correctKpiMeasurement(kpi.kpiId, correctionTarget.measurementId, values);
        setCorrectionTarget(null);
        await fetchRows();
        setSelectedId(measurement.measurementId);
      } catch (err) {
        setCorrectionError(errMessage(err, isPolish));
      } finally {
        setBusy(false);
      }
    },
    [kpi.kpiId, correctionTarget, fetchRows]
  );

  const runDataQuality = useCallback(
    async (values: { text: string }) => {
      if (!dqTarget) return;
      setBusy(true);
      setDqError(null);
      try {
        const { measurement } =
          dqTarget.mode === 'verify'
            ? await verifyKpiMeasurement(kpi.kpiId, dqTarget.measurement.measurementId, { notes: values.text || null })
            : await disputeKpiMeasurement(kpi.kpiId, dqTarget.measurement.measurementId, {
                disputeReason: values.text,
              });
        setDqTarget(null);
        await fetchRows();
        setSelectedId(measurement.measurementId);
      } catch (err) {
        const code = httpErrorCode(err);
        if (code === 'MEASUREMENT_NOT_FOUND') {
          toast.error(errMessage(err, isPolish));
          setDqTarget(null);
          await fetchRows();
        } else {
          setDqError(errMessage(err, isPolish));
        }
      } finally {
        setBusy(false);
      }
    },
    [kpi.kpiId, dqTarget, fetchRows]
  );

  const tabs: StandardModuleTab[] = [
    { id: 'current', label: isPolish ? 'Bieżące' : 'Current' },
    { id: 'history', label: isPolish ? 'Pełna historia' : 'Full history' },
  ];

  return (
    <div className="h-full" data-testid="results-vnext-kpi-measurements-panel">
      <ResultsVNextRegistryShell
        domain="kpi"
        moduleBar={{
          breadcrumbs: [
            { label: isPolish ? 'Rejestr KPI' : 'KPI registry', onClick: onBack },
            { label: kpi.kpiCode },
          ],
          breadcrumbCta: {
            label: isPolish ? 'Zarejestruj pomiar' : 'Record measurement',
            onClick: () => {
              setRecordError(null);
              setRecordOpen(true);
            },
            testId: 'kpi-measurements-record-cta',
          },
          tabs,
          activeTab: tab,
          onTabChange: (id) => {
            setTab(id === 'history' ? 'history' : 'current');
            setSelectedId(null);
          },
          showTabCounts: false,
          chips,
          activeChip: dqChip,
          onChipChange: (id) => setDqChip(id === 'all' ? 'all' : (id as KpiDataQualityStatus)),
        }}
        table={{
          columns: buildKpiMeasurementColumns(isPolish, tab === 'history'),
          data: tableRows,
          persistKey:
            tab === 'history' ? 'results-vnext.kpi-measurements.history' : 'results-vnext.kpi-measurements.current',
          loading,
          error,
          onRetry: () => void fetchRows(),
          empty:
            !loading && !error && rows.length === 0
              ? {
                  title: isPolish ? 'Brak zarejestrowanych pomiarów' : 'No measurements recorded yet',
                  description: isPolish
                    ? 'Zarejestruj pierwszy pomiar dla tego KPI, aby zacząć śledzić historię.'
                    : 'Record the first measurement for this KPI to start tracking history.',
                }
              : undefined,
          emptyMessage:
            !loading && !error && rows.length > 0 && visibleRows.length === 0
              ? isPolish
                ? 'Brak pomiarów pasujących do aktualnego filtra.'
                : 'No measurements match the current filter.'
              : undefined,
          selectedRowId: selectedId,
          onRowClick: (row) => setSelectedId(String(row.id)),
          rowMenu: (row) =>
            buildKpiMeasurementRowMenu(row as unknown as KpiMeasurementDto, {
              isPolish,
              busy,
              onPreview: (r) => setSelectedId(r.measurementId),
              onVerify: openVerify,
              onDispute: openDispute,
              onCorrect: openCorrection,
            }),
          defaultSort: { columnId: 'period', direction: 'desc' },
        }}
        preview={
          selectedRow
            ? buildKpiMeasurementPreview(selectedRow, {
                isPolish,
                busy,
                onClose: () => setSelectedId(null),
                onVerify: openVerify,
                onDispute: openDispute,
                onCorrect: openCorrection,
                onSelectMeasurementId: (id) => {
                  // Only jumps if the target row is in the currently loaded
                  // set (only guaranteed on the "Pełna historia" tab — see
                  // `kpiMeasurementPresenters.tsx`'s own doc for this
                  // deliberate, honest limitation).
                  if (rows.some((r) => r.measurementId === id)) setSelectedId(id);
                },
              })
            : null
        }
      />

      <KpiMeasurementRecordModal
        open={recordOpen}
        onClose={() => (busy ? undefined : setRecordOpen(false))}
        onSubmit={(values) => void runRecord(values)}
        isPolish={isPolish}
        kpiCode={kpi.kpiCode}
        busy={busy}
        errorMessage={recordError}
      />

      <KpiMeasurementCorrectionModal
        open={!!correctionTarget}
        onClose={() => (busy ? undefined : setCorrectionTarget(null))}
        onSubmit={(values) => void runCorrection(values)}
        isPolish={isPolish}
        measurement={correctionTarget}
        busy={busy}
        errorMessage={correctionError}
      />

      <KpiMeasurementDataQualityModal
        open={!!dqTarget}
        mode={dqTarget?.mode ?? 'verify'}
        onClose={() => (busy ? undefined : setDqTarget(null))}
        onSubmit={(values) => void runDataQuality(values)}
        isPolish={isPolish}
        measurement={dqTarget?.measurement ?? null}
        busy={busy}
        errorMessage={dqError}
      />
    </div>
  );
};

export default ResultsKpiMeasurementsPanel;

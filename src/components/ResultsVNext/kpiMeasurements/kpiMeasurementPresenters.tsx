/**
 * RN-G2 §G #7 — KPI Measurements presentation builders: columns / row menu /
 * preview for `StandardTable`/`StandardPreview`, built from real
 * `KpiMeasurementDto` data (`../kpiApi.ts`). Deliberately PURE functions of
 * their inputs (no fetching, no state) — same rationale as
 * `../kpiScorecards/kpiScorecardPresenters.tsx`'s own header: one
 * implementation renders both the live `ResultsKpiMeasurementsPanel.tsx` and
 * the dev-render QA harness, never two that can silently drift.
 *
 * -- ROW-MENU ZONE MAPPING (a deliberate choice, documented once here):
 * `StandardRowMenu` has exactly 5 zones (primary / statusTransitions /
 * timeActions / universalHandlers{preview,edit,archive} / destructive) and
 * this domain has 4 real actions (preview, verify, dispute, correct) plus no
 * delete endpoint. Mapping used:
 *   - `primary`             → "Podgląd"/"Preview" (open in the right pane)
 *   - `statusTransitions`   → "Zweryfikuj"/"Verify" + "Zakwestionuj"/"Dispute"
 *     (these genuinely change `dataQualityStatus`, i.e. a state transition —
 *     the exact shape this zone exists for)
 *   - `universalHandlers.edit` → "Koryguj"/"Correct" (the closest existing
 *     capability slot to "edit this record's value" — `correctMeasurement`
 *     inserts a new row with a corrected `actualValue`, which is
 *     conceptually an edit of the measured fact even though the DB
 *     implementation is append-only)
 *   - `destructive`         → omitted. No delete/void endpoint exists
 *     anywhere in `kpi.routes.ts` for a measurement — never fabricate one.
 *
 * -- NO ACTION IS EVER ROW-MENU-DISABLED here. Verified in
 * `kpiMeasurementCommands.ts`: none of correct/verify/dispute checks the
 * measurement's current `dataQualityStatus` or the actor's relationship to
 * `recordedBy` before allowing the write — there is no server rule to mirror
 * client-side. Disabling e.g. "Verify" on an already-verified row would be
 * inventing a business rule this package has no authority to invent (task
 * brief: "Nigdy nie wymyślaj... reguły uprawnień, której nie definiuje...
 * realny kod serwera"). Documented as a real backend gap in the task report,
 * not silently patched over with an invented client-side guard.
 */
import React from 'react';

import { HonestValueCell } from '../HonestValue';
import { StatusChip } from '@/components/ui/primitives';
import type {
  RelationItem,
  StandardPreviewProps,
  StandardRowMenu,
  TableColumn,
} from '@/components/standard';

import type { KpiMeasurementDto } from '../kpiApi';
import {
  formatKpiActualValue,
  formatKpiMeasurementDate,
  formatKpiMeasurementDateTime,
  formatKpiMeasurementPeriod,
  kpiDataQualityStatusLabel,
  kpiPerformanceStatusLabel,
  KPI_DATA_QUALITY_STATUS_TONE,
  KPI_PERFORMANCE_STATUS_TONE,
  shortKpiMeasurementId,
} from './kpiMeasurementMappers';

// ==========================================
// Columns (Bieżące / Pełna historia tabs)
// ==========================================

export function buildKpiMeasurementColumns(isPolish: boolean, showLineage: boolean): TableColumn[] {
  const columns: TableColumn[] = [
    {
      id: 'period',
      label: isPolish ? 'Okres' : 'Period',
      width: '190px',
      sortable: true,
      render: (row: KpiMeasurementDto) => (
        <span className="text-sm font-medium text-c-text">
          {formatKpiMeasurementPeriod(row.periodStart, row.periodEnd, isPolish)}
        </span>
      ),
    },
    {
      id: 'actualValue',
      label: isPolish ? 'Wartość' : 'Value',
      width: '120px',
      render: (row: KpiMeasurementDto) => (
        <HonestValueCell
          value={row.actualValue}
          align="right"
          format={(v) => (
            <span className="tabular-nums font-medium text-c-text">{formatKpiActualValue(v, isPolish)}</span>
          )}
        />
      ),
    },
    {
      id: 'performanceStatus',
      label: isPolish ? 'Wynik' : 'Performance',
      width: '150px',
      filterable: true,
      filterOptions: (['on_target', 'warning', 'critical', 'neutral'] as const).map((s) => ({
        value: s,
        label: kpiPerformanceStatusLabel(s, isPolish),
      })),
      render: (row: KpiMeasurementDto) => (
        <StatusChip
          label={kpiPerformanceStatusLabel(row.performanceStatus, isPolish)}
          tone={KPI_PERFORMANCE_STATUS_TONE[row.performanceStatus]}
        />
      ),
    },
    {
      id: 'dataQualityStatus',
      label: isPolish ? 'Jakość danych' : 'Data quality',
      width: '160px',
      filterable: true,
      filterOptions: (['unverified', 'verified', 'disputed', 'estimated'] as const).map((s) => ({
        value: s,
        label: kpiDataQualityStatusLabel(s, isPolish),
      })),
      render: (row: KpiMeasurementDto) => (
        <StatusChip
          label={kpiDataQualityStatusLabel(row.dataQualityStatus, isPolish)}
          tone={KPI_DATA_QUALITY_STATUS_TONE[row.dataQualityStatus]}
        />
      ),
    },
    {
      id: 'source',
      label: isPolish ? 'Źródło' : 'Source',
      width: '130px',
      render: (row: KpiMeasurementDto) => <span className="text-sm text-c-text-secondary">{row.source}</span>,
    },
  ];

  if (showLineage) {
    columns.push({
      id: 'correctionOfMeasurementId',
      label: isPolish ? 'Koryguje' : 'Corrects',
      width: '120px',
      render: (row: KpiMeasurementDto) => (
        <span className="text-sm text-c-text-muted font-mono" title={row.correctionOfMeasurementId ?? undefined}>
          {shortKpiMeasurementId(row.correctionOfMeasurementId)}
        </span>
      ),
    });
  }

  columns.push({
    id: 'recordedAt',
    label: isPolish ? 'Zarejestrowano' : 'Recorded',
    width: '160px',
    sortable: true,
    render: (row: KpiMeasurementDto) => (
      <span className="text-sm text-c-text-muted">{formatKpiMeasurementDateTime(row.recordedAt, isPolish)}</span>
    ),
  });

  return columns;
}

// ==========================================
// Row menu
// ==========================================

export interface KpiMeasurementRowMenuCtx {
  isPolish: boolean;
  busy: boolean;
  onPreview: (row: KpiMeasurementDto) => void;
  onVerify: (row: KpiMeasurementDto) => void;
  onDispute: (row: KpiMeasurementDto) => void;
  onCorrect: (row: KpiMeasurementDto) => void;
}

export function buildKpiMeasurementRowMenu(
  row: KpiMeasurementDto,
  ctx: KpiMeasurementRowMenuCtx
): StandardRowMenu {
  const t = (pl: string, en: string) => (ctx.isPolish ? pl : en);
  return {
    primary: [
      { id: 'preview', label: t('Podgląd', 'Preview'), onClick: () => ctx.onPreview(row), disabled: ctx.busy },
    ],
    statusTransitions: [
      { id: 'verify', label: t('Zweryfikuj', 'Verify'), onClick: () => ctx.onVerify(row), disabled: ctx.busy },
      { id: 'dispute', label: t('Zakwestionuj', 'Dispute'), onClick: () => ctx.onDispute(row), disabled: ctx.busy },
    ],
    universalHandlers: {
      preview: () => ctx.onPreview(row),
      edit: () => ctx.onCorrect(row),
    },
    // No delete/void endpoint for a measurement anywhere in kpi.routes.ts —
    // never fabricate one (see file header).
    destructive: undefined,
  };
}

// ==========================================
// Preview
// ==========================================

export interface KpiMeasurementPreviewCtx {
  isPolish: boolean;
  busy: boolean;
  onClose: () => void;
  onVerify: (row: KpiMeasurementDto) => void;
  onDispute: (row: KpiMeasurementDto) => void;
  onCorrect: (row: KpiMeasurementDto) => void;
  /** Selects the original measurement this row corrects, when present — lets
   * the "Corrects" relation chip jump to it (only reachable when the
   * original is loaded, i.e. the "Pełna historia" tab). `undefined` when the
   * origin row isn't in the currently loaded set (e.g. "Bieżące" tab, which
   * only ever loads current rows and may not include the superseded
   * original) — the relation chip still renders, just without a click
   * handler, rather than silently doing nothing on click. */
  onSelectMeasurementId?: (measurementId: string) => void;
}

export function buildKpiMeasurementPreview(
  row: KpiMeasurementDto,
  ctx: KpiMeasurementPreviewCtx
): StandardPreviewProps {
  const t = (pl: string, en: string) => (ctx.isPolish ? pl : en);
  const lang = ctx.isPolish ? 'pl-PL' : 'en-US';

  const relations: RelationItem[] = row.correctionOfMeasurementId
    ? [
        {
          id: 'corrects',
          label: t('Koryguje pomiar', 'Corrects measurement'),
          value: shortKpiMeasurementId(row.correctionOfMeasurementId),
          title: row.correctionOfMeasurementId,
          onClick: ctx.onSelectMeasurementId
            ? () => ctx.onSelectMeasurementId?.(row.correctionOfMeasurementId as string)
            : undefined,
        },
      ]
    : [];

  return {
    title: formatKpiMeasurementPeriod(row.periodStart, row.periodEnd, ctx.isPolish),
    onClose: ctx.onClose,
    meta: {
      pills: [
        {
          label: kpiPerformanceStatusLabel(row.performanceStatus, ctx.isPolish),
          tone: KPI_PERFORMANCE_STATUS_TONE[row.performanceStatus],
        },
        {
          label: kpiDataQualityStatusLabel(row.dataQualityStatus, ctx.isPolish),
          tone: KPI_DATA_QUALITY_STATUS_TONE[row.dataQualityStatus],
        },
      ],
      trailing: (
        <span className="text-[11px] font-semibold text-c-text-secondary">
          {formatKpiMeasurementDateTime(row.recordedAt, ctx.isPolish)}
        </span>
      ),
    },
    details: {
      // OQ-UI-D (RN_G2_OPEN_QUESTIONS_UI.md): `StandardPreview`'s "Property"/
      // "Value" header default is English-only; the fix belongs to the
      // CALLER (`propertyLabel`/`valueLabel` already exist as props, L122-123
      // of StandardPreview.tsx) — never the shared component. Supplied here
      // so this package doesn't repeat the gap the open-questions doc found
      // in all four pre-existing RN-G2 screens.
      propertyLabel: t('Właściwość', 'Property'),
      valueLabel: t('Wartość', 'Value'),
      properties: [
        {
          id: 'actualValue',
          label: t('Wartość', 'Value'),
          value: (
            <HonestValueCell
              value={row.actualValue}
              format={(v) => (
                <span className="tabular-nums font-medium text-c-text">{v.toLocaleString(lang)}</span>
              )}
            />
          ),
        },
        { id: 'source', label: t('Źródło', 'Source'), value: row.source },
        { id: 'recordedBy', label: t('Zarejestrował(a)', 'Recorded by'), value: shortKpiMeasurementId(row.recordedBy) },
        {
          id: 'evidenceRefs',
          label: t('Dowody', 'Evidence'),
          value: row.evidenceRefs.length > 0 ? String(row.evidenceRefs.length) : '—',
        },
        {
          id: 'correctionReason',
          label: t('Powód korekty', 'Correction reason'),
          value: row.correctionReason ?? '—',
        },
        { id: 'notes', label: t('Notatki', 'Notes'), value: row.notes ?? '—' },
        { id: 'definitionVersion', label: t('Wersja definicji', 'Definition version'), value: shortKpiMeasurementId(row.definitionVersionId) },
      ],
    },
    ai: {
      hints: [],
      disabled: true,
      disabledTooltip: t('Wkrótce', 'Coming soon'),
    },
    relations,
    actions: {
      resolutions: [
        {
          id: 'verify',
          variant: 'positive',
          label: t('Zweryfikuj', 'Verify'),
          onClick: () => ctx.onVerify(row),
          disabled: ctx.busy,
        },
        {
          id: 'dispute',
          variant: 'warning',
          label: t('Zakwestionuj', 'Dispute'),
          onClick: () => ctx.onDispute(row),
          disabled: ctx.busy,
        },
      ],
      informational: [
        {
          id: 'correct',
          variant: 'neutral',
          label: t('Koryguj wartość', 'Correct value'),
          onClick: () => ctx.onCorrect(row),
          disabled: ctx.busy,
        },
      ],
    },
  };
}

export function withMeasurementId<T extends { measurementId: string }>(
  row: T
): T & { id: string } {
  return { ...row, id: row.measurementId };
}

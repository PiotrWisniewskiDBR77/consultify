/**
 * ROI Case FULL TOOL — presentation builders (columns / row menu / preview)
 * for the 11 sub-resource groups `roiCaseFullToolApi.ts` adds: Scenarios (+
 * overrides via `relations`), Calculation runs, Approval snapshots, Forecast
 * versions (+ Compare as a single-row settings-style view), Actuals (+
 * corrections/verify/dispute), Actual snapshots, Variances (+ causes via
 * `relations`), case-level Benefits realization (single-row settings-style
 * view), PIR, Finance links, Finance reconciliations.
 *
 * Same PURE-function convention as `roiCaseDetailPresenters.tsx` — one
 * implementation renders both the live `RoiCaseFullTool.tsx` and the
 * dev-render QA harness. Every `details.properties` block passes
 * `propertyLabel`/`valueLabel` explicitly (OQ-UI-D fix, do not repeat the
 * omission).
 */
import React from 'react';

import type { RelationItem, StandardPreviewProps, StandardRowMenu, TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives';

import { HonestValueCell } from '../HonestValue';
import { LifecycleLockBadge } from '../LifecycleLockBadge';
import type { RoiCaseStatus } from './roiApi';
import type {
  RoiActualEntry,
  RoiActualSnapshot,
  RoiApprovalSnapshot,
  RoiCalculationRun,
  RoiCaseBenefitsRealizationView,
  RoiCompareView,
  RoiFinanceLink,
  RoiFinanceReconciliation,
  RoiForecastVersion,
  RoiPostInvestmentReview,
  RoiScenario,
  RoiScenarioOverride,
  RoiVariance,
  RoiVarianceCause,
} from './roiCaseFullToolApi';
import {
  calcRunIrrReason,
  calcRunNpvReason,
  deriveRunOrForecastIrr,
  deriveRunOrForecastNpv,
  forecastVersionIrrReason,
  forecastVersionNpvReason,
  roiActualEntryTypeLabel,
  roiCompareMetricLabel,
  roiDataQualityStatusLabel,
  ROI_DATA_QUALITY_TONE,
  roiEvidenceLinkPurposeLabel,
  roiFinanceReconciliationStatusLabel,
  ROI_FINANCE_RECONCILIATION_STATUS_TONE,
  roiPirOutcomeLabel,
  roiPirStatusLabel,
  roiScenarioOverrideTargetTypeLabel,
  roiScenarioTypeLabel,
  roiVarianceComparisonTypeLabel,
  roiVarianceStatusLabel,
  ROI_VARIANCE_STATUS_TONE,
} from './roiCaseFullToolMappers';
import { formatRoiCurrency, formatRoiDate, formatRoiNumber, formatRoiPercent, getRoiCaseLockInfo } from './roiRegistryMappers';

function propertyLabels(isPolish: boolean): { propertyLabel: string; valueLabel: string } {
  return { propertyLabel: isPolish ? 'Właściwość' : 'Property', valueLabel: isPolish ? 'Wartość' : 'Value' };
}
function aiComingSoon(hints: string[], isPolish: boolean) {
  return { hints, disabled: true, disabledTooltip: isPolish ? 'Wkrótce' : 'Coming soon' };
}
function lockedPreviewChrome(caseStatus: RoiCaseStatus, isPolish: boolean) {
  const lock = getRoiCaseLockInfo(caseStatus);
  if (!lock) return { headerExtra: undefined, recommendation: undefined };
  return {
    headerExtra: (
      <LifecycleLockBadge label={isPolish ? lock.label.pl : lock.label.en} reason={isPolish ? lock.reason.pl : lock.reason.en} />
    ),
    recommendation: isPolish ? lock.reason.pl : lock.reason.en,
  };
}
function withId<T extends object>(row: T, idField: keyof T): T & { id: string } {
  return { ...row, id: String(row[idField]) };
}
export { withId as withRoiFullToolId };

// ==========================================================================
// Scenarios (+ overrides via `relations`)
// ==========================================================================

export function buildRoiScenarioColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'label', label: isPolish ? 'Nazwa' : 'Label', width: '220px', render: (row: RoiScenario) => <span className="text-sm font-medium text-c-text">{row.label}</span> },
    { id: 'scenarioType', label: isPolish ? 'Typ' : 'Type', width: '140px', render: (row: RoiScenario) => <StatusChip label={roiScenarioTypeLabel(row.scenarioType, isPolish)} tone="neutral" /> },
    { id: 'description', label: isPolish ? 'Opis' : 'Description', width: '260px', render: (row: RoiScenario) => <span className="text-sm text-c-text-secondary">{row.description ?? '—'}</span> },
    { id: 'frozen', label: isPolish ? 'Zamrożony' : 'Frozen', width: '110px', render: (row: RoiScenario) => <span className="text-sm text-c-text-muted">{row.frozenAt ? formatRoiDate(row.frozenAt, isPolish) : (isPolish ? 'Nie' : 'No')}</span> },
    { id: 'updatedAt', label: isPolish ? 'Zaktualizowano' : 'Updated', width: '130px', render: (row: RoiScenario) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.updatedAt, isPolish)}</span> },
  ];
}

export function buildRoiScenarioRowMenu(
  row: RoiScenario,
  caseStatus: RoiCaseStatus,
  isPolish: boolean,
  handlers: { onPreview: (r: RoiScenario) => void; onEdit?: (r: RoiScenario) => void; onRemove?: (r: RoiScenario) => void }
): StandardRowMenu {
  const lock = getRoiCaseLockInfo(caseStatus);
  const lockReason = lock ? (isPolish ? lock.reason.pl : lock.reason.en) : undefined;
  return {
    primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => handlers.onPreview(row) }],
    universalHandlers: {
      preview: () => handlers.onPreview(row),
      edit: lock || !handlers.onEdit ? undefined : () => handlers.onEdit!(row),
      editNote: lock ? lockReason : undefined,
    },
    destructive: lock || !handlers.onRemove ? { note: lockReason } : { onClick: () => handlers.onRemove!(row) },
  };
}

export function buildRoiScenarioPreview(
  scenario: RoiScenario,
  overrides: RoiScenarioOverride[] | null,
  caseStatus: RoiCaseStatus,
  isPolish: boolean,
  handlers: { onClose: () => void; onManageOverrides?: () => void; onRemoveOverride?: (o: RoiScenarioOverride) => void }
): StandardPreviewProps {
  const { headerExtra, recommendation } = lockedPreviewChrome(caseStatus, isPolish);
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  const relations: RelationItem[] = (overrides ?? []).map((o) => ({
    id: o.overrideId,
    label: `${roiScenarioOverrideTargetTypeLabel(o.targetType, isPolish)} · ${o.overrideValue ?? o.overrideAmount ?? '—'}`,
    value: o.note ?? undefined,
    type: 'roi-scenario-override',
    onClick: handlers.onRemoveOverride ? () => handlers.onRemoveOverride!(o) : undefined,
  }));
  return {
    title: scenario.label,
    onClose: handlers.onClose,
    headerExtra,
    meta: { pills: [{ label: roiScenarioTypeLabel(scenario.scenarioType, isPolish), tone: 'neutral' }], recommendation },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'description', label: isPolish ? 'Opis' : 'Description', value: scenario.description ?? '—' },
        { id: 'frozen', label: isPolish ? 'Zamrożony' : 'Frozen', value: scenario.frozenAt ? formatRoiDate(scenario.frozenAt, isPolish) : (isPolish ? 'Nie' : 'No') },
        { id: 'updated', label: isPolish ? 'Zaktualizowano' : 'Updated', value: formatRoiDate(scenario.updatedAt, isPolish) },
        { id: 'createdBy', label: isPolish ? 'Utworzył' : 'Created by', value: scenario.createdBy, mono: true },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Porównaj scenariusze'] : ['Compare scenarios'], isPolish),
    relations,
    relationsEmptyLabel: isPolish ? 'Brak nadpisań w tym scenariuszu' : 'No overrides in this scenario',
    actions: handlers.onManageOverrides
      ? { informational: [{ id: 'manage-overrides', variant: 'neutral', label: isPolish ? 'Zarządzaj nadpisaniami' : 'Manage overrides', onClick: handlers.onManageOverrides }] }
      : undefined,
  };
}

// ==========================================================================
// Calculation runs (read-only history + trigger-new is a Menu 2 CTA)
// ==========================================================================

export function buildRoiCalculationRunColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'status', label: isPolish ? 'Status' : 'Status', width: '110px', render: (row: RoiCalculationRun) => <StatusChip label={row.status === 'completed' ? (isPolish ? 'Ukończony' : 'Completed') : (isPolish ? 'Niepowodzenie' : 'Failed')} tone={row.status === 'completed' ? 'success' : 'danger'} /> },
    { id: 'npv', label: 'NPV', width: '130px', align: 'right', render: (row: RoiCalculationRun) => <HonestValueCell value={deriveRunOrForecastNpv(row)} format={(v) => formatRoiNumber(v, isPolish)} notCalculableReason={calcRunNpvReason(row, isPolish)} align="right" /> },
    { id: 'irrPct', label: 'IRR', width: '110px', align: 'right', render: (row: RoiCalculationRun) => <HonestValueCell value={deriveRunOrForecastIrr(row)} format={(v) => formatRoiPercent(v, isPolish)} notCalculableReason={calcRunIrrReason(row, isPolish)} align="right" /> },
    { id: 'simpleRoi', label: isPolish ? 'Prosty ROI' : 'Simple ROI', width: '120px', align: 'right', render: (row: RoiCalculationRun) => <HonestValueCell value={row.status === 'failed' ? 'not_calculable' : row.simpleRoi} format={(v) => formatRoiPercent(v, isPolish)} align="right" /> },
    { id: 'completedAt', label: isPolish ? 'Ukończono' : 'Completed', width: '140px', render: (row: RoiCalculationRun) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.completedAt, isPolish)}</span> },
  ];
}

export function buildRoiCalculationRunRowMenu(row: RoiCalculationRun, isPolish: boolean, onPreview: (r: RoiCalculationRun) => void): StandardRowMenu {
  return { primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => onPreview(row) }], universalHandlers: { preview: () => onPreview(row) } };
}

export function buildRoiCalculationRunPreview(run: RoiCalculationRun, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  return {
    title: isPolish ? `Przebieg kalkulacji` : `Calculation run`,
    onClose,
    meta: { pills: [{ label: run.status === 'completed' ? (isPolish ? 'Ukończony' : 'Completed') : (isPolish ? 'Niepowodzenie' : 'Failed'), tone: run.status === 'completed' ? 'success' : 'danger' }] },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'npv', label: 'NPV', value: <HonestValueCell value={deriveRunOrForecastNpv(run)} format={(v) => formatRoiNumber(v, isPolish)} notCalculableReason={calcRunNpvReason(run, isPolish)} /> },
        { id: 'irr', label: 'IRR', value: <HonestValueCell value={deriveRunOrForecastIrr(run)} format={(v) => formatRoiPercent(v, isPolish)} notCalculableReason={calcRunIrrReason(run, isPolish)} /> },
        { id: 'simpleRoi', label: isPolish ? 'Prosty ROI' : 'Simple ROI', value: <HonestValueCell value={run.status === 'failed' ? 'not_calculable' : run.simpleRoi} format={(v) => formatRoiPercent(v, isPolish)} /> },
        { id: 'totalCosts', label: isPolish ? 'Suma kosztów' : 'Total costs', value: <HonestValueCell value={run.status === 'failed' ? 'not_calculable' : run.totalCosts} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'totalBenefits', label: isPolish ? 'Suma korzyści' : 'Total benefits', value: <HonestValueCell value={run.status === 'failed' ? 'not_calculable' : run.totalFinancialBenefits} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'payback', label: isPolish ? 'Okres zwrotu' : 'Payback', value: <HonestValueCell value={run.status === 'failed' ? 'not_calculable' : run.paybackPeriods} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'bcr', label: isPolish ? 'Wskaźnik korzyści/koszty' : 'Benefit-cost ratio', value: <HonestValueCell value={run.status === 'failed' ? 'not_calculable' : run.benefitCostRatio} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'doubleCounting', label: isPolish ? 'Nierozwiązane podwójne liczenie' : 'Unresolved double counting', value: run.hasUnresolvedDoubleCounting ? (isPolish ? 'Tak' : 'Yes') : (isPolish ? 'Nie' : 'No') },
        { id: 'mixedCurrency', label: isPolish ? 'Błąd mieszanych walut' : 'Mixed-currency failure', value: run.hasMixedCurrencyFailure ? (isPolish ? 'Tak' : 'Yes') : (isPolish ? 'Nie' : 'No') },
        { id: 'warnings', label: isPolish ? 'Ostrzeżenia' : 'Warnings', value: run.warnings.length > 0 ? String(run.warnings.length) : '—' },
        { id: 'initiatedBy', label: isPolish ? 'Zainicjował' : 'Initiated by', value: run.initiatedBy, mono: true },
        { id: 'completedAt', label: isPolish ? 'Ukończono' : 'Completed', value: formatRoiDate(run.completedAt, isPolish) },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Wyjaśnij wynik'] : ['Explain result'], isPolish),
    relations: [],
  };
}

// ==========================================================================
// Approval snapshots (system-generated, read-only)
// ==========================================================================

export function buildRoiApprovalSnapshotColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'approvedAt', label: isPolish ? 'Zaakceptowano' : 'Approved', width: '160px', render: (row: RoiApprovalSnapshot) => <span className="text-sm text-c-text tabular-nums">{formatRoiDate(row.approvedAt, isPolish)}</span> },
    { id: 'approvedBy', label: isPolish ? 'Zaakceptował' : 'Approved by', width: '200px', render: (row: RoiApprovalSnapshot) => <span className="text-sm text-c-text-secondary font-mono">{row.approvedBy}</span> },
    { id: 'calcRun', label: isPolish ? 'Przebieg kalkulacji' : 'Calculation run', width: '220px', render: (row: RoiApprovalSnapshot) => <span className="text-sm text-c-text-muted font-mono">{row.calculationRunId}</span> },
  ];
}
export function buildRoiApprovalSnapshotRowMenu(row: RoiApprovalSnapshot, isPolish: boolean, onPreview: (r: RoiApprovalSnapshot) => void): StandardRowMenu {
  return { primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => onPreview(row) }], universalHandlers: { preview: () => onPreview(row) } };
}
export function buildRoiApprovalSnapshotPreview(snapshot: RoiApprovalSnapshot, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  return {
    title: isPolish ? 'Migawka akceptacji' : 'Approval snapshot',
    onClose,
    meta: { pills: [{ label: isPolish ? 'Niezmienna' : 'Immutable', tone: 'neutral' }] },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'approvedBy', label: isPolish ? 'Zaakceptował' : 'Approved by', value: snapshot.approvedBy, mono: true },
        { id: 'approvedAt', label: isPolish ? 'Zaakceptowano' : 'Approved at', value: formatRoiDate(snapshot.approvedAt, isPolish) },
        { id: 'calcRun', label: isPolish ? 'Przebieg kalkulacji' : 'Calculation run', value: snapshot.calculationRunId, mono: true },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Wkrótce'] : ['Coming soon'], isPolish),
    relations: [],
  };
}

// ==========================================================================
// Forecast versions
// ==========================================================================

export function buildRoiForecastVersionColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'sequenceNumber', label: '#', width: '60px', render: (row: RoiForecastVersion) => <span className="text-sm text-c-text-muted tabular-nums">{row.sequenceNumber}</span> },
    { id: 'status', label: isPolish ? 'Status' : 'Status', width: '110px', render: (row: RoiForecastVersion) => <StatusChip label={row.status === 'completed' ? (isPolish ? 'Ukończony' : 'Completed') : (isPolish ? 'Niepowodzenie' : 'Failed')} tone={row.status === 'completed' ? 'success' : 'danger'} /> },
    { id: 'reason', label: isPolish ? 'Powód' : 'Reason', width: '240px', render: (row: RoiForecastVersion) => <span className="text-sm text-c-text-secondary">{row.reason}</span> },
    { id: 'npv', label: 'NPV', width: '130px', align: 'right', render: (row: RoiForecastVersion) => <HonestValueCell value={deriveRunOrForecastNpv(row)} format={(v) => formatRoiNumber(v, isPolish)} notCalculableReason={forecastVersionNpvReason(row, isPolish)} align="right" /> },
    { id: 'irrPct', label: 'IRR', width: '110px', align: 'right', render: (row: RoiForecastVersion) => <HonestValueCell value={deriveRunOrForecastIrr(row)} format={(v) => formatRoiPercent(v, isPolish)} notCalculableReason={forecastVersionIrrReason(row, isPolish)} align="right" /> },
    { id: 'publishedAt', label: isPolish ? 'Opublikowano' : 'Published', width: '140px', render: (row: RoiForecastVersion) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.publishedAt, isPolish)}</span> },
  ];
}
export function buildRoiForecastVersionRowMenu(row: RoiForecastVersion, isPolish: boolean, onPreview: (r: RoiForecastVersion) => void): StandardRowMenu {
  return { primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => onPreview(row) }], universalHandlers: { preview: () => onPreview(row) } };
}
export function buildRoiForecastVersionPreview(fv: RoiForecastVersion, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  return {
    title: isPolish ? `Wersja prognozy #${fv.sequenceNumber}` : `Forecast version #${fv.sequenceNumber}`,
    onClose,
    meta: { pills: [{ label: fv.status === 'completed' ? (isPolish ? 'Ukończona' : 'Completed') : (isPolish ? 'Niepowodzenie' : 'Failed'), tone: fv.status === 'completed' ? 'success' : 'danger' }] },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'reason', label: isPolish ? 'Powód' : 'Reason', value: fv.reason },
        { id: 'npv', label: 'NPV', value: <HonestValueCell value={deriveRunOrForecastNpv(fv)} format={(v) => formatRoiNumber(v, isPolish)} notCalculableReason={forecastVersionNpvReason(fv, isPolish)} /> },
        { id: 'irr', label: 'IRR', value: <HonestValueCell value={deriveRunOrForecastIrr(fv)} format={(v) => formatRoiPercent(v, isPolish)} notCalculableReason={forecastVersionIrrReason(fv, isPolish)} /> },
        { id: 'totalCosts', label: isPolish ? 'Suma kosztów' : 'Total costs', value: <HonestValueCell value={fv.status === 'failed' ? 'not_calculable' : fv.totalCosts} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'totalBenefits', label: isPolish ? 'Suma korzyści' : 'Total benefits', value: <HonestValueCell value={fv.status === 'failed' ? 'not_calculable' : fv.totalFinancialBenefits} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'payback', label: isPolish ? 'Okres zwrotu' : 'Payback', value: <HonestValueCell value={fv.status === 'failed' ? 'not_calculable' : fv.paybackPeriods} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'publishedBy', label: isPolish ? 'Opublikował' : 'Published by', value: fv.publishedBy, mono: true },
        { id: 'publishedAt', label: isPolish ? 'Opublikowano' : 'Published at', value: formatRoiDate(fv.publishedAt, isPolish) },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Porównaj z akceptacją'] : ['Compare to approval'], isPolish),
    relations: [],
  };
}

/** `GET .../compare` returns one aggregate view per case — modeled as a
 * single-row settings-style table, same "genuinely-singleton resource still
 * goes through StandardTable" rationale `roiCaseDetailPresenters.tsx`'s
 * `buildRoiSettingsRows` documents at length (CLAUDE.md UI law #1: no
 * bespoke single-record shell). */
export interface RoiCaseViewRowVm {
  id: 'compare' | 'benefits-realization';
  compare: RoiCompareView | null;
  benefitsRealization: RoiCaseBenefitsRealizationView | null;
}
export function buildRoiCaseViewsRows(compare: RoiCompareView | null, benefitsRealization: RoiCaseBenefitsRealizationView | null): RoiCaseViewRowVm[] {
  return [
    { id: 'compare', compare, benefitsRealization: null },
    { id: 'benefits-realization', compare: null, benefitsRealization },
  ];
}
export function buildRoiCaseViewsColumns(isPolish: boolean): TableColumn[] {
  return [
    {
      id: 'label',
      label: isPolish ? 'Widok' : 'View',
      width: '260px',
      render: (row: RoiCaseViewRowVm) => (
        <span className="text-sm font-medium text-c-text">
          {row.id === 'compare' ? (isPolish ? 'Porównanie' : 'Compare') : isPolish ? 'Realizacja korzyści' : 'Benefits realization'}
        </span>
      ),
    },
    {
      id: 'summary',
      label: isPolish ? 'Podsumowanie' : 'Summary',
      width: '360px',
      render: (row: RoiCaseViewRowVm) => {
        if (row.id === 'benefits-realization') {
          const v = row.benefitsRealization;
          if (!v) return <span className="text-sm text-c-text-muted">{isPolish ? 'Brak danych' : 'No data'}</span>;
          return (
            <HonestValueCell
              value={v.benefitsRealizationPct}
              format={(x) => formatRoiPercent(x, isPolish)}
              notCalculableReason={isPolish ? 'Nie do obliczenia.' : 'Not calculable.'}
            />
          );
        }
        return (
          <span className="text-sm text-c-text-secondary">
            {row.compare ? (isPolish ? `${Object.keys(row.compare.metrics ?? {}).length} metryk` : `${Object.keys(row.compare.metrics ?? {}).length} metrics`) : isPolish ? 'Brak danych' : 'No data'}
          </span>
        );
      },
    },
  ];
}
export function buildRoiCaseViewsRowMenu(row: RoiCaseViewRowVm, isPolish: boolean, onPreview: (r: RoiCaseViewRowVm) => void): StandardRowMenu {
  return { primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => onPreview(row) }], universalHandlers: { preview: () => onPreview(row) } };
}
export function buildRoiCaseViewsPreview(row: RoiCaseViewRowVm, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  if (row.id === 'benefits-realization') {
    const v = row.benefitsRealization;
    return {
      title: isPolish ? 'Realizacja korzyści' : 'Benefits realization',
      onClose,
      meta: { pills: [{ label: isPolish ? 'Widok pochodny' : 'Derived view', tone: 'neutral' }] },
      details: {
        showWordCount: false,
        propertyLabel,
        valueLabel,
        properties: v
          ? [
              { id: 'approved', label: isPolish ? 'Zaakceptowane korzyści finansowe' : 'Approved financial benefits', value: <HonestValueCell value={v.approvedFinancialBenefits} format={(x) => formatRoiNumber(x, isPolish)} /> },
              { id: 'actual', label: isPolish ? 'Rzeczywiste korzyści finansowe' : 'Actual financial benefits', value: <HonestValueCell value={v.actualFinancialBenefits} format={(x) => formatRoiNumber(x, isPolish)} /> },
              { id: 'pct', label: isPolish ? 'Procent realizacji' : 'Realization pct', value: <HonestValueCell value={v.benefitsRealizationPct} format={(x) => formatRoiPercent(x, isPolish)} /> },
            ]
          : [{ id: 'missing', label: isPolish ? 'Dane' : 'Data', value: isPolish ? 'Brak danych dla tej sprawy.' : 'No data for this case.' }],
      },
      ai: aiComingSoon(isPolish ? ['Wyjaśnij lukę realizacji'] : ['Explain the realization gap'], isPolish),
      relations: [],
    };
  }
  const c = row.compare;
  const entries = c ? Object.entries(c.metrics ?? {}) : [];
  return {
    title: isPolish ? 'Porównanie (zaakceptowane / prognoza / wykonanie)' : 'Compare (approved / forecast / actual)',
    onClose,
    meta: { pills: [{ label: isPolish ? 'Widok pochodny' : 'Derived view', tone: 'neutral' }] },
    details: {
      showWordCount: false,
      propertyLabel: isPolish ? 'Metryka' : 'Metric',
      valueLabel: isPolish ? 'Zaakceptowane / Prognoza / Wykonanie' : 'Approved / Forecast / Actual',
      properties:
        entries.length > 0
          ? entries.map(([metric, v]) => ({
              id: metric,
              label: roiCompareMetricLabel(metric, isPolish),
              value: `${v.approved ?? '—'} / ${v.forecast ?? '—'} / ${v.actual ?? '—'}`,
            }))
          : [{ id: 'missing', label: isPolish ? 'Dane' : 'Data', value: isPolish ? 'Brak danych porównawczych.' : 'No compare data.' }],
    },
    ai: aiComingSoon(isPolish ? ['Wyjaśnij rozjazd'] : ['Explain the gap'], isPolish),
    relations: [],
  };
}

// ==========================================================================
// Actuals
// ==========================================================================

export function buildRoiActualEntryColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'entryType', label: isPolish ? 'Typ' : 'Type', width: '110px', render: (row: RoiActualEntry) => <StatusChip label={roiActualEntryTypeLabel(row.entryType, isPolish)} tone="neutral" /> },
    { id: 'period', label: isPolish ? 'Okres' : 'Period', width: '200px', render: (row: RoiActualEntry) => <span className="text-sm text-c-text-secondary">{formatRoiDate(row.periodStart, isPolish)} – {formatRoiDate(row.periodEnd, isPolish)}</span> },
    { id: 'amount', label: isPolish ? 'Kwota' : 'Amount', width: '130px', align: 'right', render: (row: RoiActualEntry) => <HonestValueCell value={row.amount} format={(v) => (row.currency ? formatRoiCurrency(v, row.currency, isPolish) : formatRoiNumber(v, isPolish))} align="right" /> },
    { id: 'dataQualityStatus', label: isPolish ? 'Jakość danych' : 'Data quality', width: '140px', render: (row: RoiActualEntry) => <StatusChip label={roiDataQualityStatusLabel(row.dataQualityStatus, isPolish)} tone={ROI_DATA_QUALITY_TONE[row.dataQualityStatus]} /> },
    { id: 'source', label: isPolish ? 'Źródło' : 'Source', width: '160px', render: (row: RoiActualEntry) => <span className="text-sm text-c-text-muted">{row.source}</span> },
    { id: 'recordedAt', label: isPolish ? 'Zarejestrowano' : 'Recorded', width: '140px', render: (row: RoiActualEntry) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.recordedAt, isPolish)}</span> },
  ];
}
export function buildRoiActualEntryRowMenu(
  row: RoiActualEntry,
  isPolish: boolean,
  handlers: { onPreview: (r: RoiActualEntry) => void; onCorrect: (r: RoiActualEntry) => void; onVerify: (r: RoiActualEntry) => void; onDispute: (r: RoiActualEntry) => void }
): StandardRowMenu {
  return {
    primary: [
      { id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => handlers.onPreview(row) },
      { id: 'correct', label: isPolish ? 'Koryguj' : 'Correct', onClick: () => handlers.onCorrect(row) },
      { id: 'verify', label: isPolish ? 'Zweryfikuj' : 'Verify', onClick: () => handlers.onVerify(row) },
      { id: 'dispute', label: isPolish ? 'Zakwestionuj' : 'Dispute', onClick: () => handlers.onDispute(row) },
    ],
    universalHandlers: { preview: () => handlers.onPreview(row) },
  };
}
export function buildRoiActualEntryPreview(entry: RoiActualEntry, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  return {
    title: isPolish ? 'Wykonanie' : 'Actual entry',
    onClose,
    meta: { pills: [{ label: roiDataQualityStatusLabel(entry.dataQualityStatus, isPolish), tone: ROI_DATA_QUALITY_TONE[entry.dataQualityStatus] === 'danger' ? 'danger' : 'neutral' }] },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'entryType', label: isPolish ? 'Typ' : 'Type', value: roiActualEntryTypeLabel(entry.entryType, isPolish) },
        { id: 'period', label: isPolish ? 'Okres' : 'Period', value: `${formatRoiDate(entry.periodStart, isPolish)} – ${formatRoiDate(entry.periodEnd, isPolish)}` },
        { id: 'amount', label: isPolish ? 'Kwota' : 'Amount', value: <HonestValueCell value={entry.amount} format={(v) => (entry.currency ? formatRoiCurrency(v, entry.currency, isPolish) : formatRoiNumber(v, isPolish))} /> },
        { id: 'source', label: isPolish ? 'Źródło' : 'Source', value: entry.source },
        { id: 'notes', label: isPolish ? 'Notatki' : 'Notes', value: entry.notes ?? '—' },
        { id: 'correctionOf', label: isPolish ? 'Korekta wpisu' : 'Correction of entry', value: entry.correctionOfActualEntryId ?? '—', mono: true },
        { id: 'correctionReason', label: isPolish ? 'Powód korekty' : 'Correction reason', value: entry.correctionReason ?? '—' },
        { id: 'recordedBy', label: isPolish ? 'Zarejestrował' : 'Recorded by', value: entry.recordedBy, mono: true },
        { id: 'recordedAt', label: isPolish ? 'Zarejestrowano' : 'Recorded at', value: formatRoiDate(entry.recordedAt, isPolish) },
        { id: 'verifiedBy', label: isPolish ? 'Zweryfikował' : 'Verified by', value: entry.verifiedBy ?? '—', mono: true },
        { id: 'verifiedAt', label: isPolish ? 'Zweryfikowano' : 'Verified at', value: entry.verifiedAt ? formatRoiDate(entry.verifiedAt, isPolish) : '—' },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Wykryj anomalie'] : ['Detect anomalies'], isPolish),
    relations: [],
  };
}

// ==========================================================================
// Actual snapshots
// ==========================================================================

export function buildRoiActualSnapshotColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'sequenceNumber', label: '#', width: '60px', render: (row: RoiActualSnapshot) => <span className="text-sm text-c-text-muted tabular-nums">{row.sequenceNumber}</span> },
    { id: 'asOfPeriodEnd', label: isPolish ? 'Stan na' : 'As of', width: '140px', render: (row: RoiActualSnapshot) => <span className="text-sm text-c-text tabular-nums">{formatRoiDate(row.asOfPeriodEnd, isPolish)}</span> },
    { id: 'coveragePct', label: isPolish ? 'Pokrycie' : 'Coverage', width: '110px', align: 'right', render: (row: RoiActualSnapshot) => <HonestValueCell value={row.coveragePct} format={(v) => formatRoiPercent(v, isPolish)} align="right" /> },
    { id: 'actualNpv', label: 'NPV', width: '130px', align: 'right', render: (row: RoiActualSnapshot) => <HonestValueCell value={row.actualNpv} format={(v) => formatRoiNumber(v, isPolish)} align="right" /> },
    { id: 'unverified', label: isPolish ? 'Niezweryfikowane' : 'Unverified', width: '130px', align: 'right', render: (row: RoiActualSnapshot) => <span className="text-sm tabular-nums text-c-text-muted">{row.unverifiedEntryCount}</span> },
    { id: 'disputed', label: isPolish ? 'Sporne' : 'Disputed', width: '110px', align: 'right', render: (row: RoiActualSnapshot) => <span className="text-sm tabular-nums text-c-text-muted">{row.disputedEntryCount}</span> },
    { id: 'publishedAt', label: isPolish ? 'Opublikowano' : 'Published', width: '140px', render: (row: RoiActualSnapshot) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.publishedAt, isPolish)}</span> },
  ];
}
export function buildRoiActualSnapshotRowMenu(row: RoiActualSnapshot, isPolish: boolean, onPreview: (r: RoiActualSnapshot) => void): StandardRowMenu {
  return { primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => onPreview(row) }], universalHandlers: { preview: () => onPreview(row) } };
}
export function buildRoiActualSnapshotPreview(s: RoiActualSnapshot, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  return {
    title: isPolish ? `Migawka wykonania #${s.sequenceNumber}` : `Actual snapshot #${s.sequenceNumber}`,
    onClose,
    meta: { pills: [{ label: formatRoiDate(s.asOfPeriodEnd, isPolish), tone: 'neutral' }] },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'totalCosts', label: isPolish ? 'Suma kosztów rzeczywistych' : 'Total actual costs', value: <HonestValueCell value={s.totalActualCosts} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'totalBenefits', label: isPolish ? 'Suma korzyści rzeczywistych' : 'Total actual benefits', value: <HonestValueCell value={s.totalActualFinancialBenefits} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'roi', label: isPolish ? 'Rzeczywisty prosty ROI' : 'Actual simple ROI', value: <HonestValueCell value={s.actualSimpleRoi} format={(v) => formatRoiPercent(v, isPolish)} /> },
        { id: 'npv', label: isPolish ? 'Rzeczywiste NPV' : 'Actual NPV', value: <HonestValueCell value={s.actualNpv} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'coverage', label: isPolish ? 'Pokrycie okresów' : 'Period coverage', value: <HonestValueCell value={s.coveragePct} format={(v) => formatRoiPercent(v, isPolish)} /> },
        { id: 'periodsWith', label: isPolish ? 'Okresy z wykonaniem' : 'Periods with actual', value: `${s.periodsWithActualCount} / ${s.periodsExpectedCount}` },
        { id: 'unverified', label: isPolish ? 'Niezweryfikowane wpisy' : 'Unverified entries', value: String(s.unverifiedEntryCount) },
        { id: 'disputed', label: isPolish ? 'Sporne wpisy' : 'Disputed entries', value: String(s.disputedEntryCount) },
        { id: 'entriesIncluded', label: isPolish ? 'Wpisy uwzględnione' : 'Entries included', value: String(s.entryIdsIncluded.length) },
        { id: 'publishedBy', label: isPolish ? 'Opublikował' : 'Published by', value: s.publishedBy, mono: true },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Wkrótce'] : ['Coming soon'], isPolish),
    relations: [],
  };
}

// ==========================================================================
// Variances (+ causes via `relations`)
// ==========================================================================

export function buildRoiVarianceColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'metric', label: isPolish ? 'Metryka' : 'Metric', width: '160px', render: (row: RoiVariance) => <span className="text-sm font-medium text-c-text">{roiCompareMetricLabel(row.metric, isPolish)}</span> },
    { id: 'comparisonType', label: isPolish ? 'Porównanie' : 'Comparison', width: '200px', render: (row: RoiVariance) => <span className="text-sm text-c-text-secondary">{roiVarianceComparisonTypeLabel(row.comparisonType, isPolish)}</span> },
    { id: 'variancePct', label: isPolish ? 'Odchylenie %' : 'Variance %', width: '120px', align: 'right', render: (row: RoiVariance) => <HonestValueCell value={row.variancePct} format={(v) => formatRoiPercent(v, isPolish)} align="right" /> },
    { id: 'status', label: isPolish ? 'Status' : 'Status', width: '140px', render: (row: RoiVariance) => <StatusChip label={roiVarianceStatusLabel(row.status, isPolish)} tone={ROI_VARIANCE_STATUS_TONE[row.status] === 'success' ? 'success' : ROI_VARIANCE_STATUS_TONE[row.status] === 'warning' ? 'warning' : 'neutral'} /> },
    { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', width: '150px', render: (row: RoiVariance) => <span className="text-sm text-c-text-muted font-mono">{row.ownerUserId ?? '—'}</span> },
    { id: 'updatedAt', label: isPolish ? 'Zaktualizowano' : 'Updated', width: '130px', render: (row: RoiVariance) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.updatedAt, isPolish)}</span> },
  ];
}
export function buildRoiVarianceRowMenu(
  row: RoiVariance,
  isPolish: boolean,
  handlers: { onPreview: (r: RoiVariance) => void; onEditStatus: (r: RoiVariance) => void; onAddCause: (r: RoiVariance) => void }
): StandardRowMenu {
  return {
    primary: [
      { id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => handlers.onPreview(row) },
      { id: 'status', label: isPolish ? 'Zmień status' : 'Change status', onClick: () => handlers.onEditStatus(row) },
      { id: 'cause', label: isPolish ? 'Dodaj przyczynę' : 'Add cause', onClick: () => handlers.onAddCause(row) },
    ],
    universalHandlers: { preview: () => handlers.onPreview(row) },
  };
}
export function buildRoiVariancePreview(
  variance: RoiVariance,
  causes: RoiVarianceCause[] | null,
  isPolish: boolean,
  handlers: { onClose: () => void; onRemoveCause?: (c: RoiVarianceCause) => void }
): StandardPreviewProps {
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  const relations: RelationItem[] = (causes ?? []).map((c) => ({
    id: c.causeId,
    label: c.causeCategory,
    value: c.contributionPct !== null ? formatRoiPercent(c.contributionPct, isPolish) : undefined,
    type: 'roi-variance-cause',
    onClick: handlers.onRemoveCause ? () => handlers.onRemoveCause!(c) : undefined,
  }));
  return {
    title: isPolish ? `Wariancja: ${roiCompareMetricLabel(variance.metric, isPolish)}` : `Variance: ${roiCompareMetricLabel(variance.metric, isPolish)}`,
    onClose: handlers.onClose,
    meta: { pills: [{ label: roiVarianceStatusLabel(variance.status, isPolish), tone: variance.status === 'resolved' ? 'success' : variance.status === 'open' ? 'warning' : 'info' }] },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'comparisonType', label: isPolish ? 'Typ porównania' : 'Comparison type', value: roiVarianceComparisonTypeLabel(variance.comparisonType, isPolish) },
        { id: 'baseline', label: isPolish ? 'Wartość bazowa' : 'Baseline value', value: <HonestValueCell value={variance.baselineValue} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'comparison', label: isPolish ? 'Wartość porównawcza' : 'Comparison value', value: <HonestValueCell value={variance.comparisonValue} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'amount', label: isPolish ? 'Kwota odchylenia' : 'Variance amount', value: <HonestValueCell value={variance.varianceAmount} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'pct', label: isPolish ? 'Odchylenie %' : 'Variance %', value: <HonestValueCell value={variance.variancePct} format={(v) => formatRoiPercent(v, isPolish)} /> },
        { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: variance.ownerUserId ?? '—', mono: true },
        { id: 'createdBy', label: isPolish ? 'Utworzył' : 'Created by', value: variance.createdBy, mono: true },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Zaproponuj przyczynę'] : ['Suggest a cause'], isPolish),
    relations,
    relationsEmptyLabel: isPolish ? 'Brak przypisanych przyczyn' : 'No causes attached',
  };
}

// ==========================================================================
// PIR
// ==========================================================================

export function buildRoiPirColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'sequenceNumber', label: '#', width: '60px', render: (row: RoiPostInvestmentReview) => <span className="text-sm text-c-text-muted tabular-nums">{row.sequenceNumber}</span> },
    { id: 'status', label: isPolish ? 'Status' : 'Status', width: '120px', render: (row: RoiPostInvestmentReview) => <StatusChip label={roiPirStatusLabel(row.status, isPolish)} tone={row.status === 'finalized' ? 'success' : 'neutral'} /> },
    { id: 'outcome', label: isPolish ? 'Wynik' : 'Outcome', width: '220px', render: (row: RoiPostInvestmentReview) => <span className="text-sm text-c-text-secondary">{roiPirOutcomeLabel(row.outcome, isPolish)}</span> },
    { id: 'startedAt', label: isPolish ? 'Rozpoczęto' : 'Started', width: '140px', render: (row: RoiPostInvestmentReview) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.startedAt, isPolish)}</span> },
    { id: 'finalizedAt', label: isPolish ? 'Zamknięto' : 'Finalized', width: '140px', render: (row: RoiPostInvestmentReview) => <span className="text-sm text-c-text-muted tabular-nums">{row.finalizedAt ? formatRoiDate(row.finalizedAt, isPolish) : '—'}</span> },
  ];
}
export function buildRoiPirRowMenu(
  row: RoiPostInvestmentReview,
  isPolish: boolean,
  handlers: {
    onPreview: (r: RoiPostInvestmentReview) => void;
    onEditDraft?: (r: RoiPostInvestmentReview) => void;
    onTeresaDisposition?: (r: RoiPostInvestmentReview) => void;
    onAskTeresa?: (r: RoiPostInvestmentReview) => void;
  }
): StandardRowMenu {
  const editable = row.status === 'draft';
  const lockedNote = isPolish ? 'PIR jest zamknięty — tylko do odczytu.' : 'PIR is finalized — read only.';
  const alreadyDrafted = !!row.teresaDraftLessonsPayload;
  const alreadyDraftedNote = isPolish
    ? 'Szkic Teresy już istnieje dla tego PIR — najpierw podejmij decyzję o istniejącym szkicu.'
    : 'A Teresa draft already exists for this PIR — decide on the existing draft first.';
  return {
    primary: [
      { id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => handlers.onPreview(row) },
      ...(editable && handlers.onEditDraft ? [{ id: 'edit-draft', label: isPolish ? 'Edytuj szkic' : 'Edit draft', onClick: () => handlers.onEditDraft!(row) }] : []),
      // RN-G4 lane `teresa` (FALA 2, 2026-08-11) — the GENERATION half of
      // D13's two-gate structure (`onTeresaDisposition` below only ever
      // recorded a decision on an already-generated draft; this is the new
      // "ask Teresa" trigger that actually creates one, via the real P08
      // proposal lifecycle — see `roiTeresaLessonsDraft.ts`). Visible even
      // when disabled (TRIADA §C3 — OQ-UI-A's own "note flows regardless of
      // R01" resolution) so the reason is never hidden.
      ...(handlers.onAskTeresa
        ? [{
            id: 'ask-teresa',
            label: isPolish ? 'Poproś Teresę o szkic wniosków' : 'Ask Teresa for a lessons draft',
            onClick: () => handlers.onAskTeresa!(row),
            disabled: !editable || alreadyDrafted,
            note: !editable ? lockedNote : alreadyDrafted ? alreadyDraftedNote : undefined,
          }]
        : []),
      ...(editable && row.teresaDraftLessonsPayload && !row.teresaDraftDisposition && handlers.onTeresaDisposition
        ? [{ id: 'teresa-disposition', label: isPolish ? 'Decyzja o szkicu Teresy' : "Teresa draft decision", onClick: () => handlers.onTeresaDisposition!(row) }]
        : []),
    ],
    universalHandlers: {
      preview: () => handlers.onPreview(row),
      edit: editable && handlers.onEditDraft ? () => handlers.onEditDraft!(row) : undefined,
      editNote: !editable ? lockedNote : undefined,
    },
  };
}
export function buildRoiPirPreview(pir: RoiPostInvestmentReview, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  return {
    title: isPolish ? `PIR #${pir.sequenceNumber}` : `PIR #${pir.sequenceNumber}`,
    onClose,
    meta: { pills: [{ label: roiPirStatusLabel(pir.status, isPolish), tone: pir.status === 'finalized' ? 'success' : 'neutral' }] },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'outcome', label: isPolish ? 'Wynik' : 'Outcome', value: roiPirOutcomeLabel(pir.outcome, isPolish) },
        { id: 'lessons', label: isPolish ? 'Wnioski' : 'Lessons learned', value: pir.lessonsLearned ?? '—' },
        { id: 'recommendation', label: isPolish ? 'Rekomendacja' : 'Recommendation', value: pir.recommendation ?? '—' },
        { id: 'waiver', label: isPolish ? 'Powód zniesienia wymogu wariancji' : 'Open-variance waiver reason', value: pir.openVarianceWaiverReason ?? '—' },
        { id: 'teresaDisposition', label: isPolish ? 'Decyzja o szkicu Teresy' : 'Teresa draft disposition', value: pir.teresaDraftDisposition ? (isPolish ? { accepted: 'Zaakceptowano', rejected: 'Odrzucono', edited_then_accepted: 'Zmieniono i zaakceptowano' }[pir.teresaDraftDisposition] : pir.teresaDraftDisposition) : '—' },
        { id: 'startedBy', label: isPolish ? 'Rozpoczął' : 'Started by', value: pir.startedBy, mono: true },
        { id: 'startedAt', label: isPolish ? 'Rozpoczęto' : 'Started at', value: formatRoiDate(pir.startedAt, isPolish) },
        { id: 'finalizedBy', label: isPolish ? 'Zamknął' : 'Finalized by', value: pir.finalizedBy ?? '—', mono: true },
        { id: 'finalizedAt', label: isPolish ? 'Zamknięto' : 'Finalized at', value: pir.finalizedAt ? formatRoiDate(pir.finalizedAt, isPolish) : '—' },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Wygeneruj wnioski (Teresa)'] : ['Draft lessons (Teresa)'], isPolish),
    relations: [],
  };
}

// ==========================================================================
// Finance links
// ==========================================================================

export function buildRoiFinanceLinkColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'financeArtifactType', label: isPolish ? 'Typ artefaktu' : 'Artifact type', width: '160px', render: (row: RoiFinanceLink) => <span className="text-sm font-medium text-c-text">{row.financeArtifactType}</span> },
    { id: 'financeArtifactId', label: isPolish ? 'ID artefaktu' : 'Artifact ID', width: '200px', render: (row: RoiFinanceLink) => <span className="text-sm text-c-text-muted font-mono">{row.financeArtifactId}</span> },
    { id: 'linkPurpose', label: isPolish ? 'Cel powiązania' : 'Link purpose', width: '160px', render: (row: RoiFinanceLink) => <span className="text-sm text-c-text-secondary">{row.linkPurpose}</span> },
    { id: 'asOf', label: isPolish ? 'Stan na' : 'As of', width: '130px', render: (row: RoiFinanceLink) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.asOf, isPolish)}</span> },
    { id: 'linkedBy', label: isPolish ? 'Powiązał' : 'Linked by', width: '150px', render: (row: RoiFinanceLink) => <span className="text-sm text-c-text-muted font-mono">{row.linkedBy}</span> },
  ];
}
export function buildRoiFinanceLinkRowMenu(row: RoiFinanceLink, caseStatus: RoiCaseStatus, isPolish: boolean, handlers: { onPreview: (r: RoiFinanceLink) => void; onRemove?: (r: RoiFinanceLink) => void }): StandardRowMenu {
  const lock = getRoiCaseLockInfo(caseStatus);
  const lockReason = lock ? (isPolish ? lock.reason.pl : lock.reason.en) : undefined;
  return {
    primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => handlers.onPreview(row) }],
    universalHandlers: { preview: () => handlers.onPreview(row) },
    destructive: lock || !handlers.onRemove ? { note: lockReason } : { onClick: () => handlers.onRemove!(row) },
  };
}
export function buildRoiFinanceLinkPreview(link: RoiFinanceLink, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  return {
    title: link.financeArtifactType,
    onClose,
    meta: {
      pills: [{ label: link.linkPurpose, tone: 'neutral' }],
      recommendation: isPolish
        ? 'Typ/ID/wersja artefaktu Finance to zwykły tekst — brak klucza obcego i sprawdzenia istnienia (decyzja D4). Powiązanie może wskazywać na nieistniejący rekord.'
        : 'Finance artifact type/ID/version are plain text — no foreign key or existence check (Decision D4). The link may point at a non-existent record.',
    },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'artifactId', label: isPolish ? 'ID artefaktu' : 'Artifact ID', value: link.financeArtifactId, mono: true },
        { id: 'versionId', label: isPolish ? 'ID wersji' : 'Version ID', value: link.financeVersionId, mono: true },
        { id: 'mappingVersion', label: isPolish ? 'Wersja mapowania' : 'Mapping version', value: String(link.mappingVersion) },
        { id: 'source', label: isPolish ? 'Źródło' : 'Source', value: link.source },
        { id: 'asOf', label: isPolish ? 'Stan na' : 'As of', value: formatRoiDate(link.asOf, isPolish) },
        { id: 'semanticUnit', label: isPolish ? 'Jednostka semantyczna' : 'Semantic unit', value: link.semanticUnit ?? '—' },
        { id: 'currency', label: isPolish ? 'Waluta' : 'Currency', value: link.currency ?? '—' },
        { id: 'linkedBy', label: isPolish ? 'Powiązał' : 'Linked by', value: link.linkedBy, mono: true },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Wkrótce'] : ['Coming soon'], isPolish),
    relations: [],
  };
}

// ==========================================================================
// Finance reconciliations
// ==========================================================================

export function buildRoiFinanceReconciliationColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'status', label: isPolish ? 'Status' : 'Status', width: '160px', render: (row: RoiFinanceReconciliation) => <StatusChip label={roiFinanceReconciliationStatusLabel(row.status, isPolish)} tone={ROI_FINANCE_RECONCILIATION_STATUS_TONE[row.status] === 'success' ? 'success' : ROI_FINANCE_RECONCILIATION_STATUS_TONE[row.status] === 'warning' ? 'warning' : 'neutral'} /> },
    { id: 'roiValue', label: isPolish ? 'Wartość ROI' : 'ROI value', width: '130px', align: 'right', render: (row: RoiFinanceReconciliation) => <HonestValueCell value={row.roiValue} format={(v) => formatRoiNumber(v, isPolish)} align="right" /> },
    { id: 'financeValue', label: isPolish ? 'Wartość Finance' : 'Finance value', width: '130px', align: 'right', render: (row: RoiFinanceReconciliation) => <HonestValueCell value={row.financeValue} format={(v) => formatRoiNumber(v, isPolish)} align="right" /> },
    { id: 'divergenceReason', label: isPolish ? 'Powód rozbieżności' : 'Divergence reason', width: '240px', render: (row: RoiFinanceReconciliation) => <span className="text-sm text-c-text-secondary">{row.divergenceReason ?? '—'}</span> },
    { id: 'openedAt', label: isPolish ? 'Otwarto' : 'Opened', width: '130px', render: (row: RoiFinanceReconciliation) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.openedAt, isPolish)}</span> },
  ];
}
export function buildRoiFinanceReconciliationRowMenu(row: RoiFinanceReconciliation, isPolish: boolean, handlers: { onPreview: (r: RoiFinanceReconciliation) => void; onEditStatus: (r: RoiFinanceReconciliation) => void }): StandardRowMenu {
  const resolved = row.status === 'resolved' || row.status === 'accepted_divergence';
  return {
    primary: [
      { id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => handlers.onPreview(row) },
      ...(resolved ? [] : [{ id: 'status', label: isPolish ? 'Zmień status' : 'Change status', onClick: () => handlers.onEditStatus(row) }]),
    ],
    universalHandlers: { preview: () => handlers.onPreview(row) },
  };
}
export function buildRoiFinanceReconciliationPreview(r: RoiFinanceReconciliation, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  return {
    title: isPolish ? 'Rekoncyliacja' : 'Reconciliation',
    onClose,
    meta: { pills: [{ label: roiFinanceReconciliationStatusLabel(r.status, isPolish), tone: r.status === 'resolved' ? 'success' : r.status === 'open' ? 'warning' : 'neutral' }] },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'financeLinkId', label: isPolish ? 'Powiązanie Finance' : 'Finance link', value: r.financeLinkId, mono: true },
        { id: 'roiValue', label: isPolish ? 'Wartość ROI' : 'ROI value', value: <HonestValueCell value={r.roiValue} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'financeValue', label: isPolish ? 'Wartość Finance' : 'Finance value', value: <HonestValueCell value={r.financeValue} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'divergenceReason', label: isPolish ? 'Powód rozbieżności' : 'Divergence reason', value: r.divergenceReason ?? '—' },
        { id: 'openedBy', label: isPolish ? 'Otworzył' : 'Opened by', value: r.openedBy, mono: true },
        { id: 'openedAt', label: isPolish ? 'Otwarto' : 'Opened at', value: formatRoiDate(r.openedAt, isPolish) },
        { id: 'resolvedBy', label: isPolish ? 'Rozwiązał' : 'Resolved by', value: r.resolvedBy ?? '—', mono: true },
        { id: 'resolvedAt', label: isPolish ? 'Rozwiązano' : 'Resolved at', value: r.resolvedAt ? formatRoiDate(r.resolvedAt, isPolish) : '—' },
        { id: 'resolutionNotes', label: isPolish ? 'Notatki rozwiązania' : 'Resolution notes', value: r.resolutionNotes ?? '—' },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Wkrótce'] : ['Coming soon'], isPolish),
    relations: [],
  };
}

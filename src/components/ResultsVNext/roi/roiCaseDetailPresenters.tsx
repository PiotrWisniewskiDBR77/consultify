/**
 * RN-G2 §G #12-14 — presentation builders (columns / row menu / preview) for
 * the ROI Case model-setup surfaces: Baseline + Calculation policy (§G #12,
 * rendered as a 2-row "settings" table — see `buildRoiSettingsColumns`
 * doc-comment for why a table, not a bespoke panel), Assumptions CRUD
 * (§G #13 first half), Cost lines + Benefit lines CRUD (§G #13 second half /
 * §G #14).
 *
 * PURE functions of their inputs, same convention as
 * `roiRegistryPresenters.tsx` — one implementation renders both the live
 * `RoiCaseModelWorkspace.tsx` and the dev-render QA harness.
 *
 * OQ-UI-D fix (RN_G2_OPEN_QUESTIONS_UI.md): every `details.properties` block
 * below passes `propertyLabel`/`valueLabel` explicitly — this package does
 * NOT repeat the omission the four earlier RN-G2 screens made.
 */
import React from 'react';

import type { StandardPreviewProps, StandardRowMenu, TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives';

import { HonestValueCell } from '../HonestValue';
import { LifecycleLockBadge } from '../LifecycleLockBadge';
import type {
  RoiAssumption,
  RoiBaseline,
  RoiBenefitLine,
  RoiCalculationPolicy,
  RoiCostLine,
} from './roiCaseDetailApi';
import {
  describeRoiLineTiming,
  roiBaselineProjectionMethodLabel,
  roiConfidenceLabel,
  roiRecurrenceCadenceLabel,
  roiRoundingPolicyLabel,
  roiTaxTreatmentLabel,
  roiTimingTypeLabel,
} from './roiCaseDetailMappers';
import { formatRoiCurrency, formatRoiDate, formatRoiNumber, getRoiCaseLockInfo } from './roiRegistryMappers';
import type { RoiCaseStatus } from './roiApi';

function propertyLabels(isPolish: boolean): { propertyLabel: string; valueLabel: string } {
  return {
    propertyLabel: isPolish ? 'Właściwość' : 'Property',
    valueLabel: isPolish ? 'Wartość' : 'Value',
  };
}

/** Block 4 (mandatory, TRIADA checklist item 28) — every existing RN-G2 ROI
 * preview (`roiRegistryPresenters.tsx` `buildRoiCasePreview`/
 * `buildRoiBenefitsRealizationPreview`) shows a disabled "Coming soon" AI
 * hint strip rather than omitting the block; this package's four new
 * previews match that, not a fifth bespoke variant. */
function aiComingSoon(hints: string[], isPolish: boolean) {
  return { hints, disabled: true, disabledTooltip: isPolish ? 'Wkrótce' : 'Coming soon' };
}

/** Shared "case is locked" header/meta chrome every one of the four
 * previews below attaches identically — one place, not four copies of the
 * same `LifecycleLockBadge`/pill wiring. */
function lockedPreviewChrome(caseStatus: RoiCaseStatus, isPolish: boolean) {
  const lock = getRoiCaseLockInfo(caseStatus);
  if (!lock) return { headerExtra: undefined, recommendation: undefined };
  return {
    headerExtra: (
      <LifecycleLockBadge
        label={isPolish ? lock.label.pl : lock.label.en}
        reason={isPolish ? lock.reason.pl : lock.reason.en}
      />
    ),
    recommendation: isPolish ? lock.reason.pl : lock.reason.en,
  };
}

// ==========================================
// Baseline + Calculation policy — a 2-ROW StandardTable, not a bespoke
// singleton panel. Rationale (CLAUDE.md UI law #1: "ekrany listowe
// WYŁĄCZNIE komponentami standard/"): both records are genuinely
// per-case-singleton, but the repo's Triada kanon does not have a sanctioned
// "single-record settings card" shell — only StandardTable/StandardPreview
// for lists. Modeling the two settings blocks as a 2-row table (row click →
// full StandardPreview properties table, kebab → Edit modal) reuses the
// EXACT same three standard components as every other RN-G2 surface instead
// of inventing a fourth, non-standard shell for exactly two records. This
// mirrors how a genuinely tiny collection (e.g. Materials' per-tab lists)
// still goes through StandardTable rather than a special case.
// ==========================================

export interface RoiSettingsRowVm {
  id: 'baseline' | 'calculation-policy';
  kind: 'baseline' | 'calculation-policy';
  baseline: RoiBaseline | null;
  policy: RoiCalculationPolicy | null;
}

export function buildRoiSettingsRows(
  baseline: RoiBaseline | null,
  policy: RoiCalculationPolicy | null
): RoiSettingsRowVm[] {
  return [
    { id: 'baseline', kind: 'baseline', baseline, policy: null },
    { id: 'calculation-policy', kind: 'calculation-policy', baseline: null, policy },
  ];
}

export function buildRoiSettingsColumns(isPolish: boolean): TableColumn[] {
  return [
    {
      id: 'label',
      label: isPolish ? 'Ustawienie' : 'Setting',
      width: '260px',
      render: (row: RoiSettingsRowVm) => (
        <span className="text-sm font-medium text-c-text">
          {row.kind === 'baseline'
            ? isPolish
              ? 'Baseline'
              : 'Baseline'
            : isPolish
              ? 'Polityka kalkulacji'
              : 'Calculation policy'}
        </span>
      ),
    },
    {
      id: 'summary',
      label: isPolish ? 'Podsumowanie' : 'Summary',
      width: '380px',
      render: (row: RoiSettingsRowVm) => {
        if (row.kind === 'baseline') {
          if (!row.baseline) {
            return <span className="text-sm text-c-text-muted">{isPolish ? 'Brak rekordu' : 'No record'}</span>;
          }
          return (
            <span className="text-sm text-c-text-secondary">
              {roiBaselineProjectionMethodLabel(row.baseline.bauProjectionMethod, isPolish)}
              {row.baseline.currentMeasuredValue !== null
                ? ` · ${formatRoiNumber(row.baseline.currentMeasuredValue, isPolish)}${row.baseline.currentMeasuredUnit ? ` ${row.baseline.currentMeasuredUnit}` : ''}`
                : ''}
            </span>
          );
        }
        if (!row.policy) {
          return <span className="text-sm text-c-text-muted">{isPolish ? 'Brak rekordu' : 'No record'}</span>;
        }
        return (
          <span className="text-sm text-c-text-secondary">
            {row.policy.discountRatePct !== null
              ? isPolish
                ? `Stopa dyskonta ${row.policy.discountRatePct}%`
                : `Discount rate ${row.policy.discountRatePct}%`
              : isPolish
                ? 'Brak stopy dyskonta'
                : 'No discount rate'}
            {' · '}
            {roiRoundingPolicyLabel(row.policy.roundingPolicy, isPolish)}
          </span>
        );
      },
    },
    {
      id: 'confidence',
      label: isPolish ? 'Pewność' : 'Confidence',
      width: '120px',
      render: (row: RoiSettingsRowVm) => (
        <span className="text-sm text-c-text-secondary">
          {roiConfidenceLabel(row.kind === 'baseline' ? (row.baseline?.confidence ?? null) : (row.policy?.confidence ?? null), isPolish)}
        </span>
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '130px',
      render: (row: RoiSettingsRowVm) => {
        const value = row.kind === 'baseline' ? row.baseline?.updatedAt : row.policy?.updatedAt;
        return <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(value ?? null, isPolish)}</span>;
      },
    },
  ];
}

export function buildRoiSettingsRowMenu(
  row: RoiSettingsRowVm,
  caseStatus: RoiCaseStatus,
  isPolish: boolean,
  handlers: { onEdit: (row: RoiSettingsRowVm) => void; onPreview: (row: RoiSettingsRowVm) => void }
): StandardRowMenu {
  const lock = getRoiCaseLockInfo(caseStatus);
  const lockReason = lock ? (isPolish ? lock.reason.pl : lock.reason.en) : undefined;
  const missing = row.kind === 'baseline' ? !row.baseline : !row.policy;
  const missingNote = isPolish ? 'Brak rekordu ustawień do edycji.' : 'No settings record to edit.';
  return {
    primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => handlers.onPreview(row) }],
    universalHandlers: {
      preview: () => handlers.onPreview(row),
      edit: lock || missing ? undefined : () => handlers.onEdit(row),
      editNote: lock ? lockReason : missing ? missingNote : undefined,
    },
  };
}

export function buildRoiSettingsPreview(
  row: RoiSettingsRowVm,
  caseStatus: RoiCaseStatus,
  isPolish: boolean,
  onClose: () => void
): StandardPreviewProps {
  const { headerExtra, recommendation } = lockedPreviewChrome(caseStatus, isPolish);
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);

  if (row.kind === 'baseline') {
    const b = row.baseline;
    return {
      title: isPolish ? 'Baseline' : 'Baseline',
      onClose,
      headerExtra,
      meta: {
        pills: [{ label: isPolish ? 'Ustawienie sprawy' : 'Case setting', tone: 'neutral' }],
        recommendation,
      },
      details: {
        showWordCount: false,
        propertyLabel,
        valueLabel,
        properties: b
          ? [
              { id: 'method', label: isPolish ? 'Metoda projekcji BAU' : 'BAU projection method', value: roiBaselineProjectionMethodLabel(b.bauProjectionMethod, isPolish) },
              { id: 'currentValue', label: isPolish ? 'Bieżąca wartość zmierzona' : 'Current measured value', value: <HonestValueCell value={b.currentMeasuredValue} format={(v) => `${formatRoiNumber(v, isPolish)}${b.currentMeasuredUnit ? ` ${b.currentMeasuredUnit}` : ''}`} /> },
              { id: 'asOf', label: isPolish ? 'Stan na dzień' : 'Measured as of', value: formatRoiDate(b.currentMeasuredAsOf, isPolish) },
              { id: 'periodStart', label: isPolish ? 'Początek okresu baseline' : 'Baseline period start', value: formatRoiDate(b.baselinePeriodStart, isPolish) },
              { id: 'periodEnd', label: isPolish ? 'Koniec okresu baseline' : 'Baseline period end', value: formatRoiDate(b.baselinePeriodEnd, isPolish) },
              { id: 'growthRate', label: isPolish ? 'Stopa wzrostu BAU' : 'BAU growth rate', value: <HonestValueCell value={b.bauGrowthRatePct} format={(v) => `${v}%`} /> },
              { id: 'referenceValue', label: isPolish ? 'Wartość referencyjna BAU' : 'BAU reference value', value: <HonestValueCell value={b.bauReferenceValue} format={(v) => formatRoiNumber(v, isPolish)} /> },
              { id: 'notes', label: isPolish ? 'Notatki porównawcze' : 'Comparison notes', value: b.interventionComparisonNotes ?? '—' },
              { id: 'source', label: isPolish ? 'Źródło' : 'Source', value: b.source ?? '—' },
              { id: 'confidence', label: isPolish ? 'Pewność' : 'Confidence', value: roiConfidenceLabel(b.confidence, isPolish) },
              { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: b.ownerUserId ?? '—', mono: true },
              { id: 'frozen', label: isPolish ? 'Zamrożone' : 'Frozen', value: b.frozenAt ? formatRoiDate(b.frozenAt, isPolish) : (isPolish ? 'Nie' : 'No') },
            ]
          : [{ id: 'missing', label: isPolish ? 'Rekord' : 'Record', value: isPolish ? 'Brak rekordu baseline dla tej sprawy.' : 'No baseline record for this case.' }],
      },
      ai: aiComingSoon(isPolish ? ['Podsumuj baseline'] : ['Summarize baseline'], isPolish),
      relations: [],
    };
  }

  const p = row.policy;
  return {
    title: isPolish ? 'Polityka kalkulacji' : 'Calculation policy',
    onClose,
    headerExtra,
    meta: {
      pills: [{ label: isPolish ? 'Ustawienie sprawy' : 'Case setting', tone: 'neutral' }],
      recommendation,
    },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: p
        ? [
            { id: 'discountRate', label: isPolish ? 'Stopa dyskonta' : 'Discount rate', value: <HonestValueCell value={p.discountRatePct} format={(v) => `${v}%`} /> },
            { id: 'taxTreatment', label: isPolish ? 'Traktowanie podatkowe' : 'Tax treatment', value: roiTaxTreatmentLabel(p.taxTreatment, isPolish) },
            { id: 'inflationRate', label: isPolish ? 'Stopa inflacji' : 'Inflation rate', value: <HonestValueCell value={p.inflationRatePct} format={(v) => `${v}%`} /> },
            { id: 'roundingPolicy', label: isPolish ? 'Polityka zaokrągleń' : 'Rounding policy', value: roiRoundingPolicyLabel(p.roundingPolicy, isPolish) },
            { id: 'requiredMetrics', label: isPolish ? 'Wymagane metryki' : 'Required metrics', value: p.requiredMetrics && p.requiredMetrics.length > 0 ? p.requiredMetrics.join(', ') : '—' },
            { id: 'notes', label: isPolish ? 'Notatki' : 'Notes', value: p.notes ?? '—' },
            { id: 'confidence', label: isPolish ? 'Pewność' : 'Confidence', value: roiConfidenceLabel(p.confidence, isPolish) },
            { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: p.ownerUserId ?? '—', mono: true },
            { id: 'frozen', label: isPolish ? 'Zamrożone' : 'Frozen', value: p.frozenAt ? formatRoiDate(p.frozenAt, isPolish) : (isPolish ? 'Nie' : 'No') },
          ]
        : [{ id: 'missing', label: isPolish ? 'Rekord' : 'Record', value: isPolish ? 'Brak rekordu polityki kalkulacji dla tej sprawy.' : 'No calculation policy record for this case.' }],
    },
    ai: aiComingSoon(isPolish ? ['Podsumuj politykę'] : ['Summarize policy'], isPolish),
    relations: [],
  };
}

// ==========================================
// Assumptions
// ==========================================

export function buildRoiAssumptionColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'category', label: isPolish ? 'Kategoria' : 'Category', width: '160px', filterable: true, render: (row: RoiAssumption) => <span className="text-sm text-c-text-secondary">{row.category}</span> },
    { id: 'label', label: isPolish ? 'Założenie' : 'Assumption', width: '260px', sortable: true, render: (row: RoiAssumption) => <span className="text-sm font-medium text-c-text">{row.label}</span> },
    {
      id: 'baseValue',
      label: isPolish ? 'Wartość bazowa' : 'Base value',
      width: '140px',
      align: 'right',
      render: (row: RoiAssumption) => (
        <HonestValueCell value={row.baseValue} align="right" format={(v) => <span className="tabular-nums">{formatRoiNumber(v, isPolish)}{row.unit ? ` ${row.unit}` : ''}</span>} />
      ),
    },
    {
      id: 'downsideValue',
      label: isPolish ? 'Pesymistyczna' : 'Downside',
      width: '130px',
      align: 'right',
      render: (row: RoiAssumption) => <HonestValueCell value={row.downsideValue} align="right" format={(v) => <span className="tabular-nums">{formatRoiNumber(v, isPolish)}</span>} />,
    },
    {
      id: 'upsideValue',
      label: isPolish ? 'Optymistyczna' : 'Upside',
      width: '130px',
      align: 'right',
      render: (row: RoiAssumption) => <HonestValueCell value={row.upsideValue} align="right" format={(v) => <span className="tabular-nums">{formatRoiNumber(v, isPolish)}</span>} />,
    },
    { id: 'confidence', label: isPolish ? 'Pewność' : 'Confidence', width: '110px', render: (row: RoiAssumption) => <span className="text-sm text-c-text-secondary">{roiConfidenceLabel(row.confidence, isPolish)}</span> },
    { id: 'updatedAt', label: isPolish ? 'Zaktualizowano' : 'Updated', width: '130px', sortable: true, render: (row: RoiAssumption) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.updatedAt, isPolish)}</span> },
  ];
}

export function buildRoiAssumptionPreview(row: RoiAssumption, caseStatus: RoiCaseStatus, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { headerExtra, recommendation } = lockedPreviewChrome(caseStatus, isPolish);
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  return {
    title: row.label,
    onClose,
    headerExtra,
    meta: { pills: [{ label: row.category, tone: 'neutral' }], recommendation },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'base', label: isPolish ? 'Wartość bazowa' : 'Base value', value: <HonestValueCell value={row.baseValue} format={(v) => `${formatRoiNumber(v, isPolish)}${row.unit ? ` ${row.unit}` : ''}`} /> },
        { id: 'downside', label: isPolish ? 'Pesymistyczna' : 'Downside', value: <HonestValueCell value={row.downsideValue} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'upside', label: isPolish ? 'Optymistyczna' : 'Upside', value: <HonestValueCell value={row.upsideValue} format={(v) => formatRoiNumber(v, isPolish)} /> },
        { id: 'sensitivity', label: isPolish ? 'Ranga wrażliwości' : 'Sensitivity rank', value: row.sensitivityRank ?? '—' },
        { id: 'confidence', label: isPolish ? 'Pewność' : 'Confidence', value: roiConfidenceLabel(row.confidence, isPolish) },
        { id: 'evidence', label: isPolish ? 'Dowód' : 'Evidence ref', value: row.evidenceRef ?? '—' },
        { id: 'source', label: isPolish ? 'Źródło' : 'Source', value: row.source ?? '—' },
        { id: 'notes', label: isPolish ? 'Notatki' : 'Notes', value: row.notes ?? '—' },
        { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: row.ownerUserId ?? '—', mono: true },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Podsumuj założenie'] : ['Summarize assumption'], isPolish),
    relations: [],
  };
}

// ==========================================
// Cost lines
// ==========================================

export function buildRoiCostLineColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'category', label: isPolish ? 'Kategoria' : 'Category', width: '160px', filterable: true, render: (row: RoiCostLine) => <span className="text-sm text-c-text-secondary">{row.category}</span> },
    { id: 'label', label: isPolish ? 'Pozycja kosztowa' : 'Cost line', width: '260px', sortable: true, render: (row: RoiCostLine) => <span className="text-sm font-medium text-c-text">{row.label}</span> },
    {
      id: 'amount',
      label: isPolish ? 'Kwota' : 'Amount',
      width: '150px',
      align: 'right',
      sortable: true,
      render: (row: RoiCostLine) => <span className="tabular-nums text-sm text-c-text">{formatRoiCurrency(row.amount, row.currency, isPolish)}</span>,
    },
    {
      id: 'timing',
      label: isPolish ? 'Harmonogram' : 'Timing',
      width: '220px',
      render: (row: RoiCostLine) => <span className="text-sm text-c-text-secondary">{describeRoiLineTiming(row, isPolish, formatRoiDate)}</span>,
    },
    { id: 'confidence', label: isPolish ? 'Pewność' : 'Confidence', width: '110px', render: (row: RoiCostLine) => <span className="text-sm text-c-text-secondary">{roiConfidenceLabel(row.confidence, isPolish)}</span> },
    { id: 'updatedAt', label: isPolish ? 'Zaktualizowano' : 'Updated', width: '130px', sortable: true, render: (row: RoiCostLine) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.updatedAt, isPolish)}</span> },
  ];
}

export function buildRoiCostLinePreview(row: RoiCostLine, caseStatus: RoiCaseStatus, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { headerExtra, recommendation } = lockedPreviewChrome(caseStatus, isPolish);
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  return {
    title: row.label,
    onClose,
    headerExtra,
    meta: { pills: [{ label: row.category, tone: 'neutral' }, { label: formatRoiCurrency(row.amount, row.currency, isPolish), tone: 'info' }], recommendation },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'description', label: isPolish ? 'Opis' : 'Description', value: row.description ?? '—' },
        { id: 'timing', label: isPolish ? 'Harmonogram' : 'Timing', value: describeRoiLineTiming(row, isPolish, formatRoiDate) },
        { id: 'recurrenceStart', label: isPolish ? 'Początek cykliczności' : 'Recurrence start', value: formatRoiDate(row.recurrenceStartDate, isPolish) },
        { id: 'recurrenceEnd', label: isPolish ? 'Koniec cykliczności' : 'Recurrence end', value: formatRoiDate(row.recurrenceEndDate, isPolish) },
        { id: 'confidence', label: isPolish ? 'Pewność' : 'Confidence', value: roiConfidenceLabel(row.confidence, isPolish) },
        { id: 'source', label: isPolish ? 'Źródło' : 'Source', value: row.source ?? '—' },
        { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: row.ownerUserId ?? '—', mono: true },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Podsumuj koszt'] : ['Summarize cost line'], isPolish),
    relations: [],
  };
}

// ==========================================
// Benefit lines
// ==========================================

export function buildRoiBenefitLineColumns(isPolish: boolean): TableColumn[] {
  return [
    { id: 'category', label: isPolish ? 'Kategoria' : 'Category', width: '150px', filterable: true, render: (row: RoiBenefitLine) => <span className="text-sm text-c-text-secondary">{row.category}</span> },
    { id: 'label', label: isPolish ? 'Pozycja korzyści' : 'Benefit line', width: '240px', sortable: true, render: (row: RoiBenefitLine) => <span className="text-sm font-medium text-c-text">{row.label}</span> },
    {
      id: 'isFinancial',
      label: isPolish ? 'Finansowa' : 'Financial',
      width: '100px',
      render: (row: RoiBenefitLine) => (
        <StatusChip label={row.isFinancial ? (isPolish ? 'Tak' : 'Yes') : (isPolish ? 'Nie' : 'No')} tone={row.isFinancial ? 'success' : 'neutral'} />
      ),
    },
    {
      id: 'amount',
      label: isPolish ? 'Kwota' : 'Amount',
      width: '150px',
      align: 'right',
      sortable: true,
      render: (row: RoiBenefitLine) => (
        <HonestValueCell
          value={row.amount}
          align="right"
          format={(v) => <span className="tabular-nums">{formatRoiCurrency(v, row.currency ?? 'USD', isPolish)}</span>}
        />
      ),
    },
    {
      id: 'timing',
      label: isPolish ? 'Harmonogram' : 'Timing',
      width: '200px',
      render: (row: RoiBenefitLine) => <span className="text-sm text-c-text-secondary">{describeRoiLineTiming(row, isPolish, formatRoiDate)}</span>,
    },
    { id: 'updatedAt', label: isPolish ? 'Zaktualizowano' : 'Updated', width: '130px', sortable: true, render: (row: RoiBenefitLine) => <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.updatedAt, isPolish)}</span> },
  ];
}

export function buildRoiBenefitLinePreview(row: RoiBenefitLine, caseStatus: RoiCaseStatus, isPolish: boolean, onClose: () => void): StandardPreviewProps {
  const { headerExtra, recommendation } = lockedPreviewChrome(caseStatus, isPolish);
  const { propertyLabel, valueLabel } = propertyLabels(isPolish);
  return {
    title: row.label,
    onClose,
    headerExtra,
    meta: {
      pills: [
        { label: row.category, tone: 'neutral' },
        { label: row.isFinancial ? (isPolish ? 'Finansowa' : 'Financial') : (isPolish ? 'Niefinansowa' : 'Non-financial'), tone: row.isFinancial ? 'success' : 'neutral' },
      ],
      recommendation,
    },
    details: {
      showWordCount: false,
      propertyLabel,
      valueLabel,
      properties: [
        { id: 'description', label: isPolish ? 'Opis' : 'Description', value: row.description ?? '—' },
        { id: 'amount', label: isPolish ? 'Kwota' : 'Amount', value: <HonestValueCell value={row.amount} format={(v) => formatRoiCurrency(v, row.currency ?? 'USD', isPolish)} /> },
        { id: 'timing', label: isPolish ? 'Harmonogram' : 'Timing', value: describeRoiLineTiming(row, isPolish, formatRoiDate) },
        { id: 'ramp', label: isPolish ? 'Okresy narastania' : 'Ramp periods', value: row.rampPeriods ?? '—' },
        { id: 'doubleCounting', label: isPolish ? 'Grupa podwójnego liczenia' : 'Double-counting group', value: row.doubleCountingGroup ?? '—' },
        { id: 'doubleCountingNote', label: isPolish ? 'Rozstrzygnięcie podwójnego liczenia' : 'Double-counting resolution', value: row.doubleCountingResolutionNote ?? '—' },
        { id: 'confidence', label: isPolish ? 'Pewność' : 'Confidence', value: roiConfidenceLabel(row.confidence, isPolish) },
        { id: 'source', label: isPolish ? 'Źródło' : 'Source', value: row.source ?? '—' },
        { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: row.ownerUserId ?? '—', mono: true },
      ],
    },
    ai: aiComingSoon(isPolish ? ['Podsumuj korzyść'] : ['Summarize benefit line'], isPolish),
    relations: [],
  };
}

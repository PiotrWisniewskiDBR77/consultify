/**
 * RN-G5 §G #11 — ROI org PIR-outcomes perspective (`GET
 * /api/vnext/results/roi/org/pir-outcomes`) columns/preview builders.
 * PURE functions of their inputs, same convention as
 * `roiRegistryPresenters.tsx`'s `buildRoiBenefitsRealizationColumns`/
 * `buildRoiBenefitsRealizationPreview` — this file is a direct sibling of
 * that pair, copying its pattern field-for-field (task brief: "Pierwsza
 * zakładka działa i jest wzorcem — powiel jej sposób, nie wymyślaj nowego").
 */
import React from 'react';

import type { StandardPreviewProps, TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives';

import { HonestValueCell } from '../HonestValue';
import { formatRoiPercent, ROI_STATUS_TONE, roiStatusLabel } from './roiRegistryMappers';
import type { RoiOrgPirOutcomeCaseRow, RoiPirOutcome } from './roiApi';

const PIR_OUTCOME_LABEL: Record<RoiPirOutcome, { pl: string; en: string }> = {
  benefits_fully_realized: { pl: 'W pełni zrealizowane', en: 'Fully realized' },
  benefits_partially_realized: { pl: 'Częściowo zrealizowane', en: 'Partially realized' },
  benefits_not_realized: { pl: 'Niezrealizowane', en: 'Not realized' },
};

export function roiPirOutcomeLabel(outcome: RoiPirOutcome, isPolish: boolean): string {
  return isPolish ? PIR_OUTCOME_LABEL[outcome].pl : PIR_OUTCOME_LABEL[outcome].en;
}

const PIR_OUTCOME_TONE: Record<RoiPirOutcome, 'success' | 'warning' | 'danger'> = {
  benefits_fully_realized: 'success',
  benefits_partially_realized: 'warning',
  benefits_not_realized: 'danger',
};

function formatRoiDateShort(iso: string | null, isPolish: boolean): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function buildRoiPirOutcomesColumns(isPolish: boolean): TableColumn[] {
  return [
    {
      id: 'title',
      label: isPolish ? 'Sprawa' : 'Case',
      width: '280px',
      render: (row: RoiOrgPirOutcomeCaseRow) => <span className="text-sm font-medium text-c-text">{row.title}</span>,
    },
    {
      id: 'status',
      label: 'Status',
      width: '170px',
      render: (row: RoiOrgPirOutcomeCaseRow) => (
        <StatusChip label={roiStatusLabel(row.status, isPolish)} tone={ROI_STATUS_TONE[row.status]} />
      ),
    },
    {
      id: 'pirOutcome',
      label: isPolish ? 'Wynik PIR' : 'PIR outcome',
      width: '190px',
      render: (row: RoiOrgPirOutcomeCaseRow) =>
        row.pirOutcome ? (
          <StatusChip label={roiPirOutcomeLabel(row.pirOutcome, isPolish)} tone={PIR_OUTCOME_TONE[row.pirOutcome]} />
        ) : (
          <span className="text-sm text-c-text-muted">
            {isPolish ? 'W trakcie przeglądu' : 'Review in progress'}
          </span>
        ),
    },
    {
      id: 'realizationPct',
      label: isPolish ? 'Realizacja' : 'Realization',
      width: '120px',
      align: 'right',
      render: (row: RoiOrgPirOutcomeCaseRow) => (
        <HonestValueCell
          value={row.benefitsRealizationPct}
          align="right"
          notCalculableReason={
            isPolish
              ? 'Brak korzyści zaakceptowanych (mianownik = 0) lub brak jeszcze rzeczywistej wartości.'
              : 'No approved benefits (zero denominator) or no actual value recorded yet.'
          }
          format={(v) => (
            <span className="tabular-nums font-medium text-sm text-c-text">{formatRoiPercent(v, isPolish)}</span>
          )}
        />
      ),
    },
    {
      id: 'finalizedAt',
      label: isPolish ? 'Sfinalizowano' : 'Finalized',
      width: '150px',
      render: (row: RoiOrgPirOutcomeCaseRow) => (
        <span className="text-sm text-c-text-muted">{formatRoiDateShort(row.finalizedAt, isPolish)}</span>
      ),
    },
  ];
}

export function buildRoiPirOutcomesPreview(
  row: RoiOrgPirOutcomeCaseRow,
  isPolish: boolean,
  onClose: () => void
): StandardPreviewProps {
  return {
    title: row.title,
    onClose,
    meta: {
      pills: [
        { label: roiStatusLabel(row.status, isPolish), tone: ROI_STATUS_TONE[row.status] },
        { label: isPolish ? 'Perspektywa organizacji — PIR' : 'Org perspective — PIR', tone: 'neutral' },
      ],
      recommendation: isPolish
        ? 'Zakres z perspektywy managera (łańcuch zarządzania) — sprawy w przeglądzie po inwestycji lub zamknięte.'
        : "Scoped to the manager's chain — cases in post-investment review or closed.",
    },
    details: {
      showWordCount: false,
      properties: [
        { id: 'initiative', label: isPolish ? 'Inicjatywa' : 'Initiative', value: row.initiativeId, mono: true },
        {
          id: 'pirOutcome',
          label: isPolish ? 'Wynik PIR' : 'PIR outcome',
          value: row.pirOutcome
            ? roiPirOutcomeLabel(row.pirOutcome, isPolish)
            : isPolish
              ? 'W trakcie przeglądu (jeszcze nie sfinalizowano)'
              : 'Review in progress (not finalized yet)',
        },
        {
          id: 'pct',
          label: isPolish ? 'Realizacja' : 'Realization',
          value: (
            <HonestValueCell
              value={row.benefitsRealizationPct}
              notCalculableReason={
                isPolish
                  ? 'Brak korzyści zaakceptowanych (mianownik = 0) lub brak jeszcze rzeczywistej wartości.'
                  : 'No approved benefits (zero denominator) or no actual value recorded yet.'
              }
              format={(v) => formatRoiPercent(v, isPolish)}
            />
          ),
        },
        {
          id: 'finalizedAt',
          label: isPolish ? 'Sfinalizowano' : 'Finalized',
          value: formatRoiDateShort(row.finalizedAt, isPolish),
        },
      ],
    },
    ai: {
      hints: isPolish ? ['Podsumuj wynik PIR'] : ['Summarize PIR outcome'],
      disabled: true,
      disabledTooltip: isPolish ? 'Wkrótce' : 'Coming soon',
    },
    relations: [],
  };
}

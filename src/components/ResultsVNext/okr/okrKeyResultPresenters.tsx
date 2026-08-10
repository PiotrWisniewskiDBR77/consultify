/**
 * RN-G2 §G #25 — Key Result table columns / row menu / preview builders.
 * PURE functions, mirrors `okrObjectivePresenters.tsx` one level down.
 */
import React from 'react';
import { Lock } from 'lucide-react';

import type { StandardPreviewProps, StandardRowMenu, TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives';

import { HonestValueCell } from '../HonestValue';
import { LifecycleLockBadge } from '../LifecycleLockBadge';
import type { OkrKeyResultDto } from './okrObjectiveApi';
import {
  canCancelKeyResultStatus,
  formatOkrDate,
  formatOkrNumeric,
  formatOkrProgressPercent,
  getOkrSetChildEditLock,
  OKR_KEY_RESULT_STATUS_TONE,
  okrKeyResultConfidenceLabel,
  okrKeyResultDirectionLabel,
  okrKeyResultMeasurementTypeLabel,
  okrKeyResultSourceTypeLabel,
  okrKeyResultStatusLabel,
  parseOkrKeyResultProgress,
  parseOkrNumericField,
  shortOkrId,
} from './okrObjectiveMappers';

// ==========================================
// Table columns
// ==========================================

export function buildOkrKeyResultColumns(isPolish: boolean, parentSetStatus: string): TableColumn[] {
  const childLock = getOkrSetChildEditLock(parentSetStatus);
  return [
    {
      id: 'title',
      label: isPolish ? 'Kluczowy Rezultat' : 'Key Result',
      width: '260px',
      sortable: true,
      render: (row: OkrKeyResultDto) => <span className="text-sm font-medium text-c-text">{row.title}</span>,
    },
    {
      id: 'status',
      label: 'Status',
      width: '170px',
      filterable: true,
      filterOptions: (Object.keys(OKR_KEY_RESULT_STATUS_TONE) as OkrKeyResultDto['status'][]).map((s) => ({
        value: s,
        label: okrKeyResultStatusLabel(s, isPolish),
      })),
      render: (row: OkrKeyResultDto) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip label={okrKeyResultStatusLabel(row.status, isPolish)} tone={OKR_KEY_RESULT_STATUS_TONE[row.status]} />
          {childLock ? (
            <span className="inline-flex shrink-0" title={isPolish ? childLock.reason.pl : childLock.reason.en}>
              <Lock size={13} className="shrink-0 text-c-text-muted" aria-label={isPolish ? childLock.label.pl : childLock.label.en} />
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'direction',
      label: isPolish ? 'Geometria' : 'Geometry',
      width: '150px',
      render: (row: OkrKeyResultDto) => (
        <span className="text-sm text-c-text-secondary">{okrKeyResultDirectionLabel(row.direction, isPolish)}</span>
      ),
    },
    {
      id: 'currentValue',
      label: isPolish ? 'Wartość bieżąca' : 'Current value',
      width: '140px',
      align: 'right',
      render: (row: OkrKeyResultDto) => (
        <HonestValueCell
          value={parseOkrNumericField(row.currentValue)}
          align="right"
          format={(v) => <span className="tabular-nums text-sm text-c-text">{formatOkrNumeric(v, isPolish, row.unit)}</span>}
        />
      ),
    },
    {
      id: 'targetValue',
      label: isPolish ? 'Wartość docelowa' : 'Target value',
      width: '140px',
      align: 'right',
      render: (row: OkrKeyResultDto) => (
        <HonestValueCell
          value={parseOkrNumericField(row.targetValue)}
          align="right"
          format={(v) => <span className="tabular-nums text-sm text-c-text-secondary">{formatOkrNumeric(v, isPolish, row.unit)}</span>}
        />
      ),
    },
    {
      id: 'progress',
      label: isPolish ? 'Postęp' : 'Progress',
      width: '110px',
      align: 'right',
      render: (row: OkrKeyResultDto) => (
        <HonestValueCell
          value={parseOkrKeyResultProgress(row.progress, row.progressCalcReason)}
          align="right"
          notCalculableReason={row.progressCalcReason ?? undefined}
          format={(v) => <span className="tabular-nums text-sm text-c-text">{formatOkrProgressPercent(v, isPolish)}</span>}
        />
      ),
    },
    {
      id: 'confidence',
      label: isPolish ? 'Pewność' : 'Confidence',
      width: '120px',
      render: (row: OkrKeyResultDto) =>
        row.confidence ? (
          <StatusChip label={okrKeyResultConfidenceLabel(row.confidence, isPolish)} tone="neutral" />
        ) : (
          <span className="text-c-text-muted text-sm">—</span>
        ),
    },
    {
      id: 'owner',
      label: isPolish ? 'Właściciel' : 'Owner',
      width: '140px',
      render: (row: OkrKeyResultDto) => (
        <span className="block truncate text-sm text-c-text-secondary font-mono" title={row.ownerUserId}>
          {shortOkrId(row.ownerUserId)}
        </span>
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '130px',
      sortable: true,
      render: (row: OkrKeyResultDto) => (
        <span className="text-sm text-c-text-muted tabular-nums">{formatOkrDate(row.updatedAt, isPolish)}</span>
      ),
    },
  ];
}

// ==========================================
// Row menu
// ==========================================

export interface OkrKeyResultRowMenuHandlers {
  onPreview: (row: OkrKeyResultDto) => void;
  onOpenCheckIns: (row: OkrKeyResultDto) => void;
  onEdit: (row: OkrKeyResultDto) => void;
  onCancel: (row: OkrKeyResultDto) => void;
}

export function buildOkrKeyResultRowMenu(
  row: OkrKeyResultDto,
  isPolish: boolean,
  parentSetStatus: string,
  handlers: OkrKeyResultRowMenuHandlers
): StandardRowMenu {
  const childLock = getOkrSetChildEditLock(parentSetStatus);
  const childLockReason = childLock ? (isPolish ? childLock.reason.pl : childLock.reason.en) : undefined;
  const cancelEligible = canCancelKeyResultStatus(row.status);
  const cancelBlockedReason = childLock
    ? childLockReason
    : !cancelEligible
      ? isPolish
        ? `Nie można anulować Kluczowego Rezultatu w statusie "${okrKeyResultStatusLabel(row.status, isPolish)}".`
        : `Cannot cancel a key result in status "${okrKeyResultStatusLabel(row.status, isPolish)}".`
      : undefined;

  return {
    primary: [
      { id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => handlers.onPreview(row) },
      { id: 'open-check-ins', label: isPolish ? 'Check-iny' : 'Check-ins', onClick: () => handlers.onOpenCheckIns(row) },
    ],
    universalHandlers: {
      preview: () => handlers.onPreview(row),
      edit: childLock ? undefined : () => handlers.onEdit(row),
      editNote: childLockReason,
    },
    destructive: cancelBlockedReason
      ? { label: isPolish ? 'Anuluj KR' : 'Cancel KR', note: cancelBlockedReason }
      : { label: isPolish ? 'Anuluj KR' : 'Cancel KR', onClick: () => handlers.onCancel(row) },
  };
}

// ==========================================
// Preview
// ==========================================

export interface OkrKeyResultPreviewDeps {
  isPolish: boolean;
  parentSetStatus: string;
  onClose: () => void;
  onOpenCheckIns: (row: OkrKeyResultDto) => void;
  onEdit: (row: OkrKeyResultDto) => void;
  onCancel: (row: OkrKeyResultDto) => void;
}

export function buildOkrKeyResultPreview(row: OkrKeyResultDto, deps: OkrKeyResultPreviewDeps): StandardPreviewProps {
  const { isPolish, parentSetStatus, onClose, onOpenCheckIns, onEdit, onCancel } = deps;
  const childLock = getOkrSetChildEditLock(parentSetStatus);
  const progress = parseOkrKeyResultProgress(row.progress, row.progressCalcReason);
  const cancelEligible = canCancelKeyResultStatus(row.status);
  const outOfRangeDistance = parseOkrNumericField(row.outOfRangeDistance);

  const properties = [
    { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: row.ownerUserId, mono: true },
    { id: 'description', label: isPolish ? 'Opis' : 'Description', value: row.description ?? '—' },
    { id: 'measurementType', label: isPolish ? 'Typ pomiaru' : 'Measurement type', value: okrKeyResultMeasurementTypeLabel(row.measurementType, isPolish) },
    { id: 'direction', label: isPolish ? 'Geometria' : 'Geometry', value: okrKeyResultDirectionLabel(row.direction, isPolish) },
    {
      id: 'baselineValue',
      label: isPolish ? 'Wartość bazowa' : 'Baseline value',
      value: (
        <HonestValueCell
          value={parseOkrNumericField(row.baselineValue)}
          format={(v) => formatOkrNumeric(v, isPolish, row.unit)}
        />
      ),
    },
    {
      id: 'startValue',
      label: isPolish ? 'Wartość startowa' : 'Start value',
      value: <HonestValueCell value={parseOkrNumericField(row.startValue)} format={(v) => formatOkrNumeric(v, isPolish, row.unit)} />,
    },
    {
      id: 'currentValue',
      label: isPolish ? 'Wartość bieżąca' : 'Current value',
      value: <HonestValueCell value={parseOkrNumericField(row.currentValue)} format={(v) => formatOkrNumeric(v, isPolish, row.unit)} />,
    },
    {
      id: 'targetValue',
      label: isPolish ? 'Wartość docelowa' : 'Target value',
      value: <HonestValueCell value={parseOkrNumericField(row.targetValue)} format={(v) => formatOkrNumeric(v, isPolish, row.unit)} />,
    },
  ];

  if (row.direction === 'maintain_range') {
    properties.push(
      {
        id: 'rangeMin',
        label: isPolish ? 'Zakres — min' : 'Range — min',
        value: <HonestValueCell value={parseOkrNumericField(row.rangeMin)} format={(v) => formatOkrNumeric(v, isPolish, row.unit)} />,
      },
      {
        id: 'rangeMax',
        label: isPolish ? 'Zakres — max' : 'Range — max',
        value: <HonestValueCell value={parseOkrNumericField(row.rangeMax)} format={(v) => formatOkrNumeric(v, isPolish, row.unit)} />,
      },
      {
        id: 'outOfRangeDistance',
        label: isPolish ? 'Odległość poza zakresem' : 'Out-of-range distance',
        // `0` here is a REAL calculated value ("in-range" — okrProgressEngine.ts
        // L156-160), never treated as a missing value.
        value: <HonestValueCell value={outOfRangeDistance} format={(v) => formatOkrNumeric(v, isPolish, row.unit)} />,
      }
    );
  }

  properties.push(
    {
      id: 'progress',
      label: isPolish ? 'Postęp' : 'Progress',
      value: (
        <HonestValueCell
          value={progress}
          notCalculableReason={row.progressCalcReason ?? undefined}
          format={(v) => formatOkrProgressPercent(v, isPolish)}
        />
      ),
    },
    {
      id: 'confidence',
      label: isPolish ? 'Pewność' : 'Confidence',
      value: row.confidence ? okrKeyResultConfidenceLabel(row.confidence, isPolish) : '—',
    },
    { id: 'weight', label: isPolish ? 'Waga' : 'Weight', value: <HonestValueCell value={parseOkrNumericField(row.weight)} format={(v) => formatOkrNumeric(v, isPolish)} /> },
    { id: 'sourceType', label: isPolish ? 'Źródło' : 'Source', value: okrKeyResultSourceTypeLabel(row.sourceType, isPolish) },
    { id: 'sourceReference', label: isPolish ? 'Odniesienie źródła' : 'Source reference', value: row.sourceReference ?? '—' },
    { id: 'createdAt', label: isPolish ? 'Utworzono' : 'Created', value: formatOkrDate(row.createdAt, isPolish) },
    { id: 'updatedAt', label: isPolish ? 'Zaktualizowano' : 'Updated', value: formatOkrDate(row.updatedAt, isPolish) }
  );

  return {
    title: row.title,
    onClose,
    headerExtra: childLock ? (
      <LifecycleLockBadge label={isPolish ? childLock.label.pl : childLock.label.en} reason={isPolish ? childLock.reason.pl : childLock.reason.en} />
    ) : undefined,
    meta: {
      pills: [
        { label: okrKeyResultStatusLabel(row.status, isPolish), tone: OKR_KEY_RESULT_STATUS_TONE[row.status] },
        { label: okrKeyResultMeasurementTypeLabel(row.measurementType, isPolish), tone: 'neutral' },
      ],
      recommendation: childLock
        ? isPolish
          ? childLock.reason.pl
          : childLock.reason.en
        : isPolish
          ? 'Podgląd Kluczowego Rezultatu — kliknij „Check-iny", aby zobaczyć historię pomiarów.'
          : 'Key Result preview — click "Check-ins" to see the measurement history.',
    },
    details: {
      showWordCount: false,
      propertyLabel: isPolish ? 'Właściwość' : 'Property',
      valueLabel: isPolish ? 'Wartość' : 'Value',
      properties,
    },
    ai: { hints: [], disabled: true, disabledTooltip: isPolish ? 'Wkrótce' : 'Coming soon' },
    relations: [],
    actions: {
      informational: [
        { id: 'open-check-ins', variant: 'neutral', label: isPolish ? 'Check-iny' : 'Check-ins', onClick: () => onOpenCheckIns(row) },
        childLock
          ? { id: 'edit', variant: 'neutral', label: isPolish ? 'Edytuj' : 'Edit', onClick: () => {}, disabled: true }
          : { id: 'edit', variant: 'neutral', label: isPolish ? 'Edytuj' : 'Edit', onClick: () => onEdit(row) },
        {
          id: 'cancel',
          variant: 'destructive',
          label: isPolish ? 'Anuluj' : 'Cancel',
          onClick: () => onCancel(row),
          disabled: !!childLock || !cancelEligible,
        },
      ],
    },
  };
}

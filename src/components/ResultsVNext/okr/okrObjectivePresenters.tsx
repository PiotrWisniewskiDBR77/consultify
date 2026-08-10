/**
 * RN-G2 §G #25 — Objective table columns / row menu / preview builders for
 * `StandardTable`/`StandardPreview`. PURE functions of their inputs (no
 * fetching, no state) — same discipline as `okrRegistryPresenters.tsx`, so
 * the identical code renders both the live `OkrObjectivesView.tsx` and the
 * dev-render QA harness.
 */
import React from 'react';
import { Lock } from 'lucide-react';

import type { StandardPreviewProps, StandardRowMenu, TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives';

import { HonestValueCell } from '../HonestValue';
import { LifecycleLockBadge } from '../LifecycleLockBadge';
import type { OkrObjectiveWithKeyResultsDto } from './okrObjectiveApi';
import {
  canCancelObjectiveStatus,
  formatOkrDate,
  formatOkrProgressPercent,
  getOkrSetChildEditLock,
  OKR_OBJECTIVE_STATUS_TONE,
  okrObjectiveAmbitionLabel,
  okrObjectiveConfidenceLabel,
  okrObjectiveStatusLabel,
  parseOkrObjectiveConfidence,
  parseOkrObjectiveProgress,
  shortOkrId,
} from './okrObjectiveMappers';

// ==========================================
// Table columns
// ==========================================

export function buildOkrObjectiveColumns(isPolish: boolean, parentSetStatus: string): TableColumn[] {
  const childLock = getOkrSetChildEditLock(parentSetStatus);
  return [
    {
      id: 'title',
      label: isPolish ? 'Cel (Objective)' : 'Objective',
      width: '280px',
      sortable: true,
      render: (row: OkrObjectiveWithKeyResultsDto) => <span className="text-sm font-medium text-c-text">{row.title}</span>,
    },
    {
      id: 'status',
      label: 'Status',
      width: '190px',
      filterable: true,
      filterOptions: (Object.keys(OKR_OBJECTIVE_STATUS_TONE) as OkrObjectiveWithKeyResultsDto['status'][]).map((s) => ({
        value: s,
        label: okrObjectiveStatusLabel(s, isPolish),
      })),
      render: (row: OkrObjectiveWithKeyResultsDto) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip label={okrObjectiveStatusLabel(row.status, isPolish)} tone={OKR_OBJECTIVE_STATUS_TONE[row.status]} />
          {childLock ? (
            <span className="inline-flex shrink-0" title={isPolish ? childLock.reason.pl : childLock.reason.en}>
              <Lock size={13} className="shrink-0 text-c-text-muted" aria-label={isPolish ? childLock.label.pl : childLock.label.en} />
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'ambitionType',
      label: isPolish ? 'Ambicja' : 'Ambition',
      width: '140px',
      render: (row: OkrObjectiveWithKeyResultsDto) => (
        <span className="text-sm text-c-text-secondary">{okrObjectiveAmbitionLabel(row.ambitionType, isPolish)}</span>
      ),
    },
    {
      id: 'owner',
      label: isPolish ? 'Właściciel' : 'Owner',
      width: '140px',
      render: (row: OkrObjectiveWithKeyResultsDto) => (
        <span className="block truncate text-sm text-c-text-secondary font-mono" title={row.ownerUserId}>
          {shortOkrId(row.ownerUserId)}
        </span>
      ),
    },
    {
      id: 'progress',
      label: isPolish ? 'Postęp' : 'Progress',
      width: '110px',
      align: 'right',
      render: (row: OkrObjectiveWithKeyResultsDto) => (
        <HonestValueCell
          value={parseOkrObjectiveProgress(row.progress, row.progressCalcReason)}
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
      render: (row: OkrObjectiveWithKeyResultsDto) => (
        <HonestValueCell
          value={parseOkrObjectiveConfidence(row.confidence, row.confidenceCalcReason)}
          notCalculableReason={row.confidenceCalcReason ?? undefined}
          format={(v) => <StatusChip label={okrObjectiveConfidenceLabel(v, isPolish)} tone="neutral" />}
        />
      ),
    },
    {
      id: 'keyResultsCount',
      label: isPolish ? 'Kluczowe Rezultaty' : 'Key Results',
      width: '150px',
      align: 'right',
      render: (row: OkrObjectiveWithKeyResultsDto) => (
        <span className="tabular-nums text-sm text-c-text-secondary">{row.keyResults.length}</span>
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '130px',
      sortable: true,
      render: (row: OkrObjectiveWithKeyResultsDto) => (
        <span className="text-sm text-c-text-muted tabular-nums">{formatOkrDate(row.updatedAt, isPolish)}</span>
      ),
    },
  ];
}

// ==========================================
// Row menu
// ==========================================

export interface OkrObjectiveRowMenuHandlers {
  onPreview: (row: OkrObjectiveWithKeyResultsDto) => void;
  onOpenKeyResults: (row: OkrObjectiveWithKeyResultsDto) => void;
  onEdit: (row: OkrObjectiveWithKeyResultsDto) => void;
  onCancel: (row: OkrObjectiveWithKeyResultsDto) => void;
}

export function buildOkrObjectiveRowMenu(
  row: OkrObjectiveWithKeyResultsDto,
  isPolish: boolean,
  parentSetStatus: string,
  handlers: OkrObjectiveRowMenuHandlers
): StandardRowMenu {
  const childLock = getOkrSetChildEditLock(parentSetStatus);
  const childLockReason = childLock ? (isPolish ? childLock.reason.pl : childLock.reason.en) : undefined;
  const cancelEligible = canCancelObjectiveStatus(row.status);
  const cancelBlockedReason = childLock
    ? childLockReason
    : !cancelEligible
      ? isPolish
        ? `Nie można anulować celu w statusie "${okrObjectiveStatusLabel(row.status, isPolish)}".`
        : `Cannot cancel an objective in status "${okrObjectiveStatusLabel(row.status, isPolish)}".`
      : undefined;

  return {
    primary: [
      { id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => handlers.onPreview(row) },
      {
        id: 'open-key-results',
        label: isPolish ? 'Kluczowe Rezultaty' : 'Key Results',
        onClick: () => handlers.onOpenKeyResults(row),
      },
    ],
    universalHandlers: {
      preview: () => handlers.onPreview(row),
      edit: childLock ? undefined : () => handlers.onEdit(row),
      editNote: childLockReason,
    },
    destructive: cancelBlockedReason
      ? { label: isPolish ? 'Anuluj cel' : 'Cancel objective', note: cancelBlockedReason }
      : { label: isPolish ? 'Anuluj cel' : 'Cancel objective', onClick: () => handlers.onCancel(row) },
  };
}

// ==========================================
// Preview
// ==========================================

export interface OkrObjectivePreviewDeps {
  isPolish: boolean;
  parentSetStatus: string;
  onClose: () => void;
  onOpenKeyResults: (row: OkrObjectiveWithKeyResultsDto) => void;
  onEdit: (row: OkrObjectiveWithKeyResultsDto) => void;
  onCancel: (row: OkrObjectiveWithKeyResultsDto) => void;
}

export function buildOkrObjectivePreview(row: OkrObjectiveWithKeyResultsDto, deps: OkrObjectivePreviewDeps): StandardPreviewProps {
  const { isPolish, parentSetStatus, onClose, onOpenKeyResults, onEdit, onCancel } = deps;
  const childLock = getOkrSetChildEditLock(parentSetStatus);
  const progress = parseOkrObjectiveProgress(row.progress, row.progressCalcReason);
  const confidence = parseOkrObjectiveConfidence(row.confidence, row.confidenceCalcReason);
  const cancelEligible = canCancelObjectiveStatus(row.status);

  return {
    title: row.title,
    onClose,
    headerExtra: childLock ? (
      <LifecycleLockBadge label={isPolish ? childLock.label.pl : childLock.label.en} reason={isPolish ? childLock.reason.pl : childLock.reason.en} />
    ) : undefined,
    meta: {
      pills: [
        { label: okrObjectiveStatusLabel(row.status, isPolish), tone: OKR_OBJECTIVE_STATUS_TONE[row.status] },
        { label: okrObjectiveAmbitionLabel(row.ambitionType, isPolish), tone: 'neutral' },
      ],
      recommendation: childLock
        ? isPolish
          ? childLock.reason.pl
          : childLock.reason.en
        : isPolish
          ? 'Podgląd celu — kliknij „Kluczowe Rezultaty", aby zobaczyć jego Key Results.'
          : 'Objective preview — click "Key Results" to see its Key Results.',
    },
    details: {
      showWordCount: false,
      propertyLabel: isPolish ? 'Właściwość' : 'Property',
      valueLabel: isPolish ? 'Wartość' : 'Value',
      properties: [
        { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: row.ownerUserId, mono: true },
        { id: 'description', label: isPolish ? 'Opis' : 'Description', value: row.description ?? '—' },
        { id: 'rationale', label: isPolish ? 'Uzasadnienie' : 'Rationale', value: row.rationale ?? '—' },
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
          value: (
            <HonestValueCell
              value={confidence}
              notCalculableReason={row.confidenceCalcReason ?? undefined}
              format={(v) => okrObjectiveConfidenceLabel(v, isPolish)}
            />
          ),
        },
        {
          id: 'keyResultsCount',
          label: isPolish ? 'Liczba Kluczowych Rezultatów' : 'Key Results count',
          value: String(row.keyResults.length),
        },
        { id: 'approvedAt', label: isPolish ? 'Zaakceptowano' : 'Approved at', value: formatOkrDate(row.approvedAt, isPolish) },
        { id: 'createdAt', label: isPolish ? 'Utworzono' : 'Created', value: formatOkrDate(row.createdAt, isPolish) },
        { id: 'updatedAt', label: isPolish ? 'Zaktualizowano' : 'Updated', value: formatOkrDate(row.updatedAt, isPolish) },
      ],
    },
    ai: { hints: [], disabled: true, disabledTooltip: isPolish ? 'Wkrótce' : 'Coming soon' },
    relations: [],
    actions: {
      informational: [
        {
          id: 'open-key-results',
          variant: 'neutral',
          label: isPolish ? 'Kluczowe Rezultaty' : 'Key Results',
          onClick: () => onOpenKeyResults(row),
        },
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

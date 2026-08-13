/**
 * RN-G2 §G #25 — Check-in history table columns / row menu / preview
 * builders. PURE functions, mirrors the Objective/Key Result presenter
 * files.
 */
import React from 'react';

import type { StandardPreviewProps, StandardRowMenu, TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives';

import { HonestValueCell } from '../HonestValue';
import type { OkrCheckInDto } from './okrCheckInApi';
import {
  formatOkrDate,
  formatOkrProgressPercent,
  OKR_CHECKIN_STATUS_TONE,
  okrCheckInConfidenceLabel,
  okrCheckInStatusLabel,
  parseOkrCheckInProgress,
  parseOkrNumericField,
} from './okrCheckInMappers';

// ==========================================
// Table columns
// ==========================================

export function buildOkrCheckInColumns(isPolish: boolean): TableColumn[] {
  return [
    {
      id: 'submittedAt',
      label: isPolish ? 'Data' : 'Date',
      width: '150px',
      sortable: true,
      render: (row: OkrCheckInDto) => (
        <span className="text-sm text-c-text tabular-nums">{formatOkrDate(row.submittedAt, isPolish)}</span>
      ),
    },
    {
      id: 'newValue',
      label: isPolish ? 'Nowa wartość' : 'New value',
      width: '130px',
      align: 'right',
      render: (row: OkrCheckInDto) => (
        <HonestValueCell
          value={parseOkrNumericField(row.newValue)}
          align="right"
          format={(v) => <span className="tabular-nums text-sm text-c-text">{v.toLocaleString(isPolish ? 'pl-PL' : 'en-US')}</span>}
        />
      ),
    },
    {
      id: 'calculatedProgress',
      label: isPolish ? 'Postęp' : 'Progress',
      width: '110px',
      align: 'right',
      render: (row: OkrCheckInDto) => (
        <HonestValueCell
          value={parseOkrCheckInProgress(row.calculatedProgress)}
          align="right"
          format={(v) => <span className="tabular-nums text-sm text-c-text">{formatOkrProgressPercent(v, isPolish)}</span>}
        />
      ),
    },
    {
      id: 'ownerDeclaredStatus',
      label: isPolish ? 'Status (właściciel)' : 'Status (owner)',
      width: '160px',
      filterable: true,
      filterOptions: (Object.keys(OKR_CHECKIN_STATUS_TONE) as OkrCheckInDto['ownerDeclaredStatus'][])
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => ({ value: s, label: okrCheckInStatusLabel(s, isPolish) })),
      render: (row: OkrCheckInDto) =>
        row.ownerDeclaredStatus ? (
          <StatusChip label={okrCheckInStatusLabel(row.ownerDeclaredStatus, isPolish)} tone={OKR_CHECKIN_STATUS_TONE[row.ownerDeclaredStatus]} />
        ) : (
          <span className="text-c-text-muted text-sm">—</span>
        ),
    },
    {
      id: 'confidence',
      label: isPolish ? 'Pewność' : 'Confidence',
      width: '120px',
      render: (row: OkrCheckInDto) =>
        row.confidence ? (
          <StatusChip label={okrCheckInConfidenceLabel(row.confidence, isPolish)} tone="neutral" />
        ) : (
          <span className="text-c-text-muted text-sm">—</span>
        ),
    },
    {
      id: 'note',
      label: isPolish ? 'Notatka' : 'Note',
      width: '260px',
      render: (row: OkrCheckInDto) => <span className="block truncate text-sm text-c-text-secondary">{row.note}</span>,
    },
    {
      id: 'correction',
      label: isPolish ? 'Rodzaj' : 'Kind',
      width: '130px',
      render: (row: OkrCheckInDto) =>
        row.correctionOfCheckInId ? (
          <StatusChip label={isPolish ? 'Korekta' : 'Correction'} tone="info" />
        ) : (
          <StatusChip label={isPolish ? 'Oryginał' : 'Original'} tone="neutral" />
        ),
    },
    {
      id: 'submittedBy',
      label: isPolish ? 'Zgłosił' : 'Submitted by',
      width: '140px',
      render: (row: OkrCheckInDto) => (
        <span className="block truncate text-sm text-c-text-secondary font-mono" title={row.submittedBy}>
          {row.submittedBy.length > 10 ? `${row.submittedBy.slice(0, 8)}…` : row.submittedBy}
        </span>
      ),
    },
  ];
}

// ==========================================
// Row menu — "correct" is always offered (server does not gate
// `correctCheckIn` on KR/Set status, see `okrCheckInApi.ts` header for the
// citation); a check-in that is ITSELF already a correction can still be
// corrected again (append-only chain, no depth limit stated in any source
// document read).
// ==========================================

export interface OkrCheckInRowMenuHandlers {
  onPreview: (row: OkrCheckInDto) => void;
  onCorrect: (row: OkrCheckInDto) => void;
}

export function buildOkrCheckInRowMenu(row: OkrCheckInDto, isPolish: boolean, handlers: OkrCheckInRowMenuHandlers): StandardRowMenu {
  return {
    primary: [
      { id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => handlers.onPreview(row) },
      { id: 'correct', label: isPolish ? 'Skoryguj' : 'Correct', onClick: () => handlers.onCorrect(row) },
    ],
    universalHandlers: {
      preview: () => handlers.onPreview(row),
    },
  };
}

// ==========================================
// Preview
// ==========================================

export interface OkrCheckInPreviewDeps {
  isPolish: boolean;
  onClose: () => void;
  onCorrect: (row: OkrCheckInDto) => void;
}

export function buildOkrCheckInPreview(row: OkrCheckInDto, deps: OkrCheckInPreviewDeps): StandardPreviewProps {
  const { isPolish, onClose, onCorrect } = deps;
  const progress = parseOkrCheckInProgress(row.calculatedProgress);
  const newValue = parseOkrNumericField(row.newValue);
  const previousValue = parseOkrNumericField(row.previousValue);

  return {
    title: isPolish ? `Check-in — ${formatOkrDate(row.submittedAt, isPolish)}` : `Check-in — ${formatOkrDate(row.submittedAt, isPolish)}`,
    onClose,
    meta: {
      pills: [
        row.ownerDeclaredStatus
          ? { label: okrCheckInStatusLabel(row.ownerDeclaredStatus, isPolish), tone: OKR_CHECKIN_STATUS_TONE[row.ownerDeclaredStatus] }
          : { label: isPolish ? 'Brak deklaracji' : 'No declared status', tone: 'neutral' },
        row.correctionOfCheckInId
          ? { label: isPolish ? 'Korekta' : 'Correction', tone: 'info' }
          : { label: isPolish ? 'Oryginał' : 'Original', tone: 'neutral' },
      ],
      recommendation: row.correctionReason
        ? isPolish
          ? `Powód korekty: ${row.correctionReason}`
          : `Correction reason: ${row.correctionReason}`
        : undefined,
    },
    details: {
      showWordCount: false,
      propertyLabel: isPolish ? 'Właściwość' : 'Property',
      valueLabel: isPolish ? 'Wartość' : 'Value',
      properties: [
        { id: 'note', label: isPolish ? 'Notatka' : 'Note', value: row.note },
        { id: 'previousValue', label: isPolish ? 'Wartość poprzednia' : 'Previous value', value: <HonestValueCell value={previousValue} format={(v) => v.toLocaleString(isPolish ? 'pl-PL' : 'en-US')} /> },
        { id: 'newValue', label: isPolish ? 'Nowa wartość' : 'New value', value: <HonestValueCell value={newValue} format={(v) => v.toLocaleString(isPolish ? 'pl-PL' : 'en-US')} /> },
        {
          id: 'calculatedProgress',
          label: isPolish ? 'Wyliczony postęp' : 'Calculated progress',
          // No `notCalculableReason` — `okr_vnext_checkins` has no reason
          // column (see `okrCheckInApi.ts` header), so this branch is
          // unreachable from real data, same posture as the Set's own
          // `overallProgress` (OQ-UI-C).
          value: <HonestValueCell value={progress} format={(v) => formatOkrProgressPercent(v, isPolish)} />,
        },
        {
          id: 'systemSuggestedStatus',
          label: isPolish ? 'Status sugerowany przez system' : 'System-suggested status',
          value: row.systemSuggestedStatus ? okrCheckInStatusLabel(row.systemSuggestedStatus, isPolish) : '—',
        },
        {
          id: 'confidence',
          label: isPolish ? 'Pewność' : 'Confidence',
          value: row.confidence ? okrCheckInConfidenceLabel(row.confidence, isPolish) : '—',
        },
        { id: 'blocker', label: isPolish ? 'Blokada' : 'Blocker', value: row.blocker ?? '—' },
        { id: 'supportRequested', label: isPolish ? 'Potrzebne wsparcie' : 'Support requested', value: row.supportRequested ?? '—' },
        { id: 'submittedBy', label: isPolish ? 'Zgłosił' : 'Submitted by', value: row.submittedBy, mono: true },
        { id: 'submittedAt', label: isPolish ? 'Data zgłoszenia' : 'Submitted at', value: formatOkrDate(row.submittedAt, isPolish) },
        { id: 'cadenceOccurrenceId', label: isPolish ? 'ID wystąpienia cyklu' : 'Cadence occurrence id', value: row.cadenceOccurrenceId, mono: true },
      ],
    },
    ai: { hints: [], disabled: true, disabledTooltip: isPolish ? 'Wkrótce' : 'Coming soon' },
    relations: [],
    actions: {
      informational: [{ id: 'correct', variant: 'neutral', label: isPolish ? 'Skoryguj' : 'Correct', onClick: () => onCorrect(row) }],
    },
  };
}

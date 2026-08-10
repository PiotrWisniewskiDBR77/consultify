/**
 * RN-G2 P3 #23 — OKR Set registry presentation builders: columns / row menu /
 * preview for `StandardTable`/`StandardPreview`, built from real `OkrSetDto`
 * data. Mirrors `../roi/roiRegistryPresenters.tsx` exactly.
 *
 * Deliberately PURE functions of their inputs (no fetching, no state) so the
 * SAME code renders both the live `ResultsOkrHub.tsx` (real API data) and the
 * `dev-render/screens/results-vnext-okr-registry.tsx` QA harness (mock data)
 * — one implementation, not two that can silently drift.
 */
import React from 'react';
import { Lock } from 'lucide-react';

import type { StandardPreviewProps, StandardRowMenu, TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives';

import { HonestValueCell } from '../HonestValue';
import { LifecycleLockBadge, lockedRowMenuAction } from '../LifecycleLockBadge';
import type { OkrSetDto } from './okrApi';
import {
  formatOkrDate,
  formatOkrProgressPercent,
  getOkrSetLockInfo,
  isOkrSetLocked,
  OKR_SET_ATTENTION_TONE,
  OKR_SET_CONFIDENCE_TONE,
  OKR_SET_STATUS_TONE,
  okrSetAttentionLabel,
  okrSetConfidenceLabel,
  okrSetScopeLabel,
  okrSetStatusLabel,
  parseOkrProgress,
  shortOkrId,
} from './okrRegistryMappers';

// ==========================================
// Table columns — shared by all three tabs (Organization/My/Company all
// return the same `OkrSetDto` shape, see okrApi.ts header note).
// ==========================================

export function buildOkrSetColumns(isPolish: boolean): TableColumn[] {
  return [
    {
      id: 'title',
      label: isPolish ? 'Zestaw OKR' : 'OKR set',
      width: '300px',
      sortable: true,
      render: (row: OkrSetDto) => <span className="text-sm font-medium text-c-text">{row.title}</span>,
    },
    {
      id: 'status',
      label: 'Status',
      width: '200px',
      filterable: true,
      filterOptions: (Object.keys(OKR_SET_STATUS_TONE) as OkrSetDto['status'][]).map((s) => ({
        value: s,
        label: okrSetStatusLabel(s, isPolish),
      })),
      render: (row: OkrSetDto) => {
        const lock = getOkrSetLockInfo(row.status);
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip label={okrSetStatusLabel(row.status, isPolish)} tone={OKR_SET_STATUS_TONE[row.status]} />
            {lock ? (
              // Icon-only lock signal in the narrow table cell, full reason
              // still available via `title` tooltip — same TRIADA §C3
              // "honest reason available, not necessarily full chrome at
              // every density" precedent as `roiRegistryPresenters.tsx`.
              <span className="inline-flex shrink-0" title={isPolish ? lock.reason.pl : lock.reason.en}>
                <Lock
                  size={13}
                  className="shrink-0 text-c-text-muted"
                  aria-label={isPolish ? lock.label.pl : lock.label.en}
                />
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'scopeType',
      label: isPolish ? 'Zasięg' : 'Scope',
      width: '150px',
      render: (row: OkrSetDto) => (
        <span className="text-sm text-c-text-secondary">{okrSetScopeLabel(row.scopeType, isPolish)}</span>
      ),
    },
    {
      id: 'owner',
      label: isPolish ? 'Właściciel' : 'Owner',
      width: '140px',
      render: (row: OkrSetDto) => (
        <span className="block truncate text-sm text-c-text-secondary font-mono" title={row.ownerUserId}>
          {shortOkrId(row.ownerUserId)}
        </span>
      ),
    },
    {
      id: 'overallProgress',
      label: isPolish ? 'Postęp' : 'Progress',
      width: '110px',
      align: 'right',
      render: (row: OkrSetDto) => (
        <HonestValueCell
          value={parseOkrProgress(row.overallProgress)}
          align="right"
          // No `notCalculableReason` — this branch is unreachable for real
          // API data today (see `parseOkrProgress`'s own doc comment for the
          // full, code-cited explanation of why the wire never carries a
          // distinct `'not_calculable'` signal for this field).
          format={(v) => <span className="tabular-nums text-sm text-c-text">{formatOkrProgressPercent(v, isPolish)}</span>}
        />
      ),
    },
    {
      id: 'overallConfidence',
      label: isPolish ? 'Pewność' : 'Confidence',
      width: '120px',
      render: (row: OkrSetDto) =>
        row.overallConfidence ? (
          <StatusChip
            label={okrSetConfidenceLabel(row.overallConfidence, isPolish)}
            tone={OKR_SET_CONFIDENCE_TONE[row.overallConfidence]}
          />
        ) : (
          <span className="text-c-text-muted text-sm">—</span>
        ),
    },
    {
      id: 'attentionState',
      label: isPolish ? 'Uwaga' : 'Attention',
      width: '130px',
      filterable: true,
      filterOptions: (Object.keys(OKR_SET_ATTENTION_TONE) as OkrSetDto['attentionState'][]).map((s) => ({
        value: s,
        label: okrSetAttentionLabel(s, isPolish),
      })),
      render: (row: OkrSetDto) => (
        <StatusChip label={okrSetAttentionLabel(row.attentionState, isPolish)} tone={OKR_SET_ATTENTION_TONE[row.attentionState]} />
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '130px',
      sortable: true,
      render: (row: OkrSetDto) => (
        <span className="text-sm text-c-text-muted tabular-nums">{formatOkrDate(row.updatedAt, isPolish)}</span>
      ),
    },
  ];
}

// ==========================================
// Row menu (kebab) — 3-zone contract. Locked sets keep every action VISIBLE,
// disabled, with a reason (TRIADA §C3 / `lockedRowMenuAction`) — never
// hidden. Mirrors `roiRegistryPresenters.tsx` exactly: this package is
// list+preview only (RN_G2_UI_SCOPE.md §G #23, "OKR Sets registry ... +
// preview" — real submit/approve/request-changes/activate/cancel mutations
// are not wired here), so EVERY transition slot is either a genuine business
// lock or "not built in this package yet" — never a fake working button.
// ==========================================

const NOT_BUILT_NOTE = {
  pl: 'Pełne narzędzie zestawu OKR (edycja/przejścia submit/approve/request-changes) jeszcze nie zbudowane w tym pakiecie — rejestr jest list+preview.',
  en: 'The full OKR Set tool (editing/submit/approve/request-changes transitions) is not built in this package yet — this is list+preview only.',
};

export function buildOkrSetRowMenu(
  row: OkrSetDto,
  isPolish: boolean,
  handlers: { onPreview: (row: OkrSetDto) => void }
): StandardRowMenu {
  const locked = isOkrSetLocked(row.status);
  const lock = getOkrSetLockInfo(row.status);
  const lockReason = lock ? (isPolish ? lock.reason.pl : lock.reason.en) : undefined;
  const notBuiltReason = isPolish ? NOT_BUILT_NOTE.pl : NOT_BUILT_NOTE.en;

  return {
    primary: [
      {
        id: 'open',
        label: isPolish ? 'Otwórz' : 'Open',
        onClick: () => handlers.onPreview(row),
      },
    ],
    // A single representative lifecycle-transition slot — same rationale as
    // ROI's own row menu: demonstrates the TWO distinct disabled-reasons a
    // real build will need (a genuine business lock vs. "not wired yet"),
    // never the same generic "disabled" with no reason.
    statusTransitions: [
      locked
        ? lockedRowMenuAction({ id: 'advance', label: isPolish ? 'Zmień status' : 'Change status' }, lockReason!)
        : { id: 'advance', label: isPolish ? 'Zmień status' : 'Change status', disabled: true, note: notBuiltReason },
    ],
    universalHandlers: {
      preview: () => handlers.onPreview(row),
      editNote: locked ? lockReason : notBuiltReason,
      archiveNote: locked ? lockReason : notBuiltReason,
    },
  };
}

// ==========================================
// Preview
// ==========================================

export interface OkrSetPreviewDeps {
  isPolish: boolean;
  onClose: () => void;
}

export function buildOkrSetPreview(row: OkrSetDto, deps: OkrSetPreviewDeps): StandardPreviewProps {
  const { isPolish, onClose } = deps;
  const lock = getOkrSetLockInfo(row.status);
  const progress = parseOkrProgress(row.overallProgress);

  return {
    title: row.title,
    onClose,
    headerExtra: lock ? (
      <LifecycleLockBadge
        label={isPolish ? lock.label.pl : lock.label.en}
        reason={isPolish ? lock.reason.pl : lock.reason.en}
      />
    ) : undefined,
    meta: {
      pills: [
        { label: okrSetStatusLabel(row.status, isPolish), tone: OKR_SET_STATUS_TONE[row.status] },
        { label: okrSetScopeLabel(row.scopeType, isPolish), tone: 'neutral' },
        { label: okrSetAttentionLabel(row.attentionState, isPolish), tone: OKR_SET_ATTENTION_TONE[row.attentionState] },
      ],
      trailing: row.nextCheckinDueAt ? (
        <span className="text-[11px] font-semibold text-c-text-secondary">
          {formatOkrDate(row.nextCheckinDueAt, isPolish)}
        </span>
      ) : undefined,
      recommendation: lock
        ? isPolish
          ? lock.reason.pl
          : lock.reason.en
        : isPolish
          ? 'Podgląd rejestru — pełna edycja zestawu OKR jeszcze nie zbudowana w tym pakiecie.'
          : 'Registry preview — full OKR set editing is not built in this package yet.',
    },
    details: {
      showWordCount: false,
      properties: [
        { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: row.ownerUserId, mono: true },
        {
          id: 'reviewer',
          label: isPolish ? 'Recenzent' : 'Reviewer',
          value: row.reviewerUserId ?? '—',
          mono: !!row.reviewerUserId,
        },
        { id: 'program', label: isPolish ? 'Program' : 'Program', value: row.programId, mono: true },
        { id: 'cycle', label: isPolish ? 'Cykl' : 'Cycle', value: row.cycleId, mono: true },
        {
          id: 'progress',
          label: isPolish ? 'Ogólny postęp' : 'Overall progress',
          value: (
            <HonestValueCell
              value={progress}
              align="left"
              format={(v) => formatOkrProgressPercent(v, isPolish)}
            />
          ),
        },
        {
          id: 'confidence',
          label: isPolish ? 'Ogólna pewność' : 'Overall confidence',
          value: row.overallConfidence ? okrSetConfidenceLabel(row.overallConfidence, isPolish) : '—',
        },
        {
          id: 'lastCheckin',
          label: isPolish ? 'Ostatni check-in' : 'Last check-in',
          value: formatOkrDate(row.lastCheckinAt, isPolish),
        },
        {
          id: 'nextCheckin',
          label: isPolish ? 'Następny check-in' : 'Next check-in due',
          value: formatOkrDate(row.nextCheckinDueAt, isPolish),
        },
        {
          id: 'changesRequestedReason',
          label: isPolish ? 'Powód poprawek' : 'Changes-requested reason',
          value: row.changesRequestedReason ?? '—',
        },
      ],
    },
    ai: {
      hints: isPolish ? ['Podsumuj zestaw', 'Zaproponuj następny krok'] : ['Summarize set', 'Suggest next step'],
      disabled: true,
      disabledTooltip: isPolish ? 'Wkrótce' : 'Coming soon',
    },
    relations: [],
    // No `actions` block — same rationale as `roiRegistryPresenters.tsx`:
    // this package is registry list + preview ONLY, no real capability is
    // wired, and `StandardPreviewAction` has no disabled-reason slot, so a
    // fake button here would be worse than an honestly empty footer.
  };
}

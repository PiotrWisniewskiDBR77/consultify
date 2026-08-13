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

export function buildOkrSetColumns(isPolish: boolean, currentUserId?: string): TableColumn[] {
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
        <span className="block truncate text-sm text-c-text-secondary" title={row.ownerUserId}>
          {currentUserId && row.ownerUserId === currentUserId
            ? isPolish
              ? 'Ty'
              : 'You'
            : shortOkrId(row.ownerUserId)}
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
  handlers: {
    onPreview: (row: OkrSetDto) => void;
    /**
     * RN-G2 §G #25 (Objectives/Key Results/Check-ins) — optional so this
     * function keeps working, byte-for-byte, for any caller that predates
     * that package (addytywne). Navigates INTO the Set's Objectives
     * registry (`OkrObjectivesView.tsx`) — a read-only drill, never gated
     * by the Set's own lock (viewing is always allowed; only CREATE/EDIT of
     * children is lock-gated, enforced one level down).
     */
    onOpenObjectives?: (row: OkrSetDto) => void;
    /**
     * RN-G3 lane `okr` (2026-08-11, full-tool task) — opens the FULL
     * `OkrSetWorkspace` (Overview/Objectives & Key Results/Alignment/
     * Conversations & Support/Review & Reflection/History). Optional, same
     * addytywne posture as `onOpenObjectives` above — this function keeps
     * working byte-for-byte for any caller that predates the workspace.
     */
    onOpenWorkspace?: (row: OkrSetDto) => void;
  }
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
      ...(handlers.onOpenWorkspace
        ? [
            {
              id: 'open-workspace',
              label: isPolish ? 'Obszar roboczy OKR' : 'OKR workspace',
              onClick: () => handlers.onOpenWorkspace!(row),
            },
          ]
        : []),
      ...(handlers.onOpenObjectives
        ? [
            {
              id: 'open-objectives',
              label: isPolish ? 'Cele (Objectives)' : 'Objectives',
              onClick: () => handlers.onOpenObjectives!(row),
            },
          ]
        : []),
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
  currentUserId?: string;
  /** RN-G2 §G #25 — optional, same addytywne posture as
   * `buildOkrSetRowMenu`'s own `onOpenObjectives`. */
  onOpenObjectives?: (row: OkrSetDto) => void;
  /** RN-G3 lane `okr` full-tool task — optional, opens `OkrSetWorkspace`. */
  onOpenWorkspace?: (row: OkrSetDto) => void;
}

export function buildOkrSetPreview(row: OkrSetDto, deps: OkrSetPreviewDeps): StandardPreviewProps {
  const { isPolish, onClose, onOpenObjectives, onOpenWorkspace, currentUserId } = deps;
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
      // OQ-UI-D point 2 (`RN_G2_OPEN_QUESTIONS_UI.md`): `StandardPreview`
      // already supports translated column headers via
      // `propertyLabel`/`valueLabel` (L122-123/L471-472) — the raw English
      // "Property"/"Value" on Polish screenshots was this call site never
      // supplying them, not a missing mechanism. Fixed here while extending
      // this same file for RN-G2 §G #25 (Objectives/KRs/Check-ins reuse this
      // exact fix in their own presenter files).
      propertyLabel: isPolish ? 'Właściwość' : 'Property',
      valueLabel: isPolish ? 'Wartość' : 'Value',
      properties: [
        {
          id: 'owner',
          label: isPolish ? 'Właściciel' : 'Owner',
          value:
            currentUserId && row.ownerUserId === currentUserId
              ? isPolish
                ? 'Ty'
                : 'You'
              : shortOkrId(row.ownerUserId),
        },
        {
          id: 'reviewer',
          label: isPolish ? 'Recenzent' : 'Reviewer',
          value: row.reviewerUserId ?? '—',
          mono: !!row.reviewerUserId,
        },
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
    // RN-G2 §G #25 (Objectives/Key Results/Check-ins): the ONE real,
    // navigational action this package adds — "Cele" drills into the Set's
    // Objectives registry (read-only navigation, never gated by the Set's
    // own lock; only child CREATE/EDIT is lock-gated, one level down in
    // `OkrObjectivesView.tsx`). Every other action this preview could offer
    // (submit/approve/request-changes/activate) is still genuinely not
    // wired in this package — same "no fake button" rationale
    // `roiRegistryPresenters.tsx` states, now narrowed to exactly the one
    // capability that IS real.
    actions:
      onOpenObjectives || onOpenWorkspace
        ? {
            informational: [
              onOpenWorkspace
                ? {
                    id: 'open-workspace',
                    variant: 'neutral' as const,
                    label: isPolish ? 'Obszar roboczy OKR' : 'OKR workspace',
                    onClick: () => onOpenWorkspace(row),
                  }
                : null,
              onOpenObjectives
                ? {
                    id: 'open-objectives',
                    variant: 'neutral' as const,
                    label: isPolish ? 'Cele (Objectives)' : 'Objectives',
                    onClick: () => onOpenObjectives(row),
                  }
                : null,
            ].filter((a): a is NonNullable<typeof a> => a !== null),
          }
        : undefined,
  };
}

/**
 * RN-G2 P2 — ROI registry presentation builders: columns / row menu / preview
 * for `StandardTable`/`StandardPreview`, built from real `RoiCaseListItem`
 * data (+ a lazily-fetched `RoiCalculationRunSummary` for the preview).
 *
 * Deliberately PURE functions of their inputs (no fetching, no state) so the
 * SAME code renders both the live `ResultsRoiHub.tsx` (real API data) and the
 * `dev-render/screens/results-vnext-roi-registry.tsx` QA harness (mock data)
 * — one implementation, not two that can silently drift (see
 * `dev-render/screens/results-vnext-registry-shell.tsx`'s own precedent for
 * the P0 shell, which this package's own harness screen mirrors for ROI
 * specifically).
 */
import React from 'react';
import { Lock } from 'lucide-react';

import type { StandardPreviewProps, StandardRowMenu, TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives';

import { HonestValueCell } from '../HonestValue';
import { LifecycleLockBadge } from '../LifecycleLockBadge';
import type { RoiCalculationRunSummary, RoiCaseListItem } from './roiApi';
import {
  deriveIrrHonestValue,
  deriveNpvHonestValue,
  derivePaybackHonestValue,
  formatRoiCurrency,
  formatRoiDate,
  formatRoiNumber,
  formatRoiPercent,
  getRoiCaseLockInfo,
  humanizeActionType,
  irrNotCalculableReason,
  isRoiCaseLocked,
  isRoiTransitionAllowedFromStatus,
  npvNotCalculableReason,
  ROI_STATUS_TONE,
  ROI_TRANSITIONS,
  roiStatusLabel,
  type RoiTransitionId,
} from './roiRegistryMappers';

/** Kebab display order for the lifecycle transitions this package wires
 * (RN_G2_UI_SCOPE.md §G #16 subset, 7 transitions) — decision-zone actions
 * first (approve/reject/request-changes), then the two-step "approved →
 * revision" escape hatch, then the tracking-phase transitions (start-pir/
 * close), with `cancel` last (broadest `fromStatuses`, most cases in the
 * flow could theoretically show it eligible only very late — closest in
 * spirit to an ending action, though it stays in the `statusTransitions`
 * zone, not `destructive`, since it is a real lifecycle status, not a
 * delete). PLUS (RN-G6-C2): `start_modeling`/`ready_for_review` prepended —
 * the two earliest-lifecycle transitions (draft → modeling → ready for
 * review), added after the fact once the gold-flow run found they had no
 * frontend caller at all (see `roiApi.ts` header comment). */
const ROI_TRANSITION_ORDER: RoiTransitionId[] = [
  'start_modeling',
  'ready_for_review',
  'submit_for_approval',
  'approve',
  'reject',
  'request_changes',
  'reopen_for_revision',
  'start_pir',
  'close',
  'cancel',
];

// ==========================================
// Table columns
// ==========================================

export function buildRoiCaseColumns(isPolish: boolean): TableColumn[] {
  return [
    {
      id: 'title',
      label: isPolish ? 'Sprawa' : 'Case',
      width: '320px',
      sortable: true,
      render: (row: RoiCaseListItem) => (
        <span className="text-sm font-medium text-c-text">{row.title}</span>
      ),
    },
    {
      id: 'status',
      label: isPolish ? 'Status' : 'Status',
      width: '210px',
      filterable: true,
      filterOptions: (Object.keys(ROI_STATUS_TONE) as RoiCaseListItem['status'][]).map((s) => ({
        value: s,
        label: roiStatusLabel(s, isPolish),
      })),
      render: (row: RoiCaseListItem) => {
        const lock = getRoiCaseLockInfo(row.status);
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip label={roiStatusLabel(row.status, isPolish)} tone={ROI_STATUS_TONE[row.status]} />
            {lock ? (
              // Icon-only lock signal in the (narrow, fixed-width) table cell —
              // the reason is still available via `title` (same tooltip text
              // as the full `LifecycleLockBadge`, which the PREVIEW header
              // uses at full size where there's room for the label text too;
              // TRIADA §C3 requires the REASON be honestly available, not
              // necessarily the full badge chrome at every density).
              <span
                className="inline-flex shrink-0"
                title={isPolish ? lock.reason.pl : lock.reason.en}
              >
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
      id: 'owner',
      label: isPolish ? 'Właściciel' : 'Owner',
      width: '150px',
      render: (row: RoiCaseListItem) => (
        <span
          className="block truncate text-sm text-c-text-secondary font-mono"
          title={row.ownerUserId}
        >
          {row.ownerUserId}
        </span>
      ),
    },
    {
      id: 'currency',
      label: isPolish ? 'Waluta' : 'Currency',
      width: '90px',
      render: (row: RoiCaseListItem) => (
        <span className="text-sm text-c-text-secondary tabular-nums">{row.currency}</span>
      ),
    },
    {
      id: 'nextAction',
      label: isPolish ? 'Następny krok' : 'Next action',
      width: '200px',
      render: (row: RoiCaseListItem) => (
        <HonestValueCell
          value={row.nextActionType}
          format={(v) => <span className="text-sm text-c-text-secondary">{humanizeActionType(v)}</span>}
        />
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '130px',
      sortable: true,
      render: (row: RoiCaseListItem) => (
        <span className="text-sm text-c-text-muted tabular-nums">{formatRoiDate(row.updatedAt, isPolish)}</span>
      ),
    },
  ];
}

// ==========================================
// Org perspective (benefits realization) columns — the ONE cheap, real
// source of table-level honest-value NUMERIC columns (RN_G2_UI_SCOPE.md §C:
// `GET /cases` itself carries no NPV/IRR — see ResultsRoiHub.tsx header
// comment for the full explanation of why NPV/IRR are preview-only, lazily
// fetched per selected case, never a table column sourced from N+1 calls).
// ==========================================

export interface RoiBenefitsRealizationRowVm {
  caseId: string;
  initiativeId: string;
  title: string;
  status: RoiCaseListItem['status'];
  approvedFinancialBenefits: number | null;
  actualFinancialBenefits: number | null;
  benefitsRealizationPct: number | null;
}

export function buildRoiBenefitsRealizationColumns(isPolish: boolean): TableColumn[] {
  return [
    {
      id: 'title',
      label: isPolish ? 'Sprawa' : 'Case',
      width: '300px',
      render: (row: RoiBenefitsRealizationRowVm) => (
        <span className="text-sm font-medium text-c-text">{row.title}</span>
      ),
    },
    {
      id: 'status',
      label: isPolish ? 'Status' : 'Status',
      width: '170px',
      render: (row: RoiBenefitsRealizationRowVm) => (
        <StatusChip label={roiStatusLabel(row.status, isPolish)} tone={ROI_STATUS_TONE[row.status]} />
      ),
    },
    {
      id: 'approved',
      label: isPolish ? 'Zaakceptowane korzyści' : 'Approved benefits',
      width: '170px',
      align: 'right',
      render: (row: RoiBenefitsRealizationRowVm) => (
        <HonestValueCell
          value={row.approvedFinancialBenefits}
          align="right"
          format={(v) => <span className="tabular-nums text-sm text-c-text">{formatRoiNumber(v, isPolish)}</span>}
        />
      ),
    },
    {
      id: 'actual',
      label: isPolish ? 'Rzeczywiste korzyści' : 'Actual benefits',
      width: '170px',
      align: 'right',
      render: (row: RoiBenefitsRealizationRowVm) => (
        <HonestValueCell
          value={row.actualFinancialBenefits}
          align="right"
          format={(v) => <span className="tabular-nums text-sm text-c-text">{formatRoiNumber(v, isPolish)}</span>}
        />
      ),
    },
    {
      id: 'realizationPct',
      label: isPolish ? 'Realizacja' : 'Realization',
      width: '120px',
      align: 'right',
      render: (row: RoiBenefitsRealizationRowVm) => (
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
  ];
}

// ==========================================
// Row menu (kebab) — 3-zone contract. Locked cases keep every action
// VISIBLE, disabled, with a reason (TRIADA §C3 / `lockedRowMenuAction`) —
// never hidden.
// ==========================================

const NOT_BUILT_NOTE = {
  pl: 'Pełna edycja pól sprawy ROI (poza przejściami cyklu życia) jeszcze nie zbudowana w tym pakiecie.',
  en: 'Full ROI case field editing (beyond lifecycle transitions) is not built in this package yet.',
};

export function buildRoiCaseRowMenu(
  row: RoiCaseListItem,
  isPolish: boolean,
  handlers: {
    onPreview: (row: RoiCaseListItem) => void;
    /** Opens `RoiTransitionDialog` for the given transition — the caller
     * (live Hub or dev-render harness) owns the actual API call/mock. */
    onTransition: (row: RoiCaseListItem, transitionId: RoiTransitionId) => void;
    /**
     * Opens `RoiCaseFullTool` (the four-phase Build Case → Decision →
     * Realize Value → Learn full tool, `RoiCaseFullTool.tsx`) for this case.
     * Optional: `roiRegistryPresenters.tsx` is also used by the pre-existing
     * dev-render QA harness for the registry alone, which does not need this
     * action wired. ALWAYS enabled, even on a locked case — every phase is
     * read-only-with-honest-reason from the inside (each sub-view disables
     * Add/Edit/Delete itself), never hidden at this entry point.
     */
    onModel?: (row: RoiCaseListItem) => void;
  }
): StandardRowMenu {
  const locked = isRoiCaseLocked(row.status);
  const lock = getRoiCaseLockInfo(row.status);
  const lockReason = lock ? (isPolish ? lock.reason.pl : lock.reason.en) : undefined;
  const notBuiltReason = isPolish ? NOT_BUILT_NOTE.pl : NOT_BUILT_NOTE.en;

  return {
    primary: [
      {
        id: 'open',
        label: isPolish ? 'Otwórz' : 'Open',
        onClick: () => handlers.onPreview(row),
      },
      ...(handlers.onModel
        ? [
            {
              id: 'model',
              label: isPolish ? 'Otwórz pełne narzędzie' : 'Open full tool',
              onClick: () => handlers.onModel!(row),
            },
          ]
        : []),
    ],
    // Every one of the 7 wired lifecycle transitions is ALWAYS visible
    // (TRIADA §C3: a disabled item stays visible with a reason, never
    // hidden) — eligible ones (per `ROI_TRANSITIONS[id].fromStatuses`,
    // copied verbatim from the server guard, see roiRegistryMappers.ts) are
    // enabled; ineligible ones are disabled with the state-machine reason
    // (`disabledReason`) — distinct in wording from `lockedRowMenuAction`'s
    // business-lock reason below, since "wrong current status" and "editing
    // frozen post-approval" are different facts even though both render as
    // a disabled+note kebab entry.
    statusTransitions: ROI_TRANSITION_ORDER.map((id) => {
      const def = ROI_TRANSITIONS[id];
      const label = isPolish ? def.label.pl : def.label.en;
      const allowed = isRoiTransitionAllowedFromStatus(id, row.status);
      // Menu-item id is namespaced `roi-<id>`, NOT the bare transition id —
      // `src/components/shared/RowActionsMenu.tsx` `DANGER_IDS` (a shared,
      // pre-existing, app-wide convention this package does not own) treats
      // a bare `'reject'` action id as belonging to the danger zone
      // REGARDLESS of which section declared it, silently splitting it out
      // from its 6 sibling transitions into its own bottom group (confirmed
      // live in the dev-render harness, RN-G2 create-package QA
      // 2026-08-10). `reject` here is a normal lifecycle transition, not a
      // delete — namespacing avoids the accidental collision without
      // touching the shared component. `handlers.onTransition` still
      // receives the real `RoiTransitionId` (`id`), unaffected by this.
      const menuItemId = `roi-${id}`;
      if (allowed) {
        return { id: menuItemId, label, onClick: () => handlers.onTransition(row, id) };
      }
      return {
        id: menuItemId,
        label,
        disabled: true,
        note: isPolish ? def.disabledReason.pl : def.disabledReason.en,
      };
    }),
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

export interface RoiPreviewDeps {
  isPolish: boolean;
  onClose: () => void;
  /** `undefined` while the lazy calculation-run fetch is in flight, `null`
   * once settled with no run found. Distinguishes "still loading" from
   * "genuinely no run yet" so the preview never flashes a fabricated value. */
  calculationRun: RoiCalculationRunSummary | null | undefined;
}

export function buildRoiCasePreview(row: RoiCaseListItem, deps: RoiPreviewDeps): StandardPreviewProps {
  const { isPolish, onClose, calculationRun } = deps;
  const lock = getRoiCaseLockInfo(row.status);
  const runResolved = calculationRun !== undefined;
  const run = runResolved ? calculationRun : null;

  const npv = runResolved ? deriveNpvHonestValue(run) : null;
  const irr = runResolved ? deriveIrrHonestValue(run) : null;
  const payback = runResolved ? derivePaybackHonestValue(run) : null;

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
        { label: roiStatusLabel(row.status, isPolish), tone: ROI_STATUS_TONE[row.status] },
        { label: `${row.currency} · ${row.granularity === 'monthly' ? (isPolish ? 'miesięczna' : 'monthly') : isPolish ? 'roczna' : 'annual'}`, tone: 'neutral' },
      ],
      trailing: row.nextActionDueAt ? (
        <span className="text-[11px] font-semibold text-c-text-secondary">
          {formatRoiDate(row.nextActionDueAt, isPolish)}
        </span>
      ) : undefined,
      recommendation: lock
        ? isPolish
          ? lock.reason.pl
          : lock.reason.en
        : row.nextActionType
          ? isPolish
            ? `Następny krok: ${humanizeActionType(row.nextActionType)}`
            : `Next step: ${humanizeActionType(row.nextActionType)}`
          : isPolish
            ? 'Podgląd rejestru — pełna edycja sprawy ROI jeszcze nie zbudowana w tym pakiecie.'
            : 'Registry preview — full ROI case editing is not built in this package yet.',
    },
    details: {
      showWordCount: false,
      properties: [
        { id: 'owner', label: isPolish ? 'Właściciel' : 'Owner', value: row.ownerUserId, mono: true },
        { id: 'initiative', label: isPolish ? 'Inicjatywa' : 'Initiative', value: row.initiativeId, mono: true },
        {
          id: 'analysisWindow',
          label: isPolish ? 'Okres analizy' : 'Analysis window',
          value:
            row.analysisStart || row.analysisEnd
              ? `${formatRoiDate(row.analysisStart, isPolish)} – ${formatRoiDate(row.analysisEnd, isPolish)}`
              : '—',
        },
        {
          id: 'npv',
          label: 'NPV',
          value: runResolved ? (
            <HonestValueCell
              value={npv}
              align="left"
              notCalculableReason={npvNotCalculableReason(run, isPolish)}
              format={(v) => formatRoiCurrency(v, row.currency, isPolish)}
            />
          ) : (
            <span className="text-c-text-muted text-sm">{isPolish ? 'Wczytywanie…' : 'Loading…'}</span>
          ),
        },
        {
          id: 'irr',
          label: 'IRR',
          value: runResolved ? (
            <HonestValueCell
              value={irr}
              align="left"
              notCalculableReason={irrNotCalculableReason(run, isPolish)}
              format={(v) => formatRoiPercent(v, isPolish)}
            />
          ) : (
            <span className="text-c-text-muted text-sm">{isPolish ? 'Wczytywanie…' : 'Loading…'}</span>
          ),
        },
        {
          id: 'payback',
          label: isPolish ? 'Okres zwrotu' : 'Payback period',
          value: runResolved ? (
            <HonestValueCell
              value={payback}
              align="left"
              notCalculableReason={
                isPolish
                  ? 'Ostatni przebieg kalkulacji zakończył się niepowodzeniem.'
                  : 'The latest calculation run failed.'
              }
              format={(v) => `${v.toLocaleString(isPolish ? 'pl-PL' : 'en-US', { maximumFractionDigits: 1 })} ${isPolish ? 'okr.' : 'periods'}`}
            />
          ) : (
            <span className="text-c-text-muted text-sm">{isPolish ? 'Wczytywanie…' : 'Loading…'}</span>
          ),
        },
        {
          id: 'rejectionReason',
          label: isPolish ? 'Powód odrzucenia' : 'Rejection reason',
          value: row.rejectionReason ?? '—',
        },
      ],
    },
    ai: {
      hints: isPolish ? ['Podsumuj sprawę', 'Zaproponuj następny krok'] : ['Summarize case', 'Suggest next step'],
      disabled: true,
      disabledTooltip: isPolish ? 'Wkrótce' : 'Coming soon',
    },
    relations: [],
    // No `actions` block: the 7 wired lifecycle transitions live in the ROW
    // KEBAB only (`buildRoiCaseRowMenu` above), deliberately NOT duplicated
    // here — `StandardPreviewAction` has no `note`/tooltip slot for a
    // disabled reason (unlike `StandardRowMenuAction.note`), so a preview
    // footer could only ever show the subset of transitions CURRENTLY
    // eligible from `row.status`, silently hiding the rest — which would
    // contradict TRIADA §C3 ("disabled stays visible with a reason, never
    // hidden") the moment the two surfaces disagree on what's shown. The
    // kebab is the one surface that can honor that rule for every
    // transition, so it is the single source for this capability rather
    // than splitting it across two possibly-inconsistent affordances.
  };
}

// ==========================================
// Benefits-realization preview — SELF-CONTAINED (no lazy calculation-run
// fetch needed: `GET /org/benefits-realization` already returns its two
// honest-missing amounts + the derived percentage directly, unlike the "All
// cases" tab's NPV/IRR which live on a per-case calculation run).
// ==========================================

export function buildRoiBenefitsRealizationPreview(
  row: RoiBenefitsRealizationRowVm,
  isPolish: boolean,
  onClose: () => void
): StandardPreviewProps {
  return {
    title: row.title,
    onClose,
    meta: {
      pills: [
        { label: roiStatusLabel(row.status, isPolish), tone: ROI_STATUS_TONE[row.status] },
        { label: isPolish ? 'Perspektywa organizacji' : 'Org perspective', tone: 'neutral' },
      ],
      recommendation: isPolish
        ? 'Zakres z perspektywy managera (łańcuch zarządzania) — sprawy aktywne w śledzeniu realizacji.'
        : "Scoped to the manager's chain — cases actively in tracking/realization.",
    },
    details: {
      showWordCount: false,
      properties: [
        { id: 'initiative', label: isPolish ? 'Inicjatywa' : 'Initiative', value: row.initiativeId, mono: true },
        {
          id: 'approved',
          label: isPolish ? 'Zaakceptowane korzyści' : 'Approved benefits',
          value: <HonestValueCell value={row.approvedFinancialBenefits} format={(v) => formatRoiNumber(v, isPolish)} />,
        },
        {
          id: 'actual',
          label: isPolish ? 'Rzeczywiste korzyści' : 'Actual benefits',
          value: <HonestValueCell value={row.actualFinancialBenefits} format={(v) => formatRoiNumber(v, isPolish)} />,
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
      ],
    },
    ai: {
      hints: isPolish ? ['Podsumuj realizację'] : ['Summarize realization'],
      disabled: true,
      disabledTooltip: isPolish ? 'Wkrótce' : 'Coming soon',
    },
    relations: [],
  };
}

/**
 * /results/kpi — RN-G2 P1 KPI registry (real data, behind `kpiRegistry` flag,
 * default OFF). See docs/product/results-vnext/RN_G2_UI_SCOPE.md §G item 5
 * ("KPI registry list + preview") — this replaces the P0
 * `ResultsVNextRegistryRouteBase` placeholder for the KPI domain only; ROI
 * and OKR still render that generic empty shell until their own packages.
 *
 * Composes `ResultsVNextRegistryShell` (P0) with real
 * `GET /api/vnext/results/kpi*` data (`./kpiApi.ts`). Every state is wired to
 * real API behaviour — see the four state-management effects below (list
 * fetch, deep-link resolve, lazy measurement fetch, lifecycle mutations) —
 * none of it is mocked or hand-waved; the ONLY mock data anywhere is in the
 * dev-render harness screen, which stubs `Api.get`/`Api.post`, never this
 * component's logic.
 *
 * -- HONEST-DATA CAVEAT (see kpiApi.ts header for the full backend-gap
 * writeup): `GET /kpi` returns `KpiDefinition` rows only — no KPI *name*, no
 * target/current-value fields (those live on `rvn_kpi_definition_versions`,
 * which has no GET endpoint anywhere in this backend surface today). This
 * page therefore displays `kpiCode` as the row identity (never a fabricated
 * "name"), and shows the KPI's *latest measurement* value (lazily fetched
 * only for the selected row, honest `null` when none was ever recorded) in
 * the preview pane instead of a table column — putting it in the table would
 * mean either an N+1 fetch per visible row or a fabricated placeholder,
 * neither acceptable per this program's honest-missing-value invariant.
 *
 * -- LOCKED/lifecycle treatment is derived from the KPI-level `status` only
 * (draft/pending_approval/active/suspended/archived) — NOT from the current
 * definition version's own `approvalStatus` (draft/submitted/approved/
 * rejected), because that field is one of the fields this backend gap makes
 * unreachable from any GET endpoint. `archived` is always locked (terminal);
 * `draft`/`pending_approval` show a locked "Activate" (server enforces
 * `NO_APPROVED_VERSION` — `activateKpi`'s own file-header doc comment in
 * `kpi.routes.ts`) rather than guessing whether editing is currently valid.
 *
 * -- Deep link (§D "forbidden" state): `?kpiId=<id>` pre-selects/validates a
 * specific record. The backend collapses "does not exist" and "visibility
 * denied" into the SAME 404 (see kpiApi.ts) — there is no way to show the
 * true ABAC deny reason for KPI today, so this page always renders
 * `NO_VISIBILITY_RECORD` (RN_G1_PLATFORM_DESIGN.md §B's own documented
 * fail-closed default) rather than inventing a reason the API never told it.
 *
 * -- RN-G2 P1 #8 (2026-08-10) — "Scorecards" is a THIRD Menu 2 pill added
 * alongside the pre-existing "My"/"Org" pair (task: "Lista kart wyników —
 * jako NOWA zakładka Menu 2 na istniejącym ekranie /results/kpi"). Unlike
 * My/Org (which filter the SAME KPI-definition table by owner scope), the
 * Scorecards pill swaps the entire table+preview to a DIFFERENT registry
 * (`GET /kpi/scorecards`, `./kpiScorecards/kpiScorecardApi.ts`) — same
 * "Menu 2 tab = different registry" pattern `../roi/ResultsRoiHub.tsx`
 * already establishes for "All cases"/"Benefits realization". See
 * `./kpiScorecards/kpiScorecardPresenters.tsx` for the columns/rowMenu/
 * preview builders and `./kpiScorecards/ResultsKpiScorecardDetailPage.tsx`
 * for the `/results/kpi/scorecards/:scorecardId` full-record route this tab
 * links into ("Otwórz kartę"/"Otwórz pełną kartę").
 *
 * -- RN-G5 (2026-08-12) — "Nowy KPI" quick-create (`KpiDraftFormModal.tsx`,
 * `mode="create"`) plus the rest of the gold flow (`RN-E2E-KPI-001` §6):
 * edit draft -> submit -> approve/reject (`KpiTransitionDialog.tsx`). Before
 * this package NOTHING in this tree called `createKpiDraft`/`submitKpi*`/
 * `approve/rejectDefinitionVersion` — it was impossible to create a KPI
 * through the UI at all (verified by grep, see `kpiApi.ts`'s RN-G5 note).
 *
 * `knownVersions` below is the load-bearing piece: `kpiApi.ts`'s RN-G5 note
 * explains WHY it exists — there is no GET anywhere that returns a
 * `rvn_kpi_definition_versions` row, so the version's own `rowVersion` (the
 * CAS `expectedVersion` every one of the five write commands requires) is
 * only ever knowable from THIS client's own prior write response for that
 * exact version. `knownVersions` caches that response, in memory, for the
 * lifetime of this page — populated ONLY by create/edit/submit/approve/
 * reject's own return values, NEVER guessed or defaulted. Edit/Submit/
 * Approve/Reject are offered (row menu + preview) ONLY when a KPI's version
 * is in this map; otherwise they render LOCKED with an honest reason
 * (TRIADA §C3 "visible, disabled, with a reason" — same discipline
 * `noApprovedVersionReason` below already applies to Activate) rather than
 * silently 409ing against a guessed `expectedVersion`. This is a real
 * backend-gap consequence, not a UI shortcut — a future GET endpoint
 * returning the version (out of this package's allowlist:
 * `server/src/services/resultsVnext/**`/`server/src/routes/resultsVnext/**`)
 * would let any KPI's version-level actions unlock regardless of session
 * history.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { EmptyState } from '@/components/shared/states';
import {
  type StandardCounterChip,
  type StandardPreviewProps,
  type StandardRowMenu,
  type TableColumn,
} from '@/components/standard';
import { StatusChip, type StatusTone } from '@/components/ui/primitives';
import { useAppStore } from '@/store/useAppStore';
import { ROUTES } from '@/routes/routeConfig';
import { Blocks, Plus } from 'lucide-react';

import { HonestValueCell } from './HonestValue';
import {
  activateKpi,
  approveKpiDefinitionVersion,
  archiveKpi,
  createKpiDraft,
  editKpiDraft,
  isConflictError,
  isSelfApprovalDeniedError,
  type KpiDefinitionDto,
  type KpiDefinitionVersionDto,
  type KpiMeasurementDto,
  KPI_STATUSES,
  type KpiStatus,
  listKpiMeasurements,
  listKpis,
  getKpi,
  newKpiIdempotencyKey,
  rejectKpiDefinitionVersion,
  submitKpiDefinition,
  suspendKpi,
} from './kpiApi';
import { KpiDraftFormModal, type KpiDraftFormValues } from './KpiDraftFormModal';
import { KpiTransitionDialog, type KpiTransitionKind } from './KpiTransitionDialog';
import { LifecycleLockBadge, lockedRowMenuAction } from './LifecycleLockBadge';
import { isResultsVNextFlagEnabled } from './resultsVNextFeatureFlags';
import type { ResultsVNextForbiddenDetail } from './types';
import { ResultsVNextRegistryShell, type ResultsVNextTableProps } from './ResultsVNextRegistryShell';
import {
  activateKpiScorecard,
  archiveKpiScorecard,
  listKpiScorecards,
  suspendKpiScorecard,
  type KpiScorecardDto,
} from './kpiScorecards/kpiScorecardApi';
import {
  buildKpiScorecardColumns,
  buildKpiScorecardPreview,
  buildKpiScorecardRowMenu,
} from './kpiScorecards/kpiScorecardPresenters';
import { ResultsKpiMeasurementsPanel } from './kpiMeasurements/ResultsKpiMeasurementsPanel';
import { toUserFacingErrorMessage } from './shared/errorMessage';

const STATUS_TONE: Record<KpiStatus, StatusTone> = {
  draft: 'info',
  pending_approval: 'warning',
  active: 'success',
  suspended: 'warning',
  archived: 'neutral',
};

const STATUS_LABEL: Record<KpiStatus, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  pending_approval: { pl: 'Do zatwierdzenia', en: 'Pending approval' },
  active: { pl: 'Aktywny', en: 'Active' },
  suspended: { pl: 'Zawieszony', en: 'Suspended' },
  archived: { pl: 'Zarchiwizowany', en: 'Archived' },
};

function statusLabel(status: KpiStatus, isPolish: boolean): string {
  return isPolish ? STATUS_LABEL[status].pl : STATUS_LABEL[status].en;
}

function formatDate(iso: string | null | undefined, isPolish: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function shortId(id: string | null): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function ownerDisplay(
  ownerUserId: string | null,
  currentUserId: string | null | undefined,
  isPolish: boolean
): string {
  if (!ownerUserId) return '—';
  if (currentUserId && ownerUserId === currentUserId) return isPolish ? 'Ty' : 'You';
  return shortId(ownerUserId);
}

type PendingAction = { kpiId: string; action: 'activate' | 'suspend' | 'archive' } | null;
type DefPendingAction = { kpiId: string; kind: 'submit' | 'approve' | 'reject' } | null;

/** RN-G5 — shared by `buildRowMenu`'s and `buildPreview`'s own (differently-
 * shaped) context objects, so `buildDefinitionActions` below works for both
 * without either function's ctx type needing to match the other 1:1. */
interface DefinitionActionsContext {
  isPolish: boolean;
  /** RN-G5 — see file header "knownVersions" note. */
  knownVersions: Record<string, KpiDefinitionVersionDto>;
  defPending: DefPendingAction;
  onEditDraft: (row: KpiDefinitionDto) => void;
  onSubmitDefinition: (row: KpiDefinitionDto) => void;
  onApproveDefinition: (row: KpiDefinitionDto) => void;
  onRejectDefinition: (row: KpiDefinitionDto) => void;
}

interface RowMenuContext extends DefinitionActionsContext {
  pending: PendingAction;
  onOpen: (kpiId: string) => void;
  onOpenTool: (kpiId: string) => void;
  onOpenMeasurements: (row: KpiDefinitionDto) => void;
  onActivate: (row: KpiDefinitionDto) => void;
  onSuspend: (row: KpiDefinitionDto) => void;
  onArchive: (row: KpiDefinitionDto) => void;
}

/** RN-G5 — the honest lock reason shown when a KPI's definition version was
 * never created/mutated by THIS browser tab (see file header "knownVersions"
 * note) — used by both the row menu (as a `note`) and the preview pane. */
function noKnownVersionReason(isPolish: boolean): string {
  return isPolish
    ? 'Brak danych wersji definicji w tej sesji — żaden GET nie zwraca wersji (luka backendu). Dostępne tylko tam, gdzie szkic był tworzony/edytowany w tej karcie.'
    : 'No definition-version data in this session — no GET returns the version (backend gap). Only available where the draft was created/edited in this tab.';
}

const REJECTED_NO_AMEND_REASON = {
  pl: 'Wersja odrzucona — utworzenie nowej (poprawionej) wersji nie jest jeszcze zaimplementowane po stronie backendu.',
  en: 'Version rejected — creating a new (amended) version is not implemented on the backend yet.',
};

/** RN-G5 — the definition-lifecycle entries (edit/submit/approve/reject),
 * shared by `buildRowMenu` and `buildPreview` so both surfaces apply the
 * exact same gating (see file header "knownVersions" note). Only meaningful
 * while the KPI root is `draft`/`pending_approval` — `active`/`suspended`/
 * `archived` KPIs have no in-flight definition version to act on (amendment
 * flows are out of scope, see `kpiDefinitionCommands.ts`'s own comments on
 * `activateKpi`'s `fromStatuses`). */
function buildDefinitionActions(
  row: KpiDefinitionDto,
  ctx: DefinitionActionsContext
): { id: string; label: string; onClick: () => void; disabled?: boolean; note?: string; kind: 'edit' | 'submit' | 'approve' | 'reject' }[] {
  const t = (pl: string, en: string) => (ctx.isPolish ? pl : en);
  if (row.status !== 'draft' && row.status !== 'pending_approval') return [];
  const known = ctx.knownVersions[row.kpiId] ?? null;
  const isBusy = ctx.defPending?.kpiId === row.kpiId;
  const reasonUnknown = noKnownVersionReason(ctx.isPolish);
  const out: ReturnType<typeof buildDefinitionActions> = [];

  if (row.status === 'draft') {
    if (known && known.approvalStatus === 'rejected') {
      const reason = t(REJECTED_NO_AMEND_REASON.pl, REJECTED_NO_AMEND_REASON.en);
      out.push({ id: 'edit-draft', label: t('Edytuj szkic', 'Edit draft'), onClick: () => {}, disabled: true, note: reason, kind: 'edit' });
      return out;
    }
    out.push({
      id: 'edit-draft',
      label: t('Edytuj szkic', 'Edit draft'),
      onClick: () => ctx.onEditDraft(row),
      disabled: !known || isBusy,
      note: known ? undefined : reasonUnknown,
      kind: 'edit',
    });
    out.push({
      id: 'submit-definition',
      label: t('Zgłoś do zatwierdzenia', 'Submit for approval'),
      onClick: () => ctx.onSubmitDefinition(row),
      disabled: !known || isBusy,
      note: known ? undefined : reasonUnknown,
      kind: 'submit',
    });
  } else {
    // pending_approval — BUG FOUND during the RN-G5 screenshot walkthrough
    // (screenshot 16: after a successful approve, the KPI root stays
    // "pending_approval" — approveDefinitionVersion never touches root
    // status, only activateKpi does, see this file's own header note — so
    // gating on row.status alone left Approve/Reject clickable a SECOND
    // time post-approval, which the server would then 409 NOT_SUBMITTED).
    // Must also check known.approvalStatus === 'submitted', mirroring the
    // 'draft' branch's own known.approvalStatus check above.
    if (known && known.approvalStatus !== 'submitted') {
      const alreadyDecidedReason =
        known.approvalStatus === 'approved'
          ? t(
              'Wersja już zatwierdzona — aktywuj KPI z menu statusu, aby zacząć pomiary.',
              'Version already approved — activate the KPI from the status menu to start measuring.'
            )
          : t(
              'Wersja już odrzucona.',
              'Version already rejected.'
            );
      out.push({ id: 'approve-definition', label: t('Zatwierdź', 'Approve'), onClick: () => {}, disabled: true, note: alreadyDecidedReason, kind: 'approve' });
      out.push({ id: 'reject-definition', label: t('Odrzuć', 'Reject'), onClick: () => {}, disabled: true, note: alreadyDecidedReason, kind: 'reject' });
      return out;
    }
    out.push({
      id: 'approve-definition',
      label: t('Zatwierdź', 'Approve'),
      onClick: () => ctx.onApproveDefinition(row),
      disabled: !known || isBusy,
      note: known ? undefined : reasonUnknown,
      kind: 'approve',
    });
    out.push({
      id: 'reject-definition',
      label: t('Odrzuć', 'Reject'),
      onClick: () => ctx.onRejectDefinition(row),
      disabled: !known || isBusy,
      note: known ? undefined : reasonUnknown,
      kind: 'reject',
    });
  }
  return out;
}

function buildColumns(isPolish: boolean, currentUserId: string | null | undefined): TableColumn[] {
  return [
    {
      id: 'kpiCode',
      label: isPolish ? 'Kod KPI' : 'KPI code',
      width: '260px',
      render: (row: KpiDefinitionDto) => (
        <span className="text-sm font-medium text-c-text" title={row.kpiId}>
          {row.kpiCode}
        </span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: '170px',
      filterable: true,
      filterOptions: KPI_STATUSES.map((s) => ({ value: s, label: statusLabel(s, isPolish) })),
      render: (row: KpiDefinitionDto) => (
        <StatusChip label={statusLabel(row.status, isPolish)} tone={STATUS_TONE[row.status]} />
      ),
    },
    {
      id: 'owner',
      label: isPolish ? 'Właściciel' : 'Owner',
      width: '150px',
      render: (row: KpiDefinitionDto) => (
        <span className="text-sm text-c-text-secondary">
          {ownerDisplay(row.ownerUserId, currentUserId, isPolish)}
        </span>
      ),
    },
    {
      id: 'primaryProcessId',
      label: isPolish ? 'Proces' : 'Process',
      width: '140px',
      render: (row: KpiDefinitionDto) => (
        <span className="text-sm text-c-text-muted">{shortId(row.primaryProcessId)}</span>
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '150px',
      sortable: true,
      render: (row: KpiDefinitionDto) => (
        <span className="text-sm text-c-text-muted">{formatDate(row.updatedAt, isPolish)}</span>
      ),
    },
  ];
}

function buildRowMenu(row: KpiDefinitionDto, ctx: RowMenuContext): StandardRowMenu {
  const t = (pl: string, en: string) => (ctx.isPolish ? pl : en);
  const isBusy = ctx.pending?.kpiId === row.kpiId;
  const isArchived = row.status === 'archived';

  const archivedReason = t(
    'KPI zarchiwizowane — stan końcowy, tylko odczyt.',
    'KPI archived — terminal state, read-only.'
  );
  const noApprovedVersionReason = t(
    'Aktywacja wymaga zatwierdzonej wersji definicji KPI (brak GET dla wersji — sprawdzane przez serwer przy próbie).',
    'Activation requires an approved KPI definition version (checked server-side — no GET exists for the version to verify this client-side).'
  );

  let statusTransitions: StandardRowMenu['statusTransitions'];
  if (row.status === 'active') {
    statusTransitions = [
      { id: 'suspend', label: t('Zawieś', 'Suspend'), onClick: () => ctx.onSuspend(row), disabled: isBusy },
    ];
  } else if (row.status === 'suspended') {
    statusTransitions = [
      { id: 'activate', label: t('Aktywuj', 'Activate'), onClick: () => ctx.onActivate(row), disabled: isBusy },
    ];
  } else if (row.status === 'draft' || row.status === 'pending_approval') {
    statusTransitions = [
      lockedRowMenuAction({ id: 'activate', label: t('Aktywuj', 'Activate') }, noApprovedVersionReason),
    ];
  } else {
    // archived — terminal, single locked entry so the action stays visible
    // with a reason rather than disappearing (TRIADA §C3).
    statusTransitions = [
      lockedRowMenuAction({ id: 'activate', label: t('Aktywuj', 'Activate') }, archivedReason),
    ];
  }

  const defActions = buildDefinitionActions(row, ctx).map((a) =>
    a.disabled
      ? lockedRowMenuAction({ id: a.id, label: a.label }, a.note ?? '')
      : { id: a.id, label: a.label, onClick: a.onClick }
  );

  return {
    primary: [
      { id: 'open', label: t('Otwórz', 'Open'), onClick: () => ctx.onOpen(row.kpiId) },
      // RN-G3 lane (2026-08-11) — full KPI tool (klasa L, D03), same
      // "kebab navigates directly" convention `buildKpiScorecardRowMenu`
      // already established (`onOpenDetail` -> `/results/kpi/scorecards/:id`).
      { id: 'open-tool', label: t('Otwórz pełne narzędzie', 'Open full tool'), onClick: () => ctx.onOpenTool(row.kpiId) },
      // RN-G2 §G #7 — sub-view entry point (see ResultsKpiMeasurementsPanel.tsx
      // header for the "why here, not a new tab/route" placement decision).
      { id: 'measurements', label: t('Pomiary', 'Measurements'), onClick: () => ctx.onOpenMeasurements(row) },
      // RN-G5 — definition-lifecycle entries (edit/submit/approve/reject),
      // gated by `buildDefinitionActions` (see its own doc comment).
      ...defActions,
    ],
    statusTransitions,
    universalHandlers: isArchived
      ? { preview: () => ctx.onOpen(row.kpiId), archiveNote: archivedReason }
      : {
          preview: () => ctx.onOpen(row.kpiId),
          archive: () => ctx.onArchive(row),
        },
    // No delete endpoint exists anywhere in kpi.routes.ts — never fabricate one.
    destructive: undefined,
  };
}

function buildPreview(
  row: KpiDefinitionDto,
  ctx: {
    isPolish: boolean;
    currentUserId: string | null | undefined;
    measurement: KpiMeasurementDto | null | 'loading';
    pending: PendingAction;
    knownVersions: Record<string, KpiDefinitionVersionDto>;
    defPending: DefPendingAction;
    onClose: () => void;
    onOpenFull: () => void;
    onOpenMeasurements: (row: KpiDefinitionDto) => void;
    onActivate: (row: KpiDefinitionDto) => void;
    onSuspend: (row: KpiDefinitionDto) => void;
    onArchive: (row: KpiDefinitionDto) => void;
    onEditDraft: (row: KpiDefinitionDto) => void;
    onSubmitDefinition: (row: KpiDefinitionDto) => void;
    onApproveDefinition: (row: KpiDefinitionDto) => void;
    onRejectDefinition: (row: KpiDefinitionDto) => void;
  }
): StandardPreviewProps {
  const t = (pl: string, en: string) => (ctx.isPolish ? pl : en);
  const isBusy = ctx.pending?.kpiId === row.kpiId;
  const isLoadingMeasurement = ctx.measurement === 'loading';
  // Direct narrowing on `ctx.measurement` (not the `isLoadingMeasurement`
  // alias) — TS's aliased-condition narrowing does not reliably cover a
  // property access reused across two separate `const` declarations.
  const measurement: KpiMeasurementDto | null =
    ctx.measurement === 'loading' ? null : ctx.measurement;
  const lang = ctx.isPolish ? 'pl-PL' : 'en-US';

  // RN-G5 — see `buildDefinitionActions`'s own doc comment for gating rules.
  const defActions = buildDefinitionActions(row, ctx);
  // `StandardPreviewAction` has no note/tooltip field (unlike the row menu's
  // `note`) and its own contract caps labels at 22 chars
  // (`previewContract.ts` `PREVIEW_ACTION_LABEL_TOO_LONG`) — appending a
  // "— locked" suffix broke that contract for the longer labels. Preview
  // relies on `disabled` alone here (same as the pre-existing archived-KPI
  // "Zablokowane" entry above); the row menu's `note` is where the actual
  // reason text lives.
  const defResolutions = defActions
    .filter((a) => a.kind === 'approve' || a.kind === 'reject')
    .map((a) => ({
      id: a.id,
      variant: (a.kind === 'approve' ? 'positive' : 'destructive') as 'positive' | 'destructive',
      label: a.label,
      onClick: a.onClick,
      disabled: a.disabled,
    }));
  const defInformational = defActions
    .filter((a) => a.kind === 'edit' || a.kind === 'submit')
    .map((a) => ({
      id: a.id,
      variant: 'neutral' as const,
      label: a.label,
      onClick: a.onClick,
      disabled: a.disabled,
    }));

  const lockBadge =
    row.status === 'archived' ? (
      <LifecycleLockBadge
        label={t('Zarchiwizowany', 'Archived')}
        reason={t(
          'KPI zarchiwizowane — stan końcowy, tylko odczyt.',
          'KPI archived — terminal state, read-only.'
        )}
      />
    ) : row.status === 'suspended' ? (
      <LifecycleLockBadge
        label={t('Zawieszony', 'Suspended')}
        reason={t(
          'KPI zawieszone — pomiary wstrzymane do wznowienia (Aktywuj).',
          'KPI suspended — measurements paused until resumed (Activate).'
        )}
      />
    ) : undefined;

  return {
    title: row.kpiCode,
    onClose: ctx.onClose,
    // RN-G3 lane (2026-08-11) — StandardPreview's own "Open" header action
    // (StandardPreview.tsx L145 `onOpenFull`) now navigates to the real full
    // KPI tool (`/results/kpi/:kpiId`, klasa L, D03) instead of doing nothing.
    onOpenFull: ctx.onOpenFull,
    headerExtra: lockBadge,
    meta: {
      pills: [{ label: statusLabel(row.status, ctx.isPolish), tone: STATUS_TONE[row.status] }],
      trailing: (
        <span className="text-[11px] font-semibold text-c-text-secondary">
          {formatDate(row.updatedAt, ctx.isPolish)}
        </span>
      ),
    },
    details: {
      properties: [
        {
          id: 'owner',
          label: t('Właściciel', 'Owner'),
          value: ownerDisplay(row.ownerUserId, ctx.currentUserId, ctx.isPolish),
        },
        { id: 'process', label: t('Proces', 'Process'), value: shortId(row.primaryProcessId) },
        { id: 'created', label: t('Utworzono', 'Created'), value: formatDate(row.createdAt, ctx.isPolish) },
        {
          id: 'measurement',
          label: t('Ostatni pomiar', 'Latest measurement'),
          value: isLoadingMeasurement ? (
            <span className="text-c-text-muted">{t('Ładowanie…', 'Loading…')}</span>
          ) : (
            <HonestValueCell
              value={measurement ? measurement.actualValue : null}
              format={(v) => <span className="tabular-nums font-medium text-c-text">{v.toLocaleString(lang)}</span>}
            />
          ),
        },
        {
          id: 'period',
          label: t('Okres pomiaru', 'Measurement period'),
          value: measurement
            ? `${formatDate(measurement.periodStart, ctx.isPolish)} – ${formatDate(measurement.periodEnd, ctx.isPolish)}`
            : '—',
        },
      ],
    },
    ai: {
      hints: [],
      disabled: true,
      disabledTooltip: t('Wkrótce', 'Coming soon'),
    },
    relations: [],
    // RN-G5 — definition-lifecycle actions (edit/submit -> informational,
    // approve/reject -> resolutions, mirroring StandardPreviewActions' own
    // "resolutions = decisions, informational = everything else" split),
    // same `buildDefinitionActions` gating `buildRowMenu` uses.
    actions:
      row.status === 'archived'
        ? {
            informational: [
              // RN-G2 §G #7 — always reachable, even for an archived KPI:
              // verified in `kpi.routes.ts` that NONE of
              // recordMeasurement/correctMeasurement/verifyMeasurement/
              // disputeMeasurement check `kpi.status` — only
              // `currentDefinitionVersionId` presence (for recording) and the
              // measurement's own existence. Never inventing a lock this
              // package's own reading of the server found no evidence for.
              {
                id: 'measurements',
                variant: 'neutral',
                label: t('Otwórz pomiary', 'Open measurements'),
                onClick: () => ctx.onOpenMeasurements(row),
              },
              {
                id: 'locked',
                variant: 'neutral',
                label: t('Zablokowane', 'Locked'),
                onClick: () => {},
                disabled: true,
              },
            ],
          }
        : {
            resolutions:
              row.status === 'suspended'
                ? [
                    {
                      id: 'activate',
                      variant: 'positive',
                      label: t('Aktywuj', 'Activate'),
                      onClick: () => ctx.onActivate(row),
                      disabled: isBusy,
                    },
                  ]
                : row.status === 'active'
                  ? [
                      {
                        id: 'suspend',
                        variant: 'neutral',
                        label: t('Zawieś', 'Suspend'),
                        onClick: () => ctx.onSuspend(row),
                        disabled: isBusy,
                      },
                    ]
                  // draft / pending_approval — RN-G5 approve/reject.
                  : defResolutions,
            informational: [
              {
                id: 'measurements',
                variant: 'neutral',
                label: t('Otwórz pomiary', 'Open measurements'),
                onClick: () => ctx.onOpenMeasurements(row),
              },
              // RN-G5 — draft / pending_approval edit/submit entries.
              ...defInformational,
              {
                id: 'archive',
                variant: 'neutral',
                label: t('Archiwizuj', 'Archive'),
                onClick: () => ctx.onArchive(row),
                disabled: isBusy,
              },
            ],
          },
  };
}

export const ResultsKpiRegistryPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const currentUser = useAppStore((s) => s.currentUser);
  const enabled = isResultsVNextFlagEnabled('kpiRegistry');

  const navigate = useNavigate();
  const [rows, setRows] = useState<KpiDefinitionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // RN-G2 P1 #8 — third value 'scorecards' added alongside the pre-existing
  // 'my'/'org' pair (see file header). `scope` below stays scoped to ONLY
  // the my/org KPI-filtering meaning it always had — renamed nowhere, kept
  // separate from `tab` so the scorecards branch never touches KPI-scope
  // logic.
  const [tab, setTab] = useState<'my' | 'org' | 'scorecards'>('my');
  const scope: 'my' | 'org' = tab === 'org' ? 'org' : 'my';
  const [statusFilter, setStatusFilter] = useState<KpiStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState<KpiMeasurementDto | null | 'loading'>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [forbidden, setForbidden] = useState<ResultsVNextForbiddenDetail | null>(null);

  // RN-G5 — see file header "knownVersions" note: the ONLY source of a
  // KPI's definition-version `rowVersion` (CAS `expectedVersion`), keyed by
  // `kpiId`, populated exclusively from create/edit/submit/approve/reject's
  // own responses.
  const [knownVersions, setKnownVersions] = useState<Record<string, KpiDefinitionVersionDto>>({});

  // Create/edit draft form modal — one shared modal, `formMode` picks
  // create vs. edit and `formTargetKpi` carries which row is being edited
  // (`null` in create mode).
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formTargetKpi, setFormTargetKpi] = useState<KpiDefinitionDto | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formIsConflict, setFormIsConflict] = useState(false);
  const [formIdempotencyKey, setFormIdempotencyKey] = useState('');

  // Submit/approve/reject reason dialog — one shared dialog, keyed by
  // {row, kind}, same convention `RoiTransitionDialog`/`transition` uses in
  // `ResultsRoiHub.tsx`.
  const [transition, setTransition] = useState<{ row: KpiDefinitionDto; kind: KpiTransitionKind } | null>(null);
  const [defPending, setDefPending] = useState<DefPendingAction>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitionIsConflict, setTransitionIsConflict] = useState(false);
  const [transitionIsSelfApprovalDenied, setTransitionIsSelfApprovalDenied] = useState(false);
  const [transitionIdempotencyKey, setTransitionIdempotencyKey] = useState('');

  // RN-G2 P1 #8 — Scorecards tab state (own fetch, own selection, own
  // pending-action tracking; entirely separate from the KPI-definition
  // rows/selection above — no shared identity between a `KpiDefinitionDto`
  // and a `KpiScorecardDto`).
  const [scorecardRows, setScorecardRows] = useState<KpiScorecardDto[]>([]);
  const [scorecardsLoading, setScorecardsLoading] = useState(false);
  const [scorecardsError, setScorecardsError] = useState<string | null>(null);
  const [selectedScorecardId, setSelectedScorecardId] = useState<string | null>(null);
  const [scorecardPending, setScorecardPending] = useState(false);

  // RN-G2 §G #7 — "Pomiary" sub-view of a selected KPI (see
  // ResultsKpiMeasurementsPanel.tsx header for the "why a sub-view, not a
  // tab/route" placement decision). Holds the full row (not just an id) so
  // the panel has `kpiCode`/`currentDefinitionVersionId` without a second
  // fetch — entered from either the row menu or the preview pane, on the
  // 'my'/'org' branch only (Scorecards rows are a different DTO entirely).
  const [measurementsKpi, setMeasurementsKpi] = useState<KpiDefinitionDto | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listKpis({});
      setRows(items);
    } catch (err) {
      setError(toUserFacingErrorMessage(err, isPolish));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void fetchRows();
  }, [enabled, fetchRows]);

  // Deep link (§D "forbidden") — ?kpiId=<id> pre-selects/validates a record.
  useEffect(() => {
    if (!enabled) return;
    const deepLinkKpiId = new URLSearchParams(window.location.search).get('kpiId');
    if (!deepLinkKpiId) return;
    let cancelled = false;
    (async () => {
      try {
        const kpi = await getKpi(deepLinkKpiId);
        if (cancelled) return;
        if (!kpi) {
          setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
        } else {
          setSelectedId(kpi.kpiId);
        }
      } catch {
        if (!cancelled) setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Lazy per-selection measurement fetch (§B "lazy detail fetch for the
  // properties table" — never fetched for the whole visible page of rows).
  useEffect(() => {
    if (!selectedId) {
      setMeasurement(null);
      return;
    }
    let cancelled = false;
    setMeasurement('loading');
    listKpiMeasurements(selectedId, { limit: 1 })
      .then((list) => {
        if (!cancelled) setMeasurement(list[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setMeasurement(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const runLifecycleAction = useCallback(
    async (row: KpiDefinitionDto, action: 'activate' | 'suspend' | 'archive') => {
      setPending({ kpiId: row.kpiId, action });
      try {
        const runner = action === 'activate' ? activateKpi : action === 'suspend' ? suspendKpi : archiveKpi;
        await runner({ kpiId: row.kpiId, expectedVersion: row.rowVersion });
        await fetchRows();
      } catch (err) {
        const message = toUserFacingErrorMessage(err, isPolish);
        toast.error(message);
      } finally {
        setPending(null);
      }
    },
    [fetchRows]
  );

  // ==========================================
  // RN-G5 — create / edit draft / submit / approve / reject
  // ==========================================

  const openCreateForm = useCallback(() => {
    setFormMode('create');
    setFormTargetKpi(null);
    setFormError(null);
    setFormIsConflict(false);
    // Fresh idempotency key per OPEN, not per submit — same convention as
    // `RoiCaseCreateModal`'s `newRoiIdempotencyKey` usage: a retry within
    // the same open reuses it, so a double-send can never create two KPIs.
    setFormIdempotencyKey(newKpiIdempotencyKey());
    setFormOpen(true);
  }, []);

  const openEditForm = useCallback((row: KpiDefinitionDto) => {
    setFormMode('edit');
    setFormTargetKpi(row);
    setFormError(null);
    setFormIsConflict(false);
    setFormIdempotencyKey(newKpiIdempotencyKey());
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    (values: KpiDraftFormValues) => {
      setFormBusy(true);
      setFormError(null);
      setFormIsConflict(false);
      if (formMode === 'create') {
        createKpiDraft({ ...values, idempotencyKey: formIdempotencyKey })
          .then(({ kpi, definitionVersion }) => {
            setKnownVersions((prev) => ({ ...prev, [kpi.kpiId]: definitionVersion }));
            setRows((prev) => [kpi, ...prev.filter((r) => r.kpiId !== kpi.kpiId)]);
            setSelectedId(kpi.kpiId);
            setStatusFilter(null); // ensure the new row is visible regardless of prior filter
            setFormOpen(false);
          })
          .catch((err) => {
            setFormIsConflict(isConflictError(err));
            setFormError(toUserFacingErrorMessage(err, isPolish));
          })
          .finally(() => setFormBusy(false));
        return;
      }
      // edit — requires a known version (the row menu/preview only ever
      // reach here when one exists, see `buildDefinitionActions`).
      const kpiId = formTargetKpi?.kpiId;
      const known = kpiId ? knownVersions[kpiId] : undefined;
      if (!kpiId || !known) {
        setFormError(
          isPolish
            ? 'Brak znanej wersji definicji — nie można bezpiecznie wysłać CAS.'
            : 'No known definition version — cannot safely send a CAS write.'
        );
        setFormBusy(false);
        return;
      }
      editKpiDraft(kpiId, { ...values, expectedVersion: known.rowVersion, idempotencyKey: formIdempotencyKey })
        .then((definitionVersion) => {
          setKnownVersions((prev) => ({ ...prev, [kpiId]: definitionVersion }));
          setFormOpen(false);
        })
        .catch((err) => {
          setFormIsConflict(isConflictError(err));
          setFormError(toUserFacingErrorMessage(err, isPolish));
        })
        .finally(() => setFormBusy(false));
    },
    [formMode, formIdempotencyKey, formTargetKpi, knownVersions, isPolish]
  );

  const openTransition = useCallback((row: KpiDefinitionDto, kind: KpiTransitionKind) => {
    setTransitionError(null);
    setTransitionIsConflict(false);
    setTransitionIsSelfApprovalDenied(false);
    setTransitionIdempotencyKey(newKpiIdempotencyKey());
    setTransition({ row, kind });
  }, []);

  const handleTransitionSubmit = useCallback(
    (reason: string | null) => {
      if (!transition) return;
      const { row, kind } = transition;
      const known = knownVersions[row.kpiId];
      if (!known) {
        setTransitionError(
          isPolish
            ? 'Brak znanej wersji definicji — nie można bezpiecznie wysłać CAS.'
            : 'No known definition version — cannot safely send a CAS write.'
        );
        return;
      }
      setDefPending({ kpiId: row.kpiId, kind });
      setTransitionError(null);
      setTransitionIsConflict(false);
      setTransitionIsSelfApprovalDenied(false);

      const applyResult = (definitionVersion: KpiDefinitionVersionDto) => {
        setKnownVersions((prev) => ({ ...prev, [row.kpiId]: definitionVersion }));
        setTransition(null);
        void fetchRows(); // KPI-root status (draft <-> pending_approval) may have changed.
      };
      const handleError = (err: unknown) => {
        setTransitionIsConflict(isConflictError(err));
        setTransitionIsSelfApprovalDenied(isSelfApprovalDeniedError(err));
        setTransitionError(toUserFacingErrorMessage(err, isPolish));
      };

      let call: Promise<KpiDefinitionVersionDto>;
      if (kind === 'submit') {
        call = submitKpiDefinition(row.kpiId, {
          expectedVersion: known.rowVersion,
          reason,
          idempotencyKey: transitionIdempotencyKey,
        });
      } else if (kind === 'approve') {
        call = approveKpiDefinitionVersion(row.kpiId, known.definitionVersionId, {
          expectedVersion: known.rowVersion,
          reason,
          idempotencyKey: transitionIdempotencyKey,
        });
      } else {
        // reject — rejectionReason is REQUIRED; `KpiTransitionDialog` already
        // blocks submit with an empty one, so `reason` here is non-null.
        call = rejectKpiDefinitionVersion(row.kpiId, known.definitionVersionId, {
          expectedVersion: known.rowVersion,
          rejectionReason: reason ?? '',
          idempotencyKey: transitionIdempotencyKey,
        });
      }
      call
        .then(applyResult)
        .catch(handleError)
        .finally(() => setDefPending(null));
    },
    [transition, knownVersions, transitionIdempotencyKey, isPolish, fetchRows]
  );

  const fetchScorecardRows = useCallback(async () => {
    setScorecardsLoading(true);
    setScorecardsError(null);
    try {
      const items = await listKpiScorecards({});
      setScorecardRows(items);
    } catch (err) {
      setScorecardsError(toUserFacingErrorMessage(err, isPolish));
    } finally {
      setScorecardsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || tab !== 'scorecards') return;
    void fetchScorecardRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tab]);

  const runScorecardLifecycleAction = useCallback(
    async (row: KpiScorecardDto, action: 'activate' | 'suspend' | 'archive') => {
      setScorecardPending(true);
      try {
        const runner =
          action === 'activate' ? activateKpiScorecard : action === 'suspend' ? suspendKpiScorecard : archiveKpiScorecard;
        await runner({ scorecardId: row.scorecardId, expectedVersion: row.rowVersion });
        await fetchScorecardRows();
      } catch (err) {
        toast.error(toUserFacingErrorMessage(err, isPolish));
      } finally {
        setScorecardPending(false);
      }
    },
    [fetchScorecardRows]
  );

  const scopedRows = useMemo(() => {
    if (scope === 'my' && currentUser?.id) {
      return rows.filter((r) => r.ownerUserId === currentUser.id);
    }
    return rows;
  }, [rows, scope, currentUser?.id]);

  const visibleRows = useMemo(() => {
    if (!statusFilter) return scopedRows;
    return scopedRows.filter((r) => r.status === statusFilter);
  }, [scopedRows, statusFilter]);

  const chips: StandardCounterChip[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of KPI_STATUSES) counts[s] = 0;
    for (const r of scopedRows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return [
      { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: scopedRows.length },
      ...KPI_STATUSES.map((s) => ({ id: s, label: statusLabel(s, isPolish), count: counts[s] ?? 0 })),
    ];
  }, [scopedRows, isPolish]);

  const columns = useMemo(() => buildColumns(isPolish, currentUser?.id), [isPolish, currentUser?.id]);

  const selectedRow = visibleRows.find((r) => r.kpiId === selectedId) ?? null;

  // RULES-OF-HOOKS FIX (RN-G2 §G #7, 2026-08-10): this `useMemo` used to sit
  // AFTER the `!enabled`/`tab === 'scorecards'` early returns below — a real,
  // pre-existing "Rendered fewer hooks than expected" crash the moment a
  // user actually clicked the live "Karty wyników" tab inside THIS page
  // (never caught before because the Scorecards dev-render QA round used a
  // separate, non-router-wrapped reimplementation screen —
  // `results-vnext-kpi-scorecards.tsx` — that never exercised this exact
  // component's own tab switch; see that screen's own header for why it
  // doesn't mount the real page). Discovered here because the NEW
  // `measurementsKpi` early return this package adds hit the same bug from
  // a different angle (`docs/qa/screens/rn-g2-kpi-measurements-2026-08-10/`
  // — before/after crash screenshots). Every hook must run on every render
  // regardless of which branch below ultimately returns — moved above all
  // early returns, same discipline as `selectedRow`/`columns` above it.
  const tableRows = useMemo(
    () => visibleRows.map((r) => ({ ...r, id: r.kpiId }) as unknown as Record<string, unknown> & { id: string }),
    [visibleRows]
  );

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-kpi-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={isPolish ? 'Rejestr KPI — jeszcze nie włączony' : 'KPI registry — not yet enabled'}
          description={
            isPolish
              ? 'Ten rejestr jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.'
              : 'This registry is still being built. Check back later, or ask an administrator for flag access.'
          }
          compact
        />
      </div>
    );
  }

  if (measurementsKpi) {
    // RN-G2 §G #7 — see ResultsKpiMeasurementsPanel.tsx header for the
    // placement decision. Same route (`/results/kpi`), same flag, different
    // internal state branch — exactly like the `tab === 'scorecards'` branch
    // below swaps in a different registry without a URL change.
    return (
      <div className="h-full" data-testid="results-vnext-kpi-registry-page">
        <ResultsKpiMeasurementsPanel
          kpi={measurementsKpi}
          isPolish={isPolish}
          onBack={() => setMeasurementsKpi(null)}
        />
      </div>
    );
  }

  if (tab === 'scorecards') {
    // RN-G2 P1 #8 — see file header. Entirely separate table/preview wiring
    // from the KPI-definition branch below (different DTO, different
    // `persistKey` — `results-vnext.kpi-scorecards`, NEVER the legacy
    // `results.kpi-scorecards` T36 key, see kpiScorecardApi.ts/task brief).
    const scorecardTableRows = scorecardRows.map(
      (r) => ({ ...r, id: r.scorecardId }) as unknown as Record<string, unknown> & { id: string }
    );
    const selectedScorecard = scorecardRows.find((r) => r.scorecardId === selectedScorecardId) ?? null;
    const openDetail = (scorecardId: string) =>
      navigate(ROUTES.RESULTS_KPI.SCORECARD.replace(':scorecardId', scorecardId));

    return (
      <div className="h-full" data-testid="results-vnext-kpi-registry-page">
        <ResultsVNextRegistryShell
          domain="kpi"
          moduleBar={{
            tabs: [
              { id: 'my', label: isPolish ? 'Moje' : 'My' },
              { id: 'org', label: isPolish ? 'Organizacja' : 'Org' },
              { id: 'scorecards', label: isPolish ? 'Karty wyników' : 'Scorecards' },
            ],
            activeTab: tab,
            onTabChange: (id) => setTab(id === 'org' ? 'org' : id === 'scorecards' ? 'scorecards' : 'my'),
            showTabCounts: false,
            viewModes: ['table'],
            viewMode: 'table',
          }}
          table={{
            columns: buildKpiScorecardColumns(isPolish, currentUser?.id),
            data: scorecardTableRows,
            persistKey: 'results-vnext.kpi-scorecards',
            loading: scorecardsLoading,
            error: scorecardsError,
            onRetry: () => void fetchScorecardRows(),
            empty:
              !scorecardsLoading && !scorecardsError && scorecardRows.length === 0
                ? {
                    title: isPolish ? 'Brak kart wyników' : 'No scorecards yet',
                    description: isPolish
                      ? 'Utwórz pierwszą kartę wyników, aby zacząć grupować KPI.'
                      : 'Create the first scorecard to start grouping KPIs.',
                  }
                : undefined,
            selectedRowId: selectedScorecardId,
            onRowClick: (row) => setSelectedScorecardId(String(row.id)),
            rowMenu: (row) =>
              buildKpiScorecardRowMenu(row as unknown as KpiScorecardDto, {
                isPolish,
                busy: scorecardPending,
                onOpenDetail: openDetail,
                onActivate: (r) => void runScorecardLifecycleAction(r, 'activate'),
                onSuspend: (r) => void runScorecardLifecycleAction(r, 'suspend'),
                onArchive: (r) => void runScorecardLifecycleAction(r, 'archive'),
              }),
            defaultSort: { columnId: 'updatedAt', direction: 'desc' },
          }}
          preview={
            selectedScorecard
              ? buildKpiScorecardPreview(selectedScorecard, {
                  isPolish,
                  currentUserId: currentUser?.id,
                  busy: scorecardPending,
                  onOpenDetail: openDetail,
                  onActivate: (r) => void runScorecardLifecycleAction(r, 'activate'),
                  onSuspend: (r) => void runScorecardLifecycleAction(r, 'suspend'),
                  onArchive: (r) => void runScorecardLifecycleAction(r, 'archive'),
                  onClose: () => setSelectedScorecardId(null),
                })
              : null
          }
        />
      </div>
    );
  }

  const table: ResultsVNextTableProps = {
    columns,
    data: tableRows,
    persistKey: 'results-vnext.kpi-registry',
    loading,
    error,
    onRetry: () => void fetchRows(),
    empty:
      !loading && !error && rows.length === 0
        ? {
            title: isPolish ? 'Brak zdefiniowanych KPI' : 'No KPIs defined yet',
            description: isPolish
              ? 'Utwórz pierwszy KPI, aby zacząć śledzić ten rejestr.'
              : 'Create the first KPI to start tracking this registry.',
          }
        : undefined,
    emptyMessage:
      !loading && !error && rows.length > 0 && visibleRows.length === 0
        ? isPolish
          ? 'Brak wierszy pasujących do aktualnych filtrów.'
          : 'No rows match the current filters.'
        : undefined,
    selectedRowId: selectedId,
    onRowClick: (row) => setSelectedId(String(row.id)),
    rowMenu: (row) =>
      buildRowMenu(row as unknown as KpiDefinitionDto, {
        isPolish,
        pending,
        knownVersions,
        defPending,
        onOpen: (kpiId) => setSelectedId(kpiId),
        onOpenTool: (kpiId) => navigate(ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', kpiId)),
        onOpenMeasurements: (r) => setMeasurementsKpi(r),
        onActivate: (r) => void runLifecycleAction(r, 'activate'),
        onSuspend: (r) => void runLifecycleAction(r, 'suspend'),
        onArchive: (r) => void runLifecycleAction(r, 'archive'),
        onEditDraft: (r) => openEditForm(r),
        onSubmitDefinition: (r) => openTransition(r, 'submit'),
        onApproveDefinition: (r) => openTransition(r, 'approve'),
        onRejectDefinition: (r) => openTransition(r, 'reject'),
      }),
    defaultSort: { columnId: 'updatedAt', direction: 'desc' },
  };

  const editTarget = formTargetKpi ? knownVersions[formTargetKpi.kpiId] : undefined;

  return (
    <>
      <div className="h-full" data-testid="results-vnext-kpi-registry-page">
        <ResultsVNextRegistryShell
          domain="kpi"
          moduleBar={{
            tabs: [
              { id: 'my', label: isPolish ? 'Moje' : 'My' },
              { id: 'org', label: isPolish ? 'Organizacja' : 'Org' },
              { id: 'scorecards', label: isPolish ? 'Karty wyników' : 'Scorecards' },
            ],
            activeTab: tab,
            onTabChange: (id) => setTab(id === 'org' ? 'org' : id === 'scorecards' ? 'scorecards' : 'my'),
            showTabCounts: false,
            viewModes: ['table'],
            viewMode: 'table',
            chips,
            activeChip: statusFilter ?? 'all',
            onChipChange: (id) => setStatusFilter(id === 'all' ? null : (id as KpiStatus)),
            // RN-G5 — "Nowy KPI" quick-create (see file header). Only on
            // this tab (`my`/`org` — this whole branch never renders for
            // `scorecards`, see the `tab === 'scorecards'` early return
            // above), same "quick create has no meaning on a different
            // registry" precedent `ResultsRoiHub.tsx` documents for its own
            // "Benefits realization" tab.
            primaryCta: {
              label: isPolish ? 'Nowy KPI' : 'New KPI',
              icon: Plus,
              onClick: openCreateForm,
              testId: 'kpi-registry-create-cta',
            },
          }}
          table={table}
          preview={
            selectedRow
              ? buildPreview(selectedRow, {
                  isPolish,
                  currentUserId: currentUser?.id,
                  measurement,
                  pending,
                  knownVersions,
                  defPending,
                  onClose: () => setSelectedId(null),
                  onOpenFull: () => navigate(ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', selectedRow.kpiId)),
                  onOpenMeasurements: (r) => setMeasurementsKpi(r),
                  onActivate: (r) => void runLifecycleAction(r, 'activate'),
                  onSuspend: (r) => void runLifecycleAction(r, 'suspend'),
                  onArchive: (r) => void runLifecycleAction(r, 'archive'),
                  onEditDraft: (r) => openEditForm(r),
                  onSubmitDefinition: (r) => openTransition(r, 'submit'),
                  onApproveDefinition: (r) => openTransition(r, 'approve'),
                  onRejectDefinition: (r) => openTransition(r, 'reject'),
                })
              : null
          }
          forbidden={forbidden}
          onForbiddenBack={() => setForbidden(null)}
        />
      </div>
      <KpiDraftFormModal
        open={formOpen}
        mode={formMode}
        onClose={() => (formBusy ? undefined : setFormOpen(false))}
        onSubmit={handleFormSubmit}
        isPolish={isPolish}
        initialValues={
          formMode === 'edit' && editTarget
            ? {
                name: editTarget.name,
                description: editTarget.description,
                unit: editTarget.unit,
                targetGeometry: editTarget.targetGeometry,
                targetValue: editTarget.targetValue,
                targetMin: editTarget.targetMin,
                targetMax: editTarget.targetMax,
                warningLow: editTarget.warningLow,
                warningHigh: editTarget.warningHigh,
                criticalLow: editTarget.criticalLow,
                criticalHigh: editTarget.criticalHigh,
                binarySuccessValue: editTarget.binarySuccessValue,
                formulaText: editTarget.formulaText,
              }
            : undefined
        }
        busy={formBusy}
        errorMessage={formError}
        isConflict={formIsConflict}
      />
      <KpiTransitionDialog
        open={!!transition}
        kind={transition?.kind ?? null}
        kpiCode={transition?.row.kpiCode ?? ''}
        isPolish={isPolish}
        onClose={() => (defPending ? undefined : setTransition(null))}
        onSubmit={handleTransitionSubmit}
        busy={!!defPending}
        errorMessage={transitionError}
        isConflict={transitionIsConflict}
        isSelfApprovalDenied={transitionIsSelfApprovalDenied}
      />
    </>
  );
};

export default ResultsKpiRegistryPage;

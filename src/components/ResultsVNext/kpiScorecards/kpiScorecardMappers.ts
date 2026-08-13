/**
 * RN-G2 P1 #8 — KPI Scorecards pure mapping helpers (status labels, lock
 * semantics, formatters). No React — shared by `kpiScorecardPresenters.tsx`
 * (live `ResultsKpiRegistryPage.tsx` tab + `ResultsKpiScorecardDetailPage.tsx`)
 * and the dev-render mock harness, mirroring `roi/roiRegistryMappers.ts`'s
 * own rationale: one implementation, not two that silently drift.
 */
import type {
  KpiScorecardItemRole,
  KpiScorecardLifecycleStatus,
  KpiScorecardPerformanceStatus,
  KpiScorecardReviewFrequency,
  KpiScorecardScopeType,
  KpiScorecardSnapshotStatus,
} from './kpiScorecardApi';

// ==========================================
// Lifecycle status labels/tone — literal 4-state machine
// (`KPI_SCORECARD_LIFECYCLE_STATUSES`). Never invent a 5th state.
// ==========================================

export const KPI_SCORECARD_STATUS_LABELS: Record<
  KpiScorecardLifecycleStatus,
  { pl: string; en: string }
> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  active: { pl: 'Aktywna', en: 'Active' },
  suspended: { pl: 'Zawieszona', en: 'Suspended' },
  archived: { pl: 'Zarchiwizowana', en: 'Archived' },
};

export function kpiScorecardStatusLabel(status: KpiScorecardLifecycleStatus, isPolish: boolean): string {
  return isPolish ? KPI_SCORECARD_STATUS_LABELS[status].pl : KPI_SCORECARD_STATUS_LABELS[status].en;
}

export type KpiScorecardStatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const KPI_SCORECARD_STATUS_TONE: Record<KpiScorecardLifecycleStatus, KpiScorecardStatusTone> = {
  draft: 'info',
  active: 'success',
  suspended: 'warning',
  archived: 'neutral',
};

// ==========================================
// Scope type / review frequency / item role / snapshot status labels — plain
// closed enums, no lock semantics attached (`KpiScorecardScopeType` etc. are
// membership/config fields, not a status machine).
// ==========================================

export const KPI_SCORECARD_SCOPE_LABELS: Record<KpiScorecardScopeType, { pl: string; en: string }> = {
  organization: { pl: 'Organizacja', en: 'Organization' },
  business_unit: { pl: 'Jednostka biznesowa', en: 'Business unit' },
  team: { pl: 'Zespół', en: 'Team' },
  process: { pl: 'Proces', en: 'Process' },
  individual: { pl: 'Indywidualna', en: 'Individual' },
  custom: { pl: 'Niestandardowa', en: 'Custom' },
};

export function kpiScorecardScopeLabel(scope: KpiScorecardScopeType, isPolish: boolean): string {
  return isPolish ? KPI_SCORECARD_SCOPE_LABELS[scope].pl : KPI_SCORECARD_SCOPE_LABELS[scope].en;
}

export const KPI_SCORECARD_REVIEW_FREQUENCY_LABELS: Record<
  KpiScorecardReviewFrequency,
  { pl: string; en: string }
> = {
  weekly: { pl: 'Co tydzień', en: 'Weekly' },
  monthly: { pl: 'Co miesiąc', en: 'Monthly' },
  quarterly: { pl: 'Co kwartał', en: 'Quarterly' },
  annual: { pl: 'Co rok', en: 'Annual' },
  custom: { pl: 'Niestandardowa', en: 'Custom' },
};

export function kpiScorecardReviewFrequencyLabel(
  frequency: KpiScorecardReviewFrequency,
  isPolish: boolean
): string {
  return isPolish
    ? KPI_SCORECARD_REVIEW_FREQUENCY_LABELS[frequency].pl
    : KPI_SCORECARD_REVIEW_FREQUENCY_LABELS[frequency].en;
}

export const KPI_SCORECARD_ITEM_ROLE_LABELS: Record<KpiScorecardItemRole, { pl: string; en: string }> = {
  primary: { pl: 'Podstawowa', en: 'Primary' },
  supporting: { pl: 'Pomocnicza', en: 'Supporting' },
};

export function kpiScorecardItemRoleLabel(role: KpiScorecardItemRole, isPolish: boolean): string {
  return isPolish ? KPI_SCORECARD_ITEM_ROLE_LABELS[role].pl : KPI_SCORECARD_ITEM_ROLE_LABELS[role].en;
}

export const KPI_SCORECARD_SNAPSHOT_STATUS_LABELS: Record<
  KpiScorecardSnapshotStatus,
  { pl: string; en: string }
> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  published: { pl: 'Opublikowana', en: 'Published' },
  superseded: { pl: 'Zastąpiona', en: 'Superseded' },
};

export function kpiScorecardSnapshotStatusLabel(
  status: KpiScorecardSnapshotStatus,
  isPolish: boolean
): string {
  return isPolish
    ? KPI_SCORECARD_SNAPSHOT_STATUS_LABELS[status].pl
    : KPI_SCORECARD_SNAPSHOT_STATUS_LABELS[status].en;
}

export const KPI_SCORECARD_SNAPSHOT_STATUS_TONE: Record<KpiScorecardSnapshotStatus, KpiScorecardStatusTone> = {
  draft: 'info',
  published: 'success',
  superseded: 'neutral',
};

export const KPI_SCORECARD_PERFORMANCE_STATUS_LABELS: Record<
  KpiScorecardPerformanceStatus,
  { pl: string; en: string }
> = {
  on_target: { pl: 'W celu', en: 'On target' },
  warning: { pl: 'Ostrzeżenie', en: 'Warning' },
  critical: { pl: 'Krytyczny', en: 'Critical' },
  neutral: { pl: 'Neutralny', en: 'Neutral' },
};

export function kpiScorecardPerformanceStatusLabel(
  status: KpiScorecardPerformanceStatus | null,
  isPolish: boolean
): string {
  if (!status) return isPolish ? 'Brak' : 'None';
  return isPolish
    ? KPI_SCORECARD_PERFORMANCE_STATUS_LABELS[status].pl
    : KPI_SCORECARD_PERFORMANCE_STATUS_LABELS[status].en;
}

// ==========================================
// Lock semantics — grounded EXACTLY in
// `kpiScorecardCommands.ts`'s `runScorecardLifecycleTransition` fromStatuses
// (activate: [draft,suspended]→active; suspend: [active]→suspended; archive:
// [draft,active,suspended]→archived, terminal). Only `archived` has no
// outbound transition at all — that is the one truly "locked" status; the
// others are mid-lifecycle, not locked (mirrors `../ResultsKpiRegistryPage.tsx`'s
// own `STATUS_TONE`/lock treatment for the KPI entity itself, same program).
// ==========================================

export function isKpiScorecardLocked(status: KpiScorecardLifecycleStatus): boolean {
  return status === 'archived';
}

export function kpiScorecardLockReason(isPolish: boolean): string {
  return isPolish
    ? 'Karta wyników zarchiwizowana — stan końcowy, tylko odczyt.'
    : 'Scorecard archived — terminal state, read-only.';
}

/** Real server rule (`requiresAtLeastOneMember: true` on `activateScorecard`)
 * — used by the DETAIL page (which has `items` already loaded) to grey out
 * "Activate" honestly instead of letting the user hit a 409. The LIST tab
 * cannot know this per-row without an N+1 fetch, so it does NOT pre-block —
 * see `kpiScorecardApi.ts` header for that split decision. */
export function noMembersActivationReason(isPolish: boolean): string {
  return isPolish
    ? 'Aktywacja wymaga co najmniej jednej pozycji (KPI) na karcie wyników — dodaj pozycję, zanim aktywujesz.'
    : 'Activation requires at least one item (KPI) on the scorecard — add an item before activating.';
}

// ==========================================
// Formatters — locale follows `isPolish`, matching the repo-wide convention
// already established by `../ResultsKpiRegistryPage.tsx` / `../roi/roiRegistryMappers.ts`.
// ==========================================

export function formatKpiScorecardDate(value: string | null | undefined, isPolish: boolean): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function shortKpiScorecardId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function kpiScorecardOwnerDisplay(
  ownerUserId: string | null | undefined,
  currentUserId: string | null | undefined,
  isPolish: boolean
): string {
  if (!ownerUserId) return '—';
  if (currentUserId && ownerUserId === currentUserId) return isPolish ? 'Ty' : 'You';
  return shortKpiScorecardId(ownerUserId);
}

/**
 * RN-G5 §G #30 — "Attention" cross-cutting view presenters.
 *
 * ★ D10 (decision, restated from the task brief): `/attention` is ONE
 * cross-cutting view, NOT a fourth top-level registry/domain (that would
 * break D04's "exactly three registries at the top level"). This file does
 * NOT invent a shared row shape between KPI and OKR attention data — see
 * `attentionApi.ts`'s header for the confirmed, INCOMPATIBLE shapes (KPI:
 * 7 named buckets, one of which — `performanceDistribution` — is a single
 * stats object, not a list at all; OKR: 5 named buckets, all lists, but
 * every bucket's row shape is unique to that bucket; `okr/team-health` is a
 * THIRD, again-different aggregate). The shared UI pattern §G #30 asks for
 * is therefore NOT "one merged table" (impossible — no common columns
 * exist) but: ONE shell (`ResultsAttentionPage.tsx`), ONE mechanism for
 * picking which of the many named buckets is currently shown (the Menu 2
 * tab row picks the KPI/OKR source, Menu 3 chips pick the named bucket
 * within that source, real
 * counts on every chip, exactly like every other RN-G5/RN-G2 chip-driven
 * bucket switch in this program), and ONE generic per-row preview
 * (`buildAttentionRowPreview` below) instead of N bespoke preview builders.
 *
 * Every bucket's `TableColumn[]` is intentionally SMALL — the field list a
 * bucket returns already IS its full record (these are read-models, not
 * entities with a large property surface) — so the SAME field list also
 * drives the row preview's `details.properties`, no duplication.
 */
import React from 'react';

import type { StandardPreviewProps, TableColumn } from '@/components/standard';

import type {
  KpiAttentionIneffectiveCorrectiveActionRow,
  KpiAttentionMissingOwnershipRow,
  KpiAttentionOverdueObligationRow,
  KpiAttentionOwnerLoadRow,
  KpiAttentionPerformanceDistribution,
  KpiAttentionProcessCoverageRow,
  KpiAttentionRepeatedDeviationRow,
  OkrAttentionEscalatedSetRow,
  OkrAttentionLowConfidenceObjectiveRow,
  OkrAttentionOpenBlockerRow,
  OkrAttentionOpenSupportRequestRow,
  OkrAttentionStaleCheckinSetRow,
  OkrTeamHealthSetSummaryRow,
  OrganizationKpiAttentionDto,
  OrganizationOkrAttentionDto,
  OrganizationOkrTeamHealthDto,
} from './attentionApi';

function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function textCol(id: string, label: string, width: string, mono = false): TableColumn {
  return {
    id,
    label,
    width,
    render: (row: Record<string, unknown>) => (
      <span className={`text-sm text-c-text${mono ? ' font-mono' : ''}`}>{String(row[id] ?? '—')}</span>
    ),
  };
}

function shortIdCol(id: string, label: string, width: string): TableColumn {
  return {
    id,
    label,
    width,
    render: (row: Record<string, unknown>) => (
      <span className="text-sm font-mono text-c-text" title={String(row[id] ?? '')}>
        {shortId(row[id] as string | null | undefined)}
      </span>
    ),
  };
}

/**
 * 2026-08-26 night-fixes-a P0 (NIGHT_SWEEP_A_REPORT_20260826.md #4): every
 * `*UserId` field in these read-models is a raw id (`user-anna-kowals…`) —
 * the SAME "surowe id zamiast nazwy" gap the report flags across Results.
 * `resolveMemberName` is the SAME id->displayName map
 * `ResultsAttentionPage.tsx` already loads from the org's REAL member list
 * (`OrganizationApi.getOrganizationMembers`, already-fetched data — no new
 * server endpoint), following the app's existing id->label resolver
 * convention (`useMentionAutocomplete`'s member pool). Falls back to the
 * short id, honestly, when a member isn't found (e.g. deactivated account)
 * instead of inventing a name.
 */
export type MemberNameResolver = (userId: string) => string | null;

function userCol(
  id: string,
  label: string,
  width: string,
  resolveMemberName: MemberNameResolver
): TableColumn {
  return {
    id,
    label,
    width,
    render: (row: Record<string, unknown>) => {
      const userId = row[id] as string | null | undefined;
      if (!userId) return <span className="text-sm text-c-text">—</span>;
      const name = resolveMemberName(userId);
      return (
        <span className="text-sm text-c-text" title={userId}>
          {name || shortId(userId)}
        </span>
      );
    },
  };
}

function boolCol(id: string, label: string, width: string, isPolish: boolean): TableColumn {
  return {
    id,
    label,
    width,
    render: (row: Record<string, unknown>) => (
      <span className="text-sm text-c-text">{row[id] ? (isPolish ? 'Tak' : 'Yes') : isPolish ? 'Nie' : 'No'}</span>
    ),
  };
}

function numberCol(id: string, label: string, width: string): TableColumn {
  return {
    id,
    label,
    width,
    align: 'right',
    render: (row: Record<string, unknown>) => (
      <span className="text-sm tabular-nums text-c-text">{String(row[id] ?? 0)}</span>
    ),
  };
}

// ==========================================
// Bucket registry — id, label, columns, row extractor. `withId` mixes in a
// stable synthetic `id` per row (StandardTable's own requirement) — most
// buckets have a real primary key already; the few that don't
// (`processCoverage`/`performanceDistribution`) get an index-based one.
// ==========================================

export type AttentionSourceDomain = 'kpi' | 'okr';

export interface AttentionBucketDef {
  id: string;
  labelPl: string;
  labelEn: string;
  columns: TableColumn[];
  /** Row-level "open related record" action, when the row carries a
   * navigable id (`kpiId`/`setId`) — omitted for buckets that don't
   * (`processCoverage`/`performanceDistribution`/`ownerLoad`). */
  openKind?: 'kpi' | 'okrSet';
  openIdField?: string;
}

export const KPI_ATTENTION_BUCKETS: readonly AttentionBucketDef[] = [
  { id: 'missingOwnership', labelPl: 'Brak właściciela', labelEn: 'Missing ownership', columns: [], openKind: 'kpi', openIdField: 'kpiId' },
  { id: 'overdueObligations', labelPl: 'Zaległe obowiązki', labelEn: 'Overdue obligations', columns: [], openKind: 'kpi', openIdField: 'kpiId' },
  { id: 'repeatedDeviations', labelPl: 'Powtarzające się odchylenia', labelEn: 'Repeated deviations', columns: [], openKind: 'kpi', openIdField: 'kpiId' },
  { id: 'ineffectiveCorrectiveActions', labelPl: 'Nieskuteczne działania korygujące', labelEn: 'Ineffective corrective actions', columns: [], openKind: 'kpi', openIdField: 'kpiId' },
  { id: 'ownerLoad', labelPl: 'Obciążenie właścicieli', labelEn: 'Owner load', columns: [] },
  { id: 'processCoverage', labelPl: 'Pokrycie procesów', labelEn: 'Process coverage', columns: [] },
  { id: 'performanceDistribution', labelPl: 'Rozkład wyników', labelEn: 'Performance distribution', columns: [] },
];

export const OKR_ATTENTION_BUCKETS: readonly AttentionBucketDef[] = [
  { id: 'staleCheckins', labelPl: 'Nieaktualne check-iny', labelEn: 'Stale check-ins', columns: [], openKind: 'okrSet', openIdField: 'setId' },
  { id: 'lowConfidenceObjectives', labelPl: 'Cele o niskiej pewności', labelEn: 'Low-confidence objectives', columns: [], openKind: 'okrSet', openIdField: 'setId' },
  { id: 'openSupportRequests', labelPl: 'Otwarte prośby o wsparcie', labelEn: 'Open support requests', columns: [], openKind: 'okrSet', openIdField: 'setId' },
  { id: 'openBlockers', labelPl: 'Otwarte blokady', labelEn: 'Open blockers', columns: [], openKind: 'okrSet', openIdField: 'setId' },
  { id: 'escalatedSets', labelPl: 'Eskalowane zestawy', labelEn: 'Escalated sets', columns: [], openKind: 'okrSet', openIdField: 'setId' },
  { id: 'teamHealthSets', labelPl: 'Zdrowie zespołu — zestawy', labelEn: 'Team health — sets', columns: [], openKind: 'okrSet', openIdField: 'setId' },
];


/** Bucket defs above declare only the language-INDEPENDENT fields
 * (`id`/`labelPl`/`labelEn`/`openKind`/`openIdField`) — `columns` is always
 * `[]` there and rebuilt per language through `rebuildColumns` below, the
 * ONE place every bucket's real column list is defined. */
export function buildKpiAttentionBuckets(
  isPolish: boolean,
  resolveMemberName: MemberNameResolver
): AttentionBucketDef[] {
  return KPI_ATTENTION_BUCKETS.map((b) => ({
    ...b,
    columns: rebuildColumns(b.id, 'kpi', isPolish, resolveMemberName),
  }));
}

export function buildOkrAttentionBuckets(
  isPolish: boolean,
  resolveMemberName: MemberNameResolver
): AttentionBucketDef[] {
  return OKR_ATTENTION_BUCKETS.map((b) => ({
    ...b,
    columns: rebuildColumns(b.id, 'okr', isPolish, resolveMemberName),
  }));
}

function rebuildColumns(
  bucketId: string,
  source: AttentionSourceDomain,
  isPolish: boolean,
  resolveMemberName: MemberNameResolver
): TableColumn[] {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  if (source === 'kpi') {
    switch (bucketId) {
      case 'missingOwnership':
        // 2026-08-26 night-fixes-a P0 #4: the server read-model
        // (`KpiAttentionMissingOwnershipRow`) truly has only `kpiId`/
        // `kpiCode` — no title, owner, trend or severity field exists to
        // show (this bucket's whole point is "no owner assigned", so there
        // is no owner to resolve either). The raw `kpiId` duplicated the
        // already-readable `kpiCode` identifying the SAME KPI — dropped so
        // the default Attention view isn't fronted by a bare id column.
        return [textCol('kpiCode', t('Kod KPI', 'KPI code'), '220px')];
      case 'overdueObligations':
        return [
          shortIdCol('obligationId', t('ID obowiązku', 'Obligation ID'), '150px'),
          shortIdCol('kpiId', 'KPI ID', '150px'),
          userCol('assigneeUserId', t('Przypisano', 'Assignee'), '170px', resolveMemberName),
          textCol('obligationType', t('Typ', 'Type'), '150px'),
          textCol('dueAt', t('Termin', 'Due'), '170px'),
        ];
      case 'repeatedDeviations':
        return [
          shortIdCol('kpiId', 'KPI ID', '150px'),
          textCol('kpiCode', t('Kod KPI', 'KPI code'), '170px'),
          numberCol('caseCountLast180Days', t('Przypadki (180 dni)', 'Cases (180d)'), '160px'),
          boolCol('anySelfReportedRecurrence', t('Zgłoszono nawrót', 'Self-reported recurrence'), '160px', isPolish),
        ];
      case 'ineffectiveCorrectiveActions':
        return [
          shortIdCol('caseId', t('ID przypadku', 'Case ID'), '150px'),
          shortIdCol('kpiId', 'KPI ID', '150px'),
          shortIdCol('verificationId', t('ID weryfikacji', 'Verification ID'), '150px'),
          textCol('status', 'Status', '160px'),
        ];
      case 'ownerLoad':
        return [
          userCol('ownerUserId', t('Właściciel', 'Owner'), '200px', resolveMemberName),
          numberCol('activeKpiCount', t('Aktywne KPI', 'Active KPIs'), '140px'),
          numberCol('openDeviationCaseCount', t('Otwarte odchylenia', 'Open deviation cases'), '170px'),
        ];
      case 'processCoverage':
        return [
          textCol('primaryProcessId', t('Proces', 'Process'), '200px'),
          numberCol('totalKpis', t('KPI razem', 'Total KPIs'), '140px'),
          numberCol('activeKpis', t('Aktywne KPI', 'Active KPIs'), '140px'),
        ];
      case 'performanceDistribution':
        return [
          numberCol('onTarget', t('W celu', 'On target'), '120px'),
          numberCol('warning', t('Ostrzeżenie', 'Warning'), '120px'),
          numberCol('critical', t('Krytyczne', 'Critical'), '120px'),
          numberCol('neutralOrMissing', t('Brak danych', 'Missing'), '130px'),
        ];
      default:
        return [];
    }
  }
  switch (bucketId) {
    case 'staleCheckins':
      return [
        shortIdCol('setId', 'Set ID', '150px'),
        textCol('title', t('Tytuł', 'Title'), '240px'),
        textCol('nextCheckinDueAt', t('Kolejny check-in', 'Next check-in due'), '170px'),
      ];
    case 'lowConfidenceObjectives':
      return [
        shortIdCol('objectiveId', t('ID celu', 'Objective ID'), '150px'),
        shortIdCol('keyResultId', t('ID KR', 'KR ID'), '150px'),
        textCol('title', t('Tytuł', 'Title'), '220px'),
        textCol('confidence', t('Pewność', 'Confidence'), '130px'),
      ];
    case 'openSupportRequests':
      return [
        shortIdCol('requestId', t('ID prośby', 'Request ID'), '150px'),
        shortIdCol('objectiveId', t('ID celu', 'Objective ID'), '150px'),
        userCol('assignedToUserId', t('Przypisano', 'Assigned to'), '170px', resolveMemberName),
        textCol('status', 'Status', '130px'),
      ];
    case 'openBlockers':
      return [
        shortIdCol('keyResultId', t('ID KR', 'KR ID'), '150px'),
        shortIdCol('objectiveId', t('ID celu', 'Objective ID'), '150px'),
        textCol('blocker', t('Blokada', 'Blocker'), '280px'),
      ];
    case 'escalatedSets':
      return [
        shortIdCol('setId', 'Set ID', '150px'),
        textCol('title', t('Tytuł', 'Title'), '240px'),
        textCol('attentionState', t('Stan uwagi', 'Attention state'), '150px'),
      ];
    case 'teamHealthSets':
      return [
        shortIdCol('setId', 'Set ID', '150px'),
        textCol('status', 'Status', '130px'),
        textCol('scopeType', t('Zasięg', 'Scope'), '130px'),
        numberCol('currentVersion', t('Wersja', 'Version'), '110px'),
      ];
    default:
      return [];
  }
}

// ==========================================
// Row extraction — pulls each bucket's array (or, for
// `performanceDistribution`, wraps the single stats object as a one-row
// array) out of the aggregate DTOs, with a stable synthetic `id`.
// ==========================================

export function extractKpiBucketRows(
  bucketId: string,
  dto: OrganizationKpiAttentionDto | null
): Array<Record<string, unknown> & { id: string }> {
  if (!dto) return [];
  switch (bucketId) {
    case 'missingOwnership':
      return (dto.missingOwnership as KpiAttentionMissingOwnershipRow[]).map((r) => ({ ...r, id: r.kpiId }));
    case 'overdueObligations':
      return (dto.overdueObligations as KpiAttentionOverdueObligationRow[]).map((r) => ({ ...r, id: r.obligationId }));
    case 'repeatedDeviations':
      return (dto.repeatedDeviations as KpiAttentionRepeatedDeviationRow[]).map((r) => ({ ...r, id: r.kpiId }));
    case 'ineffectiveCorrectiveActions':
      return (dto.ineffectiveCorrectiveActions as KpiAttentionIneffectiveCorrectiveActionRow[]).map((r) => ({
        ...r,
        id: r.caseId,
      }));
    case 'ownerLoad':
      return (dto.ownerLoad as KpiAttentionOwnerLoadRow[]).map((r) => ({ ...r, id: r.ownerUserId }));
    case 'processCoverage':
      return (dto.processCoverage as KpiAttentionProcessCoverageRow[]).map((r, idx) => ({
        ...r,
        id: r.primaryProcessId ?? `no-process-${idx}`,
      }));
    case 'performanceDistribution': {
      const d = dto.performanceDistribution as KpiAttentionPerformanceDistribution;
      return [{ ...d, id: 'performance-distribution' }];
    }
    default:
      return [];
  }
}

export function extractOkrBucketRows(
  bucketId: string,
  attentionDto: OrganizationOkrAttentionDto | null,
  teamHealthDto: OrganizationOkrTeamHealthDto | null
): Array<Record<string, unknown> & { id: string }> {
  if (bucketId === 'teamHealthSets') {
    return (teamHealthDto?.sets ?? ([] as OkrTeamHealthSetSummaryRow[])).map((r) => ({ ...r, id: r.setId }));
  }
  if (!attentionDto) return [];
  switch (bucketId) {
    case 'staleCheckins':
      return (attentionDto.staleCheckins as OkrAttentionStaleCheckinSetRow[]).map((r) => ({ ...r, id: r.setId }));
    case 'lowConfidenceObjectives':
      return (attentionDto.lowConfidenceObjectives as OkrAttentionLowConfidenceObjectiveRow[]).map((r) => ({
        ...r,
        id: r.keyResultId,
      }));
    case 'openSupportRequests':
      return (attentionDto.openSupportRequests as OkrAttentionOpenSupportRequestRow[]).map((r) => ({
        ...r,
        id: r.requestId,
      }));
    case 'openBlockers':
      return (attentionDto.openBlockers as OkrAttentionOpenBlockerRow[]).map((r) => ({ ...r, id: r.checkInId }));
    case 'escalatedSets':
      return (attentionDto.escalatedSets as OkrAttentionEscalatedSetRow[]).map((r) => ({ ...r, id: r.setId }));
    default:
      return [];
  }
}

export function bucketCount(
  source: AttentionSourceDomain,
  bucketId: string,
  kpiDto: OrganizationKpiAttentionDto | null,
  okrDto: OrganizationOkrAttentionDto | null,
  teamHealthDto: OrganizationOkrTeamHealthDto | null
): number {
  if (source === 'kpi') return extractKpiBucketRows(bucketId, kpiDto).length;
  return extractOkrBucketRows(bucketId, okrDto, teamHealthDto).length;
}

// ==========================================
// Generic per-row preview — see file header for why this is ONE function
// instead of N bespoke builders (no shared row shape to special-case
// around; every bucket's column list already IS its property list).
// ==========================================

export interface AttentionRowPreviewCtx {
  isPolish: boolean;
  bucketLabel: string;
  columns: TableColumn[];
  openKind?: 'kpi' | 'okrSet';
  openIdField?: string;
  onClose: () => void;
  onOpenKpi: (kpiId: string) => void;
  onOpenOkrSet: (setId: string) => void;
  /** Same resolver as `userCol` — the preview's property list reads raw row
   * values directly (bypassing each column's own `render`), so `*UserId`
   * fields need the SAME id->name resolution here or the panel would
   * re-expose the raw id the table column just hid. */
  resolveMemberName: MemberNameResolver;
}

export function buildAttentionRowPreview(
  row: Record<string, unknown> & { id: string },
  ctx: AttentionRowPreviewCtx
): StandardPreviewProps {
  const t = (pl: string, en: string) => (ctx.isPolish ? pl : en);
  const titleField = ('title' in row ? row.title : undefined) as string | undefined;
  return {
    title: titleField || `${ctx.bucketLabel} — ${shortId(row.id)}`,
    onClose: ctx.onClose,
    meta: {
      pills: [{ label: ctx.bucketLabel, tone: 'neutral' }],
    },
    details: {
      properties: ctx.columns.map((col) => ({
        id: col.id,
        label: col.label,
        value: col.id.endsWith('UserId')
          ? formatPreviewValue(
              row[col.id] ? ctx.resolveMemberName(String(row[col.id])) || row[col.id] : row[col.id]
            )
          : formatPreviewValue(row[col.id]),
      })),
    },
    ai: { hints: [], disabled: true, disabledTooltip: t('Wkrótce', 'Coming soon') },
    relations: [],
    actions:
      ctx.openKind && ctx.openIdField && row[ctx.openIdField]
        ? {
            informational: [
              {
                id: 'open-related',
                variant: 'neutral',
                label: ctx.openKind === 'kpi' ? t('Otwórz KPI', 'Open KPI') : t('Otwórz Set OKR', 'Open OKR Set'),
                onClick: () =>
                  ctx.openKind === 'kpi'
                    ? ctx.onOpenKpi(String(row[ctx.openIdField as string]))
                    : ctx.onOpenOkrSet(String(row[ctx.openIdField as string])),
              },
            ],
          }
        : undefined,
  };
}

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

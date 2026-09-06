/**
 * RN-G2 P1 #8 — KPI Scorecards presentation builders: columns / row menu /
 * preview for `StandardTable`/`StandardPreview`, built from real
 * `KpiScorecardDto`/`KpiScorecardItemDto`/`KpiScorecardReviewSnapshotDto`
 * data. Deliberately PURE functions of their inputs (no fetching, no state)
 * so the SAME code renders both the live screens
 * (`../ResultsKpiRegistryPage.tsx`'s "Scorecards" tab,
 * `ResultsKpiScorecardDetailPage.tsx`) and the dev-render QA harness
 * (`dev-render/screens/results-vnext-kpi-scorecards.tsx`) — one
 * implementation, not two that can silently drift (same rationale
 * `../roi/roiRegistryPresenters.tsx`'s own header documents).
 *
 * -- SECURITY-HONESTY FINDING, UPDATED BY P0-C (was: read directly from
 * `kpiScorecardRepository.ts`'s own header comment, decision #6b — a review
 * snapshot's `snapshotPayload` was filtered to the REQUESTING READER's
 * visibility ONLY by `getPublishedSnapshot`; a plain `listReviewSnapshots`
 * row's stored payload was NOT re-filtered per-reader, §OQ-UI-B). As of P0-C
 * (docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md §OQ-UI-B, closed),
 * `kpiScorecardRepository.ts`'s `listReviewSnapshots` now applies the SAME
 * `resolveVisibleKpiIdSet`/`redactSnapshotPayloadForReader` redaction
 * `getPublishedSnapshot` always has — every server response this package can
 * receive now carries an already-reader-scoped `snapshotPayload`, never a
 * stored-but-unfiltered one.
 *
 * This package still deliberately NEVER renders `snapshotPayload` contents
 * (item facts / statusCounts) anywhere — snapshot rows show only their own
 * metadata (period/status/timestamps) — kept as defense-in-depth (belt +
 * suspenders with the now-fixed server-side redaction), NOT because the data
 * arriving in the response is unsafe. Do not read this restriction as "the
 * data is unsafe, so don't render it"; read it as "an extra layer, on top of
 * an already-safe response, in case a future response shape regresses". The
 * scorecard's honest "state" for a LIVE (non-snapshot) view still comes from
 * `GET .../status` (`getKpiScorecardStatusDistribution` — a LIVE,
 * already reader-scoped query, not a stored payload) — see
 * `buildKpiScorecardOverviewPreview` below. A future package that wants to
 * show a published snapshot's frozen item facts can now route through
 * either `getPublishedKpiScorecardSnapshot` OR a `listReviewSnapshots` row
 * (already exists in `kpiScorecardApi.ts`) — both are reader-scoped as of
 * P0-C.
 */
import React from 'react';

import type { StandardPreviewProps, StandardRowMenu, TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives';
import {
  memberNameOrUnknown,
  type MemberNameResolver,
} from '@/hooks/useOrganizationMemberNames';
import {
  resultsEntityNameOrUnknown,
  type ResultsEntityNameResolver,
} from '@/hooks/useResultsEntityNames';

import { LifecycleLockBadge, lockedRowMenuAction } from '../LifecycleLockBadge';
import type {
  KpiScorecardDto,
  KpiScorecardItemDto,
  KpiScorecardLifecycleStatus,
  KpiScorecardReviewSnapshotDto,
  ScorecardStatusDistributionDto,
} from './kpiScorecardApi';
import {
  formatKpiScorecardDate,
  isKpiScorecardLocked,
  kpiScorecardItemRoleLabel,
  kpiScorecardLockReason,
  kpiScorecardReviewFrequencyLabel,
  kpiScorecardScopeLabel,
  kpiScorecardSnapshotStatusLabel,
  kpiScorecardStatusLabel,
  KPI_SCORECARD_SNAPSHOT_STATUS_TONE,
  KPI_SCORECARD_STATUS_TONE,
  noMembersActivationReason,
  shortTechnicalHash,
} from './kpiScorecardMappers';

// ==========================================
// POZIOM 1 trzypoziomowej formuły KPI — TABELA ZESTAWIEŃ (`/results/kpi`)
//
// Odrzucenie właściciela 2026-09-05: „Omawialiśmy tabelę; z poziomu tabeli
// otwiera się lista. Lista ma opis KPI, kilka pozycji, a każdy KPI ma swoją
// kartę typu N." Tabela poziomu 1 wymienia więc ZESTAWIENIA (grupy
// wskaźników), a nie pojedyncze wskaźniki, i pokazuje dokładnie te kolumny,
// które właściciel wymienił: NAZWA · OPIS · LICZBA WSKAŹNIKÓW · WŁAŚCICIEL ·
// STATUS · AKTUALIZACJA. Zakres i częstotliwość przeglądu zeszły do podglądu
// (`buildKpiScorecardPreview` pokazuje je dalej) — tabela ma wymieniać, nie
// streszczać cały rekord.
//
// Wiersze to `KpiCardSetRowVm`, a NIE surowe `KpiScorecardDto`, bo jeden
// wiersz tej tabeli — zestawienie systemowe „Bez zestawienia" — nie jest
// rekordem w bazie (patrz `../kpiTool/kpiCardSetPath.ts`). Wspólny kształt
// wiersza jest tu po to, żeby ten JEDEN wiersz nie musiał udawać scorecarda
// ze statusem i właścicielem, których nie ma: pokazuje uczciwe „—".
// ==========================================

export interface KpiCardSetRowVm {
  /** `scorecardId` albo `UNASSIGNED_CARD_SET_ID` — id wiersza tabeli. */
  id: string;
  name: string;
  description: string | null;
  /** `null` = jeszcze nie policzone (pozycje w locie) ⇒ uczciwe „—". */
  itemCount: number | null;
  /** `null` = zestawienie systemowe (nie ma właściciela) ⇒ „—". */
  owner: string | null;
  /** `null` = zestawienie systemowe (nie ma cyklu życia) ⇒ pigułka „Systemowe". */
  status: KpiScorecardLifecycleStatus | null;
  /** `null` = zestawienie systemowe (nic się w nim nie „aktualizuje") ⇒ „—". */
  updatedAt: string | null;
  /** Realny rekord — `null` WYŁĄCZNIE dla wiersza systemowego. */
  scorecard: KpiScorecardDto | null;
}

export function buildKpiCardSetColumns(isPolish: boolean): TableColumn[] {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  return [
    {
      id: 'name',
      label: t('Nazwa', 'Name'),
      width: '240px',
      sortable: true,
      render: (row: KpiCardSetRowVm) => (
        <span className="text-sm font-medium text-c-text" title={row.scorecard ? row.id : undefined}>
          {row.name}
        </span>
      ),
    },
    {
      id: 'description',
      label: t('Opis', 'Description'),
      width: '320px',
      render: (row: KpiCardSetRowVm) => (
        <span className="block truncate text-sm text-c-text-secondary" title={row.description ?? undefined}>
          {row.description ?? '—'}
        </span>
      ),
    },
    {
      id: 'itemCount',
      label: t('Liczba wskaźników', 'Indicators'),
      width: '150px',
      align: 'right',
      sortable: true,
      render: (row: KpiCardSetRowVm) => (
        <span className="text-sm tabular-nums text-c-text-secondary">
          {row.itemCount === null ? '—' : row.itemCount}
        </span>
      ),
    },
    {
      id: 'owner',
      label: t('Właściciel', 'Owner'),
      width: '160px',
      render: (row: KpiCardSetRowVm) => (
        <span className="text-sm text-c-text-secondary">{row.owner ?? '—'}</span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: '150px',
      filterable: true,
      filterOptions: (Object.keys(KPI_SCORECARD_STATUS_TONE) as KpiScorecardLifecycleStatus[]).map(
        (s) => ({ value: s, label: kpiScorecardStatusLabel(s, isPolish) })
      ),
      render: (row: KpiCardSetRowVm) =>
        row.status ? (
          <StatusChip
            label={kpiScorecardStatusLabel(row.status, isPolish)}
            tone={KPI_SCORECARD_STATUS_TONE[row.status]}
          />
        ) : (
          <StatusChip label={t('Systemowe', 'System')} tone="neutral" />
        ),
    },
    {
      id: 'updatedAt',
      label: t('Aktualizacja', 'Updated'),
      width: '150px',
      sortable: true,
      render: (row: KpiCardSetRowVm) => (
        <span className="text-sm text-c-text-secondary">
          {row.updatedAt ? formatKpiScorecardDate(row.updatedAt, isPolish) : '—'}
        </span>
      ),
    },
  ];
}

// ==========================================
// Scorecard row menu — 3-zone kebab, mirrors `../ResultsKpiRegistryPage.tsx`'s
// own `buildRowMenu` for the KPI entity almost exactly (same lifecycle
// shape: activate/suspend in `statusTransitions`, archive in
// `universalHandlers`). `ctx.memberCount` is OPTIONAL — see
// `kpiScorecardApi.ts` header for why the LIST tab must leave it `undefined`
// (no N+1) while the DETAIL overview (which already loaded `items`) passes
// the real count for an honest client-side grey-out.
// ==========================================

export interface KpiScorecardRowMenuCtx {
  isPolish: boolean;
  busy: boolean;
  memberCount?: number;
  /**
   * Otwarcie LISTY zestawienia (poziom 2 trzypoziomowej formuły). Gdy podane,
   * staje się PIERWSZĄ pozycją kebaba — bo to jest droga w dół, o którą
   * upomniał się właściciel 05.09 — a „Otwórz pełną kartę wyników" (rekord z
   * cyklem życia i migawkami) zostaje obok niej, nieusunięta.
   */
  onOpenCardSet?: (scorecardId: string) => void;
  onOpenDetail: (scorecardId: string) => void;
  onActivate: (row: KpiScorecardDto) => void;
  onSuspend: (row: KpiScorecardDto) => void;
  onArchive: (row: KpiScorecardDto) => void;
}

export function buildKpiScorecardRowMenu(row: KpiScorecardDto, ctx: KpiScorecardRowMenuCtx): StandardRowMenu {
  const t = (pl: string, en: string) => (ctx.isPolish ? pl : en);
  const archivedReason = kpiScorecardLockReason(ctx.isPolish);
  const noMembersReason = noMembersActivationReason(ctx.isPolish);
  // Only block client-side when we KNOW the member count (detail context) —
  // never guess/fabricate a block for the list context (see file header).
  const knownEmpty = ctx.memberCount !== undefined && ctx.memberCount < 1;

  let statusTransitions: StandardRowMenu['statusTransitions'];
  if (row.lifecycleStatus === 'active') {
    statusTransitions = [
      { id: 'suspend', label: t('Zawieś', 'Suspend'), onClick: () => ctx.onSuspend(row), disabled: ctx.busy },
    ];
  } else if (row.lifecycleStatus === 'suspended') {
    statusTransitions = knownEmpty
      ? [lockedRowMenuAction({ id: 'activate', label: t('Aktywuj', 'Activate') }, noMembersReason)]
      : [{ id: 'activate', label: t('Aktywuj', 'Activate'), onClick: () => ctx.onActivate(row), disabled: ctx.busy }];
  } else if (row.lifecycleStatus === 'draft') {
    statusTransitions = knownEmpty
      ? [lockedRowMenuAction({ id: 'activate', label: t('Aktywuj', 'Activate') }, noMembersReason)]
      : [{ id: 'activate', label: t('Aktywuj', 'Activate'), onClick: () => ctx.onActivate(row), disabled: ctx.busy }];
  } else {
    // archived — terminal, single locked entry stays visible with a reason
    // rather than disappearing (TRIADA §C3).
    statusTransitions = [lockedRowMenuAction({ id: 'activate', label: t('Aktywuj', 'Activate') }, archivedReason)];
  }

  const isArchived = row.lifecycleStatus === 'archived';

  return {
    primary: [
      ...(ctx.onOpenCardSet
        ? [
            {
              id: 'open-list',
              label: t('Otwórz listę wskaźników', 'Open indicator list'),
              onClick: () => ctx.onOpenCardSet?.(row.scorecardId),
            },
          ]
        : []),
      { id: 'open', label: t('Otwórz pełną kartę wyników', 'Open full scorecard'), onClick: () => ctx.onOpenDetail(row.scorecardId) },
    ],
    statusTransitions,
    universalHandlers: isArchived
      ? { preview: () => ctx.onOpenDetail(row.scorecardId), archiveNote: archivedReason }
      : {
          preview: () => ctx.onOpenDetail(row.scorecardId),
          archive: () => ctx.onArchive(row),
        },
    // No delete endpoint exists anywhere in kpiScorecard.routes.ts — never
    // fabricate one (same discipline as ../ResultsKpiRegistryPage.tsx).
    destructive: undefined,
  };
}

// ==========================================
// Scorecard preview (used both as the Scorecards-tab row preview AND as the
// DETAIL page's default "record overview" preview — see
// `ResultsKpiScorecardDetailPage.tsx` header for why that page shows this
// whenever no specific item/snapshot row is selected).
// ==========================================

export interface KpiScorecardPreviewCtx {
  isPolish: boolean;
  currentUserId: string | null | undefined;
  resolveMemberName?: MemberNameResolver;
  resolveScopeName?: ResultsEntityNameResolver;
  busy: boolean;
  /** `undefined` while in flight, a real distribution once resolved. Only
   * ever passed by the DETAIL page — the Scorecards-tab list preview omits
   * it (no per-row N+1 status-distribution fetch, same discipline as every
   * other RN-G2 lazy-preview-only fetch in this program). */
  statusDistribution?: ScorecardStatusDistributionDto | 'loading';
  memberCount?: number;
  /**
   * Pozycje zestawienia pokazywane w bloku Relacje podglądu — poziom 1 ma
   * pokazywać „opis zestawienia i jego wskaźniki" (odrzucenie właściciela
   * 05.09), a nie samą metrykę rekordu. `undefined` = wołający ich nie zna
   * (ekran szczegółu) ⇒ blok jak dotąd pusty; `'loading'` = w locie.
   */
  items?: KpiScorecardItemDto[] | 'loading';
  /** Klik w pozycję z bloku Relacje → karta N tego wskaźnika (poziom 3). */
  onOpenKpi?: (kpiId: string) => void;
  /** Otwarcie LISTY zestawienia (poziom 2) — główna droga w dół z tabeli. */
  onOpenCardSet?: (scorecardId: string) => void;
  onOpenDetail?: (scorecardId: string) => void;
  onActivate: (row: KpiScorecardDto) => void;
  onSuspend: (row: KpiScorecardDto) => void;
  onArchive: (row: KpiScorecardDto) => void;
  onClose: () => void;
}

export function buildKpiScorecardPreview(row: KpiScorecardDto, ctx: KpiScorecardPreviewCtx): StandardPreviewProps {
  const t = (pl: string, en: string) => (ctx.isPolish ? pl : en);
  const isArchived = row.lifecycleStatus === 'archived';
  const knownEmpty = ctx.memberCount !== undefined && ctx.memberCount < 1;

  const lockBadge = isArchived ? (
    <LifecycleLockBadge label={t('Zarchiwizowana', 'Archived')} reason={kpiScorecardLockReason(ctx.isPolish)} />
  ) : row.lifecycleStatus === 'suspended' ? (
    <LifecycleLockBadge
      label={t('Zawieszona', 'Suspended')}
      reason={t(
        'Karta wyników zawieszona — wznów (Aktywuj), aby przywrócić przeglądy.',
        'Scorecard suspended — resume (Activate) to restore reviews.'
      )}
    />
  ) : undefined;

  const distributionProperties =
    ctx.statusDistribution === undefined
      ? []
      : ctx.statusDistribution === 'loading'
        ? [
            {
              id: 'distribution',
              label: t('Stan pozycji', 'Item status'),
              value: <span className="text-c-text-muted text-sm">{t('Ładowanie…', 'Loading…')}</span>,
            },
          ]
        : [
            {
              id: 'distribution',
              label: t('Stan pozycji (widoczne)', 'Item status (visible)'),
              value: (
                <span className="text-sm tabular-nums text-c-text">
                  {t('Bezpieczne', 'Safe')} {ctx.statusDistribution.safe} ·{' '}
                  {t('Ostrzeżenie', 'Warning')} {ctx.statusDistribution.warning} ·{' '}
                  {t('Krytyczne', 'Critical')} {ctx.statusDistribution.critical} ·{' '}
                  {t('Brak danych', 'Missing')} {ctx.statusDistribution.missing}{' '}
                  <span className="text-c-text-muted">
                    ({t('z', 'of')} {ctx.statusDistribution.totalVisible})
                  </span>
                </span>
              ),
            },
          ];

  // Pozycje zestawienia jako chipy relacji — każda prowadzi w kartę N
  // wskaźnika (poziom 3). Nazwa pozycji bierze się WYŁĄCZNIE z odpowiedzi
  // serwera (`kpiName`); gdy jej nie ma, pokazujemy skrócony identyfikator,
  // nigdy zmyśloną nazwę.
  const itemRelations =
    ctx.items === undefined || ctx.items === 'loading'
      ? []
      : ctx.items.map((item) => ({
          id: item.itemId,
          label:
            item.kpiName ??
            resultsEntityNameOrUnknown(undefined, item.kpiId, ctx.isPolish, 'indicator'),
          value: kpiScorecardItemRoleLabel(item.role, ctx.isPolish),
          type: 'kpi',
          title: item.kpiId,
          onClick: ctx.onOpenKpi ? () => ctx.onOpenKpi?.(item.kpiId) : undefined,
        }));

  return {
    title: row.name,
    onClose: ctx.onClose,
    onOpenFull: ctx.onOpenCardSet ? () => ctx.onOpenCardSet?.(row.scorecardId) : undefined,
    openLabel: ctx.onOpenCardSet ? t('Otwórz listę', 'Open list') : undefined,
    headerExtra: lockBadge,
    meta: {
      pills: [
        { label: kpiScorecardStatusLabel(row.lifecycleStatus, ctx.isPolish), tone: KPI_SCORECARD_STATUS_TONE[row.lifecycleStatus] },
        { label: kpiScorecardScopeLabel(row.scopeType, ctx.isPolish), tone: 'neutral' },
      ],
      trailing: (
        <span className="text-[11px] font-semibold text-c-text-secondary">
          {formatKpiScorecardDate(row.updatedAt, ctx.isPolish)}
        </span>
      ),
    },
    details: {
      // Bramka parytetu jezykowego (2026-08-30): StandardPreview domyslnie
      // pokazuje angielskie naglowki "Property"/"Value" gdy wywolujacy ich
      // nie poda — patrz komentarz w StandardPreview.tsx przy propertyLabel.
      propertyLabel: t('Właściwość', 'Property'),
      valueLabel: t('Wartość', 'Value'),
      properties: [
        {
          id: 'owner',
          label: t('Właściciel', 'Owner'),
          value:
            row.ownerName ??
            (ctx.currentUserId && row.ownerUserId === ctx.currentUserId
              ? t('Ty', 'You')
              : memberNameOrUnknown(ctx.resolveMemberName, row.ownerUserId, ctx.isPolish)),
        },
        {
          id: 'reviewFrequency',
          label: t('Częstotliwość przeglądu', 'Review frequency'),
          value: kpiScorecardReviewFrequencyLabel(row.reviewFrequency, ctx.isPolish),
        },
        {
          id: 'scopeId',
          label: t('Cel zakresu', 'Scope target'),
          value: resultsEntityNameOrUnknown(ctx.resolveScopeName, row.scopeId, ctx.isPolish, 'scope'),
        },
        { id: 'description', label: t('Opis', 'Description'), value: row.description ?? '—' },
        { id: 'created', label: t('Utworzono', 'Created'), value: formatKpiScorecardDate(row.createdAt, ctx.isPolish) },
        ...distributionProperties,
      ],
    },
    ai: {
      hints: [],
      disabled: true,
      disabledTooltip: t('Wkrótce', 'Coming soon'),
    },
    relations: itemRelations,
    relationsEmptyLabel:
      ctx.items === 'loading'
        ? t('Ładowanie wskaźników…', 'Loading indicators…')
        : ctx.items === undefined
          ? undefined
          : t('To zestawienie nie ma jeszcze wskaźników.', 'This card set has no indicators yet.'),
    actions: isArchived
      ? {
          informational: [
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
            row.lifecycleStatus === 'suspended' || row.lifecycleStatus === 'draft'
              ? [
                  {
                    id: 'activate',
                    variant: 'positive',
                    label: t('Aktywuj', 'Activate'),
                    onClick: () => ctx.onActivate(row),
                    disabled: ctx.busy || knownEmpty,
                  },
                ]
              : row.lifecycleStatus === 'active'
                ? [
                    {
                      id: 'suspend',
                      variant: 'neutral',
                      label: t('Zawieś', 'Suspend'),
                      onClick: () => ctx.onSuspend(row),
                      disabled: ctx.busy,
                    },
                  ]
                : [],
          informational: [
            {
              id: 'archive',
              variant: 'neutral',
              label: t('Archiwizuj', 'Archive'),
              onClick: () => ctx.onArchive(row),
              disabled: ctx.busy,
            },
            ...(ctx.onOpenDetail
              ? [
                  {
                    id: 'open-detail',
                    variant: 'neutral' as const,
                    label: t('Otwórz pełną kartę', 'Open full scorecard'),
                    onClick: () => ctx.onOpenDetail?.(row.scorecardId),
                  },
                ]
              : []),
          ],
        },
  };
}

// ==========================================
// Items table (detail page — "Pozycje" tab)
// ==========================================

export function buildKpiScorecardItemColumns(
  isPolish: boolean,
  resolveMemberName?: MemberNameResolver
): TableColumn[] {
  return [
    {
      id: 'kpiId',
      label: 'KPI',
      width: '220px',
      render: (row: KpiScorecardItemDto) => (
        <span className="text-sm text-c-text">
          {row.kpiName ?? resultsEntityNameOrUnknown(undefined, row.kpiId, isPolish, 'indicator')}
        </span>
      ),
    },
    {
      id: 'role',
      label: isPolish ? 'Rola' : 'Role',
      width: '150px',
      filterable: true,
      filterOptions: [
        { value: 'primary', label: kpiScorecardItemRoleLabel('primary', isPolish) },
        { value: 'supporting', label: kpiScorecardItemRoleLabel('supporting', isPolish) },
      ],
      render: (row: KpiScorecardItemDto) => (
        <StatusChip
          label={kpiScorecardItemRoleLabel(row.role, isPolish)}
          tone={row.role === 'primary' ? 'info' : 'neutral'}
        />
      ),
    },
    {
      id: 'sortOrder',
      label: isPolish ? 'Kolejność' : 'Sort order',
      width: '110px',
      align: 'right',
      sortable: true,
      render: (row: KpiScorecardItemDto) => (
        <span className="text-sm tabular-nums text-c-text-secondary">{row.sortOrder}</span>
      ),
    },
    {
      id: 'addedBy',
      label: isPolish ? 'Dodane przez' : 'Added by',
      width: '150px',
      render: (row: KpiScorecardItemDto) => (
        <span className="text-sm text-c-text-secondary">
          {row.addedByName ?? memberNameOrUnknown(resolveMemberName, row.addedBy, isPolish)}
        </span>
      ),
    },
    {
      id: 'addedAt',
      label: isPolish ? 'Dodano' : 'Added',
      width: '150px',
      sortable: true,
      render: (row: KpiScorecardItemDto) => (
        <span className="text-sm text-c-text-secondary">{formatKpiScorecardDate(row.addedAt, isPolish)}</span>
      ),
    },
  ];
}

/** RN-G5 §G #8 — real reorder/remove wiring (was a client-side-only
 * "not built" lock in the P1 read-only package). `isFirst`/`isLast` are
 * computed by the caller from the CURRENTLY VISIBLE (post-role-filter) row
 * order — moving an edge row in that direction is genuinely impossible, a
 * real state lock (TRIADA §C3), not a "feature not built" one. */
export interface KpiScorecardItemRowMenuHandlers {
  onPreview: (row: KpiScorecardItemDto) => void;
  onOpenKpi: (kpiId: string) => void;
  /**
   * P7K część B — „Wpisz rezultat" wprost z raportu (poziom 2). OPCJONALNY:
   * bez niego kebab wygląda dokładnie jak w części A (ekrany, które nie
   * pozwalają zapisywać pomiaru, nie dostają martwej pozycji).
   */
  onRecordMeasurement?: (row: KpiScorecardItemDto) => void;
  onMoveUp: (row: KpiScorecardItemDto) => void;
  onMoveDown: (row: KpiScorecardItemDto) => void;
  onRemove: (row: KpiScorecardItemDto) => void;
  isFirst: boolean;
  isLast: boolean;
  busy?: boolean;
}

export function buildKpiScorecardItemRowMenu(
  row: KpiScorecardItemDto,
  isPolish: boolean,
  handlers: KpiScorecardItemRowMenuHandlers
): StandardRowMenu {
  const edgeReason = {
    up: isPolish ? 'Ta pozycja jest już pierwsza.' : 'This item is already first.',
    down: isPolish ? 'Ta pozycja jest już ostatnia.' : 'This item is already last.',
  };
  return {
    primary: [
      {
        id: 'open-kpi',
        label: isPolish ? 'Otwórz KPI' : 'Open KPI',
        onClick: () => handlers.onOpenKpi(row.kpiId),
      },
      ...(handlers.onRecordMeasurement
        ? [
            {
              id: 'record-measurement',
              label: isPolish ? 'Wpisz rezultat' : 'Record result',
              onClick: () => handlers.onRecordMeasurement!(row),
            },
          ]
        : []),
    ],
    statusTransitions: [
      handlers.isFirst
        ? lockedRowMenuAction({ id: 'move-up', label: isPolish ? 'Przenieś w górę' : 'Move up' }, edgeReason.up)
        : {
            id: 'move-up',
            label: isPolish ? 'Przenieś w górę' : 'Move up',
            onClick: () => handlers.onMoveUp(row),
            disabled: handlers.busy,
          },
      handlers.isLast
        ? lockedRowMenuAction({ id: 'move-down', label: isPolish ? 'Przenieś w dół' : 'Move down' }, edgeReason.down)
        : {
            id: 'move-down',
            label: isPolish ? 'Przenieś w dół' : 'Move down',
            onClick: () => handlers.onMoveDown(row),
            disabled: handlers.busy,
          },
    ],
    universalHandlers: {
      preview: () => handlers.onPreview(row),
    },
    destructive: {
      label: isPolish ? 'Usuń pozycję' : 'Remove item',
      onClick: () => handlers.onRemove(row),
    },
  };
}

export interface KpiScorecardItemPreviewCtx {
  isPolish: boolean;
  resolveMemberName?: MemberNameResolver;
  busy?: boolean;
  onClose: () => void;
  onOpenKpi: (kpiId: string) => void;
  onRemove: (row: KpiScorecardItemDto) => void;
}

export function buildKpiScorecardItemPreview(
  row: KpiScorecardItemDto,
  ctx: KpiScorecardItemPreviewCtx
): StandardPreviewProps {
  const t = (pl: string, en: string) => (ctx.isPolish ? pl : en);
  return {
    title: `KPI ${row.kpiName ?? resultsEntityNameOrUnknown(undefined, row.kpiId, ctx.isPolish, 'indicator')}`,
    onClose: ctx.onClose,
    meta: {
      pills: [{ label: kpiScorecardItemRoleLabel(row.role, ctx.isPolish), tone: row.role === 'primary' ? 'info' : 'neutral' }],
      trailing: (
        <span className="text-[11px] font-semibold text-c-text-secondary">
          {formatKpiScorecardDate(row.addedAt, ctx.isPolish)}
        </span>
      ),
    },
    details: {
      propertyLabel: t('Właściwość', 'Property'),
      valueLabel: t('Wartość', 'Value'),
      properties: [
        {
          id: 'kpi',
          label: t('Wskaźnik', 'Indicator'),
          value:
            row.kpiName ??
            resultsEntityNameOrUnknown(undefined, row.kpiId, ctx.isPolish, 'indicator'),
        },
        { id: 'sortOrder', label: t('Kolejność', 'Sort order'), value: String(row.sortOrder) },
        {
          id: 'addedBy',
          label: t('Dodane przez', 'Added by'),
          value:
            row.addedByName ??
            memberNameOrUnknown(ctx.resolveMemberName, row.addedBy, ctx.isPolish),
        },
        { id: 'addedAt', label: t('Dodano', 'Added'), value: formatKpiScorecardDate(row.addedAt, ctx.isPolish) },
      ],
    },
    ai: { hints: [], disabled: true, disabledTooltip: t('Wkrótce', 'Coming soon') },
    relations: [],
    actions: {
      informational: [
        {
          id: 'open-kpi',
          variant: 'neutral',
          label: t('Otwórz KPI', 'Open KPI'),
          onClick: () => ctx.onOpenKpi(row.kpiId),
        },
        {
          id: 'remove-item',
          variant: 'destructive',
          label: t('Usuń pozycję', 'Remove item'),
          onClick: () => ctx.onRemove(row),
          disabled: ctx.busy,
        },
      ],
    },
  };
}

// ==========================================
// Review snapshots table (detail page — "Migawki przeglądu" tab). Payload
// contents (item facts / statusCounts) deliberately NEVER rendered here —
// see file header (decision #6b non-leak finding).
// ==========================================

export function buildKpiScorecardSnapshotColumns(isPolish: boolean): TableColumn[] {
  return [
    {
      id: 'reviewPeriod',
      label: isPolish ? 'Okres przeglądu' : 'Review period',
      width: '240px',
      sortable: true,
      render: (row: KpiScorecardReviewSnapshotDto) => (
        <span className="text-sm text-c-text">
          {formatKpiScorecardDate(row.reviewPeriodStart, isPolish)} –{' '}
          {formatKpiScorecardDate(row.reviewPeriodEnd, isPolish)}
        </span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: '150px',
      filterable: true,
      filterOptions: (Object.keys(KPI_SCORECARD_SNAPSHOT_STATUS_TONE) as KpiScorecardReviewSnapshotDto['status'][]).map(
        (s) => ({ value: s, label: kpiScorecardSnapshotStatusLabel(s, isPolish) })
      ),
      render: (row: KpiScorecardReviewSnapshotDto) => (
        <StatusChip
          label={kpiScorecardSnapshotStatusLabel(row.status, isPolish)}
          tone={KPI_SCORECARD_SNAPSHOT_STATUS_TONE[row.status]}
        />
      ),
    },
    {
      id: 'publishedAt',
      label: isPolish ? 'Opublikowano' : 'Published',
      width: '150px',
      sortable: true,
      render: (row: KpiScorecardReviewSnapshotDto) => (
        <span className="text-sm text-c-text-secondary">{formatKpiScorecardDate(row.publishedAt, isPolish)}</span>
      ),
    },
    {
      id: 'createdAt',
      label: isPolish ? 'Utworzono' : 'Created',
      width: '150px',
      sortable: true,
      render: (row: KpiScorecardReviewSnapshotDto) => (
        <span className="text-sm text-c-text-secondary">{formatKpiScorecardDate(row.createdAt, isPolish)}</span>
      ),
    },
  ];
}

const SNAPSHOT_TERMINAL_NOTE = {
  pl: 'Migawka nie jest już szkicem — publikacja niedostępna.',
  en: 'Snapshot is no longer a draft — publishing is unavailable.',
};

export interface KpiScorecardSnapshotRowMenuHandlers {
  onPreview: (row: KpiScorecardReviewSnapshotDto) => void;
  onPublish: (row: KpiScorecardReviewSnapshotDto) => void;
  busy?: boolean;
}

export function buildKpiScorecardSnapshotRowMenu(
  row: KpiScorecardReviewSnapshotDto,
  isPolish: boolean,
  handlers: KpiScorecardSnapshotRowMenuHandlers
): StandardRowMenu {
  // Real terminal-state lock (TRIADA §C3) — published/superseded rows can
  // NEVER publish again, regardless of who's asking.
  const isDraft = row.status === 'draft';
  const terminalReason = isPolish ? SNAPSHOT_TERMINAL_NOTE.pl : SNAPSHOT_TERMINAL_NOTE.en;

  return {
    primary: [
      { id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => handlers.onPreview(row) },
    ],
    statusTransitions: [
      isDraft
        ? {
            id: 'publish',
            label: isPolish ? 'Opublikuj' : 'Publish',
            onClick: () => handlers.onPublish(row),
            disabled: handlers.busy,
          }
        : lockedRowMenuAction({ id: 'publish', label: isPolish ? 'Opublikuj' : 'Publish' }, terminalReason),
    ],
    universalHandlers: {
      preview: () => handlers.onPreview(row),
    },
  };
}

export interface KpiScorecardSnapshotPreviewCtx {
  isPolish: boolean;
  resolveMemberName?: MemberNameResolver;
  busy?: boolean;
  onClose: () => void;
  onPublish: (row: KpiScorecardReviewSnapshotDto) => void;
}

export function buildKpiScorecardSnapshotPreview(
  row: KpiScorecardReviewSnapshotDto,
  ctx: KpiScorecardSnapshotPreviewCtx
): StandardPreviewProps {
  const t = (pl: string, en: string) => (ctx.isPolish ? pl : en);
  const isDraft = row.status === 'draft';
  return {
    title: `${formatKpiScorecardDate(row.reviewPeriodStart, ctx.isPolish)} – ${formatKpiScorecardDate(row.reviewPeriodEnd, ctx.isPolish)}`,
    onClose: ctx.onClose,
    meta: {
      pills: [
        { label: kpiScorecardSnapshotStatusLabel(row.status, ctx.isPolish), tone: KPI_SCORECARD_SNAPSHOT_STATUS_TONE[row.status] },
      ],
      recommendation: isDraft
        ? t(
            'Szkic migawki — opublikuj, aby zastąpić poprzednią opublikowaną migawkę tej karty wyników.',
            "Draft snapshot — publish it to replace this scorecard's previous published snapshot."
          )
        : row.status === 'superseded'
          ? t(
              'Migawka zastąpiona — nowsza migawka jest teraz opublikowana.',
              'Snapshot superseded — a newer snapshot is now published.'
            )
          : undefined,
    },
    details: {
      // Deliberately NO snapshotPayload contents here — see file header
      // (decision #6b non-leak finding: a bare listing's stored payload is
      // not re-filtered per-reader the way getPublishedSnapshot's is).
      propertyLabel: t('Właściwość', 'Property'),
      valueLabel: t('Wartość', 'Value'),
      properties: [
        {
          id: 'createdBy',
          label: t('Utworzono przez', 'Created by'),
          value:
            row.createdByName ??
            memberNameOrUnknown(ctx.resolveMemberName, row.createdBy, ctx.isPolish),
        },
        { id: 'createdAt', label: t('Utworzono', 'Created'), value: formatKpiScorecardDate(row.createdAt, ctx.isPolish) },
        {
          id: 'publishedBy',
          label: t('Opublikowano przez', 'Published by'),
          value: row.publishedBy
            ? row.publishedByName ??
              memberNameOrUnknown(ctx.resolveMemberName, row.publishedBy, ctx.isPolish)
            : '—',
        },
        { id: 'publishedAt', label: t('Opublikowano', 'Published'), value: formatKpiScorecardDate(row.publishedAt, ctx.isPolish) },
        {
          id: 'supersededAt',
          label: t('Zastąpiono', 'Superseded'),
          value: formatKpiScorecardDate(row.supersededAt, ctx.isPolish),
        },
        { id: 'contentHash', label: t('Suma treści', 'Content hash'), value: row.contentHash ? shortTechnicalHash(row.contentHash) : '—', mono: true },
      ],
    },
    ai: { hints: [], disabled: true, disabledTooltip: t('Wkrótce', 'Coming soon') },
    relations: [],
    actions: isDraft
      ? {
          resolutions: [
            {
              id: 'publish',
              variant: 'positive',
              label: t('Opublikuj', 'Publish'),
              onClick: () => ctx.onPublish(row),
              disabled: ctx.busy,
            },
          ],
        }
      : undefined,
  };
}

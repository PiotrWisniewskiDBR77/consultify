/**
 * RN-G2 P1 #8 — visual QA harness for KPI Scorecards: the "Scorecards" Menu 2
 * tab on `/results/kpi` (`../../src/components/ResultsVNext/ResultsKpiRegistryPage.tsx`)
 * AND the `/results/kpi/scorecards/:scorecardId` detail route
 * (`ResultsKpiScorecardDetailPage.tsx`). Mounts the REAL
 * `ResultsVNextRegistryShell` fed by the REAL presenter functions from
 * `../../src/components/ResultsVNext/kpiScorecards/kpiScorecardPresenters.tsx`
 * with mock data — NOT the live routed pages themselves, which do real
 * `fetch()` calls with no backend available in this harness (same reasoning
 * `results-vnext-roi-registry.tsx`'s own header documents for its own
 * screen — this is the freshest, cleanest precedent this package mirrors).
 * The live pages' OWN wiring (`Api.get`/`Api.post` calls, `useParams`, the
 * `kpiRegistry` flag gate) is exercised by the app itself, not by dev-render.
 *
 * -- HONEST-VALUE FINDING (see `kpiScorecardApi.ts` header): the KPI backend
 * has NO `'not_calculable'` value anywhere (grepped, zero hits) — only OKR
 * engines produce it. This package's numeric domain is therefore honestly
 * 2-way (`number | null`), not 3-way. There is nothing to mock for a 3-way
 * distinctness screenshot in THIS domain — documented here rather than
 * fabricating a value the backend structurally cannot produce.
 *
 * URL params:
 *   ?screen=results-vnext-kpi-scorecards
 *   &view=list|detail        list = Scorecards tab on /results/kpi (default)
 *                             detail = /results/kpi/scorecards/:id (Pozycje/
 *                             Migawki tabs + record-overview preview)
 *   &tab=items|snapshots     (view=detail only, default items)
 *   &state=ready|loading|empty|error|forbidden   (default ready; forbidden
 *                             only meaningful for view=detail — a deep link
 *                             to a denied/non-existent scorecard)
 *   &selected=<id|none>      pre-select a row (default: first row for
 *                             view=list; unselected/overview for view=detail
 *                             unless given)
 *   &scorecard=sc-1|sc-2|sc-3|sc-4   (view=detail only) which mock record —
 *                             sc-1 = draft, 0 members (demonstrates the real
 *                             `NO_MEMBERS` activation lock, honestly grounded
 *                             in `kpiScorecardCommands.ts`'s own rule);
 *                             sc-2 = active, 3 items, 3 snapshots (all
 *                             lifecycle snapshot states); sc-3 = suspended;
 *                             sc-4 = archived (terminal lock)
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ResultsVNextRegistryShell } from '../../src/components/ResultsVNext/ResultsVNextRegistryShell';
import type {
  KpiScorecardDto,
  KpiScorecardItemDto,
  KpiScorecardItemRole,
  KpiScorecardReviewSnapshotDto,
  KpiScorecardSnapshotStatus,
  ScorecardStatusDistributionDto,
} from '../../src/components/ResultsVNext/kpiScorecards/kpiScorecardApi';
import {
  buildKpiScorecardColumns,
  buildKpiScorecardItemColumns,
  buildKpiScorecardItemPreview,
  buildKpiScorecardItemRowMenu,
  buildKpiScorecardPreview,
  buildKpiScorecardRowMenu,
  buildKpiScorecardSnapshotColumns,
  buildKpiScorecardSnapshotPreview,
  buildKpiScorecardSnapshotRowMenu,
} from '../../src/components/ResultsVNext/kpiScorecards/kpiScorecardPresenters';
import {
  kpiScorecardItemRoleLabel,
  kpiScorecardSnapshotStatusLabel,
} from '../../src/components/ResultsVNext/kpiScorecards/kpiScorecardMappers';
import type { StandardCounterChip, StandardModuleTab, TableRow } from '../../src/components/standard';

// ── Mock scorecards — one per lifecycle status, sc-1 deliberately has ZERO
//    items (see file header — demonstrates the real NO_MEMBERS lock).
const MOCK_SCORECARDS: KpiScorecardDto[] = [
  {
    scorecardId: 'sc-1',
    organizationId: 'org-dbr77-demo',
    name: 'Karta wyników — Produkcja (szkic)',
    description: 'Szkic karty wyników linii produkcyjnej, jeszcze bez pozycji.',
    scopeType: 'process',
    scopeId: 'proc-produkcja-1',
    ownerUserId: 'user-piotr-demo',
    reviewFrequency: 'monthly',
    lifecycleStatus: 'draft',
    rowVersion: 1,
    createdBy: 'user-piotr-demo',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
  },
  {
    scorecardId: 'sc-2',
    organizationId: 'org-dbr77-demo',
    name: 'Karta wyników — Jakość Q3',
    description: 'Kwartalny przegląd jakości dla linii pakowania.',
    scopeType: 'business_unit',
    scopeId: 'bu-jakosc',
    ownerUserId: 'user-anna',
    reviewFrequency: 'quarterly',
    lifecycleStatus: 'active',
    rowVersion: 6,
    createdBy: 'user-anna',
    createdAt: '2026-05-01T08:00:00Z',
    updatedAt: '2026-08-09T09:30:00Z',
  },
  {
    scorecardId: 'sc-3',
    organizationId: 'org-dbr77-demo',
    name: 'Karta wyników — HR Redukcja Kosztów',
    description: null,
    scopeType: 'team',
    scopeId: 'team-hr',
    ownerUserId: 'user-marek',
    reviewFrequency: 'monthly',
    lifecycleStatus: 'suspended',
    rowVersion: 4,
    createdBy: 'user-marek',
    createdAt: '2026-04-12T08:00:00Z',
    updatedAt: '2026-07-20T09:30:00Z',
  },
  {
    scorecardId: 'sc-4',
    organizationId: 'org-dbr77-demo',
    name: 'Karta wyników — Zamknięcie miesiąca (archiwalna)',
    description: 'Zastąpiona nowym procesem zamknięcia.',
    scopeType: 'organization',
    scopeId: null,
    ownerUserId: 'user-piotr-demo',
    reviewFrequency: 'monthly',
    lifecycleStatus: 'archived',
    rowVersion: 11,
    createdBy: 'user-piotr-demo',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-06-30T08:00:00Z',
  },
];

const MOCK_ITEMS: Record<string, KpiScorecardItemDto[]> = {
  'sc-1': [],
  'sc-2': [
    {
      itemId: 'item-1',
      scorecardId: 'sc-2',
      kpiId: 'kpi-oee-linia-pakowania-001',
      organizationId: 'org-dbr77-demo',
      role: 'primary',
      sortOrder: 1,
      displayConfig: null,
      addedBy: 'user-anna',
      addedAt: '2026-05-02T08:00:00Z',
    },
    {
      itemId: 'item-2',
      scorecardId: 'sc-2',
      kpiId: 'kpi-defekty-na-milion-002',
      organizationId: 'org-dbr77-demo',
      role: 'primary',
      sortOrder: 2,
      displayConfig: null,
      addedBy: 'user-anna',
      addedAt: '2026-05-02T08:05:00Z',
    },
    {
      itemId: 'item-3',
      scorecardId: 'sc-2',
      kpiId: 'kpi-czas-przestoju-003',
      organizationId: 'org-dbr77-demo',
      role: 'supporting',
      sortOrder: 3,
      displayConfig: null,
      addedBy: 'user-piotr-demo',
      addedAt: '2026-06-10T11:00:00Z',
    },
  ],
  'sc-3': [
    {
      itemId: 'item-4',
      scorecardId: 'sc-3',
      kpiId: 'kpi-koszt-pracy-004',
      organizationId: 'org-dbr77-demo',
      role: 'primary',
      sortOrder: 1,
      displayConfig: null,
      addedBy: 'user-marek',
      addedAt: '2026-04-12T09:00:00Z',
    },
  ],
  'sc-4': [
    {
      itemId: 'item-5',
      scorecardId: 'sc-4',
      kpiId: 'kpi-cykl-zamkniecia-005',
      organizationId: 'org-dbr77-demo',
      role: 'primary',
      sortOrder: 1,
      displayConfig: null,
      addedBy: 'user-piotr-demo',
      addedAt: '2026-01-10T09:00:00Z',
    },
  ],
};

const MOCK_SNAPSHOTS: Record<string, KpiScorecardReviewSnapshotDto[]> = {
  'sc-1': [],
  'sc-2': [
    {
      snapshotId: 'snap-1',
      scorecardId: 'sc-2',
      organizationId: 'org-dbr77-demo',
      reviewPeriodStart: '2026-07-01T00:00:00Z',
      reviewPeriodEnd: '2026-07-31T23:59:59Z',
      snapshotPayload: null,
      status: 'superseded',
      contentHash: 'hash-abc123def456',
      publishedBy: 'user-anna',
      publishedAt: '2026-08-01T10:00:00Z',
      supersededBySnapshotId: 'snap-2',
      supersededAt: '2026-08-05T10:00:00Z',
      rowVersion: 3,
      createdBy: 'user-anna',
      createdAt: '2026-07-31T18:00:00Z',
      updatedAt: '2026-08-05T10:00:00Z',
    },
    {
      snapshotId: 'snap-2',
      scorecardId: 'sc-2',
      organizationId: 'org-dbr77-demo',
      reviewPeriodStart: '2026-08-01T00:00:00Z',
      reviewPeriodEnd: '2026-08-07T23:59:59Z',
      snapshotPayload: null,
      status: 'published',
      contentHash: 'hash-fed654cba321',
      publishedBy: 'user-anna',
      publishedAt: '2026-08-08T09:00:00Z',
      supersededBySnapshotId: null,
      supersededAt: null,
      rowVersion: 2,
      createdBy: 'user-anna',
      createdAt: '2026-08-07T18:00:00Z',
      updatedAt: '2026-08-08T09:00:00Z',
    },
    {
      snapshotId: 'snap-3',
      scorecardId: 'sc-2',
      organizationId: 'org-dbr77-demo',
      reviewPeriodStart: '2026-08-08T00:00:00Z',
      reviewPeriodEnd: '2026-08-14T23:59:59Z',
      snapshotPayload: null,
      status: 'draft',
      contentHash: null,
      publishedBy: null,
      publishedAt: null,
      supersededBySnapshotId: null,
      supersededAt: null,
      rowVersion: 1,
      createdBy: 'user-piotr-demo',
      createdAt: '2026-08-09T09:00:00Z',
      updatedAt: '2026-08-09T09:00:00Z',
    },
  ],
  'sc-3': [],
  'sc-4': [],
};

const MOCK_DISTRIBUTION: Record<string, ScorecardStatusDistributionDto> = {
  'sc-1': { safe: 0, warning: 0, critical: 0, missing: 0, totalVisible: 0 },
  'sc-2': { safe: 1, warning: 1, critical: 0, missing: 1, totalVisible: 3 },
  'sc-3': { safe: 0, warning: 0, critical: 1, missing: 0, totalVisible: 1 },
  'sc-4': { safe: 0, warning: 0, critical: 0, missing: 1, totalVisible: 1 },
};

function withId<T extends object>(row: T, idKey: keyof T): T & { id: string } {
  return { ...row, id: String(row[idKey]) };
}

const params = new URLSearchParams(window.location.search);
const initialView = (params.get('view') as 'list' | 'detail') || 'list';
const initialTab = (params.get('tab') as 'items' | 'snapshots') || 'items';
const state = params.get('state') || 'ready';
const initialSelected = params.get('selected');
const mockScorecardId = params.get('scorecard') || 'sc-2';

const NOOP = () => {};

const ResultsVNextKpiScorecardsScreen: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [view] = useState<'list' | 'detail'>(initialView);
  const [listTab, setListTab] = useState<'my' | 'org' | 'scorecards'>('scorecards');
  const [selectedScorecardId, setSelectedScorecardId] = useState<string | null>(
    initialSelected === 'none' ? null : (initialSelected ?? MOCK_SCORECARDS[0]?.scorecardId ?? null)
  );

  const [detailTab, setDetailTab] = useState<'items' | 'snapshots'>(initialTab);
  const [itemRoleChip, setItemRoleChip] = useState<'all' | KpiScorecardItemRole>('all');
  const [snapshotStatusChip, setSnapshotStatusChip] = useState<'all' | KpiScorecardSnapshotStatus>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSelected === 'none' ? null : initialSelected
  );
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    initialSelected === 'none' ? null : initialSelected
  );

  // ── LIST VIEW — the "Scorecards" Menu 2 tab on /results/kpi ─────────────
  if (view === 'list') {
    const tabs: StandardModuleTab[] = [
      { id: 'my', label: isPolish ? 'Moje' : 'My' },
      { id: 'org', label: isPolish ? 'Organizacja' : 'Org' },
      { id: 'scorecards', label: isPolish ? 'Karty wyników' : 'Scorecards' },
    ];

    if (listTab !== 'scorecards') {
      return (
        <div className="h-screen bg-c-bg text-c-text">
          <ResultsVNextRegistryShell
            domain="kpi"
            moduleBar={{ tabs, activeTab: listTab, onTabChange: (id) => setListTab(id as typeof listTab), showTabCounts: false }}
            table={{
              columns: [],
              data: [],
              persistKey: 'results-vnext.kpi-registry',
              empty: {
                title: isPolish ? 'Zobacz results-vnext-kpi-registry' : 'See results-vnext-kpi-registry',
                description: isPolish
                  ? 'Zakładki Moje/Organizacja są pokryte w osobnym ekranie harnessu (results-vnext-kpi-registry).'
                  : 'The My/Org tabs are covered by a separate harness screen (results-vnext-kpi-registry).',
              },
            }}
            preview={null}
          />
        </div>
      );
    }

    const rows: TableRow[] = state === 'empty' ? [] : MOCK_SCORECARDS.map((r) => withId(r, 'scorecardId'));
    const selectedRow = MOCK_SCORECARDS.find((r) => r.scorecardId === selectedScorecardId) ?? null;

    return (
      <div className="h-screen bg-c-bg text-c-text">
        <ResultsVNextRegistryShell
          domain="kpi"
          moduleBar={{ tabs, activeTab: listTab, onTabChange: (id) => setListTab(id as typeof listTab), showTabCounts: false }}
          table={{
            columns: buildKpiScorecardColumns(isPolish, 'user-piotr-demo'),
            data: rows,
            persistKey: 'results-vnext.kpi-scorecards',
            loading: state === 'loading',
            error:
              state === 'error'
                ? isPolish
                  ? 'Nie udało się wczytać kart wyników — usługa zwróciła 503.'
                  : 'Failed to load scorecards — the service returned 503.'
                : null,
            onRetry: NOOP,
            empty:
              state === 'empty'
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
                busy: false,
                onOpenDetail: NOOP,
                onActivate: NOOP,
                onSuspend: NOOP,
                onArchive: NOOP,
              }),
            defaultSort: { columnId: 'updatedAt', direction: 'desc' },
          }}
          preview={
            state === 'ready' && selectedRow
              ? buildKpiScorecardPreview(selectedRow, {
                  isPolish,
                  currentUserId: 'user-piotr-demo',
                  busy: false,
                  onOpenDetail: NOOP,
                  onActivate: NOOP,
                  onSuspend: NOOP,
                  onArchive: NOOP,
                  onClose: () => setSelectedScorecardId(null),
                })
              : null
          }
        />
      </div>
    );
  }

  // ── DETAIL VIEW — /results/kpi/scorecards/:scorecardId ──────────────────
  const scorecard = MOCK_SCORECARDS.find((s) => s.scorecardId === mockScorecardId) ?? MOCK_SCORECARDS[1];
  const items = MOCK_ITEMS[scorecard.scorecardId] ?? [];
  const snapshots = MOCK_SNAPSHOTS[scorecard.scorecardId] ?? [];
  const distribution = state === 'loading' ? 'loading' : MOCK_DISTRIBUTION[scorecard.scorecardId];

  const tabs: StandardModuleTab[] = [
    { id: 'items', label: isPolish ? 'Pozycje' : 'Items' },
    { id: 'snapshots', label: isPolish ? 'Migawki przeglądu' : 'Review snapshots' },
  ];

  const overviewPreview = useMemo(
    () =>
      buildKpiScorecardPreview(scorecard, {
        isPolish,
        currentUserId: 'user-piotr-demo',
        busy: false,
        statusDistribution: distribution,
        memberCount: items.length,
        onActivate: NOOP,
        onSuspend: NOOP,
        onArchive: NOOP,
        onClose: () => {
          setSelectedItemId(null);
          setSelectedSnapshotId(null);
        },
      }),
    [scorecard, isPolish, distribution, items.length]
  );

  if (state === 'forbidden') {
    return (
      <div className="h-screen bg-c-bg text-c-text">
        <ResultsVNextRegistryShell
          domain="kpi"
          moduleBar={{ tabs, activeTab: detailTab, onTabChange: (id) => setDetailTab(id as typeof detailTab), showTabCounts: false }}
          table={{ columns: [], data: [], persistKey: 'results-vnext.kpi-scorecards.detail' }}
          preview={null}
          forbidden={{ reason: 'NO_VISIBILITY_RECORD' }}
          onForbiddenBack={NOOP}
        />
      </div>
    );
  }

  if (detailTab === 'snapshots') {
    const filtered = snapshotStatusChip === 'all' ? snapshots : snapshots.filter((s) => s.status === snapshotStatusChip);
    const rows: TableRow[] = state === 'empty' ? [] : filtered.map((s) => withId(s, 'snapshotId'));
    const selectedSnapshot = filtered.find((s) => s.snapshotId === selectedSnapshotId) ?? null;
    const chips: StandardCounterChip[] = [
      { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: snapshots.length },
      { id: 'draft', label: kpiScorecardSnapshotStatusLabel('draft', isPolish), count: snapshots.filter((s) => s.status === 'draft').length },
      { id: 'published', label: kpiScorecardSnapshotStatusLabel('published', isPolish), count: snapshots.filter((s) => s.status === 'published').length },
      { id: 'superseded', label: kpiScorecardSnapshotStatusLabel('superseded', isPolish), count: snapshots.filter((s) => s.status === 'superseded').length },
    ];

    return (
      <div className="h-screen bg-c-bg text-c-text">
        <ResultsVNextRegistryShell
          domain="kpi"
          moduleBar={{
            tabs,
            activeTab: detailTab,
            onTabChange: (id) => setDetailTab(id as typeof detailTab),
            showTabCounts: false,
            chips,
            activeChip: snapshotStatusChip,
            onChipChange: (id) => setSnapshotStatusChip(id as typeof snapshotStatusChip),
          }}
          table={{
            columns: buildKpiScorecardSnapshotColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.kpi-scorecards.snapshots',
            loading: state === 'loading',
            error: state === 'error' ? (isPolish ? 'Nie udało się wczytać migawek.' : 'Failed to load snapshots.') : null,
            onRetry: NOOP,
            empty:
              state !== 'loading' && state !== 'error' && rows.length === 0
                ? { title: isPolish ? 'Brak migawek przeglądu' : 'No review snapshots yet' }
                : undefined,
            selectedRowId: selectedSnapshotId,
            onRowClick: (row) => setSelectedSnapshotId(String(row.snapshotId)),
            rowMenu: (row) =>
              buildKpiScorecardSnapshotRowMenu(row as unknown as KpiScorecardReviewSnapshotDto, isPolish, {
                onPreview: (r) => setSelectedSnapshotId(r.snapshotId),
              }),
            defaultSort: { columnId: 'createdAt', direction: 'desc' },
          }}
          preview={
            state === 'ready'
              ? selectedSnapshot
                ? buildKpiScorecardSnapshotPreview(selectedSnapshot, { isPolish, onClose: () => setSelectedSnapshotId(null) })
                : overviewPreview
              : null
          }
        />
      </div>
    );
  }

  const filteredItems = itemRoleChip === 'all' ? items : items.filter((i) => i.role === itemRoleChip);
  const itemRows: TableRow[] = state === 'empty' ? [] : filteredItems.map((i) => withId(i, 'itemId'));
  const selectedItem = filteredItems.find((i) => i.itemId === selectedItemId) ?? null;
  const itemChips: StandardCounterChip[] = [
    { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: items.length },
    { id: 'primary', label: kpiScorecardItemRoleLabel('primary', isPolish), count: items.filter((i) => i.role === 'primary').length },
    { id: 'supporting', label: kpiScorecardItemRoleLabel('supporting', isPolish), count: items.filter((i) => i.role === 'supporting').length },
  ];

  return (
    <div className="h-screen bg-c-bg text-c-text">
      <ResultsVNextRegistryShell
        domain="kpi"
        moduleBar={{
          tabs,
          activeTab: detailTab,
          onTabChange: (id) => setDetailTab(id as typeof detailTab),
          showTabCounts: false,
          chips: itemChips,
          activeChip: itemRoleChip,
          onChipChange: (id) => setItemRoleChip(id as typeof itemRoleChip),
        }}
        table={{
          columns: buildKpiScorecardItemColumns(isPolish),
          data: itemRows,
          persistKey: 'results-vnext.kpi-scorecards.items',
          loading: state === 'loading',
          error: state === 'error' ? (isPolish ? 'Nie udało się wczytać pozycji.' : 'Failed to load items.') : null,
          onRetry: NOOP,
          empty:
            state !== 'loading' && state !== 'error' && itemRows.length === 0
              ? {
                  title: isPolish ? 'Brak pozycji na karcie wyników' : 'No items on this scorecard',
                  description: isPolish
                    ? 'Dodaj pierwszy KPI do tej karty wyników (poza zakresem tego pakietu).'
                    : 'Add the first KPI to this scorecard (out of scope for this package).',
                }
              : undefined,
          selectedRowId: selectedItemId,
          onRowClick: (row) => setSelectedItemId(String(row.itemId)),
          rowMenu: (row) =>
            buildKpiScorecardItemRowMenu(row as unknown as KpiScorecardItemDto, isPolish, {
              onPreview: (r) => setSelectedItemId(r.itemId),
              onOpenKpi: NOOP,
            }),
          defaultSort: { columnId: 'sortOrder', direction: 'asc' },
        }}
        preview={
          state === 'ready'
            ? selectedItem
              ? buildKpiScorecardItemPreview(selectedItem, { isPolish, onClose: () => setSelectedItemId(null), onOpenKpi: NOOP })
              : overviewPreview
            : null
        }
      />
    </div>
  );
};

export default ResultsVNextKpiScorecardsScreen;

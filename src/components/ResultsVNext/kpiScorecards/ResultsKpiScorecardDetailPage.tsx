/**
 * /results/kpi/scorecards/:scorecardId — RN-G2 P1 #8 KPI Scorecard detail
 * (RN_G2_UI_SCOPE.md §G item 8, master plan §11 route). Real data, behind the
 * SAME `kpiRegistry` flag as `../ResultsKpiRegistryPage.tsx` — Scorecards are
 * part of the KPI domain vertical, and `resultsVNextFeatureFlags.ts`'s own
 * documented convention is "one flag per domain, not per screen" (a domain's
 * registry/preview/full-tool ship and are reviewed together). When the flag
 * is off, this route renders the SAME honest-empty fallback shape as
 * `../ResultsRoiRegistryPage.tsx` (task requirement — verified byte-for-byte
 * against that file, not reinvented).
 *
 * -- ★ ARCHETYPE DECISION (explicit, per task brief — RN_G2_UI_SCOPE.md Open
 * Question #2 is UNRESOLVED, do not silently pick a side): whether a full
 * KPI/ROI/OKR "full-tool" screen should be SPEC-A Archetyp C klasa L (via
 * `StandardArtifactShell`/`ArtifactRightPanel`) or a new pattern is an open
 * architecture-owner call. This screen deliberately does NOT use
 * `StandardArtifactShell` — it stays a LIST surface: the scorecard's items
 * and review snapshots are each rendered as a `StandardTable` inside the
 * SAME `ResultsVNextRegistryShell` the registry list uses, switched by Menu 2
 * tabs, exactly like `../roi/ResultsRoiHub.tsx`'s "All cases"/"Benefits
 * realization" tab pair. This is a scope-boundary decision to defer the
 * archetype question, not a claim that it's resolved.
 *
 * Two Menu 2 tabs, both real backend data:
 *  - "Pozycje" (Items)     → `GET .../items` (no add/remove/reorder UI — see
 *                             `kpiScorecardPresenters.tsx`'s "not built"
 *                             row-menu notes; those write endpoints exist
 *                             server-side but are a later package).
 *  - "Migawki przeglądu"   → `GET .../review-snapshots` (no publish UI —
 *    (Review snapshots)      same "not built" treatment; snapshot PAYLOAD
 *                             contents are never rendered here regardless —
 *                             see `kpiScorecardPresenters.tsx` header for the
 *                             decision #6b non-leak finding this uncovered).
 *
 * The preview pane shows the SELECTED item/snapshot row when one is picked,
 * and otherwise falls back to a "scorecard record overview" preview (same
 * `buildKpiScorecardPreview` the registry list tab uses) carrying the real
 * `GET .../status` distribution ("realne źródło stanu karty" per the task
 * brief — rendered as-is, no invented health thresholds) and the scorecard's
 * own lifecycle actions (activate/suspend/archive) — this is a deliberate
 * design choice (documented, not accidental) so the record-level honest
 * state is always reachable without a bespoke header slot
 * `ResultsVNextRegistryShell` does not expose (that shared shell is owned by
 * a different workstream — RN-G2 must not extend its contract unilaterally).
 *
 * Deep-link forbidden (§D): `GET /:scorecardId` collapses "does not exist"
 * and "visibility-denied" into the same 404 (see `kpiScorecardApi.ts`
 * header) — this page always renders `NO_VISIBILITY_RECORD`
 * (RN_G1_PLATFORM_DESIGN.md §B's fail-closed default), same convention
 * `../ResultsKpiRegistryPage.tsx`'s own `?kpiId=` deep link already uses.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Blocks } from 'lucide-react';

import { EmptyState } from '@/components/shared/states';
import type { StandardCounterChip, StandardModuleTab } from '@/components/standard';
import { useAppStore } from '@/store/useAppStore';
import { ROUTES } from '@/routes/routeConfig';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import type { ResultsVNextForbiddenDetail } from '../types';
import {
  activateKpiScorecard,
  archiveKpiScorecard,
  getKpiScorecard,
  getKpiScorecardStatusDistribution,
  listKpiScorecardItems,
  listKpiScorecardReviewSnapshots,
  suspendKpiScorecard,
  type KpiScorecardDto,
  type KpiScorecardItemDto,
  type KpiScorecardItemRole,
  type KpiScorecardReviewSnapshotDto,
  type KpiScorecardSnapshotStatus,
  type ScorecardStatusDistributionDto,
} from './kpiScorecardApi';
import {
  buildKpiScorecardItemColumns,
  buildKpiScorecardItemPreview,
  buildKpiScorecardItemRowMenu,
  buildKpiScorecardPreview,
  buildKpiScorecardSnapshotColumns,
  buildKpiScorecardSnapshotPreview,
  buildKpiScorecardSnapshotRowMenu,
} from './kpiScorecardPresenters';
import { kpiScorecardItemRoleLabel, kpiScorecardSnapshotStatusLabel } from './kpiScorecardMappers';

type DetailTab = 'items' | 'snapshots';
type PendingAction = 'activate' | 'suspend' | 'archive' | null;

function withId<T extends object>(row: T, idKey: keyof T): T & { id: string } {
  return { ...row, id: String(row[idKey]) };
}

export const ResultsKpiScorecardDetailPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const { scorecardId } = useParams<{ scorecardId: string }>();
  const enabled = isResultsVNextFlagEnabled('kpiRegistry');

  const [scorecard, setScorecard] = useState<KpiScorecardDto | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [scorecardError, setScorecardError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<ResultsVNextForbiddenDetail | null>(null);
  const [distribution, setDistribution] = useState<ScorecardStatusDistributionDto | 'loading' | undefined>(
    undefined
  );
  const [pending, setPending] = useState<PendingAction>(null);

  const [tab, setTab] = useState<DetailTab>('items');

  const [items, setItems] = useState<KpiScorecardItemDto[] | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemRoleChip, setItemRoleChip] = useState<'all' | KpiScorecardItemRole>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [snapshots, setSnapshots] = useState<KpiScorecardReviewSnapshotDto[] | null>(null);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const [snapshotStatusChip, setSnapshotStatusChip] = useState<'all' | KpiScorecardSnapshotStatus>('all');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const loadScorecard = useCallback(async () => {
    if (!scorecardId) return;
    setScorecardLoading(true);
    setScorecardError(null);
    try {
      const record = await getKpiScorecard(scorecardId);
      if (!record) {
        setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
        setScorecard(null);
        return;
      }
      setForbidden(null);
      setScorecard(record);
      setDistribution('loading');
      getKpiScorecardStatusDistribution(scorecardId)
        .then((d) => setDistribution(d))
        .catch(() => setDistribution(undefined));
    } catch (err) {
      setScorecardError(err instanceof Error ? err.message : String(err));
    } finally {
      setScorecardLoading(false);
    }
  }, [scorecardId]);

  useEffect(() => {
    if (!enabled) return;
    void loadScorecard();
  }, [enabled, loadScorecard]);

  const loadItems = useCallback(() => {
    if (!scorecardId) return;
    setItemsLoading(true);
    setItemsError(null);
    listKpiScorecardItems(scorecardId)
      .then((rows) => setItems(rows))
      .catch((err) => setItemsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setItemsLoading(false));
  }, [scorecardId]);

  const loadSnapshots = useCallback(() => {
    if (!scorecardId) return;
    setSnapshotsLoading(true);
    setSnapshotsError(null);
    listKpiScorecardReviewSnapshots(scorecardId)
      .then((rows) => setSnapshots(rows))
      .catch((err) => setSnapshotsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSnapshotsLoading(false));
  }, [scorecardId]);

  useEffect(() => {
    if (!enabled || !scorecard) return;
    if (tab === 'items' && items === null && !itemsLoading) loadItems();
    if (tab === 'snapshots' && snapshots === null && !snapshotsLoading) loadSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scorecard, tab]);

  const runLifecycleAction = useCallback(
    async (row: KpiScorecardDto, action: 'activate' | 'suspend' | 'archive') => {
      setPending(action);
      try {
        const runner =
          action === 'activate' ? activateKpiScorecard : action === 'suspend' ? suspendKpiScorecard : archiveKpiScorecard;
        await runner({ scorecardId: row.scorecardId, expectedVersion: row.rowVersion });
        await loadScorecard();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setPending(null);
      }
    },
    [loadScorecard]
  );

  const onOpenKpi = useCallback(
    (kpiId: string) => navigate(`${ROUTES.RESULTS_KPI.ROOT}?kpiId=${encodeURIComponent(kpiId)}`),
    [navigate]
  );

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (itemRoleChip === 'all') return items;
    return items.filter((i) => i.role === itemRoleChip);
  }, [items, itemRoleChip]);

  const filteredSnapshots = useMemo(() => {
    if (!snapshots) return [];
    if (snapshotStatusChip === 'all') return snapshots;
    return snapshots.filter((s) => s.status === snapshotStatusChip);
  }, [snapshots, snapshotStatusChip]);

  const selectedItem = filteredItems.find((i) => i.itemId === selectedItemId) ?? null;
  const selectedSnapshot = filteredSnapshots.find((s) => s.snapshotId === selectedSnapshotId) ?? null;

  if (!enabled) {
    // Byte-for-byte the same honest-empty shape as
    // `../ResultsRoiRegistryPage.tsx`'s disabled fallback (task requirement).
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-kpi-scorecard-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={isPolish ? 'Karty wyników KPI — jeszcze nie włączone' : 'KPI scorecards — not yet enabled'}
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

  const tabs: StandardModuleTab[] = [
    { id: 'items', label: isPolish ? 'Pozycje' : 'Items' },
    { id: 'snapshots', label: isPolish ? 'Migawki przeglądu' : 'Review snapshots' },
  ];

  // Error resolving the scorecard header itself (network/5xx — distinct from
  // the 404-shaped `forbidden` case above, which is a real, expected DENY).
  if (!forbidden && !scorecard && scorecardError) {
    return (
      <div className="h-full" data-testid="results-vnext-kpi-scorecard-detail-page">
        <ResultsVNextRegistryShell
          domain="kpi"
          moduleBar={{ tabs, activeTab: tab, onTabChange: (id) => setTab(id as DetailTab), showTabCounts: false }}
          table={{
            columns: [],
            data: [],
            persistKey: 'results-vnext.kpi-scorecards.detail',
            error: scorecardError,
            onRetry: () => void loadScorecard(),
          }}
          preview={null}
        />
      </div>
    );
  }

  // Loading (scorecard header not resolved yet, not forbidden, no error) —
  // keeps header/column geometry alive via StandardTable's own `loading`
  // rather than blanking the shell (§D requirement).
  if (!forbidden && !scorecard && !scorecardError) {
    return (
      <div className="h-full" data-testid="results-vnext-kpi-scorecard-detail-page">
        <ResultsVNextRegistryShell
          domain="kpi"
          moduleBar={{ tabs, activeTab: tab, onTabChange: (id) => setTab(id as DetailTab), showTabCounts: false }}
          table={{ columns: [], data: [], persistKey: 'results-vnext.kpi-scorecards.detail', loading: scorecardLoading || true }}
          preview={null}
        />
      </div>
    );
  }

  const scorecardOverviewPreview =
    scorecard != null
      ? buildKpiScorecardPreview(scorecard, {
          isPolish,
          currentUserId: currentUser?.id,
          busy: pending !== null,
          statusDistribution: distribution,
          memberCount: items?.length,
          onActivate: (r) => void runLifecycleAction(r, 'activate'),
          onSuspend: (r) => void runLifecycleAction(r, 'suspend'),
          onArchive: (r) => void runLifecycleAction(r, 'archive'),
          onClose: () => {
            setSelectedItemId(null);
            setSelectedSnapshotId(null);
          },
        })
      : null;

  if (tab === 'snapshots') {
    const rows = filteredSnapshots.map((s) => withId(s, 'snapshotId'));
    const chips: StandardCounterChip[] = [
      { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: snapshots?.length ?? 0 },
      {
        id: 'draft',
        label: kpiScorecardSnapshotStatusLabel('draft', isPolish),
        count: (snapshots ?? []).filter((s) => s.status === 'draft').length,
      },
      {
        id: 'published',
        label: kpiScorecardSnapshotStatusLabel('published', isPolish),
        count: (snapshots ?? []).filter((s) => s.status === 'published').length,
      },
      {
        id: 'superseded',
        label: kpiScorecardSnapshotStatusLabel('superseded', isPolish),
        count: (snapshots ?? []).filter((s) => s.status === 'superseded').length,
      },
    ];

    return (
      <div className="h-full" data-testid="results-vnext-kpi-scorecard-detail-page">
        <ResultsVNextRegistryShell
          domain="kpi"
          moduleBar={{
            tabs,
            activeTab: tab,
            onTabChange: (id) => setTab(id as DetailTab),
            showTabCounts: false,
            chips,
            activeChip: snapshotStatusChip,
            onChipChange: (id) => setSnapshotStatusChip(id as 'all' | KpiScorecardSnapshotStatus),
          }}
          table={{
            columns: buildKpiScorecardSnapshotColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.kpi-scorecards.snapshots',
            loading: snapshotsLoading,
            error: snapshotsError,
            onRetry: loadSnapshots,
            empty:
              !snapshotsLoading && !snapshotsError && (snapshots?.length ?? 0) === 0
                ? {
                    title: isPolish ? 'Brak migawek przeglądu' : 'No review snapshots yet',
                    description: isPolish
                      ? 'Ta karta wyników nie ma jeszcze żadnej migawki przeglądu.'
                      : 'This scorecard has no review snapshot yet.',
                  }
                : undefined,
            emptyMessage:
              !snapshotsLoading && !snapshotsError && (snapshots?.length ?? 0) > 0 && rows.length === 0
                ? isPolish
                  ? 'Brak migawek pasujących do filtra.'
                  : 'No snapshot matches this filter.'
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
            selectedSnapshot
              ? buildKpiScorecardSnapshotPreview(selectedSnapshot, {
                  isPolish,
                  onClose: () => setSelectedSnapshotId(null),
                })
              : scorecardOverviewPreview
          }
          forbidden={forbidden}
          onForbiddenBack={() => navigate(ROUTES.RESULTS_KPI.ROOT)}
        />
      </div>
    );
  }

  const itemRows = filteredItems.map((i) => withId(i, 'itemId'));
  const itemChips: StandardCounterChip[] = [
    { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: items?.length ?? 0 },
    {
      id: 'primary',
      label: kpiScorecardItemRoleLabel('primary', isPolish),
      count: (items ?? []).filter((i) => i.role === 'primary').length,
    },
    {
      id: 'supporting',
      label: kpiScorecardItemRoleLabel('supporting', isPolish),
      count: (items ?? []).filter((i) => i.role === 'supporting').length,
    },
  ];

  return (
    <div className="h-full" data-testid="results-vnext-kpi-scorecard-detail-page">
      <ResultsVNextRegistryShell
        domain="kpi"
        moduleBar={{
          tabs,
          activeTab: tab,
          onTabChange: (id) => setTab(id as DetailTab),
          showTabCounts: false,
          chips: itemChips,
          activeChip: itemRoleChip,
          onChipChange: (id) => setItemRoleChip(id as 'all' | KpiScorecardItemRole),
        }}
        table={{
          columns: buildKpiScorecardItemColumns(isPolish),
          data: itemRows,
          persistKey: 'results-vnext.kpi-scorecards.items',
          loading: itemsLoading,
          error: itemsError,
          onRetry: loadItems,
          empty:
            !itemsLoading && !itemsError && (items?.length ?? 0) === 0
              ? {
                  title: isPolish ? 'Brak pozycji na karcie wyników' : 'No items on this scorecard',
                  description: isPolish
                    ? 'Dodaj pierwszy KPI do tej karty wyników (poza zakresem tego pakietu).'
                    : 'Add the first KPI to this scorecard (out of scope for this package).',
                }
              : undefined,
          emptyMessage:
            !itemsLoading && !itemsError && (items?.length ?? 0) > 0 && itemRows.length === 0
              ? isPolish
                ? 'Brak pozycji pasujących do filtra.'
                : 'No item matches this filter.'
              : undefined,
          selectedRowId: selectedItemId,
          onRowClick: (row) => setSelectedItemId(String(row.itemId)),
          rowMenu: (row) =>
            buildKpiScorecardItemRowMenu(row as unknown as KpiScorecardItemDto, isPolish, {
              onPreview: (r) => setSelectedItemId(r.itemId),
              onOpenKpi,
            }),
          defaultSort: { columnId: 'sortOrder', direction: 'asc' },
        }}
        preview={
          selectedItem
            ? buildKpiScorecardItemPreview(selectedItem, { isPolish, onClose: () => setSelectedItemId(null), onOpenKpi })
            : scorecardOverviewPreview
        }
        forbidden={forbidden}
        onForbiddenBack={() => navigate(ROUTES.RESULTS_KPI.ROOT)}
      />
    </div>
  );
};

export default ResultsKpiScorecardDetailPage;

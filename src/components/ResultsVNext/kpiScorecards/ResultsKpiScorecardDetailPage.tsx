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
import { Blocks, Plus } from 'lucide-react';

import { EmptyState } from '@/components/shared/states';
import type { StandardCounterChip, StandardModuleTab } from '@/components/standard';
import { SelectField } from '@/components/ui/primitives';
import { memberNameOrUnknown, useOrganizationMemberNames } from '@/hooks/useOrganizationMemberNames';
import { useResultsEntityNames } from '@/hooks/useResultsEntityNames';
import { useAppStore } from '@/store/useAppStore';
import { ROUTES } from '@/routes/routeConfig';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import { getResultsDomainPath, getResultsDomainTabs, isResultsDomain } from '../resultsDomainNavigation';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import type { ResultsVNextForbiddenDetail } from '../types';
import {
  activateKpiScorecard,
  addKpiScorecardItem,
  archiveKpiScorecard,
  createKpiScorecardReviewSnapshot,
  getKpiScorecard,
  getKpiScorecardPeriodMatrix,
  getKpiScorecardStatusDistribution,
  getPublishedKpiScorecardSnapshot,
  httpErrorCode,
  listKpiScorecardItems,
  listKpiScorecardReviewSnapshots,
  publishKpiScorecardReviewSnapshot,
  removeKpiScorecardItem,
  reorderKpiScorecardItems,
  suspendKpiScorecard,
  type KpiScorecardDto,
  type KpiScorecardItemDto,
  type KpiScorecardItemRole,
  type KpiScorecardReviewSnapshotDto,
  type KpiScorecardSnapshotStatus,
  type ScorecardPeriodMatrixDto,
  type ScorecardStatusDistributionDto,
} from './kpiScorecardApi';
import {
  buildKpiReportItemColumns,
  buildKpiReportItemRows,
  buildKpiReportSubtitle,
  KpiReportSummary,
  renderKpiReportGroupRow,
  resolveKpiReportPeriodLabel,
  kpiReportItemRowClassName,
  KPI_PERIOD_COLUMN_WIDTH_PX,
  type KpiReportItemRowVm,
} from './kpiReportPresenters';
import { KpiMeasurementRecordModal, type KpiMeasurementRecordFormValues } from '../kpiMeasurements/KpiMeasurementRecordModal';
import { recordKpiMeasurement } from '../kpiApi';
import { listActionCards } from '@/services/actionCards';
import {
  buildKpiScorecardItemColumns,
  buildKpiScorecardItemPreview,
  buildKpiScorecardItemRowMenu,
  buildKpiScorecardPreview,
  buildKpiScorecardSnapshotColumns,
  buildKpiScorecardSnapshotPreview,
  buildKpiScorecardSnapshotRowMenu,
} from './kpiScorecardPresenters';
import {
  formatKpiScorecardDate,
  kpiScorecardItemRoleLabel,
  kpiScorecardSnapshotStatusLabel,
} from './kpiScorecardMappers';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import {
  AddKpiScorecardItemModal,
  RemoveKpiScorecardItemDialog,
  type AddKpiScorecardItemFormValues,
} from './KpiScorecardItemDialogs';
import {
  CreateKpiScorecardReviewSnapshotModal,
  PublishKpiScorecardReviewSnapshotDialog,
  type CreateKpiScorecardReviewSnapshotFormValues,
} from './KpiScorecardSnapshotDialogs';

type DetailTab = 'items' | 'snapshots';
type PendingAction = 'activate' | 'suspend' | 'archive' | null;

function conflictFlag(err: unknown): boolean {
  return httpErrorCode(err) === 'STALE_VERSION' || (err as { status?: number })?.status === 409;
}

function withId<T extends object>(row: T, idKey: keyof T): T & { id: string } {
  return { ...row, id: String(row[idKey]) };
}

export const ResultsKpiScorecardDetailPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const resolveMemberName = useOrganizationMemberNames();
  const resolveScopeName = useResultsEntityNames(
    currentOrganization ? [currentOrganization] : []
  );
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

  /**
   * P7K — matryca CEL/Rezultat per okres dla WSZYSTKICH mierników raportu
   * (`GET .../periods`). Jedno wywołanie na cały raport; alternatywa
   * („`GET /kpi/:kpiId/measurements` per miernik") to 138 przelotów dla
   * raportu właściciela. `null` = jeszcze nie wróciła ⇒ komórki okresów
   * pokazują „—", nigdy 0.
   */
  const [periodMatrix, setPeriodMatrix] = useState<ScorecardPeriodMatrixDto | null>(null);
  const [periodMatrixLoading, setPeriodMatrixLoading] = useState(false);
  const [periodMatrixError, setPeriodMatrixError] = useState<string | null>(null);
  /** Okres, którego raport dotyczy — ta sama reguła co na poziomie 1. */
  const [reportPeriodLabel, setReportPeriodLabel] = useState<string | null>(null);

  /**
   * P7K część B — OTWARTE KARTY DZIAŁANIA per miernik. Liczymy je we froncie
   * z `GET /api/action-cards?sourceKind=kpi_deviation` (klucz źródła zaczyna
   * się od `<kpiId>:`), bo matryca okresów zna tylko SPRAWY odchylenia. To
   * jedno dodatkowe żądanie na raport — nie 138, jak przy pytaniu per miernik.
   */
  const [openActionCardsByKpiId, setOpenActionCardsByKpiId] = useState<Record<string, number>>({});

  /** „Wpisz rezultat" z kebaba wiersza — okno pomiaru jest istniejące, wspólne z L3. */
  const [recordTarget, setRecordTarget] = useState<KpiReportItemRowVm | null>(null);
  const [recordBusy, setRecordBusy] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

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
      setScorecardError(toUserFacingErrorMessage(err, isPolish));
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
      .catch((err) => setItemsError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setItemsLoading(false));
  }, [scorecardId]);

  const loadPeriodMatrix = useCallback(() => {
    if (!scorecardId) return;
    setPeriodMatrixLoading(true);
    setPeriodMatrixError(null);
    getKpiScorecardPeriodMatrix(scorecardId)
      .then((matrix) => setPeriodMatrix(matrix))
      .catch((err) => setPeriodMatrixError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setPeriodMatrixLoading(false));
  }, [scorecardId]);

  const loadOpenActionCards = useCallback(() => {
    listActionCards({ status: 'OPEN', sourceKind: 'kpi_deviation' })
      .then((cards) => {
        const licznik: Record<string, number> = {};
        for (const card of cards) {
          const kpiId = card.sourceId.split(':')[0];
          if (!kpiId) continue;
          licznik[kpiId] = (licznik[kpiId] ?? 0) + 1;
        }
        setOpenActionCardsByKpiId(licznik);
      })
      .catch(() => setOpenActionCardsByKpiId({}));
  }, []);

  const loadSnapshots = useCallback(() => {
    if (!scorecardId) return;
    setSnapshotsLoading(true);
    setSnapshotsError(null);
    listKpiScorecardReviewSnapshots(scorecardId)
      .then((rows) => setSnapshots(rows))
      .catch((err) => setSnapshotsError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setSnapshotsLoading(false));
  }, [scorecardId]);

  useEffect(() => {
    if (!enabled || !scorecard) return;
    if (tab === 'items' && items === null && !itemsLoading) loadItems();
    if (tab === 'items' && periodMatrix === null && !periodMatrixLoading) {
      loadPeriodMatrix();
      loadOpenActionCards();
    }
    if (tab === 'snapshots' && snapshots === null && !snapshotsLoading) loadSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scorecard, tab]);

  /* Okres raportu w nagłówku — ostatnia OPUBLIKOWANA migawka przeglądu, a gdy
     jej nie ma, okres bieżący wg `reviewFrequency`. 404 z
     `review-snapshots/published` jest tu stanem OCZEKIWANYM (raport nigdy nie
     opublikował przeglądu), nie błędem. */
  useEffect(() => {
    if (!enabled || !scorecard) return;
    let cancelled = false;
    getPublishedKpiScorecardSnapshot(scorecard.scorecardId)
      .catch(() => null)
      .then((snapshot) => {
        if (!cancelled) setReportPeriodLabel(resolveKpiReportPeriodLabel(scorecard, snapshot));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, scorecard]);

  const runLifecycleAction = useCallback(
    async (row: KpiScorecardDto, action: 'activate' | 'suspend' | 'archive') => {
      setPending(action);
      try {
        const runner =
          action === 'activate' ? activateKpiScorecard : action === 'suspend' ? suspendKpiScorecard : archiveKpiScorecard;
        await runner({ scorecardId: row.scorecardId, expectedVersion: row.rowVersion });
        await loadScorecard();
      } catch (err) {
        toast.error(toUserFacingErrorMessage(err, isPolish));
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

  // ==========================================
  // RN-G5 §G #8 — item/snapshot write actions. Every one below CASes on
  // `scorecard.rowVersion` (the scorecard aggregate's own version — see
  // `kpiScorecardCommands.ts`'s `BaseScorecardCommandInput`, NOT a
  // per-item/per-snapshot version) and reloads BOTH the scorecard record
  // (rowVersion bumps on every write) and the affected list on success.
  // ==========================================

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemBusy, setAddItemBusy] = useState(false);
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const [addItemConflict, setAddItemConflict] = useState(false);

  const [removeItemTarget, setRemoveItemTarget] = useState<KpiScorecardItemDto | null>(null);
  const [removeItemBusy, setRemoveItemBusy] = useState(false);
  const [removeItemError, setRemoveItemError] = useState<string | null>(null);
  const [removeItemConflict, setRemoveItemConflict] = useState(false);

  const [reorderBusy, setReorderBusy] = useState(false);

  const [createSnapshotOpen, setCreateSnapshotOpen] = useState(false);
  const [createSnapshotBusy, setCreateSnapshotBusy] = useState(false);
  const [createSnapshotError, setCreateSnapshotError] = useState<string | null>(null);
  const [createSnapshotConflict, setCreateSnapshotConflict] = useState(false);

  const [publishTarget, setPublishTarget] = useState<KpiScorecardReviewSnapshotDto | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishConflict, setPublishConflict] = useState(false);

  const handleAddItem = useCallback(
    async (values: AddKpiScorecardItemFormValues) => {
      if (!scorecard) return;
      setAddItemBusy(true);
      setAddItemError(null);
      setAddItemConflict(false);
      try {
        await addKpiScorecardItem({
          scorecardId: scorecard.scorecardId,
          expectedVersion: scorecard.rowVersion,
          kpiId: values.kpiId,
          role: values.role,
          // DEC-422c: okno nie zbiera już „Notatki" — pole opisowe, które
          // właściciel chciał wymusić, to OPIS KPI (idzie do `createKpiDraft`
          // wewnątrz okna), a nie powód audytowy pozycji karty.
          reason: null,
        });
        setAddItemOpen(false);
        await Promise.all([loadScorecard(), loadItems()]);
        toast.success(isPolish ? 'Dodano KPI do karty wyników.' : 'KPI added to the scorecard.');
      } catch (err) {
        setAddItemError(err instanceof Error ? err.message : String(err));
        setAddItemConflict(conflictFlag(err));
      } finally {
        setAddItemBusy(false);
      }
    },
    [scorecard, loadScorecard, loadItems, isPolish]
  );

  const handleRemoveItem = useCallback(
    async (reason: string | null) => {
      if (!scorecard || !removeItemTarget) return;
      setRemoveItemBusy(true);
      setRemoveItemError(null);
      setRemoveItemConflict(false);
      try {
        await removeKpiScorecardItem({
          scorecardId: scorecard.scorecardId,
          itemId: removeItemTarget.itemId,
          expectedVersion: scorecard.rowVersion,
          reason,
        });
        setRemoveItemTarget(null);
        setSelectedItemId((cur) => (cur === removeItemTarget.itemId ? null : cur));
        await Promise.all([loadScorecard(), loadItems()]);
        toast.success(isPolish ? 'Usunięto pozycję.' : 'Item removed.');
      } catch (err) {
        setRemoveItemError(err instanceof Error ? err.message : String(err));
        setRemoveItemConflict(conflictFlag(err));
      } finally {
        setRemoveItemBusy(false);
      }
    },
    [scorecard, removeItemTarget, loadScorecard, loadItems, isPolish]
  );

  /** Swaps `row`'s `sortOrder` with its immediate neighbour in the FULL
   * (unfiltered) item list — role-chip filtering only changes what is
   * VISIBLE, never the real underlying order, so this always reads from
   * `items` (the full array), not `filteredItems`. */
  const moveItem = useCallback(
    async (row: KpiScorecardItemDto, direction: 'up' | 'down') => {
      if (!scorecard || !items) return;
      const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((i) => i.itemId === row.itemId);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      setReorderBusy(true);
      try {
        await reorderKpiScorecardItems({
          scorecardId: scorecard.scorecardId,
          expectedVersion: scorecard.rowVersion,
          items: [
            { itemId: a.itemId, sortOrder: b.sortOrder },
            { itemId: b.itemId, sortOrder: a.sortOrder },
          ],
        });
        await Promise.all([loadScorecard(), loadItems()]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setReorderBusy(false);
      }
    },
    [scorecard, items, loadScorecard, loadItems]
  );

  const handleCreateSnapshot = useCallback(
    async (values: CreateKpiScorecardReviewSnapshotFormValues) => {
      if (!scorecard) return;
      setCreateSnapshotBusy(true);
      setCreateSnapshotError(null);
      setCreateSnapshotConflict(false);
      try {
        await createKpiScorecardReviewSnapshot({
          scorecardId: scorecard.scorecardId,
          reviewPeriodStart: values.reviewPeriodStart,
          reviewPeriodEnd: values.reviewPeriodEnd,
          reason: values.reason,
        });
        setCreateSnapshotOpen(false);
        await Promise.all([loadScorecard(), loadSnapshots()]);
        toast.success(isPolish ? 'Utworzono migawkę przeglądu.' : 'Review snapshot created.');
      } catch (err) {
        setCreateSnapshotError(err instanceof Error ? err.message : String(err));
        setCreateSnapshotConflict(conflictFlag(err));
      } finally {
        setCreateSnapshotBusy(false);
      }
    },
    [scorecard, loadScorecard, loadSnapshots, isPolish]
  );

  const handlePublishSnapshot = useCallback(
    async (reason: string | null) => {
      if (!scorecard || !publishTarget) return;
      setPublishBusy(true);
      setPublishError(null);
      setPublishConflict(false);
      try {
        await publishKpiScorecardReviewSnapshot({
          scorecardId: scorecard.scorecardId,
          snapshotId: publishTarget.snapshotId,
          expectedVersion: scorecard.rowVersion,
          reason,
        });
        setPublishTarget(null);
        await Promise.all([loadScorecard(), loadSnapshots()]);
        toast.success(isPolish ? 'Migawka opublikowana.' : 'Snapshot published.');
      } catch (err) {
        setPublishError(err instanceof Error ? err.message : String(err));
        setPublishConflict(conflictFlag(err));
      } finally {
        setPublishBusy(false);
      }
    },
    [scorecard, publishTarget, loadScorecard, loadSnapshots, isPolish]
  );

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (itemRoleChip === 'all') return items;
    return items.filter((i) => i.role === itemRoleChip);
  }, [items, itemRoleChip]);

  // Full (unfiltered) order — drives the row-menu's `isFirst`/`isLast` edge
  // lock (see `moveItem` doc comment: role-chip filtering never changes the
  // real underlying `sortOrder`, only what is visible).
  const fullSortedItems = useMemo(
    () => (items ? [...items].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [items]
  );

  /**
   * ── POZIOM 2 = TABELA MIERNIKÓW RAPORTU (SSOT §6) ─────────────────────────
   *
   * Wiersze składamy z DWÓCH źródeł: kontraktu pozycji raportu (`items` —
   * obszar, właściciel nadrzędny, typ, benchmark, limit, jednostka, kierunek,
   * odpowiedzialny) i matrycy okresów (`periodMatrix` — para CEL/Rezultat na
   * każdy okres, YTD, stan, otwarte karty działania). Dopóki matryca nie
   * wróci, kolumny okresów pokazują „—" — geometria tabeli jest już wtedy
   * poprawna, więc nic nie „skacze" po dojściu danych.
   *
   * Grupowanie po OBSZARZE robi jądro tabeli (`isGroupRow`/`renderGroupRow`),
   * a nie ten ekran — wiersz grupy jest jedną komórką na całą szerokość
   * (werdykt K6), więc nie rysuje „—" w kolumnach, których grupa nie ma.
   */
  const reportItemRows: KpiReportItemRowVm[] = useMemo(
    () =>
      buildKpiReportItemRows({
        items: filteredItems,
        matrixItems: periodMatrix?.items ?? [],
        openActionCardsByKpiId,
        isPolish,
        resolveOwnerName: (userId) =>
          userId ? memberNameOrUnknown(resolveMemberName, userId, isPolish) : null,
      }),
    [filteredItems, periodMatrix, isPolish, resolveMemberName, openActionCardsByKpiId]
  );

  const reportItemColumns = useMemo(
    () =>
      buildKpiReportItemColumns({
        isPolish,
        periods: periodMatrix?.periods ?? [],
        /* Ikona przy wierszu prowadzi WPROST do sekcji „Karty działania" karty
           miernika (poziom 3) — nie na jej środek i nie do listy odchyleń. */
        onOpenActionCards: (row) => {
          if (!row.kpiId) return;
          navigate(
            `${ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', row.kpiId)}?zbior=${encodeURIComponent(
              scorecardId ?? ''
            )}&sekcja=actionCards`
          );
        },
      }),
    [isPolish, periodMatrix, navigate, scorecardId]
  );

  /* HAKI MUSZĄ BYĆ PRZED wcześniejszymi `return` tego komponentu (stany
     „flaga wyłączona"/„ładowanie"/„błąd" niżej wychodzą z renderu). Gdy te
     dwa `useMemo` stały pod nimi, React liczył raz mniej haków w renderze
     ładowania niż w renderze z danymi i wywracał ekran raportu wyjątkiem
     „Rendered more hooks than during the previous render" — złapane testem
     poziomu 2, nie oglądaniem. */

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

  /**
   * ── MENU 2 = KPI · OKR · ROI (SSOT §6), nie „Pozycje/Migawki" ────────────
   *
   * Do 2026-09-05 poziom 2 wstawiał w Menu 2 własne dwie zakładki, przez co
   * z otwartego raportu NIE dawało się przejść do OKR ani do ROI — Menu 2
   * przestawało być menu modułu i stawało się menu ekranu. SSOT mówi
   * jednoznacznie: „Menu 2 modułu Wyniki: KPI · OKR · ROI". Podział
   * mierniki/migawki schodzi do Menu 3, gdzie mieszkają pigułki poziomu.
   */
  const tabs: StandardModuleTab[] = getResultsDomainTabs();
  const onDomainTabChange = (id: string) => {
    if (id === 'search' || id === 'legacy' || isResultsDomain(id)) navigate(getResultsDomainPath(id));
  };
  const levelChips: StandardCounterChip[] = [
    { id: 'items', label: isPolish ? 'Mierniki' : 'Indicators' },
    { id: 'snapshots', label: isPolish ? 'Migawki przeglądu' : 'Review snapshots' },
  ];
  /** Okruszek Menu 1: `Wyniki › KPI › <raport>` (SSOT §6, trzy stopnie na L3). */
  const breadcrumbs = [
    { id: 'results', label: isPolish ? 'Wyniki' : 'Results', onClick: () => navigate(ROUTES.RESULTS_KPI.ROOT) },
    { id: 'kpi', label: 'KPI', onClick: () => navigate(ROUTES.RESULTS_KPI.ROOT) },
    { id: 'report', label: scorecard?.name ?? (isPolish ? 'Raport' : 'Report') },
  ];

  // Error resolving the scorecard header itself (network/5xx — distinct from
  // the 404-shaped `forbidden` case above, which is a real, expected DENY).
  if (!forbidden && !scorecard && scorecardError) {
    return (
      <div className="h-full" data-testid="results-vnext-kpi-scorecard-detail-page">
        <ResultsVNextRegistryShell
          domain="kpi"
          moduleBar={{ tabs, activeTab: 'kpi', onTabChange: onDomainTabChange, showTabCounts: false }}
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
          moduleBar={{ tabs, activeTab: 'kpi', onTabChange: onDomainTabChange, showTabCounts: false }}
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
          resolveMemberName,
          resolveScopeName,
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
    /**
     * DEC-422 (06.09, odbiór Piotra) — `[...levelChips, ...chips]` łączyło 2
     * pigułki poziomu (Mierniki/Migawki) z 4 pigułkami statusu migawki w
     * JEDEN rząd 6 chipów, dokładnie ten kształt właściciel odrzucił dla
     * ROI ("osobny rząd + dodatkowe przyciski"). Naprawa ta sama: pigułki
     * poziomu ZOSTAJĄ w Menu 3 (2 pozycje, ≤3 z kanonu), filtr statusu
     * migawki schodzi do dropdownu w Menu 2 (`snapshotStatusFilterControl`).
     */
    const snapshotStatusOptions: StandardCounterChip[] = [
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
    const snapshotStatusFilterControl = (
      <div data-testid="kpi-scorecard-snapshot-status-filter">
        <SelectField
          value={snapshotStatusChip}
          onChange={(id) => setSnapshotStatusChip(id as 'all' | KpiScorecardSnapshotStatus)}
          options={snapshotStatusOptions.map((opt) => ({
            value: opt.id,
            label: `${opt.label} (${opt.count ?? 0})`,
          }))}
          fullWidth={false}
          wrapperClassName="w-auto"
          className="min-w-[13rem]"
          aria-label={isPolish ? 'Filtruj migawki wg statusu' : 'Filter snapshots by status'}
        />
      </div>
    );

    const isArchived = scorecard?.lifecycleStatus === 'archived';
    return (
      <div className="h-full" data-testid="results-vnext-kpi-scorecard-detail-page">
        <ResultsVNextRegistryShell
          domain="kpi"
          moduleBar={{
            tabs,
            activeTab: 'kpi',
            onTabChange: onDomainTabChange,
            showTabCounts: false,
            breadcrumbs,
            filterControls: snapshotStatusFilterControl,
            chips: levelChips,
            activeChip: 'snapshots',
            onChipChange: (id) => {
              if (id === 'items') {
                setTab('items');
              }
            },
            primaryCta: {
              label: isPolish ? 'Nowa migawka' : 'New snapshot',
              icon: Plus,
              onClick: () =>
                isArchived
                  ? toast.error(
                      isPolish
                        ? 'Karta wyników zarchiwizowana — nie można tworzyć nowych migawek.'
                        : 'Scorecard is archived — new snapshots cannot be created.'
                    )
                  : setCreateSnapshotOpen(true),
              locked: isArchived,
              lockedReason: isArchived
                ? isPolish
                  ? 'Karta wyników zarchiwizowana — nie można tworzyć nowych migawek.'
                  : 'Scorecard is archived — new snapshots cannot be created.'
                : undefined,
              testId: 'kpi-scorecard-new-snapshot-cta',
            },
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
                      ? 'Utwórz pierwszą migawkę przeglądu dla tej karty wyników.'
                      : 'Create the first review snapshot for this scorecard.',
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
                onPublish: (r) => setPublishTarget(r),
                busy: publishBusy,
              }),
            defaultSort: { columnId: 'createdAt', direction: 'desc' },
          }}
          preview={
            selectedSnapshot
              ? buildKpiScorecardSnapshotPreview(selectedSnapshot, {
                  isPolish,
                  resolveMemberName,
                  busy: publishBusy,
                  onClose: () => setSelectedSnapshotId(null),
                  onPublish: (r) => setPublishTarget(r),
                })
              : scorecardOverviewPreview
          }
          forbidden={forbidden}
          onForbiddenBack={() => navigate(ROUTES.RESULTS_KPI.ROOT)}
        />
        <CreateKpiScorecardReviewSnapshotModal
          open={createSnapshotOpen}
          onClose={() => (createSnapshotBusy ? undefined : setCreateSnapshotOpen(false))}
          onSubmit={(values) => void handleCreateSnapshot(values)}
          isPolish={isPolish}
          busy={createSnapshotBusy}
          errorMessage={createSnapshotError}
          isConflict={createSnapshotConflict}
        />
        <PublishKpiScorecardReviewSnapshotDialog
          open={!!publishTarget}
          periodLabel={
            publishTarget
              ? `${formatKpiScorecardDate(publishTarget.reviewPeriodStart, isPolish)} – ${formatKpiScorecardDate(publishTarget.reviewPeriodEnd, isPolish)}`
              : ''
          }
          isPolish={isPolish}
          onClose={() => (publishBusy ? undefined : setPublishTarget(null))}
          onSubmit={(reason) => void handlePublishSnapshot(reason)}
          busy={publishBusy}
          errorMessage={publishError}
          isConflict={publishConflict}
        />
      </div>
    );
  }



  /**
   * Szerokość tabeli podana DOKŁADNIE, żeby dopasowanie do kontenera
   * (`columnFit`) nie skalowało kolumn: skalowanie rozjeżdżało szerokości
   * nagłówka i wierszy, a przy przypiętych kolumnach kończyło się nakładaniem
   * (defekt K10). Suma: MIERNIK (324) + okresy (n × 140) + YTD (140) +
   * STAN (140) + strukturalna kolumna akcji (80).
   */
  const reportTableWidth =
    324 + (periodMatrix?.periods.length ?? 0) * KPI_PERIOD_COLUMN_WIDTH_PX + 140 + 140 + 80;

  const itemRows = reportItemRows.map((r) => r as unknown as Record<string, unknown> & { id: string });

  const isScorecardArchived = scorecard?.lifecycleStatus === 'archived';
  const addItemLockedReason = isPolish
    ? 'Raport zarchiwizowany — nie można dodawać mierników.'
    : 'Report archived — indicators cannot be added.';

  /**
   * P7K część B — WPISANIE REZULTATU OKRESU wprost z raportu (poziom 2).
   *
   * DLACZEGO KEBAB WIERSZA, A NIE NOWY PRZYCISK NA KOMÓRCE: kebab jest
   * kanonicznym miejscem akcji wiersza (triada), więc raport nie dostaje
   * ani jednego nowego elementu wizualnego, a ekran nie łamie zamrożonego
   * kanonu tabel. Okno pomiaru to ISTNIEJĄCY, wspólny `KpiMeasurementRecordModal`
   * z poziomu 3 — ten ekran go osadza, nie buduje własnego formularza.
   *
   * Po zapisie odświeżamy matrycę okresów (kolor wiersza) I liczbę kart
   * działania (ikona przy wierszu) — obie liczby pochodzą z serwera.
   */
  const handleRecordMeasurement = async (values: KpiMeasurementRecordFormValues) => {
    const target = recordTarget;
    if (!target?.kpiId) return;
    setRecordBusy(true);
    setRecordError(null);
    try {
      await recordKpiMeasurement(target.kpiId, {
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        actualValue: values.actualValue,
        source: values.source,
        notes: values.notes,
        reason: values.reason,
      });
      setRecordTarget(null);
      loadPeriodMatrix();
      loadOpenActionCards();
      toast.success(isPolish ? 'Rezultat zapisany.' : 'Result recorded.');
    } catch (err) {
      setRecordError(toUserFacingErrorMessage(err, isPolish));
    } finally {
      setRecordBusy(false);
    }
  };

  /** Otwarcie karty miernika (poziom 3) z pamięcią raportu, z którego przyszedł. */
  const openKpiCard = (kpiId: string) =>
    navigate(
      `${ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', kpiId)}?zbior=${encodeURIComponent(scorecardId ?? '')}`
    );

  return (
    <div className="h-full" data-testid="results-vnext-kpi-scorecard-detail-page">
      <ResultsVNextRegistryShell
        domain="kpi"
        moduleBar={{
          tabs,
          activeTab: 'kpi',
          onTabChange: onDomainTabChange,
          showTabCounts: false,
          breadcrumbs,
          chips: levelChips,
          activeChip: 'items',
          onChipChange: (id) => {
            if (id === 'snapshots') setTab('snapshots');
          },
          primaryCta: {
            label: isPolish ? 'Dodaj miernik' : 'Add indicator',
            icon: Plus,
            onClick: () =>
              isScorecardArchived ? toast.error(addItemLockedReason) : setAddItemOpen(true),
            locked: isScorecardArchived,
            lockedReason: isScorecardArchived ? addItemLockedReason : undefined,
            testId: 'kpi-scorecard-add-item-cta',
          },
        }}
        /* Nagłówek raportu (SSOT §6): jedna linia opisu i podsumowanie stanów
           po prawej — dokładnie to, co widać na zaakceptowanym zrzucie
           `evidence/p7k-wyniki/prototype/kpi-l2--light.png`. */
        header={
          scorecard ? (
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-c-text">{scorecard.name}</h1>
                <p className="truncate text-xs text-c-text-secondary">
                  {buildKpiReportSubtitle(scorecard, reportPeriodLabel, isPolish)}
                </p>
              </div>
              <KpiReportSummary
                distribution={distribution && distribution !== 'loading' ? distribution : null}
                isPolish={isPolish}
              />
            </div>
          ) : null
        }
        table={{
          columns: reportItemColumns,
          data: itemRows,
          persistKey: 'results-vnext.kpi-report-items',
          minTableWidth: reportTableWidth,
          density: 'compact',
          loading: itemsLoading,
          error: itemsError ?? periodMatrixError,
          onRetry: () => {
            loadItems();
            loadPeriodMatrix();
          },
          /* SSOT §6: „domyślnie przewinięte do bieżącego miesiąca". Kolumnę
             bieżącego okresu wskazuje SERWER (`isCurrent` w siatce okresów) —
             front nie liczy własnej daty i nie może się z serwerem rozjechać. */
          scrollToColumnId: periodMatrix?.periods.find((p) => p.isCurrent)
            ? `period:${periodMatrix.periods.find((p) => p.isCurrent)!.key}`
            : null,
          /* Wiersz poza limitem jest CZERWONY — jedyne miejsce czerwieni na
             całym wierszu raportu (P7K część B §15). */
          rowClassName: (row) => kpiReportItemRowClassName(row as unknown as KpiReportItemRowVm),
          isGroupRow: (row) => !!(row as unknown as KpiReportItemRowVm).group,
          renderGroupRow: (row) =>
            renderKpiReportGroupRow(row as unknown as KpiReportItemRowVm, isPolish),
          empty:
            !itemsLoading && !itemsError && (items?.length ?? 0) === 0
              ? {
                  title: isPolish ? 'Raport nie ma jeszcze mierników' : 'This report has no indicators yet',
                  description: isPolish
                    ? 'Dodaj pierwszy miernik, aby zacząć śledzić cel i rezultat okres po okresie.'
                    : 'Add the first indicator to start tracking target and actual period by period.',
                }
              : undefined,
          selectedRowId: selectedItemId,
          onRowClick: (row) => {
            const vm = row as unknown as KpiReportItemRowVm;
            if (!vm.group) setSelectedItemId(vm.id);
          },
          // Kanon triady: klik pokazuje podgląd, dwuklik otwiera kartę miernika.
          onRowDoubleClick: (row) => {
            const vm = row as unknown as KpiReportItemRowVm;
            if (vm.kpiId) openKpiCard(vm.kpiId);
          },
          rowMenu: (row) => {
            const vm = row as unknown as KpiReportItemRowVm;
            if (!vm.item) return { primary: [] };
            return buildKpiScorecardItemRowMenu(vm.item, isPolish, {
              onPreview: (r) => setSelectedItemId(r.itemId),
              onOpenKpi: openKpiCard,
              onRecordMeasurement: () => setRecordTarget(vm),
              onMoveUp: (r) => void moveItem(r, 'up'),
              onMoveDown: (r) => void moveItem(r, 'down'),
              onRemove: (r) => setRemoveItemTarget(r),
              isFirst: fullSortedItems[0]?.itemId === vm.item.itemId,
              isLast: fullSortedItems[fullSortedItems.length - 1]?.itemId === vm.item.itemId,
              busy: reorderBusy,
            });
          },
        }}
        /* Podgląd otwiera się DOPIERO po kliknięciu w miernik. Wcześniej ekran
           startował z otwartym podglądem raportu, który zjadał ~400 px i
           zostawiał na tabelę trzy kolumny okresów zamiast pięciu — a raport
           ma być widoczny od razu, nie po zamknięciu panelu. Podgląd samego
           raportu jest tam, gdzie należy: na poziomie 1. */
        preview={
          selectedItem
            ? buildKpiScorecardItemPreview(selectedItem, {
                isPolish,
                resolveMemberName,
                busy: removeItemBusy,
                onClose: () => setSelectedItemId(null),
                onOpenKpi: openKpiCard,
                onRemove: (r) => setRemoveItemTarget(r),
              })
            : null
        }
        forbidden={forbidden}
        onForbiddenBack={() => navigate(ROUTES.RESULTS_KPI.ROOT)}
      />
      <AddKpiScorecardItemModal
        open={addItemOpen}
        onClose={() => (addItemBusy ? undefined : setAddItemOpen(false))}
        onSubmit={(values) => void handleAddItem(values)}
        isPolish={isPolish}
        scorecardName={scorecard?.name ?? null}
        busy={addItemBusy}
        errorMessage={addItemError}
        isConflict={addItemConflict}
      />
      <KpiMeasurementRecordModal
        open={!!recordTarget}
        onClose={() => (recordBusy ? undefined : setRecordTarget(null))}
        onSubmit={(values) => void handleRecordMeasurement(values)}
        isPolish={isPolish}
        kpiCode={recordTarget?.name ?? ''}
        busy={recordBusy}
        errorMessage={recordError}
      />
      <RemoveKpiScorecardItemDialog
        open={!!removeItemTarget}
        itemLabel={removeItemTarget ? removeItemTarget.kpiId : ''}
        isPolish={isPolish}
        onClose={() => (removeItemBusy ? undefined : setRemoveItemTarget(null))}
        onSubmit={(reason) => void handleRemoveItem(reason)}
        busy={removeItemBusy}
        errorMessage={removeItemError}
        isConflict={removeItemConflict}
      />
    </div>
  );
};

export default ResultsKpiScorecardDetailPage;

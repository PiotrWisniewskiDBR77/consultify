/**
 * `/results/okr` — POZIOM 1 formuły OKR: TABELA RAPORTÓW OKR.
 *
 * ── SKĄD TEN EKRAN ────────────────────────────────────────────────────────
 * SSOT właściciela (`docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md`
 * §1/§3): „w menu głównym mamy 3 funkcje i każda z nich uruchamia tabelę na
 * ekranie. Tabela jest listą, która oznacza raport." Dla OKR poziom 1 to
 * TABELA RAPORTÓW (zakres × cykl) z kolumnami NAZWA · ZAKRES · CYKL · CELE ·
 * REZULTATY · STAN · WŁAŚCICIELE · OSTATNI CHECK-IN. Wzorzec wizualny:
 * zatwierdzony zrzut `evidence/p7k-wyniki/prototype/okr-l1--light.png`
 * (widok `okr-l1` w `dev-render/screens/p7k-wyniki-prototype.tsx`).
 *
 * Zastępuje na tej trasie `ResultsOkrHub` — nie dlatego, że Hub był zły, ale
 * dlatego, że listował ZESTAWY z kolumnami cyklu życia (status, postęp,
 * uwaga, aktualizacja), a właściciel prosi o RAPORT z liczbami celów,
 * rezultatów i rozkładem stanu. Hub zostaje w repo jako powierzchnia
 * administracyjna zestawów (`/results/okr/sets/:okrSetId` i drążenie
 * Programy/Cykle), więc nic nie znika — zmienia się tylko to, co widać po
 * kliknięciu „OKR" w Menu 2.
 *
 * ── POWŁOKA ───────────────────────────────────────────────────────────────
 * `ResultsVNextRegistryShell` (StandardModuleBar + StandardTable +
 * StandardPreview) — ta sama, której używają KPI i ROI. Menu 2 bierzemy z
 * `getResultsDomainTabs()`, niczego nie przebudowujemy.
 *
 * ── DANE ──────────────────────────────────────────────────────────────────
 * DWA wywołania na CAŁĄ tabelę, nigdy jedno na wiersz:
 *   1. `listOkrSets()`             — wiersze raportów (nazwa, zakres, cykl),
 *   2. `listOkrReportSummaries()`  — liczby i rozkład stanu dla wszystkich.
 * Podgląd dokłada TRZECIE wywołanie, ale wyłącznie dla JEDNEGO zaznaczonego
 * wiersza (rozkład stanu per właściciel, SSOT §14) — to jest leniwy detal
 * jednego rekordu, a nie N+1 na tabelę.
 *
 * ── UCZCIWOŚĆ ─────────────────────────────────────────────────────────────
 * Raport bez agregatu (np. dodany między jednym a drugim zapytaniem) ma w
 * kolumnach liczbowych „—”, nigdy 0. Nazwa cyklu pochodzi z realnego
 * rejestru cykli; gdy cykl nie jest widoczny dla użytkownika, komórka mówi
 * „—”, a nie pokazuje identyfikatora (kanon: nazwiska i nazwy, nie UUID).
 */
import { Plus, Target } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { TableColumn, TableRow } from '@/components/standard';
import type { ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { memberNameOrUnknown, useOrganizationMemberNames } from '@/hooks/useOrganizationMemberNames';

import { ResultsVNextRegistryShell } from '../../ResultsVNextRegistryShell';
import {
  getResultsDomainPath,
  getResultsDomainTabs,
  isResultsDomain,
} from '../../resultsDomainNavigation';
import { toUserFacingErrorMessage } from '../../shared/errorMessage';
import { listOkrCycles, type OkrCycleDto } from '../okrAdminApi';
import { listOkrSets, type OkrSetDto } from '../okrApi';
import { listObjectivesForSet } from '../okrObjectiveApi';
import { formatOkrDate, okrSetScopeLabel } from '../okrRegistryMappers';

import {
  listKeyResultCheckInSummaries,
  listOkrReportSummaries,
  type OkrKeyResultCheckInSummaryDto,
  type OkrReportSummaryDto,
} from './okrReportApi';
import {
  emptyStateCounts,
  okrReportStateOf,
  OKR_EMPTY,
  type OkrReportState,
} from './okrReportModel';
import { OkrStateCountsCell, OkrTextCell } from './okrReportPresenters';
import { okrReportPath } from './okrReportPaths';

interface RegistryRow extends TableRow {
  set: OkrSetDto;
  summary: OkrReportSummaryDto | null;
  cycleName: string | null;
}

const FETCH_LIMIT = 200;

export const OkrReportRegistryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const resolveMemberName = useOrganizationMemberNames();

  const [sets, setSets] = useState<OkrSetDto[]>([]);
  const [summaries, setSummaries] = useState<OkrReportSummaryDto[]>([]);
  const [cycles, setCycles] = useState<OkrCycleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedSets, loadedSummaries] = await Promise.all([
        listOkrSets({ limit: FETCH_LIMIT }),
        listOkrReportSummaries(),
      ]);
      setSets(loadedSets);
      setSummaries(loadedSummaries);
      // Cykle to osobny, administracyjny rejestr — brak dostępu do niego NIE
      // może wywrócić tabeli raportów, więc jego błąd tylko odbiera nazwę
      // cyklu („—"), zamiast zamieniać cały ekran w stan błędu.
      try {
        setCycles(await listOkrCycles());
      } catch {
        setCycles([]);
      }
    } catch (err) {
      setError(toUserFacingErrorMessage(err, isPolish));
    } finally {
      setLoading(false);
    }
  }, [isPolish]);

  useEffect(() => {
    void load();
  }, [load]);

  const cycleNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cycle of cycles) map.set(cycle.cycleId, cycle.name);
    return map;
  }, [cycles]);

  const rows: RegistryRow[] = useMemo(() => {
    const summaryBySetId = new Map(summaries.map((entry) => [entry.setId, entry]));
    return sets.map((set) => ({
      id: set.setId,
      set,
      summary: summaryBySetId.get(set.setId) ?? null,
      cycleName: cycleNameById.get(set.cycleId) ?? null,
      // Pola płaskie — tabela sortuje po `row[column.id]`.
      name: set.title,
      scope: okrSetScopeLabel(set.scopeType, isPolish),
      cycle: cycleNameById.get(set.cycleId) ?? OKR_EMPTY,
      objectives: summaryBySetId.get(set.setId)?.objectiveCount ?? null,
      results: summaryBySetId.get(set.setId)?.keyResultCount ?? null,
      owners: summaryBySetId.get(set.setId)?.ownerCount ?? null,
      checkin: summaryBySetId.get(set.setId)?.lastCheckinAt ?? null,
    }));
  }, [sets, summaries, cycleNameById, isPolish]);

  const stateTitle = useCallback(
    (row: RegistryRow) => {
      const counts = row.summary?.stateCounts ?? emptyStateCounts();
      return t(
        'results.okr.report.stateTooltip',
        'na dobrej drodze {{onTrack}} · zagrożone {{atRisk}} · krytyczne {{critical}} · bez check-inu {{noSignal}}',
        counts as unknown as Record<string, number>
      );
    },
    [t]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('results.okr.report.columns.name', 'NAZWA'),
        width: '236px',
        dataType: 'text',
        sortable: true,
        render: (row: RegistryRow) => <OkrTextCell value={row.set.title} wrap strong />,
      },
      {
        id: 'scope',
        label: t('results.okr.report.columns.scope', 'ZAKRES'),
        // 200 px z POMIARU: najdłuższa etykieta zakresu to „Jednostka
        // biznesowa" (~150 px w 14 px) + `px-4` z obu stron. Przy 181 px
        // (szerokość z prototypu, gdzie zakresem była krótka NAZWA zakładu)
        // etykieta łamała się wielokropkiem — a kanon zabrania „…".
        width: '200px',
        dataType: 'text',
        sortable: true,
        render: (row: RegistryRow) => (
          <OkrTextCell value={okrSetScopeLabel(row.set.scopeType, isPolish)} />
        ),
      },
      {
        id: 'cycle',
        label: t('results.okr.report.columns.cycle', 'CYKL'),
        width: '120px',
        dataType: 'text',
        sortable: true,
        render: (row: RegistryRow) => <OkrTextCell value={row.cycleName} />,
      },
      {
        id: 'objectives',
        label: t('results.okr.report.columns.objectives', 'CELE'),
        width: '92px',
        dataType: 'number',
        align: 'right',
        sortable: true,
        render: (row: RegistryRow) => (
          <span className="tabular-nums text-sm text-c-text-secondary">
            {row.summary ? row.summary.objectiveCount : OKR_EMPTY}
          </span>
        ),
      },
      {
        id: 'results',
        label: t('results.okr.report.columns.keyResults', 'REZULTATY'),
        width: '110px',
        dataType: 'number',
        align: 'right',
        sortable: true,
        render: (row: RegistryRow) => (
          <span className="tabular-nums text-sm text-c-text-secondary">
            {row.summary ? row.summary.keyResultCount : OKR_EMPTY}
          </span>
        ),
      },
      {
        id: 'state',
        label: t('results.okr.report.columns.state', 'STAN'),
        width: '156px',
        dataType: 'number',
        render: (row: RegistryRow) => (
          <OkrStateCountsCell
            counts={row.summary?.stateCounts ?? emptyStateCounts()}
            title={stateTitle(row)}
          />
        ),
      },
      {
        id: 'owners',
        label: t('results.okr.report.columns.owners', 'WŁAŚCICIELE'),
        width: '124px',
        dataType: 'number',
        align: 'right',
        sortable: true,
        render: (row: RegistryRow) => (
          <span className="tabular-nums text-sm text-c-text-secondary">
            {row.summary ? row.summary.ownerCount : OKR_EMPTY}
          </span>
        ),
      },
      {
        id: 'checkin',
        label: t('results.okr.report.columns.lastCheckIn', 'OSTATNI CHECK-IN'),
        width: '158px',
        dataType: 'date',
        sortable: true,
        render: (row: RegistryRow) => (
          <OkrTextCell
            value={
              row.summary?.lastCheckinAt
                ? formatOkrDate(row.summary.lastCheckinAt, isPolish)
                : null
            }
          />
        ),
      },
    ],
    [t, isPolish, stateTitle]
  );

  // ── Podgląd zaznaczonego raportu: rozkład stanu PER WŁAŚCICIEL ──────────
  // SSOT §14 („OKR dotyczy człowieka"): podgląd raportu OKR ma pokazywać
  // rozkład per właściciel, tak jak podgląd raportu KPI per obszar.
  const selectedSet = useMemo(
    () => sets.find((set) => set.setId === selectedSetId) ?? null,
    [sets, selectedSetId]
  );
  const [ownerBreakdown, setOwnerBreakdown] = useState<ArtifactPropertyRow[] | null>(null);
  const [ownerBreakdownLoading, setOwnerBreakdownLoading] = useState(false);

  useEffect(() => {
    if (!selectedSetId) {
      setOwnerBreakdown(null);
      return undefined;
    }
    let cancelled = false;
    setOwnerBreakdownLoading(true);
    setOwnerBreakdown(null);
    Promise.all([
      listObjectivesForSet(selectedSetId),
      listKeyResultCheckInSummaries(selectedSetId).catch(
        () => [] as OkrKeyResultCheckInSummaryDto[]
      ),
    ])
      .then(([objectives, checkIns]) => {
        if (cancelled) return;
        const checkInByKr = new Map(checkIns.map((entry) => [entry.keyResultId, entry]));
        const perOwner = new Map<string, { total: number; atRisk: number; critical: number }>();
        for (const objective of objectives) {
          if (objective.status === 'cancelled') continue;
          for (const kr of objective.keyResults) {
            if (kr.status === 'cancelled') continue;
            const state: OkrReportState = okrReportStateOf(
              kr.status,
              (checkInByKr.get(kr.keyResultId)?.checkInCount ?? 0) > 0
            );
            const bucket = perOwner.get(kr.ownerUserId) ?? { total: 0, atRisk: 0, critical: 0 };
            bucket.total += 1;
            if (state === 'at-risk') bucket.atRisk += 1;
            if (state === 'critical') bucket.critical += 1;
            perOwner.set(kr.ownerUserId, bucket);
          }
        }
        setOwnerBreakdown(
          Array.from(perOwner.entries()).map(([ownerUserId, bucket]) => ({
            id: ownerUserId,
            label: memberNameOrUnknown(resolveMemberName, ownerUserId, isPolish),
            value: t(
              'results.okr.report.ownerBreakdownValue',
              '{{total}} rezultatów · {{atRisk}} zagrożonych · {{critical}} krytycznych',
              bucket as unknown as Record<string, number>
            ),
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setOwnerBreakdown([]);
      })
      .finally(() => {
        if (!cancelled) setOwnerBreakdownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSetId, resolveMemberName, isPolish, t]);

  const openReport = useCallback(
    (setId: string) => navigate(okrReportPath(setId)),
    [navigate]
  );

  return (
    <ResultsVNextRegistryShell
      domain="okr"
      moduleBar={{
        tabs: getResultsDomainTabs(),
        activeTab: 'okr',
        onTabChange: (id) => {
          if (id === 'reports' || id === 'legacy' || isResultsDomain(id)) {
            navigate(getResultsDomainPath(id));
          }
        },
        showTabCounts: false,
        viewModes: ['table'],
        viewMode: 'table',
        // Menu 3 poziomu 1 ma dokładnie JEDNĄ akcję („Dodaj") — SSOT §6.
        // Tworzenie raportu żyje w powłoce zestawów (`/results/okr/sets`),
        // która ma pełny formularz z programem i cyklem; nie dublujemy go tu
        // uproszczoną wersją, która pytałaby o mniej niż backend wymaga.
        primaryCta: {
          label: t('results.okr.report.newReport', 'Nowy raport'),
          icon: Plus,
          onClick: () => navigate('/results/okr/sets'),
          testId: 'okr-report-registry-create-cta',
        },
      }}
      table={{
        columns,
        data: rows,
        persistKey: 'results-vnext.okr-report-registry',
        minTableWidth: 'columns',
        loading,
        error,
        onRetry: () => void load(),
        empty:
          !loading && !error && rows.length === 0
            ? {
                icon: Target,
                title: t('results.okr.report.emptyTitle', 'Brak raportów OKR'),
                description: t(
                  'results.okr.report.emptyDescription',
                  'Nie ma jeszcze żadnego raportu OKR w tej organizacji. Raport powstaje razem z zestawem celów na wybrany cykl.'
                ),
              }
            : undefined,
        selectedRowId: selectedSetId,
        onRowClick: (row) => setSelectedSetId(String(row.id)),
        onRowDoubleClick: (row) => openReport(String(row.id)),
        rowMenu: (row) => ({
          primary: [
            {
              id: 'open',
              label: t('results.okr.report.openReport', 'Otwórz raport'),
              onClick: () => openReport(String(row.id)),
            },
          ],
          universalHandlers: { preview: () => setSelectedSetId(String(row.id)) },
        }),
      }}
      preview={
        selectedSet
          ? {
              title: selectedSet.title,
              onClose: () => setSelectedSetId(null),
              onOpenFull: () => openReport(selectedSet.setId),
              openLabel: t('results.okr.report.openReport', 'Otwórz raport'),
              meta: {
                pills: [
                  {
                    label: t('results.okr.report.columns.scope', 'ZAKRES'),
                    value: okrSetScopeLabel(selectedSet.scopeType, isPolish),
                  },
                  {
                    label: t('results.okr.report.columns.cycle', 'CYKL'),
                    value: cycleNameById.get(selectedSet.cycleId) ?? OKR_EMPTY,
                  },
                  {
                    label: t('results.okr.report.reportOwner', 'Właściciel raportu'),
                    value: memberNameOrUnknown(
                      resolveMemberName,
                      selectedSet.ownerUserId,
                      isPolish
                    ),
                  },
                ],
              },
              details: {
                label: t('results.okr.report.aboutReport', 'O raporcie'),
                text: selectedSet.description ?? undefined,
                propertyLabel: t('results.okr.report.owner', 'Właściciel'),
                valueLabel: t('results.okr.report.ownerLoad', 'Rezultaty i zagrożenia'),
                properties: [
                  ...(selectedSet.reportGoal
                    ? [
                        {
                          id: 'goal',
                          label: t('results.okr.report.reportGoal', 'Cel raportu'),
                          value: selectedSet.reportGoal,
                        },
                      ]
                    : []),
                  ...(ownerBreakdown ?? []),
                ],
                loading: ownerBreakdownLoading,
              },
              relationsEmptyLabel: t('results.okr.report.noOwners', 'Brak właścicieli rezultatów'),
            }
          : null
      }
    />
  );
};

export default OkrReportRegistryPage;

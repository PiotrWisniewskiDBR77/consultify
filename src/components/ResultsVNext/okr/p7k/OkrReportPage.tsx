/**
 * `/results/okr/:setId` — POZIOM 2 formuły OKR: RAPORT OKR.
 *
 * ── CO TO JEST ────────────────────────────────────────────────────────────
 * Tabela KLUCZOWYCH REZULTATÓW jednego raportu, zgrupowana TEMAT → CEL, z
 * właścicielem jako KOLUMNĄ (SSOT §3 i §14: „OKR dotyczy człowieka" —
 * podmiotem wiersza jest osoba, nie proces). Wzorzec wizualny: zatwierdzony
 * zrzut `evidence/p7k-wyniki/prototype/okr-l2--light.png`.
 *
 * Kolumny domyślne: CEL (z ambicją pod spodem) · KLUCZOWY REZULTAT ·
 * WŁAŚCICIEL · START / CEL / BIEŻĄCA · POSTĘP · PEWNOŚĆ · TERMIN · STAN.
 * ZESPÓŁ i OSTATNI CHECK-IN są w pstryczku kolumn (`defaultVisible: false`)
 * — nie dlatego, że są mniej ważne, tylko dlatego, że dziesięć kolumn na
 * 1440 px ściska tekst tak, że wchodzi na sąsiada (defekt K11 werdyktu 1c;
 * to samo rozwiązanie zastosowano w ROI L1 i KPI L3).
 *
 * ── WIERSZ GRUPY ──────────────────────────────────────────────────────────
 * `StandardTable`/`FilterableTable` nie ma dziś natywnego grupowania
 * (sprawdzone: zero trafień na `groupBy`/`rowGroup`), a korekta P7K §13
 * wprost dopuszcza rozwiązanie w prezenterze „bez nowego komponentu". Wiersz
 * grupy jest więc zwykłym wierszem danych, któremu efekt układu rozciąga
 * pierwszą komórkę na całą szerokość (`colSpan`) i chowa resztę — dokładnie
 * ta sama mechanika, którą przyjął zatwierdzony prototyp (defekt K6: wiersze
 * grup wypełnione „—" w każdej komórce). Zero własnej tabeli poza
 * `StandardTable` — bezpiecznik `check-list-canon.sh` tego pilnuje.
 *
 * ── DANE ──────────────────────────────────────────────────────────────────
 * TRZY wywołania na cały ekran, niezależnie od liczby wierszy:
 * `getOkrSet` (nagłówek), `listObjectivesForSet` (cele z rezultatami),
 * `listKeyResultCheckInSummaries` (data ostatniego check-inu per rezultat).
 */
import { Plus, Users } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import type { StandardCounterChip, TableColumn, TableRow } from '@/components/standard';
import { memberNameOrUnknown, useOrganizationMemberNames } from '@/hooks/useOrganizationMemberNames';
import tokenService from '@/services/tokenService';

import { ResultsVNextRegistryShell } from '../../ResultsVNextRegistryShell';
import {
  getResultsDomainPath,
  getResultsDomainTabs,
  isResultsDomain,
} from '../../resultsDomainNavigation';
import { toUserFacingErrorMessage } from '../../shared/errorMessage';
import { getOkrCycle, type OkrCycleDto } from '../okrAdminApi';
import { getOkrSet, type OkrSetDto } from '../okrApi';
import {
  createObjective,
  listObjectivesForSet,
  newOkrIdempotencyKey,
  OkrObjectiveApiError,
  type CreateOkrObjectiveInput,
  type OkrObjectiveWithKeyResultsDto,
} from '../okrObjectiveApi';
import {
  getOkrSetChildEditLock,
  okrKeyResultConfidenceLabel,
  parseOkrKeyResultProgress,
} from '../okrObjectiveMappers';
import { formatOkrDate, okrSetScopeLabel } from '../okrRegistryMappers';
import { OkrObjectiveFormModal, type OkrObjectiveFormValues } from '../OkrObjectiveFormModal';

import {
  listKeyResultCheckInSummaries,
  type OkrKeyResultCheckInSummaryDto,
} from './okrReportApi';
import {
  buildOkrReportRows,
  collectOkrReportOwners,
  formatOkrTriple,
  isOkrReportGroupRow,
  okrReportStateLabel,
  OKR_EMPTY,
  OKR_REPORT_DEFAULT_FILTER,
  summarizeOkrReport,
  type OkrReportFilter,
  type OkrReportKeyResultRow,
  type OkrReportRow,
} from './okrReportModel';
import { OkrProgressCell, OkrStateCountsCell, OkrStatePill, OkrTextCell } from './okrReportPresenters';
import {
  okrObjectiveCardInReportPath,
  okrObjectiveCardKeyResultPath,
  OKR_REPORT_REGISTRY_PATH,
} from './okrReportPaths';

function resolveCurrentUserIdFromToken(): string | null {
  try {
    const token = tokenService.getToken();
    if (!token) return null;
    return tokenService.decodeToken(token)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Wiersz grupy tematu — rozciągnięcie pierwszej komórki na całą szerokość.
 *
 * Efekt układu, nie nowy komponent: `StandardTable` renderuje wiersz jak
 * każdy inny, a tu tylko poprawiamy `colSpan` i chowamy komórki, których
 * grupa nie używa. Uruchamiany PO KAŻDYM renderze listy wierszy (pstryczek
 * kolumn i filtry zmieniają liczbę komórek), dlatego `useLayoutEffect` z
 * zależnością od klucza układu — inaczej po zmianie kolumn zostałby stary,
 * za wąski `colSpan`.
 */
function useOkrGroupRowLayout(
  containerRef: React.RefObject<HTMLDivElement | null>,
  layoutKey: string
): void {
  useLayoutEffect(() => {
    const host = containerRef.current;
    if (!host) return undefined;
    const table = host.querySelector<HTMLTableElement>('table');
    const applyGroupRows = () => {
      host.querySelectorAll<HTMLTableRowElement>('tr.okr-report-group-row').forEach((row) => {
        const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>('td'));
        const [first, ...rest] = cells;
        if (!first) return;
        first.colSpan = cells.length;
        /**
         * ZMIERZONE, nie założone (zrzut 05.09, pierwsze podejście): sam
         * `colSpan` w tabeli o układzie stałym NIE rozciąga komórki na całą
         * szerokość — nazwa tematu łamała się na trzy linie, a przypięta
         * (`sticky right-0`, białe tło) kolumna akcji zostawiała biały
         * prostokąt na prawym krańcu wiersza grupy. Dlatego komórka grupy
         * dostaje własne, NIEPRZEZROCZYSTE tło, przypięcie do lewej i
         * jawną szerokość równą szerokości tabeli — dokładnie ta sama
         * mechanika, którą przyjął zatwierdzony prototyp.
         */
        first.style.position = 'sticky';
        first.style.left = '0';
        first.style.zIndex = '30';
        first.style.background = 'var(--c-surface-raised)';
        const content = first.firstElementChild as HTMLElement | null;
        if (content && table) {
          content.style.width = `${Math.max(0, table.clientWidth - 32)}px`;
        }
        for (const cell of rest) cell.style.display = 'none';
      });
    };
    applyGroupRows();
    // Szerokość tabeli zmienia się przy zmianie okna i przy pstryczku kolumn —
    // bez tego wiersz grupy zostawałby na starej szerokości.
    if (typeof ResizeObserver === 'undefined' || !table) return undefined;
    const observer = new ResizeObserver(applyGroupRows);
    observer.observe(table);
    return () => observer.disconnect();
  }, [containerRef, layoutKey]);
}

export const OkrReportPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const { setId } = useParams<{ setId: string }>();
  const resolveMemberName = useOrganizationMemberNames();
  const currentUserId = useMemo(() => resolveCurrentUserIdFromToken(), []);

  const [set, setSet] = useState<OkrSetDto | null>(null);
  const [cycle, setCycle] = useState<OkrCycleDto | null>(null);
  const [objectives, setObjectives] = useState<OkrObjectiveWithKeyResultsDto[]>([]);
  const [checkIns, setCheckIns] = useState<OkrKeyResultCheckInSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OkrReportFilter>(OKR_REPORT_DEFAULT_FILTER);
  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formConflict, setFormConflict] = useState(false);

  const load = useCallback(async () => {
    if (!setId) return;
    setLoading(true);
    setError(null);
    try {
      const [loadedSet, loadedObjectives, loadedCheckIns] = await Promise.all([
        getOkrSet(setId),
        listObjectivesForSet(setId),
        listKeyResultCheckInSummaries(setId).catch(
          () => [] as OkrKeyResultCheckInSummaryDto[]
        ),
      ]);
      setSet(loadedSet);
      setObjectives(loadedObjectives);
      setCheckIns(loadedCheckIns);
      if (loadedSet?.cycleId) {
        try {
          setCycle(await getOkrCycle(loadedSet.cycleId));
        } catch {
          setCycle(null);
        }
      }
    } catch (err) {
      setError(toUserFacingErrorMessage(err, isPolish));
    } finally {
      setLoading(false);
    }
  }, [setId, isPolish]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkInByKeyResultId = useMemo(
    () => new Map(checkIns.map((entry) => [entry.keyResultId, entry])),
    [checkIns]
  );

  const rows: OkrReportRow[] = useMemo(
    () => buildOkrReportRows(objectives, checkInByKeyResultId, filter),
    [objectives, checkInByKeyResultId, filter]
  );

  const summary = useMemo(
    () => summarizeOkrReport(objectives, checkInByKeyResultId),
    [objectives, checkInByKeyResultId]
  );

  const owners = useMemo(() => collectOkrReportOwners(objectives), [objectives]);

  const openObjective = useCallback(
    (row: OkrReportKeyResultRow) => {
      if (!setId) return;
      navigate(
        row.keyResult
          ? okrObjectiveCardKeyResultPath(setId, row.objectiveId, row.keyResult.keyResultId)
          : okrObjectiveCardInReportPath(setId, row.objectiveId)
      );
    },
    [navigate, setId]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'objective',
        label: t('results.okr.report.columns.objective', 'CEL'),
        width: '230px',
        dataType: 'text',
        render: (row: OkrReportRow) => {
          if (isOkrReportGroupRow(row)) {
            const group = row as Extract<OkrReportRow, { kind: 'group' }>;
            const ownerLabel =
              group.ownerUserIds.length === 1
                ? t('results.okr.report.groupOwner', 'właściciel nadrzędny: {{name}}', {
                    name: memberNameOrUnknown(resolveMemberName, group.ownerUserIds[0], isPolish),
                  })
                : t('results.okr.report.groupOwners', '{{count}} właścicieli celów', {
                    count: group.ownerUserIds.length,
                  });
            return (
              <span className="flex items-center gap-3 whitespace-nowrap">
                <b className="uppercase">
                  {group.theme ?? t('results.okr.report.noTheme', 'Bez tematu')}
                </b>
                <span className="text-xs font-normal text-c-text-secondary">{ownerLabel}</span>
              </span>
            );
          }
          const keyResultRow = row as OkrReportKeyResultRow;
          return (
            <OkrTextCell
              value={keyResultRow.objectiveTitle}
              wrap
              strong
              hint={t(
                `results.okr.report.ambition.${keyResultRow.objectiveAmbition}`,
                keyResultRow.objectiveAmbition === 'committed'
                  ? 'Zobowiązanie'
                  : keyResultRow.objectiveAmbition === 'aspirational'
                    ? 'Aspiracja'
                    : 'Standardowy'
              )}
            />
          );
        },
      },
      {
        id: 'keyResult',
        label: t('results.okr.report.columns.keyResult', 'KLUCZOWY REZULTAT'),
        width: '280px',
        dataType: 'text',
        render: (row: OkrReportRow) =>
          isOkrReportGroupRow(row) ? null : (
            <OkrTextCell value={(row as OkrReportKeyResultRow).keyResult?.title ?? null} wrap />
          ),
      },
      {
        id: 'owner',
        label: t('results.okr.report.columns.owner', 'WŁAŚCICIEL'),
        width: '156px',
        dataType: 'owner',
        render: (row: OkrReportRow) => {
          if (isOkrReportGroupRow(row)) return null;
          const kr = (row as OkrReportKeyResultRow).keyResult;
          return (
            <OkrTextCell
              value={kr ? memberNameOrUnknown(resolveMemberName, kr.ownerUserId, isPolish) : null}
            />
          );
        },
      },
      {
        id: 'values',
        label: t('results.okr.report.columns.values', 'START / CEL / BIEŻĄCA'),
        width: '178px',
        dataType: 'number',
        render: (row: OkrReportRow) => {
          if (isOkrReportGroupRow(row)) return null;
          const kr = (row as OkrReportKeyResultRow).keyResult;
          return (
            <span
              className="block truncate whitespace-nowrap text-sm tabular-nums text-c-text-secondary"
              title={kr ? formatOkrTriple(kr, isPolish) : OKR_EMPTY}
            >
              {kr ? formatOkrTriple(kr, isPolish) : OKR_EMPTY}
            </span>
          );
        },
      },
      {
        id: 'progress',
        label: t('results.okr.report.columns.progress', 'POSTĘP'),
        width: '104px',
        dataType: 'number',
        align: 'right',
        render: (row: OkrReportRow) => {
          if (isOkrReportGroupRow(row)) return null;
          const kr = (row as OkrReportKeyResultRow).keyResult;
          if (!kr) return <span className="text-sm text-c-text-muted">{OKR_EMPTY}</span>;
          return (
            <OkrProgressCell
              value={parseOkrKeyResultProgress(kr.progress, kr.progressCalcReason)}
              isPolish={isPolish}
              notCalculableReason={kr.progressCalcReason ?? undefined}
            />
          );
        },
      },
      {
        id: 'confidence',
        label: t('results.okr.report.columns.confidence', 'PEWNOŚĆ'),
        width: '124px',
        dataType: 'status',
        render: (row: OkrReportRow) => {
          if (isOkrReportGroupRow(row)) return null;
          const kr = (row as OkrReportKeyResultRow).keyResult;
          return (
            <OkrTextCell
              value={kr?.confidence ? okrKeyResultConfidenceLabel(kr.confidence, isPolish) : null}
            />
          );
        },
      },
      {
        id: 'deadline',
        label: t('results.okr.report.columns.deadline', 'TERMIN'),
        // K13: data NIGDY nie jest ucinana. „15 gru 2026" w 14 px ma ~96 px,
        // z `px-4` z obu stron potrzeba 128 px — przy 118 px wychodziło
        // „15 gru 20…" (zmierzone na zrzucie 05.09).
        width: '132px',
        dataType: 'date',
        render: (row: OkrReportRow) => {
          if (isOkrReportGroupRow(row)) return null;
          const kr = (row as OkrReportKeyResultRow).keyResult;
          return (
            <OkrTextCell value={kr?.deadline ? formatOkrDate(kr.deadline, isPolish) : null} />
          );
        },
      },
      {
        id: 'state',
        label: t('results.okr.report.columns.stateOne', 'STAN'),
        width: '150px',
        dataType: 'status',
        render: (row: OkrReportRow) => {
          if (isOkrReportGroupRow(row)) return null;
          const keyResultRow = row as OkrReportKeyResultRow;
          if (!keyResultRow.keyResult) {
            return (
              <OkrStatePill
                state="no-signal"
                label={t('results.okr.report.noKeyResults', 'Brak rezultatów')}
                title={t(
                  'results.okr.report.noKeyResultsHint',
                  'Ten cel nie ma jeszcze ani jednego kluczowego rezultatu.'
                )}
              />
            );
          }
          const lastCheckIn = keyResultRow.checkIn?.lastCheckinAt;
          return (
            <OkrStatePill
              state={keyResultRow.state}
              label={okrReportStateLabel(keyResultRow.state, isPolish)}
              title={
                lastCheckIn
                  ? t('results.okr.report.stateWithCheckIn', '{{state}} · check-in {{date}}', {
                      state: okrReportStateLabel(keyResultRow.state, isPolish),
                      date: formatOkrDate(lastCheckIn, isPolish),
                    })
                  : t('results.okr.report.stateWithoutCheckIn', '{{state}} · bez check-inu', {
                      state: okrReportStateLabel(keyResultRow.state, isPolish),
                    })
              }
            />
          );
        },
      },
      {
        id: 'team',
        label: t('results.okr.report.columns.team', 'ZESPÓŁ'),
        width: '150px',
        dataType: 'text',
        defaultVisible: false,
        render: (row: OkrReportRow) =>
          isOkrReportGroupRow(row) ? null : (
            <OkrTextCell value={(row as OkrReportKeyResultRow).keyResult?.teamName ?? null} />
          ),
      },
      {
        id: 'lastCheckIn',
        label: t('results.okr.report.columns.lastCheckIn', 'OSTATNI CHECK-IN'),
        width: '158px',
        dataType: 'date',
        defaultVisible: false,
        render: (row: OkrReportRow) => {
          if (isOkrReportGroupRow(row)) return null;
          const checkIn = (row as OkrReportKeyResultRow).checkIn;
          return (
            <OkrTextCell
              value={checkIn?.lastCheckinAt ? formatOkrDate(checkIn.lastCheckinAt, isPolish) : null}
              hint={checkIn?.lastNote ?? null}
            />
          );
        },
      },
    ],
    [t, isPolish, resolveMemberName]
  );

  const chips: StandardCounterChip[] = useMemo(
    () => [
      {
        id: 'owner',
        label: filter.ownerUserId
          ? t('results.okr.report.chipOwnerNamed', 'Właściciel: {{name}}', {
              name: memberNameOrUnknown(resolveMemberName, filter.ownerUserId, isPolish),
            })
          : t('results.okr.report.chipOwnerAll', 'Właściciel: wszyscy'),
      },
      { id: 'all', label: t('results.okr.report.chipAll', 'Wszystkie') },
      { id: 'risk', label: t('results.okr.report.chipRisk', 'Zagrożone') },
      { id: 'missing', label: t('results.okr.report.chipMissing', 'Bez check-inu') },
    ],
    [filter.ownerUserId, resolveMemberName, isPolish, t]
  );

  const childLock = set ? getOkrSetChildEditLock(set.status) : null;

  const handleCreateObjective = useCallback(
    (values: OkrObjectiveFormValues) => {
      if (!setId) return;
      setFormBusy(true);
      setFormError(null);
      setFormConflict(false);
      createObjective(setId, {
        ...values,
        idempotencyKey: newOkrIdempotencyKey(),
      } as CreateOkrObjectiveInput)
        .then(() => {
          setFormOpen(false);
          void load();
        })
        .catch((err) => {
          setFormConflict(err instanceof OkrObjectiveApiError && err.status === 409);
          setFormError(toUserFacingErrorMessage(err, isPolish));
        })
        .finally(() => setFormBusy(false));
    },
    [setId, load, isPolish]
  );

  const tableRef = useRef<HTMLDivElement | null>(null);
  useOkrGroupRowLayout(
    tableRef,
    `${rows.length}:${rows.map((row) => row.id).join('|')}:${i18n.language}`
  );

  const scopeLine = set
    ? [
        okrSetScopeLabel(set.scopeType, isPolish),
        cycle?.name ?? OKR_EMPTY,
        set.reportGoal ?? set.description ?? OKR_EMPTY,
      ].join(' · ')
    : '';

  return (
    <div ref={tableRef} className="h-full">
      <ResultsVNextRegistryShell
        domain="okr"
        moduleBar={{
          breadcrumbs: [
            {
              label: t('results.okr.report.registryCrumb', 'Raporty OKR'),
              onClick: () => navigate(OKR_REPORT_REGISTRY_PATH),
            },
            { label: set?.title ?? OKR_EMPTY },
          ],
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
          chips,
          activeChip: filter.bucket,
          onChipChange: (id) =>
            setFilter((current) => ({
              ownerUserId: id === 'owner' ? current.ownerUserId : null,
              bucket: (id as OkrReportFilter['bucket']) ?? 'all',
            })),
          // Wybór osoby stoi obok przełącznika widoków, bo chip nie umie
          // rozwinąć listy — chip pokazuje AKTUALNY wybór (i zeruje go, gdy
          // przechodzimy na inny filtr), a wyboru dokonuje się tutaj.
          // SSOT §3: filtr właściciela jest domyślnie widoczny, „bo
          // podmiotem jest człowiek".
          filterControls: (
            <label className="flex items-center gap-2 text-xs text-c-text-secondary">
              <Users size={14} aria-hidden="true" />
              <span className="sr-only">{t('results.okr.report.ownerFilter', 'Właściciel')}</span>
              <select
                className="h-8 rounded-lg border border-c-border bg-c-surface px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                value={filter.ownerUserId ?? ''}
                onChange={(event) =>
                  setFilter({
                    ownerUserId: event.target.value || null,
                    bucket: 'owner',
                  })
                }
                data-testid="okr-report-owner-filter"
              >
                <option value="">{t('results.okr.report.chipOwnerAll', 'Właściciel: wszyscy')}</option>
                {owners.map((ownerUserId) => (
                  <option key={ownerUserId} value={ownerUserId}>
                    {memberNameOrUnknown(resolveMemberName, ownerUserId, isPolish)}
                  </option>
                ))}
              </select>
            </label>
          ),
          primaryCta: {
            label: t('results.okr.report.addObjective', 'Dodaj cel'),
            icon: Plus,
            onClick: () => {
              setFormError(null);
              setFormOpen(true);
            },
            testId: 'okr-report-add-objective-cta',
          },
          menu3Right: (
            <span
              className="flex items-center gap-2 text-xs text-c-text-secondary"
              data-testid="okr-report-summary"
            >
              <span className="uppercase tracking-wide text-c-text-muted">
                {t('results.okr.report.summary', 'Podsumowanie')}
              </span>
              <OkrStateCountsCell
                counts={summary}
                title={t(
                  'results.okr.report.stateTooltip',
                  'na dobrej drodze {{onTrack}} · zagrożone {{atRisk}} · krytyczne {{critical}} · bez check-inu {{noSignal}}',
                  summary as unknown as Record<string, number>
                )}
              />
            </span>
          ),
        }}
        table={{
          columns,
          data: rows as unknown as TableRow[],
          persistKey: 'results-vnext.okr-report-detail',
          minTableWidth: 'columns',
          density: 'compact',
          loading,
          error,
          onRetry: () => void load(),
          rowClassName: (row) =>
            isOkrReportGroupRow(row)
              ? 'okr-report-group-row bg-c-surface-raised font-semibold'
              : '',
          empty:
            !loading && !error && rows.length === 0
              ? {
                  title: t('results.okr.report.emptyRowsTitle', 'Brak wierszy dla tego filtra'),
                  description: t(
                    'results.okr.report.emptyRowsDescription',
                    'Żaden kluczowy rezultat nie pasuje do wybranego filtra. Zmień filtr albo dodaj cel do raportu.'
                  ),
                }
              : undefined,
          onRowClick: (row) => {
            if (isOkrReportGroupRow(row)) return;
            openObjective(row as unknown as OkrReportKeyResultRow);
          },
          rowMenu: (row) =>
            isOkrReportGroupRow(row)
              ? {}
              : {
                  primary: [
                    {
                      id: 'open',
                      label: t('results.okr.report.openObjective', 'Otwórz kartę celu'),
                      onClick: () => openObjective(row as unknown as OkrReportKeyResultRow),
                    },
                  ],
                },
        }}
      />
      <OkrObjectiveFormModal
        open={formOpen}
        mode="create"
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateObjective}
        isPolish={isPolish}
        currentUserId={currentUserId}
        blockedReason={childLock ? (isPolish ? childLock.reason.pl : childLock.reason.en) : null}
        busy={formBusy}
        errorMessage={formError}
        isConflict={formConflict}
      />
    </div>
  );
};

export default OkrReportPage;

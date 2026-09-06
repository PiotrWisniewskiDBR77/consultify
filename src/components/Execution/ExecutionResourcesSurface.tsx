import { ArrowRight, Eye } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { ErrorState, SkeletonState } from '@/components/shared/states';
import { StandardPreview, StandardTable, type TableColumn } from '@/components/standard';
import { useDeferredLoading } from '@/hooks/useDeferredLoading';
import { capacityUnitLabel } from '@/labels/capacityUnitLabels';
import { persistentCommandId } from '@/services/initiatives-execution/persistentCommandId';
import {
  listExecutionCases,
  proposeOperationalAllocation,
  readExecutionCase,
  readExecutionWork,
  readOperationalAllocations,
  simulateOperationalAllocation,
  transitionOperationalAllocation,
} from '@/services/initiatives-execution/runtimeApi';

import { countExecutionPresets, type ExecutionMenu3Contract } from './canonicalMenu3';
import {
  fanOutExecutionCases,
  isExecutionCaseTimeout,
  loadExecutionCaseWithTimeout,
} from './executionCaseFanOut';
import {
  executionLocalReviewEnabled,
  executionReviewCases,
  getExecutionReviewAllocations,
  getExecutionReviewCase,
  getExecutionReviewWork,
} from './executionLocalReviewData';
const resourcePresets = [
  'all',
  'overallocated',
  'unassigned',
  'skill-gaps',
  'unconfirmed',
  'unknown',
  'cost-risk',
  'needs-decision',
  'team',
  'initiative',
] as const;
const allocationStatusLabel = (value?: string) =>
  ({
    PROPOSED: 'Propozycja',
    REQUESTED: 'Oczekuje na akceptację',
    ASSIGNEE_ACCEPTED: 'Zaakceptowane przez wykonawcę',
    CONFIRMED: 'Potwierdzone',
    CONDITIONALLY_CONFIRMED: 'Potwierdzone warunkowo',
    DECLINED: 'Odrzucone',
    ENDED: 'Zakończone',
  })[value ?? ''] ??
  value?.toLowerCase().replaceAll('_', ' ') ??
  'Brak danych';
const allocationSourceSummary = (item: any) => {
  const refs = [
    ['Dostępność', item.availabilityRef],
    ['Kalendarz', item.calendarRef],
    ['Pozostała praca', item.remainingEstimateRef],
  ]
    .filter(([, source]) => source?.ref)
    .map(
      ([label, source]) =>
        `${label}: ${pl(source.knowledgeState)} · v${source.version ?? '—'}`
    );
  if (item.costRef?.ref)
    refs.push(
      `Koszt: ${pl(item.costRef.knowledgeState, ETYKIETY_PL.KNOWN)} · v${item.costRef.version ?? '—'}`
    );
  return refs.length ? refs.join(' · ') : 'Brak źródeł dowodowych';
};
/**
 * ★ Odbiór grafiki 174-domkniecie (2026-09-01) — „Katarzyna WóJcik".
 *
 * Było: `.replace(/\b\w/g, …)`. W JavaScripcie `\w` to WYŁĄCZNIE `[A-Za-z0-9_]`,
 * więc „ó" nie jest znakiem słowa — po nim leci granica słowa `\b` i regexp
 * podnosił na wielką literę ŚRODEK nazwiska: „Wójcik" → „WóJcik". Ten sam
 * kształt trafiłby każde polskie nazwisko z ą/ć/ę/ł/ń/ó/ś/ź/ż w środku.
 *
 * Jest: granica liczona po Unicode (`\p{L}` z flagą `u`) i podnoszona tylko
 * litera po POCZĄTKU napisu albo po separatorze. Reszta liter nie jest ruszana
 * (nie ma `toLowerCase`), więc „Wójcik" i „McKenzie" zostają, jak są.
 */
const businessLabel = (value: string | null | undefined, fallback: string) =>
  value
    ? value
        .replace(/[-_]+/g, ' ')
        .replace(/(^|[\s/])(\p{L})/gu, (_m, separator, letter) => separator + letter.toUpperCase())
    : fallback;
/**
 * ★ Odbiór grafiki 174-domkniecie (2026-09-01) — surowe enumy backendu
 * w komórkach tabeli. Właściciel widział „UNKNOWN" w kolumnach Dostępność,
 * Pozostałe, Zakres obciążenia, Koszt/prognoza i Świeżość oraz „NONE",
 * „CAPACITY_CONFLICT", „NOT_ASSESSED", „CURRENT" w Konflikcie i Świeżości.
 * Ta powierzchnia pisze TREŚĆ KOMÓREK po polsku wprost (bez i18n) — słownik
 * jest tu, przy miejscu użycia. Dane surowe (`item.*.knowledgeState`) zostają
 * nietknięte — filtry i podgląd nadal porównują enumy, tłumaczona jest
 * wyłącznie TREŚĆ KOMÓRKI. (i18n-reszta 20260903: nagłówki kolumn NIŻEJ
 * przeszły na `t()` — to była inna, dodatkowa dziura, patrz `columns`.)
 */
const ETYKIETY_PL: Record<string, string> = {
  UNKNOWN: 'Nieznane',
  KNOWN: 'Znane',
  PARTIAL: 'Częściowe',
  NONE: 'Brak',
  CURRENT: 'Aktualne',
  STALE: 'Nieaktualne',
  NOT_ASSESSED: 'Nie oceniono',
  CAPACITY_CONFLICT: 'Konflikt mocy przerobowej',
  SKILL_CONFLICT: 'Konflikt kompetencji',
  CALENDAR_CONFLICT: 'Konflikt kalendarza',
};
const pl = (value: string | null | undefined, fallback = 'Nieznane') =>
  value ? (ETYKIETY_PL[value] ?? value) : fallback;
const knowledgeValue = (value: any) => {
  if (!value || value.knowledgeState === 'UNKNOWN') return ETYKIETY_PL.UNKNOWN;
  if (value.knowledgeState === 'PARTIAL') return ETYKIETY_PL.PARTIAL;
  const amount = value.base ?? value.value ?? value.committed ?? value.estimated;
  return amount === undefined || amount === null ? pl(value.knowledgeState) : String(amount);
};
export const ExecutionResourcesSurface = ({
  activePreset,
  onCountsChange,
  onRegisterFilterControl,
}: ExecutionMenu3Contract & {
  /**
   * Rejestruje węzeł kontrolki (filtr realizacji + "Zaproponuj przydział")
   * do prawej strony Menu 2 gospodarza (ExecutionHub) — patrz identyczny
   * komentarz w `ExecutionWorkSurface`. Odbiór grafiki 165-menu3-pasek,
   * execution-tab-resources: właściciel zgłosił ten sam problem co na
   * ekranie "Praca".
   */
  onRegisterFilterControl?: (node: React.ReactNode) => void;
}) => {
  const { t } = useTranslation();
  const [cases, setCases] = useState<any[]>([]),
    [caseId, setCaseId] = useState(''),
    [caseVersion, setCaseVersion] = useState(1),
    [taskVersion, setTaskVersion] = useState(1),
    [items, setItems] = useState<any[]>([]),
    [selected, setSelected] = useState<any | null>(null),
    [showWorkspace, setShowWorkspace] = useState(false),
    [json, setJson] = useState(''),
    [showProposal, setShowProposal] = useState(false),
    [assessment, setAssessment] = useState<any | null>(null),
    [rationale, setRationale] = useState(''),
    [conditions, setConditions] = useState(''),
    [state, setState] = useState<'LOADING' | 'READY' | 'ERROR' | 'CASE_UNREACHABLE'>(
      'LOADING'
    ),
    // Realizacje, których backend nie zwrócił (błąd albo brak odpowiedzi w czasie).
    [unreachableCaseIds, setUnreachableCaseIds] = useState<string[]>([]);
  const loadingPhase = useDeferredLoading(state === 'LOADING');
  const loadCases = useCallback(async () => {
    setState('LOADING');
    try {
      const body = (await listExecutionCases()) as any;
      const nextCases =
        (body.cases ?? []).length > 0
          ? body.cases
          : executionLocalReviewEnabled
            ? executionReviewCases
            : [];
      setCases(nextCases);
      // Wachlarz odporny na JEDNĄ wiszącą realizację — patrz executionCaseFanOut.ts.
      // Do 2026-09-05 stało tu `Promise.all`, a ta powierzchnia dodatkowo NIE MA
      // żadnego renderu dla stanu LOADING — więc jedna realizacja, której
      // endpoint /work nie odpowiada (zmierzone na stagingu), dawała pusty biały
      // obszar bez tabeli, bez podglądu i bez komunikatu.
      // Render PRZYROSTOWY (1.12-R2): nie czekamy na najwolniejsza realizacje.
      // Zmierzone: przy jednej wiszacej realizacji pierwszy wiersz pojawial sie
      // po 12 s (limit wachlarza), mimo ze pozostale odpowiadaly od razu.
      const zebrane: any[] = [];
      const nieodpowiadajace: string[] = [];
      const fanOut = await fanOutExecutionCases<any>(
        nextCases,
        async (executionCase: any, signal) => {
          const isReview = executionReviewCases.some(
            (item) => item.executionCaseId === executionCase.executionCaseId
          );
          const [result, work] = isReview
            ? [
                getExecutionReviewAllocations(executionCase.executionCaseId),
                getExecutionReviewWork(executionCase.executionCaseId),
              ]
            : ((await Promise.all([
                readOperationalAllocations(executionCase.executionCaseId, signal),
                readExecutionWork(executionCase.executionCaseId, signal),
              ])) as any[]);
          return (result.items ?? []).map((item: any) => ({
            ...item,
            executionCaseId: executionCase.executionCaseId,
            taskTitle: (work.tasks ?? []).find((task: any) => task.taskId === item.taskId)?.title,
          }));
        },
        {
          onCaseSettled: (entry) => {
            if (entry.ok) {
              zebrane.push(...entry.items);
              // Pusta (ale udana) realizacja nie odblokowuje widoku — inaczej
              // mignelby komunikat „brak przydzialow", zanim odpowie kolejna.
              if (zebrane.length > 0) {
                setItems([...zebrane]);
                setState('READY');
              }
            } else {
              nieodpowiadajace.push(entry.caseId);
              setUnreachableCaseIds([...nieodpowiadajace]);
            }
          },
        }
      );
      setItems(fanOut.items);
      setUnreachableCaseIds(fanOut.failedCaseIds);
      setState('READY');
    } catch {
      if (!executionLocalReviewEnabled) {
        setState('ERROR');
        return;
      }
      setCases(executionReviewCases);
      setUnreachableCaseIds([]);
      setItems(
        executionReviewCases.flatMap((executionCase) => {
          const work = getExecutionReviewWork(executionCase.executionCaseId);
          return (getExecutionReviewAllocations(executionCase.executionCaseId).items ?? []).map(
            (item: any) => ({
              ...item,
              executionCaseId: executionCase.executionCaseId,
              taskTitle: (work.tasks ?? []).find((task: any) => task.taskId === item.taskId)?.title,
            })
          );
        })
      );
      setState('READY');
    }
  }, []);
  useEffect(() => {
    void loadCases();
  }, [loadCases]);
  /**
   * Wybor JEDNEJ realizacji z listy Menu 2.
   *
   * ZMIERZONY DEFEKT (1.12-R2, 2026-09-06, warstwa 3 z 3): tu stal goly
   * `Promise.all([...])` BEZ `AbortSignal` i BEZ limitu czasu. Wachlarz
   * `fanOutExecutionCases` chronil wylacznie sciezke „wszystkie realizacje",
   * wiec klikniecie w realizacje, ktorej `/work` nie odpowiada, przywracalo
   * defekt w calosci: `useDeferredLoading` po 15 s podmienial szkielet na
   * `ErrorState variant="timeout"` (po angielsku, bez nazwy realizacji),
   * a wiszacy fetch zostawal otwarty.
   *
   * Teraz: TEN SAM limit co wachlarz (`EXECUTION_CASE_FANOUT_TIMEOUT_MS`),
   * ten sam abort, i osobny stan `CASE_UNREACHABLE` — po polsku, z nazwa
   * realizacji i wyjsciem „wroc do wszystkich realizacji".
   */
  const load = async (id: string, focusAllocationId?: string) => {
    setCaseId(id);
    setUnreachableCaseIds([]);
    setState('LOADING');
    try {
      const reviewCase = getExecutionReviewCase(id);
      const [c, a, work] = reviewCase
        ? [reviewCase, getExecutionReviewAllocations(id), getExecutionReviewWork(id)]
        : ((await loadExecutionCaseWithTimeout(id, (signal) =>
            Promise.all([
              readExecutionCase(id, signal),
              readOperationalAllocations(id, signal),
              readExecutionWork(id, signal),
            ])
          )) as any[]);
      setCaseVersion(c.version);
      const nextItems = (a.items ?? []).map((item: any) => ({ ...item, executionCaseId: id }));
      setItems(nextItems);
      const selectedAllocationId = focusAllocationId ?? selected?.allocationId;
      if (selectedAllocationId) {
        const nextSelected = nextItems.find(
          (item: any) => item.allocationId === selectedAllocationId
        );
        setSelected(nextSelected ?? null);
        const task = nextSelected
          ? (work.tasks ?? []).find((item: any) => item.taskId === nextSelected.taskId)
          : null;
        if (task) setTaskVersion(task.version);
      }
      setState('READY');
    } catch (error) {
      setState(isExecutionCaseTimeout(error) ? 'CASE_UNREACHABLE' : 'ERROR');
    }
  };
  // i18n-reszta 20260903: nagłówki kolumn przez t() (poprzednio literały PL
  // nie reagowały na `?lang=` — pomiar nadzorcy 03.09, execution-tab-resources).
  // Wartości KOMÓREK (ETYKIETY_PL, enum stanów) zostają po polsku — patrz
  // komentarz przy ETYKIETY_PL powyżej (decyzja 174-domkniecie, dotyczyła
  // TREŚCI komórki, nie nagłówków).
  const columns: TableColumn[] = [
    {
      id: 'resourceLabel',
      label: t('execution.resources.columns.person', 'Person / team / role'),
      sortable: true,
      width: '220px',
    },
    { id: 'periodLabel', label: t('execution.resources.columns.period', 'Period'), width: '180px' },
    {
      id: 'availabilityLabel',
      label: t('execution.resources.columns.availability', 'Availability'),
      width: '150px',
    },
    { id: 'demandLabel', label: t('execution.resources.columns.demand', 'Allocated'), width: '150px' },
    {
      id: 'remainingLabel',
      label: t('execution.resources.columns.remaining', 'Remaining'),
      width: '140px',
    },
    { id: 'loadLabel', label: t('execution.resources.columns.load', 'Load range'), width: '160px' },
    {
      id: 'skillLabel',
      label: t('execution.resources.columns.skillMatch', 'Skill match'),
      width: '150px',
    },
    {
      id: 'taskTitle',
      label: t('execution.resources.columns.affectedWork', 'Affected work'),
      sortable: true,
      width: '260px',
    },
    { id: 'costLabel', label: t('execution.resources.columns.cost', 'Cost / forecast'), width: '160px' },
    {
      id: 'status',
      label: t('execution.table.status', 'Status'),
      sortable: true,
      filterable: true,
      width: '200px',
      render: (row) => allocationStatusLabel(String(row.status)),
    },
    { id: 'conflictLabel', label: t('execution.resources.columns.conflict', 'Conflict'), width: '130px' },
    { id: 'freshnessLabel', label: t('execution.resources.columns.freshness', 'Freshness'), width: '130px' },
    {
      id: 'nextActionLabel',
      label: t('execution.resources.columns.nextAction', 'Next action'),
      width: '220px',
    },
  ];
  const tableItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        id: item.allocationId,
        title: businessLabel(
          item.assigneeName || item.personName || item.roleName || item.assigneeId,
          'Nieprzypisany zasób'
        ),
        resourceLabel: businessLabel(
          item.assigneeName ||
            item.personName ||
            item.teamName ||
            item.roleName ||
            item.assigneeId ||
            item.roleId,
          'Nieprzypisany zasób'
        ),
        description: item.taskTitle || `Zadanie ${String(item.taskId || '').slice(-8)}`,
        taskTitle: item.taskTitle || `Zadanie · ${String(item.taskId || '').slice(-8)}`,
        periodLabel:
          item.timeBasis?.window ||
          (item.timeBasis?.windowUnit
            ? capacityUnitLabel(item.timeBasis.windowUnit, true)
            : ETYKIETY_PL.UNKNOWN),
        availabilityLabel: knowledgeValue(item.availability ?? item.supply),
        demandLabel: knowledgeValue(item.demand),
        remainingLabel: knowledgeValue(item.remainingDemand ?? item.remainingEstimate),
        loadLabel:
          item.load?.knowledgeState === 'UNKNOWN'
            ? ETYKIETY_PL.UNKNOWN
            : item.load?.low != null && item.load?.high != null
              ? `${item.load.low}–${item.load.high}`
              : ETYKIETY_PL.UNKNOWN,
        skillLabel: item.skillMatch?.label || pl(item.skillMatch?.state),
        costLabel: knowledgeValue(item.cost ?? item.costForecast),
        conflictLabel: pl(item.conflict?.state || item.assessment?.state, 'Nie oceniono'),
        freshnessLabel: pl(item.freshness || item.availabilityRef?.freshness),
        nextActionLabel: item.nextAction || 'Sprawdź dane i akceptację',
      })),
    [items]
  );
  const matches = useCallback((row: any, preset: string) => {
    if (preset === 'all') return true;
    if (preset === 'overallocated')
      return row.assessment?.state === 'OVERALLOCATED' || row.load?.high > 1;
    if (preset === 'unassigned') return !row.assigneeId;
    if (preset === 'skill-gaps') return row.skillMatch?.state === 'GAP';
    if (preset === 'unconfirmed')
      return !['CONFIRMED', 'ACTIVE'].includes(String(row.status).toUpperCase());
    if (preset === 'unknown')
      return (
        row.availability?.knowledgeState === 'UNKNOWN' || row.demand?.knowledgeState === 'UNKNOWN'
      );
    if (preset === 'cost-risk')
      return row.cost?.knowledgeState === 'UNKNOWN' || row.cost?.risk === true;
    if (preset === 'needs-decision')
      return ['REQUESTED', 'ACCEPTED', 'CONDITIONAL'].includes(String(row.status).toUpperCase());
    if (preset === 'team') return Boolean(row.teamId);
    if (preset === 'initiative') return Boolean(row.initiativeId);
    return false;
  }, []);
  const visibleItems = useMemo(
    () => tableItems.filter((row) => matches(row, activePreset ?? 'all')),
    [activePreset, matches, tableItems]
  );
  useEffect(
    () => onCountsChange?.(countExecutionPresets(tableItems, resourcePresets, matches)),
    [matches, onCountsChange, tableItems]
  );
  const propose = async () => {
    const p = JSON.parse(json),
      work = (await readExecutionWork(caseId)) as any;
    const task = work.tasks.find((t: any) => t.taskId === p.taskId);
    setTaskVersion(task.version);
    await proposeOperationalAllocation(caseId, p.taskId, p.allocationId, {
      ...p,
      expectedVersion: 0,
      expectedCaseVersion: caseVersion,
      expectedTaskVersion: task.version,
      clientRequestId: persistentCommandId(
        'execution-resources',
        `${caseId}:${caseVersion}:${task.version}:propose:${p.allocationId}:${json}`
      ),
    });
    await load(caseId, p.allocationId);
  };
  const simulate = async () => {
    const p = JSON.parse(json);
    setAssessment(
      await simulateOperationalAllocation({ allocation: p, expectedTimeBasis: p.timeBasis })
    );
  };
  const transition = async (action: string) => {
    if (!selected) return;
    const result = (await transitionOperationalAllocation(selected.allocationId, {
      expectedVersion: selected.version,
      expectedCaseVersion: caseVersion,
      expectedTaskVersion: taskVersion,
      clientRequestId: persistentCommandId(
        'execution-resources',
        `${selected.allocationId}:${selected.version}:${caseVersion}:${taskVersion}:${action}:${rationale}:${conditions}`
      ),
      action,
      rationale,
      conditions: conditions.split('\n').filter(Boolean),
      expectedTimeBasis: selected.timeBasis,
    })) as any;
    setAssessment(result.response?.assessment ?? assessment);
    await load(caseId, selected.allocationId);
  };
  const openWorkspace = async (item: any) => {
    if (caseId !== item.executionCaseId) await load(item.executionCaseId, item.allocationId);
    setSelected(item);
    setShowWorkspace(true);
  };
  // Menu 2 (prawa strona) — filtr realizacji + "Zaproponuj przydział". Patrz
  // komentarz propa `onRegisterFilterControl` powyżej.
  useEffect(() => {
    if (!onRegisterFilterControl) return;
    onRegisterFilterControl(
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Execution Case for resources"
          value={caseId}
          onChange={(e) => {
            const nextCaseId = e.target.value;
            if (nextCaseId) void load(nextCaseId);
            else {
              setCaseId('');
              setSelected(null);
              setShowWorkspace(false);
              void loadCases();
            }
          }}
          className="h-9 min-w-[200px] rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 text-sm text-c-text-secondary"
        >
          <option value="">{t('execution.filters.allCases', 'All deliveries')}</option>
          {cases.map((c) => (
            <option key={c.executionCaseId} value={c.executionCaseId}>
              {/* Realizacja, ktora nie odpowiedziala, jest OZNACZONA na liscie —
                  inaczej uzytkownik wybiera ja w kolko i za kazdym razem czeka. */}
              {`${
                c.initiativeTitle || c.title || `Realizacja · ${String(c.executionCaseId).slice(-8)}`
              }${unreachableCaseIds.includes(c.executionCaseId) ? ' — nie odpowiada' : ''}`}
            </option>
          ))}
        </select>
        {caseId && (
          <button type="button" className="btn-secondary" onClick={() => setShowProposal(true)}>
            {t('execution.resources.actions.proposeAllocation', 'Propose allocation')}
          </button>
        )}
      </div>
    );
    return () => onRegisterFilterControl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterFilterControl, caseId, cases, unreachableCaseIds]);
  if (state === 'CASE_UNREACHABLE') {
    const nazwa =
      cases.find((item) => item.executionCaseId === caseId)?.initiativeTitle ||
      `Realizacja · ${String(caseId).slice(-8)}`;
    return (
      <div
        role="alert"
        data-testid="execution-resources-case-unreachable"
        className="m-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
      >
        <p className="font-medium text-c-text-primary">{`Ta realizacja nie odpowiada: ${nazwa}`}</p>
        <p className="mt-1 text-c-text-secondary">
          Przerwaliśmy oczekiwanie po 12 sekundach. Pozostałe realizacje działają — wróć do
          wszystkich albo spróbuj ponownie.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => void load(caseId)}>
            Spróbuj ponownie
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setCaseId('');
              setSelected(null);
              setShowWorkspace(false);
              void loadCases();
            }}
          >
            Wszystkie realizacje
          </button>
        </div>
      </div>
    );
  }
  if (state === 'ERROR')
    return (
      <div role="alert" className="m-4 rounded-xl border border-c-danger/40 p-4 text-sm">
        <p>Nie udało się załadować rejestru zasobów.</p>
        <button
          type="button"
          className="btn-secondary mt-3"
          onClick={() => (caseId ? void load(caseId) : void loadCases())}
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  return (
    <section aria-label="Execution Resources" className="flex h-full min-h-0 flex-col p-4">
      {/*
       * Stan ładowania MUSI się renderować. Do 2026-09-05 ta powierzchnia miała
       * gałęzie wyłącznie dla `state === 'READY'`, więc dopóki dane się nie
       * pobrały (albo nie pobrały się NIGDY), użytkownik widział pusty biały
       * obszar bez jednego słowa wyjaśnienia — dokładnie to zgłoszono w odbiorze
       * na żywo 05.09 (`execution-tab-resources`).
       */}
      {state === 'LOADING' && loadingPhase === 'timeout' && (
        <ErrorState
          variant="timeout"
          compact
          onRetry={() => (caseId ? void load(caseId) : void loadCases())}
        />
      )}
      {state === 'LOADING' && (loadingPhase === 'pending' || loadingPhase === 'slow') && (
        <div data-testid="execution-resources-loading" className="flex min-h-0 flex-1 flex-col gap-3">
          {loadingPhase === 'slow' && (
            <p role="status" className="text-sm text-c-text-muted">
              Wczytywanie trwa dłużej niż zwykle…
            </p>
          )}
          <SkeletonState variant="table" rows={6} label="Wczytuję kanoniczny rejestr zasobów" />
        </div>
      )}
      {state === 'READY' && unreachableCaseIds.length > 0 && (
        <p
          role="status"
          className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-c-text-secondary"
        >
          {`Nie udało się pobrać zasobów z ${unreachableCaseIds.length} realizacji — poniżej zasoby z pozostałych.`}
        </p>
      )}
      {state === 'READY' && items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-c-border p-8 text-center text-sm text-c-text-muted">
          Brak kanonicznych przydziałów zasobów w dostępnych realizacjach.
        </div>
      ) : state === 'READY' ? (
        /*
         * `flex-1 min-h-0` + `flex h-full min-h-0 flex-col` na <section> wyzej.
         * POWOD (pomiar 02.09, scripts/dev/measure-preview-canon.mjs --wysokosc):
         * `TableWithPreviewLayout` ma root `h-full`, czyli `height:100%`, a to
         * rozwiazuje sie TYLKO wzgledem rodzica o definitywnej wysokosci. Tutaj
         * lancuch przerywaly dwa pudelka o wysokosci `auto` (<section className="p-4">
         * i <div className="mt-4">), wiec `h-full` cichutko degradowalo do `auto`
         * i panel podgladu konczyl sie na swojej tresci - zmierzone 693 px przy
         * 863 px dostepnej przestrzeni (luka 170 px). Ekrany, ktore dzialaly
         * poprawnie (idea-table, drd-library-entry, luka 0 px), maja dokladnie
         * ten ksztalt przodkow: flex item z `flex-1 min-h-0`. Odtwarzamy go tutaj,
         * zamiast wpisywac wysokosc w pikselach.
         */
        <div className="mt-4 flex-1 min-h-0">
          <TableWithPreviewLayout<any>
            selectedId={selected?.allocationId ?? null}
            selectedItem={selected}
            onSelect={(id) => {
              setSelected(items.find((item) => item.allocationId === id) ?? null);
              setShowWorkspace(false);
            }}
            onOpenFull={(id) => {
              const item = items.find((candidate) => candidate.allocationId === id);
              if (item) void openWorkspace(item);
            }}
            itemIds={items.map((item) => item.allocationId)}
            getItemById={(id) => items.find((item) => item.allocationId === id) ?? null}
            previewOpen={!showWorkspace && Boolean(selected)}
            renderPreview={(item) => (
              <StandardPreview
                embedded
                title={businessLabel(
                  item.assigneeName || item.personName || item.roleName || item.assigneeId,
                  'Nieprzypisany zasób'
                )}
                onClose={() => setSelected(null)}
                onOpenFull={() => void openWorkspace(item)}
                openLabel="Otwórz przydział"
                meta={{
                  pills: [
                    {
                      label: allocationStatusLabel(item.status),
                      tone: item.status === 'CONFIRMED' ? 'success' : 'info',
                    },
                    { label: pl(item.demand?.knowledgeState), tone: 'neutral' },
                  ],
                  trailing: <span className="text-xs">v{item.version}</span>,
                  recommendation: item.nextAction ?? 'Zweryfikuj dostępność i akceptację.',
                }}
                details={{
                  label: 'Szczegóły przydziału',
                  text: item.rationale || 'Brak dodatkowego opisu.',
                  properties: [
                    {
                      id: 'task',
                      label: 'Zadanie',
                      value: item.taskTitle || item.taskId || ETYKIETY_PL.UNKNOWN,
                    },
                    {
                      id: 'period',
                      label: 'Okres',
                      value:
                        item.timeBasis?.window ||
                        (item.timeBasis?.windowUnit
                          ? capacityUnitLabel(item.timeBasis.windowUnit, true)
                          : null) ||
                        ETYKIETY_PL.UNKNOWN,
                    },
                    {
                      id: 'demand',
                      label: 'Zapotrzebowanie',
                      value:
                        item.demand?.knowledgeState === 'UNKNOWN'
                          ? ETYKIETY_PL.UNKNOWN
                          : String(
                              item.demand?.base ?? item.demand?.value ?? ETYKIETY_PL.UNKNOWN
                            ),
                    },
                    {
                      id: 'evidence',
                      label: 'Źródła',
                      value: allocationSourceSummary(item),
                    },
                  ],
                  onCopy: () => void navigator.clipboard?.writeText(item.allocationId),
                }}
                relations={[
                  { label: 'Powiązana realizacja', onClick: () => undefined },
                  { label: item.taskTitle || 'Powiązane zadanie', onClick: () => undefined },
                ]}
                relationsEmptyLabel="Brak powiązań"
                actions={{
                  informational: [
                    {
                      id: 'open',
                      label: 'Otwórz przydział',
                      variant: 'positive',
                      icon: Eye,
                      shortcut: 'O',
                      onClick: () => void openWorkspace(item),
                    },
                  ],
                }}
              />
            )}
          >
            <StandardTable
              columns={columns}
              data={visibleItems}
              selectedRowId={selected?.allocationId ?? null}
              onRowClick={async (row) => {
                const item = items.find((candidate) => candidate.allocationId === row.id) ?? null;
                setSelected(item);
                setShowWorkspace(false);
                const work = (await readExecutionWork(item?.executionCaseId)) as any;
                const task = (work.tasks ?? []).find(
                  (candidate: any) => candidate.taskId === item?.taskId
                );
                if (task) setTaskVersion(task.version);
              }}
              onRowDoubleClick={(row) => {
                const item = items.find((candidate) => candidate.allocationId === row.id);
                if (item) void openWorkspace(item);
              }}
              rowMenu={(row) => ({
                primary: [
                  {
                    id: 'open',
                    label: 'Otwórz przydział',
                    icon: ArrowRight,
                    onClick: () => {
                      const item = items.find((candidate) => candidate.allocationId === row.id);
                      if (item) void openWorkspace(item);
                    },
                  },
                ],
                universalHandlers: {
                  preview: () => {
                    setSelected(items.find((item) => item.allocationId === row.id) ?? null);
                    setShowWorkspace(false);
                  },
                  archiveNote: 'Przydział pozostaje częścią audytowalnej realizacji.',
                },
                destructive: {
                  label: 'Usuń',
                  note: 'Kanoniczny przydział nie może zostać usunięty.',
                },
              })}
              persistKey="execution.resources.canonical-register.v3"
            />
          </TableWithPreviewLayout>
        </div>
      ) : null}
      {showWorkspace && selected && (
        <section
          aria-label="Operational Allocation workspace"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Przydział {selected.allocationId}</h3>
              <p className="text-xs text-c-text-muted">
                {allocationStatusLabel(selected.status)} ·{' '}
                {businessLabel(
                  selected.assigneeName ||
                    selected.personName ||
                    selected.roleName ||
                    selected.assigneeId,
                  'Nieprzypisany zasób'
                )}
              </p>
            </div>
            <button className="btn-secondary" onClick={() => setShowWorkspace(false)}>
              Zamknij workspace
            </button>
          </div>
          <p className="mt-3 text-sm">Zadanie {selected.taskTitle || selected.taskId}</p>
          <p className="text-sm">
            Dane {pl(selected.demand?.knowledgeState)} · okres{' '}
            {selected.timeBasis?.window ||
              (selected.timeBasis?.windowUnit
                ? capacityUnitLabel(selected.timeBasis.windowUnit, true)
                : ETYKIETY_PL.UNKNOWN)}
          </p>
        </section>
      )}
      {showProposal && caseId && (
        <section
          aria-label="Operational Allocation Workbench"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Propozycja przydziału</h3>
              <p className="text-xs text-c-text-muted">
                Najpierw symulacja, potem zatwierdzany przydział.
              </p>
            </div>
            <button className="btn-secondary" onClick={() => setShowProposal(false)}>
              Zamknij
            </button>
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-medium">Dane zaawansowane</summary>
            <textarea
              aria-label="Operational Allocation proposal JSON"
              className="min-h-40 w-full rounded border border-c-border bg-c-surface p-2 font-mono text-xs"
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
          </details>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => void simulate()}>
              Symuluj
            </button>
            <button className="btn-secondary" onClick={() => void propose()}>
              Zapisz propozycję
            </button>
          </div>
          {assessment && (
            <div role="status">
              <strong>{assessment.state}</strong>
              <p>{assessment.findings?.join(', ') || 'READY'}</p>
            </div>
          )}
          <textarea
            aria-label="Allocation rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
          <textarea
            aria-label="Allocation conditions"
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {[
              'REQUEST',
              'ASSIGNEE_ACCEPT',
              'ASSIGNEE_DECLINE',
              'RM_CONFIRM',
              'RM_CONDITIONAL',
              'RM_DECLINE',
            ].map((a) => (
              <button key={a} className="btn-secondary" onClick={() => void transition(a)}>
                {
                  {
                    REQUEST: 'Przekaż do akceptacji',
                    ASSIGNEE_ACCEPT: 'Akceptuj przydział',
                    ASSIGNEE_DECLINE: 'Odrzuć przydział',
                    RM_CONFIRM: 'Potwierdź',
                    RM_CONDITIONAL: 'Potwierdź warunkowo',
                    RM_DECLINE: 'Odrzuć',
                  }[a]
                }
              </button>
            ))}
          </div>
          {assessment?.state === 'EVIDENCE_MISSING' && (
            <p role="alert">EVIDENCE_MISSING — activation remains blocked.</p>
          )}
        </section>
      )}
    </section>
  );
};

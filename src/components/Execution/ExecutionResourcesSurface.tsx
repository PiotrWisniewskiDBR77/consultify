import { ArrowRight, Eye } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { ErrorState, SkeletonState } from '@/components/shared/states';
import { StandardPreview, StandardTable, type TableColumn } from '@/components/standard';
import { useDeferredLoading } from '@/hooks/useDeferredLoading';
import { capacityUnitLabel } from '@/labels/capacityUnitLabels';
import {
  readExecutionResourcePlan,
  saveUserCapacity,
  type ResourcePlanResponse,
  type ResourcePlanRow,
} from '@/services/execution/resourcePlanApi';
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
const resourcePresets = ['osoby', 'role', 'konflikty'] as const;
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
    [unreachableCaseIds, setUnreachableCaseIds] = useState<string[]>([]),
    /*
     * PLAN ZASOBÓW (1.12-R2) — osoba × tydzień: popyt vs podaż vs obłożenie vs luka.
     * Ładuje się NIEZALEŻNIE od realizacji, więc tabela nie czeka na wachlarz
     * i nie zależy od tego, czy handoff w ogóle utworzył realizację (w DBR77
     * realizacji jest 0, a zadań z godzinami 84 — dlatego tabela była pusta).
     */
    [plan, setPlan] = useState<ResourcePlanResponse | null>(null),
    [planState, setPlanState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING'),
    [selectedPlanRowId, setSelectedPlanRowId] = useState<string | null>(null),
    [capacityDialog, setCapacityDialog] = useState<{
      userId: string;
      name: string;
      hours: string;
      percent: string;
    } | null>(null),
    [capacityError, setCapacityError] = useState('');
  const loadingPhase = useDeferredLoading(planState === 'LOADING');
  const loadPlan = useCallback(async () => {
    setPlanState('LOADING');
    try {
      setPlan(await readExecutionResourcePlan(8));
      setPlanState('READY');
    } catch {
      setPlan(null);
      setPlanState('ERROR');
    }
  }, []);
  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);
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
  /*
   * KOLUMNY WG PLANU 1.12 C2 (wiersz „Zasoby"):
   *   Osoba/rola · Tydzień · Popyt (h) · Podaż (h) · Obłożenie % · Luka.
   * Poprzednie 13 kolumn opisywało KANONICZNY PRZYDZIAŁ (dostępność, koszt,
   * dopasowanie kompetencji, świeżość…), czyli obiekt, którego w tej
   * organizacji nie ma ani jednego — tabela była pusta z definicji.
   * Przydziały kanoniczne nie znikają: pokazuje je podgląd osoby i przycisk
   * „Zaproponuj przydział" po wybraniu realizacji w Menu 2.
   */
  const columns: TableColumn[] = [
    {
      id: 'resourceLabel',
      label: t('execution.resources.columns.person', 'Osoba / rola'),
      sortable: true,
      width: '260px',
    },
    {
      id: 'weekLabel',
      label: t('execution.resources.columns.week', 'Tydzień'),
      sortable: true,
      width: '170px',
    },
    {
      id: 'demandLabel',
      label: t('execution.resources.columns.demand', 'Popyt (h)'),
      sortable: true,
      width: '120px',
    },
    {
      id: 'supplyLabel',
      label: t('execution.resources.columns.supply', 'Podaż (h)'),
      sortable: true,
      width: '120px',
    },
    {
      id: 'utilizationLabel',
      label: t('execution.resources.columns.utilization', 'Obłożenie %'),
      sortable: true,
      filterable: true,
      width: '150px',
    },
    {
      id: 'gapLabel',
      label: t('execution.resources.columns.gap', 'Luka (h)'),
      sortable: true,
      width: '130px',
    },
  ];
  const planRows = useMemo(() => plan?.rows ?? [], [plan]);
  const planPeople = useMemo(() => plan?.people ?? [], [plan]);
  const godziny = (value: number) => `${Number(value).toFixed(1).replace(/\.0$/, '')} h`;
  const tydzien = (weekStart: string) => {
    const [rok, miesiac, dzien] = weekStart.split('-');
    return `${dzien}.${miesiac}.${rok}`;
  };
  const przydzialyOsoby = useCallback(
    (userId: string) =>
      items.filter(
        (item) => String(item.assigneeId ?? item.personId ?? '') === userId
      ),
    [items]
  );
  const tableItems = useMemo(
    () =>
      planRows.map((row: ResourcePlanRow) => ({
        ...row,
        id: `${row.userId}|${row.weekStart}`,
        title: businessLabel(row.name, 'Nieprzypisany zasób'),
        description: row.role
          ? businessLabel(row.role, '')
          : `Tydzień od ${tydzien(row.weekStart)}`,
        resourceLabel: row.role
          ? `${businessLabel(row.name, 'Nieprzypisany zasób')} · ${businessLabel(row.role, '')}`
          : businessLabel(row.name, 'Nieprzypisany zasób'),
        weekLabel: `od ${tydzien(row.weekStart)}`,
        demandLabel: godziny(row.demandHours),
        supplyLabel: godziny(row.supplyHours),
        utilizationLabel: `${row.utilizationPercent} %`,
        // Luka ujemna = brakuje godzin. Znak „+" przy nadwyżce, żeby kierunek
        // był czytelny bez czytania nagłówka.
        gapLabel: `${row.gapHours > 0 ? '+' : ''}${godziny(row.gapHours)}`,
      })),
    [planRows]
  );
  /*
   * NAPRAWA odbioru 06.09 (audytor, DEC-441): Hub deklarował dziesięć chipów
   * (patrz historia w ExecutionHub.tsx), sześć z nich ('unassigned',
   * 'skill-gaps', 'unconfirmed', 'cost-risk', 'team', 'initiative') nigdy
   * nie miało tu gałęzi — spadały do `return false`, czyli ZAWSZE 0,
   * niezależnie od danych. Kanon (plan 1.12, dopuszcza ≤3 chipy) i Hub są
   * teraz zgodne na trzech: Osoby · Role · Konflikty.
   * - `osoby`: był `all` — każdy wiersz osoba×tydzień (bez zmiany logiki).
   * - `konflikty`: scala dwa JUŻ zaimplementowane, realne sygnały problemu
   *   (`overallocated` i `needs-decision`) pod jedną nazwą — na DBR77
   *   (pomiar 06.09) to dokładnie te same 11 wierszy (ujemna luka ⟺
   *   obłożenie >105%), więc scalenie nic nie ukrywa ani nie zawyża.
   * - `role`: NOWA gałąź, real (nie fałszywa) — filtruje po `row.role`
   *   niepustym. Pomiar 06.09: pole `role` w odpowiedzi API resource-plan
   *   jest PUSTE dla wszystkich 72 wierszy na DBR77 → chip pokaże 0. To
   *   ZNALEZISKO DANYCH (brak roli w źródle), nie defekt tego filtra —
   *   gdy dane dostaną rolę, chip zacznie liczyć bez zmiany kodu.
   * Porzucone bez zamiennika: `unknown` („Dostępność nieznana", było 64/72
   * na DBR77) — realny i honest sygnał, ale nie mieści się w limicie ≤3 i
   * nie pasuje semantycznie do „Konflikty" (brak danych o dostępności to
   * nie to samo co przeciążenie/luka). Zostaje widoczny w danych wiersza
   * (`supplySource`), przestaje być osobnym chipem — do rozstrzygnięcia
   * właściciela, jeśli ma wrócić.
   */
  const matches = useCallback((row: any, preset: string) => {
    if (preset === 'osoby') return true;
    if (preset === 'konflikty') {
      return Number(row.utilizationPercent) > 105 || Number(row.gapHours) < 0;
    }
    if (preset === 'role') return Boolean(String(row.role ?? '').trim());
    return false;
  }, []);
  const visibleItems = useMemo(
    () => tableItems.filter((row) => matches(row, activePreset ?? 'osoby')),
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
        {/* CTA Menu 2 wg planu 1.12 C2 — „Dodaj dostępność". Bez tego przycisku
            podaż zostaje na domyślnych 40 h i nikt nie może jej poprawić. */}
        <button
          type="button"
          className="btn-secondary"
          data-testid="execution-resources-add-availability"
          disabled={planPeople.length === 0}
          onClick={() => {
            const osoba =
              planPeople.find((person) => person.userId === selectedPlanRowId?.split('|')[0]) ??
              planPeople[0];
            if (!osoba) return;
            setCapacityDialog({
              userId: osoba.userId,
              name: osoba.name,
              hours: String(osoba.weeklyCapacityHours),
              percent: String(osoba.availabilityPercent),
            });
          }}
        >
          {t('execution.resources.actions.addAvailability', 'Dodaj dostępność')}
        </button>
        {caseId && (
          <button type="button" className="btn-secondary" onClick={() => setShowProposal(true)}>
            {t('execution.resources.actions.proposeAllocation', 'Propose allocation')}
          </button>
        )}
      </div>
    );
    return () => onRegisterFilterControl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterFilterControl, caseId, cases, unreachableCaseIds, plan, selectedPlanRowId]);
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
  // Pelny ekran bledu tylko wtedy, gdy padly OBIE sciezki. Sam brak przydzialow
  // kanonicznych nie ma prawa ukryc tabeli oblozenia (i odwrotnie).
  if (state === 'ERROR' && planState === 'ERROR')
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
      {planState === 'LOADING' && loadingPhase === 'timeout' && (
        <ErrorState variant="timeout" compact onRetry={() => void loadPlan()} />
      )}
      {planState === 'LOADING' && (loadingPhase === 'pending' || loadingPhase === 'slow') && (
        <div data-testid="execution-resources-loading" className="flex min-h-0 flex-1 flex-col gap-3">
          {loadingPhase === 'slow' && (
            <p role="status" className="text-sm text-c-text-muted">
              Wczytywanie trwa dłużej niż zwykle…
            </p>
          )}
          <SkeletonState variant="table" rows={6} label="Liczę obłożenie zasobów" />
        </div>
      )}
      {planState === 'ERROR' && (
        <p
          role="alert"
          data-testid="execution-resources-plan-error"
          className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-c-text-secondary"
        >
          Nie udało się policzyć obłożenia (popyt vs podaż).{' '}
          <button type="button" className="underline" onClick={() => void loadPlan()}>
            Spróbuj ponownie
          </button>
        </p>
      )}
      {unreachableCaseIds.length > 0 && (
        <p
          role="status"
          className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-c-text-secondary"
        >
          {`Nie udało się pobrać zasobów z ${unreachableCaseIds.length} realizacji — poniżej zasoby z pozostałych.`}
        </p>
      )}
      {/* Pasek „stan na" renderuje sie TYLKO z kompletna koperta. Bez tego
          warunku odpowiedz bez `summary` (starszy serwer, degradacja bramy)
          wywracala CALA powierzchnie na
          „Cannot read properties of undefined (reading 'peopleCount')" —
          zmierzone 2026-09-06 na atrapie bez zamockowanego API. */}
      {planState === 'READY' && plan?.summary && (
        <p className="mb-3 text-sm text-c-text-secondary" data-testid="execution-resources-summary">
          {`Stan na ${new Date(plan.asOf).toLocaleDateString('pl-PL')} · osób ${plan.summary.peopleCount} · popyt ${godziny(plan.summary.demandHours)} · podaż ${godziny(plan.summary.supplyHours)} · obłożenie ${plan.summary.utilizationPercent === null ? 'brak danych' : `${plan.summary.utilizationPercent} %`} · przeciążonych tygodni ${plan.summary.overloadedCount}`}
        </p>
      )}
      {planState === 'READY' && planRows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-c-border p-8 text-center text-sm text-c-text-muted">
          Brak osób z pracą w najbliższych 8 tygodniach — nie ma czego obciążać.
        </div>
      ) : planRows.length > 0 ? (
        /*
         * `flex-1 min-h-0` + `flex h-full min-h-0 flex-col` na <section> wyzej.
         * POWOD (pomiar 02.09, scripts/dev/measure-preview-canon.mjs --wysokosc):
         * `TableWithPreviewLayout` ma root `h-full`, czyli `height:100%`, a to
         * rozwiazuje sie TYLKO wzgledem rodzica o definitywnej wysokosci.
         */
        <div className="mt-4 flex-1 min-h-0">
          <TableWithPreviewLayout<any>
            selectedId={selectedPlanRowId}
            selectedItem={tableItems.find((row) => row.id === selectedPlanRowId) ?? null}
            onSelect={(id) => setSelectedPlanRowId(id)}
            onOpenFull={(id) => setSelectedPlanRowId(id)}
            itemIds={tableItems.map((row) => row.id)}
            getItemById={(id) => tableItems.find((row) => row.id === id) ?? null}
            previewOpen={Boolean(selectedPlanRowId)}
            renderPreview={(row) => (
              <StandardPreview
                embedded
                title={row.title}
                onClose={() => setSelectedPlanRowId(null)}
                openLabel="Ustaw dostępność"
                onOpenFull={() =>
                  setCapacityDialog({
                    userId: row.userId,
                    name: row.title,
                    hours: String(
                      planPeople.find((person) => person.userId === row.userId)
                        ?.weeklyCapacityHours ?? 40
                    ),
                    percent: String(
                      planPeople.find((person) => person.userId === row.userId)
                        ?.availabilityPercent ?? 100
                    ),
                  })
                }
                meta={{
                  pills: [
                    {
                      label: `Obłożenie ${row.utilizationPercent} %`,
                      tone: row.utilizationPercent > 105 ? 'warn' : 'success',
                    },
                    {
                      label:
                        row.supplySource === 'PROFIL'
                          ? 'Podaż z profilu osoby'
                          : 'Podaż domyślna (40 h)',
                      tone: 'neutral',
                    },
                  ],
                  trailing: <span className="text-xs">{row.weekLabel}</span>,
                  recommendation:
                    row.gapHours < 0
                      ? `Brakuje ${godziny(Math.abs(row.gapHours))} — przesuń zadania albo dołóż osobę.`
                      : 'Obłożenie mieści się w dostępnych godzinach.',
                }}
                details={{
                  label: 'Obłożenie w tym tygodniu',
                  text:
                    row.overdueHours > 0
                      ? `W tym ${godziny(row.overdueHours)} z zadań po terminie, doliczonych do bieżącego tygodnia.`
                      : 'Brak zadań po terminie doliczonych do tego tygodnia.',
                  properties: [
                    { id: 'demand', label: 'Popyt', value: row.demandLabel },
                    { id: 'supply', label: 'Podaż', value: row.supplyLabel },
                    { id: 'gap', label: 'Luka', value: row.gapLabel },
                    { id: 'tasks', label: 'Zadania', value: String(row.taskCount) },
                    {
                      id: 'allocations',
                      label: 'Przydziały kanoniczne',
                      value: String(przydzialyOsoby(row.userId).length),
                    },
                  ],
                  onCopy: () => void navigator.clipboard?.writeText(row.id),
                }}
                relations={przydzialyOsoby(row.userId).map((item) => ({
                  label: item.taskTitle || `Przydział ${String(item.allocationId).slice(-8)}`,
                  onClick: () => void openWorkspace(item),
                }))}
                relationsEmptyLabel="Brak kanonicznych przydziałów dla tej osoby"
                actions={{
                  informational: [
                    {
                      id: 'capacity',
                      label: 'Ustaw dostępność',
                      variant: 'positive',
                      icon: Eye,
                      shortcut: 'D',
                      onClick: () =>
                        setCapacityDialog({
                          userId: row.userId,
                          name: row.title,
                          hours: String(
                            planPeople.find((person) => person.userId === row.userId)
                              ?.weeklyCapacityHours ?? 40
                          ),
                          percent: String(
                            planPeople.find((person) => person.userId === row.userId)
                              ?.availabilityPercent ?? 100
                          ),
                        }),
                    },
                  ],
                }}
              />
            )}
          >
            <StandardTable
              columns={columns}
              data={visibleItems}
              selectedRowId={selectedPlanRowId}
              onRowClick={(row) => setSelectedPlanRowId(String(row.id))}
              onRowDoubleClick={(row) => setSelectedPlanRowId(String(row.id))}
              rowMenu={(row) => ({
                primary: [
                  {
                    id: 'capacity',
                    label: 'Ustaw dostępność',
                    icon: ArrowRight,
                    onClick: () => {
                      const item = tableItems.find((candidate) => candidate.id === row.id);
                      if (!item) return;
                      setCapacityDialog({
                        userId: item.userId,
                        name: item.title,
                        hours: String(
                          planPeople.find((person) => person.userId === item.userId)
                            ?.weeklyCapacityHours ?? 40
                        ),
                        percent: String(
                          planPeople.find((person) => person.userId === item.userId)
                            ?.availabilityPercent ?? 100
                        ),
                      });
                    },
                  },
                ],
                universalHandlers: {
                  preview: () => setSelectedPlanRowId(String(row.id)),
                  archiveNote: 'Obłożenie jest wyliczane z zadań — nie da się go zarchiwizować.',
                },
                destructive: {
                  label: 'Usuń',
                  note: 'Wiersz obłożenia jest wyliczany, nie przechowywany.',
                },
              })}
              persistKey="execution.resources.capacity-plan.v1"
            />
          </TableWithPreviewLayout>
        </div>
      ) : null}
      {capacityDialog && (
        <section
          aria-label="Dostępność osoby"
          data-testid="execution-resources-capacity-dialog"
          className="mt-4 rounded-xl border border-c-border p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{`Dostępność · ${capacityDialog.name}`}</h3>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCapacityDialog(null);
                setCapacityError('');
              }}
            >
              Zamknij
            </button>
          </div>
          <p className="mt-1 text-xs text-c-text-muted">
            Etat tygodniowy i dostępność w procentach. Podaż = godziny × dostępność.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs text-c-text-muted">Godziny tygodniowo</span>
              <input
                type="number"
                min={0}
                max={80}
                value={capacityDialog.hours}
                onChange={(e) => setCapacityDialog({ ...capacityDialog, hours: e.target.value })}
                className="mt-1 h-9 w-32 rounded-lg border border-c-border-subtle bg-c-surface-raised px-2"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-c-text-muted">Dostępność %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={capacityDialog.percent}
                onChange={(e) => setCapacityDialog({ ...capacityDialog, percent: e.target.value })}
                className="mt-1 h-9 w-32 rounded-lg border border-c-border-subtle bg-c-surface-raised px-2"
              />
            </label>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                setCapacityError('');
                try {
                  await saveUserCapacity(capacityDialog.userId, {
                    weeklyCapacityHours: Number(capacityDialog.hours),
                    availabilityPercent: Number(capacityDialog.percent),
                  });
                  setCapacityDialog(null);
                  await loadPlan();
                } catch {
                  setCapacityError('Nie udało się zapisać dostępności. Spróbuj ponownie.');
                }
              }}
            >
              Zapisz
            </button>
          </div>
          {capacityError && (
            <p role="alert" className="mt-2 text-sm text-c-text-secondary">
              {capacityError}
            </p>
          )}
        </section>
      )}
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

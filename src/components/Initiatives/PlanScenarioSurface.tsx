import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Eye,
  ListOrdered,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';
import { seedDefaultHiddenColumns } from '@/components/shared/ModuleHub/defaultHiddenColumns';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { resolveBusinessDisplayLabel } from '@/components/shared/PreviewPane/businessDisplayLabel';
import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableRow } from '@/components/standard/StandardTable';
import {
  createPlanAnalysisProposal,
  listPlannableInitiatives,
  listPlanScenarioRegister,
  type PlannableInitiative,
  readPlanScenario,
  readPlanScenarioDiff,
  readPlanScenarioHistory,
  registerInitiativeForPlanning,
  reviewPlanAnalysisProposal,
  RuntimeApiError,
  writeInitiativeDependencies,
  writePlanScenario,
} from '@/services/initiatives-execution/runtimeApi';

import type { CanonicalMenu3Contract } from './canonicalMenu3';
import { PlanCard } from './cards/PlanCard';
import type {
  GeneratorPlanInput,
  GeneratorProposalRow,
  PlanGenerationMode,
} from './Generator/GeneratorPlanuModal';
import { applyAcceptedPlanProposal } from './planProposalReview';

interface WindowDraft {
  initiativeId: string;
  initiativeVersion: number;
  earliest: string | null;
  target: string | null;
  latest: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  rationale: string;
  dependencySnapshot: string[];
  constraintSnapshot: Array<{ constraintId: string; state: 'KNOWN' | 'UNKNOWN'; detail: string }>;
}
interface PeriodDraft {
  periodId: string;
  start: string;
  end: string;
}
interface PlanScenario {
  scenarioId: string;
  name?: string | null;
  scenarioVersion: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  portfolioScenarioId: string;
  portfolioScenarioVersion: number;
  windowUnit: string;
  timezone: string;
  periods: Array<{ periodId: string; start: string; end: string }>;
  windows: WindowDraft[];
  assumptions: string[];
  createdBy: string;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
}
interface PlanAnalysisProposal {
  proposalId: string;
  inputAggregateVersion: number;
  inputScenarioVersion: number;
  status: "PENDING_REVIEW" | 'ACCEPTED' | 'REJECTED';
  assumptions: string[];
  rationale: string;
  conflicts: string[];
  changes: Array<{ initiativeId: string; before: WindowDraft; after: WindowDraft }>;
}
type PlanScenarioHistoryEntry = PlanScenario;
interface RegisterRow extends TableRow {
  id: string;
  title: string;
  state: string;
  version: number;
  portfolio: string;
  earliest: string;
  latest: string;
  updatedAt: string;
  timeBasisState: 'KNOWN' | 'UNKNOWN';
  initiativeCount: number;
  conflicts: number;
  author: string;
}
/** Kszalt wiersza z `GET /plan-scenarios` (rejestr planów). */
interface RegisterApiRow {
  id: string;
  name: string;
  state: string;
  version: number;
  portfolioRef: { scenarioId: string; scenarioVersion: number; name?: string | null };
  window: { earliest: string | null; latest: string | null };
  updatedAt: string;
  timeBasis?: {
    windowUnit: string;
    timezone: string;
    periods: Array<{ periodId: string; start: string; end: string }>;
    knowledgeState: 'KNOWN' | 'UNKNOWN';
  };
  initiativeCount?: number;
  conflicts?: number;
  author?: string;
}
interface Props extends CanonicalMenu3Contract {
  initiatives: Array<{ id: string; name: string; lifecycle?: string }>;
  demoMode?: boolean;
  /**
   * Odbiór grafiki 141-plan-scenario (2026-08-31) — DEFEKT „Otwórz".
   *
   * Kanoniczny przycisk „Otwórz" w nagłówku `StandardPreview` obiecuje OBIEKT
   * wiersza, czyli KARTĘ INICJATYWY. Był podpięty pod `showWorkspace`, co
   * montowało warsztat planu POD tabelą (druga tabela pod pierwszą, strona
   * rosła z 900 px do 2681 px) — przycisk nie prowadził tam, dokąd obiecywał.
   *
   * Wzorzec rodzica jest już w module: `PortfolioHealthView` dostaje
   * `onOpenInitiative?: (id, title) => void`, a `InitiativesHub` wiąże je
   * z `handleOpenInitiativeDocument` (InitiativesHub.tsx §renderContent).
   * Ta powierzchnia idzie tą samą drogą.
   *
   * Gdy rodzic NIE poda handlera (np. harness dev-render, gdzie nie ma
   * hosta karty), „Otwórz" renderuje się WYŁĄCZONY z powodem w tooltipie
   * (kanon FIX-1 `StandardPreview.openDisabledReason`) — zamiast milczeć
   * albo prowadzić w złe miejsce. Warsztat planu ma własną, uczciwie
   * nazwaną akcję „Otwórz narzędzia planu".
   */
  onOpenInitiative?: (id: string, title: string) => void;
}
const formatDate = (value: string | null) => {
  if (!value) return 'UNKNOWN';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'UNKNOWN';
  // 2026-09-03 (i18n-r3): locale przybity na 'pl-PL' pokazywał polskie
  // skróty miesięcy (wrz/lis/gru) nawet w trybie EN — ten sam kształt bugu
  // jak w rodzeństwie CapacityScenarioSurface.formatPeriodDate.
  return new Intl.DateTimeFormat(i18n.language === 'pl' ? 'pl-PL' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

const toInput = (value: string | null) => (value ? value.slice(0, 16) : '');
const toIso = (value: string) => (value ? new Date(value).toISOString() : null);
const toDateInput = (value: string) => value.slice(0, 10);
const toDateIso = (value: string) => `${value}T00:00:00.000Z`;
/**
 * P15-K2 (DEC-421): horyzont z PARAMETRÓW generatora, nie z seedu. Jednostka
 * decyduje o kroku okresu; identyfikator okresu jest DANĄ zapisywaną w planie
 * (tak samo jak przed tą paczką), nie napisem tłumaczonym per użytkownik.
 */
const createPeriods = (
  start: string,
  count: number,
  unit: 'WEEK' | 'MONTH' = 'WEEK'
): PeriodDraft[] => {
  const first = new Date(toDateIso(start));
  if (Number.isNaN(first.getTime()) || count < 1) return [];
  return Array.from({ length: count }, (_, index) => {
    const periodStart = new Date(first);
    if (unit === 'MONTH') periodStart.setUTCMonth(first.getUTCMonth() + index);
    else periodStart.setUTCDate(first.getUTCDate() + index * 7);
    const periodEnd = new Date(periodStart);
    if (unit === 'MONTH') periodEnd.setUTCMonth(periodStart.getUTCMonth() + 1);
    else periodEnd.setUTCDate(periodStart.getUTCDate() + 7);
    return {
      periodId: `${unit === 'MONTH' ? 'Miesiąc' : 'Tydzień'} ${index + 1}`,
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    };
  });
};
const parsePeriods = (value: string) => {
  try {
    const parsed = JSON.parse(value) as Array<{ periodId: string; start: string; end: string }>;
    if (!Array.isArray(parsed) || !parsed.length) return null;
    let previousEnd: string | null = null;
    const ids = new Set<string>();
    for (const period of parsed) {
      if (
        !period.periodId?.trim() ||
        ids.has(period.periodId) ||
        !Number.isFinite(Date.parse(period.start)) ||
        !Number.isFinite(Date.parse(period.end)) ||
        period.start >= period.end ||
        (previousEnd !== null && previousEnd > period.start)
      )
        return null;
      ids.add(period.periodId);
      previousEnd = period.end;
    }
    return parsed;
  } catch {
    return null;
  }
};
const knownTimeBasis = (scenario: PlanScenario | null) =>
  Boolean(
    scenario?.windowUnit?.trim() &&
    scenario.timezone?.trim() &&
    Array.isArray(scenario.periods) &&
    scenario.periods.length &&
    parsePeriods(JSON.stringify(scenario.periods))
  );
const planStatusKey: Record<PlanScenario['status'], string> = {
  DRAFT: 'initiatives.planScenario.status.draft',
  PUBLISHED: 'initiatives.planScenario.status.published',
  SUPERSEDED: 'initiatives.planScenario.status.superseded',
};

// Odbiór grafiki 07-realizacja (2026-08-30): kolumny planu renderowały surowe
// enumy backendu (UNKNOWN/KNOWN/CURRENT/NONE/HIGH…) wprost jako tekst komórki —
// dokładnie znany defekt "surowe enumy zamiast etykiet" z kanonu grafiki.
// Mapy niżej tłumaczą wartość na etykietę bez ruszania logiki filtrów/presetów,
// które nadal porównują surowe stałe (row.dependency === 'UNKNOWN' itd.).
const planReadinessStateKey: Record<string, string> = {
  KNOWN: 'initiatives.planScenario.states.known',
  UNKNOWN: 'initiatives.planScenario.states.unknown',
};
const planBacklogStateKey: Record<string, string> = {
  CURRENT: 'initiatives.planScenario.states.current',
  UNKNOWN: 'initiatives.planScenario.states.unknown',
};
const planConflictStateKey: Record<string, string> = {
  NONE: 'initiatives.planScenario.states.none',
  UNKNOWN: 'initiatives.planScenario.states.unknown',
};
const planConfidenceKey: Record<string, string> = {
  HIGH: 'common.high',
  MEDIUM: 'common.medium',
  LOW: 'common.low',
  UNKNOWN: 'initiatives.planScenario.states.unknown',
};
const planBandKey: Record<string, string> = {
  NOW: 'initiatives.planScenario.band.now',
  NEXT: 'initiatives.planScenario.band.next',
  LATER: 'initiatives.planScenario.band.later',
  UNSCHEDULED: 'initiatives.planScenario.band.unscheduled',
};
const planNextActionKey: Record<string, string> = {
  PROPOSE_WINDOW: 'initiatives.planScenario.nextActions.proposeWindow',
  RESOLVE_CAPACITY: 'initiatives.planScenario.nextActions.resolveCapacity',
  REVIEW_TENTATIVE_WINDOW: 'initiatives.planScenario.nextActions.reviewTentativeWindow',
  VALIDATE_DEPENDENCIES: 'initiatives.planScenario.nextActions.validateDependencies',
  ADD_TO_PLAN_OR_EXCLUDE: 'initiatives.planScenario.nextActions.addToPlanOrExclude',
};

export const PlanScenarioSurface: React.FC<Props> = ({
  initiatives,
  activePreset,
  onCountsChange,
  createRequestId = 0,
  demoMode = false,
  onOpenInitiative,
}) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [writeState, setWriteState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'ERROR'>('IDLE');
  // P15-K1 (DEC-421): kod reguly z odpowiedzi serwera. Bez niego kazdy blad
  // zapisu planu wygladal tak samo — jednym zdaniem bez powodu.
  const [writeRule, setWriteRule] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [draft, setDraft] = useState<PlanScenario | null>(null);
  const [aggregateVersion, setAggregateVersion] = useState(0);
  const [diff, setDiff] = useState<
    Array<{ initiativeId: string; before: WindowDraft | null; after: WindowDraft | null }>
  >([]);
  const [history, setHistory] = useState<PlanScenarioHistoryEntry[]>([]);
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);
  const [compareState, setCompareState] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [analysisProposal, setAnalysisProposal] = useState<PlanAnalysisProposal | null>(null);
  const [analysisState, setAnalysisState] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [publishConfirmationPending, setPublishConfirmationPending] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  // P15-K2 (DEC-421), D1': portfel roboczy zakłada SERWER — formularz „Nowy plan"
  // nie pyta już o identyfikator i wersję scenariusza portfela.
  const [plannable, setPlannable] = useState<PlannableInitiative[]>([]);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [newWindowUnit, setNewWindowUnit] = useState('WEEK');
  const [newTimezone, setNewTimezone] = useState('Europe/Warsaw');
  const [newStart, setNewStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [newWeekCount, setNewWeekCount] = useState(12);
  const [showCreate, setShowCreate] = useState(false);
  const [initiativeLifecycleFilter, setInitiativeLifecycleFilter] = useState('ALL');
  const commandIds = useRef(new Map<string, string>());
  const handledCreateRequest = useRef(createRequestId);
  /** Ostatnio wczytana lista planów — źródło znacznika „Zapisano hh:mm" (serwerowe `updatedAt`). */
  const loadedRows = useRef<RegisterRow[]>([]);

  useEffect(() => {
    if (createRequestId === handledCreateRequest.current) return;
    handledCreateRequest.current = createRequestId;
    setShowCreate(true);
  }, [createRequestId]);

  // 97-czternascie-kolumn (2026-08-30): 14 kolumny danych + kolumna akcji
  // nie mieszczą się w typowym obszarze planu (1366 px) nawet na podłodze
  // czytelności FilterableTable (`FIT_MIN_COLUMN_WIDTH`/`_PRIMARY`) — po
  // usunięciu jawnie zduplikowanej kolumny "Wstępny.../.../..." zostaje 13,
  // wciąż za dużo. mandatoryDeadline/costOfDelay/roughDemand są w tym
  // ekranie zawsze 'UNKNOWN' (nieobliczane), więc chowamy je domyślnie przez
  // istniejący pstryczek widoczności kolumn — użytkownik włącza je sam, gdy
  // ta logika kiedyś zostanie policzona. Musi wykonać się PRZED montażem
  // <StandardTable>/<FilterableTable> (stąd guard w ciele renderu, nie w
  // useEffect) — patrz komentarz w defaultHiddenColumns.ts.
  const planWindowsColumnsSeeded = useRef(false);
  if (!planWindowsColumnsSeeded.current) {
    seedDefaultHiddenColumns('initiatives.plan-windows.v2', [
      'mandatoryDeadline',
      'costOfDelay',
      'roughDemand',
    ]);
    planWindowsColumnsSeeded.current = true;
  }

  const loadHistory = useCallback(
    async (scenarioId: string) => {
      if (demoMode) {
        setHistory([]);
        setCompareFrom(null);
        setCompareTo(null);
        return;
      }
      try {
        const result = (await readPlanScenarioHistory(scenarioId)) as {
          versions?: PlanScenarioHistoryEntry[];
        };
        const versions = [...(result.versions ?? [])].sort(
          (left, right) => left.scenarioVersion - right.scenarioVersion
        );
        setHistory(versions);
        setCompareFrom(versions.length > 1 ? (versions.at(-2)?.scenarioVersion ?? null) : null);
        setCompareTo(versions.at(-1)?.scenarioVersion ?? null);
      } catch {
        setHistory([]);
        setCompareFrom(null);
        setCompareTo(null);
      }
    },
    [demoMode]
  );

  // ZMIERZONE 07.09: opakowanie tego mapowania w `useCallback([t])` wpuszczalo
  // `t` w liste zaleznosci `loadRegister`. W srodowisku, w ktorym `t` nie jest
  // stabilne miedzy renderami (atrapy testowe, ale takze przelaczenie jezyka),
  // efekt `useEffect([loadRegister])` odpalal sie w kolko — React przerywal
  // renderowanie z „Maximum update depth exceeded". Zwykla funkcja w ciele
  // komponentu nie ma tego problemu i nie zmienia zachowania.
  const toRegisterRow =
    (item: RegisterApiRow): RegisterRow => ({
      id: item.id,
      title: resolveBusinessDisplayLabel({
        displayName: item.name,
        rawId: item.id,
        fallback: `${t('initiatives.plan.unnamed', 'Plan bez nazwy')} · ${formatDate(item.updatedAt)}`,
      }),
      state: item.state,
      version: item.version,
      // P15-K2 (DEC-421): kolumna „Portfel / wersja" pokazuje NAZWĘ portfela
      // (np. „Portfel roboczy — …") z czytnika; surowy identyfikator agregatu
      // zostaje wyłącznie jako ostatnia deska ratunku dla portfeli sprzed paczki.
      portfolio: `${resolveBusinessDisplayLabel({
        displayName: item.portfolioRef.name ?? item.portfolioRef.scenarioId,
        rawId: item.portfolioRef.scenarioId,
        fallback: t('initiatives.plan.portfolioFallback', 'Portfel źródłowy'),
      })} · v${item.portfolioRef.scenarioVersion}`,
      earliest: item.window.earliest ?? 'Unknown',
      latest: item.window.latest ?? 'Unknown',
      updatedAt: item.updatedAt,
      timeBasisState: item.timeBasis?.knowledgeState ?? 'UNKNOWN',
      initiativeCount: item.initiativeCount ?? 0,
      conflicts: item.conflicts ?? 0,
      author: resolveBusinessDisplayLabel({
        displayName: item.author,
        rawId: item.author,
        fallback: t('common.unknown', 'Nieznane'),
      }),
    });

  /**
   * P15-K2 (DEC-421): LEKKIE odświeżenie rejestru planów — bez `setState('LOADING')`.
   *
   * ZMIERZONE w przepływie klikanym 07.09 (evidence/p15-k2/przeplyw): wołanie
   * pełnego `loadRegister()` w środku generowania przełączało powierzchnię na
   * gałąź „ładowanie", co ODMONTOWYWAŁO kartę planu razem z otwartym oknem
   * generatora — propozycja znikała, zanim człowiek zdążył ją zobaczyć.
   * Ta ścieżka aktualizuje wyłącznie wiersze rejestru (potrzebne do znacznika
   * „Zapisano hh:mm" z serwerowego `updatedAt`) i nie rusza gałęzi renderu.
   */
  const refreshRegisterRows = useCallback(async () => {
    if (demoMode) return;
    try {
      const result = (await listPlanScenarioRegister()) as { scenarios?: RegisterApiRow[] };
      const nextRows = (result.scenarios ?? []).map(toRegisterRow);
      setRows(nextRows);
      loadedRows.current = nextRows;
    } catch {
      // Rejestr jest tu wyłącznie źródłem znacznika zapisu — nieudane odświeżenie
      // NIE może przewrócić karty, na której użytkownik właśnie pracuje.
      setWriteRule(null);
    }
  }, [demoMode]);

  const loadRegister = useCallback(async () => {
    setState('LOADING');
    if (demoMode) {
      const periods = [
        {
          periodId: 'NOW · Sep–Oct',
          start: '2026-09-01T00:00:00.000Z',
          end: '2026-11-01T00:00:00.000Z',
        },
        {
          periodId: 'NEXT · Nov–Dec',
          start: '2026-11-01T00:00:00.000Z',
          end: '2027-01-01T00:00:00.000Z',
        },
        {
          periodId: 'LATER · Q1',
          start: '2027-01-01T00:00:00.000Z',
          end: '2027-04-01T00:00:00.000Z',
        },
      ];
      const scenario: PlanScenario = {
        scenarioId: 'Atelier Transformation Plan',
        scenarioVersion: 2,
        status: 'PUBLISHED',
        portfolioScenarioId: 'Atelier Growth Portfolio',
        portfolioScenarioVersion: 3,
        windowUnit: 'MONTH',
        timezone: 'Europe/Warsaw',
        periods,
        windows: initiatives.slice(0, 8).map((initiative, index) => ({
          initiativeId: initiative.id,
          initiativeVersion: 1,
          earliest:
            ['2026-09-01', '2026-11-01', '2027-01-01'][Math.min(2, Math.floor(index / 3))] +
            'T00:00:00.000Z',
          target:
            ['2026-10-01', '2026-12-01', '2027-02-01'][Math.min(2, Math.floor(index / 3))] +
            'T00:00:00.000Z',
          latest:
            ['2026-10-31', '2026-12-31', '2027-03-31'][Math.min(2, Math.floor(index / 3))] +
            'T00:00:00.000Z',
          confidence: index < 3 ? 'HIGH' : index < 6 ? 'MEDIUM' : 'LOW',
          rationale: 'Illustrative delivery window for owner review.',
          dependencySnapshot:
            index === 0 ? [] : [initiatives[Math.max(0, index - 1)]?.id || 'demo-dependency'],
          constraintSnapshot:
            index === 5
              ? [
                  {
                    constraintId: 'data-engineering-capacity',
                    state: 'UNKNOWN',
                    detail: 'Confirm specialist availability',
                  },
                ]
              : [],
        })),
        assumptions: ['Budget envelope remains valid', 'Named owners are available'],
        createdBy: 'demo',
        updatedBy: 'demo',
        publishedBy: 'owner-piotr',
        publishedAt: '2026-08-23T09:00:00.000Z',
      };
      setRows([
        {
          id: scenario.scenarioId,
          title: scenario.scenarioId,
          state: scenario.status,
          version: scenario.scenarioVersion,
          portfolio: `${scenario.portfolioScenarioId}:v${scenario.portfolioScenarioVersion}`,
          earliest: periods[0].start,
          latest: periods[2].end,
          updatedAt: scenario.publishedAt || '',
          timeBasisState: 'KNOWN',
          initiativeCount: scenario.windows.length,
          conflicts: 0,
          author: scenario.updatedBy,
        },
      ]);
      setSelectedId(scenario.scenarioId);
      setAggregateVersion(2);
      setDraft(scenario);
      setState('READY');
      return;
    }
    try {
      const result = (await listPlanScenarioRegister()) as { scenarios?: RegisterApiRow[] };
      const enrichedScenarios = await Promise.all(
        (result.scenarios ?? []).map(async (item) => {
          if (item.initiativeCount !== undefined && item.author !== undefined) return item;
          const detail = (await readPlanScenario(item.id)) as { scenario: PlanScenario };
          return {
            ...item,
            initiativeCount: detail.scenario.windows.length,
            author: detail.scenario.updatedBy,
          };
        })
      );
      const nextRows = enrichedScenarios.map(toRegisterRow);
      setRows(nextRows);
      loadedRows.current = nextRows;
      if (nextRows.length) {
        const initial = nextRows.find((item) => item.state === 'PUBLISHED') ?? nextRows[0];
        setSelectedId(initial.id);
        const loaded = (await readPlanScenario(initial.id)) as {
          version: number;
          scenario: PlanScenario;
        };
        setAggregateVersion(loaded.version);
        setDraft(
          structuredClone({
            ...loaded.scenario,
            windowUnit: loaded.scenario.windowUnit ?? '',
            timezone: loaded.scenario.timezone ?? '',
            periods: loaded.scenario.periods ?? [],
          })
        );
        await loadHistory(initial.id);
      }
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, [demoMode, initiatives, loadHistory]);
  useEffect(() => {
    void loadRegister();
  }, [loadRegister]);
  // MOST P15-K2 (DEC-421): kwalifikację inicjatyw modułu liczy SERWER (ten sam
  // warunek, co komenda `register`), a nie front po sklejanym `lifecycle`.
  useEffect(() => {
    if (demoMode) {
      setPlannable([]);
      return;
    }
    const controller = new AbortController();
    void listPlannableInitiatives(controller.signal)
      .then((result) => setPlannable(result.initiatives ?? []))
      .catch((error) => {
        if ((error as { name?: string })?.name !== 'AbortError') setPlannable([]);
      });
    return () => controller.abort();
  }, [demoMode]);
  const planWindowRows = useMemo(() => {
    const names = new Map(initiatives.map((item) => [item.id, item.name]));
    const scheduled = (draft?.windows ?? []).map((window) => {
      const periodIndex =
        draft?.periods.findIndex(
          (period) => window.target && window.target >= period.start && window.target < period.end
        ) ?? -1;
      const unknownConstraint = window.constraintSnapshot.some(
        (constraint) => constraint.state === 'UNKNOWN'
      );
      return {
        id: window.initiativeId,
        title: names.get(window.initiativeId) ?? window.initiativeId,
        backlogState: 'UNKNOWN',
        earliest: formatDate(window.earliest),
        target: formatDate(window.target),
        latest: formatDate(window.latest),
        proposedWindow: `${formatDate(window.earliest)} → ${formatDate(window.target)} → ${formatDate(window.latest)}`,
        band:
          periodIndex < 0
            ? 'UNSCHEDULED'
            : periodIndex === 0
              ? 'NOW'
              : periodIndex === 1
                ? 'NEXT'
                : 'LATER',
        dependency: window.dependencySnapshot.length ? 'KNOWN' : 'UNKNOWN',
        capacity: unknownConstraint ? 'UNKNOWN' : 'KNOWN',
        confidence: window.confidence,
        conflict: unknownConstraint ? 'UNKNOWN' : 'NONE',
        mandatoryDeadline: 'UNKNOWN',
        costOfDelay: 'UNKNOWN',
        roughDemand: 'UNKNOWN',
        nextAction: !window.target
          ? 'PROPOSE_WINDOW'
          : unknownConstraint
            ? 'RESOLVE_CAPACITY'
            : window.dependencySnapshot.length
              ? 'REVIEW_TENTATIVE_WINDOW'
              : 'VALIDATE_DEPENDENCIES',
        published: draft?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      };
    });
    const scheduledIds = new Set(scheduled.map((row) => row.id));
    const unscheduled = initiatives
      .filter((initiative) => !scheduledIds.has(initiative.id))
      .map((initiative) => ({
        id: initiative.id,
        title: initiative.name,
        backlogState: 'CURRENT',
        earliest: '—',
        target: '—',
        latest: '—',
        proposedWindow: t('initiatives.planScenario.noWindowAssigned'),
        band: 'UNSCHEDULED',
        dependency: 'UNKNOWN',
        capacity: 'UNKNOWN',
        confidence: 'UNKNOWN',
        conflict: 'NONE',
        mandatoryDeadline: 'UNKNOWN',
        costOfDelay: 'UNKNOWN',
        roughDemand: 'UNKNOWN',
        nextAction: 'ADD_TO_PLAN_OR_EXCLUDE',
        published: draft?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      }));
    return [...scheduled, ...unscheduled];
  }, [draft, initiatives, t]);
  const matchesPlanPreset = useCallback(
    (row: (typeof planWindowRows)[number], preset: string) =>
      preset === 'all'
        ? true
        : preset === 'unscheduled'
          ? row.band === 'UNSCHEDULED'
          : preset === 'now'
            ? row.band === 'NOW'
            : preset === 'next'
              ? row.band === 'NEXT'
              : preset === 'later'
                ? row.band === 'LATER'
                : preset === 'conflicted'
                  ? row.conflict !== 'NONE'
                  : preset === 'missing-dependencies'
                    ? row.dependency === 'UNKNOWN'
                    : preset === 'needs-capacity'
                      ? row.capacity === 'UNKNOWN'
                      : preset === 'ready'
                        ? row.band !== 'UNSCHEDULED' &&
                          row.dependency === 'KNOWN' &&
                          row.capacity === 'KNOWN'
                        : preset === 'published'
                          ? row.published === 'PUBLISHED'
                          : false,
    []
  );
  const effectivePreset = ['drafts', 'published', 'conflicted'].includes(activePreset)
    ? 'all'
    : activePreset || 'all';
  const visiblePlanWindows = planWindowRows.filter((row) =>
    matchesPlanPreset(row, effectivePreset)
  );
  useEffect(() => {
    onCountsChange?.({
      drafts: rows.filter((row) => row.state === 'DRAFT').length,
      published: rows.filter((row) => row.state === 'PUBLISHED').length,
      conflicted: rows.filter((row) => row.conflicts > 0).length,
    });
  }, [rows, onCountsChange]);

  const open = async (id: string) => {
    setSelectedId(id);
    setWorkspaceOpen(true);
    setWriteState('IDLE');
    try {
      const result = (await readPlanScenario(id)) as { version: number; scenario: PlanScenario };
      setAggregateVersion(result.version);
      setDraft(
        structuredClone({
          ...result.scenario,
          windowUnit: result.scenario.windowUnit ?? '',
          timezone: result.scenario.timezone ?? '',
          periods: result.scenario.periods ?? [],
        })
      );
      await loadHistory(id);
    } catch {
      setWriteState('ERROR');
    }
  };
  const showWorkspace = () => {
    if (draft && selectedId) setWorkspaceOpen(true);
  };
  /**
   * „Otwórz" = KARTA INICJATYWY (obiekt wiersza), nie warsztat planu.
   * Zwraca `undefined`, gdy rodzic nie potrafi otworzyć karty — wtedy
   * `StandardPreview` renderuje wyłączony przycisk z powodem, a nie akcję
   * prowadzącą w inne miejsce niż napis.
   */
  const openInitiativeCard = useCallback(
    (id: string | null) => {
      if (!onOpenInitiative || !id) return;
      const row = planWindowRows.find((item) => item.id === id);
      onOpenInitiative(id, row?.title ?? id);
    },
    [onOpenInitiative, planWindowRows]
  );
  const openCardDisabledReason = onOpenInitiative
    ? undefined
    : t('initiatives.planScenario.openCardUnavailable', {
        defaultValue: 'Kartę inicjatywy otwiera moduł Inicjatywy — ten widok jest tylko planem.',
      });
  const create = async () => {
    const periods = createPeriods(newStart, newWeekCount, newWindowUnit === 'MONTH' ? 'MONTH' : 'WEEK');
    if (!newName.trim() || !newWindowUnit.trim() || !newTimezone.trim() || !periods.length) return;
    const scenario: PlanScenario = {
      scenarioId: `plan-${crypto.randomUUID()}`,
      name: newName.trim(),
      scenarioVersion: 0,
      status: 'DRAFT',
      portfolioScenarioId: '',
      portfolioScenarioVersion: 0,
      windowUnit: newWindowUnit.trim(),
      timezone: newTimezone.trim(),
      periods,
      windows: [],
      assumptions: [],
      createdBy: '',
      updatedBy: '',
      publishedBy: null,
      publishedAt: null,
    };
    setSelectedId(scenario.scenarioId);
    setAggregateVersion(0);
    setDraft(scenario);
    setDiff([]);
    setHistory([]);
    setCompareFrom(null);
    setCompareTo(null);
    setWriteRule(null);
    setWriteState('SAVING');
    try {
      const result = (await writePlanScenario(scenario.scenarioId, {
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
        operation: 'CREATE',
        portfolio: 'auto',
        scenario,
      })) as { aggregateVersion: number; response: PlanScenario };
      setAggregateVersion(result.aggregateVersion);
      setDraft(result.response);
      setShowCreate(false);
      setWorkspaceOpen(true);
      setWriteState('IDLE');
      /*
       * P15-K3 (DEC-421) — DEFEKT ZŁAPANY OKIEM w przepływie klikanym 07.09
       * (evidence/p15-k3/przeplyw/02-…): tu stało `await loadRegister()`, a ta
       * ścieżka wybiera „pierwszy OPUBLIKOWANY plan" i wstawia go do `draft`.
       * Efekt na ekranie: po „Utwórz plan" otwierała się karta INNEGO planu
       * (opublikowanego), tylko z identyfikatorem nowego w `selectedId` — czyli
       * warsztat pracował na cudzych oknach. Lekkie odświeżenie aktualizuje
       * wyłącznie wiersze rejestru i nie rusza świeżo utworzonego szkicu.
       */
      await refreshRegisterRows();
      markSaved(result.response.scenarioId);
      setSelectedId(result.response.scenarioId);
      await loadHistory(result.response.scenarioId);
    } catch (error) {
      setWriteRule(error instanceof RuntimeApiError ? (error.rule ?? null) : null);
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'ERROR'
      );
    }
  };
  /**
   * ZAPIS PLANU Z CAS (P15-K3, DEC-421).
   *
   * Scenariusz jest ARGUMENTEM, nie odczytem ze stanu Reacta: warsztat karty
   * (dodaj/usuń inicjatywę, zmień datę, zmień zależność) musi zapisać dokładnie
   * ten kształt, który właśnie policzył — `setDraft` jest asynchroniczne i
   * zapis po nim wysyłałby stan sprzed zmiany. `expectedVersion` to ta sama
   * wersja agregatu, na której karta pracuje; 409 z serwera wraca do ekranu
   * jako CONFLICT z regułą, a nie jako cicha porażka.
   */
  const persistScenario = async (
    scenario: PlanScenario,
    operation: 'CREATE' | 'UPDATE' | 'PUBLISH',
    publishConfirmation?: { conflictCount: number; statement: string }
  ) => {
    if (!knownTimeBasis(scenario) || writeState === 'SAVING') {
      if (!knownTimeBasis(scenario)) setWriteState('ERROR');
      return;
    }
    setWriteRule(null);
    setWriteState('SAVING');
    const key = `${scenario.scenarioId}:${aggregateVersion}:${operation}`;
    const clientRequestId = commandIds.current.get(key) ?? crypto.randomUUID();
    commandIds.current.set(key, clientRequestId);
    try {
      const result = (await writePlanScenario(scenario.scenarioId, {
        expectedVersion: aggregateVersion,
        clientRequestId,
        operation,
        portfolio: 'auto',
        ...(publishConfirmation ? { publishConfirmation } : {}),
        scenario,
      })) as { aggregateVersion: number; response: PlanScenario };
      setAggregateVersion(result.aggregateVersion);
      setDraft(result.response);
      setWriteState('IDLE');
      setPublishConfirmationPending(null);
      // Lekkie odswiezenie: pelny `loadRegister` przelaczylby powierzchnie na
      // galaz „ladowanie" i odmontowal karte planu razem z otwartym oknem.
      await refreshRegisterRows();
      markSaved(result.response.scenarioId);
      setSelectedId(result.response.scenarioId);
      await loadHistory(result.response.scenarioId);
      if (result.response.scenarioVersion > 1) {
        const d = (await readPlanScenarioDiff(
          result.response.scenarioId,
          result.response.scenarioVersion - 1,
          result.response.scenarioVersion
        )) as { changes: typeof diff };
        setDiff(d.changes);
      }
    } catch (error) {
      setWriteRule(error instanceof RuntimeApiError ? (error.rule ?? null) : null);
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'ERROR'
      );
    }
  };
  const write = (
    operation: 'CREATE' | 'UPDATE' | 'PUBLISH',
    publishConfirmation?: { conflictCount: number; statement: string }
  ) => (draft ? persistScenario(draft, operation, publishConfirmation) : Promise.resolve());
  const compareVersions = async () => {
    if (!draft || compareFrom === null || compareTo === null || compareFrom === compareTo) return;
    setCompareState('LOADING');
    try {
      const result = (await readPlanScenarioDiff(draft.scenarioId, compareFrom, compareTo)) as {
        changes: typeof diff;
      };
      setDiff(result.changes);
      setCompareState('IDLE');
    } catch {
      setCompareState('ERROR');
    }
  };
  /**
   * „Zapisano hh:mm" z ODPOWIEDZI SERWERA. Pomiar 07.09: `PlanCard.tsx:38` miał
   * `saveState:'saved'` na sztywno — karta twierdziła, że zapisano, także wtedy,
   * gdy nic nie poszło do bazy. Znacznik bierzemy z `updated_at` agregatu, który
   * wraca w rejestrze planów po zapisie.
   */
  const markSaved = useCallback((scenarioId: string) => {
    const row = loadedRows.current.find((item) => item.id === scenarioId);
    const saved = row?.updatedAt ? new Date(row.updatedAt) : null;
    setSavedLabel(
      saved && !Number.isNaN(saved.getTime())
        ? t('initiatives.planGenerator.savedAt', {
            defaultValue: 'Zapisano {{time}}',
            time: new Intl.DateTimeFormat(i18n.language === 'pl' ? 'pl-PL' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }).format(saved),
          })
        : null
    );
  }, [t]);

  /**
   * GENERATOR END-TO-END (P15-K2, DEC-421 — decyzje D1' i D5).
   *
   * (a) most: każda wybrana inicjatywa MODUŁU zostaje przyjęta do planowania
   *     (agregat `ie/initiative` w APPROVED_BACKLOG — inaczej plan odrzuca okno
   *     regułą PLAN_MEMBER_NOT_APPROVED, zmierzone 07.09);
   * (b) UPDATE planu: okresy z parametrów, okna z WYBORU (przed tą paczką
   *     `PlanCard.tsx:38` przekazywał wyłącznie tryb);
   * (c) propozycja solvera — pokazana w kroku 4 PRZED „Zatwierdź".
   */
  const generatePlan = async (input: GeneratorPlanInput) => {
    if (!draft || draft.status !== 'DRAFT' || !input.initiativeIds.length) return;
    setAnalysisState('LOADING');
    setWriteRule(null);
    setAnalysisProposal(null);
    try {
      const versions = new Map<string, number>();
      for (const initiativeId of input.initiativeIds) {
        const registered = await registerInitiativeForPlanning(initiativeId, {
          clientRequestId: crypto.randomUUID(),
          allowConditional: input.allowConditional,
        });
        versions.set(initiativeId, registered.aggregateVersion);
      }
      const periods = createPeriods(input.start, input.periods, input.unit);
      if (!periods.length) {
        setAnalysisState('ERROR');
        return;
      }
      const horizonStart = periods[0].start;
      const horizonEnd = periods[periods.length - 1].end;
      const windows: WindowDraft[] = input.initiativeIds.map((initiativeId) => {
        const source = plannable.find((item) => item.id === initiativeId);
        const previous = draft.windows.find((window) => window.initiativeId === initiativeId);
        const planned = source?.plannedStartDate ?? null;
        return {
          initiativeId,
          initiativeVersion: versions.get(initiativeId) ?? previous?.initiativeVersion ?? 1,
          earliest: horizonStart,
          // Data docelowa = planowany start z modułu, o ile MIEŚCI SIĘ w horyzoncie;
          // inaczej początek horyzontu — bez cichego wypychania okna poza plan.
          target: planned && planned >= horizonStart && planned <= horizonEnd ? planned : horizonStart,
          latest: horizonEnd,
          confidence: previous?.confidence ?? 'UNKNOWN',
          rationale:
            previous?.rationale?.trim() ||
            t('initiatives.planScenario.workbench.defaultRationale'),
          dependencySnapshot: previous?.dependencySnapshot ?? [],
          constraintSnapshot: previous?.constraintSnapshot ?? [],
        };
      });
      const updated = (await writePlanScenario(draft.scenarioId, {
        expectedVersion: aggregateVersion,
        clientRequestId: crypto.randomUUID(),
        operation: 'UPDATE',
        portfolio: 'auto',
        scenario: { ...draft, windowUnit: input.unit, periods, windows },
      })) as { aggregateVersion: number; response: PlanScenario };
      setAggregateVersion(updated.aggregateVersion);
      setDraft(updated.response);
      await refreshRegisterRows();
      markSaved(updated.response.scenarioId);
      const proposalId = `plan-analysis-${draft.scenarioId}-${crypto.randomUUID()}`;
      const result = (await createPlanAnalysisProposal(draft.scenarioId, proposalId, {
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
        scenarioId: draft.scenarioId,
        inputAggregateVersion: updated.aggregateVersion,
        useCapacity: input.mode !== 'DEPENDENCIES',
      })) as { response: PlanAnalysisProposal };
      setAnalysisProposal(result.response);
      setAnalysisState('IDLE');
    } catch (error) {
      setWriteRule(error instanceof RuntimeApiError ? (error.rule ?? null) : null);
      setAnalysisState('ERROR');
    }
  };

  const analyzePlan = async (mode: PlanGenerationMode = 'DEPENDENCIES') => {
    if (!draft || !aggregateVersion || draft.status !== 'DRAFT') return;
    setAnalysisState('LOADING');
    const proposalId = `plan-analysis-${draft.scenarioId}-${crypto.randomUUID()}`;
    try {
      const result = (await createPlanAnalysisProposal(draft.scenarioId, proposalId, {
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
        scenarioId: draft.scenarioId,
        inputAggregateVersion: aggregateVersion,
        useCapacity: mode !== 'DEPENDENCIES',
      })) as { response: PlanAnalysisProposal };
      setAnalysisProposal(result.response);
      setAnalysisState('IDLE');
    } catch {
      setAnalysisState('ERROR');
    }
  };
  const reviewAnalysis = async (outcome: 'ACCEPT' | 'REJECT') => {
    if (!analysisProposal || !draft) return;
    setAnalysisState('LOADING');
    try {
      const reviewed = (await reviewPlanAnalysisProposal(analysisProposal.proposalId, {
        expectedVersion: 1,
        clientRequestId: crypto.randomUUID(),
        outcome,
        // Ślad decyzji w audycie — po polsku, jak reszta warstwy widocznej dla PMO.
        rationale:
          outcome === 'ACCEPT'
            ? 'Człowiek zatwierdził propozycję dla edytowalnego szkicu planu.'
            : 'Człowiek odrzucił propozycję; szkic planu pozostaje bez zmian.',
      })) as { response?: PlanAnalysisProposal };
      if (outcome === 'ACCEPT') {
        // P15 §4.0 D5: „Zatwierdź" = UPDATE okien Z PROPOZYCJI na serwerze, nie
        // zmiana żyjąca w stanie Reacta. Pomiar 07.09: po ACCEPT plan w bazie
        // zostawał bez zmian, a karta i tak pokazywała „Zapisano".
        const windows = applyAcceptedPlanProposal(
          draft.windows,
          analysisProposal.changes,
          reviewed.response?.status
        );
        const updated = (await writePlanScenario(draft.scenarioId, {
          expectedVersion: aggregateVersion,
          clientRequestId: crypto.randomUUID(),
          operation: 'UPDATE',
          portfolio: 'auto',
          scenario: { ...draft, windows },
        })) as { aggregateVersion: number; response: PlanScenario };
        setAggregateVersion(updated.aggregateVersion);
        setDraft(updated.response);
        await refreshRegisterRows();
        markSaved(updated.response.scenarioId);
      }
      setAnalysisProposal({
        ...analysisProposal,
        status: outcome === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
      });
      setAnalysisState('IDLE');
    } catch {
      setAnalysisState('ERROR');
    }
  };
  /**
   * WARSZTAT PLANU W KARCIE (P15-K3, DEC-421, §4.1 pkt 3).
   *
   * „Dodaj inicjatywę" = MOST + zapis: inicjatywa modułu musi najpierw zostać
   * przyjęta do planowania (`register` → agregat `ie/initiative` w
   * APPROVED_BACKLOG), bo `mutatePlanScenario` odrzuca okno na inicjatywę
   * spoza portfela regułą PLAN_MEMBER_NOT_APPROVED (zmierzone 07.09). Portfel
   * roboczy odświeża serwer ze składu okien przy `portfolio: 'auto'`.
   */
  const addInitiativeToPlan = async (initiativeId: string) => {
    if (!draft || draft.status !== 'DRAFT' || draft.windows.some((w) => w.initiativeId === initiativeId))
      return;
    const source = plannable.find((item) => item.id === initiativeId);
    const horizonStart = draft.periods[0]?.start ?? null;
    const horizonEnd = draft.periods[draft.periods.length - 1]?.end ?? null;
    setWriteRule(null);
    try {
      const registered = await registerInitiativeForPlanning(initiativeId, {
        clientRequestId: crypto.randomUUID(),
        allowConditional: source?.conditional === true,
      });
      const planned = source?.plannedStartDate ?? null;
      const window: WindowDraft = {
        initiativeId,
        initiativeVersion: registered.aggregateVersion,
        earliest: horizonStart,
        target:
          planned && horizonStart && horizonEnd && planned >= horizonStart && planned <= horizonEnd
            ? planned
            : horizonStart,
        latest: horizonEnd,
        confidence: 'UNKNOWN',
        rationale: t('initiatives.planScenario.workbench.defaultRationale'),
        dependencySnapshot: [],
        constraintSnapshot: [],
      };
      await persistScenario({ ...draft, windows: [...draft.windows, window] }, 'UPDATE');
    } catch (error) {
      setWriteRule(error instanceof RuntimeApiError ? (error.rule ?? null) : null);
      setWriteState(error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'ERROR');
    }
  };
  /** „Usuń z planu" — okno znika, a razem z nim członkostwo w portfelu roboczym. */
  const removeInitiativeFromPlan = async (initiativeId: string) => {
    if (!draft || draft.status !== 'DRAFT') return;
    await persistScenario(
      {
        ...draft,
        windows: draft.windows
          .filter((window) => window.initiativeId !== initiativeId)
          // Zależność do usuwanej inicjatywy przestaje istnieć w planie; bez tego
          // solver zgłaszałby „zależność spoza planu" przy każdej analizie.
          .map((window) => ({
            ...window,
            dependencySnapshot: window.dependencySnapshot.filter((id) => id !== initiativeId),
          })),
      },
      'UPDATE'
    );
  };
  /** Zmiana dat jednego okna → zapis PEŁNEGO zestawu okien z CAS. */
  const changePlanWindowDates = async (
    initiativeId: string,
    patch: { earliest?: string | null; target?: string | null; latest?: string | null }
  ) => {
    if (!draft || draft.status !== 'DRAFT') return;
    await persistScenario(
      {
        ...draft,
        windows: draft.windows.map((window) =>
          window.initiativeId === initiativeId ? { ...window, ...patch } : window
        ),
      },
      'UPDATE'
    );
  };
  /**
   * „Po inicjatywie" — zapis do `initiative_dependencies` (kanoniczna trasa
   * runtime-v1) I odświeżenie `dependencySnapshot` okna, bo to snapshot czyta
   * solver. Cykl wraca z serwera jako 400 z regułą i zatrzymuje zapis planu.
   */
  const changeWindowDependencies = async (initiativeId: string, dependsOn: string[]) => {
    if (!draft || draft.status !== 'DRAFT') return;
    setWriteRule(null);
    try {
      const saved = await writeInitiativeDependencies(initiativeId, {
        clientRequestId: crypto.randomUUID(),
        dependsOn,
      });
      await persistScenario(
        {
          ...draft,
          windows: draft.windows.map((window) =>
            window.initiativeId === initiativeId
              ? { ...window, dependencySnapshot: saved.dependsOn }
              : window
          ),
        },
        'UPDATE'
      );
    } catch (error) {
      setWriteRule(error instanceof RuntimeApiError ? (error.rule ?? null) : null);
      setWriteState(error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'ERROR');
    }
  };
  /**
   * „Utwórz nową wersję (szkic)" z planu opublikowanego. Domena nie ma osobnej
   * komendy rozgałęzienia: `UPDATE` opublikowanego planu podbija wersję i wraca
   * do stanu SZKIC (`planScenario.ts`), a poprzednia wersja zostaje w historii
   * jako ZASTĄPIONA. To jedyny istniejący mechanizm — patrz STOP-y kroku K3.
   */
  const createDraftVersionFromPublished = async () => {
    if (!draft || draft.status === 'DRAFT') return;
    await persistScenario(draft, 'UPDATE');
  };
  const updateWindow = (initiativeId: string, patch: Partial<WindowDraft>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            windows: current.windows.map((window) =>
              window.initiativeId === initiativeId ? { ...window, ...patch } : window
            ),
          }
        : current
    );
  const requestPublish = () => {
    const conflicts = analysisProposal?.conflicts.length ?? 0;
    if (conflicts) {
      setPublishConfirmationPending(conflicts);
      return;
    }
    void write('PUBLISH');
  };
  const publicationConfirmationDialog = publishConfirmationPending !== null && (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Potwierdzenie publikacji z konfliktami"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
    >
      <div className="w-full max-w-lg rounded-xl border border-c-border bg-c-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Plan zawiera konflikty</h2>
        <p className="mt-2 text-sm text-c-text-secondary">
          Potwierdzenie zostanie zapisane w śladzie planu wraz z osobą, czasem i liczbą konfliktów.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg border border-c-border px-3 py-2"
            onClick={() => setPublishConfirmationPending(null)}
          >
            Anuluj
          </button>
          <button
            className="rounded-lg border border-c-border px-3 py-2 font-medium"
            onClick={() =>
              void write('PUBLISH', {
                conflictCount: publishConfirmationPending,
                statement: `Publikuję mimo ${publishConfirmationPending} konfliktów`,
              })
            }
          >
            Publikuję mimo {publishConfirmationPending} konfliktów
          </button>
        </div>
      </div>
    </div>
  );
  const addWindow = (initiativeId: string) =>
    setDraft((current) =>
      !current || current.windows.some((window) => window.initiativeId === initiativeId)
        ? current
        : {
            ...current,
            windows: [
              ...current.windows,
              {
                initiativeId,
                initiativeVersion: 1,
                earliest: null,
                target: null,
                latest: null,
                confidence: 'UNKNOWN',
                rationale: t('initiatives.planScenario.workbench.defaultRationale'),
                dependencySnapshot: [],
                constraintSnapshot: [],
              },
            ],
          }
    );
  const removeWindow = (initiativeId: string) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            windows: current.windows.filter((window) => window.initiativeId !== initiativeId),
          }
        : current
    );
  const assignWindowToPeriod = (initiativeId: string, periodIndex: number) => {
    const period = draft?.periods[periodIndex];
    if (!period) return;
    updateWindow(initiativeId, {
      earliest: period.start,
      target: period.start,
      latest: period.end,
    });
  };
  const moveWindowAcrossPeriods = (initiativeId: string, delta: -1 | 1) => {
    const window = draft?.windows.find((item) => item.initiativeId === initiativeId);
    if (!draft || !window) return;
    const currentIndex = draft.periods.findIndex(
      (period) => window.target && window.target >= period.start && window.target < period.end
    );
    const nextIndex = Math.min(
      draft.periods.length - 1,
      Math.max(0, (currentIndex < 0 ? (delta > 0 ? -1 : 1) : currentIndex) + delta)
    );
    assignWindowToPeriod(initiativeId, nextIndex);
  };
  const move = (index: number, delta: -1 | 1) =>
    setDraft((current) => {
      if (!current) return current;
      const target = index + delta;
      if (target < 0 || target >= current.windows.length) return current;
      const windows = [...current.windows];
      [windows[index], windows[target]] = [windows[target], windows[index]];
      return { ...current, windows };
    });
  const updatePeriod = (index: number, patch: Partial<PeriodDraft>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            periods: current.periods.map((period, periodIndex) =>
              periodIndex === index ? { ...period, ...patch } : period
            ),
          }
        : current
    );
  const addPeriod = () =>
    setDraft((current) => {
      if (!current) return current;
      const previousEnd = current.periods.at(-1)?.end ?? new Date().toISOString();
      const start = new Date(previousEnd);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 7);
      return {
        ...current,
        periods: [
          ...current.periods,
          {
            periodId: `Tydzień ${current.periods.length + 1}`,
            start: start.toISOString(),
            end: end.toISOString(),
          },
        ],
      };
    });
  const removePeriod = (index: number) =>
    setDraft((current) =>
      current
        ? { ...current, periods: current.periods.filter((_, periodIndex) => periodIndex !== index) }
        : current
    );
  const lifecycleOptions = useMemo(
    () =>
      Array.from(
        new Set(initiatives.map((initiative) => initiative.lifecycle).filter(Boolean) as string[])
      ).sort(),
    [initiatives]
  );
  const selectableInitiatives = useMemo(
    () =>
      initiatives.filter(
        (initiative) =>
          initiativeLifecycleFilter === 'ALL' || initiative.lifecycle === initiativeLifecycleFilter
      ),
    [initiativeLifecycleFilter, initiatives]
  );

  if (state === 'LOADING')
    return (
      <div role="status" className="flex items-center gap-2 p-6">
        <Loader2 className="animate-spin" size={16} /> {t('initiatives.planScenario.loading')}
      </div>
    );
  if (state === 'ERROR')
    return (
      <div role="alert" className="m-4 flex items-center justify-between text-c-danger">
        <span>
          <AlertTriangle size={16} className="inline" /> {t('initiatives.planScenario.unavailable')}
        </span>
        <button type="button" className="btn-secondary" onClick={() => void loadRegister()}>
          {t('initiatives.planScenario.retry')}
        </button>
      </div>
    );
  if (workspaceOpen && draft) {
    /**
     * KONFLIKT WERSJI NA EKRANIE (P15-K3, DEC-421). Warsztat zapisuje z CAS;
     * gdy plan zmienił się między odczytem a zapisem, serwer zwraca 409 i to
     * zdanie mówi człowiekowi, co zrobić — zamiast zostawić wiersz w stanie,
     * który nie poszedł do bazy.
     */
    const cardErrorLabel =
      writeState === 'CONFLICT' || writeState === 'ERROR'
        ? writeRule
          ? t(`initiatives.planScenario.errors.${writeRule}`, {
              defaultValue:
                writeState === 'CONFLICT'
                  ? t('initiatives.planScenario.conflictError')
                  : t('initiatives.planScenario.writeError'),
            })
          : writeState === 'CONFLICT'
            ? t('initiatives.planScenario.conflictError')
            : t('initiatives.planScenario.writeError')
        : null;
    const proposalNames = new Map([
      ...initiatives.map((item) => [item.id, item.name] as const),
      ...plannable.map((item) => [item.id, item.name] as const),
    ]);
    const proposalRows: GeneratorProposalRow[] | null = analysisProposal
      ? analysisProposal.changes.map((change) => ({
          initiativeId: change.initiativeId,
          name: proposalNames.get(change.initiativeId) ?? change.initiativeId,
          from: formatDate(change.after?.earliest ?? null),
          to: formatDate(change.after?.latest ?? null),
          rationale: change.after?.rationale ?? '',
          conflict:
            analysisProposal.conflicts.find((conflict) =>
              conflict.includes(change.initiativeId)
            ) ?? null,
        }))
      : null;
    return (
      <>
        <PlanCard
          scenario={draft}
          initiatives={initiatives}
          plannable={plannable}
          proposal={analysisProposal}
          proposalRows={proposalRows}
          proposalConflicts={analysisProposal?.conflicts ?? []}
          savedLabel={savedLabel}
          busy={analysisState === 'LOADING' || writeState === 'SAVING'}
          onBack={() => setWorkspaceOpen(false)}
          onAnalyze={(mode) => void analyzePlan(mode)}
          onGenerate={(input) => void generatePlan(input)}
          onReview={(outcome) => void reviewAnalysis(outcome)}
          onPublish={requestPublish}
          onAddInitiative={(initiativeId) => void addInitiativeToPlan(initiativeId)}
          onRemoveInitiative={(initiativeId) => void removeInitiativeFromPlan(initiativeId)}
          onWindowChange={(initiativeId, patch) =>
            void changePlanWindowDates(initiativeId, patch)
          }
          onDependenciesChange={(initiativeId, dependsOn) =>
            void changeWindowDependencies(initiativeId, dependsOn)
          }
          onNewDraftVersion={() => void createDraftVersionFromPublished()}
          errorLabel={cardErrorLabel}
        />
        {publicationConfirmationDialog}
      </>
    );
  }
  if (!workspaceOpen && !showCreate) {
    const visiblePlans = rows.filter((row) =>
      activePreset === 'drafts'
        ? row.state === 'DRAFT'
        : activePreset === 'published'
          ? row.state === 'PUBLISHED'
          : activePreset === 'conflicted'
            ? row.conflicts > 0
            : true
    );
    const selectedPlan = visiblePlans.find((row) => row.id === selectedId) ?? null;
    return (
      <section
        aria-label={t('initiatives.plan.listAria', 'Lista planów')}
        className="h-full min-h-0"
      >
        <TableWithPreviewLayout<RegisterRow>
          selectedId={selectedId}
          selectedItem={selectedPlan}
          onSelect={setSelectedId}
          onOpenFull={(id) => void open(id)}
          itemIds={visiblePlans.map((row) => row.id)}
          getItemById={(id) => visiblePlans.find((row) => row.id === id) ?? null}
          previewOpen={Boolean(selectedPlan)}
          renderPreview={(row) => (
            <StandardPreview
              embedded
              title={row.title}
              onClose={() => setSelectedId(null)}
              onOpenFull={() => void open(row.id)}
              meta={{
                pills: [
                  { label: t(planStatusKey[row.state as PlanScenario['status']]), tone: 'neutral' },
                ],
              }}
              details={{
                properties: [
                  {
                    id: 'portfolio',
                    label: t('initiatives.plan.columns.portfolio', 'Portfel / wersja'),
                    value: row.portfolio,
                  },
                  {
                    id: 'horizon',
                    label: t('initiatives.plan.columns.horizon', 'Horyzont'),
                    value: `${formatDate(row.earliest)} – ${formatDate(row.latest)}`,
                  },
                  {
                    id: 'initiatives',
                    label: t('initiatives.plan.columns.initiatives', 'Inicjatyw w planie'),
                    value: String(row.initiativeCount),
                  },
                  {
                    id: 'conflicts',
                    label: t('initiatives.plan.columns.conflicts', 'Konflikty'),
                    value: row.conflicts ? String(row.conflicts) : t('common.none', 'Brak'),
                  },
                ],
              }}
            />
          )}
        >
          <StandardTable
            columns={[
              { id: 'title', label: t('initiatives.plan.columns.name', 'Nazwa'), sortable: true },
              {
                id: 'portfolio',
                label: t('initiatives.plan.columns.portfolio', 'Portfel / wersja'),
                sortable: true,
              },
              {
                id: 'earliest',
                label: t('initiatives.plan.columns.horizon', 'Horyzont'),
                render: (row) => `${formatDate(row.earliest)} – ${formatDate(row.latest)}`,
              },
              {
                id: 'state',
                label: t('common.status', 'Status'),
                render: (row) => t(planStatusKey[row.state as PlanScenario['status']]),
              },
              {
                id: 'initiativeCount',
                label: t('initiatives.plan.columns.initiatives', 'Inicjatyw w planie'),
                sortable: true,
              },
              {
                id: 'conflicts',
                label: t('initiatives.plan.columns.conflicts', 'Konflikty'),
                render: (row) => (row.conflicts ? row.conflicts : t('common.none', 'Brak')),
              },
              {
                id: 'updatedAt',
                label: t('initiatives.plan.columns.updatedAt', 'Zaktualizowano'),
                render: (row) => formatDate(row.updatedAt),
              },
              { id: 'author', label: t('initiatives.plan.columns.author', 'Autor') },
            ]}
            data={visiblePlans}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(String(row.id))}
            onRowDoubleClick={(row) => void open(String(row.id))}
            /*
             * P15-K3 (DEC-421): bez tego rekwizytu pusta lista planów mówiła
             * „No items found" (domyślny napis `StandardTable`) w polskim UI.
             */
            empty={{
              title: t('initiatives.planCard.listEmptyTitle', 'Brak planów'),
              description: t(
                'initiatives.planCard.listEmptyDescription',
                'Załóż pierwszy plan przyciskiem „Nowy plan" — wybierzesz w nim zatwierdzone inicjatywy i horyzont.'
              ),
            }}
          />
        </TableWithPreviewLayout>
      </section>
    );
  }
  return (
    <section
      aria-label={t('initiatives.planScenario.sectionAria')}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-c-border p-3">
        <div>
          <h2 className="font-semibold">{t('initiatives.planScenario.heading')}</h2>
          <p className="text-sm text-c-text-muted">{t('initiatives.planScenario.subheading')}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> {t('initiatives.planScenario.newPlan')}
        </button>
      </div>
      {showCreate && (
        <div className="flex flex-wrap items-end gap-2 border-b border-c-border p-3">
          <label className="text-xs">
            {t('initiatives.planScenario.form.planName')}
            <input
              aria-label={t('initiatives.planScenario.form.planNameAria')}
              className="mt-1 block bg-c-surface p-2"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <p className="w-full text-xs text-c-text-muted">
            {t('initiatives.planScenario.form.workingPortfolioHint', {
              defaultValue:
                'Portfel roboczy założy się sam ze składu inicjatyw wybranych w generatorze.',
            })}
          </p>
          <label className="text-xs">
            {t('initiatives.planScenario.form.windowUnit')}
            <select
              aria-label={t('initiatives.planScenario.form.windowUnitAria')}
              className="mt-1 block w-24 bg-c-surface p-2"
              value={newWindowUnit}
              onChange={(event) => setNewWindowUnit(event.target.value)}
            >
              <option value="WEEK">{t('initiatives.planScenario.form.weekOption')}</option>
              <option value="MONTH">{t('initiatives.planScenario.form.monthOption')}</option>
            </select>
          </label>
          <label className="text-xs">
            {t('initiatives.planScenario.form.timezone')}
            <input
              aria-label={t('initiatives.planScenario.form.timezoneAria')}
              className="mt-1 block min-w-40 bg-c-surface p-2"
              value={newTimezone}
              onChange={(event) => setNewTimezone(event.target.value)}
            />
          </label>
          <label className="text-xs">
            {t('initiatives.planScenario.form.horizonStart')}
            <input
              aria-label={t('initiatives.planScenario.form.horizonStartAria')}
              className="mt-1 block bg-c-surface p-2"
              type="date"
              value={newStart}
              onChange={(event) => setNewStart(event.target.value)}
            />
          </label>
          <label className="text-xs">
            {t('initiatives.planScenario.form.weekCount')}
            <input
              aria-label={t('initiatives.planScenario.form.weekCountAria')}
              className="mt-1 block w-24 bg-c-surface p-2"
              type="number"
              min={1}
              max={104}
              value={newWeekCount}
              onChange={(event) => setNewWeekCount(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={
              !newName.trim() ||
              !newWindowUnit.trim() ||
              !newTimezone.trim() ||
              !newStart ||
              newWeekCount < 1 ||
              newWeekCount > 104
            }
            onClick={() => void create()}
          >
            <Plus size={15} /> {t('initiatives.planScenario.form.createPlan')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
            {t('common.cancel')}
          </button>
        </div>
      )}
      {(writeState === 'ERROR' || writeState === 'CONFLICT') && (
        <div role="alert" className="m-3 text-sm text-c-danger">
          {writeRule
            ? t(`initiatives.planScenario.errors.${writeRule}`, {
                defaultValue: t('initiatives.planScenario.writeError'),
              })
            : writeState === 'CONFLICT'
              ? t('initiatives.planScenario.conflictError')
              : t('initiatives.planScenario.writeError')}
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-c-border px-3 py-2">
        <label className="w-full min-w-0 text-xs text-c-text-muted sm:w-auto">
          {t('initiatives.planScenario.activePlan')}
          <select
            aria-label={t('initiatives.planScenario.activePlanAria')}
            className="mt-1 block w-full min-w-0 max-w-full rounded border border-c-border bg-c-surface px-2 py-1 text-sm sm:ml-2 sm:mt-0 sm:inline-block sm:w-auto"
            value={selectedId ?? ''}
            onChange={(event) => {
              const id = event.target.value;
              setSelectedWindowId(null);
              setWorkspaceOpen(false);
              void open(id).then(() => setWorkspaceOpen(false));
            }}
          >
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title} · {t(planStatusKey[row.state as PlanScenario['status']])} · v
                {row.version}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-secondary sm:ml-auto"
          disabled={!selectedId}
          onClick={showWorkspace}
        >
          <Eye size={15} /> {t('initiatives.planScenario.openWorkspace')}
        </button>
      </div>
      {/*
       * `flex-1 min-h-0` — bez tego opakowania `TableWithPreviewLayout` (root
       * `h-full`) siedzi jako zwykle dziecko `flex-col` bez `flex-grow`, wiec
       * nie rosnie do reszty wysokosci sekcji (pomiar 02.09,
       * scripts/dev/measure-preview-canon.mjs --wysokosc; wzorzec z
       * ExecutionResourcesSurface.tsx:418-437).
       */}
      <div className="flex-1 min-h-0">
        <TableWithPreviewLayout<(typeof planWindowRows)[number]>
          selectedId={selectedWindowId}
          selectedItem={visiblePlanWindows.find((row) => row.id === selectedWindowId) ?? null}
          onSelect={setSelectedWindowId}
          onOpenFull={onOpenInitiative ? (id) => openInitiativeCard(id) : undefined}
          openDisabledReason={openCardDisabledReason}
          itemIds={visiblePlanWindows.map((row) => row.id)}
          getItemById={(id) => visiblePlanWindows.find((row) => row.id === id) ?? null}
          previewOpen={!workspaceOpen && Boolean(selectedWindowId)}
          renderPreview={(row) => (
            <StandardPreview
              embedded
              title={row.title}
              onClose={() => setSelectedWindowId(null)}
              onOpenFull={onOpenInitiative ? () => openInitiativeCard(row.id) : undefined}
              openDisabledReason={openCardDisabledReason}
              meta={{
                pills: [
                  { label: t(planBandKey[row.band] ?? row.band), tone: 'neutral' },
                  {
                    label: t(planConfidenceKey[row.confidence] ?? row.confidence),
                    tone: 'neutral',
                  },
                  {
                    label: t(
                      planStatusKey[row.published as PlanScenario['status']] ?? row.published
                    ),
                    tone: 'neutral',
                  },
                ],
                trailing: <span>{row.target}</span>,
              }}
              details={{
                label: t('initiatives.planScenario.preview.windowLabel'),
                text: t('initiatives.planScenario.preview.windowText'),
                properties: [
                  {
                    id: 'window',
                    label: t('initiatives.planScenario.columns.window'),
                    value: t(planBandKey[row.band] ?? row.band),
                  },
                  {
                    id: 'target',
                    label: t('initiatives.planScenario.columns.proposedTarget'),
                    value: row.target,
                  },
                  {
                    id: 'dependencies',
                    label: t('initiatives.planScenario.columns.dependencies'),
                    value: t(planReadinessStateKey[row.dependency] ?? row.dependency),
                  },
                  {
                    id: 'capacity',
                    label: t('initiatives.planScenario.columns.capacity'),
                    value: t(planReadinessStateKey[row.capacity] ?? row.capacity),
                  },
                  {
                    id: 'conflict',
                    label: t('initiatives.planScenario.columns.conflict'),
                    value: t(planConflictStateKey[row.conflict] ?? row.conflict),
                  },
                ],
              }}
              ai={{
                hints: [
                  t('initiatives.planScenario.preview.aiHintDependencies'),
                  t('initiatives.planScenario.preview.aiHintSequencing'),
                ],
                disabled: true,
                disabledTooltip: t('initiatives.planScenario.preview.aiDisabledTooltip'),
              }}
              relations={[
                { id: row.id, label: row.id, type: 'initiative' },
                {
                  id: draft?.portfolioScenarioId ?? 'UNKNOWN',
                  label: `${t('initiatives.planScenario.portfolioLabel')} ${draft?.portfolioScenarioId ?? 'UNKNOWN'}:v${draft?.portfolioScenarioVersion ?? 'UNKNOWN'}`,
                  type: 'portfolio',
                },
              ]}
              /*
               * Odbiór grafiki 174-domkniecie (2026-09-01): pastylka w stopce
               * podglądu WIERSZA prowadziła do `showWorkspace`, czyli wsuwała
               * warsztat planu POD tabelę. Właściciel: „narzędzie otwiera tę
               * wybraną linię jako tabelę poniżej tej tabeli. Ma ona otwierać
               * konkretną kartę." Panel jest zakresu WIERSZA, więc jego akcja
               * musi prowadzić do obiektu wiersza — karty inicjatywy. Warsztat
               * planu (zakres PLANU) ma własny przycisk w pasku nad tabelą.
               */
              actions={{
                informational: [
                  {
                    id: 'open-initiative-card',
                    variant: 'neutral',
                    label: t('initiatives.planScenario.openInitiativeCard'),
                    icon: Eye,
                    shortcut: 'O',
                    onClick: () => openInitiativeCard(row.id),
                    disabled: !onOpenInitiative,
                  },
                ],
              }}
            />
          )}
        >
          <StandardTable
            columns={[
              {
                id: 'title',
                label: t('initiatives.planScenario.columns.initiative'),
                sortable: true,
                width: '240px',
              },
              {
                id: 'backlogState',
                label: t('initiatives.planScenario.columns.backlogState'),
                sortable: true,
                filterable: true,
                render: (row) => t(planBacklogStateKey[row.backlogState] ?? row.backlogState),
              },
              {
                id: 'earliest',
                label: t('initiatives.planScenario.columns.earliest'),
                sortable: true,
              },
              {
                id: 'target',
                label: t('initiatives.planScenario.columns.proposedTarget'),
                sortable: true,
              },
              { id: 'latest', label: t('initiatives.planScenario.columns.latest'), sortable: true },
              {
                id: 'dependency',
                label: t('initiatives.planScenario.columns.dependencyReadiness'),
                sortable: true,
                filterable: true,
                render: (row) => t(planReadinessStateKey[row.dependency] ?? row.dependency),
              },
              {
                id: 'mandatoryDeadline',
                label: t('initiatives.planScenario.columns.mandatoryDeadline'),
                sortable: true,
                render: (row) =>
                  t(planReadinessStateKey[row.mandatoryDeadline] ?? row.mandatoryDeadline),
              },
              {
                id: 'costOfDelay',
                label: t('initiatives.planScenario.columns.costOfDelay'),
                sortable: true,
                render: (row) => t(planReadinessStateKey[row.costOfDelay] ?? row.costOfDelay),
              },
              {
                id: 'roughDemand',
                label: t('initiatives.planScenario.columns.roughDemand'),
                sortable: true,
                render: (row) => t(planReadinessStateKey[row.roughDemand] ?? row.roughDemand),
              },
              {
                id: 'capacity',
                label: t('initiatives.planScenario.columns.capacityState'),
                sortable: true,
                filterable: true,
                render: (row) => t(planReadinessStateKey[row.capacity] ?? row.capacity),
              },
              {
                id: 'confidence',
                label: t('initiatives.planScenario.columns.scheduleConfidence'),
                sortable: true,
                filterable: true,
                render: (row) => t(planConfidenceKey[row.confidence] ?? row.confidence),
              },
              {
                id: 'conflict',
                label: t('initiatives.planScenario.columns.conflict'),
                sortable: true,
                filterable: true,
                render: (row) => t(planConflictStateKey[row.conflict] ?? row.conflict),
              },
              {
                id: 'nextAction',
                label: t('initiatives.planScenario.columns.nextAction'),
                sortable: true,
                render: (row) => t(planNextActionKey[row.nextAction] ?? row.nextAction),
              },
            ]}
            data={visiblePlanWindows}
            selectedRowId={selectedWindowId}
            onRowClick={(row) => setSelectedWindowId(String(row.id))}
            onRowDoubleClick={
              onOpenInitiative ? (row) => openInitiativeCard(String(row.id)) : undefined
            }
            /*
             * Odbiór grafiki 174-domkniecie (2026-09-01): akcja GŁÓWNA kebaba
             * wiersza (blok 1 kanonu = „akcja główna encji: View/Open") była
             * podpięta pod `showWorkspace` — czyli jedyne „Otwórz" dostępne
             * z wiersza wsuwało DRUGĄ TABELĘ pod pierwszą, a nie kartę encji.
             * Właściciel nie mógł z tego ekranu dojść do inicjatywy w ogóle.
             * Teraz blok 1 = karta inicjatywy (ta sama ścieżka co dwuklik
             * i „Otwórz" w nagłówku podglądu); gdy host nie potrafi otworzyć
             * karty, pozycja jest wyłączona z powodem, a nie podmieniona na
             * akcję prowadzącą gdzie indziej niż napis.
             */
            rowMenu={(row) => ({
              primary: [
                {
                  id: 'open-initiative-card',
                  label: t('initiatives.planScenario.openInitiativeCard'),
                  icon: Eye,
                  onClick: onOpenInitiative ? () => openInitiativeCard(String(row.id)) : undefined,
                  disabled: !onOpenInitiative,
                  note: openCardDisabledReason,
                },
              ],
              universalHandlers: {
                preview: () => setSelectedWindowId(String(row.id)),
                edit: showWorkspace,
                archiveNote: t('initiatives.planScenario.archiveNote'),
              },
              destructive: { note: t('initiatives.planScenario.destructiveNote') },
            })}
            persistKey="initiatives.plan-windows.v2"
            empty={{
              title: t('initiatives.planScenario.emptyTitle'),
              description: t('initiatives.planScenario.emptyDescription'),
            }}
          />
        </TableWithPreviewLayout>
      </div>
      {/*
       * P15-K3 (DEC-421): WARSZTAT PLANU PRZENIESIONY DO KARTY.
       *
       * Do tej paczki wisiał tu blok `{draft && workspaceOpen && …}` — 742 linie
       * edytora okien, osi czasu, diffu i historii, NIEOSIĄGALNE, bo gałąź
       * `workspaceOpen && draft` zwraca `PlanCard` kilkaset linii wyżej. To, co
       * z niego użyteczne (edycja dat okna, zakres inicjatyw, zależności), żyje
       * teraz w karcie planu i jest naprawdę klikalne; reszta została usunięta,
       * żeby nikt nie naprawiał kodu, którego użytkownik nigdy nie zobaczy.
       */}
      {publicationConfirmationDialog}
    </section>
  );
};

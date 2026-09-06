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
  listPlanScenarioRegister,
  readPlanScenario,
  readPlanScenarioDiff,
  readPlanScenarioHistory,
  reviewPlanAnalysisProposal,
  RuntimeApiError,
  writePlanScenario,
} from '@/services/initiatives-execution/runtimeApi';

import type { CanonicalMenu3Contract } from './canonicalMenu3';
import { PlanCard } from './cards/PlanCard';
import type { PlanGenerationMode } from './Generator/GeneratorPlanuModal';
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
  status: 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED';
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
const createWeeklyPeriods = (start: string, count: number): PeriodDraft[] => {
  const first = new Date(toDateIso(start));
  if (Number.isNaN(first.getTime()) || count < 1) return [];
  return Array.from({ length: count }, (_, index) => {
    const periodStart = new Date(first);
    periodStart.setUTCDate(first.getUTCDate() + index * 7);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCDate(periodStart.getUTCDate() + 7);
    return {
      periodId: `Tydzień ${index + 1}`,
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
  const [portfolioId, setPortfolioId] = useState('');
  const [portfolioVersion, setPortfolioVersion] = useState(1);
  const [newWindowUnit, setNewWindowUnit] = useState('WEEK');
  const [newTimezone, setNewTimezone] = useState('Europe/Warsaw');
  const [newStart, setNewStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [newWeekCount, setNewWeekCount] = useState(12);
  const [showCreate, setShowCreate] = useState(false);
  const [initiativeLifecycleFilter, setInitiativeLifecycleFilter] = useState('ALL');
  const commandIds = useRef(new Map<string, string>());
  const handledCreateRequest = useRef(createRequestId);

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
      const result = (await listPlanScenarioRegister()) as {
        scenarios?: Array<{
          id: string;
          name: string;
          state: string;
          version: number;
          portfolioRef: { scenarioId: string; scenarioVersion: number };
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
        }>;
      };
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
      const nextRows = enrichedScenarios.map((item) => ({
        id: item.id,
        title: resolveBusinessDisplayLabel({
          displayName: item.name,
          rawId: item.id,
          fallback: `${t('initiatives.plan.unnamed', 'Plan bez nazwy')} · ${formatDate(item.updatedAt)}`,
        }),
        state: item.state,
        version: item.version,
        portfolio: `${resolveBusinessDisplayLabel({
          displayName: item.portfolioRef.scenarioId,
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
      }));
      setRows(nextRows);
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
    const periods = createWeeklyPeriods(newStart, newWeekCount);
    if (
      !newName.trim() ||
      !portfolioId.trim() ||
      portfolioVersion < 1 ||
      !newWindowUnit.trim() ||
      !newTimezone.trim() ||
      !periods.length
    )
      return;
    const scenario: PlanScenario = {
      scenarioId: `plan-${crypto.randomUUID()}`,
      name: newName.trim(),
      scenarioVersion: 0,
      status: 'DRAFT',
      portfolioScenarioId: portfolioId.trim(),
      portfolioScenarioVersion: portfolioVersion,
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
    setWriteState('SAVING');
    try {
      const result = (await writePlanScenario(scenario.scenarioId, {
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
        operation: 'CREATE',
        scenario,
      })) as { aggregateVersion: number; response: PlanScenario };
      setAggregateVersion(result.aggregateVersion);
      setDraft(result.response);
      setShowCreate(false);
      setWorkspaceOpen(true);
      setWriteState('IDLE');
      await loadRegister();
      setSelectedId(result.response.scenarioId);
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'ERROR'
      );
    }
  };
  const write = async (
    operation: 'CREATE' | 'UPDATE' | 'PUBLISH',
    publishConfirmation?: { conflictCount: number; statement: string }
  ) => {
    if (!draft || !knownTimeBasis(draft) || writeState === 'SAVING') {
      if (draft && !knownTimeBasis(draft)) setWriteState('ERROR');
      return;
    }
    setWriteState('SAVING');
    const key = `${draft.scenarioId}:${aggregateVersion}:${operation}`;
    const clientRequestId = commandIds.current.get(key) ?? crypto.randomUUID();
    commandIds.current.set(key, clientRequestId);
    try {
      const result = (await writePlanScenario(draft.scenarioId, {
        expectedVersion: aggregateVersion,
        clientRequestId,
        operation,
        ...(publishConfirmation ? { publishConfirmation } : {}),
        scenario: draft,
      })) as { aggregateVersion: number; response: PlanScenario };
      setAggregateVersion(result.aggregateVersion);
      setDraft(result.response);
      setWriteState('IDLE');
      setPublishConfirmationPending(null);
      await loadRegister();
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
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'ERROR'
      );
    }
  };
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
        rationale:
          outcome === 'ACCEPT'
            ? 'Human accepted proposal for the editable draft.'
            : 'Human rejected proposal; draft remains unchanged.',
      })) as { response?: PlanAnalysisProposal };
      if (outcome === 'ACCEPT') {
        setDraft({
          ...draft,
          windows: applyAcceptedPlanProposal(
            draft.windows,
            analysisProposal.changes,
            reviewed.response?.status
          ),
        });
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
    return (
      <>
        <PlanCard
          scenario={draft}
          initiatives={initiatives}
          proposal={analysisProposal}
          busy={analysisState === 'LOADING' || writeState === 'SAVING'}
          onBack={() => setWorkspaceOpen(false)}
          onAnalyze={(mode) => void analyzePlan(mode)}
          onReview={(outcome) => void reviewAnalysis(outcome)}
          onPublish={requestPublish}
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
          <label className="text-xs">
            {t('initiatives.planScenario.form.sourcePortfolio')}
            <input
              aria-label={t('initiatives.planScenario.form.sourcePortfolioAria')}
              className="mt-1 block bg-c-surface p-2"
              value={portfolioId}
              onChange={(e) => setPortfolioId(e.target.value)}
            />
          </label>
          <label className="text-xs">
            {t('initiatives.planScenario.form.portfolioVersion')}
            <input
              aria-label={t('initiatives.planScenario.form.portfolioVersionAria')}
              className="mt-1 block w-20 bg-c-surface p-2"
              type="number"
              min={1}
              value={portfolioVersion}
              onChange={(e) => setPortfolioVersion(Number(e.target.value))}
            />
          </label>
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
              !portfolioId.trim() ||
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
          {writeState === 'CONFLICT'
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
      {draft && workspaceOpen && (
        <section
          aria-label={t('initiatives.planScenario.workbenchAria')}
          className="min-h-0 border-t border-c-border p-4"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">
              {t('initiatives.planScenario.workbench.title')} · {draft.scenarioId}:v
              {draft.scenarioVersion}
            </h3>
            <span className="text-xs text-c-text-muted">
              {t('initiatives.planScenario.portfolioLabel')} {draft.portfolioScenarioId}:v
              {draft.portfolioScenarioVersion}
            </span>
            <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  !aggregateVersion || draft.status !== 'DRAFT' || analysisState === 'LOADING'
                }
                onClick={() => void analyzePlan()}
              >
                {analysisState === 'LOADING' ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <ListOrdered size={15} />
                )}{' '}
                {t('initiatives.planScenario.workbench.sequenceByDependencies')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                aria-label={t('initiatives.planScenario.workbench.closeAria')}
                onClick={() => setWorkspaceOpen(false)}
              >
                <X size={15} /> {t('common.close')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  draft.status !== 'DRAFT' || !knownTimeBasis(draft) || writeState === 'SAVING'
                }
                onClick={() => void write(aggregateVersion ? 'UPDATE' : 'CREATE')}
              >
                {writeState === 'SAVING' ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <Save size={15} />
                )}{' '}
                {t('initiatives.planScenario.workbench.saveDraft')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  !aggregateVersion ||
                  draft.status !== 'DRAFT' ||
                  !knownTimeBasis(draft) ||
                  writeState === 'SAVING'
                }
                onClick={requestPublish}
              >
                <Send size={15} /> {t('initiatives.planScenario.workbench.publish')}
              </button>
            </div>
          </div>
          {/*
           * Odbiór grafiki 174-domkniecie (2026-09-01) — USUNIĘTA DRUGA TABELA.
           *
           * Warsztat planu renderował tu `StandardTable` na tym SAMYM zbiorze
           * `visiblePlanWindows` co tabela główna, tyle że z węższym zestawem
           * kolumn. Efekt na ekranie: po kliknięciu „Otwórz narzędzia planu"
           * pod pierwszą tabelą wysuwała się DRUGA tabela z tymi samymi
           * wierszami. Dokładnie to zgłosił właściciel 2026-08-30:
           * „narzędzie otwiera tę wybraną linię jako tabelę poniżej tej
           * tabeli. Ma ona otwierać konkretną kartę. W ogóle nie rozumiem,
           * jak to działa."
           *
           * Duplikat nie niósł żadnej informacji, której nie ma tabela główna
           * (te same wiersze, podzbiór kolumn, bez podglądu i bez kebaba),
           * a warsztat i tak edytuje okna niżej — w „Osi czasu" i w edytorze
           * kolejności. Warsztat zostaje NARZĘDZIEM (horyzont · zakres · oś
           * czasu · kolejność), a nie powtórzoną listą.
           */}
          <fieldset className="mb-4 rounded-md border border-c-border p-3">
            <legend className="px-1 text-sm font-medium">
              {t('initiatives.planScenario.workbench.horizon')}
            </legend>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs">
                {t('initiatives.planScenario.form.windowUnit')}
                <select
                  aria-label={t('initiatives.planScenario.workbench.windowUnitAria')}
                  className="mt-1 block w-full bg-c-surface p-2"
                  value={draft.windowUnit}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, windowUnit: event.target.value } : current
                    )
                  }
                >
                  <option value="WEEK">{t('initiatives.planScenario.form.weekOption')}</option>
                  <option value="MONTH">{t('initiatives.planScenario.form.monthOption')}</option>
                </select>
              </label>
              <label className="text-xs">
                {t('initiatives.planScenario.form.timezone')}
                <input
                  aria-label={t('initiatives.planScenario.workbench.timezoneAria')}
                  className="mt-1 block w-full bg-c-surface p-2"
                  value={draft.timezone}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, timezone: event.target.value } : current
                    )
                  }
                />
              </label>
            </div>
            <div
              className="space-y-2"
              aria-label={t('initiatives.planScenario.workbench.periodsAria')}
            >
              {draft.periods.map((period, index) => (
                <div
                  key={`${period.periodId}-${index}`}
                  className="grid grid-cols-1 items-end gap-2 rounded border border-c-border p-2 sm:grid-cols-[minmax(8rem,1fr)_10rem_10rem_auto]"
                >
                  <label className="text-xs">
                    {t('initiatives.planScenario.workbench.periodName')}
                    <input
                      aria-label={t('initiatives.planScenario.workbench.periodNameAria', {
                        index: index + 1,
                      })}
                      className="mt-1 block w-full bg-c-surface p-2"
                      value={period.periodId}
                      onChange={(event) => updatePeriod(index, { periodId: event.target.value })}
                    />
                  </label>
                  <label className="text-xs">
                    {t('initiatives.planScenario.workbench.periodFrom')}
                    <input
                      aria-label={t('initiatives.planScenario.workbench.periodFromAria', {
                        index: index + 1,
                      })}
                      className="mt-1 block w-full bg-c-surface p-2"
                      type="date"
                      value={toDateInput(period.start)}
                      onChange={(event) =>
                        updatePeriod(index, { start: toDateIso(event.target.value) })
                      }
                    />
                  </label>
                  <label className="text-xs">
                    {t('initiatives.planScenario.workbench.periodTo')}
                    <input
                      aria-label={t('initiatives.planScenario.workbench.periodToAria', {
                        index: index + 1,
                      })}
                      className="mt-1 block w-full bg-c-surface p-2"
                      type="date"
                      value={toDateInput(period.end)}
                      onChange={(event) =>
                        updatePeriod(index, { end: toDateIso(event.target.value) })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-ghost"
                    aria-label={t('initiatives.planScenario.workbench.removePeriodAria', {
                      index: index + 1,
                    })}
                    onClick={() => removePeriod(index)}
                  >
                    <Trash2 size={15} /> {t('common.delete')}
                  </button>
                </div>
              ))}
              <button type="button" className="btn-secondary" onClick={addPeriod}>
                <Plus size={15} /> {t('initiatives.planScenario.workbench.addPeriod')}
              </button>
            </div>
          </fieldset>
          <fieldset className="mb-4 rounded-md border border-c-border p-3">
            <legend className="px-1 text-sm font-medium">
              {t('initiatives.planScenario.workbench.initiativeScope')}
            </legend>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="text-xs">
                {t('initiatives.planScenario.workbench.initiativeStatus')}
                <select
                  aria-label={t('initiatives.planScenario.workbench.initiativeStatusFilterAria')}
                  className="mt-1 block min-w-48 bg-c-surface p-2"
                  value={initiativeLifecycleFilter}
                  onChange={(event) => setInitiativeLifecycleFilter(event.target.value)}
                >
                  <option value="ALL">{t('initiatives.planScenario.workbench.allStatuses')}</option>
                  {lifecycleOptions.map((lifecycle) => (
                    <option key={lifecycle} value={lifecycle}>
                      {lifecycle}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-xs text-c-text-muted">
                {t('initiatives.planScenario.workbench.inPlanCount', {
                  count: draft.windows.length,
                  total: initiatives.length,
                })}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {selectableInitiatives.map((initiative) => {
                const included = draft.windows.some(
                  (window) => window.initiativeId === initiative.id
                );
                return (
                  <label
                    key={initiative.id}
                    className="flex cursor-pointer items-start gap-2 rounded border border-c-border p-2"
                  >
                    <input
                      aria-label={t('initiatives.planScenario.workbench.includeAria', {
                        name: initiative.name,
                      })}
                      type="checkbox"
                      checked={included}
                      onChange={() =>
                        included ? removeWindow(initiative.id) : addWindow(initiative.id)
                      }
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{initiative.name}</span>
                      <span className="block text-xs text-c-text-muted">
                        {initiative.lifecycle ||
                          t('initiatives.planScenario.workbench.statusUnknown')}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <section
            aria-label={t('initiatives.planScenario.workbench.timelineAria')}
            className="mb-4 rounded-md border border-c-border p-3"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-medium">
                  {t('initiatives.planScenario.workbench.timelineTitle')}
                </h4>
                <p className="text-xs text-c-text-muted">
                  {t('initiatives.planScenario.workbench.timelineHint')}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table /* §27-exempt: macierz przypisań inicjatywa × okres (interaktywny grid klik-przypisz), nie ekran listowy — kanoniczna lista okien planu renderuje się niżej przez StandardTable; docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md §3 */
                className="min-w-max border-collapse text-xs"
              >
                <thead>
                  <tr className="border-b border-c-border">
                    <th scope="col" className="min-w-60 p-2 text-left font-medium">
                      {t('initiatives.planScenario.columns.initiative')}
                    </th>
                    {draft.periods.map((period) => (
                      <th
                        key={period.periodId}
                        scope="col"
                        className="min-w-28 border-l border-c-border p-2 text-center"
                      >
                        <span className="block font-medium">{period.periodId}</span>
                        <span className="text-c-text-muted">
                          {formatDate(period.start)}–{formatDate(period.end)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {draft.windows.map((window) => {
                    const activePeriod = draft.periods.findIndex(
                      (period) =>
                        window.target && window.target >= period.start && window.target < period.end
                    );
                    const initiativeName =
                      initiatives.find((initiative) => initiative.id === window.initiativeId)
                        ?.name ?? window.initiativeId;
                    return (
                      <tr
                        key={window.initiativeId}
                        className="border-b border-c-border last:border-b-0"
                      >
                        <th scope="row" className="min-w-60 p-2 text-left font-normal">
                          <span className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-medium">
                              {initiativeName}
                            </span>
                            <span className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                className="btn-ghost p-1"
                                aria-label={t('initiatives.planScenario.workbench.moveLeftAria', {
                                  name: initiativeName,
                                })}
                                disabled={activePeriod === 0}
                                onClick={() => moveWindowAcrossPeriods(window.initiativeId, -1)}
                              >
                                ←
                              </button>
                              <button
                                type="button"
                                className="btn-ghost p-1"
                                aria-label={t('initiatives.planScenario.workbench.moveRightAria', {
                                  name: initiativeName,
                                })}
                                disabled={activePeriod === draft.periods.length - 1}
                                onClick={() => moveWindowAcrossPeriods(window.initiativeId, 1)}
                              >
                                →
                              </button>
                            </span>
                          </span>
                        </th>
                        {draft.periods.map((period, periodIndex) => {
                          const active = activePeriod === periodIndex;
                          return (
                            <td
                              key={period.periodId}
                              className="min-w-28 border-l border-c-border p-0"
                            >
                              <button
                                type="button"
                                aria-label={t('initiatives.planScenario.workbench.assignAria', {
                                  name: initiativeName,
                                  period: period.periodId,
                                })}
                                aria-pressed={active}
                                className={`min-h-12 w-full p-2 text-xs transition ${
                                  active
                                    ? 'bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950'
                                    : 'bg-c-surface hover:bg-c-surface-raised'
                                }`}
                                onClick={() =>
                                  assignWindowToPeriod(window.initiativeId, periodIndex)
                                }
                              >
                                {active
                                  ? t(planConfidenceKey[window.confidence] ?? window.confidence)
                                  : '—'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {!draft.windows.length && (
                    <tr>
                      <td
                        colSpan={draft.periods.length + 1}
                        className="p-4 text-sm text-c-text-muted"
                      >
                        {t('initiatives.planScenario.workbench.noWindowsSelected')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {!knownTimeBasis(draft) && (
            <p role="alert" className="mb-4 text-sm text-c-danger">
              {t('initiatives.planScenario.workbench.unknownTimeBasis')}
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="overflow-x-auto">
              <StandardTable
                persistKey="initiatives.plan-workbench-windows.v1"
                data={draft.windows.map((window, index) => ({
                  ...window,
                  id: window.initiativeId,
                  order: index,
                }))}
                empty={{ title: t('initiatives.planScenario.workbench.noInitiativesInPlan') }}
                columns={[
                  {
                    id: 'order',
                    label: t('initiatives.planScenario.workbench.orderSnapshotColumn'),
                    render: (row) => {
                      const window = row as WindowDraft & TableRow & { order: number };
                      const index = window.order;
                      return (
                        <div className="p-2">
                          <div className="flex gap-1">
                            <button
                              aria-label={t('initiatives.planScenario.workbench.moveUpAria', {
                                id: window.initiativeId,
                              })}
                              type="button"
                              onClick={() => move(index, -1)}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              aria-label={t('initiatives.planScenario.workbench.moveDownAria', {
                                id: window.initiativeId,
                              })}
                              type="button"
                              onClick={() => move(index, 1)}
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                          {initiatives.find((item) => item.id === window.initiativeId)?.name ??
                            window.initiativeId}
                          <input
                            aria-label={t(
                              'initiatives.planScenario.workbench.initiativeVersionAria',
                              {
                                id: window.initiativeId,
                              }
                            )}
                            className="mt-1 block w-20 bg-c-surface p-1"
                            type="number"
                            min={1}
                            value={window.initiativeVersion}
                            onChange={(e) =>
                              updateWindow(window.initiativeId, {
                                initiativeVersion: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      );
                    },
                  },
                  {
                    id: 'target',
                    label: t('initiatives.planScenario.workbench.draftWindowColumn'),
                    render: (row) => {
                      const window = row as WindowDraft & TableRow;
                      return (
                        <div className="p-2">
                          {(['earliest', 'target', 'latest'] as const).map((key) => (
                            <input
                              key={key}
                              aria-label={t(
                                `initiatives.planScenario.workbench.windowFieldAria.${key}`,
                                { id: window.initiativeId }
                              )}
                              className="mb-1 block bg-c-surface p-1"
                              type="datetime-local"
                              value={toInput(window[key])}
                              onChange={(e) =>
                                updateWindow(window.initiativeId, { [key]: toIso(e.target.value) })
                              }
                            />
                          ))}
                        </div>
                      );
                    },
                  },
                  {
                    id: 'confidence',
                    label: t('initiatives.planScenario.workbench.confidenceRationaleColumn'),
                    render: (row) => {
                      const window = row as WindowDraft & TableRow;
                      return (
                        <div>
                          <select
                            aria-label={t('initiatives.planScenario.workbench.confidenceAria', {
                              id: window.initiativeId,
                            })}
                            value={window.confidence}
                            onChange={(e) =>
                              updateWindow(window.initiativeId, {
                                confidence: e.target.value as WindowDraft['confidence'],
                              })
                            }
                          >
                            {/* Wartość zapisywana zostaje angielska (kontrakt
                                backendu), tłumaczy się wyłącznie etykieta opcji. */}
                            {(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH'] as const).map((level) => (
                              <option key={level} value={level}>
                                {t(planConfidenceKey[level] ?? level)}
                              </option>
                            ))}
                          </select>
                          <textarea
                            aria-label={t('initiatives.planScenario.workbench.rationaleAria', {
                              id: window.initiativeId,
                            })}
                            className="mt-1 block bg-c-surface p-1"
                            value={window.rationale}
                            onChange={(e) =>
                              updateWindow(window.initiativeId, { rationale: e.target.value })
                            }
                          />
                        </div>
                      );
                    },
                  },
                  {
                    id: 'dependencySnapshot',
                    label: t('initiatives.planScenario.columns.dependencies'),
                    render: (row) => {
                      const window = row as WindowDraft & TableRow;
                      return (
                        <textarea
                          aria-label={t('initiatives.planScenario.workbench.dependenciesAria', {
                            id: window.initiativeId,
                          })}
                          className="bg-c-surface p-1"
                          value={window.dependencySnapshot.join('\n')}
                          onChange={(e) =>
                            updateWindow(window.initiativeId, {
                              dependencySnapshot: e.target.value
                                .split('\n')
                                .map((v) => v.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      );
                    },
                  },
                  {
                    id: 'constraintSnapshot',
                    label: t('initiatives.planScenario.workbench.constraintsColumn'),
                    render: (row) => {
                      const window = row as WindowDraft & TableRow;
                      return (
                        <div>
                          {window.constraintSnapshot.map((constraint) => (
                            <div key={constraint.constraintId} className="text-xs">
                              {/* ta sama mapa co w kolumnach — bez niej w tej samej
                                  sekcji zostawało gołe „UNKNOWN:" */}
                              {t(planReadinessStateKey[constraint.state] ?? constraint.state)}:{' '}
                              {constraint.detail}
                            </div>
                          ))}
                          <button
                            type="button"
                            className="btn-secondary mt-1"
                            onClick={() =>
                              updateWindow(window.initiativeId, {
                                constraintSnapshot: [
                                  ...window.constraintSnapshot,
                                  {
                                    constraintId: crypto.randomUUID(),
                                    state: 'UNKNOWN',
                                    detail: t(
                                      'initiatives.planScenario.workbench.defaultConstraintDetail'
                                    ),
                                  },
                                ],
                              })
                            }
                          >
                            {t('initiatives.planScenario.workbench.addConstraint')}
                          </button>
                        </div>
                      );
                    },
                  },
                ]}
              />
            </div>
            <aside className="space-y-3">
              <h4 className="font-medium">
                {t('initiatives.planScenario.aside.assumptionsAndChanges')}
              </h4>
              {analysisProposal && (
                <section
                  aria-label={t('initiatives.planScenario.aside.analysisProposalAria')}
                  className="rounded-md border border-c-border p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium">
                      {t('initiatives.planScenario.aside.analysisProposalTitle')}
                    </h4>
                    <span>{analysisProposal.status}</span>
                  </div>
                  <p className="mt-2 text-c-text-muted">
                    {t('initiatives.planScenario.aside.analysisInput', {
                      scenarioVersion: analysisProposal.inputScenarioVersion,
                      aggregateVersion: analysisProposal.inputAggregateVersion,
                    })}
                  </p>
                  <p className="mt-2">{analysisProposal.rationale}</p>
                  <p className="mt-2">
                    {t('initiatives.planScenario.aside.changesAndConflicts', {
                      changes: analysisProposal.changes.length,
                      conflicts: analysisProposal.conflicts.length,
                    })}
                  </p>
                  {analysisProposal.conflicts.map((conflict) => (
                    <p key={conflict} className="mt-1 text-c-danger">
                      {conflict}
                    </p>
                  ))}
                  {analysisProposal.status === 'PENDING_REVIEW' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void reviewAnalysis('ACCEPT')}
                      >
                        {t('initiatives.planScenario.aside.applyToDraft')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void reviewAnalysis('REJECT')}
                      >
                        {t('initiatives.planScenario.aside.rejectProposal')}
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-c-text-muted">
                    {t('initiatives.planScenario.aside.saveAndPublishSeparate')}
                  </p>
                </section>
              )}
              {analysisState === 'ERROR' && (
                <p role="alert" className="text-xs text-c-danger">
                  {t('initiatives.planScenario.aside.analysisFailed')}
                </p>
              )}
              <label className="block text-xs">
                {t('initiatives.planScenario.aside.assumptions')}
                <textarea
                  aria-label={t('initiatives.planScenario.aside.assumptionsAria')}
                  className="mt-1 min-h-24 w-full bg-c-surface p-2"
                  value={draft.assumptions.join('\n')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      assumptions: e.target.value
                        .split('\n')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <section aria-label={t('initiatives.planScenario.aside.diffAria')}>
                <h4 className="font-medium">
                  {t('initiatives.planScenario.aside.compareVersions')}
                </h4>
                {history.length < 2 ? (
                  <p className="mt-1 text-xs text-c-text-muted">
                    {t('initiatives.planScenario.aside.compareUnavailable')}
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-xs">
                      {t('initiatives.planScenario.aside.baseVersion')}
                      <select
                        aria-label={t('initiatives.planScenario.aside.baseVersionAria')}
                        className="mt-1 block w-full bg-c-surface p-1"
                        value={compareFrom ?? ''}
                        onChange={(event) => setCompareFrom(Number(event.target.value))}
                      >
                        {history.map((version) => (
                          <option key={version.scenarioVersion} value={version.scenarioVersion}>
                            v{version.scenarioVersion} · {t(planStatusKey[version.status])}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs">
                      {t('initiatives.planScenario.aside.comparedVersion')}
                      <select
                        aria-label={t('initiatives.planScenario.aside.comparedVersionAria')}
                        className="mt-1 block w-full bg-c-surface p-1"
                        value={compareTo ?? ''}
                        onChange={(event) => setCompareTo(Number(event.target.value))}
                      >
                        {history.map((version) => (
                          <option key={version.scenarioVersion} value={version.scenarioVersion}>
                            v{version.scenarioVersion} · {t(planStatusKey[version.status])}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn-secondary col-span-2"
                      disabled={
                        compareState === 'LOADING' ||
                        compareFrom === null ||
                        compareTo === null ||
                        compareFrom === compareTo
                      }
                      onClick={() => void compareVersions()}
                    >
                      {compareState === 'LOADING' ? (
                        <Loader2 className="animate-spin" size={15} />
                      ) : (
                        <Eye size={15} />
                      )}{' '}
                      {t('initiatives.planScenario.aside.compareVersionsAction')}
                    </button>
                  </div>
                )}
                {compareState === 'ERROR' && (
                  <p role="alert" className="mt-2 text-xs text-c-danger">
                    {t('initiatives.planScenario.aside.compareFailed')}
                  </p>
                )}
                <h5 className="mt-3 text-xs font-medium">
                  {t('initiatives.planScenario.aside.changesCount', { count: diff.length })}
                </h5>
                {history.length >= 2 && compareState === 'IDLE' && diff.length === 0 && (
                  <p className="mt-1 text-xs text-c-text-muted">
                    {t('initiatives.planScenario.aside.noDiff')}
                  </p>
                )}
                {diff.map((change) => (
                  <div
                    key={change.initiativeId}
                    className="mt-1 rounded border border-c-border p-2 text-xs"
                  >
                    {change.initiativeId}: {change.before?.target ?? '—'} →{' '}
                    {change.after?.target ?? '—'}
                  </div>
                ))}
              </section>
              <p className="text-xs text-c-text-muted">
                {t('initiatives.planScenario.aside.moveNote')}
              </p>
            </aside>
          </div>
        </section>
      )}
      {publicationConfirmationDialog}
    </section>
  );
};

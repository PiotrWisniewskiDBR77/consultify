import { AlertTriangle, Eye, Loader2, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { seedDefaultHiddenColumns } from '@/components/shared/ModuleHub/defaultHiddenColumns';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { resolveBusinessDisplayLabel } from '@/components/shared/PreviewPane/businessDisplayLabel';
import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableRow } from '@/components/standard/StandardTable';
import {
  memberNameOrUnknown,
  useOrganizationMemberNames,
  type MemberNameResolver,
} from '@/hooks/useOrganizationMemberNames';
import i18n from '@/i18n';
import { capacityUnitLabel } from '@/labels/capacityUnitLabels';
import {
  acceptResourceCommitment,
  decideResourceCommitment,
  listCapacityOptions,
  listCapacityScenarioRegister,
  listPlanScenarioRegister,
  proposeCapacityOptions,
  readCapacityScenario,
  requestResourceCommitment,
  RuntimeApiError,
  selectCapacityOption,
  writeCapacityScenario,
  computeCapacityScenario,
  createPlanAnalysisProposal,
  readPlanScenario,
  writePlanScenario,
} from '@/services/initiatives-execution/runtimeApi';

import type { CanonicalMenu3Contract } from './canonicalMenu3';
import { CapacityOptionsPanel, type CapacityComparison } from './CapacityOptionsPanel';
import { CapacityAnalysisCard } from './cards/CapacityAnalysisCard';

type K = 'KNOWN' | 'ESTIMATED' | 'UNKNOWN' | 'UNCONFIRMED';
// 2026-09-03 (i18n-r3): te były Record<K,string> ze stałą wartością PL —
// pokazywały się identycznie w trybie EN. Zamiana na funkcje wołające
// i18n.t() (moduł poza komponentem, nie hook) naprawia to bez ruszania
// wywołań w JSX (`knowledgeLabel[x]` → `knowledgeLabel(x)`).
const knowledgeLabel = (value: K): string =>
  ({
    KNOWN: i18n.t('initiatives.capacityAdvisor.knowledge.known'),
    ESTIMATED: i18n.t('initiatives.capacityAdvisor.knowledge.estimated'),
    UNKNOWN: i18n.t('initiatives.capacityAdvisor.knowledge.unknown'),
    UNCONFIRMED: i18n.t('initiatives.capacityAdvisor.knowledge.unconfirmed'),
  })[value];
const confidenceLabel = (value: string): string | undefined =>
  ({
    HIGH: i18n.t('initiatives.capacityAdvisor.confidence.high'),
    MEDIUM: i18n.t('initiatives.capacityAdvisor.confidence.medium'),
    LOW: i18n.t('initiatives.capacityAdvisor.confidence.low'),
    UNKNOWN: i18n.t('initiatives.capacityAdvisor.knowledge.unknown'),
  })[value];
const scenarioStateLabel = (value: string): string | undefined =>
  ({
    DRAFT: i18n.t('initiatives.planScenario.status.draft'),
    PUBLISHED: i18n.t('initiatives.planScenario.status.published'),
    SUPERSEDED: i18n.t('initiatives.planScenario.status.superseded'),
  })[value];
const rowKindLabel = (value: string): string | undefined =>
  ({
    PERIOD: i18n.t('initiatives.capacityAdvisor.rowKind.period'),
    CONSTRAINT: i18n.t('initiatives.capacityAdvisor.rowKind.constraint'),
  })[value];
const criticalityLabel = (value: string): string | undefined =>
  ({
    KNOWN: i18n.t('initiatives.capacityAdvisor.criticality.assessed'),
    UNKNOWN: i18n.t('initiatives.capacityAdvisor.criticality.toAssess'),
  })[value];
// Odbiór grafiki 07-realizacja (2026-08-30): kilka kolumn tabeli obciążenia
// (demand/supply/gap/saturation/affectedInitiatives/freshness/proposedResponse)
// dla wierszy typu CONSTRAINT nie mają jeszcze realnych danych i renderowały
// surowy token stanu ('UNKNOWN'/'KNOWN') wprost — znany defekt "surowe enumy
// zamiast etykiet". Ta funkcja tłumaczy WYŁĄCZNIE ten token (prefiks złożonych
// napisów typu "UNKNOWN — brak pełnego zakresu" też), nie rusza już
// sformatowanych wartości (liczby, zakresy, daty).
const knowledgeStates: K[] = ['KNOWN', 'ESTIMATED', 'UNKNOWN', 'UNCONFIRMED'];
const renderKnowledgeToken = (value: unknown): React.ReactNode => {
  if (typeof value !== 'string') return value as React.ReactNode;
  if ((knowledgeStates as string[]).includes(value)) return knowledgeLabel(value as K);
  const composedMatch = value.match(/^(KNOWN|UNKNOWN|ESTIMATED|UNCONFIRMED)\b(.*)$/);
  if (composedMatch) return `${knowledgeLabel(composedMatch[1] as K)}${composedMatch[2]}`;
  return value;
};
const actorLabel = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)
    ? i18n.t('initiatives.capacityAdvisor.resourceOwnerFallback')
    : ({
        'resource-manager': 'Resource Manager',
        'capacity-owner': 'Właściciel obciążenia',
        'controls-engineer': 'Controls Engineer',
        'role:controls-engineer': 'Controls Engineer',
      }[value] ?? value.replace(/^role:/, '').replaceAll('-', ' '));
/**
 * P15-K6 (DEC-421): ZDANIE DECYZJI zapisywane z wyborem wariantu. To ono
 * ląduje w „Decyzjach" karty analizy — musi mówić, CO wybrano, nie pokazywać
 * surowego `RESEQUENCE`.
 */
export const variantDecisionNote = (
  kind: 'RESEQUENCE' | 'SCOPE_SPLIT' | 'ADD_CAPACITY',
  shiftPeriods: number | null
): string => {
  if (kind === 'RESEQUENCE')
    return shiftPeriods === null
      ? i18n.t(
          'initiatives.capacityAnalysis.decision.resequenceUnknown',
          'Resequence — the advisor found no feasible shift, the plan is unchanged.'
        )
      : i18n.t('initiatives.capacityAnalysis.decision.resequence', {
          defaultValue: 'Przesuń kolejność o {{periods}} okres(y) — propozycja do planu.',
          periods: shiftPeriods,
        });
  if (kind === 'SCOPE_SPLIT')
    return i18n.t(
      'initiatives.capacityAnalysis.decision.scopeSplit',
      'Podziel zakres — decyzja zapisana, plan bez zmian.'
    );
  return i18n.t(
    'initiatives.capacityAnalysis.decision.addCapacity',
    'Add capacity — decision recorded, the plan is unchanged.'
  );
};
const formatPeriodDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'UNKNOWN';
  // 2026-09-03 (i18n-r3): locale przybity na 'pl-PL' pokazywał polskie
  // skróty miesięcy nawet w trybie EN (ten sam kształt co defekt
  // public-booking-widget z rundy 03.09) — wzorzec przełączania:
  // OrganizationDecisionQualityPanel.tsx / ApprovalPatternManager.tsx.
  return new Intl.DateTimeFormat(i18n.language === 'pl' ? 'pl-PL' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};
type Range = {
  knowledgeState: K;
  low: number | null;
  base: number | null;
  high: number | null;
  sourceRef: string | null;
  sourceVersion: number | null;
  asOf: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  ownerId: string;
  reason: string | null;
};
type Scenario = {
  scenarioId: string;
  name?: string | null;
  scenarioVersion: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  planScenarioId: string;
  planScenarioVersion: number;
  windowUnit: string;
  timezone: string;
  periods: Array<{
    periodId: string;
    start: string;
    end: string;
    demand: Range;
    supply: Range;
    // P15-K5 (DEC-421): arkusz okres x rola liczony przez serwer (`/compute`).
    roles?: Array<{
      roleId: string;
      roleLabel: string;
      demand: number | null;
      supply: number | null;
      supplySource: 'RESOURCE_PLAN' | 'MANUAL' | 'UNKNOWN';
      demandSource: 'PLAN' | 'MANUAL' | 'UNKNOWN';
    }>;
  }>;
  constraints: Array<{ constraintId: string; state: K; detail: string; ownerId: string }>;
  proposedAssignments: Array<{
    assignmentId: string;
    initiativeId: string;
    resourceOrRoleId: string;
    periodIds: string[];
    demand: Range;
    rationale: string;
  }>;
  createdBy: string;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
};
interface Row extends TableRow {
  id: string;
  title: string;
  state: string;
  plan: string;
  window: string;
  knowledge: string;
  updatedAt: string;
  version: number;
  periods: number;
  roles: number;
  gaps: number;
}
interface CapacityRegisterItem {
  id: string;
  name: string;
  state: string;
  planRef: { scenarioId: string; scenarioVersion: number; name?: string | null };
  window: { start: string | null; end: string | null };
  knowledgeSummary: { known: number; estimated: number; unknown: number; unconfirmed: number };
  updatedAt: string;
  version: number;
  periodCount?: number;
  roleCount?: number;
  gapCount?: number;
}
interface PublishedPlanBasis {
  id: string;
  name: string;
  version: number;
  windowUnit: string;
  timezone: string;
  periods: Array<{ periodId: string; start: string; end: string }>;
}
export const CapacityScenarioSurface: React.FC<
  CanonicalMenu3Contract & {
    demoMode?: boolean;
    /** P15-K6: „→ plan vN (szkic)" wraca do zakładki Plan i otwiera tam kartę. */
    onOpenPlan?: (planScenarioId: string) => void;
    /** P15-K7 pkt 1: „Nowa analiza z tego planu" wchodzi tu z gotowym planem. */
    createPlanId?: string | null;
    /** Hub zeruje zadanie po skonsumowaniu — patrz efekt przy `showCreate`. */
    onCreateRequestConsumed?: () => void;
  }
> = ({
  activePreset,
  onCountsChange,
  createRequestId = 0,
  demoMode = false,
  onOpenPlan,
  createPlanId = null,
  onCreateRequestConsumed,
}) => {
  const { t } = useTranslation();
  // Katalog osób organizacji — patrz komentarz przy `RangeView` niżej.
  const resolveMemberName = useOrganizationMemberNames();
  const capacityAdvisorEnabled =
    String(import.meta.env.VITE_WAVE3_INITIATIVES_CAPACITY_ADVISOR).toLowerCase() === 'true';
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING'),
    [rows, setRows] = useState<Row[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [selectedConstraintId, setSelectedConstraintId] = useState<string | null>(null),
    [workspaceOpen, setWorkspaceOpen] = useState(false),
    [scenario, setScenario] = useState<Scenario | null>(null),
    [comparisons, setComparisons] = useState<CapacityComparison[]>([]),
    [publishedPlans, setPublishedPlans] = useState<PublishedPlanBasis[]>([]),
    [aggregateVersion, setAggregateVersion] = useState(0),
    [writeState, setWriteState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  // P15-K1 (DEC-421): kod reguly z odpowiedzi serwera zamiast jednego
  // zdania „Nie zapisano zmian." bez powodu.
  const [writeRule, setWriteRule] = useState<string | null>(null);
  const [advisorState, setAdvisorState] = useState<
    'IDLE' | 'SAVING' | 'APPLIED' | 'NO_PRESSURE' | 'NEEDS_PUBLISH' | 'CONFLICT' | 'FAILED'
  >('IDLE');
  /** P15-K6: wynik OSTATNIEGO wyboru wariantu — karta ma powiedzieć, co się stało. */
  const [variantOutcome, setVariantOutcome] = useState<'APPLIED' | 'NO_SHIFT' | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newAnalysisId, setNewAnalysisId] = useState('');
  const [newPlanId, setNewPlanId] = useState('');
  // Tozsamosc AKTUALNIE OTWARTEJ analizy — patrz komentarz w `load()`.
  const openScenarioId = useRef<string | null>(null);
  // Odbior nocny 08.09 (C02): `useRef(createRequestId)` startowal juz z nowa
  // wartoscia przy kazdym swiezym montazu (Plan -> Obciazenie odmontowuje ten
  // komponent), wiec „Nowa analiza z tego planu” z karty planu nigdy nie otwierala
  // formularza. Zadanie jest konsumowane raz i zerowane przez hub, wiec powrot na
  // zakladke nie otwiera formularza ponownie.
  useEffect(() => {
    if (!createRequestId) return;
    // P15-K7: plan przyniesiony z karty planu wypełnia formularz od razu.
    if (createPlanId) setNewPlanId(createPlanId);
    setShowCreate(true);
    onCreateRequestConsumed?.();
  }, [createRequestId, createPlanId, onCreateRequestConsumed]);
  const [nextInputKind, setNextInputKind] = useState<'MATERIAL_CHANGE' | 'SCHEDULE_DECISION'>(
    'MATERIAL_CHANGE'
  );

  // 97-czternascie-kolumn (2026-08-30): 13 kolumny danych + kolumna akcji nie
  // mieszczą się w typowym obszarze obciążenia (1334 px) nawet na podłodze
  // czytelności FilterableTable (`FIT_MIN_COLUMN_WIDTH`/`_PRIMARY`). Brak tu
  // dosłownej duplikacji jak w planie inicjatyw — chowamy więc trzy kolumny o
  // najniższej wartości domyślnej: proposedResponse jest ZAWSZE 'UNKNOWN'
  // (nieobliczane dla żadnego wiersza), a affectedInitiatives/freshness są
  // realne wyłącznie dla wierszy okresu i zawsze 'UNKNOWN' dla ograniczeń.
  // Pstryczek widoczności kolumn (FilterableTable) zostaje — użytkownik
  // włącza je sam. Musi wykonać się PRZED montażem <StandardTable> (guard w
  // ciele renderu, nie w useEffect) — patrz defaultHiddenColumns.ts.
  const capacityColumnsSeeded = useRef(false);
  if (!capacityColumnsSeeded.current) {
    seedDefaultHiddenColumns('initiatives.capacity-constraints.v2', [
      'proposedResponse',
      'affectedInitiatives',
      'freshness',
    ]);
    capacityColumnsSeeded.current = true;
  }

  const constraintRows = useMemo(() => {
    if (!scenario) return [];
    const formatRange = (range: Range) =>
      range.low == null || range.base == null || range.high == null
        ? range.knowledgeState
        : `${range.low}/${range.base}/${range.high} ${capacityUnitLabel(scenario.windowUnit, i18n.language.startsWith('pl'))}`;
    // 98-rola-zespol-duplikat (2026-08-30): kolumna „Rola / zespół” powtarzała
    // co do znaku kolumnę „Opiekun” dla wierszy okresu — obie brały
    // `period.supply.ownerId` i obie szły przez `actorLabel()`. To są jednak dwie
    // różne osie: opiekun to właściciel ŹRÓDŁA liczby (`CapacityRange.ownerId`,
    // walidator: „Capacity source owner”), a rola/zespół to CZYJEJ mocy okres
    // dotyczy. W `CapacityScenario` rolę nosi wyłącznie
    // `ProposedAssignment.resourceOrRoleId`, wiązany z okresem przez `periodIds`
    // (tego samego pola używa już panel przydziałów niżej). Brak przydziału dla
    // okresu = 'UNKNOWN', nie pusta komórka — brak danych nie oznacza zera.
    const rolesByPeriod = new Map<string, Set<string>>();
    for (const assignment of scenario.proposedAssignments) {
      if (!assignment.resourceOrRoleId?.trim()) continue;
      for (const periodId of assignment.periodIds) {
        const roles = rolesByPeriod.get(periodId) ?? new Set<string>();
        roles.add(assignment.resourceOrRoleId);
        rolesByPeriod.set(periodId, roles);
      }
    }
    const periods = scenario.periods.map((period) => ({
      id: `period:${period.periodId}`,
      title: period.periodId,
      kind: 'PERIOD',
      roleTeamSkill:
        [...(rolesByPeriod.get(period.periodId) ?? [])]
          .map((roleId) => actorLabel(roleId))
          .sort((a, b) => a.localeCompare(b, 'pl'))
          .join(' · ') || 'UNKNOWN',
      demand: formatRange(period.demand),
      demandState: period.demand.knowledgeState,
      supply: formatRange(period.supply),
      supplyState: period.supply.knowledgeState,
      gap:
        period.demand.base != null && period.supply.base != null
          ? period.supply.base - period.demand.base
          : 'UNKNOWN',
      saturation:
        period.demand.low != null &&
        period.demand.base != null &&
        period.demand.high != null &&
        period.supply.low != null &&
        period.supply.base != null &&
        period.supply.high != null &&
        period.supply.low > 0 &&
        period.supply.base > 0 &&
        period.supply.high > 0
          ? `${Math.round((period.demand.low / period.supply.high) * 100)}–${Math.round((period.demand.high / period.supply.low) * 100)}% (${i18n.t('initiatives.capacityAdvisor.saturationBaseline')} ${Math.round((period.demand.base / period.supply.base) * 100)}%)`
          : `UNKNOWN — ${i18n.t('initiatives.capacityAdvisor.saturationIncompleteRange')}`,
      confidence:
        period.demand.confidence === 'UNKNOWN' || period.supply.confidence === 'UNKNOWN'
          ? 'UNKNOWN'
          : period.demand.confidence,
      criticality:
        period.supply.knowledgeState === 'UNKNOWN' || period.demand.knowledgeState === 'UNKNOWN'
          ? 'UNKNOWN'
          : 'KNOWN',
      owner: period.supply.ownerId || 'UNKNOWN',
      affectedInitiatives: new Set(
        scenario.proposedAssignments
          .filter((assignment) => assignment.periodIds.includes(period.periodId))
          .map((assignment) => assignment.initiativeId)
      ).size,
      freshness: period.supply.asOf || period.demand.asOf || 'UNKNOWN',
      proposedResponse: 'UNKNOWN',
      detail: '',
    }));
    const constraints = scenario.constraints.map((constraint) => ({
      id: `constraint:${constraint.constraintId}`,
      title: constraint.constraintId,
      kind: 'CONSTRAINT',
      // Ograniczenie nie ma w domenie żadnego pola roli. Poprzednia wartość
      // ('Ograniczenie przekrojowe') powtarzała kolumnę „Rodzaj” i twierdziła coś,
      // czego w danych nie ma — w danych demo wręcz nieprawdę (`engineering-capacity`
      // dotyczy konkretnego zespołu, nie jest przekrojowe).
      roleTeamSkill: 'UNKNOWN',
      demand: 'UNKNOWN',
      demandState: 'UNKNOWN',
      supply: constraint.state,
      supplyState: constraint.state,
      gap: 'UNKNOWN',
      saturation: `UNKNOWN — ${i18n.t('initiatives.capacityAdvisor.saturationNotApplicable')}`,
      confidence: 'UNKNOWN',
      criticality: constraint.state === 'UNKNOWN' ? 'UNKNOWN' : 'KNOWN',
      owner: constraint.ownerId || 'UNKNOWN',
      affectedInitiatives: 'UNKNOWN',
      freshness: 'UNKNOWN',
      proposedResponse: 'UNKNOWN',
      detail: constraint.detail,
    }));
    return [...periods, ...constraints];
  }, [scenario, i18n.language]);
  const matchesCapacityPreset = (row: (typeof constraintRows)[number], preset: string) =>
    preset === 'all'
      ? true
      : preset === 'critical'
        ? row.criticality === 'UNKNOWN'
        : preset === 'unknown-supply'
          ? row.supplyState === 'UNKNOWN'
          : preset === 'missing-demand'
            ? row.demandState === 'UNKNOWN'
            : preset === 'unconfirmed'
              ? row.supplyState === 'UNCONFIRMED'
              : preset === 'resolved'
                ? row.criticality === 'KNOWN'
                : preset === 'skill-gaps'
                  ? /skill/i.test(row.detail)
                  : preset === 'management-load'
                    ? /management|manager/i.test(row.detail)
                    : preset === 'budget-envelope'
                      ? /budget|cost/i.test(row.detail)
                      : false;
  const visibleConstraintRows = constraintRows.filter((row) =>
    matchesCapacityPreset(
      row,
      ['drafts', 'published', 'gaps'].includes(activePreset) ? 'all' : activePreset || 'all'
    )
  );
  useEffect(() => {
    onCountsChange?.({
      drafts: rows.filter((row) => row.state === 'DRAFT').length,
      published: rows.filter((row) => row.state === 'PUBLISHED').length,
      gaps: rows.filter((row) => row.gaps > 0).length,
    });
  }, [rows, onCountsChange]);
  const [commitment, setCommitment] = useState({
    assignmentId: '',
    initiativeId: '',
    resourceManagerId: '',
    assigneeId: '',
    expiresAt: '',
    commitmentId: '',
    version: '1',
    conditions: '',
    rationale: '',
  });
  const [commitmentWrite, setCommitmentWrite] = useState<{
    state: 'IDLE' | 'PENDING' | 'APPLIED' | 'FAILED';
    message: string;
  }>({ state: 'IDLE', message: '' });
  const [commitmentEditorOpen, setCommitmentEditorOpen] = useState(false);
  const ids = useRef(new Map<string, string>());
  /**
   * P15-K5 (DEC-421): `silent` — odswiezenie rejestru BEZ przelaczania powierzchni
   * na galaz „ladowanie". Bez tego kazdy zapis z otwartej karty (podaz, wariant,
   * doradca) odmontowywal karte i wracal do pierwszej sekcji; uzytkownik tracil
   * miejsce, w ktorym byl. Zlapane okiem na zrzucie 07b (07.09).
   */
  const load = useCallback(async (silent = false) => {
    if (!silent) setState('LOADING');
    if (demoMode) {
      const range = (base: number, ownerId: string, state: K = 'ESTIMATED'): Range => ({
        knowledgeState: state,
        low: base - 2,
        base,
        high: base + 3,
        sourceRef: 'demo-capacity-workshop',
        sourceVersion: 1,
        asOf: '2026-08-23T09:00:00.000Z',
        confidence: state === 'KNOWN' ? 'HIGH' : 'MEDIUM',
        ownerId,
        reason: null,
      });
      const scenario: Scenario = {
        scenarioId: 'Atelier Capacity Baseline',
        scenarioVersion: 2,
        status: 'PUBLISHED',
        planScenarioId: 'Atelier Transformation Plan',
        planScenarioVersion: 2,
        windowUnit: 'FTE-month',
        timezone: 'Europe/Warsaw',
        periods: [
          {
            periodId: 'NOW · Sep–Oct',
            start: '2026-09-01T00:00:00.000Z',
            end: '2026-11-01T00:00:00.000Z',
            demand: range(18, 'Transformation Office'),
            supply: range(15, 'Resource Manager', 'KNOWN'),
          },
          {
            periodId: 'NEXT · Nov–Dec',
            start: '2026-11-01T00:00:00.000Z',
            end: '2027-01-01T00:00:00.000Z',
            demand: range(24, 'Transformation Office'),
            supply: range(17, 'Resource Manager'),
          },
          {
            periodId: 'LATER · Q1',
            start: '2027-01-01T00:00:00.000Z',
            end: '2027-04-01T00:00:00.000Z',
            demand: range(20, 'Transformation Office'),
            supply: range(19, 'Resource Manager', 'UNCONFIRMED'),
          },
        ],
        constraints: [
          {
            constraintId: 'Data engineering skill gap',
            state: 'KNOWN',
            detail: 'Two initiatives compete for the same senior data-engineering skill.',
            ownerId: 'Resource Manager',
          },
          {
            constraintId: 'Management load',
            state: 'ESTIMATED',
            detail: 'Operations leadership can sponsor at most three concurrent waves.',
            ownerId: 'COO',
          },
          {
            constraintId: 'Budget envelope',
            state: 'UNKNOWN',
            detail: 'Q1 external-services budget still requires confirmation.',
            ownerId: 'CFO',
          },
        ],
        proposedAssignments: [
          {
            assignmentId: 'assign-control-tower',
            initiativeId: 'demo-initiative-revenue-control-tower',
            resourceOrRoleId: 'role:controls-engineer',
            periodIds: ['NOW · Sep–Oct'],
            demand: range(6, 'Resource Manager'),
            rationale: 'Critical dependency for benefits tracking.',
          },
          {
            assignmentId: 'assign-procurement-ai',
            initiativeId: 'demo-initiative-procurement-ai-copilot',
            resourceOrRoleId: 'data-engineering-team',
            periodIds: ['NEXT · Nov–Dec'],
            demand: range(8, 'Resource Manager'),
            rationale: 'Sequence after master-data baseline.',
          },
        ],
        createdBy: 'demo',
        updatedBy: 'demo',
        publishedBy: 'owner-piotr',
        publishedAt: '2026-08-23T09:00:00.000Z',
      };
      const known = scenario.periods
        .flatMap((period) => [period.demand, period.supply])
        .filter((item) => item.knowledgeState === 'KNOWN').length;
      const estimated = scenario.periods
        .flatMap((period) => [period.demand, period.supply])
        .filter((item) => item.knowledgeState === 'ESTIMATED').length;
      const unconfirmed = scenario.periods
        .flatMap((period) => [period.demand, period.supply])
        .filter((item) => item.knowledgeState === 'UNCONFIRMED').length;
      setRows([
        {
          id: scenario.scenarioId,
          title: scenario.scenarioId,
          state: scenario.status,
          plan: `${scenario.planScenarioId} v${scenario.planScenarioVersion}`,
          window: `${scenario.periods[0].start} → ${scenario.periods[2].end}`,
          knowledge: `K ${known} · E ${estimated} · U 0 · UC ${unconfirmed}`,
          updatedAt: scenario.publishedAt || '',
          version: scenario.scenarioVersion,
          periods: scenario.periods.length,
          roles: new Set(scenario.proposedAssignments.map((item) => item.resourceOrRoleId)).size,
          gaps: scenario.periods.filter((period) => period.demand.base != null && period.supply.base != null && period.demand.base > period.supply.base).length,
        },
      ]);
      setSelectedId(scenario.scenarioId);
      setScenario(scenario);
      setAggregateVersion(2);
      setComparisons([]);
      setPublishedPlans([
        {
          id: scenario.planScenarioId,
          name: scenario.planScenarioId,
          version: scenario.planScenarioVersion,
          windowUnit: scenario.windowUnit,
          timezone: scenario.timezone,
          periods: scenario.periods.map(({ periodId, start, end }) => ({ periodId, start, end })),
        },
      ]);
      setNewPlanId(scenario.planScenarioId);
      setState('READY');
      return;
    }
    try {
      const [body, optionBody, planBody] = (await Promise.all([
        listCapacityScenarioRegister(),
        listCapacityOptions(),
        listPlanScenarioRegister(),
      ])) as [
        { scenarios?: CapacityRegisterItem[] },
        { items?: CapacityComparison[] },
        {
          scenarios?: Array<{
            id: string;
            name: string;
            state: string;
            version: number;
            timeBasis?: {
              windowUnit: string;
              timezone: string;
              periods: Array<{ periodId: string; start: string; end: string }>;
              knowledgeState: 'KNOWN' | 'UNKNOWN';
            };
          }>;
        },
      ];
      const nextRows = (body.scenarios ?? []).map((x) => ({
        id: x.id,
        title: resolveBusinessDisplayLabel({
          displayName: x.name,
          rawId: x.id,
          fallback: `${t('initiatives.capacityAnalysis.unnamed', 'Analiza bez nazwy')} · ${formatPeriodDate(x.updatedAt)}`,
        }),
        state: x.state,
        plan: `${resolveBusinessDisplayLabel({ displayName: x.planRef.name, rawId: x.planRef.scenarioId, fallback: t('initiatives.plan.unnamed', 'Plan bez nazwy') })} · v${x.planRef.scenarioVersion}`,
        window: `${x.window.start ?? '—'} → ${x.window.end ?? '—'}`,
        knowledge: `K ${x.knowledgeSummary.known} · E ${x.knowledgeSummary.estimated} · U ${x.knowledgeSummary.unknown} · UC ${x.knowledgeSummary.unconfirmed}`,
        updatedAt: x.updatedAt,
        version: x.version,
        periods: x.periodCount ?? 0,
        roles: x.roleCount ?? 0,
        gaps: x.gapCount ?? 0,
      }));
      setRows(nextRows);
      if (nextRows.length) {
        // P15-K5 (DEC-421): `load()` wybieral PIERWSZA opublikowana analize i
        // NADPISYWAL nia otwarta karte. Kazde odswiezenie rejestru w tle
        // (zapis podazy, wybor wariantu, doradca) podmienialo uzytkownikowi
        // dokument pod rekami — zlapane okiem na zrzucie 07b (07.09).
        const initial =
          nextRows.find((item) => item.id === openScenarioId.current) ??
          nextRows.find((item) => item.state === 'PUBLISHED') ??
          nextRows[0];
        setSelectedId(initial.id);
        const loaded = (await readCapacityScenario(initial.id)) as {
          version: number;
          scenario: Scenario;
        };
        setAggregateVersion(loaded.version);
        setScenario(loaded.scenario);
      }
      setComparisons(optionBody.items ?? []);
      const plans = (planBody.scenarios ?? [])
        .filter(
          (item) =>
            item.state === 'PUBLISHED' &&
            item.timeBasis?.knowledgeState === 'KNOWN' &&
            item.timeBasis.periods.length > 0
        )
        .map((item) => ({
          id: item.id,
          name: item.name,
          version: item.version,
          windowUnit: item.timeBasis!.windowUnit,
          timezone: item.timeBasis!.timezone,
          periods: item.timeBasis!.periods,
        }));
      setPublishedPlans(plans);
      setNewPlanId((current) => current || plans[0]?.id || '');
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, [demoMode]);
  useEffect(() => {
    void load();
  }, [load]);
  const open = async (id: string) => {
    openScenarioId.current = id;
    setSelectedId(id);
    setWorkspaceOpen(true);
    try {
      const body = (await readCapacityScenario(id)) as { version: number; scenario: Scenario };
      setAggregateVersion(body.version);
      setScenario(body.scenario);
      setWriteState('IDLE');
    } catch {
      setWriteState('FAILED');
    }
  };
  const showWorkspace = () => {
    if (scenario && selectedId) setWorkspaceOpen(true);
  };
  /**
   * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K5: „Nowa analiza" WYPELNIONA.
   * Do K4 ta funkcja skladala scenariusz w przegladarce z UNKNOWN na kazdym
   * okresie i zerem rol — karta otwierala sie pusta. Teraz woła `/compute`,
   * a arkusz okres x rola liczy serwer z planu i ze stanowisk osob.
   */
  const createAnalysis = async () => {
    const plan = publishedPlans.find((item) => item.id === newPlanId);
    const name = newAnalysisId.trim();
    if (!plan || !name || writeState === 'SAVING') return;
    const scenarioId = `capacity-${crypto.randomUUID()}`;
    setWriteRule(null);
    setWriteState('SAVING');
    try {
      const result = (await computeCapacityScenario(scenarioId, {
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
        operation: 'CREATE',
        planScenarioId: plan.id,
        name,
      })) as { aggregateVersion: number; response: Scenario };
      openScenarioId.current = scenarioId;
      setSelectedId(scenarioId);
      setAggregateVersion(result.aggregateVersion);
      setScenario(result.response);
      setShowCreate(false);
      setNewAnalysisId('');
      await load(true);
      await open(scenarioId);
      setWorkspaceOpen(true);
      setWriteState('IDLE');
    } catch (error) {
      setWriteRule(error instanceof RuntimeApiError ? (error.rule ?? null) : null);
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };
  /** Reczna korekta podazy w arkuszu — przeliczenie z zachowaniem wpisanej wartosci. */
  const overrideSupply = async (periodId: string, roleId: string, supply: number) => {
    if (!scenario || writeState === 'SAVING') return;
    setWriteRule(null);
    setWriteState('SAVING');
    try {
      const result = (await computeCapacityScenario(scenario.scenarioId, {
        expectedVersion: aggregateVersion,
        clientRequestId: crypto.randomUUID(),
        operation: 'UPDATE',
        planScenarioId: scenario.planScenarioId,
        supplyOverrides: [{ periodId, roleId, supply }],
      })) as { aggregateVersion: number; response: Scenario };
      setAggregateVersion(result.aggregateVersion);
      setScenario(result.response);
      await load(true);
      setWriteState('IDLE');
    } catch (error) {
      setWriteRule(error instanceof RuntimeApiError ? (error.rule ?? null) : null);
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };
  const commandId = (key: string) => {
    const value = ids.current.get(key) ?? crypto.randomUUID();
    ids.current.set(key, value);
    return value;
  };
  const write = async (operation: 'UPDATE' | 'PUBLISH') => {
    if (!scenario) return;
    setWriteRule(null);
    setWriteState('SAVING');
    try {
      await writeCapacityScenario(scenario.scenarioId, {
        expectedVersion: aggregateVersion,
        clientRequestId: commandId(`${scenario.scenarioId}:${aggregateVersion}:${operation}`),
        operation,
        scenario,
      });
      await open(scenario.scenarioId);
      await load(true);
      setWriteState('IDLE');
    } catch (e) {
      setWriteRule(e instanceof RuntimeApiError ? (e.rule ?? null) : null);
      setWriteState(e instanceof RuntimeApiError && e.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };
  const request = async () => {
    if (!scenario || scenario.status !== 'PUBLISHED' || commitmentWrite.state === 'PENDING') return;
    const c = commitment;
    const commitmentId = c.commitmentId || crypto.randomUUID();
    setCommitmentWrite({ state: 'PENDING', message: 'Requesting commitment…' });
    try {
      const receipt = (await requestResourceCommitment(commitmentId, {
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
        capacityScenarioId: scenario.scenarioId,
        capacityScenarioVersion: scenario.scenarioVersion,
        assignmentId: c.assignmentId,
        initiativeId: c.initiativeId,
        resourceManagerId: c.resourceManagerId,
        assigneeId: c.assigneeId,
        expiresAt: new Date(c.expiresAt).toISOString(),
      })) as { aggregateVersion?: number };
      const version = String(receipt.aggregateVersion ?? 1);
      setCommitment((value) => ({ ...value, commitmentId, version }));
      setCommitmentWrite({ state: 'APPLIED', message: `Commitment requested · v${version}` });
    } catch {
      setCommitmentWrite({ state: 'FAILED', message: 'Commitment request failed; retry.' });
    }
  };
  const accept = async () => {
    if (!commitment.commitmentId || commitmentWrite.state === 'PENDING') return;
    setCommitmentWrite({ state: 'PENDING', message: 'Recording assignee acceptance…' });
    try {
      const receipt = (await acceptResourceCommitment(commitment.commitmentId, {
        expectedVersion: Number(commitment.version),
        clientRequestId: crypto.randomUUID(),
      })) as { aggregateVersion?: number };
      const version = String(receipt.aggregateVersion ?? Number(commitment.version) + 1);
      setCommitment((value) => ({ ...value, version }));
      setCommitmentWrite({ state: 'APPLIED', message: `Assignee accepted · v${version}` });
    } catch {
      setCommitmentWrite({ state: 'FAILED', message: 'Assignee acceptance failed; retry.' });
    }
  };
  const decide = async (outcome: 'CONFIRMED' | 'CONDITIONALLY_CONFIRMED' | 'DECLINED') => {
    if (!commitment.commitmentId || commitmentWrite.state === 'PENDING') return;
    setCommitmentWrite({ state: 'PENDING', message: 'Recording resource-manager decision…' });
    try {
      const receipt = (await decideResourceCommitment(commitment.commitmentId, {
        expectedVersion: Number(commitment.version),
        clientRequestId: crypto.randomUUID(),
        outcome,
        conditions: commitment.conditions.split('\n').filter(Boolean),
        rationale: commitment.rationale,
        policyOverrideDecisionId: null,
      })) as { aggregateVersion?: number };
      const version = String(receipt.aggregateVersion ?? Number(commitment.version) + 1);
      setCommitment((value) => ({ ...value, version }));
      setCommitmentWrite({ state: 'APPLIED', message: `${outcome} · v${version}` });
      if (outcome === 'CONFIRMED') setCommitmentEditorOpen(false);
    } catch {
      setCommitmentWrite({ state: 'FAILED', message: 'Resource-manager decision failed; retry.' });
    }
  };
  /**
   * WYBÓR WARIANTU → NOWA WERSJA PLANU (P15-K6, DEC-421, §5 K6).
   *
   * POMIAR 07.09: `selectOption` tworzyło wyłącznie „kontrolowany wniosek"
   * (`nextGovernedInput`) — plan zostawał nietknięty, a PMO klikało „Przesuń
   * kolejność" i nie dostawało żadnego przesunięcia. Teraz:
   *   • „Przesuń kolejność" → (plan OPUBLIKOWANY: nowy SZKIC v+1 mechanizmem
   *     K3) → `analysis-proposals` z `capacityScenarioId` TEJ analizy i
   *     podpowiedzią przesunięcia (`hints`) → propozycja czeka w karcie PLANU;
   *   • „Podziel zakres" / „Dołóż moce" → sam wpis decyzji (opis + kto),
   *     bez zmiany planu — to decyzja do dalszej rozmowy, nie ruch w kalendarzu.
   */
  const selectOption = async (comparison: CapacityComparison, optionId: string) => {
    setWriteRule(null);
    setWriteState('SAVING');
    setVariantOutcome(null);
    const option = comparison.options.find((item) => item.optionId === optionId) ?? null;
    const shiftPeriods =
      option?.kind === 'RESEQUENCE' && option.impact.date.knowledgeState !== 'UNKNOWN'
        ? Math.max(1, Math.round(option.impact.date.base ?? 0))
        : null;
    try {
      let resultingPlanRef: {
        scenarioId: string;
        scenarioVersion: number;
        proposalId: string | null;
      } | null = null;
      if (option?.kind === 'RESEQUENCE' && shiftPeriods !== null) {
        const planId = comparison.planRef.scenarioId;
        const loaded = (await readPlanScenario(planId)) as {
          version: number;
          scenario: {
            scenarioId: string;
            status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
            scenarioVersion: number;
          } & Record<string, unknown>;
        };
        let planVersion = loaded.version;
        let scenarioVersion = loaded.scenario.scenarioVersion;
        if (loaded.scenario.status !== 'DRAFT') {
          // Mechanizm K3 „Utwórz nową wersję (szkic)": UPDATE opublikowanego
          // planu daje SZKIC v+1 z tą samą treścią. Plan opublikowany nie
          // przyjmuje propozycji (domena: „only a DRAFT Plan").
          const created = (await writePlanScenario(planId, {
            expectedVersion: planVersion,
            clientRequestId: crypto.randomUUID(),
            operation: 'UPDATE',
            portfolio: 'auto',
            scenario: loaded.scenario,
          })) as { aggregateVersion: number; response: { scenarioVersion: number } };
          planVersion = created.aggregateVersion;
          scenarioVersion = created.response.scenarioVersion;
        }
        const proposalId = `plan-analysis-${planId}-${crypto.randomUUID()}`;
        await createPlanAnalysisProposal(planId, proposalId, {
          expectedVersion: 0,
          clientRequestId: crypto.randomUUID(),
          scenarioId: planId,
          inputAggregateVersion: planVersion,
          useCapacity: true,
          capacityScenarioId: comparison.capacityRef.scenarioId,
          hints: option.affectedMemberships.map((membership) => ({
            initiativeId: membership.initiativeId,
            shiftPeriods,
          })),
        });
        resultingPlanRef = { scenarioId: planId, scenarioVersion, proposalId };
      }
      await selectCapacityOption(comparison.comparisonId, {
        expectedVersion: comparison.version,
        clientRequestId: commandId(
          `${comparison.comparisonId}:${comparison.version}:SELECT:${optionId}:${nextInputKind}`
        ),
        optionId,
        nextKind: nextInputKind,
        decisionNote: option ? variantDecisionNote(option.kind, shiftPeriods) : null,
        resultingPlanRef,
      });
      await load(true);
      setWriteState('IDLE');
      setVariantOutcome(
        option?.kind === 'RESEQUENCE' && shiftPeriods === null ? 'NO_SHIFT' : 'APPLIED'
      );
    } catch (error) {
      setWriteRule(error instanceof RuntimeApiError ? (error.rule ?? null) : null);
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };
  const proposeOptions = async () => {
    if (!scenario || advisorState === 'SAVING') return;
    const linkedPlan = publishedPlans.find(
      (plan) => plan.id === scenario.planScenarioId && plan.version === scenario.planScenarioVersion
    );
    // Cicha degradacja: do K4 ta funkcja po prostu WRACALA, gdy analiza byla
    // szkicem — uzytkownik klikal „Analizuj" i nic sie nie dzialo, bez slowa.
    if (scenario.status !== 'PUBLISHED' || !linkedPlan) {
      setAdvisorState('NEEDS_PUBLISH');
      return;
    }
    const existing = comparisons.find(
      (comparison) =>
        comparison.planRef.scenarioId === linkedPlan.id &&
        comparison.planRef.version === linkedPlan.version &&
        comparison.capacityRef.scenarioId === scenario.scenarioId
    );
    setAdvisorState('SAVING');
    try {
      await proposeCapacityOptions(existing?.comparisonId ?? `advisor-${scenario.scenarioId}`, {
        expectedVersion: existing?.version ?? 0,
        clientRequestId: crypto.randomUUID(),
        planRef: { scenarioId: linkedPlan.id, version: linkedPlan.version },
        capacityRef: { scenarioId: scenario.scenarioId, version: aggregateVersion },
      });
      await load(true);
      setAdvisorState('APPLIED');
    } catch (error) {
      if (error instanceof RuntimeApiError && error.code === 'NO_CAPACITY_PRESSURE_TO_RESOLVE') {
        setAdvisorState('NO_PRESSURE');
      } else if (error instanceof RuntimeApiError && error.status === 409) {
        setAdvisorState('CONFLICT');
      } else {
        setAdvisorState('FAILED');
      }
    }
  };
  if (state === 'LOADING')
    return (
      <div role="status" className="p-6">
        <Loader2 className="inline animate-spin" size={16} />{' '}
        {t('initiatives.capacityAdvisor.loading', 'Loading Capacity register…')}
      </div>
    );
  if (state === 'ERROR')
    return (
      <div role="alert" className="p-6 text-c-danger">
        <AlertTriangle className="inline" size={16} />{' '}
        {t(
          'initiatives.capacityAdvisor.unavailable',
          'Capacity register unavailable. No local shadow was created.'
        )}{' '}
        <button className="btn-secondary" onClick={() => void load()}>
          {t('initiatives.capacityAdvisor.retry', 'Retry')}
        </button>
      </div>
    );
  if (workspaceOpen && scenario) {
    return (
      <CapacityAnalysisCard
        scenario={scenario}
        noPressure={advisorState === 'NO_PRESSURE'}
        needsPublish={advisorState === 'NEEDS_PUBLISH'}
        comparisons={comparisons.filter(
          (comparison) => comparison.capacityRef.scenarioId === scenario.scenarioId
        )}
        planName={
          publishedPlans.find((plan) => plan.id === scenario.planScenarioId)?.name ?? null
        }
        advisorBusy={advisorState === 'SAVING'}
        supplyBusy={writeState === 'SAVING'}
        onBack={() => {
          openScenarioId.current = null;
          setWorkspaceOpen(false);
        }}
        onAnalyze={() => void proposeOptions()}
        onPublish={() => void write('PUBLISH')}
        onSupplyOverride={(periodId, roleId, supply) =>
          void overrideSupply(periodId, roleId, supply)
        }
        onSelectOption={(comparison, optionId) => void selectOption(comparison, optionId)}
        onOpenPlan={onOpenPlan}
        variantOutcome={variantOutcome}
      />
    );
  }
  if (!workspaceOpen && !showCreate) {
    const visibleAnalyses = rows.filter((row) =>
      activePreset === 'drafts'
        ? row.state === 'DRAFT'
        : activePreset === 'published'
          ? row.state === 'PUBLISHED'
          : activePreset === 'gaps'
            ? row.gaps > 0
            : true
    );
    const selectedAnalysis = visibleAnalyses.find((row) => row.id === selectedId) ?? null;
    return (
      <section aria-label={t('initiatives.capacityAnalysis.listAria', 'Workload analyses list')} className="h-full min-h-0">
        <TableWithPreviewLayout<Row>
          selectedId={selectedId}
          selectedItem={selectedAnalysis}
          onSelect={setSelectedId}
          onOpenFull={(id) => void open(id)}
          itemIds={visibleAnalyses.map((row) => row.id)}
          getItemById={(id) => visibleAnalyses.find((row) => row.id === id) ?? null}
          previewOpen={Boolean(selectedAnalysis)}
          renderPreview={(row) => (
            <StandardPreview
              embedded title={row.title} onClose={() => setSelectedId(null)} onOpenFull={() => void open(row.id)}
              meta={{ pills: [{ label: scenarioStateLabel(row.state) ?? t('common.unknown', 'unknown'), tone: 'neutral' }] }}
              details={{ properties: [
                { id: 'plan', label: t('initiatives.capacityAnalysis.columns.sourcePlan', 'Source plan'), value: row.plan },
                { id: 'periods', label: t('initiatives.capacityAnalysis.columns.periods', 'Okresy'), value: String(row.periods) },
                { id: 'roles', label: t('initiatives.capacityAnalysis.columns.roles', 'Role'), value: String(row.roles) },
                { id: 'gaps', label: t('initiatives.capacityAnalysis.columns.gaps', 'Luki'), value: row.gaps ? String(row.gaps) : t('common.none', 'none') },
              ] }}
            />
          )}
        >
          <StandardTable
            columns={[
              { id: 'title', label: t('initiatives.capacityAnalysis.columns.name', 'Nazwa'), sortable: true },
              { id: 'plan', label: t('initiatives.capacityAnalysis.columns.sourcePlan', 'Source plan'), sortable: true },
              { id: 'periods', label: t('initiatives.capacityAnalysis.columns.periods', 'Okresy'), sortable: true },
              { id: 'roles', label: t('initiatives.capacityAnalysis.columns.roles', 'Role'), sortable: true },
              { id: 'gaps', label: t('initiatives.capacityAnalysis.columns.gaps', 'Luki'), sortable: true, render: (row) => row.gaps ? row.gaps : t('common.none', 'none') },
              { id: 'state', label: t('common.status', 'Status'), render: (row) => scenarioStateLabel(row.state) ?? t('common.unknown', 'unknown') },
              { id: 'updatedAt', label: t('initiatives.capacityAnalysis.columns.updatedAt', 'Zaktualizowano'), render: (row) => formatPeriodDate(row.updatedAt) },
            ]}
            data={visibleAnalyses}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(String(row.id))}
            onRowDoubleClick={(row) => void open(String(row.id))}
          />
        </TableWithPreviewLayout>
      </section>
    );
  }
  return (
    <section aria-label="Capacity scenarios" className="flex h-full min-h-0 flex-col p-4">
      <header className="mb-3">
        <h2 className="font-semibold">{t('initiatives.capacityAdvisor.header', 'Load')}</h2>
        <p className="text-xs text-c-text-muted">
          {t(
            'initiatives.capacityAdvisor.subtitle',
            'Ranges show the state of knowledge and evidence, not false precision of resource utilization.'
          )}
        </p>
      </header>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowCreate((open) => !open)}
        >
          <Plus size={15} /> {t('initiatives.capacityAdvisor.newAnalysis', 'New analysis')}
        </button>
      </div>
      {showCreate && (
        <div className="mb-3 flex flex-wrap items-end gap-3 rounded border border-c-border p-3">
          <label className="text-xs">
            {t('initiatives.capacityAnalysis.createForm.nameLabel', 'Analysis name')}
            <input
              aria-label="Capacity analysis name"
              className="mt-1 block rounded border border-c-border bg-c-surface p-2"
              value={newAnalysisId}
              onChange={(event) => setNewAnalysisId(event.target.value)}
              placeholder={t('initiatives.capacityAnalysis.createForm.namePlaceholder', 'e.g. Baseline plan — load v1')}
            />
          </label>
          <label className="text-xs">
            {t('initiatives.capacityAnalysis.createForm.sourcePlanLabel', 'Published source plan')}
            <select
              aria-label="Capacity source plan"
              className="mt-1 block rounded border border-c-border bg-c-surface p-2"
              value={newPlanId}
              onChange={(event) => setNewPlanId(event.target.value)}
            >
              {publishedPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · v{plan.version}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={!newAnalysisId.trim() || !newPlanId || writeState === 'SAVING'}
            onClick={() => void createAnalysis()}
          >
            {t('initiatives.capacityAnalysis.createForm.create', 'Create analysis')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
            {t('common.cancel', 'Cancel')}
          </button>
          {publishedPlans.length === 0 && (
            <p className="w-full text-xs text-c-warning">
              {t('initiatives.capacityAnalysis.createForm.noPublishedPlan', 'No published plan with a confirmed timeline. Publish a plan first.')}
            </p>
          )}
        </div>
      )}
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
        <label className="w-full min-w-0 text-xs text-c-text-muted sm:w-auto">
          {t('initiatives.capacityAdvisor.activeScenario', 'Active capacity scenario')}
          <select
            aria-label="Active Capacity Scenario"
            className="mt-1 block w-full min-w-0 max-w-full rounded border border-c-border bg-c-surface px-2 py-1 text-sm sm:ml-2 sm:mt-0 sm:inline-block sm:w-auto"
            value={selectedId ?? ''}
            onChange={(event) => {
              const id = event.target.value;
              setSelectedConstraintId(null);
              setWorkspaceOpen(false);
              void open(id).then(() => setWorkspaceOpen(false));
            }}
          >
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title} · {scenarioStateLabel(row.state) ?? row.state} · v{row.version}
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
          <Eye size={15} /> {t('initiatives.capacityAdvisor.openTools', 'Open load tools')}
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
        <TableWithPreviewLayout<(typeof constraintRows)[number]>
        selectedId={selectedConstraintId}
        selectedItem={visibleConstraintRows.find((row) => row.id === selectedConstraintId) ?? null}
        onSelect={setSelectedConstraintId}
        onOpenFull={showWorkspace}
        itemIds={visibleConstraintRows.map((row) => row.id)}
        getItemById={(id) => visibleConstraintRows.find((row) => row.id === id) ?? null}
        previewOpen={!workspaceOpen && Boolean(selectedConstraintId)}
        renderPreview={(row) => (
          <StandardPreview
            embedded
            title={row.title}
            onClose={() => setSelectedConstraintId(null)}
            onOpenFull={showWorkspace}
            openLabel={t('initiatives.capacityAdvisor.openTools', 'Open load tools')}
            meta={{
              pills: [
                { label: rowKindLabel(row.kind) ?? row.kind, tone: 'neutral' },
                { label: criticalityLabel(row.criticality) ?? row.criticality, tone: 'neutral' },
                { label: confidenceLabel(row.confidence) ?? row.confidence, tone: 'neutral' },
              ],
              trailing: <span>{actorLabel(row.owner)}</span>,
            }}
            details={{
              label: t('initiatives.capacityAdvisor.details.label', 'Load state and evidence'),
              text:
                row.detail ||
                t(
                  'initiatives.capacityAdvisor.details.text',
                  'Ranges are based on available evidence; missing data does not mean zero.'
                ),
              properties: [
                {
                  id: 'demand',
                  label: t('initiatives.capacityAdvisor.properties.demand', 'Demand'),
                  value: knowledgeLabel(row.demand as K),
                },
                {
                  id: 'supply',
                  label: t('initiatives.capacityAdvisor.properties.supply', 'Supply'),
                  value: knowledgeLabel(row.supply as K),
                },
                { id: 'gap', label: t('initiatives.capacityAdvisor.columns.gap', 'Gap'), value: row.gap },
                {
                  id: 'owner',
                  label: t('initiatives.capacityAdvisor.properties.owner', 'Owner'),
                  value: actorLabel(row.owner),
                },
              ],
            }}
            ai={{
              hints: [
                t('initiatives.capacityAdvisor.ai.hintChallenge', 'Challenge assumptions'),
                t('initiatives.capacityAdvisor.ai.hintCompare', 'Compare options'),
              ],
              disabled: true,
              disabledTooltip: t(
                'initiatives.capacityAdvisor.ai.disabledTooltip',
                'AI suggestions require an explicit governed analysis request.'
              ),
            }}
            relations={[
              {
                id: scenario?.planScenarioId ?? 'UNKNOWN',
                label: `Plan ${scenario?.planScenarioId ?? 'UNKNOWN'}:v${scenario?.planScenarioVersion ?? 'UNKNOWN'}`,
                type: 'plan',
              },
            ]}
            actions={{
              informational: [
                {
                  id: 'open-workspace',
                  variant: 'neutral',
                  label: t('initiatives.capacityAdvisor.openTools', 'Open load tools'),
                  icon: Eye,
                  shortcut: 'O',
                  onClick: showWorkspace,
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
              label: t('initiatives.capacityAdvisor.columns.titlePeriod', 'Period / constraint'),
              sortable: true,
              width: '240px',
            },
            {
              id: 'roleTeamSkill',
              label: t('initiatives.capacityAdvisor.columns.roleTeam', 'Role / team'),
              sortable: true,
              filterable: true,
              render: (row) => renderKnowledgeToken(row.roleTeamSkill),
            },
            {
              id: 'kind',
              label: t('initiatives.capacityAdvisor.columns.kind', 'Kind'),
              sortable: true,
              filterable: true,
              render: (row) => rowKindLabel(row.kind) ?? row.kind,
            },
            {
              id: 'demand',
              label: t('initiatives.capacityAdvisor.columns.demandRange', 'Demand (range)'),
              sortable: true,
              filterable: true,
              render: (row) => renderKnowledgeToken(row.demand),
            },
            {
              id: 'supply',
              label: t('initiatives.capacityAdvisor.columns.supplyRange', 'Supply (range)'),
              sortable: true,
              filterable: true,
              render: (row) => renderKnowledgeToken(row.supply),
            },
            {
              id: 'gap',
              label: t('initiatives.capacityAdvisor.columns.gap', 'Gap'),
              sortable: true,
              render: (row) => renderKnowledgeToken(row.gap),
            },
            {
              id: 'saturation',
              label: t('initiatives.capacityAdvisor.columns.pressureRange', 'Pressure (range)'),
              sortable: true,
              render: (row) => renderKnowledgeToken(row.saturation),
            },
            {
              id: 'confidence',
              label: t('initiatives.capacityAdvisor.columns.confidence', 'Confidence'),
              sortable: true,
              filterable: true,
              render: (row) => confidenceLabel(row.confidence) ?? row.confidence,
            },
            {
              id: 'criticality',
              label: t('initiatives.capacityAdvisor.columns.weight', 'Weight'),
              sortable: true,
              filterable: true,
              render: (row) => criticalityLabel(row.criticality) ?? row.criticality,
            },
            {
              id: 'owner',
              label: t('initiatives.capacityAdvisor.columns.owner', 'Owner'),
              sortable: true,
              filterable: true,
              render: (row) => actorLabel(row.owner),
            },
            {
              id: 'affectedInitiatives',
              label: t('initiatives.capacityAdvisor.columns.affectedInitiatives', 'Affected initiatives'),
              sortable: true,
              render: (row) => renderKnowledgeToken(row.affectedInitiatives),
            },
            {
              id: 'freshness',
              label: t('initiatives.capacityAdvisor.columns.freshness', 'Assumption freshness'),
              sortable: true,
              render: (row) =>
                row.freshness === 'UNKNOWN'
                  ? knowledgeLabel('UNKNOWN')
                  : formatPeriodDate(row.freshness),
            },
            {
              id: 'proposedResponse',
              label: t('initiatives.capacityAdvisor.columns.proposedResponse', 'Proposed response'),
              sortable: true,
              render: (row) => renderKnowledgeToken(row.proposedResponse),
            },
          ]}
          data={visibleConstraintRows}
          selectedRowId={selectedConstraintId}
          onRowClick={(row) => setSelectedConstraintId(String(row.id))}
          onRowDoubleClick={showWorkspace}
          rowMenu={(row) => ({
            primary: [
              {
                id: 'open-workspace',
                label: t('initiatives.capacityAdvisor.openTools', 'Open load tools'),
                icon: Eye,
                onClick: showWorkspace,
              },
            ],
            universalHandlers: {
              preview: () => setSelectedConstraintId(String(row.id)),
              edit: showWorkspace,
              archiveNote: t(
                'initiatives.capacityAdvisor.archiveNote',
                'Published capacity history is immutable'
              ),
            },
            destructive: {
              note: t(
                'initiatives.capacityAdvisor.destructiveNote',
                'Capacity scenarios are superseded, not deleted'
              ),
            },
          })}
          persistKey="initiatives.capacity-constraints.v2"
          empty={{
            title: t('initiatives.capacityAdvisor.emptyTitle', 'No load data in this range'),
            description: t(
              'initiatives.capacityAdvisor.emptyDescription',
              'Change the filter or open the tools for the active capacity scenario.'
            ),
          }}
        />
        </TableWithPreviewLayout>
      </div>
      {scenario && workspaceOpen && (
        <section
          aria-label="Capacity Scenario Workbench"
          className="mt-4 rounded-md border border-c-border p-4"
        >
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h3 className="font-semibold">{t('initiatives.capacityAdvisor.workbench.title', 'Load tools')}</h3>
              <p className="text-xs">
                {t('initiatives.capacityAdvisor.workbench.sourcePlan', 'Source plan')} · v{scenario.planScenarioVersion} ·{' '}
                {capacityUnitLabel(scenario.windowUnit, i18n.language.startsWith('pl'))} ·{' '}
                {scenario.timezone}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost"
                aria-label={t('initiatives.capacityAdvisor.workbench.closeAria', 'Close load tools')}
                onClick={() => setWorkspaceOpen(false)}
              >
                <X size={15} /> {t('common.close', 'Close')}
              </button>
              <button
                className="btn-secondary"
                disabled={scenario.status !== 'DRAFT' || writeState === 'SAVING'}
                onClick={() => void write('UPDATE')}
              >
                {t('initiatives.capacityAdvisor.workbench.saveDraft', 'Save draft')}
              </button>
              <button
                className="btn-secondary"
                disabled={scenario.status !== 'DRAFT' || writeState === 'SAVING'}
                onClick={() => void write('PUBLISH')}
              >
                {t('common.publish', 'Publish')}
              </button>
            </div>
          </div>
          {(writeState === 'CONFLICT' || writeState === 'FAILED') && (
            <p role="alert" className="text-c-danger">
              {writeRule
                ? i18n.t(`initiatives.planScenario.errors.${writeRule}`, {
                    defaultValue: 'Changes were not saved.',
                  })
                : writeState === 'CONFLICT'
                  ? t('initiatives.capacityAdvisor.workbench.conflict', 'The scenario has changed. Refresh the data before trying again.')
                  : t('initiatives.capacityAdvisor.workbench.notSaved', 'Changes were not saved.')}
            </p>
          )}
          <div className="mt-4 space-y-3">
            {scenario.periods.map((p) => (
              <article key={p.periodId} className="rounded border border-c-border p-3">
                <strong>{p.periodId}</strong>{' '}
                <span className="text-sm text-c-text-muted">
                  {formatPeriodDate(p.start)} – {formatPeriodDate(p.end)}
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <RangeView label={t('initiatives.capacityAdvisor.workbench.demand', 'Demand')} value={p.demand} resolveMemberName={resolveMemberName} />
                  <RangeView label={t('initiatives.capacityAdvisor.workbench.supply', 'Availability')} value={p.supply} resolveMemberName={resolveMemberName} />
                </div>
              </article>
            ))}
            <div>
              <h4 className="font-medium">{t('initiatives.capacityAdvisor.workbench.constraints', 'Constraints')}</h4>
              {scenario.constraints.map((c) => (
                <p key={c.constraintId}>
                  {knowledgeLabel(c.state)} · {c.detail} · {t('initiatives.capacityAdvisor.workbench.owner', 'owner')} {actorLabel(c.ownerId)}
                </p>
              ))}
            </div>
            <div>
              <h4 className="font-medium">{t('initiatives.capacityAdvisor.workbench.proposedAssignments', 'Proposed assignments')}</h4>
              {scenario.proposedAssignments.map((a) => (
                <button
                  key={a.assignmentId}
                  className="block w-full text-left"
                  onClick={() =>
                    setCommitment((v) => ({
                      ...v,
                      assignmentId: a.assignmentId,
                      initiativeId: a.initiativeId,
                    }))
                  }
                >
                  {actorLabel(a.resourceOrRoleId)} · {t('initiatives.capacityAdvisor.workbench.periods', 'periods')} {a.periodIds.join(', ')} ·{' '}
                  {knowledgeLabel(a.demand.knowledgeState)}
                </button>
              ))}
            </div>
            {capacityAdvisorEnabled &&
              scenario.status === 'PUBLISHED' &&
              publishedPlans.some(
                (plan) =>
                  plan.id === scenario.planScenarioId &&
                  plan.version === scenario.planScenarioVersion
              ) && (
                <div className="rounded border border-c-border p-3">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={advisorState === 'SAVING'}
                    onClick={() => void proposeOptions()}
                  >
                    {advisorState === 'SAVING' && <Loader2 className="animate-spin" size={15} />}
                    {t('initiatives.capacityAdvisor.propose')}
                  </button>
                  {advisorState === 'APPLIED' && (
                    <p role="status" className="mt-2 text-sm text-c-text-muted">
                      {t('initiatives.capacityAdvisor.applied')}
                    </p>
                  )}
                  {advisorState === 'NO_PRESSURE' && (
                    <p role="status" className="mt-2 text-sm text-c-text-muted">
                      {t('initiatives.capacityAdvisor.noPressure')}
                    </p>
                  )}
                  {(advisorState === 'CONFLICT' || advisorState === 'FAILED') && (
                    <p role="alert" className="mt-2 text-sm text-c-danger">
                      {t(
                        advisorState === 'CONFLICT'
                          ? 'initiatives.capacityAdvisor.conflict'
                          : 'initiatives.capacityAdvisor.failed'
                      )}
                    </p>
                  )}
                </div>
              )}
            <CapacityOptionsPanel
              comparisons={comparisons.filter(
                (comparison) => comparison.capacityRef.scenarioId === scenario.scenarioId
              )}
              nextInputKind={nextInputKind}
              onNextInputKind={setNextInputKind}
              onSelect={(comparison, optionId) => void selectOption(comparison, optionId)}
              saving={writeState === 'SAVING'}
              resolveMemberName={resolveMemberName}
            />
            <div className="flex items-center justify-between border-t border-c-border pt-3">
              <div>
                <h4 className="font-medium">{t('initiatives.capacityAdvisor.commitment.title', 'Resource commitment')}</h4>
                <p className="text-xs text-c-text-muted">
                  {t('initiatives.capacityAdvisor.commitment.subtitle', 'The request, the assignee’s acceptance and the Resource Manager’s decision are separate steps.')}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCommitmentEditorOpen((open) => !open)}
              >
                {commitmentEditorOpen
                  ? t('initiatives.capacityAdvisor.commitment.closeEditor', 'Close commitment')
                  : t('initiatives.capacityAdvisor.commitment.openEditor', 'Manage commitment')}
              </button>
            </div>
            {commitmentEditorOpen && (
              <div className="grid grid-cols-1 gap-2 rounded border border-c-border p-3 sm:grid-cols-2">
                {(
                  [
                    'commitmentId',
                    'assignmentId',
                    'initiativeId',
                    'resourceManagerId',
                    'assigneeId',
                    'expiresAt',
                    'version',
                  ] as const
                ).map((k) => (
                  <label key={k} className="text-xs">
                    {k}
                    <input
                      aria-label={`Capacity ${k}`}
                      type={k === 'expiresAt' ? 'datetime-local' : 'text'}
                      className="block w-full rounded border border-c-border bg-c-background p-2"
                      value={commitment[k]}
                      onChange={(e) => setCommitment((v) => ({ ...v, [k]: e.target.value }))}
                    />
                  </label>
                ))}
                <label className="text-xs">
                  {t('initiatives.capacityAdvisor.commitment.conditions', 'conditions')}
                  <textarea
                    aria-label="Capacity commitment conditions"
                    className="block w-full rounded border border-c-border bg-c-background p-2"
                    value={commitment.conditions}
                    onChange={(e) => setCommitment((v) => ({ ...v, conditions: e.target.value }))}
                  />
                </label>
                <label className="text-xs">
                  {t('initiatives.capacityAdvisor.commitment.rationale', 'rationale')}
                  <textarea
                    aria-label="Capacity commitment rationale"
                    className="block w-full rounded border border-c-border bg-c-background p-2"
                    value={commitment.rationale}
                    onChange={(e) => setCommitment((v) => ({ ...v, rationale: e.target.value }))}
                  />
                </label>
                <div className="col-span-2 flex flex-wrap gap-2">
                  <button
                    className="btn-secondary"
                    aria-label="Request commitment"
                    disabled={commitmentWrite.state === 'PENDING'}
                    onClick={() => void request()}
                  >
                    {t('initiatives.capacityAdvisor.commitment.sendRequest', 'Send request')}
                  </button>
                  <button
                    className="btn-secondary"
                    aria-label="Assignee accept"
                    disabled={commitmentWrite.state === 'PENDING'}
                    onClick={() => void accept()}
                  >
                    {t('initiatives.capacityAdvisor.commitment.assigneeAccept', 'Assignee acceptance')}
                  </button>
                  <button
                    className="btn-secondary"
                    aria-label="RM confirm"
                    disabled={commitmentWrite.state === 'PENDING'}
                    onClick={() => void decide('CONFIRMED')}
                  >
                    {t('initiatives.capacityAdvisor.commitment.confirm', 'Confirm availability')}
                  </button>
                  <button
                    className="btn-secondary"
                    aria-label="RM conditional"
                    onClick={() => void decide('CONDITIONALLY_CONFIRMED')}
                  >
                    {t('initiatives.capacityAdvisor.commitment.confirmConditional', 'Confirm conditionally')}
                  </button>
                  <button
                    className="btn-secondary"
                    aria-label="RM decline"
                    onClick={() => void decide('DECLINED')}
                  >
                    {t('initiatives.capacityAdvisor.commitment.decline', 'Decline availability')}
                  </button>
                </div>
              </div>
            )}
            {commitmentWrite.message ? (
              <p
                className="text-xs text-c-text-muted"
                role={commitmentWrite.state === 'FAILED' ? 'alert' : 'status'}
              >
                {commitmentWrite.message}
              </p>
            ) : null}
          </div>
        </section>
      )}
    </section>
  );
};
/**
 * 2026-09-05 (runda 3 odbioru, rodzina „UUID zamiast nazwiska"): pole
 * „właściciel" pisało tu surowy `ownerId`. Ten sam kontrakt co w Wynikach,
 * Finansach i Realizacji — człowiek albo „Nieznany użytkownik", nigdy UUID.
 */
const RangeView = ({
  label,
  value,
  resolveMemberName,
}: {
  label: string;
  value: Range;
  resolveMemberName?: MemberNameResolver;
}) => (
  <div>
    <h5>
      {label}: {knowledgeLabel(value.knowledgeState)}
    </h5>
    <p>
      {value.knowledgeState === 'UNKNOWN'
        ? 'UNKNOWN — brak potwierdzonej wartości'
        : `${value.low} / ${value.base} / ${value.high}`}
    </p>
    <p className="text-xs text-c-text-muted">
      {knowledgeLabel(value.knowledgeState)} · pewność {value.confidence} · właściciel{' '}
      {memberNameOrUnknown(resolveMemberName, value.ownerId, true)}
    </p>
  </div>
);

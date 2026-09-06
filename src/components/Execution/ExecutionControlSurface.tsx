import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardPreview } from '@/components/standard';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import { Api } from '@/services/api';

import {
  createMaterialChange,
  draftIntervention,
  ingestManagementSignal,
  listCapacityOptions,
  listInterventions,
  listManagementSignals,
  transitionIntervention,
} from '@/services/initiatives-execution/runtimeApi';

import { countExecutionPresets, type ExecutionMenu3Contract } from './canonicalMenu3';
import {
  decisionDaysOverdue,
  isDecisionOverdue,
  isOpenDecision,
} from './executionRealData';
import {
  executionLocalReviewEnabled,
  executionReviewInterventions,
  executionReviewPeople,
  executionReviewRoleLabel,
  executionReviewSignals,
} from './executionLocalReviewData';

const interventionFieldLabels: Record<string, string> = {
  interventionId: 'Identyfikator interwencji',
  ownerId: 'Właściciel',
  authorityId: 'Niezależny zatwierdzający',
  slaAt: 'Termin decyzji',
  hypotheses: 'Hipotezy',
  evidenceRefs: 'Dowody',
  counterEvidenceRefs: 'Kontrdowody',
  unknowns: 'Niewiadome',
  blastRadiusRefs: 'Wpływ na powiązane obiekty',
  doNothingLabel: 'Opcja bez działania',
  doNothingImpacts: 'Skutki braku działania',
  actionOptionId: 'Identyfikator wariantu',
  actionLabel: 'Nazwa działania',
  actionImpacts: 'Skutki działania',
  actionConfidence: 'Pewność',
  actionReversibility: 'Odwracalność',
};

const applyFieldLabels: Record<string, string> = {
  receiptId: 'Potwierdzenie komendy',
  aggregateType: 'Typ obiektu',
  aggregateId: 'Obiekt docelowy',
  version: 'Wersja',
  state: 'Oczekiwany stan',
  verifyBy: 'Termin weryfikacji',
  expectedEffect: 'Oczekiwany efekt',
  measurementRef: 'Źródło pomiaru',
  measurementVersion: 'Wersja pomiaru',
};
interface SignalRow extends TableRow {
  id: string;
  title: string;
  rule: string;
  source: string;
  severity: string;
  rawSeverity: string;
  occurrences: number;
  updatedAt: string;
  version: number;
  signal: any;
}
interface Row extends TableRow {
  id: string;
  title: string;
  status: string;
  rawStatus: string;
  owner: string;
  authority: string;
  slaAt: string;
  rawSlaAt: string | null;
  version: number;
  source: any;
}
// i18n-reszta 20260903: kolumny przeniesione do funkcji wywoływanych z `t`
// wewnątrz komponentu (patrz `useMemo` niżej) — poprzednio literały PL na
// module-scope nie reagowały na `?lang=`, PL i EN renderowały identyczny
// tekst nagłówków (pomiar nadzorcy 03.09, execution-tab-control).
const buildColumns = (t: (key: string, fallback: string) => string): TableColumn[] => [
  {
    id: 'title',
    label: t('execution.control.columns.title', 'Intervention'),
    sortable: true,
    width: '240px',
  },
  {
    id: 'status',
    label: t('execution.control.columns.status', 'Status'),
    sortable: true,
    filterable: true,
  },
  { id: 'owner', label: t('execution.control.columns.owner', 'Owner'), sortable: true },
  { id: 'authority', label: t('execution.control.columns.authority', 'Approver'), sortable: true },
  { id: 'slaAt', label: t('execution.control.columns.slaAt', 'Review deadline'), sortable: true },
];
const buildSignalColumns = (t: (key: string, fallback: string) => string): TableColumn[] => [
  {
    id: 'title',
    label: t('execution.control.signalColumns.title', 'Signal'),
    sortable: true,
    width: '240px',
  },
  {
    id: 'rule',
    label: t('execution.control.signalColumns.rule', 'Type'),
    sortable: true,
    filterable: true,
  },
  { id: 'source', label: t('execution.control.signalColumns.source', 'Source'), sortable: true },
  {
    id: 'severity',
    label: t('execution.control.signalColumns.severity', 'Severity'),
    sortable: true,
    filterable: true,
  },
  {
    id: 'occurrences',
    label: t('execution.control.signalColumns.occurrences', 'Occurrences'),
    sortable: true,
  },
  {
    id: 'updatedAt',
    label: t('execution.control.signalColumns.updatedAt', 'Updated'),
    sortable: true,
  },
];
const lines = (value: string) =>
  value
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
const versionedRefs = (value: string) =>
  lines(value).map((entry) => {
    const [ref, version] = entry.split('@');
    return { ref, version: Number(version) };
  });
const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'UNKNOWN';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'UNKNOWN';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};
/**
 * Nazwisko osoby — z KATALOGU OSÓB (`executionLocalReviewData.ts`), nie z zamiany
 * myślnika na spację. `\b\w` nie podnosi liter spoza ASCII i żadna zamiana znaków
 * nie odtworzy `Wiśniewski` z `wisniewski` — diakrytyk musi przyjść z danych.
 * Zamiana zostaje wyłącznie jako ostatnia deska ratunku dla identyfikatora
 * spoza katalogu (granica po Unicode, bez `toLowerCase`).
 */
const actorBusinessLabel = (
  value: string | null | undefined,
  fallback: string,
  t: (key: string, fallback: string) => string
) => {
  if (!value) return fallback;
  return (
    executionReviewRoleLabel(value, t) ??
    executionReviewPeople[value] ??
    value
      .replace(/[-_]+/g, ' ')
      .replace(/(^|[\s/])(\p{L})/gu, (_m, separator, letter) => separator + letter.toUpperCase())
  );
};
const interventionBusinessTitle = (intervention: any) =>
  intervention.title ||
  intervention.options?.find((option: any) => option.optionId === intervention.selectedOptionId)
    ?.label ||
  intervention.hypotheses?.[0] ||
  `Interwencja operacyjna · ${intervention.interventionId}`;
/**
 * Etykieta WYBRANEJ opcji interwencji — nazwa, nie identyfikator (2026-09-02).
 *
 * Do dziś pigułka rekomendacji w podglądzie składała `Wybrana opcja:
 * ${selectedOptionId}` i wypisywała na ekran surowy klucz („parallel-validation").
 * To ta sama rodzina co wyciek `undefined:` w POWIĄZANIA naprawiony wcześniej
 * tego dnia: prezenter bierze pole techniczne i pokazuje je klientowi.
 * Wyszukanie opcji po `optionId` istniało już 770 linii wyżej
 * (`interventionBusinessTitle`) — brakowało go tylko tutaj.
 *
 * Gdy opcji o tym identyfikatorze nie ma w kolekcji (dane starsze niż kontrakt),
 * pokazujemy identyfikator jako ostatnią deskę ratunku — brak nazwany jest
 * lepszy niż pusta pigułka.
 */
const selectedOptionLabel = (intervention: any): string | null => {
  const id = intervention?.selectedOptionId;
  if (!id) return null;
  const option = intervention.options?.find((o: any) => o.optionId === id);
  return option?.label || String(id);
};
const interventionStatusLabel = (value: string) =>
  ({
    DRAFT: 'Szkic',
    PENDING_DECISION: 'Oczekuje na decyzję',
    APPROVED: 'Zatwierdzona',
    APPLIED: 'Zastosowana',
    ESCALATED: 'Eskalowana',
    CLOSED: 'Zamknięta',
  })[value] ?? value;
const signalRuleLabel = (value: string) =>
  ({ STALE_MILESTONE: 'Nieaktualny kamień milowy', CAPACITY_CONFLICT: 'Konflikt obciążenia' })[
    value
  ] ?? value;
const severityLabel = (value: string) =>
  ({ WARNING: 'Ostrzeżenie', CRITICAL: 'Krytyczna' })[value] ?? value;
const verificationOutcomeLabel = (value: string) =>
  ({
    EFFECTIVE: 'Skuteczna',
    PARTIAL: 'Częściowo skuteczna',
    INEFFECTIVE: 'Nieskuteczna',
    NOT_VERIFIED: 'Niezweryfikowana',
  })[value] ?? value;
/**
 * Rodzaj opcji interwencji (kontrakt `InterventionOption.kind`) — po polsku.
 * Zwraca `null`, gdy pola nie ma: przedrostek jest wtedy POMIJANY, zamiast
 * wyciekać jako `undefined` albo surowy kod na ekran (defekt 2026-09-02).
 */
const optionKindLabel = (value: unknown): string | null =>
  typeof value === 'string' && value.trim()
    ? (({ DO_NOTHING: 'Bez zmian', ACTION: 'Działanie' } as Record<string, string>)[value] ?? value)
    : null;
/** Pewność opcji — nazwana wprost, brak nazywany „Nieznana", nie `undefined`. */
const confidenceLabel = (value: unknown): string =>
  typeof value === 'string' && value.trim()
    ? ((
        {
          HIGH: 'Wysoka pewność',
          MEDIUM: 'Średnia pewność',
          LOW: 'Niska pewność',
          UNKNOWN: 'Pewność nieznana',
        } as Record<string, string>
      )[value] ?? value)
    : 'Pewność nieznana';
/** Odwracalność opcji — słownik kontraktu, brak nazywany wprost. */
const reversibilityLabel = (value: unknown): string =>
  typeof value === 'string' && value.trim()
    ? ((
        {
          REVERSIBLE: 'Odwracalna',
          PARTIALLY_REVERSIBLE: 'Częściowo odwracalna',
          IRREVERSIBLE: 'Nieodwracalna',
          UNKNOWN: 'Odwracalność nieznana',
        } as Record<string, string>
      )[value] ?? value)
    : 'Odwracalność nieznana';
const signalFieldLabels: Record<string, string> = {
  sourceId: 'Źródło sygnału',
  sourceVersionKey: 'Rodzaj wersji źródła',
  sourceVersion: 'Wersja źródła',
  snapshotRef: 'Dowód / migawka źródła',
  ruleId: 'Reguła wykrycia',
  severity: 'Ważność',
  occurredAt: 'Czas wystąpienia',
};
/**
 * 1.12-R1 (C): zakładka „Sterowanie" staje się „Decyzje i ryzyka".
 *
 * POMIAR 06.09 (DBR77): `runtime-v1/management-signals` → 0,
 * `runtime-v1/interventions` → 0. Zakładka miała 12 chipów Menu 3 filtrujących
 * PUSTY zbiór (część z nich regexem po `JSON.stringify` całego wiersza).
 * Obok, nieczytane: `/api/decisions` → 35 (25 otwartych, 12 po terminie,
 * `isOverdue`/`daysOverdue`/`escalationLevel` policzone przez serwer),
 * `/api/raid` → 16 pozycji. Trzy chipy, dwa realne rejestry.
 *
 * Sygnały i interwencje NIE ZNIKAJĄ z kodu — pokazują się w sekcji warsztatu
 * wtedy i tylko wtedy, gdy mają choć jeden rekord (zero pustych ekranów).
 */
const controlPresets = ['decyzje', 'ryzyka', 'po-terminie'] as const;

/** Wiersz rejestru decyzji albo RAID — wspólny kształt tabeli (plan C2, wiersz 5). */
interface GovernanceRow extends TableRow {
  id: string;
  title: string;
  kindLabel: string;
  kind: 'DECISION' | 'RAID';
  owner: string;
  dueAt: string;
  rawDueAt: string | null;
  daysOverdue: number | null;
  escalation: string;
  isOverdue: boolean;
  source: any;
}

const raidTypeLabel = (value: unknown): string =>
  ({
    RISK: 'Ryzyko',
    ISSUE: 'Problem',
    DEPENDENCY: 'Zależność',
    ASSUMPTION: 'Założenie',
    ACTION: 'Działanie',
  })[String(value ?? '').toUpperCase()] ?? String(value ?? '—');

const decisionStatusLabel = (value: unknown): string =>
  ({
    PENDING: 'Oczekuje',
    ESCALATED: 'Eskalowana',
    APPROVED: 'Zatwierdzona',
    REJECTED: 'Odrzucona',
    DEFERRED: 'Odroczona',
  })[String(value ?? '').toUpperCase()] ?? String(value ?? '—');

/**
 * Poziom eskalacji — serwer liczy go sam (`escalationLevel` 0/1/2 +
 * `escalationLevelName` none/amber/red w `DecisionController.getDecisions`),
 * więc tu tylko nazywamy go po polsku. Zero własnej arytmetyki obok silnika.
 */
const escalationLabel = (decision: any): string => {
  const name = String(decision?.escalationLevelName ?? '').toLowerCase();
  if (name === 'red') return 'Czerwona';
  if (name === 'amber') return 'Bursztynowa';
  if (name === 'none') return 'Brak';
  const level = Number(decision?.escalationLevel ?? 0);
  return level >= 2 ? 'Czerwona' : level === 1 ? 'Bursztynowa' : 'Brak';
};

const severityToEscalation = (value: unknown): string =>
  ({ CRITICAL: 'Czerwona', HIGH: 'Czerwona', MEDIUM: 'Bursztynowa', LOW: 'Brak' })[
    String(value ?? '').toUpperCase()
  ] ?? 'Brak';

const formatDay = (value: string | null | undefined) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

/** Kolumny wg planu C2 (wiersz 5): Tytuł · Typ · Właściciel · Termin · Dni po terminie · Eskalacja. */
const buildGovernanceColumns = (t: (key: string, fallback: string) => string): TableColumn[] => [
  {
    id: 'title',
    label: t('execution.governance.columns.title', 'Tytuł'),
    sortable: true,
    width: '300px',
  },
  {
    id: 'kindLabel',
    label: t('execution.governance.columns.type', 'Typ'),
    sortable: true,
    filterable: true,
    width: '130px',
  },
  {
    id: 'owner',
    label: t('execution.governance.columns.owner', 'Właściciel'),
    sortable: true,
    width: '170px',
  },
  {
    id: 'dueAt',
    label: t('execution.governance.columns.due', 'Termin'),
    sortable: true,
    width: '140px',
  },
  {
    id: 'daysOverdue',
    label: t('execution.governance.columns.daysOverdue', 'Dni po terminie'),
    sortable: true,
    width: '130px',
    render: (row) => {
      const days = row.daysOverdue as number | null;
      if (days == null) return <span className="text-c-text-muted">—</span>;
      return <span className="font-semibold tabular-nums text-c-danger">+{days}</span>;
    },
  },
  {
    id: 'escalation',
    label: t('execution.governance.columns.escalation', 'Eskalacja'),
    sortable: true,
    filterable: true,
    width: '130px',
    render: (row) => {
      const value = String(row.escalation ?? '');
      const tone =
        value === 'Czerwona'
          ? 'text-c-danger'
          : value === 'Bursztynowa'
            ? 'text-c-warning'
            : 'text-c-text-muted';
      return <span className={`font-medium ${tone}`}>{value}</span>;
    },
  },
];
export const ExecutionControlSurface = ({
  activePreset,
  onCountsChange,
  onRegisterFilterControl,
}: ExecutionMenu3Contract & {
  /**
   * Rejestruje węzeł kontrolki ("Dodaj sygnał" / "Przygotuj interwencję")
   * do prawej strony Menu 2 gospodarza (ExecutionHub) — patrz identyczny
   * komentarz w `ExecutionWorkSurface`. Odbiór grafiki 165-menu3-pasek,
   * execution-tab-control: właściciel zgłosił ten sam problem co na
   * ekranach "Praca" i "Zasoby".
   */
  onRegisterFilterControl?: (node: React.ReactNode) => void;
}) => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildColumns(t), [t]);
  const signalColumns = useMemo(() => buildSignalColumns(t), [t]);
  const governanceColumns = useMemo(() => buildGovernanceColumns(t), [t]);
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING'),
    // 1.12-R1 (C): realne rejestry — decyzje (/api/decisions) i RAID (/api/raid).
    [governanceRows, setGovernanceRows] = useState<GovernanceRow[]>([]),
    [selectedGovernanceId, setSelectedGovernanceId] = useState<string | null>(null),
    [newDecisionOpen, setNewDecisionOpen] = useState(false),
    [newDecision, setNewDecision] = useState({ title: '', dueDate: '' }),
    [newDecisionError, setNewDecisionError] = useState<string | null>(null),
    [rows, setRows] = useState<Row[]>([]),
    [signalRows, setSignalRows] = useState<SignalRow[]>([]),
    [selectedSignalId, setSelectedSignalId] = useState<string | null>(null),
    [draftSignalIds, setDraftSignalIds] = useState<string[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [draftJson, setDraftJson] = useState(''),
    [advancedJson, setAdvancedJson] = useState(false),
    [showSignalForm, setShowSignalForm] = useState(false),
    [showInterventionForm, setShowInterventionForm] = useState(false),
    [interventionComposerOpen, setInterventionComposerOpen] = useState(false),
    [signalForm, setSignalForm] = useState({
      kind: 'STALE_MILESTONE',
      sourceId: '',
      sourceVersionKey: 'milestoneVersion',
      sourceVersion: '1',
      snapshotRef: '',
      ruleId: 'STALE_MILESTONE',
      severity: 'WARNING',
      occurredAt: '',
    }),
    [guided, setGuided] = useState({
      interventionId: '',
      ownerId: '',
      authorityId: '',
      slaAt: '',
      hypotheses: '',
      evidenceRefs: '',
      counterEvidenceRefs: '',
      unknowns: '',
      blastRadiusRefs: '',
      doNothingLabel: 'Do nothing',
      doNothingImpacts: '',
      actionOptionId: 'action-1',
      actionLabel: '',
      actionImpacts: '',
      actionConfidence: 'UNKNOWN',
      actionReversibility: 'UNKNOWN',
    }),
    [rationale, setRationale] = useState(''),
    [selectedOption, setSelectedOption] = useState(''),
    [capacityOptions, setCapacityOptions] = useState<any[]>([]),
    [governed, setGoverned] = useState({
      proposalId: '',
      comparisonId: '',
      planScenarioId: '',
      oldSnapshot: '{}',
      newSnapshot: '{}',
      affected: '{"initiatives":[],"executionCases":[],"tasks":[]}',
      ownerId: '',
      authorityId: '',
      policyRef: '',
      policyVersion: '1',
      blastRadius:
        '{"tasks":{"knowledgeState":"KNOWN","refs":[]},"decisions":{"knowledgeState":"KNOWN","refs":[]},"milestones":{"knowledgeState":"KNOWN","refs":[]},"risks":{"knowledgeState":"KNOWN","refs":[]},"capacity":{"knowledgeState":"KNOWN","refs":[]},"approvals":{"knowledgeState":"KNOWN","refs":[]},"handoff":{"knowledgeState":"KNOWN","refs":[]}}',
    }),
    [governedPlanOpen, setGovernedPlanOpen] = useState(false),
    [apply, setApply] = useState({
      receiptId: '',
      aggregateType: 'execution_task',
      aggregateId: '',
      version: '1',
      state: '',
      verifyBy: '',
      expectedEffect: '',
      measurementRef: '',
      measurementVersion: '1',
    }),
    [verifyOutcome, setVerifyOutcome] = useState('EFFECTIVE'),
    [verificationEvidence, setVerificationEvidence] = useState(''),
    [receipt, setReceipt] = useState<any | null>(null),
    [write, setWrite] = useState<'IDLE' | 'FAILED'>('IDLE');
  const ids = useRef(new Map<string, string>());
  /**
   * 1.12-R1 (C): rejestr decyzji + RAID. Pobierany NIEZALEŻNIE od
   * `runtime-v1` — jedna padnięta rura nie może zabrać drugiej (to jest
   * dokładnie ten defekt, przez który cała zakładka była pusta).
   */
  const loadGovernance = useCallback(async () => {
    const [decyzje, raid] = await Promise.allSettled([Api.get('/decisions'), Api.raidList()]);

    const decisionItems: any[] =
      decyzje.status === 'fulfilled'
        ? Array.isArray(decyzje.value)
          ? decyzje.value
          : ((decyzje.value as any)?.decisions ?? [])
        : [];
    const raidItems: any[] =
      raid.status === 'fulfilled'
        ? Array.isArray(raid.value)
          ? raid.value
          : ((raid.value as any)?.items ?? (raid.value as any)?.raid ?? [])
        : [];

    const decisionRows: GovernanceRow[] = decisionItems
      // Rozstrzygnięte decyzje nie są „do rozstrzygnięcia" — rejestr pokazuje
      // to, co jeszcze czeka (25 z 35 na pomiarze DBR77).
      .filter((decision) => isOpenDecision(decision))
      .map((decision) => ({
        id: `decision:${decision.id}`,
        title: decision.title ?? 'Decyzja bez tytułu',
        kind: 'DECISION' as const,
        kindLabel: decisionStatusLabel(decision.status),
        owner: decision.ownerName || decision.requestedByName || 'Nieprzypisana',
        dueAt: formatDay(decision.dueDate),
        rawDueAt: decision.dueDate ?? null,
        daysOverdue: isDecisionOverdue(decision) ? decisionDaysOverdue(decision) : null,
        escalation: escalationLabel(decision),
        isOverdue: isDecisionOverdue(decision),
        source: decision,
      }));

    const raidRows: GovernanceRow[] = raidItems.map((item) => ({
      id: `raid:${item.id}`,
      title: item.title ?? 'Pozycja RAID bez tytułu',
      kind: 'RAID' as const,
      kindLabel: raidTypeLabel(item.type),
      owner: item.ownerName || item.ownerId || 'Nieprzypisana',
      // POMIAR: 0 z 16 pozycji RAID ma termin — kolumna pokaże „—",
      // a nie zmyśloną datę (dobudowa terminów to R3, plan C2 wiersz 5).
      dueAt: formatDay(item.dueDate),
      rawDueAt: item.dueDate ?? null,
      daysOverdue: item.dueDate && Date.parse(item.dueDate) < Date.now()
        ? Math.floor((Date.now() - Date.parse(item.dueDate)) / 86_400_000)
        : null,
      escalation: severityToEscalation(item.severity),
      isOverdue: Boolean(item.dueDate) && Date.parse(item.dueDate) < Date.now(),
      source: item,
    }));

    setGovernanceRows([...decisionRows, ...raidRows]);
  }, []);

  const load = useCallback(async () => {
    setState('LOADING');
    void loadGovernance();
    try {
      const [b, s, capacity] = (await Promise.all([
        listInterventions(),
        listManagementSignals(),
        listCapacityOptions(),
      ])) as Array<{
        items?: any[];
      }>;
      const interventionItems =
        (b.items ?? []).length > 0
          ? (b.items ?? [])
          : executionLocalReviewEnabled
            ? executionReviewInterventions
            : [];
      const signalItems =
        (s.items ?? []).length > 0
          ? (s.items ?? [])
          : executionLocalReviewEnabled
            ? executionReviewSignals
            : [];
      setCapacityOptions(
        (capacity.items ?? []).filter((comparison) =>
          comparison.options?.some(
            (option: any) =>
              option.optionId === comparison.selectedOptionId && option.kind === 'RESEQUENCE'
          )
        )
      );
      setRows(
        interventionItems.map((x) => ({
          id: x.interventionId,
          title: interventionBusinessTitle(x),
          status: interventionStatusLabel(x.status),
          rawStatus: x.status,
          owner: actorBusinessLabel(x.ownerName || x.ownerId, 'Nieprzypisany', t),
          authority: actorBusinessLabel(x.authorityName || x.authorityId, 'Nieustalony', t),
          slaAt: formatDateTime(x.verifyBy ?? x.slaAt),
          rawSlaAt: x.verifyBy ?? x.slaAt ?? null,
          version: x.version,
          source: x,
        }))
      );
      setSignalRows(
        signalItems.map((x) => ({
          id: x.signalId,
          title: x.signalId,
          rule: signalRuleLabel(x.ruleId),
          source: `${x.sourceType}:${x.sourceId}`,
          severity: severityLabel(x.severity),
          rawSeverity: x.severity,
          occurrences: x.occurrences?.length ?? 0,
          updatedAt: x.updatedAt,
          version: x.version,
          signal: x,
        }))
      );
      setState('READY');
    } catch {
      if (!executionLocalReviewEnabled) {
        setState('ERROR');
        return;
      }
      setCapacityOptions([]);
      setRows(
        executionReviewInterventions.map((x) => ({
          id: x.interventionId,
          title: interventionBusinessTitle(x),
          status: interventionStatusLabel(x.status),
          rawStatus: x.status,
          owner: actorBusinessLabel(x.ownerId, 'Nieprzypisany', t),
          authority: actorBusinessLabel(x.authorityId, 'Nieustalony', t),
          slaAt: formatDateTime(x.verifyBy ?? x.slaAt),
          rawSlaAt: x.verifyBy ?? x.slaAt ?? null,
          version: x.version,
          source: x,
        }))
      );
      setSignalRows(
        executionReviewSignals.map((x) => ({
          id: x.signalId,
          title: x.signalId,
          rule: signalRuleLabel(x.ruleId),
          source: `${x.sourceId} · v${x.sourceVersion}`,
          severity: severityLabel(x.severity),
          rawSeverity: x.severity,
          occurrences: x.occurrences.length,
          updatedAt: formatDateTime(x.updatedAt),
          version: x.version,
          signal: x,
        }))
      );
      setState('READY');
    }
  }, [loadGovernance]);
  useEffect(() => {
    void load();
  }, [load]);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const selectedSignal = useMemo(
    () => signalRows.find((row) => row.id === selectedSignalId) ?? null,
    [selectedSignalId, signalRows]
  );
  // 1.12-R1 (C): trzy presety liczone z POLA, nie z regexa po
  // `JSON.stringify(wiersz)`. Stary filtr „decisions" łapał każdy wiersz,
  // w którym gdziekolwiek padło słowo DECISION — także w nazwie pola.
  const matches = useCallback(
    (row: GovernanceRow, preset: string) => {
      if (preset === 'decyzje') return row.kind === 'DECISION';
      if (preset === 'ryzyka') return row.kind === 'RAID';
      if (preset === 'po-terminie') return row.isOverdue;
      return false;
    },
    []
  );
  const activeGovernancePreset = activePreset ?? 'decyzje';
  const visibleGovernanceRows = useMemo(
    () => governanceRows.filter((row) => matches(row, activeGovernancePreset)),
    [governanceRows, matches, activeGovernancePreset]
  );
  const selectedGovernance = useMemo(
    () => governanceRows.find((row) => row.id === selectedGovernanceId) ?? null,
    [governanceRows, selectedGovernanceId]
  );
  useEffect(
    () => onCountsChange?.(countExecutionPresets(governanceRows, controlPresets, matches)),
    [governanceRows, matches, onCountsChange]
  );
  /**
   * Warsztat sygnałów/interwencji `runtime-v1` zostaje w kodzie, ale nie
   * rysuje pustej tabeli: na DBR77 oba rejestry mają 0 rekordów, więc bez tej
   * bramki zakładka pokazywałaby pusty stan pod realnym rejestrem decyzji.
   */
  const hasRuntimeControlData = signalRows.length > 0 || rows.length > 0;
  /**
   * 1.12-R1 (C): „Nowa decyzja" na ISTNIEJĄCYM POST `/api/decisions`
   * (`Api.createDecision`, walidator `CreateDecisionSchema` — pola `title`
   * wymagane, `dueDate` opcjonalne). Ten sam wzorzec, którego używa Moja Praca
   * (`NotebookContent.handleCreateDecision`) — zero nowego backendu.
   */
  const createDecision = async () => {
    const title = newDecision.title.trim();
    if (!title) return;
    setNewDecisionError(null);
    try {
      await Api.createDecision({
        title,
        ...(newDecision.dueDate
          ? { dueDate: new Date(newDecision.dueDate).toISOString() }
          : {}),
        sourceType: 'execution',
      });
      setNewDecision({ title: '', dueDate: '' });
      setNewDecisionOpen(false);
      await loadGovernance();
    } catch (error) {
      setNewDecisionError(
        error instanceof Error ? error.message : 'Nie udało się zapisać decyzji.'
      );
    }
  };
  const cid = (key: string) => {
    const value = ids.current.get(key) ?? crypto.randomUUID();
    ids.current.set(key, value);
    return value;
  };
  const ingestSignal = async () => {
    const sourceType =
      signalForm.kind === 'STALE_MILESTONE' ? 'execution_milestone' : 'capacity_scenario';
    const existing = signalRows.find(
      (row) =>
        row.signal.ruleId === signalForm.ruleId &&
        row.signal.sourceType === sourceType &&
        row.signal.sourceId === signalForm.sourceId
    );
    await ingestManagementSignal({
      expectedVersion: existing?.version ?? 0,
      clientRequestId: cid(
        `signal:${signalForm.ruleId}:${signalForm.sourceId}:${existing?.version ?? 0}`
      ),
      ruleId: signalForm.ruleId,
      sourceType,
      sourceId: signalForm.sourceId,
      sourceVersions: { [signalForm.sourceVersionKey]: Number(signalForm.sourceVersion) },
      severity: signalForm.severity,
      occurredAt: new Date(signalForm.occurredAt).toISOString(),
      evidenceRef: signalForm.snapshotRef,
    });
    await load();
  };
  const impactRefs = (value: string) =>
    lines(value).map((entry) => {
      const [targetRef, effect = 'UNKNOWN'] = entry.split('|');
      return { targetRef, effect };
    });
  const draft = async () => {
    const chosen = signalRows.filter((row) => draftSignalIds.includes(row.id));
    const p = advancedJson
      ? JSON.parse(draftJson)
      : {
          interventionId: guided.interventionId,
          signalRefs: chosen.map((row) => ({
            signalId: row.id,
            signalVersion: row.version,
            fingerprint: row.signal.fingerprint,
          })),
          ownerId: guided.ownerId,
          authorityId: guided.authorityId,
          slaAt: new Date(guided.slaAt).toISOString(),
          hypotheses: lines(guided.hypotheses),
          evidenceRefs: lines(guided.evidenceRefs),
          counterEvidenceRefs: lines(guided.counterEvidenceRefs),
          unknowns: lines(guided.unknowns),
          blastRadiusRefs: versionedRefs(guided.blastRadiusRefs),
          options: [
            {
              optionId: 'do-nothing',
              kind: 'DO_NOTHING',
              label: guided.doNothingLabel,
              impacts: impactRefs(guided.doNothingImpacts),
              confidence: 'UNKNOWN',
              reversibility: 'REVERSIBLE',
            },
            ...(guided.actionLabel
              ? [
                  {
                    optionId: guided.actionOptionId,
                    kind: 'ACTION',
                    label: guided.actionLabel,
                    impacts: impactRefs(guided.actionImpacts),
                    confidence: guided.actionConfidence,
                    reversibility: guided.actionReversibility,
                  },
                ]
              : []),
          ],
        };
    if (!p.options?.some((o: any) => o.kind === 'DO_NOTHING'))
      throw new Error('DO_NOTHING required');
    const prior = rows.find((row) => row.id === p.interventionId);
    await draftIntervention(p.interventionId, {
      ...p,
      expectedVersion: prior?.version ?? 0,
      clientRequestId: cid(`draft:${p.interventionId}`),
    });
    await load();
  };
  const transition = async (action: string) => {
    if (!selected) return;
    try {
      let command: any = {
        expectedVersion: selected.version,
        clientRequestId: cid(`${selected.id}:${selected.version}:${action}`),
        action,
      };
      if (action === 'DECIDE')
        command = { ...command, outcome: 'APPROVED', selectedOptionId: selectedOption, rationale };
      if (action === 'APPLY')
        command = {
          ...command,
          targetReceiptClientRequestId: apply.receiptId,
          targetAggregateType: apply.aggregateType,
          targetAggregateId: apply.aggregateId,
          expectedTargetVersion: Number(apply.version),
          expectedTargetState: apply.state,
          verifyBy: new Date(apply.verifyBy).toISOString(),
          expectedEffect: apply.expectedEffect,
          measurementSource: {
            ref: apply.measurementRef,
            version: Number(apply.measurementVersion),
          },
          ...(apply.aggregateType === 'material_change'
            ? { planChange: JSON.parse(governed.affected) }
            : {}),
        };
      if (action === 'VERIFY')
        command = {
          ...command,
          outcome: verifyOutcome,
          evidenceRefs: verificationEvidence.split('\n').filter(Boolean),
        };
      const result = (await transitionIntervention(selected.id, command)) as any;
      setReceipt(result.response);
      setWrite('IDLE');
      await load();
    } catch {
      setWrite('FAILED');
    }
  };
  const createGovernedPlanChange = async () => {
    try {
      const comparison = capacityOptions.find(
        (item) => item.comparisonId === governed.comparisonId
      );
      const option = comparison?.options?.find(
        (item: any) => item.optionId === comparison.selectedOptionId && item.kind === 'RESEQUENCE'
      );
      if (!comparison || !option || comparison.planRef?.scenarioId !== governed.planScenarioId)
        throw new Error('Exact selected RESEQUENCE option required');
      const oldSnapshot = JSON.parse(governed.oldSnapshot),
        newSnapshot = JSON.parse(governed.newSnapshot);
      if (JSON.stringify(oldSnapshot) === JSON.stringify(newSnapshot))
        throw new Error('Exact Plan diff required');
      const result = (await createMaterialChange(governed.proposalId, {
        expectedVersion: 0,
        clientRequestId: cid(`plan-change:${governed.proposalId}`),
        target: {
          kind: 'PLANNING_BASELINE',
          aggregateType: 'plan_scenario',
          aggregateId: governed.planScenarioId,
          version: comparison.planRef.version,
        },
        oldSnapshot,
        newSnapshot,
        diff: [
          {
            path: 'windows',
            oldValue: oldSnapshot.windows,
            newValue: newSnapshot.windows,
          },
        ],
        classification: 'MATERIAL',
        tolerance: {
          policyRef: governed.policyRef,
          policyVersion: Number(governed.policyVersion),
          withinTolerance: false,
          rationale: 'Governed RESEQUENCE changes Plan order',
        },
        blastRadius: JSON.parse(governed.blastRadius),
        reversibility: 'REVERSIBLE',
        ownerId: governed.ownerId,
        authorityId: governed.authorityId,
        governedInputRef: {
          kind: 'CAPACITY_OPTION',
          comparisonId: comparison.comparisonId,
          comparisonVersion: comparison.version,
          optionId: option.optionId,
        },
      })) as any;
      setReceipt({
        status: 'MATERIAL_CHANGE_DRAFTED',
        oldHash: result.response?.oldHash,
        newHash: result.response?.newHash,
        governedInputRef: result.response?.governedInputRef,
        targetCommand: {
          aggregateType: 'material_change',
          aggregateId: governed.proposalId,
          clientRequestId: cid(`plan-change:${governed.proposalId}`),
          aggregateVersion: result.aggregateVersion ?? 1,
        },
      });
      setGovernedPlanOpen(false);
      setWrite('IDLE');
    } catch {
      setWrite('FAILED');
    }
  };
  // Menu 2 (prawa strona) — "Dodaj sygnał" / "Przygotuj interwencję". Patrz
  // komentarz propa `onRegisterFilterControl` powyżej.
  useEffect(() => {
    if (!onRegisterFilterControl) return;
    onRegisterFilterControl(
      <div className="flex flex-wrap gap-2">
        {/* 1.12-R1 (C): CTA Menu 2 zakładki „Decyzje i ryzyka". */}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setNewDecisionOpen(true)}
        >
          {t('execution.governance.actions.newDecision', 'Nowa decyzja')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setInterventionComposerOpen(false);
            setShowInterventionForm(true);
            setShowSignalForm(true);
          }}
        >
          {t('execution.control.actions.addSignal', 'Add signal')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={draftSignalIds.length === 0}
          onClick={() => {
            setShowInterventionForm(true);
            setInterventionComposerOpen(true);
          }}
        >
          {t('execution.control.actions.prepareIntervention', 'Prepare intervention')}
        </button>
      </div>
    );
    return () => onRegisterFilterControl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterFilterControl, draftSignalIds]);
  if (state === 'ERROR')
    return (
      <div role="alert" className="m-4 rounded-xl border border-c-danger/40 p-4 text-sm">
        <p>Nie udało się załadować rejestru sterowania.</p>
        <button type="button" className="btn-secondary mt-3" onClick={() => void load()}>
          Spróbuj ponownie
        </button>
      </div>
    );
  return (
    <section aria-label="Decyzje i ryzyka" className="flex h-full min-h-0 flex-col p-4">
      {state === 'LOADING' && <p role="status">Ładowanie rejestru decyzji i ryzyk…</p>}
      {/*
        1.12-R1 (C): GŁÓWNA treść zakładki — rejestr decyzji i pozycji RAID
        z realnych tabel. Stoi PRZED warsztatem `runtime-v1`, bo to jest to,
        po co menedżer tu wchodzi (25 otwartych decyzji, 12 po terminie,
        16 pozycji RAID na pomiarze 06.09).
      */}
      {newDecisionOpen && (
        <div className="mb-3 rounded-lg border border-c-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <strong>Nowa decyzja</strong>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setNewDecisionOpen(false)}
            >
              Zamknij
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs">
              Tytuł decyzji
              <input
                aria-label="Tytuł nowej decyzji"
                value={newDecision.title}
                onChange={(event) =>
                  setNewDecision((current) => ({ ...current, title: event.target.value }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2"
              />
            </label>
            <label className="text-xs">
              Termin rozstrzygnięcia
              <input
                aria-label="Termin nowej decyzji"
                type="date"
                value={newDecision.dueDate}
                onChange={(event) =>
                  setNewDecision((current) => ({ ...current, dueDate: event.target.value }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2"
              />
            </label>
          </div>
          {newDecisionError && (
            <p role="alert" className="mt-2 text-xs text-c-danger">
              {newDecisionError}
            </p>
          )}
          <button
            type="button"
            className="btn-secondary mt-3"
            disabled={!newDecision.title.trim()}
            onClick={() => void createDecision()}
          >
            Zapisz decyzję
          </button>
        </div>
      )}
      <div className="mb-3 flex min-h-0 flex-1 flex-col">
        <TableWithPreviewLayout<GovernanceRow>
          selectedId={selectedGovernanceId}
          selectedItem={selectedGovernance}
          onSelect={setSelectedGovernanceId}
          itemIds={visibleGovernanceRows.map((row) => row.id)}
          getItemById={(id) => governanceRows.find((row) => row.id === id) ?? null}
          previewOpen={Boolean(selectedGovernanceId)}
          renderPreview={(row) => (
            <StandardPreview
              embedded
              title={row.title}
              onClose={() => setSelectedGovernanceId(null)}
              meta={{
                pills: [
                  { label: row.kindLabel, tone: 'neutral' },
                  {
                    label: row.escalation,
                    tone:
                      row.escalation === 'Czerwona'
                        ? 'danger'
                        : row.escalation === 'Bursztynowa'
                          ? 'warning'
                          : 'neutral',
                  },
                ],
                recommendation:
                  row.daysOverdue != null
                    ? `Po terminie o ${row.daysOverdue} dni — rozstrzygnij albo eskaluj.`
                    : 'Termin jeszcze nie minął.',
              }}
              details={{
                label: row.kind === 'DECISION' ? 'Decyzja' : 'Pozycja RAID',
                text:
                  row.source?.description ||
                  row.source?.recommendation ||
                  'Brak dodatkowego opisu.',
                properties: [
                  { id: 'owner', label: 'Właściciel', value: row.owner },
                  { id: 'due', label: 'Termin', value: row.dueAt },
                  {
                    id: 'overdue',
                    label: 'Dni po terminie',
                    value: row.daysOverdue == null ? 'Brak' : String(row.daysOverdue),
                  },
                  { id: 'escalation', label: 'Eskalacja', value: row.escalation },
                ],
              }}
              relationsEmptyLabel="Brak powiązań"
            />
          )}
        >
          <StandardTable
            columns={governanceColumns}
            data={visibleGovernanceRows}
            selectedRowId={selectedGovernanceId}
            onRowClick={(row) => setSelectedGovernanceId(row.id)}
            persistKey="execution.governance.v1"
            empty={{
              title:
                activeGovernancePreset === 'ryzyka'
                  ? 'Brak pozycji w rejestrze RAID'
                  : 'Brak decyzji do rozstrzygnięcia',
              description:
                'Rejestr czyta decyzje i pozycje RAID organizacji. Pusty rejestr znaczy, że nic nie czeka.',
            }}
          />
        </TableWithPreviewLayout>
      </div>
      {showInterventionForm && (
        <section
          aria-label="Intervention Signal Workbench"
          className="mt-4 flex min-h-0 flex-1 flex-col"
        >
          <h3 className="font-semibold">Sygnały zarządcze</h3>
          {showSignalForm && (
            <div className="mt-3 rounded-lg border border-c-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <strong>Nowy sygnał</strong>
                <button className="btn-secondary" onClick={() => setShowSignalForm(false)}>
                  Zamknij
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs">
                  Rodzaj sygnału
                  <select
                    aria-label="Management signal kind"
                    value={signalForm.kind}
                    onChange={(event) => {
                      const kind = event.target.value;
                      setSignalForm((current) => ({
                        ...current,
                        kind,
                        ruleId: kind,
                        sourceVersionKey:
                          kind === 'STALE_MILESTONE'
                            ? 'milestoneVersion'
                            : 'capacityScenarioVersion',
                      }));
                    }}
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  >
                    <option value="STALE_MILESTONE">Nieaktualny kamień milowy</option>
                    <option value="CAPACITY_CONFLICT">Konflikt obciążenia</option>
                  </select>
                </label>
                {Object.keys(signalForm)
                  .filter((key) => key !== 'kind')
                  .map((key) => (
                    <label key={key} className="text-xs">
                      {signalFieldLabels[key] ?? key}
                      {key === 'severity' ? (
                        <select
                          aria-label={`Management signal ${key}`}
                          value={signalForm.severity}
                          onChange={(event) =>
                            setSignalForm((current) => ({
                              ...current,
                              severity: event.target.value,
                            }))
                          }
                          className="block w-full rounded border border-c-border bg-c-surface p-2"
                        >
                          <option value="WARNING">Ostrzeżenie</option>
                          <option value="CRITICAL">Krytyczna</option>
                        </select>
                      ) : (
                        <input
                          aria-label={`Management signal ${key}`}
                          type={
                            key === 'occurredAt'
                              ? 'datetime-local'
                              : key === 'sourceVersion'
                                ? 'number'
                                : 'text'
                          }
                          value={signalForm[key as keyof typeof signalForm]}
                          onChange={(event) =>
                            setSignalForm((current) => ({ ...current, [key]: event.target.value }))
                          }
                          className="block w-full rounded border border-c-border bg-c-surface p-2"
                        />
                      )}
                    </label>
                  ))}
              </div>
              <button
                type="button"
                className="btn-secondary mt-3"
                onClick={() => void ingestSignal()}
              >
                Zapisz sygnał
              </button>
            </div>
          )}
          /* * Lancuch wysokosci - patrz komentarz w ExecutionResourcesSurface.tsx. *
          `TableWithPreviewLayout` ma root `h-full`; `height:100%` rozwiazuje sie * tylko wzgledem
          rodzica o definitywnej wysokosci. Pudelka `p-4`/`mt-4` * o wysokosci `auto` przerywaly ten
          lancuch i panel podgladu konczyl sie * na wlasnej tresci. Zmierzone narzedziem *
          `scripts/dev/measure-preview-canon.mjs --wysokosc`. */
          <div className="flex min-h-0 flex-1 flex-col">
            <TableWithPreviewLayout<SignalRow>
              selectedId={selectedSignalId}
              selectedItem={selectedSignal}
              onSelect={setSelectedSignalId}
              onOpenFull={(id) => {
                setShowInterventionForm(true);
                setInterventionComposerOpen(true);
                setDraftSignalIds((current) => (current.includes(id) ? current : [...current, id]));
                setSelectedSignalId(null);
              }}
              itemIds={signalRows.map((row) => row.id)}
              getItemById={(id) => signalRows.find((row) => row.id === id) ?? null}
              previewOpen={!interventionComposerOpen && Boolean(selectedSignalId)}
              renderPreview={(row) => (
                <StandardPreview
                  embedded
                  title={row.title}
                  onClose={() => setSelectedSignalId(null)}
                  onOpenFull={() => {
                    setShowInterventionForm(true);
                    setInterventionComposerOpen(true);
                    setDraftSignalIds((current) =>
                      current.includes(row.id) ? current : [...current, row.id]
                    );
                    setSelectedSignalId(null);
                  }}
                  openLabel="Otwórz przygotowanie"
                  meta={{
                    pills: [
                      {
                        label: row.severity,
                        tone: row.rawSeverity === 'CRITICAL' ? 'danger' : 'warning',
                      },
                    ],
                    recommendation: `Project ${row.signal.projectId ?? 'UNKNOWN'} · Reguła ${row.rule}`,
                  }}
                  details={{
                    label: 'Sygnał zarządczy',
                    text: `${row.signal.sourceType}:${row.signal.sourceId}`,
                    properties: [
                      { id: 'project', label: 'Projekt', value: row.signal.projectId ?? 'UNKNOWN' },
                      { id: 'fingerprint', label: 'Fingerprint', value: row.signal.fingerprint },
                      { id: 'occurrences', label: 'Wystąpienia', value: String(row.occurrences) },
                      { id: 'updated', label: 'Aktualizacja', value: row.updatedAt },
                    ],
                  }}
                  relations={[
                    { label: `Project ${row.signal.projectId ?? 'UNKNOWN'}` },
                    ...Object.entries(row.signal.sourceVersions ?? {}).map(([key, value]) => ({
                      label: `${key} v${value}`,
                    })),
                    ...(row.signal.occurrences ?? []).map((occurrence: any) => ({
                      label: occurrence.evidenceRef || 'EVIDENCE_MISSING',
                      value: occurrence.occurredAt,
                    })),
                  ]}
                  relationsEmptyLabel="Brak wersjonowanych źródeł"
                  actions={{
                    informational: [
                      {
                        id: 'add-to-intervention',
                        variant: 'neutral',
                        label: 'Dodaj do przygotowywanej interwencji',
                        onClick: () => {
                          setShowInterventionForm(true);
                          setDraftSignalIds((current) =>
                            current.includes(row.id) ? current : [...current, row.id]
                          );
                          setSelectedSignalId(null);
                        },
                      },
                    ],
                  }}
                />
              )}
            >
              <StandardTable
                columns={signalColumns}
                data={signalRows}
                selectedRowId={selectedSignalId}
                onRowClick={(row) => setSelectedSignalId(row.id)}
                onRowDoubleClick={(row) => {
                  setShowInterventionForm(true);
                  setInterventionComposerOpen(true);
                  setDraftSignalIds((current) =>
                    current.includes(row.id) ? current : [...current, row.id]
                  );
                  setSelectedSignalId(null);
                }}
                rowMenu={(row) => ({
                  primary: [
                    {
                      id: 'prepare-intervention',
                      label: t(
                        'execution.control.actions.prepareIntervention',
                        'Prepare intervention'
                      ),
                      onClick: () => {
                        setShowInterventionForm(true);
                        setInterventionComposerOpen(true);
                        setDraftSignalIds((current) =>
                          current.includes(row.id) ? current : [...current, row.id]
                        );
                        setSelectedSignalId(null);
                      },
                    },
                  ],
                  universalHandlers: { preview: () => setSelectedSignalId(row.id) },
                })}
                persistKey="execution.management-signals.v1"
              />
            </TableWithPreviewLayout>
          </div>
        </section>
      )}
      {/* 1.12-R1 (C): warsztat `runtime-v1` tylko gdy ma rekordy — inaczej pod
          realnym rejestrem decyzji rysowała się druga, pusta tabela. */}
      {hasRuntimeControlData && (
      <TableWithPreviewLayout<Row>
        selectedId={selectedId}
        selectedItem={selected}
        onSelect={setSelectedId}
        onOpenFull={(id) => {
          setSelectedId(id);
          setShowInterventionForm(true);
          setInterventionComposerOpen(true);
        }}
        itemIds={rows.map((r) => r.id)}
        getItemById={(id) => rows.find((r) => r.id === id) ?? null}
        previewOpen={!interventionComposerOpen && Boolean(selectedId)}
        renderPreview={(r) => (
          <StandardPreview
            embedded
            title={r.title}
            onClose={() => setSelectedId(null)}
            onOpenFull={() => {
              setShowInterventionForm(true);
              setInterventionComposerOpen(true);
            }}
            openLabel="Otwórz interwencję"
            meta={{
              pills: [
                { label: r.status, tone: r.rawStatus === 'ESCALATED' ? 'danger' : 'neutral' },
              ],
              recommendation: selectedOptionLabel(r.source)
                ? `Wybrana opcja: ${selectedOptionLabel(r.source)}`
                : 'Wymaga wyboru ograniczonej interwencji',
            }}
            details={{
              label: 'Uzasadnienie i skutek',
              text: r.source.hypotheses?.join(', ') || 'UNKNOWN',
              properties: [
                { id: 'owner', label: 'Właściciel', value: r.owner || 'UNASSIGNED' },
                { id: 'authority', label: 'Zatwierdzający', value: r.authority || 'UNKNOWN' },
                { id: 'sla', label: 'Termin weryfikacji', value: r.slaAt || 'UNKNOWN' },
                {
                  id: 'unknowns',
                  label: 'Niewiadome',
                  value: r.source.unknowns?.join(', ') || 'Brak',
                },
              ],
            }}
            relations={[
              ...(r.source.signalRefs ?? []).map((signal: any) => ({
                label: `${signal.signalId} v${signal.signalVersion}`,
              })),
              ...(r.source.options ?? []).map((option: any) => ({
                /**
                 * JĘZYK UCZCIWOŚCI: brak ma być NAZWANY, nigdy nie może wyciec
                 * jako `undefined`. Do 2026-09-02 etykieta była składana jako
                 * `${option.kind}: ${option.label}` bez żadnej osłony, więc opcja
                 * bez pola `kind` (atrapa `executionLocalReviewData.ts`, ale też
                 * każda przyszła odpowiedź serwera sprzed tej wersji kontraktu)
                 * dawała na ekranie literalne „undefined: Nie zmieniaj planu".
                 * Rodzaj opcji pokazujemy PO POLSKU, nie surowym kodem, a gdy
                 * go nie ma — nie pokazujemy przedrostka w ogóle.
                 */
                label: optionKindLabel(option.kind)
                  ? `${optionKindLabel(option.kind)}: ${option.label}`
                  : option.label,
                value: `${confidenceLabel(option.confidence)} · ${reversibilityLabel(option.reversibility)}`,
              })),
            ]}
            relationsEmptyLabel="Brak powiązanych sygnałów"
          />
        )}
      >
        <StandardTable
          columns={columns}
          data={rows}
          selectedRowId={selectedId}
          onRowClick={(r) => setSelectedId(r.id)}
          onRowDoubleClick={(r) => {
            setSelectedId(r.id);
            setShowInterventionForm(true);
            setInterventionComposerOpen(true);
          }}
          rowMenu={(r) => ({
            primary: [
              {
                id: 'open-intervention',
                label: 'Otwórz interwencję',
                onClick: () => {
                  setSelectedId(r.id);
                  setShowInterventionForm(true);
                  setInterventionComposerOpen(true);
                },
              },
            ],
            universalHandlers: { preview: () => setSelectedId(r.id) },
          })}
          persistKey="execution.control.v1"
          empty={{
            title: 'Brak spraw interwencyjnych',
            description:
              'Dodaj wersjonowany sygnał, aby przygotować pierwszą sprawę interwencyjną.',
          }}
        />
      </TableWithPreviewLayout>
      )}
      {interventionComposerOpen && (
        <section
          aria-label="Intervention Workbench"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Projekt interwencji</h3>
            <button className="btn-secondary" onClick={() => setInterventionComposerOpen(false)}>
              Zamknij
            </button>
          </div>
          {(!selected || selected.source.status === 'DRAFT') && (
            <>
              <p className="text-xs text-c-text-muted">Wybrane sygnały: {draftSignalIds.length}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {Object.keys(guided).map((key) => {
                  const long = [
                    'hypotheses',
                    'evidenceRefs',
                    'counterEvidenceRefs',
                    'unknowns',
                    'blastRadiusRefs',
                    'doNothingImpacts',
                    'actionImpacts',
                  ].includes(key);
                  return (
                    <label key={key} className="text-xs">
                      {interventionFieldLabels[key] ?? key}
                      {key === 'actionConfidence' || key === 'actionReversibility' ? (
                        <select
                          aria-label={`Intervention draft ${key}`}
                          value={guided[key as keyof typeof guided]}
                          onChange={(event) =>
                            setGuided((current) => ({ ...current, [key]: event.target.value }))
                          }
                          className="block w-full rounded border border-c-border bg-c-surface p-2"
                        >
                          {(key === 'actionConfidence'
                            ? ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH']
                            : ['UNKNOWN', 'REVERSIBLE', 'PARTIALLY_REVERSIBLE', 'IRREVERSIBLE']
                          ).map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      ) : long ? (
                        <textarea
                          aria-label={`Intervention draft ${key}`}
                          value={guided[key as keyof typeof guided]}
                          onChange={(event) =>
                            setGuided((current) => ({ ...current, [key]: event.target.value }))
                          }
                          className="block min-h-20 w-full rounded border border-c-border bg-c-surface p-2"
                        />
                      ) : (
                        <input
                          aria-label={`Intervention draft ${key}`}
                          type={key === 'slaAt' ? 'datetime-local' : 'text'}
                          value={guided[key as keyof typeof guided]}
                          onChange={(event) =>
                            setGuided((current) => ({ ...current, [key]: event.target.value }))
                          }
                          className="block w-full rounded border border-c-border bg-c-surface p-2"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm">Zaawansowany kontrakt JSON</summary>
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={advancedJson}
                    onChange={(event) => setAdvancedJson(event.target.checked)}
                  />
                  Użyj kontraktu JSON zamiast formularza
                </label>
                <textarea
                  aria-label="Intervention draft JSON"
                  value={draftJson}
                  onChange={(e) => setDraftJson(e.target.value)}
                  disabled={!advancedJson}
                  className="mt-2 min-h-32 w-full rounded border border-c-border bg-c-surface p-2 font-mono text-xs"
                />
              </details>
              <button className="btn-primary mt-3" onClick={() => void draft()}>
                Zapisz lub połącz sprawę interwencyjną
              </button>
            </>
          )}
          {(!selected || ['DRAFT', 'PENDING_DECISION'].includes(selected.source.status)) && (
            <section className="mt-4 rounded border border-c-border p-3">
              <h4 className="font-medium">Niezależna decyzja</h4>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_2fr_auto]">
                <button className="btn-secondary" onClick={() => void transition('REQUEST')}>
                  Poproś o decyzję
                </button>
                <input
                  aria-label="Intervention selected option"
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                />
                <textarea
                  aria-label="Intervention rationale"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                />
                <button className="btn-secondary" onClick={() => void transition('DECIDE')}>
                  Zatwierdź wariant
                </button>
              </div>
            </section>
          )}
          <section className="mt-4 rounded border border-c-border p-3">
            <h4 className="font-medium">Zastosowanie zatwierdzonej komendy</h4>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Object.keys(apply).map((k) => (
                <label key={k} className="text-xs">
                  {applyFieldLabels[k] ?? k}
                  <input
                    aria-label={`Intervention ${k}`}
                    type={k === 'verifyBy' ? 'datetime-local' : 'text'}
                    value={(apply as any)[k]}
                    onChange={(e) => setApply((v) => ({ ...v, [k]: e.target.value }))}
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded border border-c-border p-3">
              <div>
                <h4 className="font-medium">Zarządzana zmiana planu</h4>
                <p className="text-xs text-c-text-muted">
                  Zmiana kolejności przechodzi przez kontrolowaną zmianę planu i niezależne
                  zatwierdzenie.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setGovernedPlanOpen((open) => !open)}
              >
                {governedPlanOpen ? 'Zamknij zmianę planu' : 'Przygotuj zmianę planu'}
              </button>
            </div>
            {governedPlanOpen && (
              <section
                aria-label="Governed Plan resequence"
                className="mt-3 rounded border border-c-border p-3"
              >
                <h4 className="font-medium">Zarządzana zmiana kolejności</h4>
                <p className="text-xs text-c-text-muted">
                  Wybrana opcja zmiany kolejności tworzy jedną kontrolowaną zmianę bazowego planu.
                  Przegląd i publikacja odbywają się w Mojej pracy, a zastosowanie wymaga dokładnego
                  potwierdzenia komendy.
                </p>
                <label className="block text-xs">
                  Wybrane porównanie obciążenia
                  <select
                    aria-label="Governed comparison"
                    value={governed.comparisonId}
                    onChange={(e) =>
                      setGoverned((v) => ({
                        ...v,
                        comparisonId: e.target.value,
                        planScenarioId:
                          capacityOptions.find((x) => x.comparisonId === e.target.value)?.planRef
                            ?.scenarioId ?? '',
                      }))
                    }
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  >
                    <option value="">Wybierz dokładną opcję zmiany kolejności</option>
                    {capacityOptions.map((x) => (
                      <option key={x.comparisonId} value={x.comparisonId}>
                        {x.comparisonId} v{x.version} · {x.selectedOptionId} · Plan{' '}
                        {x.planRef.scenarioId} v{x.planRef.version}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {Object.entries(governed)
                    .filter(([key]) => key !== 'comparisonId')
                    .map(([key, value]) => (
                      <label key={key} className="text-xs">
                        {key}
                        {['oldSnapshot', 'newSnapshot', 'affected', 'blastRadius'].includes(key) ? (
                          <textarea
                            aria-label={`Governed ${key}`}
                            className="block min-h-24 w-full rounded border border-c-border bg-c-surface p-2 font-mono"
                            value={value}
                            onChange={(e) => setGoverned((v) => ({ ...v, [key]: e.target.value }))}
                          />
                        ) : (
                          <input
                            aria-label={`Governed ${key}`}
                            className="block w-full rounded border border-c-border bg-c-surface p-2"
                            value={value}
                            readOnly={key === 'planScenarioId'}
                            onChange={(e) => setGoverned((v) => ({ ...v, [key]: e.target.value }))}
                          />
                        )}
                      </label>
                    ))}
                </div>
                <button
                  className="btn-secondary mt-2"
                  onClick={() => void createGovernedPlanChange()}
                >
                  Utwórz zarządzaną zmianę planu
                </button>
              </section>
            )}
            <button className="btn-primary mt-3" onClick={() => void transition('APPLY')}>
              Zastosuj potwierdzoną komendę
            </button>
          </section>
          <section className="mt-4 rounded border border-c-border p-3">
            <h4 className="font-medium">Weryfikacja efektu</h4>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[220px_1fr_auto]">
              <select
                aria-label="Intervention verification outcome"
                value={verifyOutcome}
                onChange={(e) => setVerifyOutcome(e.target.value)}
                className="block w-full rounded border border-c-border bg-c-surface p-2"
              >
                {['EFFECTIVE', 'PARTIAL', 'INEFFECTIVE', 'NOT_VERIFIED'].map((x) => (
                  <option key={x} value={x}>
                    {verificationOutcomeLabel(x)}
                  </option>
                ))}
              </select>
              <textarea
                aria-label="Intervention verification evidence"
                value={verificationEvidence}
                onChange={(e) => setVerificationEvidence(e.target.value)}
                className="min-h-20 w-full rounded border border-c-border bg-c-surface p-2"
              />
              <button className="btn-secondary" onClick={() => void transition('VERIFY')}>
                Zweryfikuj interwencję
              </button>
            </div>
          </section>
          {write === 'FAILED' && <p role="alert">Nie zastosowano zmiany.</p>}
          {receipt && (
            <div role="status" className="rounded border border-c-success/40 p-3">
              <strong>{interventionStatusLabel(receipt.status)}</strong>
              {receipt.targetCommand && (
                <p>
                  Potwierdzenie komendy docelowej {receipt.targetCommand.clientRequestId} ·{' '}
                  {receipt.targetCommand.aggregateType}/{receipt.targetCommand.aggregateId} v
                  {receipt.targetCommand.aggregateVersion}
                </p>
              )}
              {receipt.oldHash && (
                <p>
                  Hash planu przed zmianą {receipt.oldHash} → po zmianie {receipt.newHash}
                </p>
              )}
              {receipt.verification && (
                <p>
                  {receipt.verification.outcome === 'EFFECTIVE'
                    ? 'Skuteczna · zamknięta'
                    : `${verificationOutcomeLabel(receipt.verification.outcome)} · eskalowana`}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </section>
  );
};

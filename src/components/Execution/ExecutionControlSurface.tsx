import {
  ArrowUpCircle,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  ShieldAlert,
  UserCog,
  Wrench,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardPreview } from '@/components/standard';
import { Menu2PresetDropdown } from '@/components/standard/Menu2PresetDropdown';
import { ReasonDialog } from '@/components/standard/ReasonDialog';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  memberNameOrUnknown,
  type MemberNameResolver,
  readMemberId,
  readMemberLabel,
  useOrganizationMemberNames,
} from '@/hooks/useOrganizationMemberNames';
import { Api, ApiError } from '@/services/api';
import { OrganizationApi } from '@/services/api/organizations.api';
import {
  createRaidItem,
  newRaidItemId,
  RaidWriteError,
  seedRaidVersions,
  updateRaidItem,
} from '@/services/initiatives-execution/raidWrites';
import {
  createMaterialChange,
  draftIntervention,
  ingestManagementSignal,
  listCapacityOptions,
  listInterventions,
  listManagementSignals,
  transitionIntervention,
} from '@/services/initiatives-execution/runtimeApi';
import { useAppStore } from '@/store/useAppStore';
import { formatListDate, formatListDateTime } from '@/utils/listDateFormat';

import { MENU_2_FILTERS_ROW } from '@/components/shared/ModuleMenu3';

import {
  countExecutionPresets,
  type ExecutionMenu3Contract,
  type ExecutionSurfacePrimaryCta,
} from './canonicalMenu3';
import {
  type DecyzjaRodowod,
  powodySygnaluLabel,
  RODZAJ_DECYZJI_REBASELINE,
  rodzajSygnaluLabel,
  stanSygnalu,
  stanSygnaluLabel,
  type StanSygnalu,
  type SygnalOpoznienia,
  terminInterwencji,
  tytulInterwencji,
  ZRODLO_SYGNALU,
} from './delaySignals';
import {
  executionLocalReviewEnabled,
  executionReviewInterventions,
  executionReviewPeople,
  executionReviewRoleLabel,
  executionReviewSignals,
} from './executionLocalReviewData';
import {
  decisionDaysOverdue,
  filterInFlightInitiatives,
  isArchivedDecision,
  isDecisionOverdue,
  isResolvedDecision,
} from './executionRealData';
import {
  czyRaidOtwarty,
  czyRaidPoTerminie,
  ekspozycjaRaid,
  opisEskalacjiRyzyka,
  opisPoPrzeksztalceniu,
  pasmoEkspozycji,
  RAID_PRAWDOPODOBIENSTWO,
  RAID_PRAWDOPODOBIENSTWO_OPCJE,
  RAID_STATUS_KONCOWY,
  RAID_TYPY,
  RAID_WPLYW,
  RAID_WPLYW_OPCJE,
  raidDniPoTerminie,
  type RaidTyp,
  zrodloEskalacji,
} from './raidGovernance';

const interventionFieldLabels = (t: (key: string, fallback: string) => string): Record<string, string> => ({
  interventionId: t('execution.intervention.field.id', 'Intervention identifier'),
  ownerId: t('execution.intervention.field.owner', 'Owner'),
  authorityId: t('execution.intervention.field.authority', 'Independent approver'),
  slaAt: t('execution.intervention.field.sla', 'Decision deadline'),
  hypotheses: t('execution.intervention.field.hypotheses', 'Hypotheses'),
  evidenceRefs: t('execution.intervention.field.evidence', 'Evidence'),
  counterEvidenceRefs: t('execution.intervention.field.counterEvidence', 'Counter-evidence'),
  unknowns: t('execution.intervention.field.unknowns', 'Unknowns'),
  blastRadiusRefs: t('execution.intervention.field.blastRadius', 'Impact on linked objects'),
  doNothingLabel: t('execution.intervention.field.doNothing', 'Do-nothing option'),
  doNothingImpacts: t('execution.intervention.field.doNothingImpacts', 'Do-nothing consequences'),
  actionOptionId: t('execution.intervention.field.optionId', 'Option identifier'),
  actionLabel: t('execution.intervention.field.actionLabel', 'Action name'),
  actionImpacts: t('execution.intervention.field.actionImpacts', 'Action consequences'),
  actionConfidence: t('execution.intervention.field.confidence', 'Confidence'),
  actionReversibility: t('execution.intervention.field.reversibility', 'Reversibility'),
});

const applyFieldLabels = (t: (key: string, fallback: string) => string): Record<string, string> => ({
  receiptId: t('execution.apply.field.receiptId', 'Command receipt'),
  aggregateType: t('execution.apply.field.aggregateType', 'Object type'),
  aggregateId: t('execution.apply.field.aggregateId', 'Target object'),
  version: t('execution.apply.field.version', 'Version'),
  state: t('execution.apply.field.state', 'Expected state'),
  verifyBy: t('execution.apply.field.verifyBy', 'Verification deadline'),
  expectedEffect: t('execution.apply.field.expectedEffect', 'Expected effect'),
  measurementRef: t('execution.apply.field.measurementRef', 'Measurement source'),
  measurementVersion: t('execution.apply.field.measurementVersion', 'Measurement version'),
});
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
/** J7b: data przez SSOT list — było `Intl.DateTimeFormat('pl-PL')`. */
const formatDateTime = (value: string | null | undefined) =>
  formatListDateTime(value, 'UNKNOWN');
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
const slownikEN = (
  value: string,
  prefiks: string,
  mapa: Record<string, string>,
  t: (key: string, fallback: string) => string
) => {
  const klucz = String(value ?? '');
  if (mapa[klucz]) return t(`${prefiks}.${klucz.toLowerCase()}`, mapa[klucz]);
  return klucz;
};
const interventionStatusLabel = (value: string, t: (key: string, fallback: string) => string) =>
  slownikEN(
    value,
    'execution.intervention.status',
    {
      DRAFT: 'Draft',
      PENDING_DECISION: 'Awaiting decision',
      APPROVED: 'Approved',
      APPLIED: 'Applied',
      ESCALATED: 'Escalated',
      CLOSED: 'Closed',
    },
    t
  );
const signalRuleLabel = (value: string, t: (key: string, fallback: string) => string) =>
  slownikEN(
    value,
    'execution.signals.rule',
    { STALE_MILESTONE: 'Stale milestone', CAPACITY_CONFLICT: 'Capacity conflict' },
    t
  );
const severityLabel = (value: string, t: (key: string, fallback: string) => string) =>
  slownikEN(value, 'execution.signals.severity', { WARNING: 'Warning', CRITICAL: 'Critical' }, t);
const verificationOutcomeLabel = (value: string, t: (key: string, fallback: string) => string) =>
  slownikEN(
    value,
    'execution.intervention.outcome',
    {
      EFFECTIVE: 'Effective',
      PARTIAL: 'Partially effective',
      INEFFECTIVE: 'Ineffective',
      NOT_VERIFIED: 'Not verified',
    },
    t
  );
/**
 * Rodzaj opcji interwencji (kontrakt `InterventionOption.kind`) — po polsku.
 * Zwraca `null`, gdy pola nie ma: przedrostek jest wtedy POMIJANY, zamiast
 * wyciekać jako `undefined` albo surowy kod na ekran (defekt 2026-09-02).
 */
const optionKindLabel = (
  value: unknown,
  t: (key: string, fallback: string) => string
): string | null =>
  typeof value === 'string' && value.trim()
    ? slownikEN(value, 'execution.intervention.optionKind', {
        DO_NOTHING: 'No change',
        ACTION: 'Action',
      }, t)
    : null;
/** Pewność opcji — nazwana wprost, brak nazywany „Nieznana", nie `undefined`. */
const confidenceLabel = (value: unknown, t: (key: string, fallback: string) => string): string =>
  typeof value === 'string' && value.trim()
    ? slownikEN(value, 'execution.intervention.confidence', {
        HIGH: 'High confidence',
        MEDIUM: 'Medium confidence',
        LOW: 'Low confidence',
        UNKNOWN: 'Confidence unknown',
      }, t)
    : t('execution.intervention.confidence.unknown', 'Confidence unknown');
/** Odwracalność opcji — słownik kontraktu, brak nazywany wprost. */
const reversibilityLabel = (
  value: unknown,
  t: (key: string, fallback: string) => string
): string =>
  typeof value === 'string' && value.trim()
    ? slownikEN(value, 'execution.intervention.reversibility', {
        REVERSIBLE: 'Reversible',
        PARTIALLY_REVERSIBLE: 'Partially reversible',
        IRREVERSIBLE: 'Irreversible',
        UNKNOWN: 'Reversibility unknown',
      }, t)
    : t('execution.intervention.reversibility.unknown', 'Reversibility unknown');
const signalFieldLabels = (t: (key: string, fallback: string) => string): Record<string, string> => ({
  sourceId: t('execution.signals.field.sourceId', 'Signal source'),
  sourceVersionKey: t('execution.signals.field.sourceVersionKey', 'Source version kind'),
  sourceVersion: t('execution.signals.field.sourceVersion', 'Source version'),
  snapshotRef: t('execution.signals.field.snapshotRef', 'Source evidence / snapshot'),
  ruleId: t('execution.signals.field.ruleId', 'Detection rule'),
  severity: t('execution.signals.field.severity', 'Severity'),
  occurredAt: t('execution.signals.field.occurredAt', 'Occurred at'),
});
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
/**
 * P16/R5 (DEC-453, §4 D4): TRZECI PRESET TO „SYGNAŁY", nie „Po terminie".
 *
 * Kanon Triady dopuszcza NAJWYŻEJ TRZY chipy Menu 3, a §4 D4 wymaga presetu
 * „Sygnały (N)" obok Decyzji i Ryzyk. „Po terminie" nie znika — schodzi do
 * Menu 2 jako FILTR TERMINU (`Menu2PresetDropdown`, ten sam wzorzec, którym
 * DEC-420/423 rozwiązały ten sam konflikt w Inicjatywach i Materiałach).
 * Zysk: filtr działa w KAŻDYM z trzech widoków i nie odbiera miejsca
 * trzeciemu rejestrowi.
 */
const controlPresets = ['decyzje', 'ryzyka', 'sygnaly'] as const;

/** Filtr terminu z Menu 2 — wspólny dla decyzji, RAID i sygnałów. */
const filtryTerminu = ['wszystkie', 'po-terminie'] as const;
type FiltrTerminu = (typeof filtryTerminu)[number];

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
  /**
   * P16/R3 (DEC-453) — pola WYŁĄCZNIE decyzyjne. RAID zostawia je puste; jego
   * zestaw kolumn (R4) nigdy po nie nie sięga.
   */
  /** Identyfikator decyzji BEZ przedrostka `decision:` — do wołania API. */
  decisionId?: string;
  /** Osoba, od której decyzja jest oczekiwana (`decision_maker_id`). */
  decydent?: string;
  /** Status po polsku: Oczekuje / Eskalowana / Rozstrzygnięta / Odrzucona / Nieaktualna. */
  statusLabel?: string;
  /** Status z API (PENDING/ESCALATED/APPROVED/REJECTED/SUPERSEDED). */
  rawStatus?: string;
  /** Krok eskalacji 0..3 (licznik z `decision_escalation_log`, nie barwa). */
  escalationStep?: number;
  /** Czy TEN użytkownik może rozstrzygnąć (decydent albo ADMIN) — patrz `canDecide`. */
  canDecide?: boolean;
  /** Uzasadnienie rozstrzygnięcia — pokazywane w podglądzie, nieusuwalne. */
  rationale?: string;
  decidedAt?: string | null;
  /**
   * P16/R4 (DEC-453) — pola WYŁĄCZNIE pozycji RAID. Decyzja zostawia je puste;
   * zestaw kolumn decyzji nigdy po nie nie sięga.
   */
  /** Identyfikator pozycji BEZ przedrostka `raid:` — do wołania writera. */
  raidId?: string;
  /** Inicjatywa, do której pozycja należy — kanoniczna komenda jej wymaga. */
  raidInitiativeId?: string | null;
  /** Nazwa inicjatywy z rejestru (albo identyfikator, gdy jej nie znamy). */
  raidInitiativeName?: string;
  /** Typ pozycji z bazy (RISK/ISSUE/DEPENDENCY/ASSUMPTION). */
  rawRaidType?: string;
  /** Prawdopodobieństwo i wpływ — słowniki bazy, PL w kolumnie. */
  rawProbability?: string | null;
  rawImpact?: string | null;
  probabilityLabel?: string;
  impactLabel?: string;
  /** EKSPOZYCJA = prawdopodobieństwo × wpływ. LICZONA, tylko do odczytu. */
  exposure?: number | null;
  /** Status pozycji z bazy i po polsku. */
  rawRaidStatus?: string;
  raidStatusLabel?: string;
  /** Właściciel (identyfikator) — potrzebny przy zmianie właściciela. */
  ownerId?: string | null;
  /** Opis — niesie link do pozycji źródłowej po eskalacji ryzyko → problem. */
  description?: string | null;
}

/** Wiersz rejestru SYGNAŁÓW OPÓŹNIEŃ (P16/R5, `/execution-control/delay-signals`). */
interface DelayRow extends TableRow {
  id: string;
  /** Kolumna główna tabeli — patrz komentarz przy `buildDelayColumns`. */
  title: string;
  /** Obiekt, którego dotyczy sygnał (inicjatywa albo zadanie) — nazwa, nie id. */
  entityName: string;
  entityType: string;
  entityId: string;
  /** Rodzaj odchylenia po polsku. */
  kindLabel: string;
  /** Odchylenie w dniach (liczba, nie tekst — sortowanie ma działać). */
  deviationDays: number;
  /** Powody `whySlipReasons` po polsku, złączone. */
  reasonLabel: string;
  /** Data wykrycia. */
  detectedAt: string;
  rawDetectedAt: string;
  /** Stan liczony z rejestru decyzji (serwer nie trzyma stanu sygnału). */
  state: StanSygnalu;
  stateLabel: string;
  /** Decyzja re-baseline powiązana z tym sygnałem (gdy istnieje). */
  decisionId: string | null;
  severity: string;
  signal: SygnalOpoznienia;
}

/**
 * KROK ESKALACJI po polsku — licznik, nie dotkliwość (P16/R3, DEC-453).
 *
 * Trzy poziomy z §4.3 audytu rynku: 1 właściciel inicjatywy → 2 PMO →
 * 3 komitet. Serwer liczy krok z `decision_escalation_log`
 * (`escalationStep`), a barwa `escalationLevelName` (none/amber/red) zostaje
 * osobno jako DOTKLIWOŚĆ — nie mieszamy tych dwóch rzeczy w jednej kolumnie,
 * bo to był dokładnie defekt kolumny „Typ" przed R3.
 */
const ESCALATION_STEP_MAX = 3;

/** Adresat poziomu: 1 właściciel inicjatywy · 2 PMO · 3 komitet. */
const escalationAddressee = (
  step: number,
  t: (key: string, fallback: string) => string
): string =>
  step === 1
    ? t('execution.decisions.escalation.level1', 'Initiative owner')
    : step === 2
      ? t('execution.decisions.escalation.level2', 'PMO')
      : t('execution.decisions.escalation.level3', 'Komitet');

/**
 * KOLUMNA — sam licznik („2/3"), jedna linia.
 *
 * Adresat („PMO", „Komitet") NIE wchodzi do kolumny celowo: przy szerokości
 * kanonicznej „1/3 · Właściciel inicjatywy" łamał się na dwie linie i rozpychał
 * wiersz (zmierzone na zrzucie), a wiersz tabeli ma być jednolinijkowy. Kto
 * jest adresatem — mówi podgląd i tooltip (`escalationStepLabel` niżej).
 */
const escalationStepShort = (
  step: number,
  t: (key: string, fallback: string) => string
): string =>
  !step || step <= 0
    ? t('execution.decisions.escalation.none', 'None')
    : `${step}/${ESCALATION_STEP_MAX}`;

/** PODGLĄD — licznik z adresatem („2/3 · PMO"). */
const escalationStepLabel = (
  step: number,
  t: (key: string, fallback: string) => string
): string =>
  !step || step <= 0
    ? t('execution.decisions.escalation.none', 'None')
    : `${step}/${ESCALATION_STEP_MAX} · ${escalationAddressee(step, t)}`;

/**
 * TYP POZYCJI RAID — J7b. Do 08.09 słownik był polski wprost, więc kolumna
 * „TYPE" na koncie EN pisała „Ryzyko / Problem / Zależność" (zrzut PRZED
 * `evidence/jezyk-j7/przed/11-ryzyka-lista-en.png`) — to jest dokładnie dług
 * J7 wypisany w D4 (`evidence/dane-pokazowe-en/d4/dlug-j7-polskie-napisy-ui.txt`).
 */
const raidTypeLabel = (value: unknown, t: (key: string, fallback: string) => string): string => {
  const angielskie: Record<string, string> = {
    RISK: 'Risk',
    ISSUE: 'Issue',
    DEPENDENCY: 'Dependency',
    ASSUMPTION: 'Assumption',
    ACTION: 'Action',
  };
  const klucz = String(value ?? '').toUpperCase();
  if (angielskie[klucz]) return t(`execution.raid.type.${klucz.toLowerCase()}`, angielskie[klucz]);
  return String(value ?? '—');
};

/**
 * STATUS DECYZJI (P16/R3, DEC-453) — pięć stanów rejestru z §4.3 audytu rynku:
 * Oczekuje · Eskalowana · Rozstrzygnięta · Odrzucona · Nieaktualna.
 *
 * Przed R3 ta etykieta lądowała w kolumnie „Typ" (obok TYPU pozycji RAID w tej
 * samej kolumnie) — dwie różne semantyki pod jednym nagłówkiem. Teraz ma
 * własną kolumnę „Status", a „Typ" zostaje wyłącznie przy RAID.
 *
 * `APPROVED` nazywa się po polsku „Rozstrzygnięta", nie „Zatwierdzona":
 * w rejestrze decyzji chodzi o to, że wynik ZAPADŁ, a nie o zgodę na cudzy
 * wniosek.
 */
const decisionStatusLabel = (
  value: unknown,
  t: (key: string, fallback: string) => string
): string => {
  const key = String(value ?? '').toUpperCase();
  const slownik: Record<string, string> = {
    PENDING: t('execution.decisions.status.pending', 'Oczekuje'),
    ESCALATED: t('execution.decisions.status.escalated', 'Eskalowana'),
    APPROVED: t('execution.decisions.status.approved', 'Resolved'),
    REJECTED: t('execution.decisions.status.rejected', 'Odrzucona'),
    SUPERSEDED: t('execution.decisions.status.superseded', 'Nieaktualna'),
    RETURNED_FOR_CLARIFICATION: t('execution.decisions.status.returned', 'Returned for completion'
    ),
    DEFERRED: t('execution.decisions.status.deferred', 'Odroczona'),
    CANCELLED: t('execution.decisions.status.cancelled', 'Anulowana'),
  };
  return slownik[key] ?? String(value ?? '—');
};

/**
 * Właściciel pozycji RAID — nazwisko z katalogu organizacji, nigdy UUID.
 * Kolejność: gotowa nazwa z API → katalog organizacji → „Nieznany
 * użytkownik" dla identyfikatora → „Nieprzypisana" dla pustki.
 */
const raidOwnerLabel = (
  item: any,
  resolveMemberName?: MemberNameResolver,
  isPolish = true
): string => {
  if (item?.ownerName) return String(item.ownerName);
  const id = String(item?.ownerId ?? '').trim();
  if (!id) return isPolish ? 'Nieprzypisana' : 'Unassigned';
  return resolveMemberName?.(id) ?? memberNameOrUnknown(resolveMemberName, id, isPolish);
};

const severityToEscalation = (value: unknown): string =>
  ({ CRITICAL: 'Czerwona', HIGH: 'Czerwona', MEDIUM: 'Bursztynowa', LOW: 'Brak' })[
    String(value ?? '').toUpperCase()
  ] ?? 'Brak';

/**
 * PRAWDOPODOBIEŃSTWO i WPŁYW po polsku, Z LICZBĄ ze skali (P16/R4).
 *
 * Liczba stoi obok słowa celowo: bez niej kolumna „Ekspozycja" byłaby jedyną
 * liczbą na ekranie, której nie da się sprawdzić w pamięci („Wysokie razy
 * Krytyczny = 20?"). Ze skalą widoczną w obu składnikach iloczyn wyjaśnia się
 * sam — §10 paczki: zero liczb, których nie da się wyjaśnić jednym zdaniem.
 */
const raidProbabilityLabel = (
  value: unknown,
  t: (key: string, fallback: string) => string
): string => {
  const key = String(value ?? '').toUpperCase();
  const slownik: Record<string, string> = {
    LOW: t('execution.raid.probability.low', 'Niskie'),
    MEDIUM: t('execution.raid.probability.medium', 'Medium'),
    HIGH: t('execution.raid.probability.high', 'Wysokie'),
  };
  const nazwa = slownik[key];
  if (!nazwa) return '—';
  return `${nazwa} (${RAID_PRAWDOPODOBIENSTWO[key]})`;
};

const raidImpactLabel = (value: unknown, t: (key: string, fallback: string) => string): string => {
  const key = String(value ?? '').toUpperCase();
  const slownik: Record<string, string> = {
    LOW: t('execution.raid.impact.low', 'Niski'),
    MEDIUM: t('execution.raid.impact.medium', 'Medium'),
    HIGH: t('execution.raid.impact.high', 'Wysoki'),
    CRITICAL: t('execution.raid.impact.critical', 'Krytyczny'),
  };
  const nazwa = slownik[key];
  if (!nazwa) return '—';
  return `${nazwa} (${RAID_WPLYW[key]})`;
};

/** Status pozycji RAID po polsku (słownik `RaidItemCreateSchema`). */
const raidStatusPl = (value: unknown, t: (key: string, fallback: string) => string): string => {
  const key = String(value ?? 'OPEN').toUpperCase();
  const slownik: Record<string, string> = {
    OPEN: t('execution.raid.status.open', 'Otwarta'),
    MITIGATED: t('execution.raid.status.mitigated', 'Ograniczona'),
    REALIZED: t('execution.raid.status.realized', 'Zmaterializowana'),
    CLOSED: t('execution.raid.status.closed', 'Closed'),
  };
  return slownik[key] ?? String(value ?? '—');
};

/** J7b: data przez SSOT list — było `Intl.DateTimeFormat('pl-PL')`. */
const formatDay = (value: string | null | undefined) => formatListDate(value);

/**
 * DWA ZESTAWY KOLUMN, nie jeden (P16/R3, DEC-453 + AUDYT_RYNKU_PMO §4.3).
 *
 * Przełącznik Menu 3 „Decyzje / Ryzyka" (DEC-426) zmienia ZESTAW KOLUMN, nie
 * sam filtr — bo decyzja i pozycja RAID opisują się różnymi polami:
 *   · decyzja  — Tytuł · Potrzebna do dnia · Decydent · Status · Dni po terminie · Eskalacja,
 *   · RAID     — Tytuł · Typ · Właściciel · Termin · Dni po terminie · Eskalacja.
 * Przed R3 jedna wspólna kolumna „Typ" pokazywała STATUS decyzji (Oczekuje /
 * Eskalowana) dla jednych wierszy i TYP pozycji (Ryzyko / Problem) dla drugich.
 * Kolumny RAID (prawdopodobieństwo, wpływ, ekspozycja) domyka R4 — tu zostaje
 * dokładnie to, co RAID miał przed R3, żeby nie ruszać cudzego kroku.
 */
const kolumnaTytul = (t: (key: string, fallback: string) => string): TableColumn => ({
  id: 'title',
  label: t('execution.governance.columns.title', 'Title'),
  sortable: true,
  width: '300px',
});

const kolumnaDniPoTerminie = (t: (key: string, fallback: string) => string): TableColumn => ({
  id: 'daysOverdue',
  label: t('execution.governance.columns.daysOverdue', 'Dni po terminie'),
  sortable: true,
  width: '130px',
  render: (row) => {
    const days = row.daysOverdue as number | null;
    if (days == null) return <span className="text-c-text-muted">—</span>;
    return <span className="font-semibold tabular-nums text-c-danger">+{days}</span>;
  },
});

/** Kolumny DECYZJI (P16/R3). */
const buildDecisionColumns = (t: (key: string, fallback: string) => string): TableColumn[] => [
  kolumnaTytul(t),
  {
    id: 'dueAt',
    label: t('execution.decisions.columns.due', 'Potrzebna do dnia'),
    sortable: true,
    width: '150px',
  },
  {
    id: 'decydent',
    label: t('execution.decisions.columns.decisionMaker', 'Decydent'),
    sortable: true,
    width: '170px',
  },
  {
    id: 'statusLabel',
    label: t('execution.decisions.columns.status', 'Status'),
    sortable: true,
    filterable: true,
    width: '140px',
    render: (row) => {
      const raw = String(row.rawStatus ?? '').toUpperCase();
      // Zero crimsona na danych: „Odrzucona" to WYNIK, nie awaria. Czerwień w
      // tej kolumnie zostaje wyłącznie dla stanu, który krzyczy o działanie
      // (Eskalowana) — kanon: primary/crimson tylko dla semantyki krytycznej.
      const tone =
        raw === 'ESCALATED'
          ? 'text-c-danger'
          : raw === 'PENDING'
            ? 'text-c-text-primary'
            : 'text-c-text-muted';
      return <span className={`font-medium ${tone}`}>{String(row.statusLabel ?? '')}</span>;
    },
  },
  kolumnaDniPoTerminie(t),
  {
    id: 'escalation',
    label: t('execution.governance.columns.escalation', 'Eskalacja'),
    sortable: true,
    filterable: true,
    width: '130px',
    render: (row) => {
      const step = Number(row.escalationStep ?? 0);
      const tone =
        step >= ESCALATION_STEP_MAX
          ? 'text-c-danger'
          : step > 0
            ? 'text-c-warning'
            : 'text-c-text-muted';
      return (
        <span className={`font-medium tabular-nums ${tone}`} title={escalationStepLabel(step, t)}>
          {escalationStepShort(step, t)}
        </span>
      );
    },
  },
];

/**
 * Kolumny RAID (P16/R4, DEC-453 + AUDYT_RYNKU_PMO §4.3 wiersz „Kolumny (RAID)").
 *
 * Tytuł · Typ · Właściciel · Termin · Prawdopodobieństwo · Wpływ ·
 * **Ekspozycja** · Status · Dni po terminie.
 *
 * Kolumna „Eskalacja" ZNIKA z tego zestawu: przed R4 pokazywała
 * `severityToEscalation(item.severity)`, czyli DOTKLIWOŚĆ przemalowaną na
 * słowo „Czerwona/Bursztynowa" — dokładnie ta sama pomyłka semantyczna, którą
 * R3 usunął z kolumny „Typ" (jedna nazwa, dwie różne rzeczy). Dotkliwość
 * niesie teraz WPROST kolumna „Wpływ", a ryzyko wysokie widać po ekspozycji.
 */
const buildRaidColumns = (t: (key: string, fallback: string) => string): TableColumn[] => [
  /*
    SZEROKOŚCI ZMIERZONE, NIE ZGADNIĘTE (1440 px, P2_TABELA_NIE_UCINA).
    Pomiar 07.09 `.local/mierz.mjs`: kontener tabeli 1270 px, kolumna akcji
    (sticky) 80 px → 1190 px na dane. Podłogi `FilterableTable` (typ kolumny
    ORAZ zmierzony nagłówek) dla DZIEWIĘCIU kolumn dawały 1415 px — tabela
    wychodziła 1595 px i „Status" oraz „Dni po terminie" znikały pod przypiętą
    kolumną akcji (nie ucięcie tekstu, tylko OKLUZJA). Dlatego:
      · `dataType` ustawiony na każdej kolumnie (obniża podłogę typu),
      · „Prawdopodobieństwo" bez filtra (nagłówek 18 znaków to najdroższa
        podłoga na ekranie; filtrowanie zostaje na Typie, Wpływie i Statusie),
      · „Dni po terminie" `defaultVisible: false` — DZIEWIĄTA kolumna fizycznie
        się nie mieści, a jest jedyną w pełni WYLICZALNĄ z sąsiedniej („Termin"):
        ten sam zbiór wierszy pokazuje filtr „Po terminie" w Menu 2, liczbę
        podaje podgląd, a pstryczek kolumn dokłada ją jednym kliknięciem.
    UWAGA O `dataType`: w `FilterableTable` to pole ma DOKŁADNIE JEDNO
    zastosowanie — wybiera PODŁOGĘ SZEROKOŚCI kolumny
    (`COLUMN_MIN_WIDTH_BY_DATA_TYPE`, sprawdzone: `dataType` nie występuje
    nigdzie indziej w tym pliku). Nie steruje ani renderem, ani filtrem.
    Dlatego kolumny o krótkiej treści („Ryzyko", „Wysoki (4)", „Otwarta")
    dostają wąską podłogę `number` (90 px) — to deklaracja SZEROKOŚCI, nie
    twierdzenie, że treść jest liczbą. Bez tego podłoga `status` (130 px)
    ×3 zjadała 49 px, których brakowało kolumnie „Właściciel" i „Tomasz
    Lewandowski" łamał się na dwie linie (wiersz 65 px zamiast 57).

    Suma zadeklarowana: 200+105+176+128+183+120+132+128 = 1172 + 80 = 1252 px.
  */
  // Tytuł stoi na swojej PODŁODZE (200 px): jako kolumna główna i tak skraca
  // się wielokropkiem w jednej linii, a każdy oddany piksel ratuje kolumny,
  // które zawijają na dwie linie i rozpychają wiersz ponad kanoniczne 56 px.
  { ...kolumnaTytul(t), width: '200px' },
  {
    id: 'kindLabel',
    label: t('execution.governance.columns.type', 'Typ'),
    dataType: 'number',
    sortable: true,
    filterable: true,
    width: '105px',
  },
  {
    id: 'owner',
    // ZMIERZONE (`.local/mierz2.mjs`): przy 140 px „Katarzyna Wójcik" zawijała
    // się na dwie linie i wiersz rósł z 57 do 65 px — kanon trzyma 56 px.
    // Kolumny inne niż główna mają `line-clamp-2`, więc nie skracają się
    // wielokropkiem: jedyną naprawą jest realna szerokość.
    label: t('execution.governance.columns.owner', 'Owner'),
    dataType: 'text',
    sortable: true,
    width: '176px',
  },
  {
    id: 'dueAt',
    // 125 px, nie 110: przy 110 px zostaje 78 px na treść, a „15 gru 2026"
    // potrzebuje ~85 px i ZAWIJAŁO SIĘ na dwie linie (wiersz 65 px zamiast 57).
    // Zmierzone `.local/mierz4.mjs` — defekt widoczny przy JEDNEJ wartości:
    // wiersze bez terminu („—") wyglądały poprawnie i zasłaniały problem.
    label: t('execution.governance.columns.due', 'Termin'),
    dataType: 'date',
    sortable: true,
    width: '128px',
  },
  {
    id: 'probabilityLabel',
    // Bez sortowania i bez filtra: nagłówek „PRAWDOPODOBIEŃSTWO" (18 znaków)
    // to najdroższa podłoga na tym ekranie, a każdy z tych afordansów dokłada
    // do niej budżet (16 px sortowanie, 26 px filtr). Porządkowanie ryzyk robi
    // się po EKSPOZYCJI (sortowalna) — to ona jest liczbą decyzyjną, nie sam
    // jeden ze składników; filtrowanie zostaje na Typie, Wpływie i Statusie.
    label: t('execution.raid.columns.probability', 'Probability'),
    dataType: 'status',
    width: '172px',
  },
  {
    id: 'impactLabel',
    label: t('execution.raid.columns.impact', 'Impact'),
    dataType: 'number',
    sortable: true,
    filterable: true,
    width: '120px',
  },
  {
    id: 'exposure',
    label: t('execution.raid.columns.exposure', 'Ekspozycja'),
    dataType: 'number',
    align: 'right',
    sortable: true,
    width: '132px',
    /*
      POLE LICZONE, TYLKO DO ODCZYTU (§4.3: Planview `RiskRate` = Impact ×
      %Probability „read-only, calculated"; MS Project „Exposure — the product
      of your Probability by Impact factors"). Wartość NIE jest czytana z
      `raid_items.risk_score`: na kopii bazy 3 z 16 wierszy mają tam liczbę,
      która nie jest iloczynem (seed, nie kalkulator) — patrz `raidGovernance.ts`.
      Brak składnika = pusta komórka, nigdy zmyślone zero.
    */
    render: (row) => {
      const value = row.exposure as number | null | undefined;
      if (value == null) return <span className="text-c-text-muted">—</span>;
      const pasmo = pasmoEkspozycji(value);
      const tone =
        pasmo === 'wysokie'
          ? 'text-c-danger'
          : pasmo === 'srednie'
            ? 'text-c-warning'
            : 'text-c-text-primary';
      return <span className={`font-semibold tabular-nums ${tone}`}>{value}</span>;
    },
  },
  {
    id: 'raidStatusLabel',
    label: t('execution.raid.columns.status', 'Status'),
    dataType: 'number',
    sortable: true,
    filterable: true,
    width: '128px',
  },
  { ...kolumnaDniPoTerminie(t), dataType: 'number', defaultVisible: false },
];

/**
 * Kolumny SYGNAŁÓW OPÓŹNIEŃ (P16/R5, §4 D4).
 * Inicjatywa · Rodzaj sygnału · Odchylenie (dni) · Powód · Wykryto · Stan.
 */
const buildDelayColumns = (t: (key: string, fallback: string) => string): TableColumn[] => [
  {
    /*
      `title`, nie `entityName` — identyfikator kolumny WYBIERA kanon renderu:
      tylko `title`/`name` dostają jedną linię z wielokropkiem, reszta zawija
      na dwie (`line-clamp-2`). Nazwy inicjatyw bywają długie („OPC-UA
      Migration & Industrial Connectivity Standard") i przy zawijaniu wiersz
      rósł z 56 do 65 px — zmierzone `.local/mierz2.mjs`.
    */
    id: 'title',
    label: t('execution.signals.columns.entity', 'Initiative / task'),
    sortable: true,
    width: '300px',
  },
  {
    id: 'kindLabel',
    label: t('execution.signals.columns.kind', 'Signal type'),
    dataType: 'status',
    sortable: true,
    filterable: true,
    width: '190px',
  },
  {
    id: 'deviationDays',
    label: t('execution.signals.columns.deviation', 'Odchylenie (dni)'),
    dataType: 'number',
    sortable: true,
    width: '176px',
    render: (row) => {
      const dni = Number(row.deviationDays ?? 0);
      return (
        <span
          className={`font-semibold tabular-nums ${dni > 0 ? 'text-c-danger' : 'text-c-text-muted'}`}
        >
          {dni > 0 ? `+${dni}` : '—'}
        </span>
      );
    },
  },
  {
    id: 'reasonLabel',
    // 250 px: sygnał bywa wielopowodowy („Blokada · Wysokie ryzyko RAID"
    // = ~205 px treści) i przy 226 px zawijał wiersz na dwie linie.
    label: t('execution.signals.columns.reason', 'Reason'),
    dataType: 'text',
    sortable: true,
    filterable: true,
    width: '250px',
  },
  {
    id: 'detectedAt',
    label: t('execution.signals.columns.detectedAt', 'Wykryto'),
    dataType: 'date',
    sortable: true,
    width: '130px',
  },
  {
    id: 'stateLabel',
    label: t('execution.signals.columns.state', 'Stan'),
    dataType: 'status',
    sortable: true,
    filterable: true,
    width: '144px',
    render: (row) => {
      const stan = row.state as StanSygnalu;
      const tone =
        stan === 'INTERWENCJA'
          ? 'text-c-warning'
          : stan === 'ZAMKNIETY'
            ? 'text-c-text-muted'
            : 'text-c-text-primary';
      return <span className={`font-medium ${tone}`}>{String(row.stateLabel ?? '')}</span>;
    },
  },
];
export const ExecutionControlSurface = ({
  activePreset,
  onCountsChange,
  onRegisterFilterControl,
  onRegisterPrimaryCta,
}: ExecutionMenu3Contract & {
  /**
   * Rejestruje węzeł FILTRÓW (tu: dropdown „Termin") do prawej strony Menu 2
   * gospodarza (ExecutionHub) — patrz identyczny komentarz w
   * `ExecutionWorkSurface`. Odbiór grafiki 165-menu3-pasek,
   * execution-tab-control: właściciel zgłosił ten sam problem co na
   * ekranach "Praca" i "Zasoby".
   */
  onRegisterFilterControl?: (node: React.ReactNode) => void;
  /**
   * JEDEN primary CTA zakładki — „Nowa decyzja" (preset Decyzje) albo
   * „Nowa pozycja RAID" (preset Ryzyka), nigdy oba naraz; w Sygnałach żaden
   * (sygnału nie tworzy człowiek, tylko system). Do 08.09.2026 jechały tą
   * samą drogą co filtry i miały wygląd `btn-secondary` — czyli akcja
   * główna zakładki wyglądała jak przycisk pomocniczy (kanon §A2/§C4).
   */
  onRegisterPrimaryCta?: (cta: ExecutionSurfacePrimaryCta | null) => void;
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const columns = useMemo(() => buildColumns(t), [t]);
  const signalColumns = useMemo(() => buildSignalColumns(t), [t]);
  const decisionColumns = useMemo(() => buildDecisionColumns(t), [t]);
  const raidColumns = useMemo(() => buildRaidColumns(t), [t]);
  const delayColumns = useMemo(() => buildDelayColumns(t), [t]);
  const currentUser = useAppStore((store) => store.currentUser);
  const currentOrganization = useAppStore((store) => store.currentOrganization);
  /**
   * KTO MOŻE ROZSTRZYGNĄĆ (P16/R3, DEC-453) — lustro reguły serwera, nie druga
   * reguła. `DecisionController.decide` odsyła 403 „Only decision owner can
   * decide", jeśli wołający nie jest decydentem ani ADMIN/OWNER/SUPERADMIN.
   * Ekran ukrywa wtedy akcje rozstrzygające, żeby MEMBER nie klikał przycisku,
   * który i tak odbije się o 403. Bramką prawdy zostaje SERWER — to jest
   * wyłącznie uprzejmość interfejsu.
   */
  const canDecide = useCallback(
    (decisionOwnerId?: string | null) => {
      const rola = String(currentUser?.role ?? '').toUpperCase();
      if (['ADMIN', 'ADMINISTRATOR', 'OWNER', 'SUPERADMIN', 'SUPER_ADMIN'].includes(rola)) {
        return true;
      }
      return Boolean(decisionOwnerId) && decisionOwnerId === currentUser?.id;
    },
    [currentUser?.id, currentUser?.role]
  );
  /**
   * 1.12-R1 (C): KATALOG OSÓB dla rejestru RAID.
   * ZMIERZONE NA ZRZUCIE (06.09, ?tab=control, chip „Ryzyka"): kolumna
   * WŁAŚCICIEL pisała `5009e749-75e5-4816-91c9-494f95bdf5d4` — `GET /api/raid`
   * zwraca `ownerId` bez nazwiska. Ten sam kształt naprawiono 05.09
   * w `ExecutionWorkSurface`; źródło jest to samo:
   * `GET /api/organizations/:id/members`.
   */
  const resolveMemberName = useOrganizationMemberNames();
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING'),
    // 1.12-R1 (C): realne rejestry — decyzje (/api/decisions) i RAID (/api/raid).
    [governanceRows, setGovernanceRows] = useState<GovernanceRow[]>([]),
    [selectedGovernanceId, setSelectedGovernanceId] = useState<string | null>(null),
    [newDecisionOpen, setNewDecisionOpen] = useState(false),
    // P16/R3: formularz „Nowa decyzja" ma cztery pola, bo tyle wymaga kontrakt
    // (`sourceId` = inicjatywa, `dueDate` = „potrzebna do dnia", decydent).
    [newDecision, setNewDecision] = useState({
      title: '',
      dueDate: '',
      initiativeId: '',
      decisionOwnerId: '',
    }),
    [newDecisionError, setNewDecisionError] = useState<string | null>(null),
    [newDecisionBusy, setNewDecisionBusy] = useState(false),
    /** Inicjatywy W REALIZACJI — źródło `sourceId` dla nowej decyzji. */
    [executionInitiatives, setExecutionInitiatives] = useState<
      Array<{ id: string; name: string; ownerId?: string | null }>
    >([]),
    /** Nazwy WSZYSTKICH inicjatyw (id → nazwa) — podgląd RAID nie pokazuje UUID. */
    [initiativeNames, setInitiativeNames] = useState<Record<string, string>>({}),
    /** Członkowie organizacji — lista wyboru decydenta i właściciela RAID. */
    [orgMembers, setOrgMembers] = useState<Array<{ id: string; name: string }>>([]),
    /** Otwarte okno powodu: która akcja i na której decyzji. */
    [reasonDialog, setReasonDialog] = useState<{
      kind: 'approve' | 'reject' | 'supersede' | 'escalate' | 'raid-close';
      row: GovernanceRow;
    } | null>(null),
    [reasonBusy, setReasonBusy] = useState(false),
    [reasonError, setReasonError] = useState<string | null>(null),
    /** P16/R4: formularz „Nowa pozycja RAID" (widok Ryzyka). */
    [newRaidOpen, setNewRaidOpen] = useState(false),
    [newRaid, setNewRaid] = useState({
      title: '',
      type: 'RISK' as RaidTyp,
      initiativeId: '',
      ownerId: '',
      dueDate: '',
      probability: 'MEDIUM',
      impact: 'MEDIUM',
    }),
    [newRaidError, setNewRaidError] = useState<string | null>(null),
    [newRaidBusy, setNewRaidBusy] = useState(false),
    /** P16/R4: edycja pojedynczego pola pozycji RAID z podglądu. */
    [raidEdit, setRaidEdit] = useState<{
      pole: 'dueDate' | 'ownerId';
      row: GovernanceRow;
      wartosc: string;
    } | null>(null),
    [raidBusy, setRaidBusy] = useState(false),
    [raidError, setRaidError] = useState<string | null>(null),
    /** P16/R5: sygnały opóźnień i stan tworzenia interwencji. */
    [delayRows, setDelayRows] = useState<DelayRow[]>([]),
    [selectedDelayId, setSelectedDelayId] = useState<string | null>(null),
    [interventionBusy, setInterventionBusy] = useState(false),
    [interventionError, setInterventionError] = useState<string | null>(null),
    /** Filtr terminu z Menu 2 (zastępuje czwarty chip „Po terminie"). */
    [filtrTerminu, setFiltrTerminu] = useState<FiltrTerminu>('wszystkie'),
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
    /*
      P16/R5 (DEC-453): TRZECIE ŹRÓDŁO — sygnały opóźnień. Dokładany do tej
      samej `allSettled`, bo dzieli z rejestrem decyzji jedno wywołanie: stan
      sygnału („Nowy / Interwencja / Zamknięty") liczy się z rodowodu decyzji,
      więc obie listy muszą pochodzić z tej samej chwili.
    */
    const [decyzje, raid, sygnaly] = await Promise.allSettled([
      Api.get('/decisions'),
      Api.raidList(),
      Api.get('/execution-control/delay-signals'),
    ]);

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
    /*
      P16/R4: pamięć wersji CAS zasilana z modelu odczytu PRZY KAŻDYM ładowaniu.
      Bez tego pierwszy zapis po przeładowaniu strony leciał ze ślepym
      `expectedVersion: 0`, dostawał 409 i dopiero ponowienie kończyło się 200 —
      czerwony błąd w konsoli i CAS, który nigdy nie chronił (patrz komentarz
      przy `seedRaidVersions`).
    */
    seedRaidVersions(raidItems);

    const decisionRows: GovernanceRow[] = decisionItems
      /**
       * P16/R3 (DEC-453) — REJESTR POKAZUJE TEŻ ROZSTRZYGNIĘTE.
       *
       * Przed R3 stał tu `isOpenDecision(...)`, czyli po rozstrzygnięciu wiersz
       * ZNIKAŁ z ekranu — a właśnie to jest zakazane: „wpis nieusuwalny"
       * (§4.3, wzorzec Forecast). Decyzja zostaje w rejestrze z nowym statusem
       * i z uzasadnieniem w podglądzie. Odpada WYŁĄCZNIE decyzja ARCHIWALNA
       * (`cancelled` z `DELETE /api/decisions/:id`) — tę użytkownik świadomie
       * usunął z pola widzenia.
       */
      .filter((decision) => !isArchivedDecision(decision))
      .map((decision) => {
        const escalationStep = Number(decision.escalationStep ?? 0) || 0;
        return {
          id: `decision:${decision.id}`,
          decisionId: String(decision.id),
          title: decision.title ?? t('execution.decisions.untitled', 'Untitled decision'),
          kind: 'DECISION' as const,
          // Kolumna „Typ" znika z widoku decyzji (zostaje w RAID). `kindLabel`
          // wciąż niesie status, bo używa go pigułka podglądu.
          kindLabel: decisionStatusLabel(decision.status, t),
          statusLabel: decisionStatusLabel(decision.status, t),
          rawStatus: String(decision.status ?? '').toUpperCase(),
          owner: decision.ownerName || decision.requestedByName || 'Nieprzypisana',
          decydent:
            decision.ownerName ||
            (decision.decisionOwnerId
              ? memberNameOrUnknown(resolveMemberName, decision.decisionOwnerId, isPolish)
              : isPolish
                ? 'Nieprzypisany'
                : 'Unassigned'),
          dueAt: formatDay(decision.dueDate),
          rawDueAt: decision.dueDate ?? null,
          daysOverdue: isDecisionOverdue(decision) ? decisionDaysOverdue(decision) : null,
          escalationStep,
          escalation: escalationStepLabel(escalationStep, t),
          isOverdue: isDecisionOverdue(decision),
          canDecide: canDecide(decision.decisionOwnerId),
          rationale: decision.decisionRationale ?? undefined,
          decidedAt: decision.decidedAt ?? null,
          source: decision,
        };
      });

    /**
     * P16/R4 (DEC-453): wiersz RAID niesie komplet pól swojego zestawu kolumn.
     *
     * `impact` to nazwa kolumny w `raid_items` i pola w `GET /api/raid`;
     * kanoniczny writer nazywa TO SAMO pole `severity` (kontrakt
     * `RaidItemCreateSchema`). Czytamy oba, żeby wiersz był poprawny niezależnie
     * od tego, którą nazwą przyszedł — to nie jest domysł, to zmierzona
     * rozbieżność dwóch kontraktów na jedną kolumnę.
     */
    const raidRows: GovernanceRow[] = raidItems.map((item) => {
      const wplyw = item.impact ?? item.severity ?? null;
      const status = String(item.status ?? 'OPEN').toUpperCase();
      return {
        id: `raid:${item.id}`,
        raidId: String(item.id),
        raidInitiativeId: item.initiativeId ?? null,
        title: item.title ?? t('execution.raid.untitled', 'Untitled RAID item'),
        kind: 'RAID' as const,
        kindLabel: raidTypeLabel(item.type, t),
        rawRaidType: String(item.type ?? '').toUpperCase(),
        owner: raidOwnerLabel(item, resolveMemberName, isPolish),
        ownerId: item.ownerId ?? null,
        dueAt: formatDay(item.dueDate),
        rawDueAt: item.dueDate ?? null,
        rawProbability: item.probability ?? null,
        rawImpact: wplyw,
        probabilityLabel: raidProbabilityLabel(item.probability, t),
        impactLabel: raidImpactLabel(wplyw, t),
        // EKSPOZYCJA — LICZONA z dwóch pól, nigdy czytana z `riskScore`.
        exposure: ekspozycjaRaid(item.probability, wplyw),
        rawRaidStatus: status,
        raidStatusLabel: raidStatusPl(status, t),
        description: item.description ?? null,
        // Dni po terminie tylko dla pozycji OTWARTEJ z terminem.
        daysOverdue: raidDniPoTerminie(item.dueDate, status),
        escalation: severityToEscalation(wplyw),
        isOverdue: czyRaidPoTerminie(item.dueDate, status),
        source: item,
      };
    });

    setGovernanceRows([...decisionRows, ...raidRows]);

    /*
      STAN SYGNAŁU liczony z rodowodu decyzji (`sourceType`/`sourceId`).
      `delay-signals` NIE MA trwałego stanu — `detectDelaySignals` wylicza
      listę przy każdym zapytaniu, więc gdyby stan miał mieszkać w sygnale,
      po odświeżeniu strony znikałby. Rejestr decyzji jest jedynym miejscem,
      w którym ślad interwencji przeżywa reload.
    */
    const signalItemsRaw: SygnalOpoznienia[] =
      sygnaly.status === 'fulfilled'
        ? ((sygnaly.value as any)?.signals ??
          (Array.isArray(sygnaly.value) ? (sygnaly.value as any) : []))
        : [];
    const rodowody: DecyzjaRodowod[] = decisionItems.map((d) => ({
      id: String(d.id),
      status: d.status ?? null,
      sourceType: d.sourceType ?? null,
      sourceId: d.sourceId ?? null,
    }));
    setDelayRows(
      signalItemsRaw
        .filter((signal) => !signal.isDismissed)
        .map((signal) => {
          const { stan, decyzjaId } = stanSygnalu(String(signal.id), rodowody);
          const nazwa = signal.entityName || String(signal.entityId);
          return {
            id: String(signal.id),
            title: nazwa,
            entityName: nazwa,
            entityType: String(signal.entityType ?? ''),
            entityId: String(signal.entityId ?? ''),
            kindLabel: rodzajSygnaluLabel(signal.deviationType, t),
            deviationDays: Number(signal.daysDeviation ?? 0),
            reasonLabel: powodySygnaluLabel(signal.whySlipReasons, t),
            detectedAt: formatDay(signal.createdAt),
            rawDetectedAt: String(signal.createdAt ?? ''),
            state: stan,
            stateLabel: stanSygnaluLabel(stan, t),
            decisionId: decyzjaId,
            severity: String(signal.severity ?? ''),
            signal,
          };
        })
    );
  }, [resolveMemberName, isPolish, t, canDecide]);

  /**
   * Słowniki formularza „Nowa decyzja" (P16/R3): inicjatywy w realizacji jako
   * `sourceId` i członkowie organizacji jako decydent. Ładowane RAZ, obok
   * rejestru — bez tych dwóch list `POST /api/decisions` nie ma z czego złożyć
   * kontekstu i kończy się tym samym 400, które R3 naprawia.
   */
  const loadDecisionDictionaries = useCallback(async () => {
    /**
     * Katalog osób pobieramy TYLKO, gdy użytkownik może z niego skorzystać.
     * ZMIERZONE 07.09 na koncie MEMBER (Anna): `GET /api/organizations/:id/
     * members` odsyła 403, a `POST /api/decisions` i tak wymaga uprawnienia
     * `approve_changes` — więc dla MEMBER-a to było wywołanie, które nie mogło
     * się udać i nie było do niczego potrzebne, a zostawiało 403 w konsoli
     * przy każdym wejściu na zakładkę. Warunek jest ten sam, który rządzi
     * widocznością akcji rozstrzygających (`canDecide`).
     */
    const mozeTworzyc = canDecide(null);
    const [inicjatywy, czlonkowie] = await Promise.allSettled([
      Api.get('/initiatives'),
      mozeTworzyc && currentOrganization?.id
        ? OrganizationApi.getOrganizationMembers(currentOrganization.id)
        : Promise.resolve([]),
    ]);

    if (inicjatywy.status === 'fulfilled') {
      const surowe: any[] = Array.isArray(inicjatywy.value)
        ? inicjatywy.value
        : ((inicjatywy.value as any)?.initiatives ?? (inicjatywy.value as any)?.items ?? []);
      /*
        P16/R4: NAZWY WSZYSTKICH inicjatyw, nie tylko tych w realizacji.
        Pozycja RAID bywa przypięta do inicjatywy spoza filtru realizacji, a
        podgląd ma pokazać JEJ NAZWĘ, nie UUID — to ta sama rodzina defektu, co
        `ownerId` w kolumnie Właściciel przed 1.12-R1.
      */
      setInitiativeNames(
        Object.fromEntries(
          surowe.map((initiative: any) => [
            String(initiative.id),
            String(initiative.name ?? initiative.title ?? initiative.id),
          ])
        )
      );
      setExecutionInitiatives(
        filterInFlightInitiatives(surowe).map((initiative: any) => ({
          id: String(initiative.id),
          name: String(initiative.name ?? initiative.title ?? initiative.id),
          ownerId: initiative.ownerId ?? initiative.owner_id ?? null,
        }))
      );
    }

    if (czlonkowie.status === 'fulfilled') {
      const lista = (czlonkowie.value ?? []) as any[];
      setOrgMembers(
        lista
          .map((member) => ({
            id: readMemberId(member),
            name: readMemberLabel(member) ?? readMemberId(member),
          }))
          .filter((member) => Boolean(member.id))
      );
    }
  }, [currentOrganization?.id, canDecide]);

  const load = useCallback(async () => {
    setState('LOADING');
    void loadGovernance();
    void loadDecisionDictionaries();
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
          status: interventionStatusLabel(x.status, t),
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
          rule: signalRuleLabel(x.ruleId, t),
          source: `${x.sourceType}:${x.sourceId}`,
          severity: severityLabel(x.severity, t),
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
          status: interventionStatusLabel(x.status, t),
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
          rule: signalRuleLabel(x.ruleId, t),
          source: `${x.sourceId} · v${x.sourceVersion}`,
          severity: severityLabel(x.severity, t),
          rawSeverity: x.severity,
          occurrences: x.occurrences.length,
          updatedAt: formatDateTime(x.updatedAt),
          version: x.version,
          signal: x,
        }))
      );
      setState('READY');
    }
  }, [loadGovernance, loadDecisionDictionaries]);
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
  const matches = useCallback((row: GovernanceRow, preset: string) => {
    if (preset === 'decyzje') return row.kind === 'DECISION';
    if (preset === 'ryzyka') return row.kind === 'RAID';
    return false;
  }, []);
  const activeGovernancePreset = activePreset ?? 'decyzje';
  /**
   * PO TERMINIE — reguła wspólna, filtr Menu 2 (P16/R4+R5, DEC-453).
   *
   *   · decyzja  — po terminie i JESZCZE NIE ZAPADŁA (Oczekuje / Eskalowana);
   *     rozstrzygnięta po terminie zostaje w rejestrze (wpis nieusuwalny), ale
   *     zaległością już nie jest, inaczej licznik nigdy nie spadłby do zera,
   *   · RAID     — OTWARTA (status ≠ Zamknięta) i `due_date` < dziś (§R4.3).
   *
   * Reguła RAID żyje w `raidGovernance.raidDniPoTerminie` i została policzona
   * przy budowie wiersza — tu tylko czytamy wynik, żeby nie mieć dwóch definicji
   * tej samej liczby w dwóch miejscach.
   */
  const poTerminie = useCallback((row: GovernanceRow) => {
    if (!row.isOverdue) return false;
    if (row.kind !== 'DECISION') return true;
    return row.rawStatus === 'PENDING' || row.rawStatus === 'ESCALATED';
  }, []);
  const visibleGovernanceRows = useMemo(
    () =>
      governanceRows.filter(
        (row) =>
          matches(row, activeGovernancePreset) &&
          (filtrTerminu === 'wszystkie' || poTerminie(row))
      ),
    [governanceRows, matches, activeGovernancePreset, filtrTerminu, poTerminie]
  );
  const selectedGovernance = useMemo(
    () => governanceRows.find((row) => row.id === selectedGovernanceId) ?? null,
    [governanceRows, selectedGovernanceId]
  );
  /**
   * P16/R5: sygnał „po terminie" = odchylenie dodatnie. Sygnał LATE_START z
   * `daysDeviation` 0 nie jest zaległością, tylko ostrzeżeniem progowym.
   */
  const visibleDelayRows = useMemo(
    () =>
      filtrTerminu === 'wszystkie'
        ? delayRows
        : delayRows.filter((row) => row.deviationDays > 0),
    [delayRows, filtrTerminu]
  );
  const selectedDelay = useMemo(
    () => delayRows.find((row) => row.id === selectedDelayId) ?? null,
    [delayRows, selectedDelayId]
  );
  /**
   * LICZNIKI CHIPÓW — „Sygnały (N)" liczy `delay-signals`, nie pusty rejestr
   * runtime-v1. Chipy pokazują CAŁE zbiory (bez filtru terminu z Menu 2), bo
   * filtr ma zawężać tabelę, a nie podmieniać liczbę na chipie.
   */
  useEffect(
    () =>
      onCountsChange?.({
        ...countExecutionPresets(governanceRows, ['decyzje', 'ryzyka'], matches),
        sygnaly: delayRows.length,
      }),
    [governanceRows, delayRows, matches, onCountsChange]
  );
  /**
   * Warsztat sygnałów/interwencji `runtime-v1` zostaje w kodzie, ale nie
   * rysuje pustej tabeli: na DBR77 oba rejestry mają 0 rekordów, więc bez tej
   * bramki zakładka pokazywałaby pusty stan pod realnym rejestrem decyzji.
   */
  const hasRuntimeControlData = signalRows.length > 0 || rows.length > 0;
  /**
   * KOMUNIKAT BŁĘDU PO POLSKU (P16/R3, DEC-453).
   *
   * Do R3 ekran wypisywał użytkownikowi stały angielski napis
   * „Failed to create decision" — bo `Api.createDecision` gubiła całą
   * odpowiedź serwera i rzucała literał. Teraz `ApiError` niesie `errorCode`
   * (pole `code` kontrolera) i treść serwera; tłumaczymy PO KODZIE, a gdy kodu
   * nie znamy — pokazujemy nazwany, polski komunikat ogólny z numerem HTTP,
   * NIGDY surowy angielski tekst backendu jako jedyną informację.
   */
  const decisionErrorMessage = useCallback(
    (error: unknown, fallbackKey: string, fallbackText: string): string => {
      const kod = error instanceof ApiError ? error.errorCode : '';
      const status = error instanceof ApiError ? error.status : undefined;
      const slownik: Record<string, string> = {
        REASON_REQUIRED: t(
          'execution.decisions.errors.reasonRequired',
          'A rationale is required — the decision cannot be saved without it.'
        ),
        RATIONALE_REQUIRED: t(
          'execution.decisions.errors.reasonRequired',
          'A rationale is required — the decision cannot be saved without it.'
        ),
        ESCALATION_AT_MAX: t('execution.decisions.errors.escalationAtMax', 'This decision is already at the highest escalation level (3/3 — committee).'
        ),
        ALREADY_FINALIZED: t('execution.decisions.errors.alreadyFinalized', 'This decision has already been resolved — the resolution cannot be undone or repeated.'
        ),
        STALE_VERSION: t('execution.decisions.errors.staleVersion', 'Someone changed this decision in the meantime. Refresh the list and try again.'
        ),
      };
      if (kod && slownik[kod]) return slownik[kod];
      if (status === 403) {
        return t('execution.decisions.errors.forbidden', 'You don\'t have permission for this operation — only the decision maker or an administrator can resolve it.'
        );
      }
      if (status === 400) {
        return t('execution.decisions.errors.missingContext', 'Decision data is missing — complete the initiative, due date and decision maker.'
        );
      }
      return status
        ? `${t(fallbackKey, fallbackText)} (HTTP ${status})`
        : t(fallbackKey, fallbackText);
    },
    [t]
  );

  /**
   * „NOWA DECYZJA" (P16/R3, DEC-453) — naprawa stałego 400.
   *
   * ZMIERZONE PRZED R3: formularz wysyłał `{title, dueDate?, sourceType:
   * 'execution'}`, a `DecisionController.createDecision` odrzucał to
   * bezwarunkowo — kontekst decyzji wymaga ALBO project/initiative/task id,
   * ALBO PARY `sourceType` + `sourceId`. Wysyłany był sam `sourceType`, więc
   * `hasSourceContext` było zawsze fałszem i KAŻDA próba kończyła się
   * „Missing decision context".
   *
   * Po R3 formularz zbiera cztery pola i wysyła komplet: `initiativeId`
   * (kontekst) + `sourceId` = ta sama inicjatywa (lineage) + `sourceType`
   * 'execution' + `dueDate` (kolumna „Potrzebna do dnia", WYMAGANA) +
   * `decisionOwnerId` (kolumna „Decydent"; serwer zapisuje je do
   * `decisions.decision_maker_id`).
   */
  const createDecision = async () => {
    const title = newDecision.title.trim();
    const initiativeId = newDecision.initiativeId.trim();
    const dueDate = newDecision.dueDate.trim();
    if (!title || !initiativeId || !dueDate) return;
    setNewDecisionError(null);
    setNewDecisionBusy(true);
    try {
      await Api.createDecision({
        title,
        initiativeId,
        sourceType: 'execution',
        sourceId: initiativeId,
        dueDate: new Date(dueDate).toISOString(),
        ...(newDecision.decisionOwnerId ? { decisionOwnerId: newDecision.decisionOwnerId } : {}),
      });
      setNewDecision({ title: '', dueDate: '', initiativeId: '', decisionOwnerId: '' });
      setNewDecisionOpen(false);
      await loadGovernance();
    } catch (error) {
      setNewDecisionError(
        decisionErrorMessage(
          error,
          'execution.decisions.errors.createFailed',
          t('execution.decisions.saveFailed', 'The decision could not be saved.')
        )
      );
    } finally {
      setNewDecisionBusy(false);
    }
  };

  /**
   * KOMUNIKAT BŁĘDU ZAPISU RAID — kanoniczny writer sam tłumaczy status HTTP
   * na polskie zdanie (`RaidWriteError`), więc tutaj tylko go przepuszczamy.
   * Zakaz z §4: żadnego `.catch(() => {})` — każda awaria ma widoczny tekst.
   */
  const raidErrorMessage = useCallback(
    (error: unknown): string => {
      if (error instanceof RaidWriteError) return error.message;
      return t('execution.raid.errors.saveFailed', 'Could not save the RAID item.');
    },
    [t]
  );

  /**
   * „NOWA POZYCJA RAID" (P16/R4, DEC-453) — KANONICZNY pisarz, nie trasa legacy.
   *
   * ZMIERZONE PRZED R4: z tej zakładki NIE DAŁO SIĘ dodać pozycji RAID w ogóle
   * (zero CTA), a jedyny front, który próbował (`RaidSection`,
   * `InitiativeDocumentView`), wołał wycofane `POST /api/initiatives/:id/raid`
   * — bramka `executionSpineLegacyReadOnly` odpowiada na to 409 (decyzja 26A).
   * Dlatego zapis idzie WYŁĄCZNIE przez `raidWrites` →
   * `POST /api/initiatives/runtime-v1/initiatives/:id/raid-items/:raidItemId`.
   *
   * Kontrakt kanonicznej komendy nazywa wpływ `severity`, a kolumna w bazie i
   * `GET /api/raid` nazywają go `impact` — dlatego wysyłamy `severity`, a
   * czytamy `impact`. To nie jest niekonsekwencja tego ekranu, tylko zmierzona
   * rozbieżność dwóch kontraktów na jedno pole.
   */
  const createRaid = async () => {
    const title = newRaid.title.trim();
    const initiativeId = newRaid.initiativeId.trim();
    if (!title || !initiativeId) return;
    setNewRaidError(null);
    setNewRaidBusy(true);
    try {
      await createRaidItem(initiativeId, newRaidItemId(), {
        type: newRaid.type,
        title,
        status: 'OPEN',
        probability: newRaid.probability as 'LOW' | 'MEDIUM' | 'HIGH',
        severity: newRaid.impact as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        ownerId: newRaid.ownerId || null,
        dueDate: newRaid.dueDate ? new Date(newRaid.dueDate).toISOString() : null,
      });
      setNewRaid({
        title: '',
        type: 'RISK',
        initiativeId: '',
        ownerId: '',
        dueDate: '',
        probability: 'MEDIUM',
        impact: 'MEDIUM',
      });
      setNewRaidOpen(false);
      await loadGovernance();
    } catch (error) {
      setNewRaidError(raidErrorMessage(error));
    } finally {
      setNewRaidBusy(false);
    }
  };

  /**
   * EDYCJA POJEDYNCZEGO POLA POZYCJI RAID z podglądu (termin / właściciel).
   * Powód NIE jest wymagany — wymaga go wyłącznie ZAMKNIĘCIE pozycji (§R4.2).
   */
  const zapiszPoleRaid = async () => {
    if (!raidEdit) return;
    const { pole, row, wartosc } = raidEdit;
    if (!row.raidId || !row.raidInitiativeId) return;
    setRaidBusy(true);
    setRaidError(null);
    try {
      await updateRaidItem(row.raidInitiativeId, row.raidId, {
        [pole]:
          pole === 'dueDate'
            ? wartosc
              ? new Date(wartosc).toISOString()
              : null
            : wartosc || null,
      });
      setRaidEdit(null);
      await loadGovernance();
    } catch (error) {
      setRaidError(raidErrorMessage(error));
    } finally {
      setRaidBusy(false);
    }
  };

  /**
   * ESKALACJA RYZYKO → PROBLEM (§R4.2, AUDYT_RYNKU_PMO §4.3 „Eskalacja RAID").
   *
   * Wzorzec Clarity: z ryzyka powstaje NOWY rekord typu Problem, który ma
   * „a link back to the originating Risk", a źródło zostaje oznaczone jako
   * przekształcone. `raid_items` nie ma kolumny na taki odnośnik (28 kolumn,
   * sprawdzone w `information_schema`), a paczka zabrania migracji tam, gdzie
   * da się bez niej — więc link idzie w OPISIE, w formacie odczytywalnym
   * maszynowo (`ŹRÓDŁO-RAID: <id> — „<tytuł>"`) i okiem.
   *
   * Dwa zapisy, nie jeden: najpierw powstaje Problem (jeśli ten padnie, nic
   * się nie zmieniło), potem źródło dostaje status końcowy i adnotację. Gdyby
   * padł drugi, użytkownik widzi Problem z linkiem i otwarte ryzyko obok —
   * stan niepełny, ale PRAWDZIWY i naprawialny ręcznie. Odwrotna kolejność
   * mogłaby zamknąć ryzyko bez problemu, czyli zgubić pozycję z rejestru.
   */
  const eskalujDoProblemu = async (row: GovernanceRow) => {
    if (!row.raidId || !row.raidInitiativeId) return;
    setRaidBusy(true);
    setRaidError(null);
    try {
      const problemId = newRaidItemId();
      await createRaidItem(row.raidInitiativeId, problemId, {
        type: 'ISSUE',
        title: row.title,
        description: opisEskalacjiRyzyka(row.raidId, row.title, row.description),
        status: 'OPEN',
        probability: (row.rawProbability as 'LOW' | 'MEDIUM' | 'HIGH' | null) ?? null,
        severity: (row.rawImpact as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null) ?? null,
        ownerId: row.ownerId ?? null,
        dueDate: row.rawDueAt ?? null,
      });
      await updateRaidItem(row.raidInitiativeId, row.raidId, {
        status: RAID_STATUS_KONCOWY,
        description: opisPoPrzeksztalceniu(problemId, row.description),
      });
      await loadGovernance();
    } catch (error) {
      setRaidError(raidErrorMessage(error));
    } finally {
      setRaidBusy(false);
    }
  };

  /**
   * ROZSTRZYGNIĘCIE / ESKALACJA Z OKNA POWODU (P16/R3, DEC-453).
   *
   * Jedna funkcja dla czterech akcji, bo różnią się WYŁĄCZNIE trasą i
   * statusem docelowym — reguła „bez uzasadnienia nie zapisujesz" jest ta
   * sama i, co ważniejsze, jest EGZEKWOWANA NA SERWERZE
   * (`decisionOutcomeService.requiresRationale`). Okno tylko nie pozwala
   * kliknąć pustego pola; gdyby ktoś obszedł interfejs, serwer i tak odsyła
   * 400 RATIONALE_REQUIRED.
   *
   * `decided_at` / `decided_by` USTAWIA SERWER z `req.user` — front ich nie
   * wysyła i nie ma jak podmienić autora rozstrzygnięcia.
   */
  const confirmReason = async (reason: string) => {
    if (!reasonDialog) return;
    const { kind, row } = reasonDialog;
    /*
      P16/R4: ZAMKNIĘCIE POZYCJI RAID — jedyna akcja RAID z wymaganym powodem.
      Uzasadnienie idzie w `mitigationPlan`, bo `raid_items` nie ma osobnego
      pola na powód zamknięcia, a `mitigation_plan` jest polem tekstowym
      kontraktu kanonicznej komendy i to właśnie ono opisuje, CO zrobiono
      z ryzykiem. Wpis zostaje w pozycji, tak jak uzasadnienie zostaje
      w decyzji.
    */
    if (kind === 'raid-close') {
      if (!row.raidId || !row.raidInitiativeId) return;
      setReasonBusy(true);
      setReasonError(null);
      try {
        await updateRaidItem(row.raidInitiativeId, row.raidId, {
          status: RAID_STATUS_KONCOWY,
          mitigationPlan: reason,
        });
        setReasonDialog(null);
        await loadGovernance();
      } catch (error) {
        setReasonError(raidErrorMessage(error));
      } finally {
        setReasonBusy(false);
      }
      return;
    }
    const decisionId = row.decisionId;
    if (!decisionId) return;
    setReasonBusy(true);
    setReasonError(null);
    try {
      if (kind === 'escalate') {
        await Api.escalateDecision(decisionId, reason);
      } else {
        const status =
          kind === 'approve' ? 'approved' : kind === 'reject' ? 'rejected' : 'superseded';
        await Api.decideDecision(decisionId, status, reason);
      }
      setReasonDialog(null);
      await loadGovernance();
    } catch (error) {
      setReasonError(
        decisionErrorMessage(
          error,
          'execution.decisions.errors.saveFailed',
          t('execution.decisions.resolveFailed', 'The resolution could not be saved.')
        )
      );
    } finally {
      setReasonBusy(false);
    }
  };

  /**
   * „PRZYGOTUJ INTERWENCJĘ" (P16/R5, DEC-453, §4 D4) — sygnał → DECYZJA.
   *
   * ZMIERZONE PRZED R5: przycisk o tej nazwie stał w Menu 2, był ZAWSZE
   * wyszarzony (`disabled={draftSignalIds.length === 0}`, a lista sygnałów
   * runtime-v1 miała 0 rekordów) i prowadził do formularza z 16 polami
   * technicznymi (UUID interwencji, wersje źródeł, „blastRadiusRefs").
   *
   * Po R5 to jest JEDNA akcja w podglądzie sygnału, która tworzy wniosek
   * o przesunięcie: decyzję typu re-baseline z terminem (dziś + 3 dni) i
   * decydentem. Metodyka A1 pkt 6: data planowana bez decyzji jest
   * niezmienna — więc przesunięcie MUSI mieć decyzję, a nie ręczną edycję
   * daty. `sourceType` + `sourceId` niosą rodowód: dzięki nim sygnał po
   * przeładowaniu pokazuje stan „Interwencja" i odnośnik do decyzji.
   */
  const przygotujInterwencje = async (row: DelayRow) => {
    setInterventionBusy(true);
    setInterventionError(null);
    try {
      const inicjatywa =
        row.entityType === 'INITIATIVE'
          ? executionInitiatives.find((item) => item.id === row.entityId)
          : undefined;
      await Api.createDecision({
        title: tytulInterwencji(row.entityName, row.deviationDays),
        description: `${row.kindLabel} · ${row.reasonLabel}`,
        decisionType: RODZAJ_DECYZJI_REBASELINE,
        sourceType: ZRODLO_SYGNALU,
        sourceId: row.id,
        // Kontekst obiektu, gdy sygnał dotyczy inicjatywy — wtedy decyzja
        // trafia też do rejestru tej inicjatywy. Dla sygnału z zadania
        // kontekstem zostaje sam rodowód sygnału (para sourceType+sourceId,
        // przyjmowana przez kontroler od OKR-E006).
        ...(row.entityType === 'INITIATIVE' ? { initiativeId: row.entityId } : {}),
        dueDate: terminInterwencji(),
        // Decydent: właściciel inicjatywy, a gdy go nie ma — bieżący
        // użytkownik (PMO), bo kontroler i tak podstawia wołającego.
        ...(inicjatywa?.ownerId ? { decisionOwnerId: String(inicjatywa.ownerId) } : {}),
      });
      await loadGovernance();
    } catch (error) {
      setInterventionError(
        decisionErrorMessage(
          error,
          'execution.signals.errors.interventionFailed',
          t('execution.decisions.deferFailed', 'The reschedule request could not be created.')
        )
      );
    } finally {
      setInterventionBusy(false);
    }
  };

  /**
   * KEBAB WIERSZA vs BLOK AKCJI PODGLĄDU — rozdział, nie duplikat.
   *
   * Doktryna gęstości §1: JEDNA AKCJA = JEDEN DOM. Ta sama akcja nie może
   * stać jednocześnie na pasku/kebabie i w bloku akcji. Podział:
   *   · kebab wiersza  → Otwórz podgląd (nawigacja) + Eskaluj (routing),
   *   · blok akcji podglądu → Rozstrzygnij · Odrzuć · Nieaktualna (wynik).
   * Rozstrzygnięcia mieszkają w podglądzie celowo: to są operacje
   * nieodwracalne, więc wymagają otwartego kontekstu, a nie kliknięcia
   * z listy w przelocie.
   */
  const buildGovernanceRowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const wiersz = row as GovernanceRow;
      const menu: StandardRowMenu = {
        universalHandlers: {
          preview: () => setSelectedGovernanceId(wiersz.id),
        },
      };
      /*
        P16/R4: KEBAB POZYCJI RAID — Otwórz podgląd (wyżej) + „Eskaluj do
        problemu". Doktryna gęstości §1: ta akcja NIE stoi w bloku akcji
        podglądu (tam mieszkają Zmień termin · Zmień właściciela · Zamknij
        pozycję), bo jedna akcja ma jeden dom.
      */
      if (wiersz.kind === 'RAID') {
        const juzProblem = wiersz.rawRaidType === 'ISSUE';
        const zamknieta = !czyRaidOtwarty(wiersz.rawRaidStatus);
        menu.primary = [
          {
            id: 'raid-escalate-to-issue',
            label: t('execution.raid.actions.escalateToIssue', 'Eskaluj do problemu'),
            icon: ShieldAlert,
            onClick:
              juzProblem || zamknieta || raidBusy
                ? undefined
                : () => void eskalujDoProblemu(wiersz),
            note: juzProblem
              ? t('execution.raid.notes.alreadyIssue', 'This is already an issue.')
              : zamknieta
                ? t('execution.raid.notes.closed', 'The item is closed.')
                : undefined,
          },
        ];
        return menu;
      }
      if (wiersz.kind !== 'DECISION') return menu;
      const zakonczona = isResolvedDecision({ status: wiersz.rawStatus });
      const naMaksie = Number(wiersz.escalationStep ?? 0) >= ESCALATION_STEP_MAX;
      menu.primary = [
        {
          id: 'decision-escalate',
          label: t('execution.decisions.actions.escalate', 'Eskaluj'),
          icon: ArrowUpCircle,
          onClick:
            zakonczona || naMaksie
              ? undefined
              : () => {
                  setReasonError(null);
                  setReasonDialog({ kind: 'escalate', row: wiersz });
                },
          note: zakonczona
            ? t('execution.decisions.notes.resolved', 'The decision has already been resolved.')
            : naMaksie
              ? t('execution.decisions.notes.escalationMax', 'Highest escalation level (3/3 — committee).'
                )
              : undefined,
        },
      ];
      return menu;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, raidBusy]
  );
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
  /**
   * MENU 2 — JEDEN FILTR + JEDNO CTA NA WIDOK (P16/R4+R5, DEC-453).
   *
   * ZMIERZONE PRZED R4/R5: pasek niósł trzy przyciski naraz („Nowa decyzja",
   * „Dodaj sygnał", „Przygotuj interwencję"), z czego DWA były dla dewelopera
   * i nie dało się ich użyć — „Dodaj sygnał" żądał UUID obiektu i numeru
   * wersji źródła, a „Przygotuj interwencję" był ZAWSZE wyszarzony, bo warunek
   * `draftSignalIds.length > 0` liczył sygnały runtime-v1, których jest 0.
   * Oba znikają z Menu 2 (kontrakt `ingestManagementSignal` /
   * `draftIntervention` ZOSTAJE w API i w kodzie — patrz warsztat niżej,
   * rysowany tylko wtedy, gdy runtime-v1 ma choć jeden rekord).
   *
   * Zostaje: filtr terminu (dropdown kanonu Menu 2, przejęty po czwartym
   * chipie „Po terminie") i JEDNO CTA właściwe widokowi — „Nowa decyzja"
   * w Decyzjach, „Nowa pozycja RAID" w Ryzykach, żadne w Sygnałach (sygnału
   * nie tworzy człowiek, tylko system).
   */
  useEffect(() => {
    if (!onRegisterFilterControl) return;
    const liczbaPoTerminie =
      activeGovernancePreset === 'sygnaly'
        ? delayRows.filter((row) => row.deviationDays > 0).length
        : governanceRows.filter(
            (row) => matches(row, activeGovernancePreset) && poTerminie(row)
          ).length;
    const liczbaWszystkich =
      activeGovernancePreset === 'sygnaly'
        ? delayRows.length
        : governanceRows.filter((row) => matches(row, activeGovernancePreset)).length;
    onRegisterFilterControl(
      // Jedna linia, bez `flex-wrap` — kanon §A2. Slot filtrów trzyma TYLKO
      // filtr; CTA („Nowa decyzja" / „Nowa pozycja RAID") poszło do
      // `onRegisterPrimaryCta` niżej (porządek pasków 08.09.2026).
      <div className={MENU_2_FILTERS_ROW}>
        <Menu2PresetDropdown
          compact
          label={t('execution.governance.filters.dueLabel', 'Termin')}
          data-testid="execution-governance-due-filter"
          value={filtrTerminu}
          onChange={(id) => setFiltrTerminu(id as FiltrTerminu)}
          options={[
            {
              id: 'wszystkie',
              label: t('common.all', 'All'),
              count: liczbaWszystkich,
            },
            {
              id: 'po-terminie',
              label: t('execution.menu3.governance.overdue', 'Po terminie'),
              count: liczbaPoTerminie,
            },
          ]}
        />
      </div>
    );
    return () => onRegisterFilterControl(null);
    /*
      `t` CELOWO POZA ZALEŻNOŚCIAMI (znalezione 07.09 przy R5, OOM w vitest).
      Ten efekt REJESTRUJE węzeł u gospodarza, a gospodarz na to reaguje
      `setState` → nowy render tej powierzchni. Jeżeli w zależnościach stanie
      cokolwiek, co zmienia TOŻSAMOŚĆ przy każdym renderze, powstaje pętla:
      efekt → setState gospodarza → render → efekt… W aplikacji `t` z
      react-i18next jest stabilne, ale w każdym teście tego ekranu atrapa
      `useTranslation` zwraca NOWĄ funkcję przy każdym wywołaniu — i wtedy
      pętla jest realna: worker vitest puchł do 4 GB i padał
      („Ineffective mark-compacts near heap limit"), a raport pokazywał
      „Tests (25)" BEZ ani jednego „passed" — czyli wyglądał na zielony
      w JUnit, choć nie wykonał się ANI JEDEN przypadek.
      Etykiety w tym węźle i tak są statyczne, a zmiana języka przerysowuje
      całą zakładkę, więc nic tu nie tracimy.
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    onRegisterFilterControl,
    activeGovernancePreset,
    filtrTerminu,
    governanceRows,
    delayRows,
  ]);

  // ── MENU 2 · JEDEN primary CTA (zależny od presetu Menu 3) ───────────────
  //
  // ZALEŻNOŚĆ UPRAWNIEŃ ZOSTAJE (zaległość po R3, zmierzona 07.09, konto
  // MEMBER Anna): „Nowa decyzja" pokazywała się KAŻDEMU, a `POST /api/decisions`
  // odsyła MEMBER-owi 403 `Permission denied` (`approve_changes`). Próg §10:
  // zero przycisków, które dla MEMBER-a nie mogą zadziałać. Przeniesienie CTA
  // do innego slotu tej reguły NIE rozluźnia.
  useEffect(() => {
    if (!onRegisterPrimaryCta) return;
    if (activeGovernancePreset === 'decyzje' && canDecide(null)) {
      onRegisterPrimaryCta({
        label: t('execution.governance.actions.newDecision', 'Nowa decyzja'),
        testId: 'execution-new-decision-open',
        onClick: () => setNewDecisionOpen(true),
      });
      return () => onRegisterPrimaryCta(null);
    }
    if (activeGovernancePreset === 'ryzyka') {
      onRegisterPrimaryCta({
        label: t('execution.raid.actions.new', 'New RAID item'),
        testId: 'execution-new-raid-open',
        onClick: () => {
          setNewRaidError(null);
          setNewRaid((current) => ({
            ...current,
            // Domyślna inicjatywa z filtru realizacji — użytkownik nie musi
            // jej szukać, tak samo jak przy „Nowej decyzji" (R3).
            initiativeId: current.initiativeId || (executionInitiatives[0]?.id ?? ''),
          }));
          setNewRaidOpen(true);
        },
      });
      return () => onRegisterPrimaryCta(null);
    }
    // Sygnały — sygnału nie tworzy człowiek, tylko system. Zero CTA.
    onRegisterPrimaryCta(null);
    return () => onRegisterPrimaryCta(null);
    // `t` poza zależnościami z tego samego powodu co wyżej (pętla efekt↔host).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterPrimaryCta, activeGovernancePreset, canDecide, executionInitiatives]);
  if (state === 'ERROR')
    return (
      <div role="alert" className="m-4 rounded-xl border border-c-danger/40 p-4 text-sm">
        <p>{t('execution.control.loadFailed', 'Could not load the control register.')}</p>
        <button type="button" className="btn-secondary mt-3" onClick={() => void load()}>
          {t('common.retry', 'Try again')}
        </button>
      </div>
    );
  return (
    <section
      aria-label={t('execution.control.title', 'Decisions and risks')}
      className="flex h-full min-h-0 flex-col p-4"
    >
      {state === 'LOADING' && (
        <p role="status">
          {t('execution.control.loading', 'Loading the decisions and risks register…')}
        </p>
      )}
      {/*
        1.12-R1 (C): GŁÓWNA treść zakładki — rejestr decyzji i pozycji RAID
        z realnych tabel. Stoi PRZED warsztatem `runtime-v1`, bo to jest to,
        po co menedżer tu wchodzi (25 otwartych decyzji, 12 po terminie,
        16 pozycji RAID na pomiarze 06.09).
      */}
      {newDecisionOpen && (
        <div className="mb-3 rounded-lg border border-c-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <strong>{t('execution.governance.actions.newDecision', 'Nowa decyzja')}</strong>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setNewDecisionOpen(false)}
            >
              {t('common.close', 'Close')}
            </button>
          </div>
          {/*
            P16/R3 (DEC-453): CZTERY pola, bo tyle wymaga kontrakt serwera.
            Przed R3 formularz miał dwa (tytuł + termin) i KAŻDY zapis wracał
            z 400 „Missing decision context" — brakowało inicjatywy, czyli
            `sourceId`. Inicjatywa i termin są WYMAGANE (przycisk nieaktywny),
            decydent domyślnie = właściciel wybranej inicjatywy.
          */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs">
              {t('execution.decisions.form.title', 'Decision title')}
              <input
                aria-label={t('execution.decisions.form.title', 'Decision title')}
                value={newDecision.title}
                onChange={(event) =>
                  setNewDecision((current) => ({ ...current, title: event.target.value }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
            </label>
            <label className="text-xs">
              {t('execution.decisions.form.initiative', 'Inicjatywa (wymagana)')}
              <select
                aria-label={t('execution.decisions.form.initiative', 'Inicjatywa (wymagana)')}
                value={newDecision.initiativeId}
                onChange={(event) => {
                  const initiativeId = event.target.value;
                  const inicjatywa = executionInitiatives.find((item) => item.id === initiativeId);
                  setNewDecision((current) => ({
                    ...current,
                    initiativeId,
                    // Decydent domyślnie = właściciel inicjatywy; użytkownik
                    // może go zmienić, ale nie musi go szukać.
                    decisionOwnerId: current.decisionOwnerId || String(inicjatywa?.ownerId ?? ''),
                  }));
                }}
                className="block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <option value="">
                  {t('execution.decisions.form.initiativePlaceholder', 'Select an initiative…')}
                </option>
                {executionInitiatives.map((initiative) => (
                  <option key={initiative.id} value={initiative.id}>
                    {initiative.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              {t('execution.decisions.form.due', 'Needed by (required)')}
              <input
                aria-label={t('execution.decisions.form.due', 'Needed by (required)')}
                type="date"
                value={newDecision.dueDate}
                onChange={(event) =>
                  setNewDecision((current) => ({ ...current, dueDate: event.target.value }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
            </label>
            <label className="text-xs">
              {t('execution.decisions.form.decisionMaker', 'Decydent')}
              <select
                aria-label={t('execution.decisions.form.decisionMaker', 'Decydent')}
                value={newDecision.decisionOwnerId}
                onChange={(event) =>
                  setNewDecision((current) => ({
                    ...current,
                    decisionOwnerId: event.target.value,
                  }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <option value="">
                  {t('execution.decisions.form.decisionMakerPlaceholder', 'Me (default)')}
                </option>
                {orgMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
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
            data-testid="execution-new-decision-save"
            disabled={
              !newDecision.title.trim() ||
              !newDecision.initiativeId.trim() ||
              !newDecision.dueDate.trim() ||
              newDecisionBusy
            }
            onClick={() => void createDecision()}
          >
            {t('execution.decisions.form.save', 'Save decision')}
          </button>
        </div>
      )}
      {/*
        „NOWA POZYCJA RAID" (P16/R4, DEC-453) — SIEDEM pól, tyle ile potrzeba,
        żeby wiersz był kompletny od razu: bez prawdopodobieństwa i wpływu
        kolumna „Ekspozycja" byłaby pusta, a bez terminu preset „Po terminie"
        nigdy by niczego nie pokazał (to jest DOKŁADNIE stan sprzed R4: 0 z 16
        pozycji miało termin). Wymagane są tytuł i inicjatywa — inicjatywa, bo
        kanoniczna komenda adresuje pozycję przez agregat inicjatywy.
      */}
      {newRaidOpen && (
        <div className="mb-3 rounded-lg border border-c-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <strong>{t('execution.raid.actions.new', 'New RAID item')}</strong>
            <button type="button" className="btn-secondary" onClick={() => setNewRaidOpen(false)}>
              {t('common.close', 'Close')}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs">
              {t('execution.raid.form.title', 'Title (required)')}
              <input
                aria-label={t('execution.raid.form.title', 'Title (required)')}
                value={newRaid.title}
                onChange={(event) =>
                  setNewRaid((current) => ({ ...current, title: event.target.value }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
            </label>
            <label className="text-xs">
              {t('execution.governance.columns.type', 'Typ')}
              <select
                aria-label={t('execution.governance.columns.type', 'Typ')}
                value={newRaid.type}
                onChange={(event) =>
                  setNewRaid((current) => ({ ...current, type: event.target.value as RaidTyp }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {RAID_TYPY.map((typ) => (
                  <option key={typ} value={typ}>
                    {raidTypeLabel(typ, t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              {t('execution.raid.form.initiative', 'Inicjatywa (wymagana)')}
              <select
                aria-label={t('execution.raid.form.initiative', 'Inicjatywa (wymagana)')}
                value={newRaid.initiativeId}
                onChange={(event) =>
                  setNewRaid((current) => ({ ...current, initiativeId: event.target.value }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <option value="">
                  {t('execution.decisions.form.initiativePlaceholder', 'Select an initiative…')}
                </option>
                {executionInitiatives.map((initiative) => (
                  <option key={initiative.id} value={initiative.id}>
                    {initiative.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              {t('execution.governance.columns.owner', 'Owner')}
              <select
                aria-label={t('execution.governance.columns.owner', 'Owner')}
                value={newRaid.ownerId}
                onChange={(event) =>
                  setNewRaid((current) => ({ ...current, ownerId: event.target.value }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <option value="">{t('execution.raid.form.unassigned', 'Nieprzypisana')}</option>
                {orgMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              {t('execution.governance.columns.due', 'Termin')}
              <input
                aria-label={t('execution.governance.columns.due', 'Termin')}
                type="date"
                value={newRaid.dueDate}
                onChange={(event) =>
                  setNewRaid((current) => ({ ...current, dueDate: event.target.value }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
            </label>
            <label className="text-xs">
              {t('execution.raid.columns.probability', 'Probability')}
              <select
                aria-label={t('execution.raid.columns.probability', 'Probability')}
                value={newRaid.probability}
                onChange={(event) =>
                  setNewRaid((current) => ({ ...current, probability: event.target.value }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {RAID_PRAWDOPODOBIENSTWO_OPCJE.map((opcja) => (
                  <option key={opcja} value={opcja}>
                    {raidProbabilityLabel(opcja, t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              {t('execution.raid.columns.impact', 'Impact')}
              <select
                aria-label={t('execution.raid.columns.impact', 'Impact')}
                value={newRaid.impact}
                onChange={(event) =>
                  setNewRaid((current) => ({ ...current, impact: event.target.value }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {RAID_WPLYW_OPCJE.map((opcja) => (
                  <option key={opcja} value={opcja}>
                    {raidImpactLabel(opcja, t)}
                  </option>
                ))}
              </select>
            </label>
            {/*
              EKSPOZYCJA W FORMULARZU — pokazana, ale NIEEDYTOWALNA. To ta sama
              liczba, którą pokaże kolumna; widać ją zanim się zapisze, więc
              nikt nie odkrywa jej dopiero na liście.
            */}
            <div className="text-xs">
              {t('execution.raid.columns.exposure', 'Ekspozycja')}
              <output
                data-testid="execution-new-raid-exposure"
                aria-label={t('execution.raid.columns.exposure', 'Ekspozycja')}
                className="mt-[2px] block w-full rounded border border-c-border bg-c-surface-muted p-2 font-semibold tabular-nums"
              >
                {ekspozycjaRaid(newRaid.probability, newRaid.impact) ?? '—'}
              </output>
            </div>
          </div>
          {newRaidError && (
            <p role="alert" className="mt-2 text-xs text-c-danger">
              {newRaidError}
            </p>
          )}
          <button
            type="button"
            className="btn-secondary mt-3"
            data-testid="execution-new-raid-save"
            disabled={!newRaid.title.trim() || !newRaid.initiativeId.trim() || newRaidBusy}
            onClick={() => void createRaid()}
          >
            {t('execution.raid.form.save', 'Save RAID item')}
          </button>
        </div>
      )}
      {/*
        DWA REJESTRY, JEDNA ZAKŁADKA (P16/R5, DEC-453). Preset „Sygnały" ma
        WŁASNY zbiór wierszy (`/execution-control/delay-signals`, 42 sztuki),
        własny zestaw kolumn i własny podgląd — nie da się go wcisnąć w
        `GovernanceRow`, bo sygnał nie ma ani decydenta, ani ekspozycji.
      */}
      {activeGovernancePreset !== 'sygnaly' && (
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
                  /*
                    P16/R4: druga pigułka POZYCJI RAID to jej STATUS i pasmo
                    ekspozycji, nie „Eskalacja: Czerwona". Przed R4 pigułka
                    pokazywała dotkliwość przemalowaną na słowo z rejestru
                    decyzji — pozycja RAID nie ma kroków eskalacji, więc ta
                    etykieta obiecywała mechanizm, którego nie ma.
                  */
                  row.kind === 'RAID'
                    ? {
                        label: row.raidStatusLabel ?? '',
                        tone:
                          pasmoEkspozycji(row.exposure ?? null) === 'wysokie'
                            ? 'danger'
                            : pasmoEkspozycji(row.exposure ?? null) === 'srednie'
                              ? 'warning'
                              : 'neutral',
                      }
                    : {
                        label: row.escalation,
                        tone:
                          Number(row.escalationStep ?? 0) >= ESCALATION_STEP_MAX
                            ? 'danger'
                            : Number(row.escalationStep ?? 0) > 0
                              ? 'warning'
                              : 'neutral',
                      },
                ],
                /*
                  P16/R4: ZDANIE DLA POZYCJI RAID MÓWI O RAID, nie o decyzji.
                  Bez tej gałęzi podgląd ryzyka po terminie radził
                  „rozstrzygnij albo eskaluj" — czasowniki rejestru DECYZJI,
                  których na pozycji RAID nie ma (są: zmień termin, zmień
                  właściciela, zamknij, eskaluj do problemu).
                */
                recommendation:
                  row.kind === 'RAID'
                    ? !czyRaidOtwarty(row.rawRaidStatus)
                      ? t('execution.raid.preview.closed', 'Item closed — stays in the register.')
                      : row.daysOverdue != null
                        ? `${t('execution.decisions.preview.overduePrefix', 'Po terminie o')} ${row.daysOverdue} ${t('execution.raid.preview.overdueSuffix', 'days — change the due date or close the item.')}`
                        : row.rawDueAt
                          ? t('execution.decisions.preview.onTime', 'The due date hasn\'t passed yet.')
                          : t('execution.raid.preview.noDue', 'Item has no due date — set one so it can be tracked.')
                    : row.kind === 'DECISION' && isResolvedDecision({ status: row.rawStatus })
                      ? t('execution.decisions.preview.resolved', 'The decision has been resolved — this entry cannot be deleted.'
                        )
                      : row.daysOverdue != null
                        ? `${t('execution.decisions.preview.overduePrefix', 'Po terminie o')} ${row.daysOverdue} ${t('execution.decisions.preview.overdueSuffix', 'dni — rozstrzygnij albo eskaluj.')}`
                        : t('execution.decisions.preview.onTime', 'The due date hasn\'t passed yet.'),
              }}
              details={{
                label:
                  row.kind === 'DECISION'
                    ? t('execution.decisions.preview.label', 'Decyzja')
                    : t('execution.governance.preview.raidLabel', 'Pozycja RAID'),
                text:
                  row.source?.description ||
                  row.source?.recommendation ||
                  t('execution.governance.preview.noDescription', 'No additional description.'),
                properties:
                  row.kind === 'DECISION'
                    ? [
                        {
                          id: 'decydent',
                          label: t('execution.decisions.columns.decisionMaker', 'Decydent'),
                          value: row.decydent ?? '—',
                        },
                        {
                          id: 'due',
                          label: t('execution.decisions.columns.due', 'Potrzebna do dnia'),
                          value: row.dueAt,
                        },
                        {
                          id: 'status',
                          label: t('execution.decisions.columns.status', 'Status'),
                          value: row.statusLabel ?? '—',
                        },
                        {
                          id: 'overdue',
                          label: t('execution.governance.columns.daysOverdue', 'Dni po terminie'),
                          value:
                            row.daysOverdue == null
                              ? t('execution.decisions.escalation.none', 'None')
                              : String(row.daysOverdue),
                        },
                        {
                          id: 'escalation',
                          label: t('execution.governance.columns.escalation', 'Eskalacja'),
                          value: row.escalation,
                        },
                        // Uzasadnienie pokazujemy TYLKO wtedy, gdy istnieje —
                        // pusty wiersz „Uzasadnienie: —" udawałby, że decyzja
                        // zapadła bez powodu, a taka nie ma prawa powstać.
                        ...(row.rationale
                          ? [
                              {
                                id: 'rationale',
                                label: t('execution.decisions.preview.rationale', 'Uzasadnienie'),
                                value: row.rationale,
                              },
                            ]
                          : []),
                        ...(row.decidedAt
                          ? [
                              {
                                id: 'decidedAt',
                                label: t('execution.decisions.preview.decidedAt', 'Resolved on'),
                                value: formatDay(row.decidedAt),
                              },
                            ]
                          : []),
                      ]
                    : [
                        // P16/R4: podglad POZYCJI RAID mowi to samo, co kolumny,
                        // plus inicjatywe (NAZWA, nie UUID) i zrodlo eskalacji.
                        {
                          id: 'initiative',
                          label: t('execution.raid.preview.initiative', 'Inicjatywa'),
                          value:
                            initiativeNames[String(row.raidInitiativeId ?? '')] ??
                            (row.raidInitiativeId
                              ? String(row.raidInitiativeId)
                              : t('execution.raid.preview.noInitiative', 'Bez inicjatywy')),
                        },
                        {
                          id: 'owner',
                          label: t('execution.governance.columns.owner', 'Owner'),
                          value: row.owner,
                        },
                        {
                          id: 'due',
                          label: t('execution.governance.columns.due', 'Termin'),
                          value: row.dueAt,
                        },
                        {
                          id: 'probability',
                          label: t('execution.raid.columns.probability', 'Probability'),
                          value: row.probabilityLabel ?? '—',
                        },
                        {
                          id: 'impact',
                          label: t('execution.raid.columns.impact', 'Impact'),
                          value: row.impactLabel ?? '—',
                        },
                        {
                          id: 'exposure',
                          label: t('execution.raid.columns.exposure', 'Ekspozycja'),
                          value: row.exposure == null ? '—' : String(row.exposure),
                        },
                        {
                          id: 'raidStatus',
                          label: t('execution.raid.columns.status', 'Status'),
                          value: row.raidStatusLabel ?? '—',
                        },
                        {
                          id: 'overdue',
                          label: t('execution.governance.columns.daysOverdue', 'Dni po terminie'),
                          value:
                            row.daysOverdue == null
                              ? t('execution.decisions.escalation.none', 'None')
                              : String(row.daysOverdue),
                        },
                        ...(zrodloEskalacji(row.description)
                          ? [
                              {
                                id: 'sourceRaid',
                                label: t('execution.raid.preview.source', 'Created from item'),
                                value: String(zrodloEskalacji(row.description)),
                              },
                            ]
                          : []),
                      ],
              }}
              /*
                BLOK AKCJI = trzy ROZSTRZYGNIĘCIA (P16/R3, DEC-453).
                Eskalacja NIE stoi tutaj — ona jest w kebabie wiersza; ta sama
                akcja nie może mieć dwóch domów (doktryna gęstości §1).
                Blok pojawia się WYŁĄCZNIE dla decyzji nierozstrzygniętej i
                wyłącznie temu, kto może ją rozstrzygnąć (decydent / ADMIN) —
                MEMBER nie zobaczy przycisku, który i tak odbiłby się o 403.
              */
              actions={
                /*
                  P16/R4: BLOK AKCJI POZYCJI RAID — Zmień termin · Zmień
                  właściciela · Zamknij pozycję. „Eskaluj do problemu" NIE stoi
                  tutaj: ona ma dom w kebabie wiersza (doktryna gęstości §1).
                  Uzasadnienia wymaga WYŁĄCZNIE zamknięcie (§R4.2) — zmiana
                  terminu i właściciela zapisuje się od razu.
                  Zamknięta pozycja nie dostaje żadnej akcji: to jest stan
                  końcowy, a nie „można jeszcze poprawić".
                */
                row.kind === 'RAID'
                  ? czyRaidOtwarty(row.rawRaidStatus)
                    ? {
                        resolutions: [
                          {
                            id: 'raid-due',
                            variant: 'neutral',
                            label: t('execution.raid.actions.changeDue', 'Change due date'),
                            icon: CalendarClock,
                            disabled: raidBusy,
                            onClick: () => {
                              setRaidError(null);
                              setRaidEdit({
                                pole: 'dueDate',
                                row,
                                wartosc: row.rawDueAt ? String(row.rawDueAt).slice(0, 10) : '',
                              });
                            },
                          },
                          {
                            id: 'raid-owner',
                            variant: 'neutral',
                            label: t('execution.raid.actions.changeOwner', 'Change owner'),
                            icon: UserCog,
                            disabled: raidBusy,
                            onClick: () => {
                              setRaidError(null);
                              setRaidEdit({
                                pole: 'ownerId',
                                row,
                                wartosc: String(row.ownerId ?? ''),
                              });
                            },
                          },
                        ],
                        informational: [
                          {
                            id: 'raid-close',
                            variant: 'neutral',
                            label: t('execution.raid.actions.close', 'Close item'),
                            icon: CircleSlash,
                            disabled: raidBusy,
                            onClick: () => {
                              setReasonError(null);
                              setReasonDialog({ kind: 'raid-close', row });
                            },
                          },
                        ],
                      }
                    : undefined
                  : row.kind === 'DECISION' &&
                      row.canDecide &&
                      !isResolvedDecision({ status: row.rawStatus })
                  ? {
                      resolutions: [
                        {
                          id: 'decision-approve',
                          variant: 'positive',
                          label: t('execution.decisions.actions.approve', 'Rozstrzygnij'),
                          icon: CheckCircle2,
                          onClick: () => {
                            setReasonError(null);
                            setReasonDialog({ kind: 'approve', row });
                          },
                        },
                        {
                          id: 'decision-reject',
                          variant: 'destructive',
                          label: t('execution.decisions.actions.reject', 'Reject'),
                          icon: XCircle,
                          onClick: () => {
                            setReasonError(null);
                            setReasonDialog({ kind: 'reject', row });
                          },
                        },
                      ],
                      informational: [
                        {
                          id: 'decision-supersede',
                          variant: 'neutral',
                          label: t('execution.decisions.actions.supersede', 'Nieaktualna'),
                          icon: CircleSlash,
                          onClick: () => {
                            setReasonError(null);
                            setReasonDialog({ kind: 'supersede', row });
                          },
                        },
                      ],
                    }
                  : undefined
              }
              relationsEmptyLabel={t('execution.governance.preview.noRelations', 'No relations')}
            />
          )}
        >
          <StandardTable
            columns={activeGovernancePreset === 'ryzyka' ? raidColumns : decisionColumns}
            data={visibleGovernanceRows}
            selectedRowId={selectedGovernanceId}
            onRowClick={(row) => setSelectedGovernanceId(row.id)}
            rowMenu={buildGovernanceRowMenu}
            persistKey={
              // Zestaw kolumn zmienia się razem z presetem, więc szerokości i
              // widoczność kolumn muszą mieć OSOBNY klucz zapisu. Wspólny
              // `execution.governance.v1` zapisywałby ustawienia jednego
              // zestawu i odtwarzał je dla drugiego (kolumny o innych `id`).
              activeGovernancePreset === 'ryzyka'
                ? 'execution.governance.raid.v1'
                : 'execution.governance.decisions.v1'
            }
            empty={{
              title:
                activeGovernancePreset === 'ryzyka'
                  ? t('execution.governance.empty.raidTitle', 'No items in the RAID register')
                  : t('execution.governance.empty.decisionsTitle', 'No decisions in the register'),
              description: t('execution.governance.empty.description', 'The register reads the organization\'s decisions and RAID items. An empty register means nothing is pending.'
              ),
            }}
          />
        </TableWithPreviewLayout>
        {/*
          BŁĄD ZAPISU RAID Z KEBABA („Eskaluj do problemu") — widoczny NA
          EKRANIE. Zakaz z §4: żadnego `.catch(() => {})`; awaria po kliknięciu
          w kebab nie ma okna, w którym mogłaby się pokazać, więc ma własne
          miejsce pod tabelą.
        */}
        {raidError && !raidEdit && (
          <p role="alert" className="mt-2 text-xs text-c-danger">
            {raidError}
          </p>
        )}
      </div>
      )}
      {/*
        REJESTR SYGNAŁÓW OPÓŹNIEŃ (P16/R5, §4 D4) — 42 policzone przez system,
        czytane, a nie wpisywane ręcznie. Wiersz → podgląd → „Przygotuj
        interwencję" = wniosek o przesunięcie jako decyzja re-baseline.
      */}
      {activeGovernancePreset === 'sygnaly' && (
        <div className="mb-3 flex min-h-0 flex-1 flex-col">
          <TableWithPreviewLayout<DelayRow>
            selectedId={selectedDelayId}
            selectedItem={selectedDelay}
            onSelect={setSelectedDelayId}
            itemIds={visibleDelayRows.map((row) => row.id)}
            getItemById={(id) => delayRows.find((row) => row.id === id) ?? null}
            previewOpen={Boolean(selectedDelayId)}
            renderPreview={(row) => (
              <StandardPreview
                embedded
                title={row.entityName}
                onClose={() => setSelectedDelayId(null)}
                meta={{
                  pills: [
                    { label: row.kindLabel, tone: 'neutral' },
                    {
                      label: row.stateLabel,
                      tone:
                        row.state === 'INTERWENCJA'
                          ? 'warning'
                          : row.state === 'ZAMKNIETY'
                            ? 'neutral'
                            : 'danger',
                    },
                  ],
                  recommendation:
                    row.state === 'NOWY'
                      ? t('execution.signals.preview.new', 'Signal without a response — prepare a delay request or make up the delay.'
                        )
                      : row.state === 'INTERWENCJA'
                        ? t('execution.signals.preview.intervention', 'The delay request is awaiting resolution in the Decisions view.'
                          )
                        : t('execution.signals.preview.closed', 'The delay request has already been resolved.'
                          ),
                }}
                details={{
                  label: t('execution.signals.preview.label', 'Delay signal'),
                  text:
                    row.entityType === 'INITIATIVE'
                      ? t('execution.signals.preview.initiative', 'The signal concerns an initiative.')
                      : t('execution.signals.preview.task', 'The signal concerns a task.'),
                  properties: [
                    {
                      id: 'kind',
                      label: t('execution.signals.columns.kind', 'Signal type'),
                      value: row.kindLabel,
                    },
                    {
                      id: 'deviation',
                      label: t('execution.signals.columns.deviation', 'Odchylenie (dni)'),
                      value: row.deviationDays > 0 ? `+${row.deviationDays}` : '—',
                    },
                    {
                      id: 'reason',
                      label: t('execution.signals.columns.reason', 'Reason'),
                      value: row.reasonLabel,
                    },
                    {
                      id: 'planned',
                      label: t('execution.signals.preview.planned', 'Data planowana'),
                      value: formatDay(row.signal.plannedDate),
                    },
                    {
                      id: 'detected',
                      label: t('execution.signals.columns.detectedAt', 'Wykryto'),
                      value: row.detectedAt,
                    },
                    {
                      id: 'state',
                      label: t('execution.signals.columns.state', 'Stan'),
                      value: row.stateLabel,
                    },
                    ...(row.decisionId
                      ? [
                          {
                            id: 'decision',
                            label: t('execution.signals.preview.decision', 'Delay request'),
                            value: tytulInterwencji(row.entityName, row.deviationDays),
                          },
                        ]
                      : []),
                  ],
                }}
                /*
                  JEDNA AKCJA, JEDEN DOM (doktryna gęstości §1): „Przygotuj
                  interwencję" stoi WYŁĄCZNIE tutaj — nie ma jej ani w kebabie
                  wiersza, ani w Menu 2 (skąd martwy przycisk o tej nazwie
                  usunął R5). Znika, gdy wniosek już istnieje: druga decyzja na
                  ten sam sygnał nie ma sensu i tylko rozdwoiłaby ślad.
                */
                actions={
                  /*
                    UPRAWNIENIE ZMIERZONE, NIE ZGADNIĘTE (07.09, konto MEMBER
                    Anna Kowalska na kopii bazy): `POST /api/decisions` odsyła
                    MEMBER-owi **403 Permission denied** (`approve_changes`) —
                    ta sama bramka, którą R3 lustruje w `canDecide`. Dlatego
                    „Przygotuj interwencję" nie pokazuje się temu, kto i tak
                    dostałby 403. Bramką prawdy zostaje SERWER; to jest
                    wyłącznie uprzejmość interfejsu.
                    UWAGA — dla pozycji RAID robimy INACZEJ i celowo: kanoniczny
                    writer sprawdza uprawnienie `initiative.update` PER PROJEKT,
                    a nie rolę (zmierzone: ta sama Anna dostaje 404 na inicjatywie
                    bez dostępu), więc ukrycie CTA po roli zabrałoby przycisk
                    członkom, którzy mają prawo zgłosić ryzyko na SWOIM projekcie.
                    Tam zostaje CTA + polski komunikat po odmowie.
                  */
                  row.state === 'NOWY' && canDecide(null)
                    ? {
                        resolutions: [
                          {
                            id: 'signal-intervention',
                            variant: 'positive',
                            label: t('execution.signals.actions.prepareIntervention', 'Prepare intervention'
                            ),
                            icon: Wrench,
                            disabled: interventionBusy,
                            onClick: () => void przygotujInterwencje(row),
                          },
                        ],
                      }
                    : undefined
                }
                relationsEmptyLabel={t('execution.governance.preview.noRelations', 'No relations')}
              />
            )}
          >
            <StandardTable
              columns={delayColumns}
              data={visibleDelayRows}
              selectedRowId={selectedDelayId}
              onRowClick={(row) => setSelectedDelayId(row.id)}
              persistKey="execution.governance.signals.v1"
              empty={{
                title: t('execution.signals.empty.title', 'No delay signals'),
                description: t('execution.signals.empty.description', 'The system counts signals from initiative and task due dates. Empty means nothing is slipping.'
                ),
              }}
            />
          </TableWithPreviewLayout>
          {interventionError && (
            <p role="alert" className="mt-2 text-xs text-c-danger">
              {interventionError}
            </p>
          )}
        </div>
      )}
      {/*
        WARSZTAT runtime-v1 (P16/R5, DEC-453) — ZOSTAJE ZAMKNIĘTY.

        Po usunięciu z Menu 2 przycisków „Dodaj sygnał" i „Przygotuj
        interwencję" (oba martwe: pierwszy żądał UUID i wersji źródła, drugi
        był ZAWSZE wyszarzony) nic już tego warsztatu nie otwiera.
        ZMIERZONE 07.09 na zrzucie `evidence/p16-r45/po/03-po-reload-trwale.png`:
        gdy spróbowałem otworzyć go samym istnieniem danych, warsztat WYPCHNĄŁ
        rejestr RAID poza ekran (atrapa przeglądu podstawia 2 interwencje) i
        odsłonił drugi, starszy defekt — komentarz JSX niżej był napisany bez
        klamer, więc jego treść wyciekała na ekran jako tekst.

        DŁUG NAZWANY WPROST: ~600 linii UI runtime-v1 w tym pliku nie ma dziś
        żadnego wołacza z interfejsu. Kontrakt API (`ingestManagementSignal`,
        `draftIntervention`, `transitionIntervention`) zostaje nietknięty —
        usunięcie samego UI to osobny krok, poza zakresem R5, i dotknie
        `tests/unit/initiatives-execution/executionControlSurface.test.tsx`
        (5 z 5 przypadków czerwonych już na HEAD, `useLocation` bez Routera).
      */}
      {showInterventionForm && (
        <section
          aria-label="Intervention Signal Workbench"
          className="mt-4 flex min-h-0 flex-1 flex-col"
        >
          <h3 className="font-semibold">
            {t('execution.signals.title', 'Management signals')}
          </h3>
          {showSignalForm && (
            <div className="mt-3 rounded-lg border border-c-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <strong>{t('execution.signals.new', 'New signal')}</strong>
                <button className="btn-secondary" onClick={() => setShowSignalForm(false)}>
                  {t('common.close', 'Close')}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs">
                  {t('execution.signals.kindLabel', 'Signal kind')}
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
                    <option value="STALE_MILESTONE">
                      {t('execution.signals.rule.stale_milestone', 'Stale milestone')}
                    </option>
                    <option value="CAPACITY_CONFLICT">
                      {t('execution.signals.rule.capacity_conflict', 'Capacity conflict')}
                    </option>
                  </select>
                </label>
                {Object.keys(signalForm)
                  .filter((key) => key !== 'kind')
                  .map((key) => (
                    <label key={key} className="text-xs">
                      {signalFieldLabels(t)[key] ?? key}
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
                          <option value="WARNING">
                            {t('execution.signals.severity.warning', 'Warning')}
                          </option>
                          <option value="CRITICAL">
                            {t('execution.signals.severity.critical', 'Critical')}
                          </option>
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
                {t('execution.signals.save', 'Save signal')}
              </button>
            </div>
          )}
          {/*
            KOMENTARZ, NIE TREŚĆ (naprawa przy P16/R5, DEC-453): ten blok był
            napisany bez klamer `{...}`, więc JSX traktował go jako TEKST i
            wypisywał na ekran „/* * Lancuch wysokosci …". Nie było tego widać,
            bo warsztat nigdy się nie rysował — wyszło dopiero na zrzucie
            `evidence/p16-r45/po/03-po-reload-trwale.png`.

            Treść oryginalna: łańcuch wysokości — patrz komentarz w
            `ExecutionResourcesSurface.tsx`. `TableWithPreviewLayout` ma root
            `h-full`; `height:100%` rozwiązuje się tylko względem rodzica
            o definitywnej wysokości. Pudełka `p-4`/`mt-4` o wysokości `auto`
            przerywały ten łańcuch i panel podglądu kończył się na własnej
            treści. Zmierzone `scripts/dev/measure-preview-canon.mjs --wysokosc`.
          */}
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
                  openLabel={t('execution.signals.openPrep', 'Open preparation')}
                  meta={{
                    pills: [
                      {
                        label: row.severity,
                        tone: row.rawSeverity === 'CRITICAL' ? 'danger' : 'warning',
                      },
                    ],
                    recommendation: `${t('execution.signals.project', 'Project')} ${
                      row.signal.projectId ?? 'UNKNOWN'
                    } · ${t('execution.signals.field.ruleId', 'Detection rule')}: ${row.rule}`,
                  }}
                  details={{
                    label: t('execution.signals.singleTitle', 'Management signal'),
                    text: `${row.signal.sourceType}:${row.signal.sourceId}`,
                    properties: [
                      { id: 'project', label: 'Projekt', value: row.signal.projectId ?? 'UNKNOWN' },
                      { id: 'fingerprint', label: 'Fingerprint', value: row.signal.fingerprint },
                      {
                        id: 'occurrences',
                        label: t('execution.signals.occurrences', 'Occurrences'),
                        value: String(row.occurrences),
                      },
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
                  relationsEmptyLabel={t(
                    'execution.signals.noSources',
                    'No versioned sources'
                  )}
                  actions={{
                    informational: [
                      {
                        id: 'add-to-intervention',
                        variant: 'neutral',
                        label: t('execution.signals.addToIntervention', 'Add to the prepared intervention'),
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
      {/*
        1.12-R1 (C): warsztat `runtime-v1` (interwencje) tylko wtedy, gdy MA
        rekordy I gdy użytkownik świadomie go otworzył („Dodaj sygnał" /
        „Przygotuj interwencję" w Menu 2).
        ZMIERZONE NA ZRZUCIE (06.09, /execution?tab=control): dwie siostrzane
        tabele z `flex-1` w tym samym kontenerze kolumnowym zjadły się
        nawzajem — rejestr decyzji zwijał się do zera, a na ekranie została
        SAMA tabela interwencji (w dev: dwa wiersze atrapy). Rejestr decyzji
        jest treścią zakładki; warsztat jest narzędziem, więc schodzi pod
        świadome otwarcie.
      */}
      {hasRuntimeControlData && showInterventionForm && (
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
              openLabel={t('execution.intervention.open', 'Open intervention')}
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
                  {
                    id: 'owner',
                    label: t('execution.intervention.field.owner', 'Owner'),
                    value: r.owner || 'UNASSIGNED',
                  },
                  {
                    id: 'authority',
                    label: t('execution.intervention.approver', 'Approver'),
                    value: r.authority || 'UNKNOWN',
                  },
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
                  label: optionKindLabel(option.kind, t)
                    ? `${optionKindLabel(option.kind, t)}: ${option.label}`
                    : option.label,
                  value: `${confidenceLabel(option.confidence, t)} · ${reversibilityLabel(option.reversibility, t)}`,
                })),
              ]}
              relationsEmptyLabel={t(
                'execution.intervention.noSignals',
                'No linked signals'
              )}
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
                  label: t('execution.intervention.open', 'Open intervention'),
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
              title: t('execution.intervention.emptyTitle', 'No intervention cases'),
              description:
                t(
                  'execution.intervention.emptyBody',
                  'Add a versioned signal to prepare the first intervention case.'
                ),
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
            <h3 className="font-semibold">
              {t('execution.intervention.composer', 'Intervention draft')}
            </h3>
            <button className="btn-secondary" onClick={() => setInterventionComposerOpen(false)}>
              {t('common.close', 'Close')}
            </button>
          </div>
          {(!selected || selected.source.status === 'DRAFT') && (
            <>
              <p className="text-xs text-c-text-muted">
                {t('execution.intervention.selectedSignals', 'Selected signals')}:{' '}
                {draftSignalIds.length}
              </p>
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
                      {interventionFieldLabels(t)[key] ?? key}
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
                <summary className="cursor-pointer text-sm">
                  {t('executionReports.advancedJson', 'Advanced JSON contract')}
                </summary>
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={advancedJson}
                    onChange={(event) => setAdvancedJson(event.target.checked)}
                  />
                  {t('execution.intervention.useJson', 'Use the JSON contract instead of the form')}
                </label>
                <textarea
                  aria-label={t('execution.intervention.draftJson', 'Intervention draft JSON')}
                  value={draftJson}
                  onChange={(e) => setDraftJson(e.target.value)}
                  disabled={!advancedJson}
                  className="mt-2 min-h-32 w-full rounded border border-c-border bg-c-surface p-2 font-mono text-xs"
                />
              </details>
              <button className="btn-primary mt-3" onClick={() => void draft()}>
                {t('execution.intervention.saveOrLink', 'Save or link the intervention case')}
              </button>
            </>
          )}
          {(!selected || ['DRAFT', 'PENDING_DECISION'].includes(selected.source.status)) && (
            <section className="mt-4 rounded border border-c-border p-3">
              <h4 className="font-medium">
                {t('execution.intervention.independentDecision', 'Independent decision')}
              </h4>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_2fr_auto]">
                <button className="btn-secondary" onClick={() => void transition('REQUEST')}>
                  {t('execution.intervention.requestDecision', 'Request a decision')}
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
                  {t('execution.intervention.approveOption', 'Approve option')}
                </button>
              </div>
            </section>
          )}
          <section className="mt-4 rounded border border-c-border p-3">
            <h4 className="font-medium">
              {t('execution.intervention.applyCommand', 'Applying the approved command')}
            </h4>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Object.keys(apply).map((k) => (
                <label key={k} className="text-xs">
                  {applyFieldLabels(t)[k] ?? k}
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
                <h4 className="font-medium">
                  {t('execution.plan.governedChange', 'Governed plan change')}
                </h4>
                <p className="text-xs text-c-text-muted">
                  {t(
                    'execution.plan.governedChangeLead',
                    'Resequencing goes through a governed plan change and independent approval.'
                  )}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setGovernedPlanOpen((open) => !open)}
              >
                {governedPlanOpen
                  ? t('execution.plan.closeChange', 'Close plan change')
                  : t('execution.plan.prepareChange', 'Prepare plan change')}
              </button>
            </div>
            {governedPlanOpen && (
              <section
                aria-label="Governed Plan resequence"
                className="mt-3 rounded border border-c-border p-3"
              >
                <h4 className="font-medium">
                  {t('execution.plan.governedResequence', 'Governed resequencing')}
                </h4>
                <p className="text-xs text-c-text-muted">
                  {t(
                    'execution.plan.governedResequenceLead',
                    'The selected resequencing option creates one governed change to the baseline plan. Review and publication happen in My Work, and applying it requires an exact command confirmation.'
                  )}
                </p>
                <label className="block text-xs">
                  {t('execution.plan.selectedComparison', 'Selected capacity comparison')}
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
                    <option value="">
                      {t(
                        'execution.plan.pickResequenceOption',
                        'Pick the exact resequencing option'
                      )}
                    </option>
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
                  {t('execution.plan.createChange', 'Create governed plan change')}
                </button>
              </section>
            )}
            <button className="btn-primary mt-3" onClick={() => void transition('APPLY')}>
              {t('execution.intervention.applyConfirmed', 'Apply the confirmed command')}
            </button>
          </section>
          <section className="mt-4 rounded border border-c-border p-3">
            <h4 className="font-medium">
              {t('execution.intervention.verifyEffect', 'Effect verification')}
            </h4>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[220px_1fr_auto]">
              <select
                aria-label="Intervention verification outcome"
                value={verifyOutcome}
                onChange={(e) => setVerifyOutcome(e.target.value)}
                className="block w-full rounded border border-c-border bg-c-surface p-2"
              >
                {['EFFECTIVE', 'PARTIAL', 'INEFFECTIVE', 'NOT_VERIFIED'].map((x) => (
                  <option key={x} value={x}>
                    {verificationOutcomeLabel(x, t)}
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
                {t('execution.intervention.verify', 'Verify intervention')}
              </button>
            </div>
          </section>
          {write === 'FAILED' && (
            <p role="alert">{t('execution.intervention.notApplied', 'The change was not applied.')}</p>
          )}
          {receipt && (
            <div role="status" className="rounded border border-c-success/40 p-3">
              <strong>{interventionStatusLabel(receipt.status, t)}</strong>
              {receipt.targetCommand && (
                <p>
                  {t('execution.intervention.targetReceipt', 'Target command receipt')}{' '}
                  {receipt.targetCommand.clientRequestId} ·{' '}
                  {receipt.targetCommand.aggregateType}/{receipt.targetCommand.aggregateId} v
                  {receipt.targetCommand.aggregateVersion}
                </p>
              )}
              {receipt.oldHash && (
                <p>
                  {t('execution.plan.hashBefore', 'Plan hash before')} {receipt.oldHash} →{' '}
                  {t('execution.plan.hashAfter', 'after')} {receipt.newHash}
                </p>
              )}
              {receipt.verification && (
                <p>
                  {receipt.verification.outcome === 'EFFECTIVE'
                    ? t('execution.intervention.effectiveClosed', 'Effective · closed')
                    : `${verificationOutcomeLabel(receipt.verification.outcome, t)} · ${t(
                        'execution.intervention.escalated',
                        'escalated'
                      )}`}
                </p>
              )}
            </div>
          )}
        </section>
      )}
      {/*
        OKNO WYMAGANEGO POWODU (P16/R3, DEC-453) — jedno dla czterech akcji.
        Wspólny `ReasonDialog` ze standardu (ten sam, którego używa cykl życia
        Inicjatyw), więc reguła „przycisk nieaktywny przy pustym polu" jest
        JEDNYM kawałkiem kodu, a nie kopią per ekran. Czerwień (`destructive`)
        wyłącznie dla „Odrzuć" — kanon: crimson tylko dla akcji krytycznej.
      */}
      <ReasonDialog
        open={Boolean(reasonDialog)}
        testIdPrefix="execution-decision-reason"
        busy={reasonBusy}
        error={reasonError}
        destructive={reasonDialog?.kind === 'reject'}
        title={
          reasonDialog?.kind === 'approve'
            ? t('execution.decisions.dialog.approve', 'Resolve decision')
            : reasonDialog?.kind === 'reject'
              ? t('execution.decisions.dialog.reject', 'Reject decision')
              : reasonDialog?.kind === 'supersede'
                ? t('execution.decisions.dialog.supersede', 'Mark decision as superseded')
                : reasonDialog?.kind === 'raid-close'
                  ? t('execution.raid.dialog.close', 'Close RAID item')
                  : t('execution.decisions.dialog.escalate', 'Escalate decision')
        }
        confirmLabel={
          reasonDialog?.kind === 'approve'
            ? t('execution.decisions.actions.approve', 'Rozstrzygnij')
            : reasonDialog?.kind === 'reject'
              ? t('execution.decisions.actions.reject', 'Reject')
              : reasonDialog?.kind === 'supersede'
                ? t('execution.decisions.actions.supersede', 'Nieaktualna')
                : reasonDialog?.kind === 'raid-close'
                  ? t('execution.raid.actions.close', 'Close item')
                  : t('execution.decisions.actions.escalate', 'Eskaluj')
        }
        label={
          reasonDialog?.kind === 'escalate'
            ? t('execution.decisions.dialog.escalateLabel', 'Escalation reason (required)')
            : reasonDialog?.kind === 'raid-close'
              ? t('execution.raid.dialog.closeLabel', 'What was done about it (required)')
              : t('execution.decisions.dialog.rationaleLabel', 'Rationale (required)')
        }
        placeholder={
          reasonDialog?.kind === 'escalate'
            ? t('execution.decisions.dialog.escalatePlaceholder', 'Write why this decision is moving up a level.'
              )
            : reasonDialog?.kind === 'raid-close'
              ? t(
                  'execution.raid.dialog.closePlaceholder',
                  'Write one sentence on why this item is being closed.'
                )
              : t('execution.decisions.dialog.rationalePlaceholder', 'Write one sentence on why you\'re resolving it this way — it goes into the register permanently.'
                )
        }
        hint={
          reasonDialog?.kind === 'escalate'
            ? t('execution.decisions.dialog.escalateHint', 'The level goes up by one: initiative owner → PMO → committee.'
              )
            : reasonDialog?.kind === 'raid-close'
              ? t('execution.raid.dialog.closeHint', 'The item stays in the register with status "Closed" and stops counting toward "Overdue".'
                )
              : t('execution.decisions.dialog.rationaleHint', 'This entry cannot be deleted or resolved a second time.'
                )
        }
        onCancel={() => {
          setReasonDialog(null);
          setReasonError(null);
        }}
        onConfirm={(reason) => void confirmReason(reason)}
      />
      {/*
        EDYCJA JEDNEGO POLA POZYCJI RAID (P16/R4, DEC-453) — termin albo
        właściciel. Powód NIE jest wymagany: §R4.2 wymaga go wyłącznie przy
        ZAMKNIĘCIU pozycji, a żądanie uzasadnienia przy każdej zmianie daty
        zamieniłoby rejestr w formularz i nikt by go nie prowadził.
      */}
      {raidEdit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            raidEdit.pole === 'dueDate'
              ? t('execution.raid.dialog.due', 'Change RAID item due date')
              : t('execution.raid.dialog.owner', 'Change RAID item owner')
          }
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-c-border bg-c-surface p-5 shadow-lg">
            <h3 className="text-sm font-semibold">
              {raidEdit.pole === 'dueDate'
                ? t('execution.raid.dialog.due', 'Change RAID item due date')
                : t('execution.raid.dialog.owner', 'Change RAID item owner')}
            </h3>
            <p className="mt-1 text-xs text-c-text-muted">{raidEdit.row.title}</p>
            {raidEdit.pole === 'dueDate' ? (
              <input
                type="date"
                autoFocus
                data-testid="execution-raid-edit-input"
                aria-label={t('execution.governance.columns.due', 'Termin')}
                value={raidEdit.wartosc}
                onChange={(event) =>
                  setRaidEdit((current) =>
                    current ? { ...current, wartosc: event.target.value } : current
                  )
                }
                className="mt-3 block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
            ) : (
              <select
                autoFocus
                data-testid="execution-raid-edit-input"
                aria-label={t('execution.governance.columns.owner', 'Owner')}
                value={raidEdit.wartosc}
                onChange={(event) =>
                  setRaidEdit((current) =>
                    current ? { ...current, wartosc: event.target.value } : current
                  )
                }
                className="mt-3 block w-full rounded border border-c-border bg-c-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <option value="">{t('execution.raid.form.unassigned', 'Nieprzypisana')}</option>
                {orgMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            )}
            {raidError && (
              <p role="alert" className="mt-2 text-xs text-c-danger">
                {raidError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setRaidEdit(null);
                  setRaidError(null);
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                data-testid="execution-raid-edit-save"
                disabled={raidBusy}
                onClick={() => void zapiszPoleRaid()}
              >
                {t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

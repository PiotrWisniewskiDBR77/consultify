import { ExternalLink } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  OverflowTooltip,
  StandardKanban,
  type StandardKanbanCard,
  type StandardKanbanColumn,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
} from '@/components/standard';
import { EntityStatusChip, statusChipTone } from '@/components/ui/primitives/chips';
import { memberNameOrUnknown, type MemberNameResolver } from '@/hooks/useOrganizationMemberNames';
import { localeListy } from '@/utils/listDateFormat';
import { tlumaczPozaHookiem } from '@/utils/tlumaczPozaHookiem';

import type {
  ExecutionBankHorizonMonths,
  ExecutionBankRow,
  ExecutionCalendarBucket,
  ExecutionCalendarWindow,
} from './executionBankModel';
import type { ExecutionRiskSignal } from './executionRiskSignal';
import { ExecutionHandoffBadge, ExecutionRiskCell } from './executionRiskSignalView';

export type ExecutionBankViewMode = 'table' | 'kanban' | 'calendar' | 'gantt';

export interface ExecutionBankIdentity {
  initiativeId: string;
  executionCaseId: string | null;
}

export interface ExecutionBankViewsProps {
  rows: readonly ExecutionBankRow[];
  view: ExecutionBankViewMode;
  selected: ExecutionBankIdentity | null;
  calendarWindow: ExecutionCalendarWindow;
  onSelect: (row: ExecutionBankRow) => void;
  onOpen: (row: ExecutionBankRow) => void;
  onHorizonChange: (months: ExecutionBankHorizonMonths) => void;
  onDrilldownMonth: (month: string | null) => void;
  /**
   * K5-R1 — identyfikator osoby → NAZWISKO (katalog członków organizacji).
   *
   * POWÓD (pomiar 2026-09-13, żywy staging, org DBR77): kolumna OWNER
   * pokazywała surowy UUID `d2b6a316-…` w KAŻDYM wierszu, a awatar kanbana
   * skrót „D2". Źródło: `buildRow` bierze `ownerId` z
   * `executionCase.executionManagerId`, a `ownerName` WYŁĄCZNIE z rekordu
   * inicjatywy — którego dla tych realizacji nie ma (`/api/initiatives` ich
   * nie zna, patrz nota przy `caseAvailabilityLabel`). Widok robił wtedy
   * `ownerName ?? ownerId`, czyli wypuszczał kod techniczny na ekran (łamie
   * P4 kanonu: zero kodów technicznych w UI).
   *
   * Ten resolver to ta sama droga, którą nazwiska rozwiązują Wyniki i Finanse
   * (`useOrganizationMemberNames`). Gdy katalog nie zna identyfikatora
   * (konto usunięte — a tak jest z `d2b6a316-…`, brak wiersza w `users`),
   * pokazujemy „Unknown user", NIGDY UUID-a.
   */
  resolveOwnerName?: MemberNameResolver;
  /**
   * B-E0 — sygnał ryzyka per inicjatywa (3 osie × 4 poziomy, DEC-487).
   * `undefined` = flaga `VITE_EXEC_RISK_SIGNAL` wyłączona → kolumna „Risk"
   * NIE POWSTAJE, więc przy OFF tabela jest co do kolumny tą samą tabelą, co
   * na linii (parytet wymagany w E1).
   */
  riskSignals?: ReadonlyMap<string, ExecutionRiskSignal>;
  /**
   * H2 — czy pokazać ślad przekazania (kolumna „Handoff"). Domyślnie NIE:
   * flaga `VITE_EXEC_HANDOFF_TRACE` jest OFF do akceptu właściciela, więc
   * przy OFF tabela ma te same kolumny co linia (reguła #9).
   */
  showHandoffTrace?: boolean;
}

const UNKNOWN_LABELS: Record<string, string> = {
  INITIATIVE_MISSING: 'Initiative details unavailable',
  PROGRESS_MISSING: 'Progress not reported',
  PROGRESS_INVALID: 'Progress value is invalid',
  BASELINE_MISSING: 'Baseline not set',
  BASELINE_INVALID: 'Baseline date is invalid',
  CURRENT_PLAN_MISSING: 'Current plan not set',
  CURRENT_PLAN_INVALID: 'Current plan date is invalid',
  FORECAST_MISSING: 'Forecast not available',
  FORECAST_INVALID: 'Forecast date is invalid',
  FORECAST_OBSERVATION_MISSING: 'Forecast observation date missing',
  FORECAST_OBSERVATION_INVALID: 'Forecast observation date is invalid',
  FORECAST_AFTER_AS_OF: 'Forecast is newer than the reporting date',
  VALUE_CLEARED: 'Not scheduled',
  ACTUAL_MISSING: 'Actual date not reported',
  ACTUAL_INVALID: 'Actual date is invalid',
  CONFIDENCE_MISSING: 'Confidence not reported',
  HEALTH_MISSING: 'Health not reported',
  UPDATED_AT_MISSING: 'Update time unavailable',
  UPDATED_AT_INVALID: 'Update time is invalid',
};

/**
 * DEC-510 (fala E2b-Exec): etykieta „brak danych" szła na ekran po angielsku
 * niezależnie od języka konta. Mapa zostaje SSOT-em wartości domyślnej (EN),
 * a widoczny tekst bierze się z klucza `execution.bank.unknown.<POWÓD>`.
 * `tlumaczPozaHookiem`, nie hook — to helper modułowy wołany także spoza
 * komponentu (`executionBankPreviewDeclaration`, `ExecutionHub`).
 */
const unknownLabel = (reason: string) =>
  UNKNOWN_LABELS[reason]
    ? tlumaczPozaHookiem(`execution.bank.unknown.${reason}`, UNKNOWN_LABELS[reason])
    : tlumaczPozaHookiem('execution.bank.unknown.GENERIC', 'Data unavailable');
const readableDate = (value: string) => {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (!Number.isFinite(parsed.getTime())) return tlumaczPozaHookiem('execution.bank.invalidDate', 'Invalid date');
  return new Intl.DateTimeFormat(localeListy(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
};
export const describeExecutionBankUnknown = unknownLabel;
export const formatExecutionBankDate = readableDate;
const caseAvailabilityLabel = (row: ExecutionBankRow) =>
  row.executionCaseId
    ? tlumaczPozaHookiem('execution.bank.caseLinked', 'Execution Case linked')
    : tlumaczPozaHookiem('execution.bank.caseMissing', 'No execution case yet');

const temporalClass = 'text-xs tabular-nums text-c-text-secondary';

/**
 * K5-R2 — LUKA DANYCH jako ciche „—" z podpowiedzią, nie trzy linie prozy.
 *
 * POWÓD (zrzut żywego stagingu 2026-09-13): każda z czterech komórek
 * czasowych w każdym wierszu niosła całe zdanie („Progress not reported",
 * „Baseline not set", „Forecast not available", „Confidence not reported"),
 * przez co tabela czytała się jak lista wymówek, a wiersz urósł do trzech
 * linijek. Kanon C7: brak wartości = myślnik. Powód braku nie znika — idzie
 * do `title` (podpowiedź) i do `aria-label`, więc audyt danych dalej ma go
 * pod ręką, tylko nie krzyczy z każdej komórki.
 *
 * WYJĄTEK `VALUE_CLEARED`: „Not scheduled" to STAN, nie luka — ktoś świadomie
 * wyczyścił prognozę i jest na to pokwitowanie (`ie_command_receipts`).
 * Zostaje widoczne jako tekst.
 */
const GapCell: React.FC<{ reason: string; className?: string }> = ({ reason, className }) => {
  const label = unknownLabel(reason);
  if (reason === 'VALUE_CLEARED') {
    return <span className={`text-c-text-muted ${className ?? ''}`}>{label}</span>;
  }
  return (
    <span className={`text-c-text-muted ${className ?? ''}`} title={label} aria-label={label}>
      —
    </span>
  );
};

/**
 * K5-R2 — etykiety statusów po ludzku.
 *
 * POWÓD: kolumny LIFECYCLE i EXECUTION PHASE renderowały surowy enum
 * (`UNKNOWN`, `ACTIVE`, `IN_EXECUTION`) wprost z bazy — kod techniczny na
 * ekranie. `UNKNOWN` dostaje osobne traktowanie: to nie jest status, tylko
 * brak podłączonego rekordu, więc idzie w ciche „—" z podpowiedzią.
 */
const LIFECYCLE_LABELS: Readonly<Record<string, string>> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  IN_EXECUTION: 'In execution',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
  CANCELLED: 'Cancelled',
  ON_HOLD: 'On hold',
};
const EXECUTION_STATE_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  CLOSING: 'Closing',
  CLOSED: 'Closed',
};
const humanizeCode = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (first) => first.toUpperCase());
export const executionBankLifecycleLabel = (value: string) =>
  LIFECYCLE_LABELS[value]
    ? tlumaczPozaHookiem(`execution.bank.lifecycle.${value}`, LIFECYCLE_LABELS[value])
    : humanizeCode(value);
export const executionBankExecutionStateLabel = (value: string) =>
  EXECUTION_STATE_LABELS[value]
    ? tlumaczPozaHookiem(`execution.bank.executionState.${value}`, EXECUTION_STATE_LABELS[value])
    : humanizeCode(value);
/**
 * K5-3: zdrowie realizacji ma WŁASNY słownik — `GREEN`/`AT_RISK`/`CRITICAL` to
 * nie są stany realizacji i przepuszczanie ich przez
 * `executionBankExecutionStateLabel` działało tylko przez przypadek (spadały na
 * `humanizeCode`). Jeden enum, jedna funkcja — inaczej dołożenie stanu
 * `CLOSING` do realizacji zmieniłoby etykietę zdrowia.
 */
const HEALTH_LABELS: Readonly<Record<string, string>> = {
  GREEN: 'On track',
  AMBER: 'At risk',
  AT_RISK: 'At risk',
  RED: 'Critical',
  CRITICAL: 'Critical',
};
export const executionBankHealthLabel = (value: string) =>
  HEALTH_LABELS[value]
    ? tlumaczPozaHookiem(`execution.bank.health.${value}`, HEALTH_LABELS[value])
    : humanizeCode(value);

/**
 * Dwa napisy tego ekranu, które użytkownik REALNIE czyta jako ZDANIE (reszta
 * banku to nazwy kolumn i etykiety enumów). Idą przez klucze i18n — żeby
 * pomiar języka nie rósł i żeby konto PL dostało polską podpowiedź —
 * z angielskim `defaultValue` (DEC-461: staging jest po angielsku).
 *
 * `t` bierzemy z `useTranslation()` w komponencie, NIE z importu `@/i18n`:
 * ten drugi ciągnie bootstrap i18n, który w trzech istniejących zestawach
 * testów banku wywracał cały plik („No 'initReactI18next' export…"), bo
 * mockują one `react-i18next` bez tego eksportu.
 */
type BankT = (key: string, defaultValue: string) => string;
const LIFECYCLE_UNKNOWN_HINT_KEY = 'execution.bank.lifecycleUnknownHint';
const LIFECYCLE_UNKNOWN_HINT_EN = 'Linked initiative record is not available';

const OwnerLabel = ({
  row,
  resolveOwnerName,
}: {
  row: ExecutionBankRow;
  resolveOwnerName?: MemberNameResolver;
}) => <span>{executionBankOwnerLabel(row, resolveOwnerName)}</span>;

/** Nazwa właściciela do pokazania — NIGDY identyfikator (K5-R1). */
export const executionBankOwnerLabel = (
  row: ExecutionBankRow,
  resolveOwnerName?: MemberNameResolver
): string => {
  if (row.ownerName?.trim()) return row.ownerName.trim();
  if (!row.ownerId) return '—';
  return memberNameOrUnknown(resolveOwnerName, row.ownerId, false);
};

const BankTable = ({
  rows,
  selected,
  onSelect,
  onOpen,
  resolveOwnerName,
  riskSignals,
  showHandoffTrace,
}: Pick<
  ExecutionBankViewsProps,
  | 'rows'
  | 'selected'
  | 'onSelect'
  | 'onOpen'
  | 'resolveOwnerName'
  | 'riskSignals'
  | 'showHandoffTrace'
>) => {
  const { t: translate } = useTranslation();
  const t = translate as unknown as BankT;
  /*
    ── SZEROKOŚCI I TYPY KOLUMN: ZMIERZONE, NIE ZGADNIĘTE ────────────────────
    (odbiór 13.09, ciemny motyw, słowa właściciela: „bez sensu jest to, że
     wszystkie kolumny są tej samej szerokości, bo przez to ta pierwsza jest
     beznadziejna")

    CO BYŁO. Żadna z piętnastu kolumn nie deklarowała `dataType` ani `align`,
    a kolumna nazwy miała `id: 'initiativeCase'`. Jądro (`FilterableTable`)
    wyprowadza z tych dwóch pól CAŁĄ podłogę szerokości: bez `dataType` każda
    kolumna dostaje podłogę typu `text` = 140 px, a kolumna nierozpoznana jako
    główna zjeżdża do swojej podłogi razem z resztą, gdy tabela się nie mieści.
    Zmierzone na zrzucie odbiorowym (1440): tytuł 125 px — NAJWĘŻSZY na
    ekranie — przy kolumnach z samymi myślnikami 140–191 px; nazwy inicjatyw
    łamały się na trzy i cztery linie, wiersz rósł do ~110 px.

    CO JEST. Kolumna nazwy DEKLARUJE swoją rolę (`primary: true` — mechanizm
    dorobiony w jądrze, bo naprawa przez zmianę `id` na `'title'` odrosłaby
    w następnym module), więc trzyma 300 px i nie schodzi do podłogi. Każda
    pozostała kolumna deklaruje `dataType`, czyli SWOJĄ podłogę:
      · `number` (90 px) — chipy i liczby o krótkiej treści; to deklaracja
        SZEROKOŚCI, nie twierdzenie, że treść jest liczbą (wzór: RAID
        w `ExecutionControlSurface`, ta sama nota),
      · `date` (110 px) — daty,
      · `owner` (150 px) — „Katarzyna Wójcik" musi się zmieścić w jednej linii.
    Liczby są `align: 'right'` (kanon §3.3: metryki do prawej).

    PODŁOGA NAGŁÓWKA bywa wyższa niż podłoga typu (jądro mierzy napis) —
    dlatego „Updated / actions" wraca do uczciwego „Updated": ta kolumna
    renderuje WYŁĄCZNIE datę, akcje mieszkają w strukturalnej kolumnie kebaba,
    a sam napis kosztował 160 px podłogi zamiast 110 px.

    Suma podłóg (czyli to, co kolumny wtórne realnie dostają przy
    przepełnieniu — zmierzone w przeglądarce 13.09, 1280/1440/1920):
    300+130+147+150+146+188+136+141+110+130+97+157+140+140+110 = 2222 px
    + 80 px kolumny akcji. Tabela nadal jest SZERSZA niż obszar przy
    1440 (≈1270 px) i przewija się poziomo — z piętnastu kolumn nie da się
    zrobić inaczej bez CHOWANIA części z nich, a które kolumny są zbędne, to
    decyzja właściciela (pstryczek kolumn), nie tej poprawki. Zysk jest tam,
    gdzie była skarga: tytuł 125 → 300 px, czyli ponad dwa razy więcej niż
    kolumna liczbowa (90–95 px).
  */
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'initiativeCase',
        label: rows.every((row) => row.id === row.initiativeId)
          ? t('execution.bank.column.initiative', 'Initiative')
          : t('execution.bank.column.initiativeCase', 'Initiative / Case'),
        primary: true,
        dataType: 'text',
        width: '300px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          const initiativeIdentity = row.id === row.initiativeId;
          return (
            <div
              data-testid={`execution-bank-table-item-${row.id}`}
              data-initiative-id={row.initiativeId}
              data-execution-case-id={
                initiativeIdentity ? undefined : (row.executionCaseId ?? undefined)
              }
              className="min-w-0"
            >
              {/*
                Dwie linie MAKSIMUM + dymek dopiero przy przepełnieniu
                (`OverflowTooltip` z jądra — komórka z własnym `render` nie
                przechodzi przez gałąź, która zakłada go sama). Bez klamry
                nazwa rozpychała wiersz ponad kanoniczne 56 px.
              */}
              <OverflowTooltip
                content={row.name}
                className="block text-sm font-semibold text-c-text line-clamp-2"
              />
              {/* K5-R2: dla wiersza BEZ realizacji ten sam komunikat stoi już
                  w kolumnie „Execution phase" — nie powtarzamy go dwa razy
                  w jednym wierszu. */}
              {initiativeIdentity ? (
                <div className="text-[11px] text-c-text-muted">
                  {row.projectId ?? 'No project assigned'}
                </div>
              ) : row.executionCaseId ? (
                <div className="text-[11px] text-c-text-muted">{caseAvailabilityLabel(row)}</div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'lifecycleStatus',
        // `status` (130 px), nie `number` (90 px): przy 97 px chip „In
        // execution" renderował się jako „In ex…" (zrzut 13.09, 1440 px).
        // Przy przepełnieniu kolumna wtórna siada DOKŁADNIE na swojej
        // podłodze, więc to podłoga — nie `width` — jest tu jedynym lewarem.
        label: t('execution.bank.column.lifecycle', 'Lifecycle'),
        dataType: 'status',
        width: '130px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          if (!row.lifecycleStatus || row.lifecycleStatus === 'UNKNOWN') {
            return (
              <span
                className="text-c-text-muted"
                title={t(LIFECYCLE_UNKNOWN_HINT_KEY, LIFECYCLE_UNKNOWN_HINT_EN)}
                aria-label={t(LIFECYCLE_UNKNOWN_HINT_KEY, LIFECYCLE_UNKNOWN_HINT_EN)}
              >
                —
              </span>
            );
          }
          return (
            <EntityStatusChip
              status={row.lifecycleStatus}
              label={executionBankLifecycleLabel(row.lifecycleStatus)}
              tone={statusChipTone(row.lifecycleStatus)}
            />
          );
        },
      },
      ...(showHandoffTrace
        ? [
            {
              /*
               * H2 (DEC-453 pkt b) — „czy widać". Ślad przekazania inicjatywy
               * do Realizacji był w danych od zawsze (`acceptedAt` /
               * `handoffPackageId` z `ie_aggregate_state`), ale nie było go na
               * ekranie: wiersz w toku bez przekazania wyglądał identycznie
               * jak wiersz przekazany.
               *
               * Za flagą OFF (reguła #9) — przy OFF kolumny NIE MA, więc
               * pstryczek kolumn i zapamiętany układ są te same co na linii.
               */
              id: 'handoff',
              label: t('execution.bank.column.handoff', 'Handoff'),
              dataType: 'status' as const,
              width: '150px',
              render: (source: Record<string, unknown>) => (
                <ExecutionHandoffBadge
                  handoff={(source as unknown as ExecutionBankRow).handoff}
                  formatDate={readableDate}
                  t={t}
                />
              ),
            },
          ]
        : []),
      /*
       * B-E0 — kolumna „Risk" istnieje WYŁĄCZNIE za flagą. Przy OFF nie ma jej
       * w tablicy kolumn, więc pstryczek kolumn, sumy podłóg i zapamiętany
       * układ (`persistKey`) zostają dokładnie takie jak na linii.
       */
      ...(riskSignals
        ? [
            {
              id: 'risk',
              label: t('execution.bank.column.risk', 'Risk'),
              dataType: 'status' as const,
              // Jedna pastylka agregatu — ta sama klasa szerokości co chip
              // „In execution" w kolumnie Lifecycle (podłoga `status` 130 px).
              // Rozbiór na trzy osie jest w podglądzie; dlaczego — patrz nota
              // przy `ExecutionRiskCell`.
              width: '150px',
              render: (source: Record<string, unknown>) => (
                <ExecutionRiskCell
                  signal={
                    riskSignals.get((source as unknown as ExecutionBankRow).initiativeId) ?? null
                  }
                  t={t}
                />
              ),
            },
          ]
        : []),
      {
        id: 'executionState',
        label: t('execution.bank.column.executionPhase', 'Execution phase'),
        dataType: 'number',
        width: '150px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          if (!row.executionCaseId) {
            return (
              <span
                className="text-c-text-muted"
                title={t(
                  'execution.bank.noExecutionCaseHint',
                  'In execution, but not handed over yet — no execution case to report against.'
                )}
              >
                {t('execution.bank.noExecutionCase', 'No execution case yet')}
              </span>
            );
          }
          return (
            <div>
              <EntityStatusChip
                status={row.executionState}
                label={executionBankExecutionStateLabel(row.executionState)}
                tone={statusChipTone(row.executionState)}
              />
              {row.executionPhase ? (
                <div className="mt-1 text-[11px] text-c-text-muted">{row.executionPhase}</div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'ownerName',
        label: t('execution.bank.column.owner', 'Owner'),
        dataType: 'owner',
        width: '160px',
        render: (source) => (
          <OwnerLabel
            row={source as unknown as ExecutionBankRow}
            resolveOwnerName={resolveOwnerName}
          />
        ),
      },
      {
        id: 'deliveryProfile',
        label: t('execution.bank.column.deliveryProfile', 'Delivery profile'),
        defaultVisible: false,
        dataType: 'number',
        // 155 px = zmierzona podłoga NAGŁÓWKA („DELIVERY PROFILE", 16 znaków);
        // niżej i tak nie zejdzie, więc deklarujemy to, co realnie dostanie.
        width: '155px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return <span>{row.deliveryProfile ?? '—'}</span>;
        },
      },
      {
        id: 'progress',
        label: t('execution.bank.column.progress', 'Progress'),
        dataType: 'number',
        align: 'right',
        width: '190px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return (
            <div>
              <div
                className="tabular-nums"
                data-testid={`execution-bank-progress-${row.executionCaseId}`}
              >
                {row.progress.status === 'KNOWN' ? (
                  `${row.progress.value}%`
                ) : (
                  <GapCell reason={row.progress.reason} />
                )}
              </div>
              {row.confidence.status === 'KNOWN' ? (
                <div className="text-[11px] text-c-text-muted">{String(row.confidence.value)}</div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'baselineFinish',
        label: t('execution.bank.column.baselineFinish', 'Baseline finish'),
        dataType: 'date',
        align: 'right',
        width: '145px',
        render: (source) => {
          const evidence = (source as unknown as ExecutionBankRow).baselineFinish;
          return evidence.status === 'KNOWN' ? (
            <span className={temporalClass}>{readableDate(evidence.value)}</span>
          ) : (
            <GapCell reason={evidence.reason} className={temporalClass} />
          );
        },
      },
      {
        id: 'forecastFinish',
        label: t('execution.bank.column.forecastFinish', 'Forecast finish'),
        dataType: 'date',
        align: 'right',
        width: '145px',
        render: (source) => {
          const evidence = (source as unknown as ExecutionBankRow).forecastFinish;
          return evidence.status === 'KNOWN' ? (
            <span className={temporalClass}>{readableDate(evidence.value)}</span>
          ) : (
            <GapCell reason={evidence.reason} className={temporalClass} />
          );
        },
      },
      {
        id: 'varianceDays',
        label: t('execution.bank.column.variance', 'Variance'),
        // `date` (110 px): treść to nie goła liczba, tylko „12 days · forecast"
        // — przy podłodze `number` (90 px) łamała się na trzy linie.
        dataType: 'date',
        align: 'right',
        width: '130px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return (
            <span
              data-testid={`execution-bank-variance-${row.id}`}
              className={`${temporalClass} tabular-nums`}
            >
              {row.varianceDays.status === 'KNOWN' ? (
                `${row.varianceDays.value} ${Math.abs(row.varianceDays.value) === 1 ? 'day' : 'days'} · ${row.varianceDays.reference?.toLowerCase()}`
              ) : (
                <GapCell reason={row.varianceDays.reason} />
              )}
            </span>
          );
        },
      },
      {
        id: 'health',
        label: t('execution.bank.column.health', 'Health'),
        // Chip „At risk"/„On track" — ta sama podłoga co Lifecycle.
        dataType: 'status',
        width: '130px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return row.health.status === 'KNOWN' ? (
            <EntityStatusChip
              status={row.health.value}
              label={humanizeCode(row.health.value)}
              tone={statusChipTone(row.health.value)}
            />
          ) : (
            <GapCell reason={row.health.reason} />
          );
        },
      },
      {
        id: 'blockerCount',
        label: t('execution.bank.column.blockers', 'Blockers'),
        dataType: 'number',
        align: 'right',
        width: '95px',
        render: (source) => {
          const value = (source as unknown as ExecutionBankRow).blockerCount;
          return <span className="block text-right tabular-nums">{value ?? '—'}</span>;
        },
      },
      {
        id: 'pendingDecisionCount',
        label: t('execution.bank.column.pendingDecisions', 'Pending decisions'),
        defaultVisible: false,
        dataType: 'number',
        align: 'right',
        width: '160px',
        render: (source) => {
          const value = (source as unknown as ExecutionBankRow).pendingDecisionCount;
          return <span className="block text-right tabular-nums">{value ?? '—'}</span>;
        },
      },
      {
        id: 'resourceConstraint',
        label: t('execution.bank.column.constraint', 'Constraint'),
        defaultVisible: false,
        dataType: 'text',
        width: '160px',
        render: (source) => (
          <span>{(source as unknown as ExecutionBankRow).resourceConstraint ?? '—'}</span>
        ),
      },
      {
        id: 'nextAction',
        label: t('execution.bank.column.nextAction', 'Next action'),
        dataType: 'text',
        width: '160px',
        render: (source) => (
          <span>{(source as unknown as ExecutionBankRow).nextAction ?? '—'}</span>
        ),
      },
      {
        id: 'updatedAt',
        // Było „Updated / actions" — kolumna renderuje WYŁĄCZNIE datę, a akcje
        // mieszkają w strukturalnej kolumnie kebaba. Napis kosztował 160 px
        // podłogi (jądro mierzy nagłówek) zamiast 110 px podłogi typu `date`.
        label: t('execution.bank.column.updated', 'Updated'),
        dataType: 'date',
        align: 'right',
        width: '160px',
        render: (source) => {
          const evidence = (source as unknown as ExecutionBankRow).updatedAt;
          return evidence.status === 'KNOWN' ? (
            <span className={temporalClass}>{readableDate(evidence.value)}</span>
          ) : (
            <GapCell reason={evidence.reason} className={temporalClass} />
          );
        },
      },
    ],
    [resolveOwnerName, riskSignals, rows, showHandoffTrace, t]
  );
  const rowMenu = (source: Record<string, unknown>): StandardRowMenu => {
    const row = source as unknown as ExecutionBankRow;
    return {
      /* K5-R5: „Open" stało bez ikony obok „Open preview" z ikoną — dwie
         pozycje jednego bloku, dwa różne kształty. Ikona `ExternalLink` to ta
         sama, którą rejestr Inicjatyw daje swojemu „Open"
         (`initiativeRegisterColumns.shared.ts`). */
      primary: [
        {
          id: 'open',
          label: t('execution.bank.rowMenu.open', 'Open'),
          icon: ExternalLink,
          onClick: () => onOpen(row),
        },
      ],
      universalHandlers: { preview: () => onSelect(row) },
    };
  };
  return (
    <StandardTable
      columns={columns}
      data={rows as Array<ExecutionBankRow & Record<string, unknown>>}
      selectedRowId={
        selected
          ? (rows.find(
              (row) =>
                row.initiativeId === selected.initiativeId &&
                row.executionCaseId === selected.executionCaseId
            )?.id ?? null)
          : null
      }
      onRowClick={(row) => onSelect(row as unknown as ExecutionBankRow)}
      onRowDoubleClick={(row) => onOpen(row as unknown as ExecutionBankRow)}
      rowDescription={(row) => (row as unknown as ExecutionBankRow).description}
      rowMenu={rowMenu}
      persistKey="execution-bank-e1b"
      density="compact"
      empty={{
        title: 'No initiatives',
        description: 'Initiatives in this scope will appear here.',
      }}
    />
  );
};

const BankKanban = ({
  rows,
  onSelect,
  resolveOwnerName,
}: Pick<ExecutionBankViewsProps, 'rows' | 'onSelect' | 'resolveOwnerName'>) => {
  const stateIds = ['ACTIVE', 'PAUSED', 'CLOSING', 'CLOSED', 'UNKNOWN'];
  const extra = rows.map((row) => row.executionState).filter((state) => !stateIds.includes(state));
  const columns: StandardKanbanColumn[] = [...stateIds, ...new Set(extra)].map((id) => ({
    id,
    /* K5-R2: nagłówek kolumny po ludzku; `UNKNOWN` to nie stan realizacji,
       tylko brak podłączonej realizacji — nazywamy to wprost. */
    label: id === 'UNKNOWN' ? 'No execution case' : executionBankExecutionStateLabel(id),
    tone:
      id === 'CLOSED'
        ? 'success'
        : id === 'PAUSED' || id === 'CLOSING'
          ? 'warning'
          : id === 'UNKNOWN'
            ? 'neutral'
            : 'info',
  }));
  const cards = (columnId: string): StandardKanbanCard[] =>
    rows
      .filter((row) => row.executionState === columnId)
      .map((row) => {
        /* K5-R1: awatar „D2" brał dwa pierwsze znaki UUID-a. Skrót liczymy
           dopiero z ROZWIĄZANEJ nazwy; gdy nazwy nie ma, karta nie dostaje
           awatara wcale (lepiej pusto niż kod). */
        const ownerLabel = executionBankOwnerLabel(row, resolveOwnerName);
        const hasOwnerName = ownerLabel !== '—' && ownerLabel !== 'Unknown user';
        return {
          id: row.id,
          columnId,
          title: row.name,
          description: row.description ?? undefined,
          chips: [
            ...(row.lifecycleStatus && row.lifecycleStatus !== 'UNKNOWN'
              ? [
                  {
                    id: 'lifecycle',
                    label: executionBankLifecycleLabel(row.lifecycleStatus),
                    tone: 'neutral' as const,
                  },
                ]
              : []),
            ...(row.health.status === 'KNOWN'
              ? [
                  {
                    id: 'health',
                    label: humanizeCode(row.health.value),
                    tone: (row.health.value === 'CRITICAL' ? 'danger' : 'neutral') as
                      | 'danger'
                      | 'neutral',
                  },
                ]
              : []),
          ],
          projectLabel:
            row.id === row.initiativeId
              ? (row.projectId ?? 'No project assigned')
              : caseAvailabilityLabel(row),
          dueLabel:
            row.displayFinish.status === 'KNOWN'
              ? readableDate(row.displayFinish.value)
              : undefined,
          ownerName: hasOwnerName ? ownerLabel : undefined,
          ownerInitials: hasOwnerName
            ? ownerLabel
                .split(/\s+/)
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            : undefined,
          urgency:
            row.health.status === 'KNOWN' && row.health.value === 'CRITICAL'
              ? 'critical'
              : row.health.status === 'KNOWN' && row.health.value === 'AT_RISK'
                ? 'pending'
                : 'none',
          footer: (
            <span
              data-testid={`execution-bank-kanban-item-${row.id}`}
              data-initiative-id={row.initiativeId}
              data-execution-case-id={
                row.id === row.initiativeId ? undefined : (row.executionCaseId ?? undefined)
              }
              className="text-[10px] text-c-text-muted"
            >
              {row.id === row.initiativeId
                ? (row.projectId ?? 'No project assigned')
                : row.executionCaseId
                  ? 'Native case identity retained'
                  : 'Initiative awaiting a case'}
            </span>
          ),
        };
      });
  return (
    <StandardKanban
      columns={columns}
      cards={cards}
      onCardClick={(card) => {
        const row = rows.find((item) => item.id === card.id);
        if (row) onSelect(row);
      }}
    />
  );
};

const rowBucket = (row: ExecutionBankRow, buckets: readonly ExecutionCalendarBucket[]) => {
  if (row.displayFinish.status !== 'KNOWN') return null;
  const finish = row.displayFinish.value;
  return buckets.find((bucket) => finish >= bucket.start && finish < bucket.endExclusive) ?? null;
};

const HorizonControls = ({
  calendarWindow,
  onHorizonChange,
}: Pick<ExecutionBankViewsProps, 'calendarWindow' | 'onHorizonChange'>) => (
  <div
    className="flex items-center gap-1 px-4 py-2"
    aria-label={tlumaczPozaHookiem('execution.bank.horizonAria', 'Execution Bank horizon')}
  >
    {([1, 3, 6, 12] as const).map((months) => (
      <button
        key={months}
        type="button"
        aria-pressed={calendarWindow.horizonMonths === months}
        onClick={() => onHorizonChange(months)}
        className="h-7 rounded-full border border-c-border-subtle px-2.5 text-[11px] focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        {months}m
      </button>
    ))}
    <span className="ml-2 text-[11px] text-c-text-muted">
      {tlumaczPozaHookiem('execution.bank.reportingDate', 'Reporting date')}{' '}
      {readableDate(calendarWindow.asOf)} ·{' '}
      {calendarWindow.resolution === 'WEEK'
        ? tlumaczPozaHookiem('execution.bank.weeklyScale', 'weekly scale')
        : tlumaczPozaHookiem('execution.bank.monthlyScale', 'monthly scale')}
    </span>
  </div>
);

const BankCalendar = ({
  rows,
  calendarWindow,
  onSelect,
  onHorizonChange,
  onDrilldownMonth,
}: Pick<
  ExecutionBankViewsProps,
  'rows' | 'calendarWindow' | 'onSelect' | 'onHorizonChange' | 'onDrilldownMonth'
>) => {
  const { t } = useTranslation();
  const buckets = calendarWindow.drilldown?.buckets ?? calendarWindow.buckets;
  const unscheduled = rows.filter((row) => !rowBucket(row, buckets));
  return (
    <div className="h-full overflow-auto" data-testid="execution-bank-calendar">
      <HorizonControls calendarWindow={calendarWindow} onHorizonChange={onHorizonChange} />
      <div className="flex min-w-[900px] gap-2 px-4 pb-4">
        {buckets.map((bucket) => (
          <section
            key={bucket.id}
            className="min-h-48 min-w-[150px] flex-1 border-l border-c-border-subtle pl-2"
          >
            <button
              type="button"
              disabled={calendarWindow.resolution !== 'MONTH'}
              onClick={() => onDrilldownMonth(bucket.start.slice(0, 7))}
              className="text-[11px] font-semibold uppercase text-c-text-secondary"
            >
              {bucket.label}
            </button>
            {rows
              .filter((row) => rowBucket(row, [bucket]))
              .map((row) => (
                <button
                  type="button"
                  key={row.id}
                  data-testid={`execution-bank-calendar-item-${row.id}`}
                  data-initiative-id={row.initiativeId}
                  data-execution-case-id={
                    row.id === row.initiativeId ? undefined : (row.executionCaseId ?? undefined)
                  }
                  onClick={() => onSelect(row)}
                  className="mt-2 block w-full rounded-lg border border-c-border-subtle bg-c-surface p-2 text-left focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <span className="block text-sm font-semibold">{row.name}</span>
                  <span className="text-[10px] text-c-text-muted">
                    {row.displayFinish.status === 'KNOWN'
                      ? `${readableDate(row.displayFinish.value)} · ${row.displayFinish.reference?.toLowerCase()}`
                      : ''}
                  </span>
                </button>
              ))}
          </section>
        ))}
      </div>
      <section
        data-testid="execution-bank-unscheduled"
        className="mx-4 mb-4 rounded-lg border border-c-border-subtle p-3"
      >
        <h3 className="text-xs font-semibold uppercase text-c-text-secondary">
          {t('execution.rollout.plan.unscheduled')}
        </h3>
        {unscheduled.length ? (
          unscheduled.map((row) => (
            <button
              type="button"
              key={row.id}
              data-testid={`execution-bank-calendar-item-${row.id}`}
              data-initiative-id={row.initiativeId}
              data-execution-case-id={
                row.id === row.initiativeId ? undefined : (row.executionCaseId ?? undefined)
              }
              onClick={() => onSelect(row)}
              className="mr-2 mt-2 rounded-full border border-c-border-subtle px-3 py-1 text-xs"
            >
              {row.name} ·{' '}
              {row.displayFinish.status === 'UNKNOWN'
                ? unknownLabel(row.displayFinish.reason)
                : 'Outside visible range'}
            </button>
          ))
        ) : (
          <span className="ml-2 text-xs text-c-text-muted">—</span>
        )}
      </section>
    </div>
  );
};

const GANTT_WIDTH = 1000;
const ganttDay = (value: string) => Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`);
const ganttPosition = (value: string, window: ExecutionCalendarWindow) => {
  const start = ganttDay(window.start);
  const end = ganttDay(window.endExclusive);
  const point = ganttDay(value);
  if (![start, end, point].every(Number.isFinite) || end <= start) return null;
  return ((point - start) / (end - start)) * GANTT_WIDTH;
};

type GanttTrackKind = 'baseline' | 'current-plan' | 'forecast' | 'actual';

const GANTT_TRACKS: Array<{
  kind: GanttTrackKind;
  labelKey: string;
  label: string;
  tone: string;
  start: keyof Pick<
    ExecutionBankRow,
    'baselineStart' | 'currentPlanStart' | 'forecastStart' | 'actualStart'
  >;
  finish: keyof Pick<
    ExecutionBankRow,
    'baselineFinish' | 'currentPlanFinish' | 'forecastFinish' | 'actualFinish'
  >;
}> = [
  {
    kind: 'baseline',
    labelKey: 'execution.bank.gantt.baseline',
    label: 'Baseline',
    tone: 'fill-slate-400 stroke-slate-500',
    start: 'baselineStart',
    finish: 'baselineFinish',
  },
  {
    kind: 'current-plan',
    labelKey: 'execution.bank.gantt.currentPlan',
    label: 'Current plan',
    tone: 'fill-blue-400 stroke-blue-500',
    start: 'currentPlanStart',
    finish: 'currentPlanFinish',
  },
  {
    kind: 'forecast',
    labelKey: 'execution.bank.gantt.forecast',
    label: 'Forecast',
    tone: 'fill-amber-400 stroke-amber-500',
    start: 'forecastStart',
    finish: 'forecastFinish',
  },
  {
    kind: 'actual',
    labelKey: 'execution.bank.gantt.actual',
    label: 'Actual',
    tone: 'fill-emerald-500 stroke-emerald-600',
    start: 'actualStart',
    finish: 'actualFinish',
  },
];

const GanttTrack = ({
  row,
  calendarWindow,
  kind,
  labelKey,
  label,
  tone,
  start,
  finish,
}: {
  row: ExecutionBankRow;
  calendarWindow: ExecutionCalendarWindow;
  kind: GanttTrackKind;
  labelKey: string;
  label: string;
  tone: string;
  start: (typeof GANTT_TRACKS)[number]['start'];
  finish: (typeof GANTT_TRACKS)[number]['finish'];
}) => {
  const etykieta = tlumaczPozaHookiem(labelKey, label);
  const startEvidence = row[start];
  const finishEvidence = row[finish];
  const startValue = startEvidence.status === 'KNOWN' ? startEvidence.value : null;
  const finishValue = finishEvidence.status === 'KNOWN' ? finishEvidence.value : null;
  const startPosition = startValue ? ganttPosition(startValue, calendarWindow) : null;
  const finishPosition = finishValue ? ganttPosition(finishValue, calendarWindow) : null;
  const invalidRange = Boolean(
    startValue && finishValue && ganttDay(startValue) > ganttDay(finishValue)
  );
  const overlapsWindow = Boolean(
    startValue &&
    finishValue &&
    ganttDay(finishValue) >= ganttDay(calendarWindow.start) &&
    ganttDay(startValue) < ganttDay(calendarWindow.endExclusive)
  );
  const markerPosition = startPosition ?? finishPosition;
  const markerX =
    markerPosition !== null && markerPosition >= 0 && markerPosition < GANTT_WIDTH
      ? markerPosition
      : null;
  const intervalStartX = Math.max(0, startPosition ?? 0);
  const intervalFinishX = Math.min(GANTT_WIDTH, finishPosition ?? GANTT_WIDTH);
  const geometry = invalidRange
    ? 'invalid'
    : startValue && finishValue && overlapsWindow
      ? 'interval'
      : markerX !== null
        ? 'marker'
        : startValue || finishValue
          ? 'outside'
          : 'unknown';
  const unknownText =
    [
      ...new Set(
        [startEvidence, finishEvidence].flatMap((evidence) =>
          evidence.status === 'UNKNOWN' ? [unknownLabel(evidence.reason)] : []
        )
      ),
    ].join('; ') || null;

  return (
    <div
      className="grid grid-cols-[110px_minmax(620px,1fr)] items-center gap-2"
      data-testid={`execution-bank-gantt-track-${kind}-${row.id}`}
      data-geometry={geometry}
    >
      <span
        className="truncate text-[10px] font-medium text-c-text-secondary"
        title={unknownText ?? ''}
      >
        {etykieta}
      </span>
      <div className="relative min-w-0">
        <svg
          viewBox={`0 0 ${GANTT_WIDTH} 20`}
          className="h-5 w-full overflow-visible"
          aria-label={tlumaczPozaHookiem(
            'execution.bank.gantt.trackAria',
            '{{track}} timeline for {{name}}',
            { track: etykieta, name: row.name }
          )}
        >
          <line x1="0" y1="10" x2={GANTT_WIDTH} y2="10" className="stroke-c-border-subtle" />
          {geometry === 'interval' ? (
            <rect
              data-testid={`execution-bank-gantt-bar-${kind}-${row.id}`}
              data-start={startValue ?? undefined}
              data-end={finishValue ?? undefined}
              x={intervalStartX}
              y="5"
              width={Math.max(3, intervalFinishX - intervalStartX)}
              height="10"
              rx="5"
              className={tone}
            />
          ) : null}
          {geometry === 'marker' && markerX !== null ? (
            <circle
              data-testid={`execution-bank-gantt-marker-${kind}-${row.id}`}
              data-date={startValue ?? finishValue ?? undefined}
              cx={markerX}
              cy="10"
              r="6"
              className={tone}
            />
          ) : null}
        </svg>
        {geometry === 'unknown' || geometry === 'outside' || geometry === 'invalid' ? (
          <span className="absolute inset-y-0 left-1 flex items-center bg-c-surface px-1 text-[11px] text-c-text-muted">
            {geometry === 'outside'
              ? 'Outside visible range'
              : geometry === 'invalid'
                ? 'Invalid date range'
                : unknownText}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const BankGantt = ({
  rows,
  calendarWindow,
  onSelect,
  onHorizonChange,
}: Pick<ExecutionBankViewsProps, 'rows' | 'calendarWindow' | 'onSelect' | 'onHorizonChange'>) => (
  <div className="h-full overflow-auto" data-testid="execution-bank-gantt">
    <HorizonControls calendarWindow={calendarWindow} onHorizonChange={onHorizonChange} />
    <div className="min-w-[980px] px-4 pb-4">
      <div className="grid grid-cols-[220px_minmax(730px,1fr)] gap-3 items-end border-b border-c-border-subtle pb-2">
        <span className="text-[11px] font-semibold uppercase text-c-text-muted">
          {tlumaczPozaHookiem('execution.bank.initiativeSchedule', 'Initiative schedule')}
        </span>
        <div
          className="grid grid-cols-[110px_minmax(620px,1fr)] items-center gap-2"
          data-testid="execution-bank-gantt-axis-layout"
        >
          <span className="text-[10px] font-medium text-c-text-secondary">
            {tlumaczPozaHookiem('execution.bank.track', 'Track')}
          </span>
          <div className="relative min-w-0">
            <svg
              viewBox={`0 0 ${GANTT_WIDTH} 36`}
              className="h-9 w-full overflow-visible"
              data-testid="execution-bank-gantt-axis"
              data-window-start={calendarWindow.start}
              data-window-end={calendarWindow.endExclusive}
              aria-label={tlumaczPozaHookiem('execution.bank.timelineAria', 'Timeline from {{from}} to {{to}}', {
                from: readableDate(calendarWindow.start),
                to: readableDate(calendarWindow.endExclusive),
              })}
            >
              {calendarWindow.buckets.map((bucket) => {
                const x = ganttPosition(bucket.start, calendarWindow) ?? 0;
                return (
                  <g key={bucket.id} data-testid={`execution-bank-gantt-tick-${bucket.id}`}>
                    <line x1={x} y1="18" x2={x} y2="36" className="stroke-c-border-subtle" />
                  </g>
                );
              })}
            </svg>
            {calendarWindow.buckets.map((bucket) => {
              const x = ganttPosition(bucket.start, calendarWindow) ?? 0;
              const label = new Intl.DateTimeFormat(localeListy(), {
                month: 'short',
                ...(calendarWindow.resolution === 'WEEK' ? { day: 'numeric' as const } : {}),
                timeZone: 'UTC',
              }).format(new Date(`${bucket.start}T00:00:00.000Z`));
              return (
                <span
                  key={bucket.id}
                  className="absolute top-0 ml-1 whitespace-nowrap text-[11px] leading-4 text-c-text-secondary"
                  style={{ left: `${(x / GANTT_WIDTH) * 100}%` }}
                  title={readableDate(bucket.start)}
                  aria-hidden="true"
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      {rows.map((row) => (
        <button
          type="button"
          key={row.id}
          data-testid={`execution-bank-gantt-item-${row.id}`}
          data-initiative-id={row.initiativeId}
          data-execution-case-id={
            row.id === row.initiativeId ? undefined : (row.executionCaseId ?? undefined)
          }
          onClick={() => onSelect(row)}
          className="grid w-full grid-cols-[220px_minmax(730px,1fr)] gap-3 border-b border-c-border-subtle py-3 text-left focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <span>
            <strong className="block text-sm">{row.name}</strong>
            <small className="text-c-text-muted">
              {row.id === row.initiativeId
                ? (row.projectId ?? 'No project assigned')
                : caseAvailabilityLabel(row)}
            </small>
            <small
              className="mt-1 block text-c-text-secondary"
              data-testid={`execution-bank-variance-${row.id}`}
            >
              {row.varianceDays.status === 'KNOWN'
                ? `${row.varianceDays.value} ${Math.abs(row.varianceDays.value) === 1 ? 'day' : 'days'} · ${row.varianceDays.reference?.toLowerCase()}`
                : unknownLabel(row.varianceDays.reason)}
            </small>
          </span>
          <span className="space-y-1">
            {GANTT_TRACKS.map((track) => (
              <GanttTrack key={track.kind} row={row} calendarWindow={calendarWindow} {...track} />
            ))}
          </span>
        </button>
      ))}
    </div>
  </div>
);

export const ExecutionBankViews: React.FC<ExecutionBankViewsProps> = (props) => (
  <div
    className="h-full"
    data-testid={`execution-bank-view-${props.view}`}
    data-as-of={props.calendarWindow.asOf}
  >
    {props.view === 'table' ? <BankTable {...props} /> : null}
    {props.view === 'kanban' ? <BankKanban {...props} /> : null}
    {props.view === 'calendar' ? <BankCalendar {...props} /> : null}
    {props.view === 'gantt' ? <BankGantt {...props} /> : null}
  </div>
);

export default ExecutionBankViews;

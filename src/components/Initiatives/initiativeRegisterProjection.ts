import type {
  LegacyInitiativeApiRow,
  RegisteredInitiativeReadModel,
} from '@/services/initiatives-execution/runtimeApi';
import { InitiativeStatus, type PortfolioInitiative } from '@/types';
import { mapInitiativeStatus } from '@/contracts/initiatives-execution/statusMapping';

export type InitiativeLifecyclePreset =
  | 'PREPARATION'
  | 'DECISION'
  | 'APPROVED_BACKLOG'
  | 'SCHEDULED'
  | 'IN_EXECUTION'
  | 'RESULTS'
  | 'HISTORICAL';

export const INITIATIVE_LIFECYCLE_PRESETS: Array<{
  id: InitiativeLifecyclePreset;
  label: string;
  states: string[];
}> = [
  {
    id: 'PREPARATION',
    label: 'W przygotowaniu',
    states: ['REGISTERED_DRAFT', 'DEFINED', 'ANALYZING'],
  },
  { id: 'DECISION', label: 'Do decyzji', states: ['READY_FOR_DECISION'] },
  { id: 'APPROVED_BACKLOG', label: 'Zatwierdzony backlog', states: ['APPROVED_BACKLOG'] },
  { id: 'SCHEDULED', label: 'Zaplanowane', states: ['SCHEDULED'] },
  { id: 'IN_EXECUTION', label: 'W realizacji', states: ['IN_EXECUTION'] },
  {
    id: 'RESULTS',
    label: 'Rezultaty',
    states: ['DELIVERED', 'BENEFITS_TRACKING', 'EFFECTIVENESS_REVIEWED'],
  },
  { id: 'HISTORICAL', label: 'Zamknięte', states: ['CLOSED', 'ARCHIVED'] },
];

export const INITIATIVE_LIFECYCLE_LABELS: Record<string, string> = {
  REGISTERED_DRAFT: 'Szkic zarejestrowany',
  DEFINED: 'Zdefiniowana',
  ANALYZING: 'Analiza',
  READY_FOR_DECISION: 'Gotowa do decyzji',
  APPROVED_BACKLOG: 'Zatwierdzony backlog',
  SCHEDULED: 'Zaplanowana',
  IN_EXECUTION: 'W realizacji',
  DELIVERED: 'Dostarczona',
  BENEFITS_TRACKING: 'Pomiar efektów',
  EFFECTIVENESS_REVIEWED: 'Efektywność oceniona',
  CLOSED: 'Zamknięta',
  ARCHIVED: 'Zarchiwizowana',

  // PRZEWODY ODBIORU 2026-09-03 — dopisek ADDYTYWNY (żaden klucz powyżej się
  // nie zmienia). `createInitiativeRegisterColumns()` jest wspólny dla trzech
  // powierzchni (test `day274-jedna-kolumnistyka`), ale dwie z nich karmią go
  // LEGACY słownikiem statusów (`mapInitiativeApiStatus` w AssessmentHub.tsx:313
  // → DRAFT/PLANNING/REVIEW/EXECUTING/APPROVED…), którego ta mapa nie znała.
  // Efekt zmierzony na zrzucie `assessment-initiatives-table` (2026-09-03):
  // kolumna „Cykl życia" pokazywała surowe DRAFT / PLANNING / REVIEW /
  // EXECUTING / APPROVED po angielsku, obok polskich chipów Menu 3.
  // Brzmienie 1:1 z `initiativeStatus.*` w public/locales/pl/translation.json —
  // jeden status, jeden napis w całej aplikacji.
  DRAFT: 'Szkic',
  PENDING_REVIEW: 'Oczekuje na przegląd',
  REVIEW: 'W przeglądzie',
  PROMOTED: 'Zatwierdzona',
  PLANNING: 'Planowanie',
  APPROVED: 'Zaakceptowana',
  EXECUTING: 'W realizacji',
  BLOCKED: 'Zablokowana',
  DONE: 'Zakończona',
  TRACKING: 'Monitorowanie',
};

/**
 * Etykiety PL dla nazw bramek zwracanych przez `nextStepForLifecycle`.
 *
 * Decyzja (weryfikacja przy naprawie i18n rejestru inicjatyw, 2026-08-31):
 * "Definition/Analysis/Portfolio/Schedule/Handoff/Delivery/Effectiveness/
 * Closure" to WŁASNA stała konfiguracyjna produktu (literały w `switch`
 * poniżej), nie terminologia metodyki konsultingowej ani treść danych demo —
 * `grep nextStepForLifecycle` pokazuje dokładnie dwóch konsumentów, oba w tym
 * katalogu. To interfejs, więc tłumaczymy; wartość pola `gateName` w danych
 * (`row.gateName`) zostaje angielska — mapa działa wyłącznie w warstwie
 * wyświetlania (kanon: enumy przez mapy etykiet, dane zostają EN).
 */
export const INITIATIVE_GATE_NAME_LABELS: Record<string, string> = {
  Definition: 'Definicja',
  Analysis: 'Analiza',
  Portfolio: 'Portfel',
  Schedule: 'Harmonogram',
  Handoff: 'Przekazanie',
  Delivery: 'Realizacja',
  Effectiveness: 'Efektywność',
  Closure: 'Zamknięcie',
};

/** Etykiety PL dla `gateReadiness` (wartości danych zostają EN — kanon TRIADA). */
export const INITIATIVE_GATE_READINESS_LABELS: Record<string, string> = {
  READY: 'Gotowe',
  PARTIAL: 'Częściowe',
  NOT_READY: 'Niegotowe',
  BLOCKED: 'Zablokowane',
  NOT_EVALUATED: 'Nie oceniono',
  UNKNOWN: 'Nieznane',
};

/** Etykiety PL dla `healthState` (wartości danych zostają EN — kanon TRIADA). */
export const INITIATIVE_HEALTH_STATE_LABELS: Record<string, string> = {
  ON_TRACK: 'Na torze',
  WATCH: 'Obserwuj',
  AT_RISK: 'Zagrożone',
  CRITICAL: 'Krytyczne',
  UNKNOWN: 'Nieznana',
  'N/A': 'Nie dotyczy',
};

/** Etykiety PL dla `impactConfidence` ("Confidence: HIGH" → "Pewność: Wysoka"). */
export const INITIATIVE_IMPACT_CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: 'Wysoka',
  MEDIUM: 'Średnia',
  LOW: 'Niska',
  UNKNOWN: 'Nieznana',
};

/**
 * Etykiety PL dla `sourceFreshness` (wartości danych zostają EN — kanon
 * TRIADA). 143-resztki (2026-08-31) — podgląd rejestru inicjatyw pokazywał
 * surowy enum ("Źródło: CURRENT"). Realne wartości: `InitiativeCardVersionReadModel['freshness']`
 * / `publishInitiativeCard.ts` / `materialCommand.ts` (grep `freshness:
 * 'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE'`) plus lokalny fallback
 * 'UNKNOWN' (`initiativeRegisterProjection.ts`'s own `|| 'UNKNOWN'`).
 */
export const INITIATIVE_SOURCE_FRESHNESS_LABELS: Record<string, string> = {
  CURRENT: 'Aktualne',
  STALE: 'Nieaktualne',
  SOURCE_UNAVAILABLE: 'Źródło niedostępne',
  UNKNOWN: 'Nieznane',
};

/**
 * Następny krok dla stanu cyklu życia.
 *
 * J17 (zasada 6): `action` było POLSKIM ZDANIEM wprost w tabeli — kolumna
 * „Next action" pokazywała „Zaplanuj realizację" także użytkownikowi
 * angielskiemu (zmierzone na zrzucie `en-01-rejestr-inicjatyw.png`).
 * Zwracamy teraz KOD (`actionKey`), a zdanie nadaje ekran przez
 * `enumLabel('initiativeNextAction', …)`. Pole `action` zostaje dla zgodności
 * wstecznej, ale niesie ANGIELSKI tekst — nie polski.
 */
export const nextStepForLifecycle = (lifecycle: string) => {
  switch (lifecycle) {
    case 'REGISTERED_DRAFT':
    case 'DEFINING':
      return { gate: 'Definition', actionKey: 'DEFINE', action: 'Complete the definition' };
    case 'DEFINED':
    case 'ANALYZING':
      return { gate: 'Analysis', actionKey: 'ANALYZE', action: 'Complete the analysis' };
    case 'READY_FOR_DECISION':
      return {
        gate: 'Portfolio',
        actionKey: 'PORTFOLIO_DECISION',
        action: 'Prepare the portfolio decision',
      };
    case 'APPROVED_BACKLOG':
      return { gate: 'Schedule', actionKey: 'SCHEDULE', action: 'Schedule the execution' };
    case 'SCHEDULED':
      return { gate: 'Handoff', actionKey: 'HANDOFF', action: 'Hand over to execution' };
    case 'IN_EXECUTION':
      return { gate: 'Delivery', actionKey: 'MONITOR', action: 'Monitor the execution' };
    case 'DELIVERED':
    case 'BENEFITS_TRACKING':
      return {
        gate: 'Effectiveness',
        actionKey: 'VERIFY_BENEFITS',
        action: 'Verify the benefits',
      };
    case 'EFFECTIVENESS_REVIEWED':
      return { gate: 'Closure', actionKey: 'PREPARE_CLOSURE', action: 'Prepare the closure' };
    default:
      return { gate: '—', actionKey: 'REVIEW_HISTORY', action: 'Review the history' };
  }
};

export const lifecycleMatchesPreset = (
  lifecycle: string,
  presetId: InitiativeLifecyclePreset | null
) => {
  if (!presetId) return true;
  return Boolean(
    INITIATIVE_LIFECYCLE_PRESETS.find((preset) => preset.id === presetId)?.states.includes(
      lifecycle
    )
  );
};

export interface CanonicalInitiativeRegisterFilters {
  projectId?: string | null;
  priorities?: string[];
}

/** Fixture mode replaces the canonical source; it must never overlay it. */
export const selectInitiativeRegisterSource = <T>(
  canonicalRows: T[],
  sampleRows: T[],
  sampleMode: boolean
) => (sampleMode ? sampleRows : canonicalRows);

/** Keep the visible register and its counters inside the selected canonical scope. */
export const canonicalInitiativeMatchesRegisterFilters = (
  initiative: Pick<PortfolioInitiative, 'projectId' | 'priority'>,
  filters: CanonicalInitiativeRegisterFilters
) => {
  const requestedProjectId = String(filters.projectId || '').trim();
  if (requestedProjectId && String(initiative.projectId || '') !== requestedProjectId) return false;

  const requestedPriorities = (filters.priorities || [])
    .map((priority) =>
      String(priority || '')
        .trim()
        .toUpperCase()
    )
    .filter(Boolean);
  if (requestedPriorities.length > 0) {
    const initiativePriority = String(initiative.priority || '')
      .trim()
      .toUpperCase();
    if (!initiativePriority || !requestedPriorities.includes(initiativePriority)) return false;
  }
  return true;
};

/** Apply the canonical register identity/scope filter once for rows and counters. */
export const filterCanonicalInitiativeRegisterScope = <
  T extends Pick<PortfolioInitiative, 'projectId' | 'priority'>,
>(
  initiatives: T[],
  filters: CanonicalInitiativeRegisterFilters
) =>
  initiatives.filter((initiative) =>
    canonicalInitiativeMatchesRegisterFilters(initiative, filters)
  );

export const projectCanonicalInitiativeRegisterRow = (record: RegisteredInitiativeReadModel) => {
  // Historyczne agregaty runtime-v1 potrafia nie miec `lifecycleState` w ogole
  // (zmierzone na bazie stagingu 07.09.2026: `ie_aggregate_state` ma wiersze
  // `initiative` z NULL w tym polu). Surowe `.toUpperCase()` rzucalo wtedy
  // TypeError w srodku `.map()` w `InitiativesHub.fetchData` i kasowalo CALY
  // rejestr. Brak danych ma byc widoczny, nie ma wywracac tabeli.
  const lifecycle = String(record.initiative?.lifecycleState ?? '')
    .trim()
    .toUpperCase();
  const nextStep = nextStepForLifecycle(lifecycle);
  return {
    id: record.initiative.initiativeId,
    canonicalVersion: record.version,
    title: record.initiative.title,
    problem: record.initiative.problem || null,
    lifecycle,
    // J17: etykieta cyklu zycia NIE moze byc zapiekana w danych — to warstwa
    // wyswietlania. Zostaje KOD, ekran tlumaczy przez `enumLabel`. Pole trzymamy
    // dla zgodnosci (nikt poza tym plikiem go dzis nie czyta — `grep lifecycleLabel`).
    lifecycleLabel: lifecycle || 'UNKNOWN',
    gateName: nextStep.gate,
    gateReadiness:
      record.initiative.gateReadiness || record.initiative.readiness || 'NOT_EVALUATED',
    ownerId: record.initiative.initiativeOwnerId || null,
    // J17: KOD dla ekranu (`enumLabel('initiativeNextAction', …)`); `nextAction`
    // zostaje dla starszych wolaczy i niesie ANGIELSKI tekst, nie polski.
    nextActionKey: nextStep.actionKey,
    nextAction: nextStep.action,
    expectedImpact: record.initiative.proposedOutcome || 'UNKNOWN',
    impactConfidence: 'UNKNOWN',
    plannedWindow: null,
    healthState: lifecycle === 'IN_EXECUTION' ? 'UNKNOWN' : 'N/A',
    // Historical registrations may not carry the later source envelope at all.
    // Keep that absence visible; never let one legacy row erase the full table.
    sourceFreshness: record.initiative.source?.freshness || 'UNKNOWN',
    updatedAt: record.updatedAt,
  } as const;
};

/**
 * PUSTA LISTA INICJATYW (07.09.2026) — `mapInitiativeStatus` z kierunkiem
 * `runtime-to-status` to zwykly odczyt z `Record<InitiativeLifecycleStatus, …>`:
 * dla wartosci spoza 12-elementowego slownika zwraca `undefined`, a odczyt
 * `.status` z `undefined` rzucal `TypeError` w srodku `.map()` w
 * `InitiativesHub.fetchData`. Efekt zmierzony na bazie stagingu: organizacja
 * wlasciciela ma agregat runtime-v1 z `lifecycleState: 'EXECUTING'`
 * (wartosc ze slownika LEGACY, ktora wyciekla do event store) — JEDEN taki
 * wiersz kasowal cale 97 wierszy rejestru mimo HTTP 200 na obu trasach API.
 *
 * Zasada tego pliku brzmi wprost: „never let one legacy row erase the full
 * table". Dlatego tlumaczymy trzystopniowo i NIGDY nie zwracamy `undefined`:
 *   1. wartosc runtime-v1 ze slownika kanonicznego,
 *   2. wartosc LEGACY przetlumaczona na runtime (`EXECUTING` → `IN_EXECUTION`),
 *   3. `DRAFT` jako widoczny kubelek awaryjny — dokladnie jak
 *      `normalizeLegacyInitiativeStatus` robi to dla tabeli klasycznej.
 * Surowa wartosc zostaje na `displayStatus`, wiec diagnoza jest dalej mozliwa.
 */
export const runtimeLifecycleToInitiativeStatus = (rawLifecycle: string): InitiativeStatus => {
  type RuntimeLifecycle = import('@/contracts/initiatives-execution/foundation').InitiativeLifecycleStatus;
  const normalized = String(rawLifecycle ?? '')
    .trim()
    .toUpperCase();

  const direct = mapInitiativeStatus({
    direction: 'runtime-to-status',
    lifecycle: normalized as RuntimeLifecycle,
  });
  if (direct) return direct.status as InitiativeStatus;

  const viaLegacy = mapInitiativeStatus({ direction: 'legacy-to-runtime', status: normalized });
  if (viaLegacy) {
    const mapped = mapInitiativeStatus({ direction: 'runtime-to-status', lifecycle: viaLegacy });
    if (mapped) return mapped.status as InitiativeStatus;
  }

  return InitiativeStatus.DRAFT;
};

/**
 * One canonical adapter used by both the Initiatives and Execution registers.
 *
 * D4b (2026-09-07/08) — literał zamiast nazwiska. Rejestr runtime-v1 niesie
 * WYŁĄCZNIE `initiativeOwnerId` (UUID), nigdy imienia/nazwiska — w
 * przeciwieństwie do wiersza legacy (`toCanonicalInitiativeRegisterItemFromLegacyRow`),
 * który dostaje `ownerBusiness.firstName/lastName` już rozwiązane przez
 * backend. Zanim ten resolver istniał, adapter miał tylko dwie ścieżki:
 * dopasowanie do zalogowanego `actor` (jedna osoba) i heurystykę „to nie
 * wygląda jak UUID → sformatuj jako imię" (myliła np. `demo-story-owner`
 * ze slugiem). Dla realnego UUID-a spoza obu ścieżek adapter zwracał SUROWY
 * POLSKI LITERAŁ „Przypisany właściciel" — zmierzone na Northwind: 8/13
 * wierszy rejestru. Teraz przyjmuje opcjonalny `resolveMemberName` (ta sama
 * mapa `userId → nazwisko`, którą liczy `useOrganizationMemberNames` z listy
 * członków organizacji — patrz `InitiativesHub.tsx`) i rozwiązuje UUID na
 * człowieka DOKŁADNIE tak samo jak inne ekrany (Execution, Results). Gdy
 * katalog nie zna identyfikatora, kolumna dostaje `undefined`
 * (`ownerBusiness` nieustawione) i renderuje uczciwe „—"
 * (`CanonicalInitiativeRegister.tsx`) — NIGDY literał, NIGDY surowy UUID.
 */
export const toCanonicalInitiativeRegisterItem = (
  record: RegisteredInitiativeReadModel,
  actor?: { id?: string | null; displayName?: string | null },
  resolveMemberName?: (userId: string) => string | null
): PortfolioInitiative => {
  const { initiative, updatedAt } = record;
  const projection = projectCanonicalInitiativeRegisterRow(record);
  const ownerId = initiative.initiativeOwnerId?.trim() || '';
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(ownerId);
  const resolvedMemberName = ownerId ? resolveMemberName?.(ownerId)?.trim() || '' : '';
  const ownerDisplayName =
    ownerId && actor?.id === ownerId && actor.displayName?.trim()
      ? actor.displayName.trim()
      : resolvedMemberName
        ? resolvedMemberName
        : ownerId && !looksLikeUuid
          ? ownerId.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
          : '';
  return {
    ...projection,
    name: initiative.title,
    summary: initiative.problem,
    description: initiative.problem,
    axis: 'operational',
    // [ODMROZENIE 05_INITIATIVES DEC-402] The runtime-v1 (event-sourced)
    // read model carries no area/axis/category field at all (see
    // `RegisteredInitiativeReadModel` in runtimeApi.ts) — leaving
    // `registerArea`/`registerAxisRaw`/`registerCategory` unset here is an
    // honest "brak danych", not a bug. Never invent a value for this source.
    status: runtimeLifecycleToInitiativeStatus(projection.lifecycle),
    displayStatus: projection.lifecycle,
    priority: initiative.priority as PortfolioInitiative['priority'],
    progress: undefined as unknown as number,
    budget: undefined as unknown as number,
    projectId: initiative.projectId,
    sourceId: initiative.source?.sourceId,
    sourceType: initiative.source?.sourceType || 'UNKNOWN',
    // Uczciwe „brak dopasowania": nie tworzymy `ownerBusiness` bez nazwiska
    // (patrz komentarz nad funkcją) — kolumna wtedy renderuje „—", nigdy
    // literał ani surowy UUID.
    ownerBusiness: ownerId && ownerDisplayName
      ? {
          id: ownerId,
          firstName: ownerDisplayName,
          lastName: '',
        }
      : undefined,
    createdAt: updatedAt,
    updatedAt,
  } as PortfolioInitiative;
};

const KNOWN_INITIATIVE_STATUSES = new Set<string>(Object.values(InitiativeStatus) as string[]);

/**
 * A legacy row's `status` already speaks the `InitiativeStatus` vocabulary
 * directly (unlike the runtime-v1 `lifecycleState`, which needs
 * `lifecycleToInitiativeStatus`). Guard defensively anyway: an org's classic
 * table can in principle carry a value from before the enum was extended, or
 * a data-quality slip. Per the "brak danych nie ukrywa rekordu" rule, an
 * unrecognized status must not drop the row — bucket it as DRAFT (visible,
 * safest default lifecycle bucket) while the untouched raw value stays on
 * `displayStatus` for diagnosis.
 */
const normalizeLegacyInitiativeStatus = (raw: unknown): InitiativeStatus => {
  const value = String(raw ?? '')
    .trim()
    .toUpperCase();
  return KNOWN_INITIATIVE_STATUSES.has(value) ? (value as InitiativeStatus) : InitiativeStatus.DRAFT;
};

/**
 * Adapter for a row from the classic `GET /api/initiatives` table (see
 * `listLegacyInitiatives`). Used only to backfill initiatives that exist in
 * that legacy store but were never promoted into the runtime-v1 projection —
 * see `mergeLegacyInitiativesIntoRegister`.
 */
export const toCanonicalInitiativeRegisterItemFromLegacyRow = (
  row: LegacyInitiativeApiRow
): PortfolioInitiative => {
  const rawStatus = String(row.status ?? '').trim().toUpperCase();
  const ownerBusiness = row.ownerBusiness?.id
    ? {
        id: row.ownerBusiness.id,
        firstName: row.ownerBusiness.firstName || '',
        lastName: row.ownerBusiness.lastName || '',
        avatarUrl: row.ownerBusiness.avatarUrl || undefined,
      }
    : undefined;
  const ownerExecution = row.ownerExecution?.id
    ? {
        id: row.ownerExecution.id,
        firstName: row.ownerExecution.firstName || '',
        lastName: row.ownerExecution.lastName || '',
        avatarUrl: row.ownerExecution.avatarUrl || undefined,
      }
    : undefined;
  return {
    id: String(row.id),
    name: row.name || row.title || row.summary || row.id,
    title: row.title || row.name || undefined,
    summary: row.summary || row.hypothesis || undefined,
    description: row.summary || row.hypothesis || undefined,
    axis: 'operational',
    // [ODMROZENIE 05_INITIATIVES DEC-402] Real "Obszar / oś" pass-through —
    // `axis` above stays 'operational' (wider, pre-existing contract, not
    // touched here); these three feed ONLY the register's dedicated column.
    registerArea: row.area ?? null,
    registerAxisRaw: row.axis ?? null,
    registerCategory: row.category ?? null,
    status: normalizeLegacyInitiativeStatus(row.status),
    // Odbior nocny 08.09 (evidence/odbior-noc-0809/inicjatywy 08a-08c): backend
    // zapisywal on_hold, a rejestr nigdy nie dostawal `onHold` z wiersza legacy
    // (71/71 wierszy idzie ta sciezka) — pigulka nie umiala pokazac „Wstrzymana”.
    onHold: row.onHold === true,
    displayStatus: rawStatus || undefined,
    priority: (String(row.priority || 'MEDIUM').toUpperCase() ||
      'MEDIUM') as PortfolioInitiative['priority'],
    progress: typeof row.progress === 'number' ? row.progress : 0,
    budget: typeof row.estimatedBudget === 'number' ? row.estimatedBudget : 0,
    plannedStartDate: row.plannedStartDate || undefined,
    plannedEndDate: row.plannedEndDate || undefined,
    projectId: row.projectId || undefined,
    sourceId: row.sourceId || undefined,
    sourceType: row.sourceType || 'LEGACY',
    ownerBusiness,
    ownerExecution,
    createdAt: row.createdAt || row.updatedAt || new Date(0).toISOString(),
    updatedAt: row.updatedAt || row.createdAt || new Date(0).toISOString(),
  } as PortfolioInitiative;
};

/**
 * Merge canonical (runtime-v1) rows with legacy classic-table rows that
 * never made it into the event-sourced projection. Canonical wins on id
 * collision (richer, authoritative shape); legacy rows only fill the gap —
 * a record must never disappear purely because of which write path created
 * it. Measured 2026-09-05 on org DBR77: 71 legacy rows, 0 canonical rows,
 * list rendered empty before this bridge existed.
 */
export const mergeLegacyInitiativesIntoRegister = (
  canonicalRows: PortfolioInitiative[],
  legacyRows: PortfolioInitiative[]
): PortfolioInitiative[] => {
  if (legacyRows.length === 0) return canonicalRows;
  const knownIds = new Set(canonicalRows.map((row) => row.id));
  const extraRows = legacyRows.filter((row) => row.id && !knownIds.has(row.id));
  if (extraRows.length === 0) return canonicalRows;
  return [...canonicalRows, ...extraRows];
};

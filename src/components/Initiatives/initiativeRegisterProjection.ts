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

export const nextStepForLifecycle = (lifecycle: string) => {
  switch (lifecycle) {
    case 'REGISTERED_DRAFT':
    case 'DEFINING':
      return { gate: 'Definition', action: 'Uzupełnij definicję' };
    case 'DEFINED':
    case 'ANALYZING':
      return { gate: 'Analysis', action: 'Uzupełnij analizę' };
    case 'READY_FOR_DECISION':
      return { gate: 'Portfolio', action: 'Przygotuj decyzję portfelową' };
    case 'APPROVED_BACKLOG':
      return { gate: 'Schedule', action: 'Zaplanuj realizację' };
    case 'SCHEDULED':
      return { gate: 'Handoff', action: 'Przekaż do realizacji' };
    case 'IN_EXECUTION':
      return { gate: 'Delivery', action: 'Monitoruj realizację' };
    case 'DELIVERED':
    case 'BENEFITS_TRACKING':
      return { gate: 'Effectiveness', action: 'Zweryfikuj efekty' };
    case 'EFFECTIVENESS_REVIEWED':
      return { gate: 'Closure', action: 'Przygotuj zamknięcie' };
    default:
      return { gate: '—', action: 'Przejrzyj historię' };
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
  const lifecycle = record.initiative.lifecycleState.toUpperCase();
  const nextStep = nextStepForLifecycle(lifecycle);
  return {
    id: record.initiative.initiativeId,
    canonicalVersion: record.version,
    title: record.initiative.title,
    problem: record.initiative.problem || null,
    lifecycle,
    lifecycleLabel: INITIATIVE_LIFECYCLE_LABELS[lifecycle] || 'UNKNOWN',
    gateName: nextStep.gate,
    gateReadiness:
      record.initiative.gateReadiness || record.initiative.readiness || 'NOT_EVALUATED',
    ownerId: record.initiative.initiativeOwnerId || null,
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

/** One canonical adapter used by both the Initiatives and Execution registers. */
export const toCanonicalInitiativeRegisterItem = (
  record: RegisteredInitiativeReadModel,
  actor?: { id?: string | null; displayName?: string | null }
): PortfolioInitiative => {
  const { initiative, updatedAt } = record;
  const projection = projectCanonicalInitiativeRegisterRow(record);
  const ownerId = initiative.initiativeOwnerId?.trim() || '';
  const ownerDisplayName =
    ownerId && actor?.id === ownerId && actor.displayName?.trim()
      ? actor.displayName.trim()
      : ownerId && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(ownerId)
        ? ownerId.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
        : ownerId
          ? 'Przypisany właściciel'
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
    status: mapInitiativeStatus({
      direction: 'runtime-to-status',
      lifecycle: projection.lifecycle as import('@/contracts/initiatives-execution/foundation').InitiativeLifecycleStatus,
    }).status as InitiativeStatus,
    displayStatus: projection.lifecycle,
    priority: initiative.priority as PortfolioInitiative['priority'],
    progress: undefined as unknown as number,
    budget: undefined as unknown as number,
    projectId: initiative.projectId,
    sourceId: initiative.source?.sourceId,
    sourceType: initiative.source?.sourceType || 'UNKNOWN',
    ownerBusiness: ownerId
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

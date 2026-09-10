import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

export type InitiativeHeaderSource = 'CANONICAL' | 'LEGACY';

export interface InitiativeHeader {
  id: string;
  title: string;
  lifecycleState: string;
  projectId: string | null;
  ownerId: string | null;
  source: InitiativeHeaderSource;
}

export interface InitiativeHeaderFilters {
  projectId?: string;
  status?: string;
  search?: string;
}

// FIX-3 [ODMROZENIE 05_INITIATIVES DEC-453] [ODMROZENIE 06_EXECUTION DEC-453]:
// parytet z klientowym SSOT `src/contracts/initiatives-execution/statusMapping.ts`
// (`legacyToRuntime`, 19 wpisow, zmierzone na kopii stagingu 10.09). Serwer NIE
// MOZE importowac kodu frontendu wprost: `server/tsconfig.json` ma
// `rootDir: "."` + `include: ["src/**/*"]` wzgledem `server/`, wiec `include`
// obejmuje wylacznie `server/src/**`, a repo nie ma dzis ANI JEDNEGO importu
// `../src/**` (frontend) w kodzie produkcyjnym serwera (zmierzone: 0 trafien).
// To jest wiec CELOWY drugi egzemplarz slownika — parytet pilnuje test
// `statusDictionaryParity.test.ts`, ktory importuje realny
// `mapInitiativeStatus()` z `src/contracts/initiatives-execution/statusMapping.ts`
// (wzorem `server/src/method-core/__tests__/clientContractParity.integration.test.ts`,
// ktory tak samo importuje frontendowy `src/` z testu serwerowego) i
// porownuje kazdy z 19 kluczy. PRZY ZMIANIE JEDNEJ STRONY ZMIEN OBIE — inaczej
// test parytetu czerwienieje.
//
// Dwa realne rozjazdy naprawione tym FIX-em (dane DBR77, kopia stagingu
// 10.09): `REJECTED` klient mapuje na `CLOSED` (tu bylo `ARCHIVED`, x16
// rekordow), `PROPOSED` klient mapuje na `REGISTERED_DRAFT` (tu bylo
// `DEFINED`, x1 rekord).
const LEGACY_TO_RUNTIME: Record<string, string> = {
  PROPOSED: 'REGISTERED_DRAFT',
  DRAFT: 'REGISTERED_DRAFT',
  PENDING_REVIEW: 'READY_FOR_DECISION',
  REVIEW: 'READY_FOR_DECISION',
  PROMOTED: 'READY_FOR_DECISION',
  PLANNING: 'READY_FOR_DECISION',
  PENDING_APPROVAL: 'READY_FOR_DECISION',
  APPROVED: 'APPROVED_BACKLOG',
  SCHEDULED: 'SCHEDULED',
  EXECUTING: 'IN_EXECUTION',
  IN_PROGRESS: 'IN_EXECUTION',
  IN_EXECUTION: 'IN_EXECUTION',
  BLOCKED: 'IN_EXECUTION',
  DONE: 'CLOSED',
  TRACKING: 'BENEFITS_TRACKING',
  ARCHIVED: 'ARCHIVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CLOSED',
  REJECTED: 'CLOSED',
};

// Agregat kanoniczny bywa juz zapisany wprost w slowniku docelowym
// (`INITIATIVE_LIFECYCLE`, `src/contracts/initiatives-execution/foundation.ts`)
// zamiast w slowniku zastanym — to NIE jest "nieznany stan" (FIX-4), tylko
// przepuszczenie wartosci, ktora juz jest poprawna.
const CANONICAL_LIFECYCLE_STATES = new Set<string>([
  'REGISTERED_DRAFT',
  'DEFINED',
  'ANALYZING',
  'READY_FOR_DECISION',
  'APPROVED_BACKLOG',
  'SCHEDULED',
  'IN_EXECUTION',
  'DELIVERED',
  'BENEFITS_TRACKING',
  'EFFECTIVENESS_REVIEWED',
  'CLOSED',
  'ARCHIVED',
]);

/**
 * FIX-5 [ODMROZENIE 05_INITIATIVES DEC-453] [ODMROZENIE 06_EXECUTION DEC-453]:
 * agregator ostrzezen per-zadanie. Przed FIX-em kazdy wiersz z brakiem pola
 * albo nieznanym statusem emitowal wlasna linie `logger.warn` — zmierzone na
 * kopii stagingu 10.09: 106 linii WARN na JEDNO `GET /api/initiatives`
 * (4664 -> 4770 w logu). Teraz kolektor zbiera liczniki i do 3 przykladowe
 * id, `flush()` emituje NAJWYZEJ dwie linie na wywolanie (jedna dla brakow
 * pol naglowka, jedna dla nieznanych statusow — FIX-4).
 */
class HeaderIssueCollector {
  private missingFieldsCount = 0;
  private readonly missingFieldSampleIds: string[] = [];
  private unknownStatusCount = 0;
  private readonly unknownStatusSampleIds: string[] = [];

  recordMissingFields(id: string): void {
    this.missingFieldsCount += 1;
    if (this.missingFieldSampleIds.length < 3) this.missingFieldSampleIds.push(id);
  }

  recordUnknownStatus(id: string): void {
    this.unknownStatusCount += 1;
    if (this.unknownStatusSampleIds.length < 3) this.unknownStatusSampleIds.push(id);
  }

  flush(organizationId: unknown): void {
    if (this.missingFieldsCount > 0) {
      logger.warn('[initiativeUnifiedReader] records with unmapped header fields', {
        organizationId,
        count: this.missingFieldsCount,
        sampleIds: this.missingFieldSampleIds,
      });
    }
    if (this.unknownStatusCount > 0) {
      logger.warn(
        '[initiativeUnifiedReader] records with unknown status skipped (fail-closed)',
        {
          organizationId,
          count: this.unknownStatusCount,
          sampleIds: this.unknownStatusSampleIds,
        }
      );
    }
  }
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * FIX-4 [ODMROZENIE 05_INITIATIVES DEC-453] [ODMROZENIE 06_EXECUTION DEC-453]:
 * przed tym FIX-em nieznany status przechodzil surowy do UI
 * (`LEGACY_TO_RUNTIME[x] || rawState`, fail-OPEN, zero logu). Teraz:
 * zmapowany -> zwroc runtime; juz kanoniczny -> przepusc; INACZEJ ->
 * `null` (wolajacy pomija caly rekord, `collector` liczy pominiecie).
 */
function resolveLifecycleState(rawState: string): string | null {
  const upper = rawState.toUpperCase();
  const mapped = LEGACY_TO_RUNTIME[upper];
  if (mapped) return mapped;
  if (CANONICAL_LIFECYCLE_STATES.has(upper)) return upper;
  return null;
}

function canonicalHeader(
  row: Record<string, unknown>,
  collector: HeaderIssueCollector
): InitiativeHeader | null {
  const payload = objectPayload(row.payload_json);
  const id = text(row.aggregate_id);
  const rawState = text(payload.lifecycleState) || text(payload.status) || 'REGISTERED_DRAFT';
  const lifecycleState = resolveLifecycleState(rawState);
  if (lifecycleState === null) {
    collector.recordUnknownStatus(id);
    return null;
  }
  const title = text(payload.title) || text(payload.name);
  const header: InitiativeHeader = {
    id,
    title: title || id,
    lifecycleState,
    projectId: text(payload.projectId) || null,
    ownerId: text(payload.initiativeOwnerId) || text(payload.ownerId) || null,
    source: 'CANONICAL',
  };
  if (!title || !header.projectId || !header.ownerId) {
    collector.recordMissingFields(id);
  }
  return header;
}

function legacyHeader(
  row: Record<string, unknown>,
  collector: HeaderIssueCollector
): InitiativeHeader | null {
  const id = text(row.id);
  const rawState = text(row.status) || 'DRAFT';
  const lifecycleState = resolveLifecycleState(rawState);
  if (lifecycleState === null) {
    collector.recordUnknownStatus(id);
    return null;
  }
  const title = text(row.title) || text(row.name);
  const header: InitiativeHeader = {
    id,
    title: title || id,
    lifecycleState,
    projectId: text(row.project_id) || null,
    ownerId: text(row.owner_business_id) || text(row.owner_execution_id) || null,
    source: 'LEGACY',
  };
  if (!title || !header.projectId || !header.ownerId) {
    collector.recordMissingFields(id);
  }
  return header;
}

/**
 * FIX-1 [ODMROZENIE 05_INITIATIVES DEC-453] [ODMROZENIE 06_EXECUTION DEC-453]:
 * przy kolizji id (rekord istnieje w OBU magazynach) zrodlem rozstrzygajacym
 * dla STATUSU jest tabela klasyczna `initiatives` — parytet z klientowym E1a
 * (`src/components/Initiatives/initiativeRegisterProjection.ts:482-511`,
 * `mergeLegacyInitiativesIntoRegister`), bo to ta tabela czyta/pisze
 * dzisiejszy przeplyw akceptacji i karta (`V8PlanningApi.getInitiative` /
 * `Api.getInitiativeById`) — projekcja kanoniczna potrafi byc wobec niej
 * nieaktualna. Reszta pol (tytul/projekt/wlasciciel) zostaje z bogatszego,
 * kanonicznego wiersza. Ten komentarz ZASTĘPUJE poprzedni ("przy kolizji
 * zrodlem rozstrzygajacym jest kanon"), ktory mowil odwrotnie i byl
 * niezgodny z E1a — patrz `97_ODBIOR_W1_W2.md` §1b.
 */
function resolveCollision(
  canonical: InitiativeHeader,
  legacy: InitiativeHeader | undefined
): InitiativeHeader {
  if (!legacy) return canonical;
  return { ...canonical, lifecycleState: legacy.lifecycleState };
}

export function isInitiativeUnifiedReadEnabled(): boolean {
  return process.env.ENABLE_INITIATIVE_UNIFIED_READ === 'true';
}

export async function initiativeExists(
  organizationId: string,
  initiativeId: string
): Promise<boolean> {
  const found = await queryHelpers.queryOne(
    `SELECT 1
       FROM (
         SELECT id FROM initiatives WHERE organization_id = ? AND id = ?
         UNION ALL
         SELECT aggregate_id AS id FROM ie_aggregate_state
          WHERE organization_id = ? AND aggregate_type = 'initiative' AND aggregate_id = ?
       ) initiative_sources
      LIMIT 1`,
    [organizationId, initiativeId, organizationId, initiativeId]
  );
  return Boolean(found);
}

export async function readInitiativeHeader(
  organizationId: string,
  initiativeId: string
): Promise<InitiativeHeader | null> {
  const collector = new HeaderIssueCollector();
  const [canonicalRow, legacyRow] = await Promise.all([
    queryHelpers.queryOne<Record<string, unknown>>(
      `SELECT organization_id, aggregate_id, payload_json
         FROM ie_aggregate_state
        WHERE organization_id = ? AND aggregate_type = 'initiative' AND aggregate_id = ?`,
      [organizationId, initiativeId]
    ),
    queryHelpers.queryOne<Record<string, unknown>>(
      `SELECT id, organization_id, title, name, status, project_id,
              owner_business_id, owner_execution_id
         FROM initiatives WHERE organization_id = ? AND id = ?`,
      [organizationId, initiativeId]
    ),
  ]);
  const canonical = canonicalRow ? canonicalHeader(canonicalRow, collector) : null;
  const legacy = legacyRow ? legacyHeader(legacyRow, collector) : null;
  collector.flush(organizationId);
  if (canonical) return resolveCollision(canonical, legacy ?? undefined);
  return legacy;
}

export async function listInitiativeHeaders(
  organizationId: string,
  filters: InitiativeHeaderFilters = {}
): Promise<InitiativeHeader[]> {
  const collector = new HeaderIssueCollector();
  const [canonicalRows, legacyRows] = await Promise.all([
    queryHelpers.queryAll<Record<string, unknown>>(
      `SELECT organization_id, aggregate_id, payload_json
         FROM ie_aggregate_state
        WHERE organization_id = ? AND aggregate_type = 'initiative'`,
      [organizationId]
    ),
    queryHelpers.queryAll<Record<string, unknown>>(
      `SELECT id, organization_id, title, name, status, project_id,
              owner_business_id, owner_execution_id
         FROM initiatives WHERE organization_id = ?`,
      [organizationId]
    ),
  ]);
  const legacyById = new Map<string, InitiativeHeader>();
  for (const row of legacyRows) {
    const header = legacyHeader(row, collector);
    if (header) legacyById.set(header.id, header);
  }
  const byId = new Map<string, InitiativeHeader>(legacyById);
  for (const row of canonicalRows) {
    const header = canonicalHeader(row, collector);
    if (!header) continue;
    byId.set(header.id, resolveCollision(header, legacyById.get(header.id)));
  }
  collector.flush(organizationId);
  const search = text(filters.search).toLowerCase();
  return [...byId.values()].filter((header) => {
    if (filters.projectId && header.projectId !== filters.projectId) return false;
    if (
      filters.status &&
      header.lifecycleState !== LEGACY_TO_RUNTIME[filters.status.toUpperCase()] &&
      header.lifecycleState !== filters.status
    )
      return false;
    if (search && !header.title.toLowerCase().includes(search)) return false;
    return true;
  });
}

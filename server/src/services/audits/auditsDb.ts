/**
 * auditsDb — fail-loud dostęp do bazy dla domeny Audits.
 *
 * DLACZEGO TEN PLIK ISTNIEJE:
 * `server/src/utils/DbPromise.ts` ma domyślnie `fallback = true`, co oznacza, że
 * błąd SQL (brak tabeli, złamany constraint, zła kolumna) NIE jest rzucany —
 * `all()` zwraca `[]`, `get()` zwraca `null`, a `run()` udaje sukces. Dla
 * większości modułów to wygodne. Dla audytu jest to niedopuszczalne: cicho
 * nieutrwalone ustalenie albo cicho niezapisana weryfikacja skuteczności
 * wyglądają w UI identycznie jak ich brak, a raport poaudytowy zbudowany na
 * takiej luce jest nie do obrony.
 *
 * Każdy serwis Audits używa WYŁĄCZNIE tych funkcji. Nie importuj DbPromise
 * bezpośrednio w `server/src/services/audits/**`.
 */

import { randomUUID } from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

/** Odczyt wielu wierszy. Błąd SQL rzuca wyjątek zamiast zwracać pustą listę. */
export async function auditAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await dbAll<T>(sql, params, { fallback: false })) ?? [];
}

/** Odczyt jednego wiersza. Brak wiersza → null; błąd SQL → wyjątek. */
export async function auditGet<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  return (await dbGet<T>(sql, params, { fallback: false })) ?? null;
}

/** Zapis. Błąd SQL rzuca wyjątek zamiast udawać sukces. */
export async function auditRun(sql: string, params: unknown[] = []): Promise<void> {
  await dbRun(sql, params, { fallback: false });
}

// ---------------------------------------------------------------------------
// Identyfikatory
// ---------------------------------------------------------------------------

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

// ---------------------------------------------------------------------------
// Konwersje
// ---------------------------------------------------------------------------

/**
 * Kolumny JSONB wracają z node-pg jako obiekt, ale te same tabele czytane przez
 * warstwę SQLite w testach wracają jako string. Jedno miejsce normalizacji.
 */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

export function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't' || value === 'true';
}

/** `numeric` wraca z node-pg jako STRING — nie porównuj go liczbowo bez konwersji. */
export function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Ścieżka audytowa domeny
// ---------------------------------------------------------------------------

export interface DomainEventInput {
  organizationId: string;
  programId?: string | null;
  entityType: string;
  entityId?: string | null;
  eventType: string;
  actorId?: string | null;
  actorRole?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * Zapisuje zdarzenie biznesowe audytu. Świadomie NIE rzuca: brak wpisu w
 * dzienniku nie może wycofać zatwierdzonego ustalenia. Awaria jest logowana z
 * poziomem `error`, żeby nie zniknęła po cichu.
 */
export async function recordAuditEvent(input: DomainEventInput): Promise<void> {
  try {
    await auditRun(
      `INSERT INTO audit_domain_events
         (id, program_id, organization_id, entity_type, entity_id, event_type,
          actor_id, actor_role, summary, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        newId('ade'),
        input.programId ?? null,
        input.organizationId,
        input.entityType,
        input.entityId ?? null,
        input.eventType,
        input.actorId ?? null,
        input.actorRole ?? null,
        input.summary ?? null,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  } catch (error) {
    logger.error('[audits] nie udało się zapisać zdarzenia domenowego', {
      eventType: input.eventType,
      entityType: input.entityType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Błędy domenowe
// ---------------------------------------------------------------------------

export class AuditDomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'AUDIT_DOMAIN_ERROR') {
    super(message);
    this.name = 'AuditDomainError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class AuditNotFoundError extends AuditDomainError {
  constructor(what = 'Zasób audytu') {
    super(`${what} nie został znaleziony`, 404, 'AUDIT_NOT_FOUND');
  }
}

export class AuditPermissionError extends AuditDomainError {
  constructor(message = 'Brak uprawnień do tej operacji audytowej') {
    super(message, 403, 'AUDIT_FORBIDDEN');
  }
}

export class AuditStateError extends AuditDomainError {
  constructor(message: string) {
    super(message, 409, 'AUDIT_INVALID_STATE');
  }
}

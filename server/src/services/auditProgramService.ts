/**
 * auditProgramService — backend for the Audit Orchestrator (owner flagged
 * direction ⭐⭐⭐, audit tasks #19 / #19b / #19c / #19d / #19e).
 *
 * What an "audit program" is:
 * A named, org-scoped container that bundles an audit objective with a set of
 * interview templates ("what to ask") and assignees ("who fills what"). It is the
 * orchestration layer above individual interview assignments — instead of
 * assigning surveys one by one, a consultant defines one program (e.g. an
 * "ISO 27001 readiness audit") that fans out to many templates × many people.
 *
 * MVP boundary (honest): this service persists the *program definition* and its
 * config (selected templates, assignees, preset, suggested role→area plan). The
 * actual bulk creation of the underlying interview surveys/assignments is NOT
 * performed here — that is a documented next step driven from the frontend via
 * existing interview assignment endpoints. See the route handlers + the
 * frontend wizard for the explicit "Generate surveys" TODO.
 *
 * Persistence model: a single `audit_programs` table. The flexible parts
 * (templateIds, assigneeIds, preset section→role plan, completion snapshot) live
 * in a JSON `config` column so we can evolve the shape without migrations.
 * DB_MANAGED_SCHEMA is off, so the table is created lazily via
 * CREATE TABLE IF NOT EXISTS — same pattern as insightSourceBasketService.ts /
 * discovery.routes.ts.
 */

import { randomUUID } from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditProgramStatus = 'draft' | 'active' | 'completed' | 'archived';

/**
 * Free-form program config. Kept deliberately loose (jsonb) for the MVP so the
 * wizard can persist its full plan without a schema migration per field.
 */
export interface AuditProgramConfig {
  /** Interview template ids the program will fan out to. */
  templateIds?: string[];
  /** User ids responsible for filling the surveys. */
  assigneeIds?: string[];
  /**
   * Optional suggested plan rows (who → which area/template). Produced by the
   * wizard's heuristic planner (#19b) or the ISO 27001 preset (#19c). Purely
   * advisory metadata for the MVP.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plan?: any[];
  /**
   * Whether the underlying surveys/assignments have been generated yet. The MVP
   * leaves generation as a manual next step, so this starts false.
   */
  surveysGenerated?: boolean;
  /** Anything else the wizard wants to round-trip. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface AuditProgram {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  objective: string | null;
  status: AuditProgramStatus;
  /** Preset id this program was seeded from, e.g. 'iso27001' or 'custom'. */
  preset: string | null;
  config: AuditProgramConfig;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProgramInput {
  name: string;
  description?: string | null;
  objective?: string | null;
  status?: AuditProgramStatus;
  preset?: string | null;
  config?: AuditProgramConfig;
}

export interface UpdateProgramInput {
  name?: string;
  description?: string | null;
  objective?: string | null;
  status?: AuditProgramStatus;
  preset?: string | null;
  config?: AuditProgramConfig;
}

const VALID_STATUSES: AuditProgramStatus[] = ['draft', 'active', 'completed', 'archived'];

function normalizeStatus(value: unknown, fallback: AuditProgramStatus): AuditProgramStatus {
  const s = String(value || '').trim() as AuditProgramStatus;
  return VALID_STATUSES.includes(s) ? s : fallback;
}

// ---------------------------------------------------------------------------
// Lazy schema (DB_MANAGED_SCHEMA is off — create on first use)
// ---------------------------------------------------------------------------

let schemaReady = false;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await dbRun(
    `CREATE TABLE IF NOT EXISTS audit_programs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      objective TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      preset TEXT,
      config TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    []
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_audit_programs_org
       ON audit_programs(organization_id)`,
    []
  ).catch(() => {});
  schemaReady = true;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

function parseConfig(raw: unknown): AuditProgramConfig {
  if (raw === null || raw === undefined || raw === '') return {};
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? (parsed as AuditProgramConfig) : {};
  } catch {
    return {};
  }
}

function mapRow(row: Record<string, unknown> | undefined | null): AuditProgram | null {
  if (!row) return null;
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name ?? ''),
    description: (row.description as string) ?? null,
    objective: (row.objective as string) ?? null,
    status: normalizeStatus(row.status, 'draft'),
    preset: (row.preset as string) ?? null,
    config: parseConfig(row.config),
    createdBy: String(row.created_by ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

// ---------------------------------------------------------------------------
// CRUD (all org-scoped)
// ---------------------------------------------------------------------------

export async function listPrograms(organizationId: string): Promise<AuditProgram[]> {
  await ensureSchema();
  const rows = await dbAll<Record<string, unknown>>(
    `SELECT * FROM audit_programs
       WHERE organization_id = ?
       ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC`,
    [organizationId],
    { fallback: false }
  );
  return (rows || []).map(mapRow).filter((p): p is AuditProgram => p !== null);
}

export async function getProgram(organizationId: string, id: string): Promise<AuditProgram | null> {
  await ensureSchema();
  const row = await dbGet<Record<string, unknown>>(
    `SELECT * FROM audit_programs WHERE id = ? AND organization_id = ?`,
    [id, organizationId],
    { fallback: false }
  );
  return mapRow(row);
}

export async function createProgram(
  organizationId: string,
  userId: string,
  input: CreateProgramInput
): Promise<AuditProgram> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const config: AuditProgramConfig =
    input.config && typeof input.config === 'object' ? input.config : {};

  await dbRun(
    `INSERT INTO audit_programs
       (id, organization_id, name, description, objective, status, preset, config,
        created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      String(input.name || '').trim(),
      input.description ?? null,
      input.objective ?? null,
      normalizeStatus(input.status, 'draft'),
      input.preset ?? null,
      JSON.stringify(config),
      userId,
      now,
      now,
    ],
    { fallback: false }
  );

  const created = await getProgram(organizationId, id);
  if (!created) throw new Error('Failed to create audit program');
  return created;
}

export async function updateProgram(
  organizationId: string,
  id: string,
  input: UpdateProgramInput
): Promise<AuditProgram | null> {
  await ensureSchema();
  const existing = await getProgram(organizationId, id);
  if (!existing) return null;

  const next = {
    name: input.name !== undefined ? String(input.name).trim() : existing.name,
    description: input.description !== undefined ? input.description : existing.description,
    objective: input.objective !== undefined ? input.objective : existing.objective,
    status:
      input.status !== undefined ? normalizeStatus(input.status, existing.status) : existing.status,
    preset: input.preset !== undefined ? input.preset : existing.preset,
    config:
      input.config !== undefined && input.config && typeof input.config === 'object'
        ? input.config
        : existing.config,
  };
  const now = new Date().toISOString();

  await dbRun(
    `UPDATE audit_programs
       SET name = ?, description = ?, objective = ?, status = ?, preset = ?, config = ?,
           updated_at = ?
       WHERE id = ? AND organization_id = ?`,
    [
      next.name,
      next.description ?? null,
      next.objective ?? null,
      next.status,
      next.preset ?? null,
      JSON.stringify(next.config),
      now,
      id,
      organizationId,
    ],
    { fallback: false }
  );

  return getProgram(organizationId, id);
}

export async function deleteProgram(organizationId: string, id: string): Promise<boolean> {
  await ensureSchema();
  const existing = await getProgram(organizationId, id);
  if (!existing) return false;
  await dbRun(
    `DELETE FROM audit_programs WHERE id = ? AND organization_id = ?`,
    [id, organizationId],
    { fallback: false }
  );
  return true;
}

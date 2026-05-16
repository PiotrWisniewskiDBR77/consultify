/**
 * Shared helpers for AI Editor level handlers (Block C · C-S2).
 *
 * Centralizes:
 *   - Cross-tenant guards (`assertTableInOrganization`).
 *   - Field/record/table context loading.
 *   - JSON parsing of LLM responses with Zod validation.
 *   - Prompt fence + UNTRUSTED guard wrapping.
 *
 * Every helper here accepts an explicit `db` parameter so unit tests can
 * pass a mocked `getDatabase()` without monkey-patching globals.
 */

import { getDatabase } from '../../../database/Database.js';
import logger from '../../../utils/Logger.js';
import { PROMPT_INJECTION_GUARD } from './llmProvider.js';

// ── Cross-tenant guards ──────────────────────────────────────────────────────

export class HandlerTenantViolation extends Error {
  readonly code = 'TENANT_VIOLATION';
  constructor(message = 'Resource not in actor organization') {
    super(message);
    this.name = 'HandlerTenantViolation';
  }
}

/** Confirms that the table belongs to the actor's organization & workspace. */
export async function assertTableInOrganization(
  tableId: string,
  organizationId: string,
  workspaceId: string
): Promise<void> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT b.workspace_id, b.organization_id
       FROM tp_tables t
       JOIN tp_bases  b ON t.base_id = b.id
      WHERE t.id = $1
      LIMIT 1`,
    [tableId]
  );
  const row = rows?.[0] as
    | { workspace_id?: string; organization_id?: string }
    | undefined;
  if (
    !row ||
    String(row.organization_id) !== String(organizationId) ||
    String(row.workspace_id) !== String(workspaceId)
  ) {
    throw new HandlerTenantViolation();
  }
}

// ── Context loading ──────────────────────────────────────────────────────────

export interface FieldDef {
  id: string;
  name: string;
  fieldType: string;
  options: Record<string, unknown>;
}

export interface RecordRow {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
}

/** Loads all fields for a table (sorted by field_order, then name). */
export async function loadTableFields(tableId: string): Promise<FieldDef[]> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT id, name, field_type, options
       FROM tp_fields
      WHERE table_id = $1
      ORDER BY field_order ASC, name ASC`,
    [tableId]
  );
  return rows.map((r: any) => ({
    id: String(r.id),
    name: String(r.name),
    fieldType: String(r.field_type),
    options:
      r.options == null
        ? {}
        : typeof r.options === 'string'
          ? safeJson(r.options)
          : (r.options as Record<string, unknown>),
  }));
}

/** Loads a single record by id (scoped to tableId for tenant defense). */
export async function loadRecord(
  tableId: string,
  recordId: string
): Promise<RecordRow | null> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT id, table_id, data
       FROM tp_records
      WHERE id = $1 AND table_id = $2
      LIMIT 1`,
    [recordId, tableId]
  );
  const row = rows?.[0] as
    | { id?: string; table_id?: string; data?: unknown }
    | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    tableId: String(row.table_id),
    data:
      typeof row.data === 'string'
        ? safeJson(row.data)
        : ((row.data ?? {}) as Record<string, unknown>),
  };
}

/** Loads up to `limit` records from a table (used for column-level context). */
export async function loadRecords(
  tableId: string,
  recordIds: string[]
): Promise<RecordRow[]> {
  if (recordIds.length === 0) return [];
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT id, table_id, data
       FROM tp_records
      WHERE table_id = $1 AND id = ANY($2::uuid[])`,
    [tableId, recordIds]
  );
  return rows.map((r: any) => ({
    id: String(r.id),
    tableId: String(r.table_id),
    data:
      typeof r.data === 'string'
        ? safeJson(r.data)
        : ((r.data ?? {}) as Record<string, unknown>),
  }));
}

// ── JSON / response parsing ──────────────────────────────────────────────────

export function safeJson(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Wraps user-supplied content in a triple-backtick fence with the
 *  UNTRUSTED guard so the LLM treats it as data, not instructions. */
export function fenceUntrusted(label: string, content: string): string {
  return `${PROMPT_INJECTION_GUARD}\n\n[${label} BEGIN]\n\`\`\`\n${content}\n\`\`\`\n[${label} END]`;
}

/** Returns a normalized confidence in [0,1]. */
export function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// ── Logging helper ───────────────────────────────────────────────────────────

export function logHandlerError(level: string, e: unknown, ctx: Record<string, unknown>): void {
  logger.error(`[AiEditor:${level}] handler failed`, {
    ...ctx,
    error: (e as Error)?.message,
  });
}

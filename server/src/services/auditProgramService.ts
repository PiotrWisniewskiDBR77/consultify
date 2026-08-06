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
import logger from '../utils/Logger.js';
import interviewAssignmentService from './InterviewAssignmentService.js';

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
   * Whether the underlying surveys/assignments have been generated. Set true by
   * generateSurveys() once at least one assignment is created (#19).
   */
  surveysGenerated?: boolean;
  /**
   * Ids of the interview assignments created by bulk generation (#19). One per
   * template × assignee pair. Used to compute the completion rollup (#19e) and to
   * keep the generation idempotent (skip already-generated programs).
   */
  generatedAssignmentIds?: string[];
  /** Snapshot of the last generation run (succeeded/failed counts + when). */
  generation?: {
    requested: number;
    created: number;
    failed: number;
    at: string;
  };
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
    createdAt:
      row.created_at instanceof Date
        ? (row.created_at as Date).toISOString()
        : String(row.created_at ?? ''),
    updatedAt:
      row.updated_at instanceof Date
        ? (row.updated_at as Date).toISOString()
        : String(row.updated_at ?? ''),
  };
}

// ---------------------------------------------------------------------------
// CRUD (all org-scoped)
// ---------------------------------------------------------------------------

export interface ListProgramsOptions {
  /** Page size. Clamped to [1, 200]. Defaults to 50. */
  limit?: number;
  /** Row offset (>= 0). Defaults to 0. */
  offset?: number;
  /**
   * Free-text search over name/objective/description (server-side, #19e / L-02).
   * Matched case-insensitively against the FULL org-scoped set, not just the
   * already-fetched page — mirrors initiativeTemplateService.searchTemplates.
   */
  search?: string;
  /** Optional status filter ('all' or undefined = no filter). */
  status?: AuditProgramStatus | 'all';
}

export interface ListProgramsResult {
  programs: AuditProgram[];
  total: number;
  limit: number;
  offset: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

function clampLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.floor(n), MAX_LIST_LIMIT);
}

function clampOffset(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/**
 * Paginated, org-scoped list (#19e). Returns the requested page plus the total
 * count so the hub can render "load more" / page indicators honestly.
 */
export async function listPrograms(
  organizationId: string,
  options: ListProgramsOptions = {}
): Promise<ListProgramsResult> {
  await ensureSchema();
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);

  // Build the org-scoped WHERE incrementally. The search + status predicates run
  // against the FULL set (L-02), so filtering no longer misses unloaded rows.
  // org-scope stays the leading, mandatory predicate.
  const where: string[] = ['organization_id = ?'];
  const filterParams: unknown[] = [organizationId];

  const search = typeof options.search === 'string' ? options.search.trim() : '';
  if (search) {
    // Mirror initiativeTemplateService.searchTemplates: case-insensitive LIKE
    // over the human-facing columns, one %term% bound per column.
    where.push('(name LIKE ? OR objective LIKE ? OR description LIKE ?)');
    const term = `%${search}%`;
    filterParams.push(term, term, term);
  }

  if (options.status && options.status !== 'all') {
    where.push('status = ?');
    filterParams.push(options.status);
  }

  const whereClause = where.join(' AND ');

  const countRow = await dbGet<{ total: number }>(
    `SELECT COUNT(*) AS total FROM audit_programs WHERE ${whereClause}`,
    [...filterParams],
    { fallback: false }
  );
  const total = Number(countRow?.total ?? 0);

  const rows = await dbAll<Record<string, unknown>>(
    `SELECT * FROM audit_programs
       WHERE ${whereClause}
       ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
       LIMIT ? OFFSET ?`,
    [...filterParams, limit, offset],
    { fallback: false }
  );
  const programs = (rows || []).map(mapRow).filter((p): p is AuditProgram => p !== null);
  return { programs, total, limit, offset };
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

// ---------------------------------------------------------------------------
// Bulk survey generation (#19) — fan out templates × assignees into real
// interview assignments by REUSING the canonical interview assignment service
// (server/src/services/InterviewAssignmentService.ts, the same `create` path the
// /interview/assignments endpoint / AssignInterviewModal use). We do NOT
// re-implement assignment logic here — we just orchestrate the cartesian fan-out
// and record the resulting assignment ids on the program config.
// ---------------------------------------------------------------------------

export interface GenerateSurveysResult {
  program: AuditProgram;
  requested: number;
  created: number;
  failed: number;
  /**
   * Per-pair failures, for honest reporting. `message` is a CLIENT-SAFE generic
   * string + `code` is a stable identifier; the real error text is logged
   * server-side only (never returned) to avoid leaking internal schema/driver
   * detail to the client. Shape is preserved for the FE contract.
   */
  errors: Array<{ templateId: string; assigneeId: string; message: string; code: string }>;
  /** True when nothing was generated because it was already done. */
  alreadyGenerated: boolean;
}

/** Default due date for generated assignments when none is configured: +14 days. */
function defaultDueAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString();
}

export async function generateSurveys(
  organizationId: string,
  userId: string,
  id: string
): Promise<GenerateSurveysResult | null> {
  await ensureSchema();
  const program = await getProgram(organizationId, id);
  if (!program) return null;

  const templateIds = (program.config.templateIds || [])
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  const rawAssigneeIds = (program.config.assigneeIds || [])
    .map((a) => String(a || '').trim())
    .filter(Boolean);

  // SEC-3: validate assignees are active members of this org before fan-out
  // to prevent cross-org injection via PATCH config.assigneeIds=[<foreign user>].
  const validatedRows = rawAssigneeIds.length
    ? await dbAll<{ user_id: string }>(
        `SELECT user_id FROM organization_members WHERE organization_id = ? AND user_id IN (${rawAssigneeIds.map(() => '?').join(',')}) AND LOWER(status) = 'active'`,
        [organizationId, ...rawAssigneeIds],
        { fallback: true }
      )
    : [];
  const assigneeIds = validatedRows.map((r) => r.user_id);

  // SEC-3 (templates): mirror the assignee guard — validate every templateId is
  // accessible to THIS org (own-org or system/global) before fan-out, else a crafted
  // PATCH config.templateIds=[<foreign-org template>] would create assignments
  // referencing another org's interview template. Foreign org/private templates are
  // silently dropped (not faned out).
  const validatedTemplateRows = templateIds.length
    ? await dbAll<{ id: string }>(
        `SELECT id FROM interview_library_templates WHERE id IN (${templateIds
          .map(() => '?')
          .join(
            ','
          )}) AND (organization_id = ? OR organization_id IS NULL OR template_scope = 'system')`,
        [...templateIds, organizationId],
        { fallback: true }
      )
    : [];
  const validatedTemplateIds = validatedTemplateRows.map((r) => r.id);

  // Idempotency: don't re-fan-out a program that already generated surveys.
  if (program.config.surveysGenerated === true) {
    return {
      program,
      requested: 0,
      created: 0,
      failed: 0,
      errors: [],
      alreadyGenerated: true,
    };
  }

  const errors: GenerateSurveysResult['errors'] = [];
  const createdAssignmentIds: string[] = [];
  const dueAt = (program.config.dueAt as string) || defaultDueAt();
  let requested = 0;

  for (const templateId of validatedTemplateIds) {
    for (const assigneeId of assigneeIds) {
      requested += 1;
      try {
        // REUSE the canonical assignment creation path. One assignment per pair
        // (single assignee → non-team assignment). processRef tags the program so
        // the assignments are linkable back even outside config.
        const assignment = await interviewAssignmentService.create({
          organizationId,
          templateId,
          assigneeUserIds: [assigneeId],
          dueAt,
          priority: 'medium',
          createdBy: userId,
          processRef: `audit_program:${program.id}`,
        });
        createdAssignmentIds.push(assignment.id);
      } catch (error) {
        // INFO-DISCLOSURE: never return raw error text (may carry DB-driver /
        // schema detail) to the client. Push a generic, client-safe message +
        // stable code; log the real error server-side only.
        const realMessage = String((error as Error)?.message || error || 'unknown error');
        errors.push({
          templateId,
          assigneeId,
          message: 'Failed to generate survey for this template/assignee',
          code: 'AUDIT_SURVEY_PAIR_FAILED',
        });
        logger.error('[audit-programs] generateSurveys pair failed', {
          programId: program.id,
          templateId,
          assigneeId,
          error: realMessage,
        });
      }
    }
  }

  const created = createdAssignmentIds.length;
  const failed = errors.length;

  // Persist results onto the program config. Mark generated only if at least one
  // assignment landed — otherwise leave it false so the action can be retried.
  const nextConfig: AuditProgramConfig = {
    ...program.config,
    surveysGenerated: created > 0,
    generatedAssignmentIds: createdAssignmentIds,
    generation: {
      requested,
      created,
      failed,
      at: new Date().toISOString(),
    },
  };

  const updated = await updateProgram(organizationId, id, {
    config: nextConfig,
    // Promote a draft to active once surveys exist.
    status: created > 0 && program.status === 'draft' ? 'active' : program.status,
  });

  return {
    program: updated || program,
    requested,
    created,
    failed,
    errors,
    alreadyGenerated: false,
  };
}

// ---------------------------------------------------------------------------
// Completion rollup (#19e) — count how many of the program's generated
// assignments reached a submitted/approved/completed state vs the total
// generated. Queries the interview_assignments table by the stored ids.
// ---------------------------------------------------------------------------

export interface ProgramCompletion {
  /** True once surveys have been generated for the program. */
  generated: boolean;
  /** Total generated assignments tracked for this program. */
  total: number;
  /** Submitted/approved/completed count. */
  done: number;
  /** Integer percentage (0–100); 0 when nothing generated. */
  percent: number;
  /** Coarse status buckets for richer dashboards. */
  byStatus: Record<string, number>;
}

/** Statuses that count as "done" for rollup purposes. */
const DONE_STATUSES = new Set(['submitted', 'approved', 'completed']);

export async function computeCompletion(
  organizationId: string,
  id: string
): Promise<ProgramCompletion | null> {
  await ensureSchema();
  const program = await getProgram(organizationId, id);
  if (!program) return null;

  const ids = (program.config.generatedAssignmentIds || [])
    .map((x) => String(x || '').trim())
    .filter(Boolean);

  if (!program.config.surveysGenerated || ids.length === 0) {
    return { generated: false, total: 0, done: 0, percent: 0, byStatus: {} };
  }

  const placeholders = ids.map(() => '?').join(', ');
  const rows = await dbAll<{ status: string; count: number }>(
    `SELECT status, COUNT(*) AS count
       FROM interview_assignments
       WHERE organization_id = ? AND id IN (${placeholders})
       GROUP BY status`,
    [organizationId, ...ids],
    { fallback: false }
  );

  const byStatus: Record<string, number> = {};
  let totalFound = 0;
  let done = 0;
  for (const row of rows || []) {
    const status = String(row.status || 'unknown');
    const count = Number(row.count || 0);
    byStatus[status] = count;
    totalFound += count;
    if (DONE_STATUSES.has(status)) done += count;
  }

  // Use the recorded id count as the denominator so deleted/missing assignments
  // still count against the total (honest completion, not survivorship-biased).
  const total = ids.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  // Surface any tracked-but-missing assignments so the UI can be honest.
  if (totalFound < total) byStatus.missing = (byStatus.missing || 0) + (total - totalFound);

  return { generated: true, total, done, percent, byStatus };
}

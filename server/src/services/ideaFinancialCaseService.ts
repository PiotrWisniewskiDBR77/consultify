/**
 * Idea FINANCIAL Case Service — Program E / epic E09, stream S6-E09 (RISK-12).
 *
 * SSOT: docs/qa/ideas-complete-transformation-2026-08-09/10_FINANCIAL_CASE_ACCEPTANCE.md
 * §5.7 (the scoped gap) and §5.3 (why this is NOT part of the E08 business
 * case). Mirrors `ideaBusinessCaseService.ts` deliberately — same shape, same
 * org-scoping rule, same "one JSON blob per artifact" persistence — so the two
 * idea-level artifact stores stay diffable against each other.
 *
 * Persistence: `idea_financial_cases`
 * (server/migrations/20260812_idea_financial_case.sql). When that migration
 * has not been applied in a given environment, `getTableColumns` returns empty
 * and the route layer maps that to a clean 503 (`requireTables` in
 * server/src/routes/my-work/_helpers.ts) — never a crash, never a fake success.
 *
 * ── DIFFERENCE FROM E08 THAT MATTERS: REAL OPTIMISTIC CONCURRENCY ──────────
 * `upsertBusinessCase` blindly increments `version` and overwrites. This
 * service does NOT: the caller must send the `version` it loaded, and the
 * UPDATE is a compare-and-swap (`WHERE ... AND version = ?`). A losing writer
 * gets `IdeaFinancialCaseVersionConflictError` carrying the CURRENT row, and
 * the route turns that into a 409 the UI can act on. A financial case is a
 * decision-grade artifact; silently clobbering a colleague's drivers with your
 * own stale copy is exactly the "false success" this program keeps getting
 * burned by.
 *
 * ── ORG SCOPING ────────────────────────────────────────────────────────────
 * Every read and write is filtered by `organization_id`. Creating a case for
 * an idea_id that already carries one under a DIFFERENT organization throws
 * `IdeaFinancialCaseForeignOrgError` instead of silently taking the UPDATE
 * branch against another tenant's row (same RES-011 rule as
 * evidenceEnvelopeService / ideaBusinessCaseService).
 */
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import logger from '../utils/Logger.js';

export class IdeaFinancialCaseForeignOrgError extends Error {
  constructor(ideaId: string) {
    super(`Financial case for idea ${ideaId} belongs to a different organization`);
    this.name = 'IdeaFinancialCaseForeignOrgError';
  }
}

export class IdeaFinancialCaseVersionConflictError extends Error {
  readonly current: IdeaFinancialCaseRow;
  readonly expectedVersion: number;
  constructor(current: IdeaFinancialCaseRow, expectedVersion: number) {
    super(
      `Financial case for idea ${current.ideaId} moved on (stored version ${current.version}, client sent ${expectedVersion})`
    );
    this.name = 'IdeaFinancialCaseVersionConflictError';
    this.current = current;
    this.expectedVersion = expectedVersion;
  }
}

/**
 * The envelope persisted in `case_json`. Mirrored 1:1 client-side by
 * `IdeaFinancialCasePayload` in src/services/api/ideaFinancialCase.api.ts —
 * keep both in sync by hand, there is no codegen here.
 *
 *   input          — `FinancialCaseInput` (caseMeta + drivers)
 *   result         — last `FinancialCaseResult` snapshot, or null when the
 *                    case was saved while empty/stale (never fabricated)
 *   lastComputedAt — ISO timestamp of that snapshot, or null
 */
export interface IdeaFinancialCasePayload {
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  lastComputedAt: string | null;
}

export interface IdeaFinancialCaseRow {
  id: string;
  ideaId: string;
  organizationId: string;
  payload: IdeaFinancialCasePayload;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertIdeaFinancialCaseInput {
  ideaId: string;
  organizationId: string;
  payload: IdeaFinancialCasePayload;
  /**
   * The version the client loaded. Required whenever a row already exists.
   * `undefined` means "I believe there is no row yet" — if one does exist,
   * that is itself a conflict (someone created it while this client had the
   * dialog open), reported as a 409 the same way.
   */
  expectedVersion?: number;
  updatedBy?: string | null;
}

function parsePayload(raw: unknown): IdeaFinancialCasePayload {
  const empty: IdeaFinancialCasePayload = { input: {}, result: null, lastComputedAt: null };
  let obj: Record<string, unknown>;
  if (raw === null || raw === undefined) return empty;
  if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  } else if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return empty;
    }
  } else {
    return empty;
  }
  if (!obj || typeof obj !== 'object') return empty;
  return {
    input: (obj.input as Record<string, unknown>) ?? {},
    result: (obj.result as Record<string, unknown> | null) ?? null,
    lastComputedAt: typeof obj.lastComputedAt === 'string' ? obj.lastComputedAt : null,
  };
}

function rowToFinancialCase(row: any): IdeaFinancialCaseRow {
  return {
    id: row.id,
    ideaId: row.idea_id,
    organizationId: row.organization_id,
    payload: parsePayload(row.case_json),
    version: Number(row.version || 1),
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Org-scoped read. `null` = no case yet for this idea (a valid, common state). */
export async function getFinancialCase(
  ideaId: string,
  organizationId: string
): Promise<IdeaFinancialCaseRow | null> {
  const db = await getDatabase();
  const result = await db.query<any>(
    `SELECT * FROM idea_financial_cases WHERE idea_id = ? AND organization_id = ? LIMIT 1`,
    [ideaId, organizationId]
  );
  const row = result.rows?.[0];
  return row ? rowToFinancialCase(row) : null;
}

async function existsForAnyOrg(ideaId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.query<{ id: string }>(
    `SELECT id FROM idea_financial_cases WHERE idea_id = ? LIMIT 1`,
    [ideaId]
  );
  return Boolean(result.rows?.[0]);
}

/**
 * Whole-case PUT (not per-driver patch). Granularity decision, recorded here
 * because §5.7 point 4 asked for one: the driver set, the case meta and the
 * result snapshot are ONE consistent unit — a per-driver PATCH would let the
 * stored `result` describe a driver set that no longer exists, which is the
 * "numbers that don't mean what they say" failure this epic's stale/fresh
 * state machine exists to prevent. So the client sends the whole envelope,
 * and OCC (below) is what makes that safe under concurrent editors.
 */
export async function upsertFinancialCase(
  input: UpsertIdeaFinancialCaseInput
): Promise<IdeaFinancialCaseRow> {
  const existing = await getFinancialCase(input.ideaId, input.organizationId);
  const now = new Date().toISOString();
  const serialized = JSON.stringify({
    input: input.payload.input ?? {},
    result: input.payload.result ?? null,
    lastComputedAt: input.payload.lastComputedAt ?? null,
  });

  if (existing) {
    if (input.expectedVersion === undefined || input.expectedVersion !== existing.version) {
      throw new IdeaFinancialCaseVersionConflictError(existing, input.expectedVersion ?? -1);
    }
    const db = await getDatabase();
    const nextVersion = existing.version + 1;
    // Compare-and-swap: the `AND version = ?` predicate is the real guard.
    // The check above is the fast/nice path; this is what survives two writers
    // racing between the SELECT and the UPDATE.
    const runResult = await db.run(
      `UPDATE idea_financial_cases
       SET case_json = ?, version = ?, updated_by = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND version = ?`,
      [
        serialized,
        nextVersion,
        input.updatedBy ?? existing.updatedBy ?? null,
        now,
        existing.id,
        input.organizationId,
        input.expectedVersion,
      ]
    );
    if (!runResult || Number(runResult.changes) < 1) {
      const current = await getFinancialCase(input.ideaId, input.organizationId);
      throw new IdeaFinancialCaseVersionConflictError(
        current ?? existing,
        input.expectedVersion
      );
    }
    logger.info(
      `[IdeaFinancialCase] Updated financial case ${existing.id} (idea ${input.ideaId}) v${existing.version} -> v${nextVersion}`
    );
    const updated = await getFinancialCase(input.ideaId, input.organizationId);
    return updated as IdeaFinancialCaseRow;
  }

  if (await existsForAnyOrg(input.ideaId)) {
    throw new IdeaFinancialCaseForeignOrgError(input.ideaId);
  }

  const db = await getDatabase();
  const id = uuidv4();
  await db.run(
    `INSERT INTO idea_financial_cases (
      id, idea_id, organization_id, case_json, version, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.ideaId,
      input.organizationId,
      serialized,
      1,
      input.updatedBy ?? null,
      input.updatedBy ?? null,
      now,
      now,
    ]
  );
  logger.info(`[IdeaFinancialCase] Created financial case ${id} (idea ${input.ideaId})`);
  const created = await getFinancialCase(input.ideaId, input.organizationId);
  return created as IdeaFinancialCaseRow;
}

export default {
  getFinancialCase,
  upsertFinancialCase,
};

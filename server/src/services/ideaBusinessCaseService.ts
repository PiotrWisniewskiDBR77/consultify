/**
 * Idea Business Case Service — Program D / epic E08.
 *
 * SSOT: docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md
 * §6.2 + 11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md epic E08.
 * Shared shape: src/types/ideaBusinessCase.ts (client mirrors this server
 * output 1:1 — keep both in sync by hand, no codegen here).
 *
 * Persistence: `idea_business_cases` (server/migrations/20260810_idea_business_case.sql)
 * — ★ NOT YET APPLIED to any database. `getTableColumns` returning empty is
 * therefore the expected steady state until the orchestrator runs that
 * migration; the route layer maps that to a 503 (see `requireTables` in
 * `server/src/routes/my-work/_helpers.ts`), never a crash or a silent fake
 * success.
 *
 * One business case per idea (`idea_id` is unique). `sections_json` stores
 * the whole `IdeaBusinessCaseSections` object — same "one JSON blob per
 * artifact" pattern as `my_idea_maps.nodes_json` and
 * `evidenceEnvelopeService.ts`'s JSON columns.
 *
 * Org scoping mirrors evidenceEnvelopeService's RES-011 fix: a row's
 * `organization_id` is checked on every read/write, and creating a case for
 * an idea_id that already has one under a DIFFERENT organization is rejected
 * (`IdeaBusinessCaseForeignOrgError`) rather than silently taking the UPDATE
 * branch against another tenant's row.
 */
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import logger from '../utils/Logger.js';

export class IdeaBusinessCaseForeignOrgError extends Error {
  constructor(ideaId: string) {
    super(`Business case for idea ${ideaId} belongs to a different organization`);
    this.name = 'IdeaBusinessCaseForeignOrgError';
  }
}

export interface IdeaBusinessCaseRow {
  id: string;
  ideaId: string;
  organizationId: string;
  sections: Record<string, unknown>;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertIdeaBusinessCaseInput {
  ideaId: string;
  organizationId: string;
  /** Full or partial section map — merged shallowly (per top-level section key) over the existing row. */
  sections: Record<string, unknown>;
  updatedBy?: string | null;
}

function parseSections(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

function rowToBusinessCase(row: any): IdeaBusinessCaseRow {
  return {
    id: row.id,
    ideaId: row.idea_id,
    organizationId: row.organization_id,
    sections: parseSections(row.sections_json),
    version: Number(row.version || 1),
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Org-scoped read. `null` = no case yet for this idea (a valid, common state — not an error). */
export async function getBusinessCase(
  ideaId: string,
  organizationId: string
): Promise<IdeaBusinessCaseRow | null> {
  const db = await getDatabase();
  const result = await db.query<any>(
    `SELECT * FROM idea_business_cases WHERE idea_id = ? AND organization_id = ? LIMIT 1`,
    [ideaId, organizationId]
  );
  const row = result.rows?.[0];
  return row ? rowToBusinessCase(row) : null;
}

async function existsForAnyOrg(ideaId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.query<{ id: string }>(
    `SELECT id FROM idea_business_cases WHERE idea_id = ? LIMIT 1`,
    [ideaId]
  );
  return Boolean(result.rows?.[0]);
}

/**
 * Shallow-merges `input.sections` (per top-level section key — problemBaseline,
 * kpis, ...) over the existing row's sections, so callers can PUT one edited
 * section without re-sending all fourteen. Section keys omitted from `input`
 * are left untouched; a key present in `input` REPLACES that section wholesale
 * (caller owns the full section shape, same "PUT replaces what you send"
 * contract as evidenceEnvelopeService.upsertEnvelope).
 */
export async function upsertBusinessCase(
  input: UpsertIdeaBusinessCaseInput
): Promise<IdeaBusinessCaseRow> {
  const existing = await getBusinessCase(input.ideaId, input.organizationId);
  const now = new Date().toISOString();
  const mergedSections = { ...(existing?.sections ?? {}), ...input.sections };

  if (existing) {
    const db = await getDatabase();
    await db.run(
      `UPDATE idea_business_cases
       SET sections_json = ?, version = ?, updated_by = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        JSON.stringify(mergedSections),
        existing.version + 1,
        input.updatedBy ?? existing.updatedBy ?? null,
        now,
        existing.id,
        input.organizationId,
      ]
    );
    logger.info(
      `[IdeaBusinessCase] Updated business case ${existing.id} (idea ${input.ideaId})`
    );
    const updated = await getBusinessCase(input.ideaId, input.organizationId);
    return updated as IdeaBusinessCaseRow;
  }

  if (await existsForAnyOrg(input.ideaId)) {
    throw new IdeaBusinessCaseForeignOrgError(input.ideaId);
  }

  const db = await getDatabase();
  const id = uuidv4();
  await db.run(
    `INSERT INTO idea_business_cases (
      id, idea_id, organization_id, sections_json, version, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.ideaId,
      input.organizationId,
      JSON.stringify(mergedSections),
      1,
      input.updatedBy ?? null,
      input.updatedBy ?? null,
      now,
      now,
    ]
  );
  logger.info(`[IdeaBusinessCase] Created business case ${id} (idea ${input.ideaId})`);
  const created = await getBusinessCase(input.ideaId, input.organizationId);
  return created as IdeaBusinessCaseRow;
}

export default {
  getBusinessCase,
  upsertBusinessCase,
};

/**
 * helpers — shared fixtures for AUD-MVP-AI-HANDOFF-001 / AUD-MVP-LIFECYCLE-001
 * closure evidence (tests/auditProgramHandoff/**), run against REAL Postgres.
 *
 * NOT a `.test.ts` file on purpose — it must not be collected as its own
 * suite by `vitest.auditProgramHandoff.config.ts`.
 *
 * These tests exercise `registerAsInitiative`, which goes through the
 * canonical `initiatives` creation funnel. `initiatives.organization_id` has
 * a REAL foreign key to `organizations(id)` (see
 * server/src/services/audits/__tests__/proposalService.test.ts, which the
 * same requirement was learned from) — a fabricated org id makes the
 * canonical creator fail with an FK violation, a different scenario than the
 * one these tests are proving. Every fixture here therefore inserts a real
 * `organizations` row and cleans it up afterwards, together with any
 * `initiatives` / `projects` rows the canonical funnel may have created
 * (REQUIRE_INITIATIVE_PROJECT auto-anchors a system "Portfel" project when
 * none is supplied).
 */
import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

export const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  String(process.env.DATABASE_URL || '').startsWith('postgres');

export function requireRealPg(): void {
  if (!REAL_PG) {
    throw new Error(
      'tests/auditProgramHandoff/** requires REAL Postgres: run with ' +
        'DATABASE_URL=postgresql://... DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false ' +
        '(never NODE_ENV=test alone — that substitutes a mock DB and the evidence would be worthless)',
    );
  }
}

export function uid(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export interface Actor {
  organizationId: string;
  userId: string;
  platformRole?: string;
}

export function actorFor(organizationId: string, userId: string, platformRole?: string): Actor {
  return { organizationId, userId, platformRole };
}

/** Inserts a real `organizations` row — required FK target for `initiatives`. */
export async function insertOrganization(pool: Pool, organizationId: string, name?: string): Promise<void> {
  await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
    organizationId,
    name ?? `Test org ${organizationId}`,
  ]);
}

export interface ProgramFixture {
  organizationId: string;
  programId: string;
}

/**
 * Creates a program directly via SQL (bypassing packService/programService
 * pack-driven creation — proven sufficient by the existing kernel tests:
 * segregationOfDuties.test.ts and proposalService.test.ts both operate this
 * way). Starts in lifecycle_state='fieldwork' (skips planning/preparation —
 * those gates require a criteria snapshot recorded via createProgramFromPack,
 * which this direct-insert path does not produce; entering 'fieldwork' by
 * direct insert sidesteps that gate exactly like the existing kernel tests
 * already do).
 */
export async function makeProgram(
  pool: Pool,
  organizationId: string,
  createdBy: string,
  name = 'Program testowy — closure evidence',
): Promise<string> {
  const programId = uid('prog');
  await pool.query(
    `INSERT INTO audit_programs (id, organization_id, name, status, created_by, lifecycle_state)
     VALUES ($1,$2,$3,'active',$4,'fieldwork')`,
    [programId, organizationId, name, createdBy],
  );
  return programId;
}

export async function addMember(
  pool: Pool,
  organizationId: string,
  programId: string,
  userId: string,
  role: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_program_members (id, program_id, organization_id, user_id, member_role, independence_declared)
     VALUES ($1,$2,$3,$4,$5, TRUE)
     ON CONFLICT (program_id, user_id, member_role) DO NOTHING`,
    [uid('apm'), programId, organizationId, userId, role],
  );
}

export async function insertCriterion(
  pool: Pool,
  organizationId: string,
  programId: string,
  opts: { refCode?: string; title?: string; requirementText?: string } = {},
): Promise<string> {
  const criterionId = uid('crit');
  await pool.query(
    `INSERT INTO audit_program_criteria (id, program_id, organization_id, ordinal, ref_code, title, requirement_text)
     VALUES ($1,$2,$3,1,$4,$5,$6)`,
    [
      criterionId,
      programId,
      organizationId,
      opts.refCode ?? 'A.1',
      opts.title ?? 'Kryterium testowe — closure evidence',
      opts.requirementText ?? 'Wymaganie testowe — closure evidence',
    ],
  );
  return criterionId;
}

export async function insertEvidence(
  pool: Pool,
  organizationId: string,
  programId: string,
  criterionId: string,
  title = 'Dowód testowy — closure evidence',
): Promise<string> {
  const evidenceId = uid('ev');
  await pool.query(
    `INSERT INTO audit_evidence (id, program_id, organization_id, criterion_id, evidence_kind, title)
     VALUES ($1,$2,$3,$4,'document',$5)`,
    [evidenceId, programId, organizationId, criterionId, title],
  );
  return evidenceId;
}

export async function insertFinding(
  pool: Pool,
  organizationId: string,
  programId: string,
  status: string,
  extra: Partial<Record<string, unknown>> = {},
): Promise<string> {
  const id = uid('find');
  await pool.query(
    `INSERT INTO audit_program_findings
       (id, program_id, organization_id, statement, classification, severity, status,
        root_cause, root_cause_confirmed, criterion_id)
     VALUES ($1,$2,$3,$4,'nonconforming',$5,$6,$7,$8,$9)`,
    [
      id,
      programId,
      organizationId,
      (extra.statement as string) ?? `Ustalenie ${id}`,
      (extra.severity as string) ?? 'medium',
      status,
      (extra.rootCause as string) ?? null,
      (extra.rootCauseConfirmed as boolean) ?? false,
      (extra.criterionId as string) ?? null,
    ],
  );
  return id;
}

/** Full teardown for a fixture built with the helpers above. */
export async function cleanupOrg(pool: Pool, organizationId: string): Promise<void> {
  const initiativeRows = await pool.query<{ id: string }>(
    `SELECT id FROM initiatives WHERE organization_id = $1`,
    [organizationId],
  );
  if (initiativeRows.rows.length > 0) {
    await pool.query(
      `DELETE FROM initiatives WHERE id = ANY($1)`,
      [initiativeRows.rows.map((r) => r.id)],
    );
  }
  for (const table of [
    'audit_ai_proposals',
    'audit_initiative_proposals',
    'audit_verifications',
    'audit_corrective_actions',
    'audit_management_responses',
    'audit_program_findings',
    'audit_evidence',
    'audit_evidence_requests',
    'audit_program_criteria',
    'audit_program_members',
    'audit_programs',
    'audit_packs',
  ]) {
    await pool.query(`DELETE FROM ${table} WHERE organization_id = $1`, [organizationId]);
  }
  await pool.query(`DELETE FROM projects WHERE organization_id = $1`, [organizationId]);
  await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
}

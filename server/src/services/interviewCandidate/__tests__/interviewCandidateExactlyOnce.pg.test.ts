/**
 * INT-BVP-001 — real-PostgreSQL proof that path A (gated handoff,
 * `interviewCandidateHandoff.ts`) and path B (unconditioned scan,
 * `initiativeCandidateService.ts#scanForCandidates`) can never both mint an
 * `initiative_candidates` row for the same underlying interview insight,
 * once migration `20260910_claude_a_interview_candidate_exactly_once.sql`
 * is applied.
 *
 * Follows the same env-var contract `initiativeCapabilityMatrix.pg.test.ts`
 * / the FIN-005 packet established specifically to avoid the
 * `NODE_ENV=test` "silently mocks the DB" trap: this whole suite SKIPS (not
 * silently passes) unless RUN_DB_TESTS=1, MOCK_DB=false and DATABASE_URL
 * points at a real postgres:// host.
 *
 * HOW TO RUN (from the repo root)
 * --------------------------------
 *   DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:34918/consultinity \
 *   DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run server/src/services/interviewCandidate/__tests__/interviewCandidateExactlyOnce.pg.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Root vitest.config.ts forces `DB_TYPE: 'sqlite'` (and `NODE_ENV: 'test'`)
// via `test.env` for every suite — this wins over whatever the shell
// exported, so it must be corrected back to 'postgres' at module top,
// before anything imports queryHelpers/PostgresDatabase (same trap
// initiativeCapabilityMatrix.pg.test.ts documents and works around).
process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('INT-BVP-001 — interview candidate exactly-once (real PostgreSQL)', () => {
  let Client: typeof import('pg').Client;
  let handoff: typeof import('../../interview/interviewCandidateHandoff.js');
  let candidateService: typeof import('../../initiative/initiativeCandidateService.js');

  const PREFIX = `intbvp001-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const ORG_A = `${PREFIX}-org-a`;
  const ORG_B = `${PREFIX}-org-b`;
  const ACTOR = `${PREFIX}-actor`;

  const insightIds: string[] = [];
  const findingIds: string[] = [];

  async function db(): Promise<InstanceType<typeof Client>> {
    const c = new Client({ connectionString: CONNECTION_STRING });
    await c.connect();
    return c;
  }

  async function insertOrg(id: string): Promise<void> {
    const c = await db();
    try {
      await c.query(
        `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [id, id]
      );
    } finally {
      await c.end();
    }
  }

  async function insertInsight(orgId: string, insightId: string, title: string): Promise<void> {
    insightIds.push(insightId);
    const c = await db();
    try {
      await c.query(
        `INSERT INTO interview_insights (id, organization_id, title, status, content, created_by)
         VALUES ($1, $2, $3, 'completed', 'test content', $4)`,
        [insightId, orgId, title, ACTOR]
      );
    } finally {
      await c.end();
    }
  }

  async function insertFinding(
    orgId: string,
    findingId: string,
    insightId: string,
    opts: { reviewStatus: string; readbackStatus: string; statement?: string }
  ): Promise<void> {
    findingIds.push(findingId);
    const c = await db();
    try {
      await c.query(
        `INSERT INTO interview_insight_findings
           (id, organization_id, insight_id, source_key, finding_statement, limits_text,
            next_action_text, review_status, readback_status, created_by)
         VALUES ($1, $2, $3, $4, $5, '', '', $6, $7, $8)`,
        [
          findingId,
          orgId,
          insightId,
          `key-${findingId}`,
          opts.statement ?? `Finding statement for ${findingId}`,
          opts.reviewStatus,
          opts.readbackStatus,
          ACTOR,
        ]
      );
    } finally {
      await c.end();
    }
  }

  async function candidateCountForInsight(orgId: string, insightId: string): Promise<number> {
    const c = await db();
    try {
      const result = await c.query(
        `SELECT count(*)::int AS n FROM initiative_candidates
         WHERE organization_id = $1 AND source_id = $2
           AND source_type IN ('interview_insight', 'interview_insight_finding')
           AND status <> 'dismissed'`,
        [orgId, insightId]
      );
      return result.rows[0]?.n ?? 0;
    } finally {
      await c.end();
    }
  }

  beforeAll(async () => {
    ({ Client } = await import('pg'));
    handoff = await import('../../interview/interviewCandidateHandoff.js');
    candidateService = await import('../../initiative/initiativeCandidateService.js');

    // Apply this lane's migration directly (idempotent — CREATE UNIQUE INDEX
    // IF NOT EXISTS) so this suite is self-sufficient even if the shared
    // migration runner has not yet applied it against this database.
    const fs = await import('node:fs/promises');
    const migrationSql = await fs.readFile(
      'server/migrations/20260910_claude_a_interview_candidate_exactly_once.sql',
      'utf8'
    );
    const c = await db();
    try {
      await c.query(migrationSql);
    } finally {
      await c.end();
    }

    await insertOrg(ORG_A);
    await insertOrg(ORG_B);
  }, 60_000);

  afterAll(async () => {
    handoff.setInterviewCandidateHandoffFaultInjectorForTests(null);
    const c = await db();
    try {
      await c.query(`DELETE FROM interview_candidate_handoffs WHERE organization_id IN ($1, $2)`, [
        ORG_A,
        ORG_B,
      ]);
      await c.query(`DELETE FROM initiative_candidates WHERE organization_id IN ($1, $2)`, [
        ORG_A,
        ORG_B,
      ]);
      if (findingIds.length) {
        await c.query(`DELETE FROM interview_insight_findings WHERE id = ANY($1::text[])`, [
          findingIds,
        ]);
      }
      if (insightIds.length) {
        await c.query(`DELETE FROM interview_insights WHERE id = ANY($1::text[])`, [insightIds]);
      }
      await c.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [ORG_A, ORG_B]);
    } finally {
      await c.end();
    }
  }, 60_000);

  it('headline: path A then path B for the same insight ⇒ exactly one candidate', async () => {
    const insightId = `${PREFIX}-insight-1`;
    const findingId = `${PREFIX}-finding-1`;
    await insertInsight(ORG_A, insightId, 'Insight 1');
    await insertFinding(ORG_A, findingId, insightId, {
      reviewStatus: 'published',
      readbackStatus: 'confirmed_by_client',
    });

    const approved = await handoff.approveInterviewCandidateHandoff({
      organizationId: ORG_A,
      actorId: ACTOR,
      source: { kind: 'insight_finding', findingId },
    });
    expect(approved.created).toBe(true);

    const scanned = await candidateService.scanForCandidates(undefined, ORG_A, {
      createdBy: ACTOR,
    });
    // Path B's own INSERT hit the unique index and its try/catch swallowed
    // the error (fail-soft) — it must not have produced a second row for
    // this insight.
    expect(scanned.some((row) => row.sourceId === insightId)).toBe(false);

    expect(await candidateCountForInsight(ORG_A, insightId)).toBe(1);
  });

  it('reverse order: path B then path A for the same insight ⇒ still exactly one', async () => {
    const insightId = `${PREFIX}-insight-2`;
    const findingId = `${PREFIX}-finding-2`;
    await insertInsight(ORG_A, insightId, 'Insight 2');
    await insertFinding(ORG_A, findingId, insightId, {
      reviewStatus: 'published',
      readbackStatus: 'confirmed_by_client',
    });

    const scanned = await candidateService.scanForCandidates(undefined, ORG_A, {
      createdBy: ACTOR,
    });
    expect(scanned.some((row) => row.sourceId === insightId)).toBe(true);

    const approved = await handoff.approveInterviewCandidateHandoff({
      organizationId: ORG_A,
      actorId: ACTOR,
      source: { kind: 'insight_finding', findingId },
    });
    // Resolved to the winning (path-B) candidate instead of creating a
    // second one — order must not matter.
    expect(approved.created).toBe(false);

    expect(await candidateCountForInsight(ORG_A, insightId)).toBe(1);
  });

  it('concurrency: both paths racing for the same insight ⇒ exactly one, no unhandled exception', async () => {
    const insightId = `${PREFIX}-insight-3`;
    const findingId = `${PREFIX}-finding-3`;
    await insertInsight(ORG_A, insightId, 'Insight 3');
    await insertFinding(ORG_A, findingId, insightId, {
      reviewStatus: 'published',
      readbackStatus: 'confirmed_by_client',
    });

    const results = await Promise.all([
      handoff.approveInterviewCandidateHandoff({
        organizationId: ORG_A,
        actorId: ACTOR,
        source: { kind: 'insight_finding', findingId },
      }),
      candidateService.scanForCandidates(undefined, ORG_A, { createdBy: ACTOR }),
    ]);
    // Neither call threw (Promise.all would have rejected otherwise).
    expect(results).toHaveLength(2);

    expect(await candidateCountForInsight(ORG_A, insightId)).toBe(1);
  });

  it('positive control: a single eligible handoff still succeeds and creates exactly one candidate', async () => {
    const insightId = `${PREFIX}-insight-4`;
    const findingId = `${PREFIX}-finding-4`;
    await insertInsight(ORG_A, insightId, 'Insight 4');
    await insertFinding(ORG_A, findingId, insightId, {
      reviewStatus: 'published',
      readbackStatus: 'confirmed_by_client',
    });

    const approved = await handoff.approveInterviewCandidateHandoff({
      organizationId: ORG_A,
      actorId: ACTOR,
      source: { kind: 'insight_finding', findingId },
    });
    expect(approved.created).toBe(true);
    expect(approved.candidate.status).toBe('pending');
    expect(await candidateCountForInsight(ORG_A, insightId)).toBe(1);
  });

  it('positive control 2: two different insights each still get their own candidate', async () => {
    const insightId5 = `${PREFIX}-insight-5`;
    const findingId5 = `${PREFIX}-finding-5`;
    const insightId6 = `${PREFIX}-insight-6`;
    const findingId6 = `${PREFIX}-finding-6`;
    await insertInsight(ORG_A, insightId5, 'Insight 5');
    await insertFinding(ORG_A, findingId5, insightId5, {
      reviewStatus: 'published',
      readbackStatus: 'confirmed_by_client',
    });
    await insertInsight(ORG_A, insightId6, 'Insight 6');
    await insertFinding(ORG_A, findingId6, insightId6, {
      reviewStatus: 'published',
      readbackStatus: 'confirmed_by_client',
    });

    const approved5 = await handoff.approveInterviewCandidateHandoff({
      organizationId: ORG_A,
      actorId: ACTOR,
      source: { kind: 'insight_finding', findingId: findingId5 },
    });
    const approved6 = await handoff.approveInterviewCandidateHandoff({
      organizationId: ORG_A,
      actorId: ACTOR,
      source: { kind: 'insight_finding', findingId: findingId6 },
    });

    expect(approved5.created).toBe(true);
    expect(approved6.created).toBe(true);
    expect(approved5.candidate.id).not.toBe(approved6.candidate.id);
    expect(await candidateCountForInsight(ORG_A, insightId5)).toBe(1);
    expect(await candidateCountForInsight(ORG_A, insightId6)).toBe(1);
  });

  it('gate negative: an unpublished/unconfirmed finding produces no candidate via path A', async () => {
    const insightId = `${PREFIX}-insight-7`;
    const findingId = `${PREFIX}-finding-7`;
    await insertInsight(ORG_A, insightId, 'Insight 7');
    await insertFinding(ORG_A, findingId, insightId, {
      reviewStatus: 'draft',
      readbackStatus: 'draft_interpretation',
    });

    await expect(
      handoff.approveInterviewCandidateHandoff({
        organizationId: ORG_A,
        actorId: ACTOR,
        source: { kind: 'insight_finding', findingId },
      })
    ).rejects.toMatchObject({ code: 'FINDING_NOT_ACCEPTED', status: 409 });

    const c = await db();
    try {
      const result = await c.query(
        `SELECT count(*)::int AS n FROM initiative_candidates
         WHERE organization_id = $1 AND source_type = 'interview_insight_finding' AND source_id = $2`,
        [ORG_A, insightId]
      );
      expect(result.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }
  });

  it('retry/replay: repeating the handoff returns the same candidate id, no second row, one receipt', async () => {
    const insightId = `${PREFIX}-insight-8`;
    const findingId = `${PREFIX}-finding-8`;
    await insertInsight(ORG_A, insightId, 'Insight 8');
    await insertFinding(ORG_A, findingId, insightId, {
      reviewStatus: 'published',
      readbackStatus: 'confirmed_by_client',
    });

    const first = await handoff.approveInterviewCandidateHandoff({
      organizationId: ORG_A,
      actorId: ACTOR,
      source: { kind: 'insight_finding', findingId },
    });
    const second = await handoff.approveInterviewCandidateHandoff({
      organizationId: ORG_A,
      actorId: ACTOR,
      source: { kind: 'insight_finding', findingId },
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.candidate.id).toBe(first.candidate.id);
    expect(await candidateCountForInsight(ORG_A, insightId)).toBe(1);

    const c = await db();
    try {
      const receipts = await c.query(
        `SELECT count(*)::int AS n FROM interview_candidate_handoffs
         WHERE organization_id = $1 AND source_type = 'interview_insight_finding' AND source_id = $2`,
        [ORG_A, findingId]
      );
      expect(receipts.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  });

  it('tenant negative: org B keeps its own candidate and cannot read org A candidate/handoff', async () => {
    const insightIdA = `${PREFIX}-insight-9a`;
    const findingIdA = `${PREFIX}-finding-9a`;
    const insightIdB = `${PREFIX}-insight-9b`;
    const findingIdB = `${PREFIX}-finding-9b`;
    await insertInsight(ORG_A, insightIdA, 'Insight 9A');
    await insertFinding(ORG_A, findingIdA, insightIdA, {
      reviewStatus: 'published',
      readbackStatus: 'confirmed_by_client',
    });
    await insertInsight(ORG_B, insightIdB, 'Insight 9B');
    await insertFinding(ORG_B, findingIdB, insightIdB, {
      reviewStatus: 'published',
      readbackStatus: 'confirmed_by_client',
    });

    const approvedA = await handoff.approveInterviewCandidateHandoff({
      organizationId: ORG_A,
      actorId: ACTOR,
      source: { kind: 'insight_finding', findingId: findingIdA },
    });
    const approvedB = await handoff.approveInterviewCandidateHandoff({
      organizationId: ORG_B,
      actorId: ACTOR,
      source: { kind: 'insight_finding', findingId: findingIdB },
    });

    expect(approvedA.created).toBe(true);
    expect(approvedB.created).toBe(true);
    expect(approvedA.candidate.id).not.toBe(approvedB.candidate.id);
    expect(await candidateCountForInsight(ORG_A, insightIdA)).toBe(1);
    expect(await candidateCountForInsight(ORG_B, insightIdB)).toBe(1);

    // Org B cannot read org A's handoff/candidate lineage by asking for
    // org A's finding id under its own organizationId.
    const crossTenantRead = await handoff.getInterviewCandidateHandoff({
      organizationId: ORG_B,
      sourceType: 'interview_insight_finding',
      sourceId: findingIdA,
    });
    expect(crossTenantRead).toBeNull();
  });

  it('cold readback: a fresh connection still sees the same candidate and receipt ids', async () => {
    const insightId = `${PREFIX}-insight-10`;
    const findingId = `${PREFIX}-finding-10`;
    await insertInsight(ORG_A, insightId, 'Insight 10');
    await insertFinding(ORG_A, findingId, insightId, {
      reviewStatus: 'published',
      readbackStatus: 'confirmed_by_client',
    });

    const approved = await handoff.approveInterviewCandidateHandoff({
      organizationId: ORG_A,
      actorId: ACTOR,
      source: { kind: 'insight_finding', findingId },
    });

    // "Fresh pool/service instance": a brand-new pg Client, independent of
    // whatever connection/pool the service layer used to write.
    const c = await db();
    try {
      const candidateRow = await c.query(`SELECT id, status FROM initiative_candidates WHERE id = $1`, [
        approved.candidate.id,
      ]);
      expect(candidateRow.rows).toHaveLength(1);
      expect(candidateRow.rows[0].status).toBe('pending');

      const receiptRow = await c.query(
        `SELECT id, candidate_id FROM interview_candidate_handoffs WHERE id = $1`,
        [approved.handoff.id]
      );
      expect(receiptRow.rows).toHaveLength(1);
      expect(receiptRow.rows[0].candidate_id).toBe(approved.candidate.id);
    } finally {
      await c.end();
    }
  });

  it('zero orphans: a failed/rolled-back handoff leaves no partial candidate or receipt row', async () => {
    const insightId = `${PREFIX}-insight-11`;
    const findingId = `${PREFIX}-finding-11`;
    await insertInsight(ORG_A, insightId, 'Insight 11');
    await insertFinding(ORG_A, findingId, insightId, {
      reviewStatus: 'published',
      readbackStatus: 'confirmed_by_client',
    });

    handoff.setInterviewCandidateHandoffFaultInjectorForTests((stage) => {
      if (stage === 'receipt-inserted') throw new Error('int-bvp-001 injected failure');
    });
    try {
      await expect(
        handoff.approveInterviewCandidateHandoff({
          organizationId: ORG_A,
          actorId: ACTOR,
          source: { kind: 'insight_finding', findingId },
        })
      ).rejects.toThrow('int-bvp-001 injected failure');
    } finally {
      handoff.setInterviewCandidateHandoffFaultInjectorForTests(null);
    }

    expect(await candidateCountForInsight(ORG_A, insightId)).toBe(0);
    const c = await db();
    try {
      const receipts = await c.query(
        `SELECT count(*)::int AS n FROM interview_candidate_handoffs
         WHERE organization_id = $1 AND source_type = 'interview_insight_finding' AND source_id = $2`,
        [ORG_A, findingId]
      );
      expect(receipts.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }
  });
});

describe.skipIf(!REAL_PG)('INT-BVP-001 — migration applies safely on pre-existing duplicates', () => {
  let PgClient: typeof import('pg').Client;
  const SCRATCH_DB = 'scratch_dupes';
  let scratchUrl: string;
  const orgId = `intbvp001-scratch-org-${Date.now()}`;
  const sharedInsightId = `intbvp001-scratch-insight-${Date.now()}`;

  beforeAll(async () => {
    ({ Client: PgClient } = await import('pg'));
    const base = new URL(CONNECTION_STRING);
    base.pathname = `/${SCRATCH_DB}`;
    scratchUrl = base.toString();

    // Idempotent create — a prior run may have left the scratch DB behind.
    const admin = new PgClient({ connectionString: CONNECTION_STRING });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== '42P04') throw err; // 42P04 = already exists
    } finally {
      await admin.end();
    }

    const scratch = new PgClient({ connectionString: scratchUrl });
    await scratch.connect();
    try {
      // Minimal shape — only the columns this migration's UPDATE/CREATE
      // INDEX statements actually touch.
      await scratch.query(`
        CREATE TABLE IF NOT EXISTS initiative_candidates (
          id text PRIMARY KEY,
          organization_id text NOT NULL,
          source_type text NOT NULL,
          source_id text,
          title text NOT NULL DEFAULT '',
          status text NOT NULL DEFAULT 'pending',
          initiative_id text,
          accepted_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      // Seed a genuine PRE-EXISTING duplicate pair sharing (org, source_id)
      // across the two interview source_types — exactly the collision a
      // bare `CREATE UNIQUE INDEX` would refuse to build on top of.
      await scratch.query(
        `INSERT INTO initiative_candidates
           (id, organization_id, source_type, source_id, title, status, created_at)
         VALUES
           ($1, $2, 'interview_insight', $3, 'Scan-created dup', 'pending', now() - interval '2 hours'),
           ($4, $2, 'interview_insight_finding', $3, 'Handoff-created dup', 'pending', now() - interval '1 hour')`,
        [`${sharedInsightId}-a`, orgId, sharedInsightId, `${sharedInsightId}-b`]
      );
    } finally {
      await scratch.end();
    }
  }, 60_000);

  afterAll(async () => {
    const admin = new PgClient({ connectionString: CONNECTION_STRING });
    await admin.connect();
    try {
      // Must not be connected to the DB being dropped.
      await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    } catch {
      // Older Postgres without WITH (FORCE) support — best-effort cleanup,
      // not worth failing the suite over.
    } finally {
      await admin.end();
    }
  }, 60_000);

  it('applies without error and leaves exactly one active row for the duplicated key', async () => {
    const fs = await import('node:fs/promises');
    const migrationSql = await fs.readFile(
      'server/migrations/20260910_claude_a_interview_candidate_exactly_once.sql',
      'utf8'
    );

    const scratch = new PgClient({ connectionString: scratchUrl });
    await scratch.connect();
    try {
      await expect(scratch.query(migrationSql)).resolves.toBeDefined();

      const active = await scratch.query(
        `SELECT id, status FROM initiative_candidates
         WHERE organization_id = $1 AND source_id = $2 AND status <> 'dismissed'`,
        [orgId, sharedInsightId]
      );
      expect(active.rows).toHaveLength(1);
      // The earlier-created row (the scan-created dup) is the deterministic
      // survivor per this migration's ORDER BY created_at ASC tie-break.
      expect(active.rows[0].id).toBe(`${sharedInsightId}-a`);

      const dismissed = await scratch.query(
        `SELECT id FROM initiative_candidates WHERE organization_id = $1 AND status = 'dismissed'`,
        [orgId]
      );
      expect(dismissed.rows.map((r) => r.id)).toEqual([`${sharedInsightId}-b`]);

      const indexCheck = await scratch.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'uq_initiative_candidates_interview_insight_once'`
      );
      expect(indexCheck.rows).toHaveLength(1);

      // Re-applying the migration must be a true no-op (idempotent).
      await expect(scratch.query(migrationSql)).resolves.toBeDefined();
      const activeAfterRerun = await scratch.query(
        `SELECT id FROM initiative_candidates
         WHERE organization_id = $1 AND source_id = $2 AND status <> 'dismissed'`,
        [orgId, sharedInsightId]
      );
      expect(activeAfterRerun.rows).toHaveLength(1);
    } finally {
      await scratch.end();
    }
  });
});

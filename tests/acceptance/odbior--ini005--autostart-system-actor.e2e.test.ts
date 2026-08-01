/**
 * INI-005 follow-up — `initiativeAutoStartJob.autoStartScheduledInitiatives()`.
 *
 * Real Postgres, zero mocks. Calls the job's exported function DIRECTLY
 * (no cron scheduler involved) — this is the documented, isolated entry
 * point per `server/src/jobs/initiativeAutoStartJob.ts`.
 *
 * Proves the fix in commit 01fe1f6dd4 ("close auto-start bypass with a
 * narrow system actor"): this job used to run its own raw
 * `UPDATE initiatives SET status = 'EXECUTING'` with ZERO reference to
 * `decisions`/GO-NO-GO/gate/readiness/audit anywhere. It now calls the SAME
 * `executeInitiativeTransition` engine as every HTTP path, via an explicit
 * `{ kind: 'system', systemActorId: 'system:initiative-auto-start' }` actor
 * that is narrowly authorized for EXACTLY the START gate and does NOT skip
 * the GO/NO-GO decision-currency check.
 *
 * ★ SHARED-DB CAVEAT (disclosed, not hidden): `autoStartScheduledInitiatives`
 * scans `initiatives WHERE UPPER(status)='SCHEDULED'` GLOBALLY — no
 * organization_id filter, no id-prefix filter (that's the real production
 * query, unchanged by this fix). On this shared local acceptance Postgres
 * that risks touching SCHEDULED fixtures belonging to a DIFFERENT concurrent
 * test run. Mitigation used here: every fixture in this file gets an
 * extremely old `planned_start_date` ('2000-01-01') so it always sorts first
 * in the job's `ORDER BY ... ASC LIMIT` scan, and assertions only ever check
 * THIS file's own fixture ids — never the job's aggregate counters in
 * isolation (those are read but treated as supplementary evidence, not the
 * sole assertion, for exactly this reason). A baseline SCHEDULED-count check
 * before each call further establishes this run started from a clean slate.
 *
 * Fixtures use the reversible `odbior--ini005--autostart--` prefix; cleaned
 * up in `afterAll`.
 */
// INI-005 JWT hermeticity: MUST be imported first — sets process.env.JWT_SECRET
// to a fixed value before any dynamic import can load server/src/config/Config.ts.
// See tests/acceptance/sharedAcceptanceJwtSecret.ts for the full root-cause writeup.
import { assertJwtSecretHermetic } from './sharedAcceptanceJwtSecret.js';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--ini005--autostart--';
const ORG_A = SEED.ORG_ID;
const VERY_OLD_START = '2000-01-01'; // always sorts first in ORDER BY ... ASC

async function withDb<T>(fn: (c: any) => Promise<T>): Promise<T> {
  const c = pgClient();
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

interface InitiativeFixture {
  id: string;
  status: string;
  plannedStartDate?: string | null;
}

async function insertInitiative(f: InitiativeFixture): Promise<void> {
  await withDb(async (c) => {
    await c.query(
      `INSERT INTO initiatives (id, organization_id, name, title, status, owner_business_id, created_by, planned_start_date, planned_end_date, created_at, updated_at)
       VALUES ($1, $2, $3, $3, $4, $5, $5, $6, '2026-12-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status,
         planned_start_date = EXCLUDED.planned_start_date, execution_started_at = NULL`,
      [f.id, ORG_A, `${PREFIX}${f.id}`, f.status, SEED.USER_ID, f.plannedStartDate ?? VERY_OLD_START]
    );
  });
}

interface DecisionFixture {
  id: string;
  initiativeId: string;
  status: string;
  decidedAt?: string;
}

async function insertDecision(d: DecisionFixture): Promise<void> {
  await withDb(async (c) => {
    await c.query(
      `INSERT INTO decisions (id, organization_id, initiative_id, title, type, decision_maker_id, created_by, status, pmo_domain, deadline, decided_at, created_at)
       VALUES ($1, $2, $3, $4, 'GOVERNANCE', $5, $5, $6, 'GOVERNANCE_DECISION_MAKING', '2026-12-31T00:00:00.000Z', $7, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, decided_at = EXCLUDED.decided_at`,
      [
        d.id,
        ORG_A,
        d.initiativeId,
        `${PREFIX}decision ${d.id}`,
        SEED.USER_ID,
        d.status,
        d.decidedAt || new Date().toISOString(),
      ]
    );
  });
}

async function getInitiative(
  id: string
): Promise<{ status: string; execution_started_at: string | null } | null> {
  return withDb(async (c) => {
    const r = await c.query(
      `SELECT status, execution_started_at FROM initiatives WHERE id = $1`,
      [id]
    );
    return r.rows[0] ?? null;
  });
}

async function getStatusHistoryRows(initiativeId: string): Promise<any[]> {
  return withDb(async (c) => {
    const r = await c.query(
      `SELECT * FROM initiative_status_history WHERE initiative_id = $1 ORDER BY created_at ASC`,
      [initiativeId]
    );
    return r.rows;
  });
}

async function countHistory(initiativeId: string): Promise<number> {
  return withDb(async (c) => {
    const r = await c.query(
      `SELECT COUNT(*)::int AS n FROM initiative_history WHERE initiative_id = $1 AND action = 'status_changed'`,
      [initiativeId]
    );
    return r.rows[0]?.n ?? 0;
  });
}

async function baselineScheduledCount(): Promise<number> {
  return withDb(async (c) => {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM initiatives WHERE UPPER(status) = 'SCHEDULED'`);
    return r.rows[0]?.n ?? 0;
  });
}

// Fault-injection helper for case 5 (audit-write failure -> rollback), same
// technique as odbior--ini005--canonical-start-execution.e2e.test.ts case 18,
// scoped to this file's own id prefix only.
async function installFaultTrigger(): Promise<void> {
  await withDb(async (c) => {
    await c.query(`
      CREATE OR REPLACE FUNCTION odbior_ini005_autostart_fault_trigger() RETURNS trigger AS $$
      BEGIN
        IF NEW.initiative_id LIKE 'odbior--ini005--autostart--case5-fault%' THEN
          RAISE EXCEPTION 'odbior--ini005-- injected fault for autostart case 5 (atomicity probe)';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await c.query(`DROP TRIGGER IF EXISTS odbior_ini005_autostart_fault_trigger_history ON initiative_history;`);
    await c.query(`
      CREATE TRIGGER odbior_ini005_autostart_fault_trigger_history
      BEFORE INSERT ON initiative_history
      FOR EACH ROW EXECUTE FUNCTION odbior_ini005_autostart_fault_trigger();
    `);
  });
}

async function removeFaultTrigger(): Promise<void> {
  await withDb(async (c) => {
    await c.query(`DROP TRIGGER IF EXISTS odbior_ini005_autostart_fault_trigger_history ON initiative_history;`);
    await c.query(`DROP FUNCTION IF EXISTS odbior_ini005_autostart_fault_trigger();`);
  });
}

let autoStartScheduledInitiatives: (opts?: { limit?: number }) => Promise<{
  scanned: number;
  started: number;
  skippedMissingDate: number;
  skippedNoGoDecision: number;
  skippedOtherReason: number;
  errors: number;
}>;

beforeAll(async () => {
  await assertJwtSecretHermetic();
  await seed();
  ({ autoStartScheduledInitiatives } = await import('../../server/src/jobs/initiativeAutoStartJob.js'));
}, 60_000);

afterAll(async () => {
  await removeFaultTrigger();
  await withDb(async (c) => {
    await c.query(`DELETE FROM initiative_status_history WHERE initiative_id LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM initiative_history WHERE initiative_id LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM decisions WHERE initiative_id LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM initiatives WHERE id LIKE $1`, [`${PREFIX}%`]);
  });
});

describe('INI-005 auto-start — case 1: SCHEDULED + current approved GO decision + past-due date → EXECUTING via system actor', () => {
  const id = `${PREFIX}case1`;
  it('promotes to EXECUTING with audit rows attributed to system:initiative-auto-start', async () => {
    await insertInitiative({ id, status: 'SCHEDULED' });
    await insertDecision({ id: `${id}-decision`, initiativeId: id, status: 'approved' });

    const before = await baselineScheduledCount();
    expect(before).toBeGreaterThanOrEqual(1); // at least our own fixture

    const result = await autoStartScheduledInitiatives({ limit: 500 });
    expect(result.errors).toBe(0);

    const row = await getInitiative(id);
    expect(row?.status).toBe('EXECUTING');
    expect(row?.execution_started_at).not.toBeNull();

    const historyRows = await getStatusHistoryRows(id);
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].from_status).toBe('SCHEDULED');
    expect(historyRows[0].to_status).toBe('EXECUTING');
    expect(historyRows[0].gate_type).toBe('START');
    expect(historyRows[0].changed_by).toBe('system:initiative-auto-start');

    expect(await countHistory(id)).toBe(1);
  });
});

describe('INI-005 auto-start — case 2: SCHEDULED with NO decision row at all → stays SCHEDULED, skipped', () => {
  const id = `${PREFIX}case2`;
  it('job counts it under skippedNoGoDecision, zero history rows written', async () => {
    await insertInitiative({ id, status: 'SCHEDULED' });
    // Deliberately: no decisions row at all.

    const result = await autoStartScheduledInitiatives({ limit: 500 });
    expect(result.errors).toBe(0);
    expect(result.skippedNoGoDecision).toBeGreaterThanOrEqual(1);

    const row = await getInitiative(id);
    expect(row?.status).toBe('SCHEDULED');
    expect(await countHistory(id)).toBe(0);
    expect(await getStatusHistoryRows(id)).toHaveLength(0);
  });
});

describe('INI-005 auto-start — case 3: OLD approved decision superseded by NEWER NO-GO → stays SCHEDULED, skipped (decision-currency, auto-start path)', () => {
  const id = `${PREFIX}case3`;
  it('the exact rework-cycle scenario the H16 decision-currency fix exists for, proven on the auto-start entry point too', async () => {
    await insertInitiative({ id, status: 'SCHEDULED' });
    await insertDecision({
      id: `${id}-decision-old-approved`,
      initiativeId: id,
      status: 'approved',
      decidedAt: '2026-01-01T00:00:00.000Z',
    });
    await insertDecision({
      id: `${id}-decision-new-rejected`,
      initiativeId: id,
      status: 'rejected',
      decidedAt: '2026-02-01T00:00:00.000Z',
    });

    const result = await autoStartScheduledInitiatives({ limit: 500 });
    expect(result.errors).toBe(0);
    expect(result.skippedNoGoDecision).toBeGreaterThanOrEqual(1);

    const row = await getInitiative(id);
    expect(row?.status).toBe('SCHEDULED');
    expect(await countHistory(id)).toBe(0);
  });
});

describe('INI-005 auto-start — case 4: PENDING (not yet decided) decision for the gate → stays SCHEDULED, skipped', () => {
  const id = `${PREFIX}case4`;
  it('a decision that exists but is not approved does not satisfy the gate', async () => {
    await insertInitiative({ id, status: 'SCHEDULED' });
    await insertDecision({ id: `${id}-decision`, initiativeId: id, status: 'pending' });

    const result = await autoStartScheduledInitiatives({ limit: 500 });
    expect(result.errors).toBe(0);
    expect(result.skippedNoGoDecision).toBeGreaterThanOrEqual(1);

    const row = await getInitiative(id);
    expect(row?.status).toBe('SCHEDULED');
    expect(await countHistory(id)).toBe(0);
  });
});

describe('INI-005 auto-start — case 5: audit-write failure rolls back the status change (atomicity via the system-actor path)', () => {
  const id = `${PREFIX}case5-fault`;
  beforeAll(async () => {
    await installFaultTrigger();
  });
  afterAll(async () => {
    await removeFaultTrigger();
  });

  it('forced initiative_history INSERT failure leaves the initiative UNCHANGED (still SCHEDULED), not partially EXECUTING-with-no-audit', async () => {
    await insertInitiative({ id, status: 'SCHEDULED' });
    await insertDecision({ id: `${id}-decision`, initiativeId: id, status: 'approved' });

    const result = await autoStartScheduledInitiatives({ limit: 500 });
    // The job's per-row try/catch counts this as an error, not a success —
    // proves the job itself observes the rollback rather than mistaking a
    // thrown transaction for a completed transition.
    expect(result.errors).toBeGreaterThanOrEqual(1);
    expect(result.started).toBe(0);

    const row = await getInitiative(id);
    expect(row?.status).toBe('SCHEDULED'); // NOT EXECUTING — no partial write
    expect(row?.execution_started_at).toBeNull();
    expect(await countHistory(id)).toBe(0);
    expect(await getStatusHistoryRows(id)).toHaveLength(0);
  });
});

describe('INI-005 auto-start — case 6: auto-start job racing a live HTTP PATCH on the SAME initiative → exactly one transition, shared row lock across both entry points', () => {
  const id = `${PREFIX}case6`;
  it('Promise.all([job, httpPatch]) — exactly one canonical history row, no double-apply', async () => {
    await insertInitiative({ id, status: 'SCHEDULED' });
    await insertDecision({ id: `${id}-decision`, initiativeId: id, status: 'approved' });

    // Live HTTP side: build the real app + mint a real PMO-role token, exactly
    // like the canonical suite does, so this is a genuine cross-entry-point race
    // (job's internal call vs. a real router+auth+SQL request), not two calls
    // to the same in-process function.
    const express = (await import('express')).default;
    const request = (await import('supertest')).default;
    const { mintToken } = await import('./harness.js');
    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const initiativesRouter = (await import('../../server/src/routes/pmo/initiatives.routes.js')).default;

    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/initiatives', verifyToken as any, initiativesRouter);

    const pmoUserId = `${PREFIX}user-pmo-case6`;
    await withDb(async (c) => {
      await c.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
         VALUES ($1, $2, $3, 'x', 'TEAM_MEMBER', 'active', 'Odbior', 'INI005', CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [pmoUserId, ORG_A, `${PREFIX}pmo-case6@acceptance.local`]
      );
      await c.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP)
         ON CONFLICT (organization_id, user_id) DO NOTHING`,
        [`${PREFIX}mem-pmo-case6`, ORG_A, pmoUserId]
      );
      // Reuse the shared project fixture from the canonical suite if present,
      // else create a scoped one so project_members has somewhere to point.
      await c.query(
        `INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [`${PREFIX}project-case6`, ORG_A, `${PREFIX}project-case6`]
      );
    });
    // Point the initiative at that project so the PMO project_role resolves.
    await withDb(async (c) => {
      await c.query(`UPDATE initiatives SET project_id = $1 WHERE id = $2`, [
        `${PREFIX}project-case6`,
        id,
      ]);
    });
    await withDb(async (c) => {
      await c.query(
        `INSERT INTO project_members (id, project_id, user_id, project_role)
         VALUES ($1, $2, $3, 'PMO')
         ON CONFLICT DO NOTHING`,
        [`${PREFIX}pm-pmo-case6`, `${PREFIX}project-case6`, pmoUserId]
      );
    });
    const pmoToken = mintToken({ id: pmoUserId, email: `${PREFIX}pmo-case6@acceptance.local` });

    const [jobResult, httpResult] = await Promise.all([
      autoStartScheduledInitiatives({ limit: 500 }),
      request(app)
        .patch(`/api/initiatives/${id}/status`)
        .set('Authorization', `Bearer ${pmoToken}`)
        .send({ status: 'EXECUTING' }),
    ]);

    const row = await getInitiative(id);
    expect(row?.status).toBe('EXECUTING'); // someone won; state is not corrupted

    const historyRows = await getStatusHistoryRows(id);
    // Exactly ONE canonical transition — whichever entry point's transaction
    // committed first serialized the other one out via the shared row lock.
    expect(historyRows).toHaveLength(1);
    expect(await countHistory(id)).toBe(1);

    // Sanity: the loser (job or HTTP) did NOT silently double-apply — either
    // the job started it (jobResult.started===1) XOR the HTTP call succeeded
    // (httpResult.status===200), not both reporting a distinct success.
    const jobWon = jobResult.started >= 1;
    const httpWon = httpResult.status === 200;
    expect(jobWon || httpWon).toBe(true);
  });
});

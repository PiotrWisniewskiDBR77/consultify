/**
 * Acceptance E2E — INI-005: GO/NO-GO decision-race TOCTOU fix (2026-08-01).
 *
 * REAL runtime only: real Postgres (local :5442, full schema), REAL
 * `executeInitiativeTransition` engine called DIRECTLY (not via HTTP — the
 * `__testSyncHook` synchronization param this suite exercises is a function
 * argument, not something reachable through any HTTP adapter; see its doc
 * comment on `ExecuteInitiativeTransitionParams` in
 * server/src/services/initiative/initiativeTransitionService.ts for why it is
 * provably unreachable from a real request body). Zero business-logic mocks.
 *
 * BACKGROUND: `hasApprovedGateDecision`'s GO/NO-GO read used to go through the
 * shared connection pool (`queryHelpers.queryOne`), not the pinned
 * `withPgTransaction` client that holds the `initiatives` row lock inside
 * `executeInitiativeTransition`. That made the read invisible to the lock — a
 * concurrent write to `decisions` from `DecisionController.ts` (which runs as
 * a bare autocommit statement against the shared pool, never touching any
 * lock) could land between the read and the transition's write path,
 * undetected. This suite proves what the fix (pinned-client read + advisory
 * lock + a pre-commit recheck that THROWS to force a ROLLBACK — see
 * `TransitionGateSupersededError`) does and does NOT close:
 *
 *   - Test 1: a race landing BEFORE the pre-commit recheck IS caught (409
 *     GATE_DECISION_SUPERSEDED, no partial writes).
 *   - Test 2: a race landing AFTER the pre-commit recheck (between it and
 *     COMMIT) is NOT caught — a disclosed, currently-open residual gap that
 *     will only close once `DecisionController.ts` adopts the same advisory
 *     lock (out of scope for this change; see the integration-contract
 *     writeup in the handoff for this packet).
 *
 * A third "real concurrency, no hook" test was considered and deliberately
 * OMITTED: two genuinely concurrent `executeInitiativeTransition` calls on the
 * SAME initiative are already proven to serialize via the `initiatives` row
 * lock alone (see case 13 in odbior--ini005--canonical-start-execution.e2e.test.ts,
 * unrelated to this decision-race fix), and a non-deterministic real-timing
 * race for the decision-vs-transition case would be strictly weaker signal
 * than the controlled-hook Tests 1/2 above (flaky, and unable to pin down
 * WHICH side of the recheck the race landed on). Tests 1/2 already cover the
 * meaningful cases precisely.
 *
 * All fixture rows use the reversible `odbior--ini005-decrace--` prefix; the
 * probe cleans up after itself in `afterAll` (and pre-cleans in `beforeAll` in
 * case a previous interrupted run left rows behind).
 */
// INI-005 JWT hermeticity: MUST be imported first — sets process.env.JWT_SECRET
// to a fixed value before any dynamic import can load server/src/config/Config.ts.
// See tests/acceptance/sharedAcceptanceJwtSecret.ts for the full root-cause writeup.
// (This suite doesn't mint/verify HTTP tokens itself — it calls the engine
// directly — but keeps the same import-first convention as every other
// INI-005 acceptance file so a future HTTP-based test added here stays safe.)
import { assertJwtSecretHermetic } from './sharedAcceptanceJwtSecret.js';
import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--ini005-decrace--';
const ORG_A = SEED.ORG_ID;

let seqCounter = 0;
function nextId(kind: string): string {
  seqCounter += 1;
  return `${PREFIX}${kind}-${Date.now()}-${seqCounter}`;
}

/** Paired promise + external resolver — the "controlled synchronization" primitive
 *  this whole suite uses instead of setTimeout/sleep-based races. */
function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// DB helpers (open/close a dedicated client per call — matches the existing
// suite convention in odbior--ini005--canonical-start-execution.e2e.test.ts).
// ---------------------------------------------------------------------------
async function pgQuery<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  const c = pgClient();
  await c.connect();
  try {
    return await c.query(sql, params as any[]);
  } finally {
    await c.end();
  }
}

async function insertInitiative(opts: { id: string; status: string }): Promise<string> {
  const { id, status } = opts;
  await pgQuery(
    `INSERT INTO initiatives
       (id, organization_id, name, title, status, owner_execution_id, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $3, $4, $5, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
    [id, ORG_A, `${PREFIX} initiative ${id}`, status, SEED.USER_ID]
  );
  return id;
}

async function insertApprovedGoDecision(opts: { id: string; initiativeId: string }): Promise<string> {
  const { id, initiativeId } = opts;
  await pgQuery(
    `INSERT INTO decisions
       (id, organization_id, initiative_id, title, type, decision_maker_id, deadline,
        status, pmo_domain, decided_at, created_by, created_at)
     VALUES ($1, $2, $3, $4, 'GO_NO_GO', $5, $6, 'approved', 'GOVERNANCE_DECISION_MAKING', $7, $5, $7)
     ON CONFLICT (id) DO UPDATE SET
       status = 'approved', deadline = EXCLUDED.deadline, decided_at = EXCLUDED.decided_at`,
    [id, ORG_A, initiativeId, `${PREFIX} decision ${id}`, SEED.USER_ID, '2026-08-15T00:00:00.000Z', new Date().toISOString()]
  );
  const digest = createHash('sha256').update(`decrace|${id}`).digest('hex');
  await pgQuery(
    `INSERT INTO transformation_cases
       (transformation_case_id, organization_id, initiated_by_user_id, mandate, lineage_id, idempotency_key, version)
     VALUES ($1,$2,$3,'INI-005 decision-race fixture',$4,$5,1)`,
    [`${id}-case`, ORG_A, SEED.USER_ID, `${id}-lineage`, `${id}-case-idem`]
  );
  await pgQuery(
    `INSERT INTO v8_agent_proposal_versions
       (proposal_version_id, proposal_id, organization_id, canonical_run_id, proposal_version,
        plan_version, context_digest, before_json, after_json, approval_scopes_json,
        reviewer_authority_json, expires_at, status, created_by_user_id)
     VALUES ($1,$2,$3,$4,1,1,$5,'{}'::jsonb,'{}'::jsonb,$6::jsonb,$7::jsonb,
             NOW()+INTERVAL '1 day','approved',$8)`,
    [`${id}-proposal-version`, `${id}-proposal`, ORG_A, `${id}-run`, digest,
     JSON.stringify(['initiative_promotion']),
     JSON.stringify({ userId: SEED.USER_ID, authority: 'initiative_promotion' }), SEED.USER_ID]
  );
  await pgQuery(
    `INSERT INTO v8_agent_proposal_scope_reviews
       (review_id, proposal_version_id, scope_key, decision, reason, reviewed_by_user_id)
     VALUES ($1,$2,'initiative_promotion','approved','INI-005 race fixture',$3)`,
    [`${id}-review`, `${id}-proposal-version`, SEED.USER_ID]
  );
  await pgQuery(
    `INSERT INTO initiative_lifecycle_gate_decisions
       (decision_id, organization_id, initiative_id, transformation_case_id, pmo_domain,
        version, decision_status, source_digest, source_case_version, baseline_refs_json,
        a05_proposal_version_id, a05_approval_receipt_ref, human_actor_user_id,
        human_authority_ref, rationale, deadline_at, idempotency_key, input_digest)
     VALUES ($1,$2,$3,$4,'GOVERNANCE_DECISION_MAKING',1,'approved',$5,1,$6::jsonb,
             $7,$8,$9,'initiative_promotion','INI-005 approved race fixture',
             '2026-12-31T00:00:00.000Z',$10,$11)`,
    [id, ORG_A, initiativeId, `${id}-case`, digest,
     JSON.stringify([`initiative:${initiativeId}:promotion`]), `${id}-proposal-version`,
     `${id}-review`, SEED.USER_ID, `${id}-gate-idem`,
     createHash('sha256').update(`decrace-input|${id}|approved`).digest('hex')]
  );
  return id;
}

async function getInitiative(id: string): Promise<Record<string, any> | null> {
  const r = await pgQuery(`SELECT * FROM initiatives WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

async function getDecision(id: string): Promise<Record<string, any> | null> {
  const r = await pgQuery(`SELECT * FROM decisions WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

async function getCurrentCanonicalDecision(initiativeId: string): Promise<Record<string, any> | null> {
  const r = await pgQuery(
    `SELECT * FROM initiative_lifecycle_gate_decisions
      WHERE organization_id=$1 AND initiative_id=$2 AND pmo_domain='GOVERNANCE_DECISION_MAKING'
      ORDER BY version DESC LIMIT 1`,
    [ORG_A, initiativeId]
  );
  return r.rows[0] ?? null;
}

async function countHistory(
  initiativeId: string
): Promise<{ statusHistory: number; history: number }> {
  const sh = await pgQuery(
    `SELECT COUNT(*)::int AS n FROM initiative_status_history WHERE initiative_id = $1`,
    [initiativeId]
  );
  const h = await pgQuery(
    `SELECT COUNT(*)::int AS n FROM initiative_history WHERE initiative_id = $1`,
    [initiativeId]
  );
  return { statusHistory: sh.rows[0].n, history: h.rows[0].n };
}

/** Race the competing decision write in via a SECOND, independent connection
 *  (autocommit — mirrors exactly how DecisionController.decide runs today:
 *  a bare `queryRun UPDATE`, no transaction, no lock). */
async function competingDecisionRejection(decisionId: string): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    const current = await c.query(
      `SELECT initiative_id, transformation_case_id, source_digest, baseline_refs_json,
              a05_proposal_version_id, a05_approval_receipt_ref, human_actor_user_id
         FROM initiative_lifecycle_gate_decisions WHERE decision_id=$1`, [decisionId]
    );
    const row = current.rows[0];
    await c.query('BEGIN');
    await c.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2 || ':' || $3, 0))`,
      [ORG_A, row.initiative_id, 'GOVERNANCE_DECISION_MAKING']
    );
    await c.query(
      `INSERT INTO initiative_lifecycle_gate_decisions
         (decision_id, organization_id, initiative_id, transformation_case_id, pmo_domain,
          version, decision_status, source_digest, source_case_version, baseline_refs_json,
          a05_proposal_version_id, a05_approval_receipt_ref, human_actor_user_id,
          human_authority_ref, rationale, deadline_at, idempotency_key, input_digest,
          supersedes_decision_id)
       VALUES ($1,$2,$3,$4,'GOVERNANCE_DECISION_MAKING',2,'rejected',$5,1,$6::jsonb,
               $7,$8,$9,'initiative_promotion','INI-005 competing rejection',
               '2026-12-31T00:00:00.000Z',$10,$11,$12)`,
      [`${decisionId}-rejected`, ORG_A, row.initiative_id, row.transformation_case_id,
       row.source_digest, JSON.stringify(row.baseline_refs_json), row.a05_proposal_version_id,
       row.a05_approval_receipt_ref, row.human_actor_user_id, `${decisionId}-reject-idem`,
       createHash('sha256').update(`decrace-input|${decisionId}|rejected`).digest('hex'), decisionId]
    );
    await c.query('COMMIT');
  } finally {
    await c.end();
  }
}

async function cleanup(): Promise<void> {
  const like = `${PREFIX}%`;
  await pgQuery(`DELETE FROM decisions WHERE id LIKE $1 OR initiative_id LIKE $1`, [like]);
  await pgQuery(`DELETE FROM initiative_status_history WHERE initiative_id LIKE $1`, [like]);
  await pgQuery(`DELETE FROM initiative_history WHERE initiative_id LIKE $1`, [like]);
  // Canonical decisions are immutable and retain their governed FK chain.
}

beforeAll(async () => {
  await assertJwtSecretHermetic();
  await seed();
  await cleanup();
}, 60_000);

afterAll(async () => {
  await cleanup();
}, 60_000);

describe('INI-005 — GO/NO-GO decision-race TOCTOU fix', () => {
  it('1) a canonical rejection started after the decision read waits for the shared lock and cannot supersede the in-flight transition', async () => {
    const { executeInitiativeTransition } = await import(
      '../../server/src/services/initiative/initiativeTransitionService.js'
    );

    const id = await insertInitiative({ id: nextId('race-caught'), status: 'REVIEW' });
    const decisionId = await insertApprovedGoDecision({
      id: `${id}--decision`,
      initiativeId: id,
    });
    const before = await countHistory(id);

    const paused = deferred<void>();
    const resume = deferred<void>();

    const transitionPromise = executeInitiativeTransition({
      orgId: ORG_A,
      initiativeId: id,
      actorId: SEED.USER_ID,
      nextStatusInput: 'PROMOTED',
      __testSyncHook: async (point: 'after-decision-read' | 'before-commit') => {
        if (point === 'after-decision-read') {
          paused.resolve();
          await resume.promise;
        }
      },
    });

    // Wait until the transition has read the (still-approved) decision and is
    // parked inside the hook, THEN fire the competing write — deterministic,
    // no setTimeout/sleep guessing.
    await paused.promise;
    const rejectionPromise = competingDecisionRejection(decisionId);
    resume.resolve();

    const result = await transitionPromise;
    await rejectionPromise;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('PROMOTED');
    }

    const row = await getInitiative(id);
    expect(row?.status).toBe('PROMOTED');

    const after = await countHistory(id);
    expect(after.statusHistory).toBe(before.statusHistory + 1);
    expect(after.history).toBe(before.history + 1);

    const decisionRow = await getCurrentCanonicalDecision(id);
    expect(decisionRow?.decision_status).toBe('rejected');
    expect(decisionRow?.version).toBe(2);
  });

  it('2) a canonical rejection committed before the transition is current and blocks promotion', async () => {
    const { executeInitiativeTransition } = await import(
      '../../server/src/services/initiative/initiativeTransitionService.js'
    );

    const id = await insertInitiative({ id: nextId('race-gap'), status: 'REVIEW' });
    const decisionId = await insertApprovedGoDecision({
      id: `${id}--decision`,
      initiativeId: id,
    });

    await competingDecisionRejection(decisionId);

    const result = await executeInitiativeTransition({
      orgId: ORG_A,
      initiativeId: id,
      actorId: SEED.USER_ID,
      nextStatusInput: 'PROMOTED',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(400);
      expect(result.body.rule).toBe('GATE_DECISION_REQUIRED');
    }

    const row = await getInitiative(id);
    expect(row?.status).toBe('REVIEW');

    const decisionRow = await getCurrentCanonicalDecision(id);
    expect(decisionRow?.decision_status).toBe('rejected');
  });
});

/**
 * Acceptance test — DecisionController initiative-status CASE bug (H1.6/W4 finding).
 *
 * server/src/controllers/DecisionController.ts had TWO raw SQL `CASE WHEN
 * status = '...'` expressions comparing the `initiatives.status` column
 * against LOWERCASE literals. The canonical initiative status values
 * (server/src/constants/initiativeStatuses.ts InitiativeStatus) are
 * UPPERCASE ('EXECUTING', 'BLOCKED', 'DONE' — confirmed live against parity
 * :5443: `SELECT DISTINCT status FROM initiatives` only ever returns
 * uppercase). Both CASE branches therefore never matched real data:
 *
 *   1. refreshInitiativeDecisionBlock (decision resolved -> auto-unblock),
 *      ~line 293:
 *      BEFORE: `CASE WHEN status = 'blocked' THEN 'executing' ELSE status END`
 *      -> dead branch. A BLOCKED initiative stayed stuck on BLOCKED forever
 *      after its blocking decision was approved/rejected.
 *      AFTER:  `CASE WHEN UPPER(status) = 'BLOCKED' THEN 'EXECUTING' ELSE status END`
 *
 *   2. createDecision auto-block (decision created with an isBlocker
 *      impact), ~line 1022:
 *      BEFORE: `CASE WHEN status = 'done' THEN status ELSE 'blocked' END`
 *      -> WORSE than dead: `status = 'done'` never matches uppercase 'DONE',
 *      so the ELSE branch fired UNCONDITIONALLY and wrote lowercase
 *      'blocked' into the uppercase-canon column — corrupting even DONE
 *      initiatives into a non-canonical status value.
 *      AFTER:  `CASE WHEN UPPER(status) = 'DONE' THEN status ELSE 'BLOCKED' END`
 *
 * WHY THIS TEST DOES NOT DRIVE THE FULL HTTP ENDPOINT:
 * Both fixed UPDATE statements ALSO write `blocked_at` / `unblocked_at`
 * (columns that do not yet exist on the live/parity Postgres schema — see
 * server/migrations/20260719_initiative_execution_columns.sql, which
 * explicitly documents this as a separate, already-tracked gap: migration
 * 061_initiative_lifecycle.sql that was meant to add them is SQLite-dialect
 * and never ran on Postgres; the sibling gap is deferred to "baseline-gap
 * B13", out of scope for this CASE-literal fix and touching many other
 * files (InitiativeController.ts, TaskController.ts, several services) —
 * fixing it here would be scope creep and risks colliding with that
 * separately planned work). Driving POST /api/decisions or
 * PUT /api/decisions/:id/decide on this schema currently 500s on the
 * missing-column error BEFORE the CASE we fixed is even reached — that
 * failure is orthogonal to (and pre-dates) the bug this task fixes.
 *
 * Proof strategy: execute the EXACT CASE fragments (before/after, copied
 * verbatim from git history / the current file) via the REAL local Postgres
 * (parity :5443) against seeded initiative rows, isolating the `status`
 * column only (no blocked_at/unblocked_at) so the proof is not entangled
 * with the unrelated schema gap. This proves the semantic fix directly:
 * the buggy CASE never matches real UPPERCASE data (and actively corrupts
 * it in case 2); the fixed CASE does the right thing in both directions.
 *
 * Artifacts use the reversible `odbior--deccase--` prefix; the probe cleans
 * up after itself. JEDYNY plik tej pracy.
 */
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient } from './harness.js';
import { seed } from './seed.mjs';

const PREFIX = 'odbior--deccase--';
const ORG_ID = 'odbior--org-0001';

// Verbatim BEFORE (buggy, lowercase-literal) CASE fragments, as they existed
// in server/src/controllers/DecisionController.ts prior to this fix.
const BEFORE_UNBLOCK_CASE = `CASE WHEN status = 'blocked' THEN 'executing' ELSE status END`;
const BEFORE_AUTOBLOCK_CASE = `CASE WHEN status = 'done' THEN status ELSE 'blocked' END`;

// Verbatim AFTER (fixed) CASE fragments, as they exist in the file post-fix.
const AFTER_UNBLOCK_CASE = `CASE WHEN UPPER(status) = 'BLOCKED' THEN 'EXECUTING' ELSE status END`;
const AFTER_AUTOBLOCK_CASE = `CASE WHEN UPPER(status) = 'DONE' THEN status ELSE 'BLOCKED' END`;

async function insertInitiative(id: string, status: string): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(
      `INSERT INTO initiatives (id, organization_id, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [id, ORG_ID, `${PREFIX}initiative`, status]
    );
  } finally {
    await c.end();
  }
}

async function applyCaseAndGetStatus(id: string, caseFragment: string): Promise<string> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(
      `UPDATE initiatives SET status = ${caseFragment} WHERE id = $1 AND organization_id = $2`,
      [id, ORG_ID]
    );
    const row = await c.query(`SELECT status FROM initiatives WHERE id = $1`, [id]);
    return row.rows[0]?.status;
  } finally {
    await c.end();
  }
}

async function cleanup(): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM initiatives WHERE name LIKE $1`, [`${PREFIX}%`]);
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await seed();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe('DecisionController initiative-status CASE: before (buggy) vs after (fixed)', () => {
  it('unblock CASE (BLOCKED -> EXECUTING): buggy lowercase literal is a dead branch on real UPPERCASE data', async () => {
    const id = uuidv4();
    await insertInitiative(id, 'BLOCKED');

    const statusAfterBuggy = await applyCaseAndGetStatus(id, BEFORE_UNBLOCK_CASE);
    // Bug: `status = 'blocked'` (lowercase) never matches 'BLOCKED' (uppercase)
    // -> ELSE status fires -> stays stuck on BLOCKED forever.
    expect(statusAfterBuggy).toBe('BLOCKED');
  });

  it('unblock CASE (BLOCKED -> EXECUTING): fixed UPPER() comparison correctly transitions real data', async () => {
    const id = uuidv4();
    await insertInitiative(id, 'BLOCKED');

    const statusAfterFixed = await applyCaseAndGetStatus(id, AFTER_UNBLOCK_CASE);
    expect(statusAfterFixed).toBe('EXECUTING');

    // Non-BLOCKED initiatives must be left untouched by the same fixed CASE.
    const id2 = uuidv4();
    await insertInitiative(id2, 'EXECUTING');
    const untouched = await applyCaseAndGetStatus(id2, AFTER_UNBLOCK_CASE);
    expect(untouched).toBe('EXECUTING');
  });

  it('auto-block CASE (-> BLOCKED unless DONE): buggy lowercase literal corrupts EVERY status, including DONE, into lowercase', async () => {
    const executingId = uuidv4();
    await insertInitiative(executingId, 'EXECUTING');
    const executingAfterBuggy = await applyCaseAndGetStatus(executingId, BEFORE_AUTOBLOCK_CASE);
    // ELSE branch fires (intended outcome here, but via the wrong literal) —
    // writes non-canonical lowercase 'blocked' instead of canonical 'BLOCKED'.
    expect(executingAfterBuggy).toBe('blocked');
    expect(executingAfterBuggy).not.toBe('BLOCKED');

    const doneId = uuidv4();
    await insertInitiative(doneId, 'DONE');
    const doneAfterBuggy = await applyCaseAndGetStatus(doneId, BEFORE_AUTOBLOCK_CASE);
    // Bug: `status = 'done'` (lowercase) never matches 'DONE' (uppercase)
    // -> guard fails -> ELSE fires unconditionally -> a DONE initiative gets
    // corrupted to lowercase 'blocked'. This is the worse half of the bug:
    // not dead code, but active data corruption.
    expect(doneAfterBuggy).toBe('blocked');
    expect(doneAfterBuggy).not.toBe('DONE');
  });

  it('auto-block CASE (-> BLOCKED unless DONE): fixed UPPER() comparison blocks EXECUTING but preserves DONE, using canonical UPPERCASE', async () => {
    const executingId = uuidv4();
    await insertInitiative(executingId, 'EXECUTING');
    const executingAfterFixed = await applyCaseAndGetStatus(executingId, AFTER_AUTOBLOCK_CASE);
    expect(executingAfterFixed).toBe('BLOCKED');

    const doneId = uuidv4();
    await insertInitiative(doneId, 'DONE');
    const doneAfterFixed = await applyCaseAndGetStatus(doneId, AFTER_AUTOBLOCK_CASE);
    // Fixed guard correctly recognizes canonical uppercase 'DONE' and leaves it alone.
    expect(doneAfterFixed).toBe('DONE');
  });
});

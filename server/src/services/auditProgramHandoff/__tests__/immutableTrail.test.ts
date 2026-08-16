/**
 * immutableTrail — AUD-MVP-LIFECYCLE-001 "immutable trail" DoD item 8.
 *
 * `audit_domain_events` is meant to be append-only. This proves it two ways:
 *  1. Direct UPDATE and DELETE statements are rejected by the database-level
 *     append-only trigger, while unrelated normal writes leave prior rows
 *     byte-for-byte unchanged.
 *  2. The idempotency key prevents a duplicate event: the same
 *     (organization_id, program_id, idempotency_key) inserted twice produces
 *     exactly ONE row (`uq_audit_domain_events_idempotency`, defined in
 *     server/migrations/20260813b_audits_source_classification_split.sql:170-172
 *     — read-only reference, not modified by this lane).
 *
 * Run (from repo root):
 *   DATABASE_URL=postgresql://... DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run server/src/services/auditProgramHandoff/__tests__/immutableTrail.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { insertOrganization, makeProgram, REAL_PG, requireRealPg, uid } from './helpers.js';

const describeDb = REAL_PG ? describe : describe.skip;
if (REAL_PG) requireRealPg();

describeDb('audit_domain_events — immutable trail (real Postgres)', () => {
  let pool: InstanceType<typeof import('pg').Pool>;
  let auditsDb: typeof import('../../audits/auditsDb.js');

  const orgId = uid('org-trail');

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    auditsDb = await import('../../audits/auditsDb.js');
    await insertOrganization(pool, orgId);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    // audit_domain_events is intentionally not cleaned up: this suite runs on
    // a disposable database and the production invariant forbids deletion.
    await pool.query(`DELETE FROM audit_programs WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    await pool.end();
  });

  it('a row written through recordAuditEvent is never mutated by anything in the normal write path', async () => {
    const programId = await makeProgram(pool, orgId, uid('user'));

    await auditsDb.recordAuditEvent({
      organizationId: orgId,
      programId,
      entityType: 'probe',
      entityId: 'probe-1',
      eventType: 'probe.recorded',
      actorId: 'probe-actor',
      summary: 'Immutable trail probe',
      payload: { n: 1 },
    });

    const before = await pool.query(
      `SELECT id, entity_type, entity_id, event_type, actor_id, summary, payload, occurred_at
         FROM audit_domain_events WHERE organization_id=$1 AND entity_type='probe' AND entity_id='probe-1'`,
      [orgId],
    );
    expect(before.rows).toHaveLength(1);
    const snapshot = before.rows[0];

    // Nothing else touches this row. Re-read after unrelated activity in the
    // same org (another event for a DIFFERENT entity) and confirm byte-for-byte
    // equality in addition to the database-enforced mutation controls.
    await auditsDb.recordAuditEvent({
      organizationId: orgId,
      programId,
      entityType: 'probe',
      entityId: 'probe-2',
      eventType: 'probe.recorded',
      actorId: 'probe-actor',
      summary: 'Unrelated second event',
    });

    const after = await pool.query(
      `SELECT id, entity_type, entity_id, event_type, actor_id, summary, payload, occurred_at
         FROM audit_domain_events WHERE organization_id=$1 AND entity_type='probe' AND entity_id='probe-1'`,
      [orgId],
    );
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0]).toEqual(snapshot);
  });

  it('rejects direct UPDATE and DELETE at the database boundary', async () => {
    const programId = await makeProgram(pool, orgId, uid('user'));
    await auditsDb.recordAuditEvent({
      organizationId: orgId,
      programId,
      entityType: 'probe',
      entityId: 'probe-mutate',
      eventType: 'probe.recorded',
      summary: 'Immutable row protected by the database trigger',
    });

    await expect(
      pool.query(`UPDATE audit_domain_events SET summary='tampered' WHERE organization_id=$1 AND entity_id='probe-mutate'`, [
        orgId,
      ]),
    ).rejects.toThrow(/append-only/);

    await expect(
      pool.query(`DELETE FROM audit_domain_events WHERE organization_id=$1 AND entity_id='probe-mutate'`, [orgId]),
    ).rejects.toThrow(/append-only/);

    const preserved = await pool.query(
      `SELECT summary FROM audit_domain_events WHERE organization_id=$1 AND entity_id='probe-mutate'`,
      [orgId],
    );
    expect(preserved.rows).toHaveLength(1);
    expect(preserved.rows[0].summary).toBe('Immutable row protected by the database trigger');
  });

  it('the idempotency key prevents a duplicate event: same key inserted twice ⇒ exactly ONE row', async () => {
    const programId = await makeProgram(pool, orgId, uid('user'));
    const idempotencyKey = uid('idem');

    await auditsDb.recordAuditEvent({
      organizationId: orgId,
      programId,
      entityType: 'probe',
      entityId: 'probe-idem',
      eventType: 'probe.recorded',
      summary: 'First attempt',
      idempotencyKey,
    });
    // Same (organization_id, program_id, idempotency_key) — recordAuditEvent
    // itself never throws (documented, deliberate trade-off — see
    // auditsDb.ts:126-129), it relies on `ON CONFLICT DO NOTHING`.
    await auditsDb.recordAuditEvent({
      organizationId: orgId,
      programId,
      entityType: 'probe',
      entityId: 'probe-idem',
      eventType: 'probe.recorded',
      summary: 'Second attempt — same idempotency key, must be a no-op',
      idempotencyKey,
    });

    const rows = await pool.query(
      `SELECT summary FROM audit_domain_events WHERE organization_id=$1 AND program_id=$2 AND idempotency_key=$3`,
      [orgId, programId, idempotencyKey],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].summary).toBe('First attempt');
  });
});

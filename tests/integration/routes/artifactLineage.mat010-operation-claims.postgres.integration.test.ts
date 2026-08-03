/** @vitest-environment node */

/**
 * MAT-010 — round-5 audit: "CLAIM/OUTBOX SEPARATION — krytyczny problem
 * architektoniczny". Proves the dedicated `artifact_lineage_operation_claims`
 * table (see `operationClaimService.ts`) and its structural separation from
 * the lineage outbox (`artifact_lineage_pending_events`, unchanged in
 * `artifactLineageService.ts`) against the ten required real-Postgres
 * scenarios (A–J).
 *
 * Every scenario drives PRODUCTION methods directly — `acquireOrReclaimOperationClaim`,
 * `finalizeOperationClaim`, `getOperationClaimForTests` (a tenant-scoped
 * READ, never used to gate a decision), `reconcilePendingLineageEvents`,
 * `recordLineageEventTracked` — never raw SQL copied into the test, and the
 * business mutation (`createDocumentSnapshot`) is the real, unmocked
 * function against real Postgres. No `DbPromise` mock anywhere in this file.
 *
 * REQUIRES `NODE_ENV=test RUN_DB_TESTS=1` with `DATABASE_URL` pointed at a
 * real, migrated Postgres (including `20260802c_mat010_operation_claims_table.sql`).
 * Run:
 *
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:PORT/consultinity \
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   npx vitest run --retry=0 \
 *     tests/integration/routes/artifactLineage.mat010-operation-claims.postgres.integration.test.ts
 *
 * `--retry=0` is deliberate (institutional memory: `retry: 1` hides fixture
 * collisions and makes race tests lie).
 */
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  deriveRequestBoundIdempotencyKey,
  recordLineageEventTracked,
  reconcilePendingLineageEvents,
  __setLineageDirectWriteFaultForTests,
} from '../../../server/src/services/lineage/artifactLineageService.js';
import {
  acquireOrReclaimOperationClaim,
  finalizeOperationClaim,
  getOperationClaimForTests,
  renewOperationClaimLease,
  startClaimHeartbeat,
  __setOperationClaimRenewalNoOpForTests,
} from '../../../server/src/services/lineage/operationClaimService.js';
import { createDocumentSnapshot } from '../../../server/src/services/documentStudio/documentStudioService.js';

const SUFFIX = uuidv4().slice(0, 8);
const ORG_A = `org-mat010oc-a-${SUFFIX}`;
const ORG_B = `org-mat010oc-b-${SUFFIX}`;
const USER_A = `user-mat010oc-a-${SUFFIX}`;
const USER_B = `user-mat010oc-b-${SUFFIX}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newOperationKey(): string {
  return deriveRequestBoundIdempotencyKey({
    artifactKind: 'document',
    sourceRecordId: `sourceless-${uuidv4()}`,
    eventType: 'checkpoint',
    requestKey: uuidv4(),
  });
}

describe('MAT-010 — dedicated operation-claims table: A-J real-Postgres acceptance (round-5 CLAIM/OUTBOX SEPARATION audit)', () => {
  let pool: Pool;
  const createdDocIds: string[] = [];

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error(
        'This suite requires NODE_ENV=test RUN_DB_TESTS=1 with DATABASE_URL pointed at a real, migrated Postgres.'
      );
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`INSERT INTO organizations (id) VALUES ($1), ($2) ON CONFLICT DO NOTHING`, [
      ORG_A,
      ORG_B,
    ]);
  });

  afterAll(async () => {
    if (createdDocIds.length) {
      await pool.query(`DELETE FROM document_version_snapshots WHERE artifact_id = ANY($1)`, [
        createdDocIds,
      ]);
      await pool.query(`DELETE FROM document_lifecycle_states WHERE artifact_id = ANY($1)`, [
        createdDocIds,
      ]);
      await pool.query(`DELETE FROM wave5_artifacts WHERE artifact_id = ANY($1)`, [createdDocIds]);
    }
    await pool.query(`DELETE FROM v8_artifact_origin_links WHERE organization_id = ANY($1)`, [
      [ORG_A, ORG_B],
    ]);
    await pool.query(
      `DELETE FROM artifact_lineage_operation_claims WHERE organization_id = ANY($1)`,
      [[ORG_A, ORG_B]]
    );
    await pool.query(`DELETE FROM artifact_lineage_pending_events WHERE organization_id = ANY($1)`, [
      [ORG_A, ORG_B],
    ]);
    await pool.query(`DELETE FROM artifact_lineage_events WHERE organization_id = ANY($1)`, [
      [ORG_A, ORG_B],
    ]);
    await pool.query(`DELETE FROM artifact_lineage_receipts WHERE organization_id = ANY($1)`, [
      [ORG_A, ORG_B],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG_A, ORG_B]]);
    await pool.end();
  });

  async function seedDocument(organizationId: string, userId: string, title: string) {
    const artifactId = `doc-mat010oc-${uuidv4()}`;
    const nowIso = new Date().toISOString();
    const schema = {
      artifactId,
      title,
      documentType: 'report',
      language: 'pl',
      createdAt: nowIso,
      updatedAt: nowIso,
      sections: [
        {
          sectionId: 'sec-1',
          heading: 'Wprowadzenie',
          blocks: [{ blockId: 'b-1', type: 'paragraph', content: 'Treść.', isAssumption: false }],
        },
      ],
    };
    await pool.query(
      `INSERT INTO wave5_artifacts
         (artifact_id, organization_id, artifact_type, status, title, content,
          current_version, citations_json, source_refs_json, provenance_json,
          created_by, created_at, updated_at, canonical_format,
          content_json_native, content_schema_version)
       VALUES ($1, $2, 'document', 'draft', $3, $4, 1, '[]', '[]', '{}',
               $5, $6, $6, 'markdown', $7, '1')`,
      [artifactId, organizationId, title, '# ' + title, userId, nowIso, JSON.stringify(schema)]
    );
    await pool.query(
      `INSERT INTO document_lifecycle_states
         (artifact_id, organization_id, status, status_changed_at,
          status_changed_by, status_reason, history_json, updated_at)
       VALUES ($1, $2, 'draft', $3, $4, 'fixture', '[]'::jsonb, $3)
       ON CONFLICT (artifact_id, organization_id) DO NOTHING`,
      [artifactId, organizationId, nowIso, userId]
    );
    createdDocIds.push(artifactId);
    return artifactId;
  }

  async function dbEventTypes(organizationId: string, sourceRecordId: string): Promise<string[]> {
    const r = await pool.query(
      `SELECT e.event_type
         FROM artifact_lineage_events e
         JOIN artifact_lineage_receipts rc ON rc.receipt_id = e.receipt_id
        WHERE rc.organization_id = $1 AND rc.source_record_id = $2
        ORDER BY e.sequence_no ASC`,
      [organizationId, sourceRecordId]
    );
    return r.rows.map((x) => x.event_type);
  }

  async function receiptCount(organizationId: string, sourceRecordId: string): Promise<number> {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_lineage_receipts
        WHERE organization_id = $1 AND source_record_id = $2`,
      [organizationId, sourceRecordId]
    );
    return r.rows[0].n;
  }

  async function snapshotCount(artifactId: string): Promise<number> {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM document_version_snapshots WHERE artifact_id = $1`,
      [artifactId]
    );
    return r.rows[0].n;
  }

  // ===========================================================================
  // A. RECONCILER RACE
  // ===========================================================================
  it('A — reconciler race: a claim acquired before the business mutation runs produces ZERO new lineage when reconciled, and the claim itself is untouched', async () => {
    const artifactId = await seedDocument(ORG_A, USER_A, 'MAT-010OC A — Reconciler Race');
    const operationKey = newOperationKey();

    const claim = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey });
    expect(claim.outcome).toBe('acquired');
    if (claim.outcome !== 'acquired') throw new Error('unreachable');

    // The business mutation has NOT run yet.
    const reconcileResult = await reconcilePendingLineageEvents({ organizationId: ORG_A });
    expect(reconcileResult.recovered).toBeGreaterThanOrEqual(0);

    expect(await dbEventTypes(ORG_A, artifactId)).toEqual([]);
    expect(await receiptCount(ORG_A, artifactId)).toBe(0);
    expect(await snapshotCount(artifactId)).toBe(0);
    const rowAfterReconcile = await getOperationClaimForTests({ organizationId: ORG_A, operationKey });
    expect(rowAfterReconcile).toEqual({
      state: 'active',
      ownerToken: claim.ownerToken,
      fencingToken: claim.fencingToken,
      completedResultId: null,
    });

    // Resume the correct owner.
    const snapshot = await createDocumentSnapshot({
      organizationId: ORG_A,
      artifactId,
      userId: USER_A,
      label: 'resumed after reconciler race',
      reason: 'manual',
    });
    await recordLineageEventTracked({
      organizationId: ORG_A,
      artifactKind: 'document',
      sourceRecordId: artifactId,
      eventType: 'checkpoint',
      actorUserId: USER_A,
      idempotencyKey: operationKey,
      detail: { versionId: snapshot.versionId },
    });
    const finalizeResult = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claim.ownerToken,
      fencingToken: claim.fencingToken,
      completedResultId: snapshot.versionId,
    });
    expect(finalizeResult.outcome).toBe('finalized');

    expect(await snapshotCount(artifactId)).toBe(1);
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);
  });

  // ===========================================================================
  // B. NORMAL COMPLETION
  // ===========================================================================
  it('B — normal completion: claim -> mutation -> outbox -> reconcile produces exactly one result, one event, one lineage row, and a fresh read-back confirms every dependency', async () => {
    const artifactId = await seedDocument(ORG_A, USER_A, 'MAT-010OC B — Normal Completion');
    const operationKey = newOperationKey();

    const claim = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey });
    expect(claim.outcome).toBe('acquired');
    if (claim.outcome !== 'acquired') throw new Error('unreachable');

    const snapshot = await createDocumentSnapshot({
      organizationId: ORG_A,
      artifactId,
      userId: USER_A,
      label: 'normal',
      reason: 'manual',
    });

    const trackedResult = await recordLineageEventTracked({
      organizationId: ORG_A,
      artifactKind: 'document',
      sourceRecordId: artifactId,
      eventType: 'checkpoint',
      actorUserId: USER_A,
      idempotencyKey: operationKey,
      detail: { versionId: snapshot.versionId },
    });
    expect(trackedResult.durable).toBe(true);

    const finalizeResult = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claim.ownerToken,
      fencingToken: claim.fencingToken,
      completedResultId: snapshot.versionId,
    });
    expect(finalizeResult.outcome).toBe('finalized');

    await reconcilePendingLineageEvents({ organizationId: ORG_A }); // no-op here: direct write already landed

    // Exactly one result, one event, one lineage receipt.
    expect(await snapshotCount(artifactId)).toBe(1);
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);
    expect(await receiptCount(ORG_A, artifactId)).toBe(1);

    // Fresh read-back confirms every dependency.
    const rowAfter = await getOperationClaimForTests({ organizationId: ORG_A, operationKey });
    expect(rowAfter).toEqual({
      state: 'completed',
      ownerToken: claim.ownerToken,
      fencingToken: claim.fencingToken,
      completedResultId: snapshot.versionId,
    });
    const snapshotRow = await pool.query(
      `SELECT version_id FROM document_version_snapshots WHERE version_id = $1`,
      [snapshot.versionId]
    );
    expect(snapshotRow.rows).toHaveLength(1);
  });

  // ===========================================================================
  // C. CRASH BEFORE MUTATION
  // ===========================================================================
  it('C — crash before mutation: a claim never finalized is honestly still-active before lease expiry, and safely reclaimable (and completable) after', async () => {
    const artifactId = await seedDocument(ORG_A, USER_A, 'MAT-010OC C — Crash Before Mutation');
    const operationKey = newOperationKey();
    const leaseMs = 2500;

    const claimA = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey, leaseMs });
    expect(claimA.outcome).toBe('acquired');
    if (claimA.outcome !== 'acquired') throw new Error('unreachable');
    // Worker "dies": no mutation, no finalize, ever, from this claim.

    // Before expiry: no other worker may take over.
    const earlyRetry = await acquireOrReclaimOperationClaim({
      organizationId: ORG_A,
      operationKey,
      leaseMs,
      waitMs: 250,
    });
    expect(earlyRetry.outcome).toBe('active_elsewhere');
    expect(await snapshotCount(artifactId)).toBe(0);

    // After expiry: a second worker safely takes over.
    await sleep(leaseMs + 700);
    const claimB = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey, leaseMs });
    expect(claimB.outcome).toBe('acquired');
    if (claimB.outcome !== 'acquired') throw new Error('unreachable');
    expect(claimB.ownerToken).not.toBe(claimA.ownerToken);
    expect(claimB.fencingToken).toBeGreaterThan(claimA.fencingToken);

    // The operation CAN now be completed.
    const snapshot = await createDocumentSnapshot({
      organizationId: ORG_A,
      artifactId,
      userId: USER_A,
      label: 'completed by second worker',
      reason: 'manual',
    });
    await recordLineageEventTracked({
      organizationId: ORG_A,
      artifactKind: 'document',
      sourceRecordId: artifactId,
      eventType: 'checkpoint',
      actorUserId: USER_A,
      idempotencyKey: operationKey,
      detail: { versionId: snapshot.versionId },
    });
    const finalizeResult = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claimB.ownerToken,
      fencingToken: claimB.fencingToken,
      completedResultId: snapshot.versionId,
    });
    expect(finalizeResult.outcome).toBe('finalized');
    expect(await snapshotCount(artifactId)).toBe(1);
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);
  });

  // ===========================================================================
  // D. CRASH AFTER BUSINESS MUTATION / BEFORE RECONCILIATION
  // ===========================================================================
  it('D — crash after mutation, before reconciliation: the canonical result and outbox intent survive, a later reconcile completes the lineage, and no duplicate result is ever created', async () => {
    const artifactId = await seedDocument(ORG_A, USER_A, 'MAT-010OC D — Crash After Mutation');
    const operationKey = newOperationKey();

    const claim = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey });
    expect(claim.outcome).toBe('acquired');
    if (claim.outcome !== 'acquired') throw new Error('unreachable');

    const snapshot = await createDocumentSnapshot({
      organizationId: ORG_A,
      artifactId,
      userId: USER_A,
      label: 'mutation succeeded, then a crash',
      reason: 'manual',
    });

    // Simulate the DIRECT lineage write failing (the worker "crashes" right
    // after the mutation, before the event could be recorded directly) —
    // recordLineageEventTracked's own fallback persists a durable pending
    // outbox intent instead of losing it.
    __setLineageDirectWriteFaultForTests(true);
    let trackedResult;
    try {
      trackedResult = await recordLineageEventTracked({
        organizationId: ORG_A,
        artifactKind: 'document',
        sourceRecordId: artifactId,
        eventType: 'checkpoint',
        actorUserId: USER_A,
        idempotencyKey: operationKey,
        detail: { versionId: snapshot.versionId },
      });
    } finally {
      __setLineageDirectWriteFaultForTests(false);
    }
    expect(trackedResult.durable).toBe(true); // pending fallback captured it
    expect(trackedResult.event).toBeNull(); // NOT the direct write

    // The claim still finalizes: the canonical result (the mutation) is
    // durably known independent of the outbox's own fate.
    const finalizeResult = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claim.ownerToken,
      fencingToken: claim.fencingToken,
      completedResultId: snapshot.versionId,
    });
    expect(finalizeResult.outcome).toBe('finalized');

    // Nothing durably records the lineage EVENT yet.
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual([]);

    // A retry with the SAME operationKey (simulating the client retrying
    // after the "crash") must find the claim already completed and NOT
    // trigger a second mutation.
    const retryClaim = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey });
    expect(retryClaim.outcome).toBe('completed');
    if (retryClaim.outcome !== 'completed') throw new Error('unreachable');
    expect(retryClaim.completedResultId).toBe(snapshot.versionId);
    expect(await snapshotCount(artifactId)).toBe(1); // still exactly one

    // Later reconciliation completes the lineage.
    const reconcileResult = await reconcilePendingLineageEvents({ organizationId: ORG_A });
    expect(reconcileResult.recovered).toBeGreaterThanOrEqual(1);
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);
    expect(await receiptCount(ORG_A, artifactId)).toBe(1);

    // A SECOND reconcile is a no-op (the row is now consumed) — no duplicate.
    const secondReconcile = await reconcilePendingLineageEvents({ organizationId: ORG_A });
    expect(secondReconcile.scanned).toBe(0);
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);
  });

  // ===========================================================================
  // E. STALE-OWNER FENCING
  // ===========================================================================
  it('E — stale-owner fencing: a superseded owner can never finalize (zero rows, zero result overwrite); the new owner completes correctly', async () => {
    const artifactId = await seedDocument(ORG_A, USER_A, 'MAT-010OC E — Stale Owner Fencing');
    const operationKey = newOperationKey();
    const leaseMs = 600;

    const claimA = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey, leaseMs });
    expect(claimA.outcome).toBe('acquired');
    if (claimA.outcome !== 'acquired') throw new Error('unreachable');

    await sleep(leaseMs + 400);

    const claimB = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey, leaseMs });
    expect(claimB.outcome).toBe('acquired');
    if (claimB.outcome !== 'acquired') throw new Error('unreachable');
    expect(claimB.ownerToken).not.toBe(claimA.ownerToken);
    expect(claimB.fencingToken).toBeGreaterThan(claimA.fencingToken);

    // Worker A (unaware it was superseded) tries to finalize with its now
    // stale (owner_token, fencing_token) pair.
    const finalizeA = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claimA.ownerToken,
      fencingToken: claimA.fencingToken,
      completedResultId: 'should-never-be-recorded',
    });
    expect(finalizeA.outcome).toBe('fenced');

    const rowAfterStale = await getOperationClaimForTests({ organizationId: ORG_A, operationKey });
    expect(rowAfterStale).toEqual({
      state: 'active',
      ownerToken: claimB.ownerToken,
      fencingToken: claimB.fencingToken,
      completedResultId: null,
    });

    // Worker B finalizes correctly.
    const snapshot = await createDocumentSnapshot({
      organizationId: ORG_A,
      artifactId,
      userId: USER_A,
      label: 'owner B',
      reason: 'manual',
    });
    const finalizeB = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claimB.ownerToken,
      fencingToken: claimB.fencingToken,
      completedResultId: snapshot.versionId,
    });
    expect(finalizeB.outcome).toBe('finalized');

    const rowAfterB = await getOperationClaimForTests({ organizationId: ORG_A, operationKey });
    expect(rowAfterB?.completedResultId).toBe(snapshot.versionId);
    expect(await snapshotCount(artifactId)).toBe(1);

    // A's stale attempt AFTER B's success is fenced too, for an independent
    // reason (state is now 'completed', not merely a different owner).
    const finalizeAAgain = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claimA.ownerToken,
      fencingToken: claimA.fencingToken,
      completedResultId: 'still-should-never-be-recorded',
    });
    expect(finalizeAAgain.outcome).toBe('fenced');
    const rowFinal = await getOperationClaimForTests({ organizationId: ORG_A, operationKey });
    expect(rowFinal?.completedResultId).toBe(snapshot.versionId); // unchanged by A
  });

  // ===========================================================================
  // F. CONCURRENT ACQUISITION
  // ===========================================================================
  it('F — concurrent acquisition: many parallel attempts at the SAME operation key produce exactly one active owner lease, never two winners', async () => {
    const operationKey = newOperationKey();
    const CONCURRENCY = 6;

    // Every caller uses a short waitMs — nobody ever finalizes in this test,
    // so losers should converge on `active_elsewhere` quickly rather than
    // waiting out the full default 8s.
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey, waitMs: 300 })
      )
    );

    const acquired = results.filter((r) => r.outcome === 'acquired');
    const activeElsewhere = results.filter((r) => r.outcome === 'active_elsewhere');
    expect(acquired).toHaveLength(1);
    expect(activeElsewhere).toHaveLength(CONCURRENCY - 1);

    // The row itself agrees: exactly the winner's token/fencing is stored.
    const winner = acquired[0] as { outcome: 'acquired'; ownerToken: string; fencingToken: number };
    const row = await getOperationClaimForTests({ organizationId: ORG_A, operationKey });
    expect(row).toEqual({
      state: 'active',
      ownerToken: winner.ownerToken,
      fencingToken: winner.fencingToken,
      completedResultId: null,
    });
    expect(winner.fencingToken).toBe(1); // fresh acquire, never reclaimed
  });

  // ===========================================================================
  // G. CONCURRENT FINALIZATION
  // ===========================================================================
  it('G — concurrent finalization: two simultaneous finalize calls for the SAME claim produce exactly one canonical result and one lineage event', async () => {
    const artifactId = await seedDocument(ORG_A, USER_A, 'MAT-010OC G — Concurrent Finalization');
    const operationKey = newOperationKey();

    const claim = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey });
    expect(claim.outcome).toBe('acquired');
    if (claim.outcome !== 'acquired') throw new Error('unreachable');

    const snapshot = await createDocumentSnapshot({
      organizationId: ORG_A,
      artifactId,
      userId: USER_A,
      label: 'concurrent finalize',
      reason: 'manual',
    });

    // Two callers, same owner/fencing pair, both trying to finalize AND
    // record the lineage event at the same moment — neither is awaited
    // before the other starts.
    const finalizeCall = () =>
      finalizeOperationClaim({
        organizationId: ORG_A,
        operationKey,
        ownerToken: claim.ownerToken,
        fencingToken: claim.fencingToken,
        completedResultId: snapshot.versionId,
      });
    const recordCall = () =>
      recordLineageEventTracked({
        organizationId: ORG_A,
        artifactKind: 'document',
        sourceRecordId: artifactId,
        eventType: 'checkpoint',
        actorUserId: USER_A,
        idempotencyKey: operationKey,
        detail: { versionId: snapshot.versionId },
      });

    const [finalize1, finalize2] = await Promise.all([finalizeCall(), finalizeCall()]);
    const [record1, record2] = await Promise.all([recordCall(), recordCall()]);

    // Exactly one finalize call actually transitions the row.
    const finalized = [finalize1, finalize2].filter((r) => r.outcome === 'finalized');
    const fenced = [finalize1, finalize2].filter((r) => r.outcome === 'fenced');
    expect(finalized).toHaveLength(1);
    expect(fenced).toHaveLength(1);

    // The lineage event's OWN idempotency-key dedup converges to one row
    // regardless of which finalize call "won" — defense in depth on top of
    // the claim's own fencing.
    expect(record1.durable).toBe(true);
    expect(record2.durable).toBe(true);
    const dedupedFlags = [record1.event?.deduped, record2.event?.deduped].filter(Boolean);
    expect(dedupedFlags).toHaveLength(1);

    expect(await snapshotCount(artifactId)).toBe(1);
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);
    const row = await getOperationClaimForTests({ organizationId: ORG_A, operationKey });
    expect(row?.state).toBe('completed');
    expect(row?.completedResultId).toBe(snapshot.versionId);
  });

  // ===========================================================================
  // H. TENANT ISOLATION
  // ===========================================================================
  it('H — tenant isolation: organization B can neither reclaim, read, nor finalize organization A\'s claim, even when it reuses the LITERAL SAME operation key string', async () => {
    const operationKey = newOperationKey(); // deliberately reused across both orgs below

    const claimA = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey });
    expect(claimA.outcome).toBe('acquired');
    if (claimA.outcome !== 'acquired') throw new Error('unreachable');

    // Org B acquiring the "same" key string gets its OWN independent row —
    // never a collision, never a view into org A's row.
    const claimB = await acquireOrReclaimOperationClaim({ organizationId: ORG_B, operationKey });
    expect(claimB.outcome).toBe('acquired');
    if (claimB.outcome !== 'acquired') throw new Error('unreachable');
    expect(claimB.ownerToken).not.toBe(claimA.ownerToken);

    // Org B cannot read org A's row (tenant-scoped read).
    const rowFromBSideForOwnKey = await getOperationClaimForTests({
      organizationId: ORG_B,
      operationKey,
    });
    expect(rowFromBSideForOwnKey?.ownerToken).toBe(claimB.ownerToken); // B sees only ITS OWN row

    // Org B cannot finalize org A's claim by presenting org A's own
    // credentials but org B's organizationId — the WHERE clause requires
    // organization_id = 'B', which never matches org A's row.
    const crossTenantFinalize = await finalizeOperationClaim({
      organizationId: ORG_B,
      operationKey,
      ownerToken: claimA.ownerToken,
      fencingToken: claimA.fencingToken,
      completedResultId: 'cross-tenant-should-never-be-recorded',
    });
    expect(crossTenantFinalize.outcome).toBe('fenced');
    const rowAUnchanged = await getOperationClaimForTests({ organizationId: ORG_A, operationKey });
    expect(rowAUnchanged).toEqual({
      state: 'active',
      ownerToken: claimA.ownerToken,
      fencingToken: claimA.fencingToken,
      completedResultId: null,
    });

    // Org A's row remains independently finalizable by org A.
    const finalizeA = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claimA.ownerToken,
      fencingToken: claimA.fencingToken,
      completedResultId: 'org-a-result',
    });
    expect(finalizeA.outcome).toBe('finalized');
    // Org B's independent row is entirely unaffected by org A's finalize.
    const rowBUnaffected = await getOperationClaimForTests({ organizationId: ORG_B, operationKey });
    expect(rowBUnaffected?.state).toBe('active');
    expect(rowBUnaffected?.completedResultId).toBeNull();
  });

  // ===========================================================================
  // I. RECONCILER RETRY
  // ===========================================================================
  it('I — reconciler retry: a pending event that fails to process once remains retryable, and the next reconcile pass creates exactly one lineage row (no double materialization)', async () => {
    const artifactId = await seedDocument(ORG_A, USER_A, 'MAT-010OC I — Reconciler Retry');
    const operationKey = newOperationKey();

    const claim = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey });
    expect(claim.outcome).toBe('acquired');
    if (claim.outcome !== 'acquired') throw new Error('unreachable');

    const snapshot = await createDocumentSnapshot({
      organizationId: ORG_A,
      artifactId,
      userId: USER_A,
      label: 'reconciler retry',
      reason: 'manual',
    });

    // Direct write fails -> durable pending outbox intent captured.
    __setLineageDirectWriteFaultForTests(true);
    try {
      const tracked = await recordLineageEventTracked({
        organizationId: ORG_A,
        artifactKind: 'document',
        sourceRecordId: artifactId,
        eventType: 'checkpoint',
        actorUserId: USER_A,
        idempotencyKey: operationKey,
        detail: { versionId: snapshot.versionId },
      });
      expect(tracked.durable).toBe(true);
      expect(tracked.event).toBeNull();

      await finalizeOperationClaim({
        organizationId: ORG_A,
        operationKey,
        ownerToken: claim.ownerToken,
        fencingToken: claim.fencingToken,
        completedResultId: snapshot.versionId,
      });

      // FIRST reconcile attempt — the fault is STILL injected, so the
      // reconciler's own processing attempt fails too: the row must remain
      // retryable (status stays 'pending'), not be silently dropped.
      const firstReconcile = await reconcilePendingLineageEvents({ organizationId: ORG_A });
      expect(firstReconcile.stillFailing).toBeGreaterThanOrEqual(1);
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual([]); // still nothing durable
    } finally {
      __setLineageDirectWriteFaultForTests(false);
    }

    // SECOND reconcile — fault cleared — recovers exactly one event.
    const secondReconcile = await reconcilePendingLineageEvents({ organizationId: ORG_A });
    expect(secondReconcile.recovered).toBeGreaterThanOrEqual(1);
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);

    // A THIRD reconcile is a no-op — no double materialization.
    const thirdReconcile = await reconcilePendingLineageEvents({ organizationId: ORG_A });
    expect(thirdReconcile.scanned).toBe(0);
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);
  });

  // ===========================================================================
  // J. ZERO-ROW FAIL-CLOSED
  // ===========================================================================
  it('J — zero-row fail-closed: finalize with a stale/incorrect fencing token returns a conflict, never a success, and modifies nothing', async () => {
    const operationKey = newOperationKey();

    const claim = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey });
    expect(claim.outcome).toBe('acquired');
    if (claim.outcome !== 'acquired') throw new Error('unreachable');

    const wrongFencingResult = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claim.ownerToken,
      fencingToken: claim.fencingToken + 999,
      completedResultId: 'should-not-be-recorded',
    });
    expect(wrongFencingResult.outcome).toBe('fenced');

    const wrongOwnerResult = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: 'not-the-real-owner-token',
      fencingToken: claim.fencingToken,
      completedResultId: 'should-not-be-recorded-either',
    });
    expect(wrongOwnerResult.outcome).toBe('fenced');

    // The row is untouched by either failed attempt — still active, still
    // the original owner, no canonical result recorded.
    const row = await getOperationClaimForTests({ organizationId: ORG_A, operationKey });
    expect(row).toEqual({
      state: 'active',
      ownerToken: claim.ownerToken,
      fencingToken: claim.fencingToken,
      completedResultId: null,
    });

    // The CORRECT credentials still work — proving the failures above were
    // genuinely about the wrong token/fencing, not a broken finalize path.
    const correctResult = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claim.ownerToken,
      fencingToken: claim.fencingToken,
      completedResultId: 'genuine-result',
    });
    expect(correctResult.outcome).toBe('finalized');
  });

  // ===========================================================================
  // K. LIVE SLOW WORKER — G22 fix: heartbeat renewal must prevent a reclaim
  // out from under a genuinely still-running (not crashed) mutation.
  // ===========================================================================
  it('K — live slow worker: heartbeat renewal keeps the lease alive past its original expiry, so a second worker cannot acquire or run a second mutation while the first is still genuinely working; the first finalizes exactly one result/event/lineage', async () => {
    const artifactId = await seedDocument(ORG_A, USER_A, 'MAT-010OC K — Live Slow Worker');
    const operationKey = newOperationKey();
    const leaseMs = 700;

    const claimA = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey, leaseMs });
    expect(claimA.outcome).toBe('acquired');
    if (claimA.outcome !== 'acquired') throw new Error('unreachable');

    const heartbeat = startClaimHeartbeat({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claimA.ownerToken,
      fencingToken: claimA.fencingToken,
      leaseMs,
    });
    try {
      // Simulate a mutation that genuinely takes longer than the ORIGINAL
      // lease window — the heartbeat must keep renewing it underneath.
      await sleep(leaseMs * 2.5);
      expect(heartbeat.isFenced()).toBe(false);

      // A second worker tries to acquire the SAME operation while A is
      // still (per the heartbeat) actively working — must NOT get
      // 'acquired': the lease has been kept alive well past its original
      // expiry, so there is nothing to reclaim.
      const claimB = await acquireOrReclaimOperationClaim({
        organizationId: ORG_A,
        operationKey,
        leaseMs,
        waitMs: 250,
      });
      expect(claimB.outcome).toBe('active_elsewhere');
      expect(await snapshotCount(artifactId)).toBe(0); // B never ran a mutation

      // A finishes its (real) mutation now.
      const snapshot = await createDocumentSnapshot({
        organizationId: ORG_A,
        artifactId,
        userId: USER_A,
        label: 'slow worker A',
        reason: 'manual',
      });
      expect(heartbeat.isFenced()).toBe(false); // still A's claim throughout

      await recordLineageEventTracked({
        organizationId: ORG_A,
        artifactKind: 'document',
        sourceRecordId: artifactId,
        eventType: 'checkpoint',
        actorUserId: USER_A,
        idempotencyKey: operationKey,
        detail: { versionId: snapshot.versionId },
      });
      const finalizeResult = await finalizeOperationClaim({
        organizationId: ORG_A,
        operationKey,
        ownerToken: claimA.ownerToken,
        fencingToken: claimA.fencingToken,
        completedResultId: snapshot.versionId,
      });
      expect(finalizeResult.outcome).toBe('finalized');
    } finally {
      heartbeat.stop();
    }

    expect(await snapshotCount(artifactId)).toBe(1);
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);
    const row = await getOperationClaimForTests({ organizationId: ORG_A, operationKey });
    expect(row?.state).toBe('completed');
    expect(row?.fencingToken).toBe(claimA.fencingToken); // never reclaimed
  });

  // ===========================================================================
  // L. STALE HEARTBEAT — a heartbeat tick that arrives AFTER a reclaim must
  // be fenced, exactly like a stale finalize call.
  // ===========================================================================
  it('L — stale heartbeat: once reclaimed, a late heartbeat tick from the original owner is fenced and cannot finalize; the new owner completes the operation', async () => {
    const artifactId = await seedDocument(ORG_A, USER_A, 'MAT-010OC L — Stale Heartbeat');
    const operationKey = newOperationKey();
    const leaseMs = 500;

    const claimA = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey, leaseMs });
    expect(claimA.outcome).toBe('acquired');
    if (claimA.outcome !== 'acquired') throw new Error('unreachable');

    // Heartbeat starts, ticks once (proving it is genuinely running), then
    // is stopped — simulating the worker's heartbeat dying (process stall,
    // crash of the heartbeat timer, etc.) while the claim itself lingers.
    const heartbeat = startClaimHeartbeat({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claimA.ownerToken,
      fencingToken: claimA.fencingToken,
      leaseMs,
      intervalMs: 100,
    });
    await sleep(150);
    heartbeat.stop();
    expect(heartbeat.isFenced()).toBe(false); // stopped cleanly, not fenced

    // Lease now expires for real (no more renewals).
    await sleep(leaseMs + 400);

    // A second worker reclaims with a NEW token and higher fencing.
    const claimB = await acquireOrReclaimOperationClaim({ organizationId: ORG_A, operationKey, leaseMs });
    expect(claimB.outcome).toBe('acquired');
    if (claimB.outcome !== 'acquired') throw new Error('unreachable');
    expect(claimB.ownerToken).not.toBe(claimA.ownerToken);
    expect(claimB.fencingToken).toBeGreaterThan(claimA.fencingToken);

    // A late heartbeat tick from A (arriving after the reclaim — network
    // delay, scheduler jitter, whatever) must be fenced, exactly like a
    // stale finalize call.
    const lateRenewal = await renewOperationClaimLease({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claimA.ownerToken,
      fencingToken: claimA.fencingToken,
      leaseMs,
    });
    expect(lateRenewal.outcome).toBe('fenced');

    // A cannot finalize either.
    const finalizeA = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claimA.ownerToken,
      fencingToken: claimA.fencingToken,
      completedResultId: 'should-never-be-recorded',
    });
    expect(finalizeA.outcome).toBe('fenced');

    // B completes the operation correctly.
    const snapshot = await createDocumentSnapshot({
      organizationId: ORG_A,
      artifactId,
      userId: USER_A,
      label: 'owner B after stale heartbeat',
      reason: 'manual',
    });
    const finalizeB = await finalizeOperationClaim({
      organizationId: ORG_A,
      operationKey,
      ownerToken: claimB.ownerToken,
      fencingToken: claimB.fencingToken,
      completedResultId: snapshot.versionId,
    });
    expect(finalizeB.outcome).toBe('finalized');

    expect(await snapshotCount(artifactId)).toBe(1);
    const row = await getOperationClaimForTests({ organizationId: ORG_A, operationKey });
    expect(row?.completedResultId).toBe(snapshot.versionId);
  });
});

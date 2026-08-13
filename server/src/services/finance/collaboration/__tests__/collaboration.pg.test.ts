/**
 * AP-04 collaboration services — real PostgreSQL integration test.
 *
 * Exercises `autosaveService`, `crashRecoveryService`, `conflictResolver` and
 * `computePinning` against the ACTUAL migrated schema
 * (`server/migrations/20260809_finance_v3_b0*.sql` +
 * `20260809_finance_v3_d_ap04_autosave_checkpoints.sql`), the same discipline
 * `canonicalServices.pg.test.ts` (WP-C02) established for this program: a
 * mocked/reinvented schema cannot prove the real
 * `uq_finance_wr_one_current` partial unique index, the real demote-then-
 * INSERT ordering, or the real `checkpoint_payload`/`checkpoint_source`
 * columns actually round-trip.
 *
 * Same env-var contract as every other `.pg.test.ts` in this repo
 * (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`) —
 * `describe.skipIf`-gated so a run with no real database reachable reports
 * SKIPPED, never a false green.
 *
 * Isolation: one freshly generated organization id per test run, same
 * convention as `canonicalServices.pg.test.ts`. `afterAll` best-effort-cleans
 * only what is genuinely deletable (`compute_job_outputs`/`compute_job_runs`/
 * `compute_jobs`) — `finance_working_revisions`/`finance_business_versions`/
 * `finance_artifacts`/`organizations` are left in place, same reasoning as
 * that file's header comment (transitively undeletable once an append-only
 * child row exists).
 *
 * HOW TO RUN (against your own throwaway/ephemeral cluster — NEVER the
 * shared local Postgres or any demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/collaboration/__tests__/collaboration.pg.test.ts \
 *     --no-file-parallelism
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { financeStmtLinesCellRef, type CellRef } from '../../../../types/finance/CellRef.js';
import type { FinanceUnsavedOperationStackEntry } from '../../../../types/finance/WorkspaceState.js';
import type { Operation } from '../../../../types/finance/Operation.js';
import { OperationStack } from '../operationStack.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('AP-04 collaboration services — real PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../../canonical/artifactVersionService.js');
  let autosaveService: typeof import('../autosaveService.js');
  let crashRecoveryService: typeof import('../crashRecoveryService.js');
  let conflictResolver: typeof import('../conflictResolver.js');
  let computePinning: typeof import('../computePinning.js');

  const orgId = `org-finv3-ap04-${randomUUID()}`;
  const userA = `user-a-${randomUUID()}`;
  const userB = `user-b-${randomUUID()}`;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../../canonical/artifactVersionService.js');
    autosaveService = await import('../autosaveService.js');
    crashRecoveryService = await import('../crashRecoveryService.js');
    conflictResolver = await import('../conflictResolver.js');
    computePinning = await import('../computePinning.js');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'FinV3 AP-04 Test Org'])
    );
  });

  afterAll(async () => {
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`DELETE FROM compute_job_outputs WHERE organization_id = ?`, [orgId]);
      await tx.queryRun(
        `DELETE FROM compute_job_runs WHERE job_id IN (SELECT id FROM compute_jobs WHERE organization_id = ?)`,
        [orgId]
      );
      await tx.queryRun(`DELETE FROM compute_jobs WHERE organization_id = ?`, [orgId]);
    });
  });

  function cell(canonicalLineId: string, periodId = 'FY2025Q1'): CellRef {
    return financeStmtLinesCellRef({
      organizationId: orgId,
      businessVersionId: 'placeholder', // overwritten per-artifact below where needed
      entityId: 'entity-1',
      canonicalLineId,
      consolidationScope: 'STANDALONE',
      periodId,
      accumulationBasis: 'QUARTER_ONLY',
    });
  }

  function setOperation(target: CellRef, valueDecimal: string, actorId: string, sourceWorkingRevisionId: string | null): Operation {
    return {
      type: 'set',
      operationId: `op-${randomUUID()}`,
      idempotencyKey: `idem-${randomUUID()}`,
      actorId,
      actorRole: 'preparer',
      clientTimestamp: new Date().toISOString(),
      sourceWorkingRevisionId,
      target,
      value: { status: 'PRESENT_NONZERO', valueDecimal },
    };
  }

  function stackEntry(operation: Operation, committed = false): FinanceUnsavedOperationStackEntry {
    return { operation, appliedAt: new Date().toISOString(), committed };
  }

  // -------------------------------------------------------------------------
  // AutosaveService — Sync/Saved/Conflict
  // -------------------------------------------------------------------------

  describe('autosaveService.checkpointOperationStack — Saved/Conflict states', () => {
    it('SAVED: a checkpoint against the current working revision advances revision_seq and demotes the old row', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      const initialWrId = created.workingRevision.working_revision_id;
      const initialSeq = Number(created.workingRevision.revision_seq);

      const c = cell('REVENUE');
      const op = setOperation(c, '100', userA, initialWrId);
      const stack = [stackEntry(op)];

      const result = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        expectedWorkingRevisionId: initialWrId,
        unsavedOperationStack: stack,
        source: 'AUTOSAVE',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.state).toBe('SAVED');
      expect(result.workingRevision.working_revision_id).not.toBe(initialWrId);
      expect(Number(result.workingRevision.revision_seq)).toBe(initialSeq + 1);
      expect(result.workingRevision.is_current).toBe(true);
      expect(result.workingRevision.crash_recovery_checkpoint).toBe(true); // AUTOSAVE is a crash-recovery checkpoint
      expect(result.workingRevision.checkpoint_source).toBe('AUTOSAVE');

      // the OLD row was demoted, not deleted
      const oldRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ is_current: boolean }>(`SELECT is_current FROM finance_working_revisions WHERE working_revision_id = ?`, [
          initialWrId,
        ])
      );
      expect(oldRow?.is_current).toBe(false);

      // exactly ONE is_current row remains for this artifact
      const currentRows = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ working_revision_id: string }>(
          `SELECT working_revision_id FROM finance_working_revisions WHERE artifact_id = ? AND is_current = true`,
          [created.artifact.artifact_id]
        )
      );
      expect(currentRows).toHaveLength(1);
    });

    it('an EXPLICIT_SAVE checkpoint is NOT a crash-recovery checkpoint', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      const result = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        expectedWorkingRevisionId: created.workingRevision.working_revision_id,
        unsavedOperationStack: [],
        source: 'EXPLICIT_SAVE',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.workingRevision.crash_recovery_checkpoint).toBe(false);
      expect(result.workingRevision.checkpoint_source).toBe('EXPLICIT_SAVE');
    });

    it('CONFLICT: a stale expectedWorkingRevisionId is rejected, current row untouched', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      const initialWrId = created.workingRevision.working_revision_id;

      // User A checkpoints first, advancing the current working revision.
      const advanced = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        expectedWorkingRevisionId: initialWrId,
        unsavedOperationStack: [stackEntry(setOperation(cell('A'), '1', userA, initialWrId))],
        source: 'AUTOSAVE',
      });
      expect(advanced.ok).toBe(true);

      // User B, still pinned to the STALE initial working revision, tries to checkpoint too.
      const conflicted = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userB,
        expectedWorkingRevisionId: initialWrId, // stale
        unsavedOperationStack: [stackEntry(setOperation(cell('B'), '2', userB, initialWrId))],
        source: 'AUTOSAVE',
      });
      expect(conflicted.ok).toBe(false);
      if (conflicted.ok) throw new Error('unreachable');
      expect(conflicted.state).toBe('CONFLICT');
      expect(conflicted.code).toBe('WORKING_REVISION_CONFLICT');
      if (!advanced.ok) throw new Error('unreachable');
      expect(conflicted.currentWorkingRevisionId).toBe(advanced.workingRevision.working_revision_id);

      // the rejected write did not create a stray row
      const rowCount = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM finance_working_revisions WHERE artifact_id = ?`, [
          created.artifact.artifact_id,
        ])
      );
      expect(Number(rowCount?.count)).toBe(2); // T1 create + the ONE successful (userA) checkpoint
    });

    it('peekAutosaveState reflects SAVED vs CONFLICT without writing', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      const wrId = created.workingRevision.working_revision_id;

      const saved = await autosaveService.peekAutosaveState({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        expectedWorkingRevisionId: wrId,
      });
      expect(saved.state).toBe('SAVED');

      const conflict = await autosaveService.peekAutosaveState({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        expectedWorkingRevisionId: 'not-the-real-one',
      });
      expect(conflict.state).toBe('CONFLICT');
    });
  });

  // -------------------------------------------------------------------------
  // CrashRecoveryService — detect + reconstruct + measure
  // -------------------------------------------------------------------------

  describe('crashRecoveryService — detect/reconstruct/accept/discard', () => {
    it('not recoverable: a freshly created artifact has no crash checkpoint', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      const detection = await crashRecoveryService.detectRecoverableCheckpoint({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
      });
      expect(detection).toEqual({ ok: true, recoverable: false });
    });

    it('recoverable: an AUTOSAVE checkpoint newer than the last EXPLICIT_SAVE is proposed for recovery', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      const wrId = created.workingRevision.working_revision_id;

      const explicitSave = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        expectedWorkingRevisionId: wrId,
        unsavedOperationStack: [],
        source: 'EXPLICIT_SAVE',
      });
      if (!explicitSave.ok) throw new Error('unreachable');

      const op = setOperation(cell('CASH'), '500', userA, explicitSave.workingRevision.working_revision_id);
      const autosave = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        expectedWorkingRevisionId: explicitSave.workingRevision.working_revision_id,
        unsavedOperationStack: [stackEntry(op)],
        source: 'AUTOSAVE',
      });
      if (!autosave.ok) throw new Error('unreachable');

      const detection = await crashRecoveryService.detectRecoverableCheckpoint({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
      });
      expect(detection.ok).toBe(true);
      if (!detection.ok || !detection.recoverable) throw new Error('unreachable, expected recoverable');
      expect(detection.checkpoint.workingRevisionId).toBe(autosave.workingRevision.working_revision_id);
      expect(detection.checkpoint.lastExplicitSaveWorkingRevisionId).toBe(explicitSave.workingRevision.working_revision_id);
      expect(detection.checkpoint.payload?.unsavedOperationStack).toHaveLength(1);

      const reconstructed = crashRecoveryService.reconstructOperationStack(detection.checkpoint);
      expect(reconstructed.depth()).toBe(1);
      expect(reconstructed.peekUndo()?.operation.operationId).toBe(op.operationId);
    });

    it('acceptRecovery re-checkpoints as CRASH_RECOVERY_RESTORE, still flagged crash_recovery_checkpoint=true', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      const autosave = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        expectedWorkingRevisionId: created.workingRevision.working_revision_id,
        unsavedOperationStack: [stackEntry(setOperation(cell('X'), '1', userA, created.workingRevision.working_revision_id))],
        source: 'AUTOSAVE',
      });
      if (!autosave.ok) throw new Error('unreachable');

      const detection = await crashRecoveryService.detectRecoverableCheckpoint({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
      });
      if (!detection.ok || !detection.recoverable) throw new Error('unreachable');

      const accepted = await crashRecoveryService.acceptRecovery({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        checkpoint: detection.checkpoint,
      });
      expect(accepted.ok).toBe(true);
      if (!accepted.ok) throw new Error('unreachable');
      expect(accepted.workingRevision.checkpoint_source).toBe('CRASH_RECOVERY_RESTORE');
      expect(accepted.workingRevision.crash_recovery_checkpoint).toBe(true);

      // still recoverable after accept (accept resumes, does not clear, the flag)
      const stillRecoverable = await crashRecoveryService.detectRecoverableCheckpoint({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
      });
      expect(stillRecoverable.ok && stillRecoverable.recoverable).toBe(true);
    });

    it('discardRecovery clears crash_recovery_checkpoint so re-open no longer prompts', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      const autosave = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        expectedWorkingRevisionId: created.workingRevision.working_revision_id,
        unsavedOperationStack: [stackEntry(setOperation(cell('Y'), '1', userA, created.workingRevision.working_revision_id))],
        source: 'AUTOSAVE',
      });
      if (!autosave.ok) throw new Error('unreachable');

      const detection = await crashRecoveryService.detectRecoverableCheckpoint({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
      });
      if (!detection.ok || !detection.recoverable) throw new Error('unreachable');

      const discarded = await crashRecoveryService.discardRecovery({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        checkpoint: detection.checkpoint,
      });
      expect(discarded.ok).toBe(true);

      const afterDiscard = await crashRecoveryService.detectRecoverableCheckpoint({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
      });
      expect(afterDiscard).toEqual({ ok: true, recoverable: false });
    });

    it('BENCHMARK: read + reconstruct a checkpoint with hundreds of operations completes in <=5s', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });

      const OP_COUNT = 500;
      const bigStack: FinanceUnsavedOperationStackEntry[] = Array.from({ length: OP_COUNT }, (_, i) =>
        stackEntry(setOperation(cell(`LINE_${i}`, `FY2025Q${(i % 4) + 1}`), String(i), userA, created.workingRevision.working_revision_id))
      );

      const written = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        expectedWorkingRevisionId: created.workingRevision.working_revision_id,
        unsavedOperationStack: bigStack,
        source: 'AUTOSAVE',
      });
      expect(written.ok).toBe(true);

      const startedAt = Date.now();
      const detection = await crashRecoveryService.detectRecoverableCheckpoint({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
      });
      if (!detection.ok || !detection.recoverable) throw new Error('unreachable, expected recoverable');
      const stack = crashRecoveryService.reconstructOperationStack(detection.checkpoint, { maxDepth: OP_COUNT });
      const elapsedMs = Date.now() - startedAt;

      expect(stack.depth()).toBe(OP_COUNT);
      expect(elapsedMs).toBeLessThanOrEqual(5000);
      // eslint-disable-next-line no-console
      console.log(`[AP-04 benchmark] crash-recovery read+reconstruct of ${OP_COUNT} operations: ${elapsedMs}ms`);
    });
  });

  // -------------------------------------------------------------------------
  // ConflictResolver — mine/theirs/base
  // -------------------------------------------------------------------------

  describe('conflictResolver.detectConflicts — mine/theirs/base', () => {
    it('no conflict when the two users touch DIFFERENT cells', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      const baseWrId = created.workingRevision.working_revision_id;

      const theirsCheckpoint = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userB,
        expectedWorkingRevisionId: baseWrId,
        unsavedOperationStack: [stackEntry(setOperation(cell('OPEX'), '77', userB, baseWrId))],
        source: 'AUTOSAVE',
      });
      if (!theirsCheckpoint.ok) throw new Error('unreachable');

      const myStack = [stackEntry(setOperation(cell('REVENUE'), '100', userA, baseWrId))];
      const detection = await conflictResolver.detectConflicts({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        baseWorkingRevisionId: baseWrId,
        myUnsavedOperationStack: myStack,
      });
      expect(detection.ok).toBe(true);
      if (!detection.ok) throw new Error('unreachable');
      expect(detection.result.hasConflicts).toBe(false);
      expect(detection.result.conflicts).toHaveLength(0);
    });

    it('detects a conflict when both users edit the SAME cell, and buildResolvedOperation applies the chosen side', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      const baseWrId = created.workingRevision.working_revision_id;
      const sharedCell = cell('REVENUE');

      const theirsCheckpoint = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userB,
        expectedWorkingRevisionId: baseWrId,
        unsavedOperationStack: [stackEntry(setOperation(sharedCell, '999', userB, baseWrId))],
        source: 'AUTOSAVE',
      });
      if (!theirsCheckpoint.ok) throw new Error('unreachable');

      const myStack = [stackEntry(setOperation(sharedCell, '111', userA, baseWrId))];
      const detection = await conflictResolver.detectConflicts({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        baseWorkingRevisionId: baseWrId,
        myUnsavedOperationStack: myStack,
      });
      expect(detection.ok).toBe(true);
      if (!detection.ok) throw new Error('unreachable');
      expect(detection.result.hasConflicts).toBe(true);
      expect(detection.result.conflicts).toHaveLength(1);

      const [conflict] = detection.result.conflicts;
      expect(conflict.mine).toEqual({ status: 'PRESENT_NONZERO', valueDecimal: '111' });
      expect(conflict.theirs).toEqual({ status: 'PRESENT_NONZERO', valueDecimal: '999' });
      expect(conflict.resolutionOptions).toEqual(['MINE', 'THEIRS', 'MERGE_PER_CELL']);

      // User resolves: keep MINE for this cell.
      const resolved = conflictResolver.buildResolvedOperation(
        detection.result.conflicts,
        [{ cellRef: conflict.cellRef, choice: 'MINE' }],
        {
          operationId: `resolve-${randomUUID()}`,
          idempotencyKey: `resolve-idem-${randomUUID()}`,
          actorId: userA,
          actorRole: 'preparer',
          clientTimestamp: new Date().toISOString(),
          sourceWorkingRevisionId: detection.result.currentWorkingRevisionId,
        }
      );
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) throw new Error('unreachable');
      expect(resolved.operation.type).toBe('paste');
      if (resolved.operation.type !== 'paste') throw new Error('unreachable');
      expect(resolved.operation.values[0]).toEqual({ status: 'PRESENT_NONZERO', valueDecimal: '111' });
    });

    it('buildResolvedOperation with MERGE_PER_CELL requires an explicit mergedValue', () => {
      const conflict = {
        cellRef: cell('REVENUE'),
        mine: { status: 'PRESENT_NONZERO' as const, valueDecimal: '1' },
        theirsWorkingRevisionId: 'wr-x',
        theirsRevisionSeq: 2,
        theirs: { status: 'PRESENT_NONZERO' as const, valueDecimal: '2' },
        theirsEditedBy: userB,
        theirsEditedAt: new Date().toISOString(),
        resolutionOptions: ['MINE', 'THEIRS', 'MERGE_PER_CELL'] as const,
      };
      const missing = conflictResolver.buildResolvedOperation(
        [conflict],
        [{ cellRef: conflict.cellRef, choice: 'MERGE_PER_CELL' }],
        {
          operationId: 'x',
          idempotencyKey: 'y',
          actorId: userA,
          actorRole: 'preparer',
          clientTimestamp: new Date().toISOString(),
          sourceWorkingRevisionId: null,
        }
      );
      expect(missing).toEqual({ ok: false, code: 'MISSING_MERGED_VALUE', message: expect.any(String) });
    });
  });

  // -------------------------------------------------------------------------
  // ComputePinning
  // -------------------------------------------------------------------------

  describe('computePinning.enqueueComputeForCurrentRevision', () => {
    it('pins to the CURRENT content_semantic_hash, and a later edit gets a DIFFERENT pinned hash', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'BASELINE_MODEL',
        createdBy: userA,
      });

      // No checkpoint yet -> no content_semantic_hash yet.
      const tooEarly = await computePinning.enqueueComputeForCurrentRevision({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        jobType: `ap04_pin_test_${randomUUID()}`,
        engineManifestId: created.businessVersion.engine_manifest_id,
        idempotencyKey: `pin-${randomUUID()}`,
        requestedByUserId: userA,
      });
      expect(tooEarly).toEqual({ ok: false, code: 'NO_CONTENT_HASH', message: expect.any(String) });

      const firstCheckpoint = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        expectedWorkingRevisionId: created.workingRevision.working_revision_id,
        unsavedOperationStack: [stackEntry(setOperation(cell('REVENUE'), '10', userA, created.workingRevision.working_revision_id))],
        source: 'AUTOSAVE',
      });
      if (!firstCheckpoint.ok) throw new Error('unreachable');

      const jobType = `ap04_pin_test_${randomUUID()}`;
      const firstEnqueue = await computePinning.enqueueComputeForCurrentRevision({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        jobType,
        engineManifestId: created.businessVersion.engine_manifest_id,
        idempotencyKey: `pin-first-${randomUUID()}`,
        requestedByUserId: userA,
      });
      expect(firstEnqueue.ok).toBe(true);
      if (!firstEnqueue.ok) throw new Error('unreachable');
      expect(firstEnqueue.pinnedContentSemanticHash).toBe(firstCheckpoint.workingRevision.content_semantic_hash);
      expect(firstEnqueue.job.input_revision_hash).toBe(firstCheckpoint.workingRevision.content_semantic_hash);

      // Someone edits again -> a NEW checkpoint -> a DIFFERENT content_semantic_hash.
      const secondCheckpoint = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        actorId: userA,
        expectedWorkingRevisionId: firstCheckpoint.workingRevision.working_revision_id,
        unsavedOperationStack: [stackEntry(setOperation(cell('REVENUE'), '20', userA, firstCheckpoint.workingRevision.working_revision_id))],
        source: 'AUTOSAVE',
      });
      if (!secondCheckpoint.ok) throw new Error('unreachable');
      expect(secondCheckpoint.workingRevision.content_semantic_hash).not.toBe(firstCheckpoint.workingRevision.content_semantic_hash);

      const secondEnqueue = await computePinning.enqueueComputeForCurrentRevision({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        jobType,
        engineManifestId: created.businessVersion.engine_manifest_id,
        idempotencyKey: `pin-second-${randomUUID()}`,
        requestedByUserId: userA,
      });
      expect(secondEnqueue.ok).toBe(true);
      if (!secondEnqueue.ok) throw new Error('unreachable');
      expect(secondEnqueue.pinnedContentSemanticHash).toBe(secondCheckpoint.workingRevision.content_semantic_hash);
      // the OLD job's pinned hash is untouched — never silently swapped
      expect(firstEnqueue.job.input_revision_hash).not.toBe(secondEnqueue.job.input_revision_hash);
    });
  });
});

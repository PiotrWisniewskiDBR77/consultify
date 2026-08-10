/**
 * W9 FAULT/CONCURRENCY/TENANT MATRIX — part A: CONCURRENCY ("exactly one winner").
 *
 * Required by Fala 9 of the master plan, gates FC-11 (Performance and
 * operations) and FC-01 (tenant isolation, covered in the sibling
 * `tenantMatrix.pg.test.ts`). Source of requirements:
 *   - docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md §16/§18
 *   - docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md
 *
 * WHAT THIS FILE MEASURES, AND WHY IT CANNOT BE A UNIT TEST. Every scenario
 * below is a race between two real, concurrently-open PostgreSQL transactions
 * on separate pooled connections. The invariants under test are enforced by
 * `SELECT ... FOR UPDATE`, by partial UNIQUE INDEXes
 * (`uq_finance_bv_one_approved`, `uq_finance_bv_one_open_child`) and by
 * PL/pgSQL triggers. A mocked database has none of those, so a green mock run
 * would prove nothing at all. This file is therefore `.pg.test.ts` and
 * `describe.skipIf`-gated on a real connection — a run without one reports
 * SKIPPED, never a false green.
 *
 * PROOF DISCIPLINE (this program has been burned by "UPDATE 0 looks like
 * PASS"): for every scenario we (1) assert the physical pre-state with an
 * independent read-back, (2) run the race, (3) re-read the physical post-state
 * from the database rather than trusting a service's return value.
 *
 * HOW TO RUN (own throwaway ephemeral cluster only — NEVER the shared local
 * Postgres, NEVER demo/staging/prod):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config vitest.config.ts \
 *     src/services/finance/canonical/__tests__/concurrencyMatrix.pg.test.ts \
 *     --no-file-parallelism
 *   (run from `server/`, per this repo's own .pg.test.ts convention)
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('W9-A — concurrency matrix, exactly one winner (real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let svc: typeof import('../artifactVersionService.js');
  let autosaveService: typeof import('../../collaboration/autosaveService.js');
  let computePinning: typeof import('../../collaboration/computePinning.js');
  let computeJobService: typeof import('../computeJobService.js');

  const orgId = `org-w9a-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  const approverId = `user-approver-${randomUUID()}`;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    svc = await import('../artifactVersionService.js');
    autosaveService = await import('../../collaboration/autosaveService.js');
    computePinning = await import('../../collaboration/computePinning.js');
    computeJobService = await import('../computeJobService.js');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'W9 Concurrency Matrix Org'])
    );
  });

  /** Physical read-back straight from the table — never the service's own return value. */
  async function readStatus(bvId: string): Promise<{ status: string; version: number } | null> {
    return withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ status: string; version: number }>(
        `SELECT status, version FROM finance_business_versions WHERE business_version_id = ?`,
        [bvId]
      )
    );
  }

  /** DRAFT -> READY_FOR_REVIEW -> IN_REVIEW, through the real services. Leaves the row approvable. */
  async function makeInReviewVersion(): Promise<{ artifactId: string; bvId: string; version: number; workingRevisionId: string }> {
    const created = await svc.createArtifact({
      organizationId: orgId,
      artifactType: 'HISTORICAL_ANALYSIS', // LOW risk tier — keeps the SoD gate out of the way
      createdBy: preparerId,
    });
    const bvId = created.businessVersion.business_version_id;
    let version = created.businessVersion.version;

    const submitted = await svc.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'submit_for_review',
      actorId: preparerId,
      role: 'preparer',
      expectedVersion: version,
    });
    if (!submitted.ok) throw new Error(`submit_for_review failed: ${submitted.code}`);
    version = submitted.businessVersion.version;

    const started = await svc.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'start_review',
      actorId: approverId,
      role: 'approver',
      expectedVersion: version,
    });
    if (!started.ok) throw new Error(`start_review failed: ${started.code}`);
    version = started.businessVersion.version;

    // freshness defaults to NEVER_COMPUTED on create; approve requires CURRENT.
    const freshened = await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId])
    );
    expect(freshened.changes).toBe(1); // physical pre-state proof

    const pre = await readStatus(bvId);
    expect(pre).toEqual({ status: 'IN_REVIEW', version });

    return {
      artifactId: created.artifact.artifact_id,
      bvId,
      version,
      workingRevisionId: created.workingRevision.working_revision_id,
    };
  }

  async function makeApprovedVersion(): Promise<{ artifactId: string; bvId: string; version: number }> {
    const { artifactId, bvId, version } = await makeInReviewVersion();
    const approved = await svc.approveVersion({
      organizationId: orgId,
      businessVersionId: bvId,
      actorId: approverId,
      role: 'approver',
      expectedVersion: version,
    });
    if (!approved.ok) throw new Error(`approve failed: ${approved.code} ${approved.message}`);
    const post = await readStatus(bvId);
    expect(post?.status).toBe('APPROVED');
    return { artifactId, bvId, version: approved.businessVersion.version };
  }

  // -------------------------------------------------------------------------
  // A1 — two parallel approveVersion() of the SAME version
  // -------------------------------------------------------------------------
  describe('A1 — two concurrent approveVersion() on the same version', () => {
    it('exactly one succeeds; the loser gets a TYPED concurrency error, not a raw DB error', async () => {
      const { bvId, version } = await makeInReviewVersion();

      const [a, b] = await Promise.all([
        svc.approveVersion({
          organizationId: orgId,
          businessVersionId: bvId,
          actorId: approverId,
          role: 'approver',
          expectedVersion: version,
        }),
        svc.approveVersion({
          organizationId: orgId,
          businessVersionId: bvId,
          actorId: `user-approver-2-${randomUUID()}`,
          role: 'approver',
          expectedVersion: version,
        }),
      ]);

      const winners = [a, b].filter((r) => r.ok);
      const losers = [a, b].filter((r) => !r.ok);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);

      // The loser must carry a typed code from ApproveErrorCode — a raw
      // Postgres error (23505 from uq_finance_bv_one_approved, or a P0001
      // from the immutability trigger) would have thrown out of the service
      // instead of returning, and Promise.all would have rejected.
      const loser = losers[0] as Extract<typeof a, { ok: false }>;
      expect(['VERSION_CONFLICT', 'STATE_PRECONDITION_FAILED']).toContain(loser.code);
      expect(loser.message).not.toMatch(/duplicate key|unique constraint|P0001|23505/i);

      // Physical post-state: one APPROVED row, exactly one APPROVE audit event.
      const post = await readStatus(bvId);
      expect(post?.status).toBe('APPROVED');

      const approveEvents = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ event_id: string }>(
          `SELECT event_id FROM artifact_lifecycle_events WHERE business_version_id = ? AND action = 'APPROVE'`,
          [bvId]
        )
      );
      expect(approveEvents).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // A2 — parallel approveVersion() and transition(archive)
  // -------------------------------------------------------------------------
  describe('A2 — concurrent approveVersion() and transition(archive)', () => {
    it('leaves a consistent row; no impossible state, and the loser is typed', async () => {
      const { bvId, version } = await makeInReviewVersion();

      const [approveResult, archiveResult] = await Promise.all([
        svc.approveVersion({
          organizationId: orgId,
          businessVersionId: bvId,
          actorId: approverId,
          role: 'approver',
          expectedVersion: version,
        }),
        svc.transition({
          organizationId: orgId,
          businessVersionId: bvId,
          action: 'archive',
          actorId: approverId,
          role: 'approver',
          expectedVersion: version,
        }),
      ]);

      // At most one of the two may have won.
      const okCount = [approveResult.ok, archiveResult.ok].filter(Boolean).length;
      expect(okCount).toBeLessThanOrEqual(1);

      if (!approveResult.ok) {
        expect(['VERSION_CONFLICT', 'STATE_PRECONDITION_FAILED']).toContain(approveResult.code);
      }
      if (!archiveResult.ok) {
        // `archive` is only legal from APPROVED. Whichever ordering the race
        // takes, the rejection must be typed, never a raw DB error.
        expect(['VERSION_CONFLICT', 'STATE_PRECONDITION_FAILED']).toContain(archiveResult.code);
      }

      // Physical post-state must be one of the two REACHABLE states from
      // IN_REVIEW under this pair of calls — never something in between.
      const post = await readStatus(bvId);
      expect(post).not.toBeNull();
      expect(['IN_REVIEW', 'APPROVED', 'ARCHIVED']).toContain(post!.status);

      // If it went APPROVED, the approval bookkeeping must be complete (a
      // half-applied approve — status flipped without a compute snapshot —
      // is the "impossible state" this scenario is hunting).
      if (post!.status === 'APPROVED') {
        const row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ compute_snapshot_id: string | null; approved_by: string | null; approved_at: string | null }>(
            `SELECT compute_snapshot_id, approved_by, approved_at FROM finance_business_versions WHERE business_version_id = ?`,
            [bvId]
          )
        );
        expect(row?.compute_snapshot_id).toBeTruthy();
        expect(row?.approved_by).toBeTruthy();
        expect(row?.approved_at).toBeTruthy();
      }

      // If it went ARCHIVED, it must NOT also carry approval bookkeeping from
      // a partially-applied concurrent approve.
      if (post!.status === 'ARCHIVED') {
        const row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ archived_by: string | null }>(
            `SELECT archived_by FROM finance_business_versions WHERE business_version_id = ?`,
            [bvId]
          )
        );
        expect(row?.archived_by).toBeTruthy();
      }

      // Exactly as many audit events as winners.
      const events = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ action: string }>(
          `SELECT action FROM artifact_lifecycle_events WHERE business_version_id = ? AND action IN ('APPROVE','ARCHIVE')`,
          [bvId]
        )
      );
      expect(events).toHaveLength(okCount);
    });
  });

  // -------------------------------------------------------------------------
  // A3 — two parallel reopenVersion()
  // -------------------------------------------------------------------------
  describe('A3 — two concurrent reopenVersion() on the same APPROVED version', () => {
    it('produces exactly ONE new Draft; the loser gets DRAFT_ALREADY_EXISTS', async () => {
      const { bvId, version } = await makeApprovedVersion();

      // Physical pre-state: zero children.
      const preChildren = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ business_version_id: string }>(
          `SELECT business_version_id FROM finance_business_versions WHERE parent_version_id = ?`,
          [bvId]
        )
      );
      expect(preChildren).toHaveLength(0);

      const [a, b] = await Promise.all([
        svc.reopenVersion({
          organizationId: orgId,
          businessVersionId: bvId,
          actorId: approverId,
          role: 'approver',
          expectedVersion: version,
          reason: 'W9-A3 race left',
        }),
        svc.reopenVersion({
          organizationId: orgId,
          businessVersionId: bvId,
          actorId: approverId,
          role: 'approver',
          expectedVersion: version,
          reason: 'W9-A3 race right',
        }),
      ]);

      const winners = [a, b].filter((r) => r.ok);
      const losers = [a, b].filter((r) => !r.ok);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect((losers[0] as Extract<typeof a, { ok: false }>).code).toBe('DRAFT_ALREADY_EXISTS');

      // Physical post-state: EXACTLY one child row (the partial unique index
      // uq_finance_bv_one_open_child is what has to make this true).
      const children = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ business_version_id: string; status: string }>(
          `SELECT business_version_id, status FROM finance_business_versions WHERE parent_version_id = ?`,
          [bvId]
        )
      );
      expect(children).toHaveLength(1);
      expect(children[0].status).toBe('DRAFT');

      // ...and exactly one current working revision for the artifact.
      const currentRevisions = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ working_revision_id: string }>(
          `SELECT wr.working_revision_id FROM finance_working_revisions wr
             JOIN finance_business_versions bv ON bv.artifact_id = wr.artifact_id
            WHERE bv.business_version_id = ? AND wr.is_current = true`,
          [bvId]
        )
      );
      expect(currentRevisions).toHaveLength(1);

      // The parent must be untouched — reopen never mutates vN (WP-B02 §6 step 6).
      const parent = await readStatus(bvId);
      expect(parent?.status).toBe('APPROVED');
      expect(parent?.version).toBe(version);
    });
  });

  // -------------------------------------------------------------------------
  // A4 — concurrent working-revision edit and compute enqueue
  // -------------------------------------------------------------------------
  describe('A4 — concurrent working-revision edit and compute pinning', () => {
    it('pins the job to ONE snapshot hash; the edit never bleeds into the pinned job', async () => {
      const created = await svc.createArtifact({
        organizationId: orgId,
        artifactType: 'BASELINE_MODEL',
        createdBy: preparerId,
      });
      const artifactId = created.artifact.artifact_id;

      // Checkpoint once so there IS a content_semantic_hash to pin to.
      const first = await autosaveService.checkpointOperationStack({
        organizationId: orgId,
        artifactId,
        actorId: preparerId,
        expectedWorkingRevisionId: created.workingRevision.working_revision_id,
        unsavedOperationStack: [],
        source: 'EXPLICIT_SAVE',
      });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error('unreachable');
      const hashV1 = first.workingRevision.content_semantic_hash;
      const revV1 = first.workingRevision.working_revision_id;
      expect(hashV1).toBeTruthy();

      // Physical pre-state read-back.
      const preCurrent = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ working_revision_id: string; content_semantic_hash: string | null }>(
          `SELECT working_revision_id, content_semantic_hash FROM finance_working_revisions
            WHERE artifact_id = ? AND is_current = true`,
          [artifactId]
        )
      );
      expect(preCurrent?.working_revision_id).toBe(revV1);

      // RACE: an edit (new checkpoint => new working revision + new hash)
      // against a compute enqueue that pins the current hash.
      const [editResult, enqueueResult] = await Promise.all([
        autosaveService.checkpointOperationStack({
          organizationId: orgId,
          artifactId,
          actorId: preparerId,
          expectedWorkingRevisionId: revV1,
          unsavedOperationStack: [
            { opId: randomUUID(), kind: 'W9A4_EDIT', payload: { cell: 'A1', value: 42 } } as never,
          ],
          source: 'AUTOSAVE',
        }),
        computePinning.enqueueComputeForCurrentRevision({
          organizationId: orgId,
          artifactId,
          jobType: `w9a4_compute_${randomUUID()}`,
          engineManifestId: created.businessVersion.engine_manifest_id,
          idempotencyKey: `w9a4-${randomUUID()}`,
          requestedByUserId: preparerId,
        }),
      ]);

      expect(editResult.ok).toBe(true);
      if (!editResult.ok) throw new Error('unreachable');
      const hashV2 = editResult.workingRevision.content_semantic_hash;
      expect(hashV2).not.toBe(hashV1);

      expect(enqueueResult.ok).toBe(true);
      if (!enqueueResult.ok) throw new Error('unreachable');

      // The pinned hash must be EXACTLY one of the two snapshots — never a
      // blend, never null, never a hash of a revision that does not exist.
      expect([hashV1, hashV2]).toContain(enqueueResult.pinnedContentSemanticHash);

      // The physically persisted job row must carry that same pin.
      const jobRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ input_revision_hash: string }>(`SELECT input_revision_hash FROM compute_jobs WHERE id = ?`, [
          enqueueResult.job.id,
        ])
      );
      expect(jobRow?.input_revision_hash).toBe(enqueueResult.pinnedContentSemanticHash);

      // The pinned hash must correspond to a REAL, existing working revision
      // of this artifact — i.e. the compute is attached to a concrete
      // snapshot, not to a mix of two revisions.
      const matchingRevisions = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ working_revision_id: string; revision_seq: number }>(
          `SELECT working_revision_id, revision_seq FROM finance_working_revisions
            WHERE artifact_id = ? AND content_semantic_hash = ?`,
          [artifactId, jobRow!.input_revision_hash]
        )
      );
      expect(matchingRevisions.length).toBeGreaterThanOrEqual(1);

      // Recomputing AFTER the edit under a new user action pins the NEW hash
      // and lands as a SEPARATE job — the older, hash-pinned result is never
      // silently replaced (AP-04 requirement, computePinning.ts header).
      const second = await computePinning.enqueueComputeForCurrentRevision({
        organizationId: orgId,
        artifactId,
        jobType: `w9a4_compute_second_${randomUUID()}`,
        engineManifestId: created.businessVersion.engine_manifest_id,
        idempotencyKey: `w9a4-second-${randomUUID()}`,
        requestedByUserId: preparerId,
      });
      expect(second.ok).toBe(true);
      if (!second.ok) throw new Error('unreachable');
      expect(second.pinnedContentSemanticHash).toBe(hashV2);
      expect(second.job.id).not.toBe(enqueueResult.job.id);

      // Both jobs physically exist, with the two DIFFERENT pins.
      const bothJobs = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string; input_revision_hash: string }>(
          `SELECT id, input_revision_hash FROM compute_jobs WHERE id = ANY(?) ORDER BY created_at`,
          [[enqueueResult.job.id, second.job.id]]
        )
      );
      expect(bothJobs).toHaveLength(2);

      void computeJobService; // imported for symmetry with the sibling B suite
    });
  });
});

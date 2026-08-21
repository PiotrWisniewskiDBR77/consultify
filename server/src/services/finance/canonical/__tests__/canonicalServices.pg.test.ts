/**
 * Finance v3 canonical services — real PostgreSQL integration test.
 *
 * Gate C, WP-C02. Exercises `artifactVersionService`, `lineageService`,
 * `computeJobService` and `exceptionLedgerService` against the ACTUAL
 * migrated schema (`server/migrations/20260809_finance_v3_b0*.sql`), not a
 * throwaway hand-rolled schema — the whole point of these services is the
 * DB triggers/constraints those migrations installed (immutability,
 * append-only, cycle prevention, `FOR UPDATE SKIP LOCKED`), which a mocked
 * or reinvented schema cannot prove.
 *
 * Same env-var contract as this repo's other `.pg.test.ts` suites
 * (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`) —
 * `describe.skipIf`-gated so a run with no real database reachable reports
 * SKIPPED, never a false green.
 *
 * Isolation: every test run uses one freshly generated organization id, so
 * this file never disturbs another file's rows (same convention as
 * `documentSourcePackPersistence.pg.test.ts` in this repo). `afterAll` best-
 * effort-cleans the rows that ARE deletable (`compute_jobs`/
 * `compute_job_runs`, which carry no deny-delete trigger). It deliberately
 * does NOT attempt to delete `finance_artifacts` / `finance_business_versions`
 * / `finance_working_revisions` / `organizations` — once this suite's own
 * `artifact_lifecycle_events`/`finance_exceptions`/`finance_lineage_edges`/
 * `finance_compute_snapshots` rows exist (all four tables are append-only:
 * `BEFORE DELETE` triggers reject any delete, by design — see the B02/B03/
 * B05/B06 migrations), the FK chain makes those parent rows structurally
 * undeletable via DML. That is not a test bug; it is this schema's
 * append-only guarantee working exactly as intended, one layer up from the
 * dedicated trigger-rejection tests below.
 *
 * HOW TO RUN (against your own throwaway/ephemeral cluster — see
 * `docs/validation/finance-v3/generated/gate-c/WP-C01_migration_report.md`
 * §1 for the isolation procedure; NEVER against the shared local Postgres
 * or any demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts \
 *     --no-file-parallelism
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Finance v3 canonical services — real PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let lineageService: typeof import('../lineageService.js');
  let computeJobService: typeof import('../computeJobService.js');
  let exceptionLedgerService: typeof import('../exceptionLedgerService.js');

  const orgId = `org-finv3-c02-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  const approverId = `user-approver-${randomUUID()}`;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    lineageService = await import('../lineageService.js');
    computeJobService = await import('../computeJobService.js');
    exceptionLedgerService = await import('../exceptionLedgerService.js');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'FinV3 C02 Test Org'])
    );
  });

  afterAll(async () => {
    // Best-effort only — see the file header comment. `compute_job_outputs`/
    // `compute_job_runs`/`compute_jobs` have no deny-delete trigger and no
    // append-only child referencing them, so they ARE safely deletable.
    // Everything else this suite created (artifacts, business versions,
    // working revisions, the organization row) is transitively undeletable
    // once an append-only child row (lifecycle event / exception / lineage
    // edge / compute snapshot) exists, by design.
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`DELETE FROM compute_job_outputs WHERE organization_id = ?`, [orgId]);
      await tx.queryRun(
        `DELETE FROM compute_job_runs WHERE job_id IN (SELECT id FROM compute_jobs WHERE organization_id = ?)`,
        [orgId]
      );
      await tx.queryRun(`DELETE FROM compute_jobs WHERE organization_id = ?`, [orgId]);
    });
  });

  describe('artifactVersionService — create, transition, atomic approve', () => {
    it('createArtifact makes an artifact + v1 DRAFT business version + v1 working revision', async () => {
      const result = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'BASELINE_MODEL',
        createdBy: preparerId,
      });
      expect(result.artifact.artifact_id).toBeTruthy();
      expect(result.businessVersion.status).toBe('DRAFT');
      expect(result.businessVersion.version_no).toBe(1);
      expect(result.businessVersion.risk_tier).toBe('MATERIAL'); // default for BASELINE_MODEL
      expect(result.workingRevision.is_current).toBe(true);
      // BIGINT columns come back from `pg` as strings to avoid JS precision
      // loss, hence Number(...) here rather than a direct `.toBe(1)`.
      expect(Number(result.workingRevision.revision_seq)).toBe(1);
    });

    it('the full T2->T4 transition chain then approveVersion succeeds and freezes a compute snapshot', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'HISTORICAL_ANALYSIS', // LOW risk tier -> no SoD gate, simpler happy path
        createdBy: preparerId,
      });
      let bvId = created.businessVersion.business_version_id;
      let version = created.businessVersion.version;

      const submitted = await artifactVersionService.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'submit_for_review',
        actorId: preparerId,
        role: 'preparer',
        expectedVersion: version,
      });
      expect(submitted.ok).toBe(true);
      if (!submitted.ok) throw new Error('unreachable');
      expect(submitted.businessVersion.status).toBe('READY_FOR_REVIEW');
      expect(submitted.businessVersion.submitted_by).toBe(preparerId);
      version = submitted.businessVersion.version;

      const started = await artifactVersionService.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'start_review',
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      expect(started.ok).toBe(true);
      if (!started.ok) throw new Error('unreachable');
      expect(started.businessVersion.status).toBe('IN_REVIEW');
      version = started.businessVersion.version;

      // freshness defaults to NEVER_COMPUTED on create — approve requires CURRENT (WP-B02 §5.1).
      const blockedByFreshness = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: bvId,
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      expect(blockedByFreshness.ok).toBe(false);
      if (blockedByFreshness.ok) throw new Error('unreachable');
      expect(blockedByFreshness.code).toBe('APPROVAL_BLOCKED');

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId])
      );

      const approved = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: bvId,
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
        idempotencyKey: 'idem-approve-1',
      });
      expect(approved.ok).toBe(true);
      if (!approved.ok) throw new Error('unreachable');
      expect(approved.businessVersion.status).toBe('APPROVED');
      expect(approved.computeSnapshotId).toBeTruthy();
      expect(approved.idempotentReplay).toBe(false);

      // Idempotent replay: same key, same version arg (server ignores staleness on replay path).
      const replay = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: bvId,
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
        idempotencyKey: 'idem-approve-1',
      });
      expect(replay.ok).toBe(true);
      if (!replay.ok) throw new Error('unreachable');
      expect(replay.idempotentReplay).toBe(true);
      expect(replay.businessVersion.status).toBe('APPROVED');
    });

    it('approve rejects with VERSION_CONFLICT on a stale expectedVersion (CAS)', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'HISTORICAL_ANALYSIS',
        createdBy: preparerId,
      });
      const bvId = created.businessVersion.business_version_id;
      const result = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: bvId,
        actorId: approverId,
        role: 'approver',
        expectedVersion: 999,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code).toBe('VERSION_CONFLICT');
      expect(result.currentVersion).toBe(created.businessVersion.version);
    });

    it('MATERIAL/HIGH_RISK artifacts reject self-approval (approver === submitted_by)', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'VALUATION_CASE', // HIGH_RISK
        createdBy: preparerId,
      });
      const bvId = created.businessVersion.business_version_id;
      let version = created.businessVersion.version;

      const submitted = await artifactVersionService.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'submit_for_review',
        actorId: preparerId,
        role: 'preparer',
        expectedVersion: version,
      });
      if (!submitted.ok) throw new Error('unreachable');
      version = submitted.businessVersion.version;

      const started = await artifactVersionService.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'start_review',
        actorId: preparerId, // same actor as submitter, allowed for start_review itself
        role: 'finance_admin',
        expectedVersion: version,
      });
      if (!started.ok) throw new Error('unreachable');
      version = started.businessVersion.version;

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId])
      );

      const result = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: bvId,
        actorId: preparerId, // same user who submitted -> SoD violation
        role: 'finance_admin',
        expectedVersion: version,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code).toBe('SELF_APPROVAL_FORBIDDEN');
    });
  });

  describe('artifactVersionService.createComputeSnapshot — IF-19 fix (Advisor pre-approval sequencing)', () => {
    // Regression coverage for IF-19 (GOLDCO_FULL_DAG_END_TO_END_REPORT.md section 4,
    // BUGFIX_IF19_ADVISOR_SEQUENCING_report.md): before this fix, the ONLY code path that ever
    // inserted a `finance_compute_snapshots` row was `approveVersion()` step (b), which runs
    // strictly AFTER `finance_valuation_advisor_outputs_no_new_after_approval()` (WP-D09b)
    // already forbids new Advisor rows for that business_version_id — a real deadlock. These
    // tests would have been IMPOSSIBLE to write against the pre-fix code (the INSERT below would
    // have needed a compute_snapshot_id that could only be minted by an act — approval — that
    // simultaneously forbids the very INSERT it is meant to unblock).
    it('creates a pre-approval snapshot while DRAFT, and a real Advisor row can be written against it before approval', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'VALUATION_CASE',
        createdBy: preparerId,
      });
      const bvId = created.businessVersion.business_version_id;

      const snap = await artifactVersionService.createComputeSnapshot({
        organizationId: orgId,
        businessVersionId: bvId,
        actorId: preparerId,
      });
      expect(snap.ok).toBe(true);
      if (!snap.ok) throw new Error('unreachable');
      expect(snap.computeSnapshotId).toBeTruthy();
      expect(snap.reused).toBe(false);

      // The actual IF-19 proof: finance_valuation_advisor_outputs.compute_snapshot_id is NOT NULL
      // REFERENCES finance_compute_snapshots — this INSERT would have been unsatisfiable before
      // the fix (no snapshot could ever exist this early). The business_version is still DRAFT.
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_valuation_advisor_outputs (
             organization_id, business_version_id, compute_snapshot_id, output_kind, title, narrative,
             evidence_ref, ai_provider, ai_model, ai_prompt_version, ai_no_training_commitment, ai_evidence_digest, created_by
           ) VALUES (?, ?, ?, 'FACT', 'IF-19 regression', 'Pre-approval Advisor write', ?, 'MANUAL_PROGRAMMATIC', 'test', 'v1', true, ?, ?)`,
          [orgId, bvId, snap.computeSnapshotId, JSON.stringify({ source: 'test' }), 'sha256:if19-regression', preparerId]
        )
      );

      const rows = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ is_frozen: boolean; compute_snapshot_id: string }>(
          `SELECT is_frozen, compute_snapshot_id FROM finance_valuation_advisor_outputs WHERE business_version_id = ?`,
          [bvId]
        )
      );
      expect(rows.length).toBe(1);
      expect(rows[0].is_frozen).toBe(false); // not yet approved
      expect(rows[0].compute_snapshot_id).toBe(snap.computeSnapshotId);
    });

    it('a second call for the SAME current working revision reuses the existing snapshot (no duplicate row)', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'VALUATION_CASE',
        createdBy: preparerId,
      });
      const bvId = created.businessVersion.business_version_id;

      const first = await artifactVersionService.createComputeSnapshot({ organizationId: orgId, businessVersionId: bvId, actorId: preparerId });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error('unreachable');
      expect(first.reused).toBe(false);

      const second = await artifactVersionService.createComputeSnapshot({ organizationId: orgId, businessVersionId: bvId, actorId: preparerId });
      expect(second.ok).toBe(true);
      if (!second.ok) throw new Error('unreachable');
      expect(second.reused).toBe(true);
      expect(second.computeSnapshotId).toBe(first.computeSnapshotId);
    });

    it('is rejected once the business_version is APPROVED (mirrors the DB trigger it exists to satisfy)', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'HISTORICAL_ANALYSIS',
        createdBy: preparerId,
      });
      let bvId = created.businessVersion.business_version_id;
      let version = created.businessVersion.version;

      const submitted = await artifactVersionService.transition({ organizationId: orgId, businessVersionId: bvId, action: 'submit_for_review', actorId: preparerId, role: 'preparer', expectedVersion: version });
      if (!submitted.ok) throw new Error('unreachable');
      version = submitted.businessVersion.version;
      const started = await artifactVersionService.transition({ organizationId: orgId, businessVersionId: bvId, action: 'start_review', actorId: approverId, role: 'approver', expectedVersion: version });
      if (!started.ok) throw new Error('unreachable');
      version = started.businessVersion.version;
      await withPinnedPostgresTransaction((tx) => tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId]));

      const approved = await artifactVersionService.approveVersion({ organizationId: orgId, businessVersionId: bvId, actorId: approverId, role: 'approver', expectedVersion: version });
      expect(approved.ok).toBe(true);
      if (!approved.ok) throw new Error('unreachable');

      const rejected = await artifactVersionService.createComputeSnapshot({ organizationId: orgId, businessVersionId: bvId, actorId: approverId });
      expect(rejected.ok).toBe(false);
      if (rejected.ok) throw new Error('unreachable');
      expect(rejected.code).toBe('INVALID_STATUS');
      expect(rejected.currentStatus).toBe('APPROVED');
    });

    it('approveVersion() reuses a pre-approval snapshot for the SAME working revision instead of creating a second one', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'HISTORICAL_ANALYSIS',
        createdBy: preparerId,
      });
      let bvId = created.businessVersion.business_version_id;
      let version = created.businessVersion.version;

      // Pre-approval snapshot, exactly like a future AdvisorGenerationService would create.
      const preSnap = await artifactVersionService.createComputeSnapshot({ organizationId: orgId, businessVersionId: bvId, actorId: preparerId });
      expect(preSnap.ok).toBe(true);
      if (!preSnap.ok) throw new Error('unreachable');

      const submitted = await artifactVersionService.transition({ organizationId: orgId, businessVersionId: bvId, action: 'submit_for_review', actorId: preparerId, role: 'preparer', expectedVersion: version });
      if (!submitted.ok) throw new Error('unreachable');
      version = submitted.businessVersion.version;
      const started = await artifactVersionService.transition({ organizationId: orgId, businessVersionId: bvId, action: 'start_review', actorId: approverId, role: 'approver', expectedVersion: version });
      if (!started.ok) throw new Error('unreachable');
      version = started.businessVersion.version;
      await withPinnedPostgresTransaction((tx) => tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId]));

      const approved = await artifactVersionService.approveVersion({ organizationId: orgId, businessVersionId: bvId, actorId: approverId, role: 'approver', expectedVersion: version });
      expect(approved.ok).toBe(true);
      if (!approved.ok) throw new Error('unreachable');
      // The load-bearing assertion: approval did NOT mint a second snapshot for the same working
      // revision — it reused the one createComputeSnapshot() already created pre-approval.
      expect(approved.computeSnapshotId).toBe(preSnap.computeSnapshotId);

      const snapshotCount = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM finance_compute_snapshots WHERE working_revision_id = ?`,
          [created.workingRevision.working_revision_id]
        )
      );
      expect(Number(snapshotCount?.count)).toBe(1);
    });

    it('approveVersion() still creates its OWN fresh snapshot when no pre-approval snapshot exists (STATEMENT_PACK-style callers, unchanged fallback)', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: preparerId,
      });
      let bvId = created.businessVersion.business_version_id;
      let version = created.businessVersion.version;

      const submitted = await artifactVersionService.transition({ organizationId: orgId, businessVersionId: bvId, action: 'submit_for_review', actorId: preparerId, role: 'preparer', expectedVersion: version });
      if (!submitted.ok) throw new Error('unreachable');
      version = submitted.businessVersion.version;
      const started = await artifactVersionService.transition({ organizationId: orgId, businessVersionId: bvId, action: 'start_review', actorId: approverId, role: 'approver', expectedVersion: version });
      if (!started.ok) throw new Error('unreachable');
      version = started.businessVersion.version;
      await withPinnedPostgresTransaction((tx) => tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId]));

      // No createComputeSnapshot() call at all — this is today's STATEMENT_PACK path, unchanged.
      const approved = await artifactVersionService.approveVersion({ organizationId: orgId, businessVersionId: bvId, actorId: approverId, role: 'approver', expectedVersion: version });
      expect(approved.ok).toBe(true);
      if (!approved.ok) throw new Error('unreachable');
      expect(approved.computeSnapshotId).toBeTruthy();
    });
  });

  describe('artifactVersionService.reopenVersion — WP-B02 §6, non-mutating', () => {
    async function createApprovedVersion() {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'HISTORICAL_ANALYSIS',
        createdBy: preparerId,
      });
      const bvId = created.businessVersion.business_version_id;
      let version = created.businessVersion.version;
      const t1 = await artifactVersionService.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'submit_for_review',
        actorId: preparerId,
        role: 'preparer',
        expectedVersion: version,
      });
      if (!t1.ok) throw new Error('unreachable');
      version = t1.businessVersion.version;
      const t2 = await artifactVersionService.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'start_review',
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      if (!t2.ok) throw new Error('unreachable');
      version = t2.businessVersion.version;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId])
      );
      const approved = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: bvId,
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      if (!approved.ok) throw new Error('unreachable');
      return approved.businessVersion;
    }

    it('reopen creates a new DRAFT vN+1 and leaves vN byte-for-byte unchanged', async () => {
      const vN = await createApprovedVersion();

      const result = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: vN.business_version_id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: vN.version,
        reason: 'Correcting an FY2025 input error',
        idempotencyKey: `idem-reopen-${vN.business_version_id}`,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.businessVersion.status).toBe('DRAFT');
      expect(result.businessVersion.parent_version_id).toBe(vN.business_version_id);
      expect(result.businessVersion.version_no).toBe(vN.version_no + 1);
      expect(result.idempotentReplay).toBe(false);

      // The load-bearing assertion: vN is READ BACK IDENTICAL to what
      // createApprovedVersion() returned — this is the exact bug class
      // WP-B02 §6.1 documents (financialModelingService.ts mutating
      // Approved in place). status must still be APPROVED (T9 only fires
      // when the CHILD itself is later approved, not on reopen).
      const vNAfter = await artifactVersionService.getBusinessVersion(orgId, vN.business_version_id);
      expect(vNAfter).toEqual(vN);
    });

    it('a second reopen of the same vN (with an existing open child) is rejected DRAFT_ALREADY_EXISTS', async () => {
      const vN = await createApprovedVersion();
      const first = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: vN.business_version_id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: vN.version,
        reason: 'first reopen',
      });
      if (!first.ok) throw new Error('unreachable');

      const second = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: vN.business_version_id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: vN.version, // vN's version never changed, so this still "matches"
        reason: 'second reopen attempt',
      });
      expect(second.ok).toBe(false);
      if (second.ok) throw new Error('unreachable');
      expect(second.code).toBe('DRAFT_ALREADY_EXISTS');
      expect(second.existingDraftVersionId).toBe(first.businessVersion.business_version_id);
    });

    it('reopen requires a non-empty reason and an allowed role', async () => {
      const vN = await createApprovedVersion();
      const noReason = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: vN.business_version_id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: vN.version,
        reason: '   ',
      });
      expect(noReason.ok).toBe(false);
      if (noReason.ok) throw new Error('unreachable');
      expect(noReason.code).toBe('REASON_REQUIRED');

      const wrongRole = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: vN.business_version_id,
        actorId: preparerId,
        role: 'preparer',
        expectedVersion: vN.version,
        reason: 'preparer trying to reopen',
      });
      expect(wrongRole.ok).toBe(false);
      if (wrongRole.ok) throw new Error('unreachable');
      expect(wrongRole.code).toBe('FORBIDDEN');
    });

    it('idempotency-key replay returns the SAME child version_id, not a second one', async () => {
      const vN = await createApprovedVersion();
      const key = `idem-reopen-replay-${vN.business_version_id}`;
      const first = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: vN.business_version_id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: vN.version,
        reason: 'first',
        idempotencyKey: key,
      });
      if (!first.ok) throw new Error('unreachable');

      const replay = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: vN.business_version_id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: vN.version,
        reason: 'first', // same call, replayed
        idempotencyKey: key,
      });
      expect(replay.ok).toBe(true);
      if (!replay.ok) throw new Error('unreachable');
      expect(replay.idempotentReplay).toBe(true);
      expect(replay.businessVersion.business_version_id).toBe(first.businessVersion.business_version_id);
    });

    // BUG-GOLDCO-03 regression (docs/validation/finance-v3/generated/gate-d/
    // GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md §6): approveVersion() used to
    // set the CHILD row to APPROVED before demoting the still-APPROVED PARENT
    // to SUPERSEDED, in the same transaction. `uq_finance_bv_one_approved` is
    // a partial UNIQUE INDEX (not DEFERRABLE), so that ordering threw a raw
    // 23505 unique-violation on EVERY reopen->approve, unconditionally. Fixed
    // by superseding the parent BEFORE flipping the child — this test failed
    // (threw) against the pre-fix code and must pass here.
    it('approving a reopened vN+1 reaches APPROVED and supersedes vN (BUG-GOLDCO-03)', async () => {
      const vN = await createApprovedVersion();

      const reopened = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: vN.business_version_id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: vN.version,
        reason: 'BUG-GOLDCO-03 regression test — plain reopen then approve',
      });
      if (!reopened.ok) throw new Error('unreachable');
      const childBvId = reopened.businessVersion.business_version_id;
      let childVersion = reopened.businessVersion.version;

      const submitted = await artifactVersionService.transition({
        organizationId: orgId,
        businessVersionId: childBvId,
        action: 'submit_for_review',
        actorId: preparerId,
        role: 'preparer',
        expectedVersion: childVersion,
      });
      if (!submitted.ok) throw new Error('unreachable');
      childVersion = submitted.businessVersion.version;

      const started = await artifactVersionService.transition({
        organizationId: orgId,
        businessVersionId: childBvId,
        action: 'start_review',
        actorId: approverId,
        role: 'approver',
        expectedVersion: childVersion,
      });
      if (!started.ok) throw new Error('unreachable');
      childVersion = started.businessVersion.version;

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [childBvId])
      );

      // Before the fix, this threw a raw 23505 unique-violation instead of
      // returning a structured ApproveResult — asserting `.ok` alone already
      // proves the fix; the `await` not throwing is itself load-bearing.
      const approved = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: childBvId,
        actorId: approverId,
        role: 'approver',
        expectedVersion: childVersion,
      });
      expect(approved.ok).toBe(true);
      if (!approved.ok) throw new Error('unreachable');
      expect(approved.businessVersion.status).toBe('APPROVED');

      const parentAfter = await artifactVersionService.getBusinessVersion(orgId, vN.business_version_id);
      expect(parentAfter?.status).toBe('SUPERSEDED');
      expect(parentAfter?.superseded_by_version_id).toBe(childBvId);
      expect(parentAfter?.superseded_at).toBeTruthy();
    });

    // BUG-GOLDCO-01 regression: reopenVersion() used to silently drop
    // versionKind/restatementReason/restatementClass — every reopened
    // version, restatement or not, defaulted to version_kind='ORIGINAL'
    // regardless of caller intent (WP-B06 §4.2's documented mechanism).
    it('reopen with versionKind=RESTATED persists version_kind/restatement_reason/restatement_class (BUG-GOLDCO-01)', async () => {
      const vN = await createApprovedVersion();

      const restated = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: vN.business_version_id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: vN.version,
        reason: 'Inventory valuation error found in Q1 close',
        versionKind: 'RESTATED',
        restatementReason: 'Inventory valuation error found in Q1 close',
        restatementClass: 'ERROR_CORRECTION',
      });
      expect(restated.ok).toBe(true);
      if (!restated.ok) throw new Error('unreachable');
      expect(restated.businessVersion.version_kind).toBe('RESTATED');
      expect(restated.businessVersion.restatement_reason).toBe('Inventory valuation error found in Q1 close');
      expect(restated.businessVersion.restatement_class).toBe('ERROR_CORRECTION');

      // Read back from the DB directly, not just the service's own return value.
      const dbRow = await artifactVersionService.getBusinessVersion(orgId, restated.businessVersion.business_version_id);
      expect(dbRow?.version_kind).toBe('RESTATED');
      expect(dbRow?.restatement_reason).toBe('Inventory valuation error found in Q1 close');
      expect(dbRow?.restatement_class).toBe('ERROR_CORRECTION');

      // A plain reopen (no versionKind) still defaults to 'ORIGINAL' — WP-B06
      // §4.2: "version_kind nie jest dziedziczone automatycznie... domyślnie
      // nowy vN+1 też jest ORIGINAL".
      const vN2 = await createApprovedVersion();
      const plainReopen = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: vN2.business_version_id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: vN2.version,
        reason: 'plain reopen, not a restatement',
      });
      expect(plainReopen.ok).toBe(true);
      if (!plainReopen.ok) throw new Error('unreachable');
      expect(plainReopen.businessVersion.version_kind).toBe('ORIGINAL');
      expect(plainReopen.businessVersion.restatement_reason).toBeNull();
      expect(plainReopen.businessVersion.restatement_class).toBeNull();

      // versionKind='RESTATED' without reason/class is rejected at the
      // application layer (mirrors chk_finance_bv_restatement_reason).
      const vN3 = await createApprovedVersion();
      const missingMetadata = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: vN3.business_version_id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: vN3.version,
        reason: 'restatement without required metadata',
        versionKind: 'RESTATED',
      });
      expect(missingMetadata.ok).toBe(false);
      if (missingMetadata.ok) throw new Error('unreachable');
      expect(missingMetadata.code).toBe('RESTATEMENT_METADATA_REQUIRED');
    });
  });

  describe('lineageService — real DB insert + cycle rejection via the DB trigger', () => {
    it('insertEdge succeeds for a valid forward edge and getDescendants/getAncestors find it', async () => {
      const stmt = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: preparerId,
      });
      const model = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'BASELINE_MODEL',
        createdBy: preparerId,
      });

      const inserted = await lineageService.insertEdge({
        organizationId: orgId,
        sourceVersionId: stmt.businessVersion.business_version_id,
        sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: model.businessVersion.business_version_id,
        targetArtifactType: 'BASELINE_MODEL',
        edgeType: 'STATEMENT_TO_MODEL',
        transformationKind: 'COMPUTE',
        authorId: preparerId,
      });
      expect(inserted.ok).toBe(true);

      const descendants = await lineageService.getDescendants(orgId, stmt.businessVersion.business_version_id);
      expect(descendants.some((e) => e.target_version_id === model.businessVersion.business_version_id)).toBe(true);

      const ancestors = await lineageService.getAncestors(orgId, model.businessVersion.business_version_id);
      expect(ancestors.some((e) => e.source_version_id === stmt.businessVersion.business_version_id)).toBe(true);
    });

    it('the DB trigger rejects a backward edge even if a caller bypassed the app-level pre-check', async () => {
      const stmt = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: preparerId,
      });
      const model = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'BASELINE_MODEL',
        createdBy: preparerId,
      });

      // Insert directly, skipping insertEdge()'s app-level validateEdgeRank
      // pre-check, to prove the DB trigger itself (not just this service's
      // pure helper) is what enforces the rule.
      await expect(
        withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_lineage_edges (
               id, organization_id, source_version_id, source_artifact_type,
               target_version_id, target_artifact_type, edge_type, transformation_kind, author_id
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              randomUUID(),
              orgId,
              model.businessVersion.business_version_id, // source = BASELINE_MODEL (rank 2)
              'BASELINE_MODEL',
              stmt.businessVersion.business_version_id, // target = STATEMENT_PACK (rank 0) -> backward
              'STATEMENT_PACK',
              'VERSION_TO_REPORT',
              'MANUAL_LINK',
              preparerId,
            ]
          )
        )
      ).rejects.toThrow(/stage_rank/);
    });
  });

  describe('computeJobService — enqueue + FOR UPDATE SKIP LOCKED claim', () => {
    it('enqueue is idempotent on (organization_id, job_type, idempotency_key)', async () => {
      const artifact = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'BASELINE_MODEL',
        createdBy: preparerId,
      });
      const key = `enqueue-idem-${randomUUID()}`;
      const first = await computeJobService.enqueue({
        organizationId: orgId,
        jobType: 'model_recompute_enqueue_idem_test',
        inputArtifactId: artifact.artifact.artifact_id,
        inputRevisionHash: 'hash-1',
        engineManifestId: artifact.businessVersion.engine_manifest_id,
        idempotencyKey: key,
        requestedByUserId: preparerId,
      });
      expect(first.wasExisting).toBe(false);

      const second = await computeJobService.enqueue({
        organizationId: orgId,
        jobType: 'model_recompute_enqueue_idem_test',
        inputArtifactId: artifact.artifact.artifact_id,
        inputRevisionHash: 'hash-1',
        engineManifestId: artifact.businessVersion.engine_manifest_id,
        idempotencyKey: key,
        requestedByUserId: preparerId,
      });
      expect(second.wasExisting).toBe(true);
      expect(second.job.id).toBe(first.job.id);
    });

    it('two concurrent claim() calls never claim the same job twice (SKIP LOCKED)', async () => {
      const artifact = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'BASELINE_MODEL',
        createdBy: preparerId,
      });

      // Unique per test run — see the completeJobSuccess test's comment on
      // why claim() is deliberately not organization-scoped and why that
      // makes a unique job_type the right isolation lever here.
      const jobType = `skip_locked_probe_${randomUUID()}`;
      const jobs = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          computeJobService.enqueue({
            organizationId: orgId,
            jobType,
            inputArtifactId: artifact.artifact.artifact_id,
            inputRevisionHash: `hash-${i}`,
            engineManifestId: artifact.businessVersion.engine_manifest_id,
            idempotencyKey: `skip-locked-${randomUUID()}`,
            requestedByUserId: preparerId,
          })
        )
      );
      expect(jobs).toHaveLength(4);

      // Two workers race to claim 2 jobs each, concurrently, from the same
      // 4-job pool. If SKIP LOCKED were broken (or a naive SELECT-then-UPDATE
      // race existed), the two claim sets would overlap.
      const [claimedA, claimedB] = await Promise.all([
        computeJobService.claim({ workerId: 'worker-a', jobTypes: [jobType], limit: 2 }),
        computeJobService.claim({ workerId: 'worker-b', jobTypes: [jobType], limit: 2 }),
      ]);

      const idsA = new Set(claimedA.map((j) => j.id));
      const idsB = new Set(claimedB.map((j) => j.id));
      const overlap = [...idsA].filter((id) => idsB.has(id));
      expect(overlap).toEqual([]);
      expect(idsA.size + idsB.size).toBe(4);
      for (const job of [...claimedA, ...claimedB]) {
        expect(job.status).toBe('running');
      }
    });

    it('completeJobSuccess commits an output and marks the job succeeded', async () => {
      const artifact = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'BASELINE_MODEL',
        createdBy: preparerId,
      });
      // `claim()` is intentionally NOT organization-scoped (WP-B04's worker
      // pool claims across all orgs by job_type; org-scoping is a
      // concurrency-limit concern, not a queue-visibility one — see the
      // module doc comment on `org_concurrency_limit()` being out of scope).
      // A per-test-run-unique job_type keeps this assertion deterministic
      // regardless of any other queued row of a same-named job_type left
      // over from a previous run against a long-lived shared test database.
      const jobType = `model_recompute_complete_test_${randomUUID()}`;
      const enqueued = await computeJobService.enqueue({
        organizationId: orgId,
        jobType,
        inputArtifactId: artifact.artifact.artifact_id,
        inputRevisionHash: 'hash-complete',
        engineManifestId: artifact.businessVersion.engine_manifest_id,
        idempotencyKey: `complete-${randomUUID()}`,
        requestedByUserId: preparerId,
      });
      const [claimed] = await computeJobService.claim({ workerId: 'worker-complete', jobTypes: [jobType], limit: 1 });
      expect(claimed.id).toBe(enqueued.job.id);

      const foreignJob = await computeJobService.completeJobSuccess({
        jobId: claimed.id,
        organizationId: `foreign-${orgId}`,
        inputArtifactId: artifact.artifact.artifact_id,
        outputArtifactId: artifact.artifact.artifact_id,
        outputBusinessVersionId: artifact.businessVersion.business_version_id,
        outputWorkingRevisionId: artifact.workingRevision.working_revision_id,
        contentSemanticHash: 'output-hash-1',
      });
      expect(foreignJob).toEqual(expect.objectContaining({ ok: false, code: 'NOT_RUNNING' }));

      const otherArtifact = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'BASELINE_MODEL',
        createdBy: preparerId,
      });
      const crossOutput = await computeJobService.completeJobSuccess({
        jobId: claimed.id,
        organizationId: orgId,
        inputArtifactId: artifact.artifact.artifact_id,
        outputArtifactId: artifact.artifact.artifact_id,
        outputBusinessVersionId: artifact.businessVersion.business_version_id,
        outputWorkingRevisionId: otherArtifact.workingRevision.working_revision_id,
        contentSemanticHash: 'output-hash-1',
      });
      expect(crossOutput).toEqual(
        expect.objectContaining({ ok: false, code: 'STALE_PUBLICATION' })
      );
      const selfConsistentButUnboundOutput = await computeJobService.completeJobSuccess({
        jobId: claimed.id,
        organizationId: orgId,
        inputArtifactId: artifact.artifact.artifact_id,
        outputArtifactId: otherArtifact.artifact.artifact_id,
        outputBusinessVersionId: otherArtifact.businessVersion.business_version_id,
        outputWorkingRevisionId: otherArtifact.workingRevision.working_revision_id,
        contentSemanticHash: 'unbound-output-hash',
      });
      expect(selfConsistentButUnboundOutput).toEqual(
        expect.objectContaining({ ok: false, code: 'STALE_PUBLICATION' })
      );
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE finance_working_revisions SET is_current=false WHERE working_revision_id=?`, [
          artifact.workingRevision.working_revision_id,
        ])
      );
      const nonCurrentOutput = await computeJobService.completeJobSuccess({
        jobId: claimed.id,
        organizationId: orgId,
        inputArtifactId: artifact.artifact.artifact_id,
        outputArtifactId: artifact.artifact.artifact_id,
        outputBusinessVersionId: artifact.businessVersion.business_version_id,
        outputWorkingRevisionId: artifact.workingRevision.working_revision_id,
        contentSemanticHash: 'output-hash-1',
      });
      expect(nonCurrentOutput).toEqual(
        expect.objectContaining({ ok: false, code: 'STALE_PUBLICATION' })
      );
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE finance_working_revisions SET is_current=true WHERE working_revision_id=?`, [
          artifact.workingRevision.working_revision_id,
        ])
      );

      const completionParams = {
        jobId: claimed.id,
        organizationId: orgId,
        inputArtifactId: artifact.artifact.artifact_id,
        outputArtifactId: artifact.artifact.artifact_id,
        outputBusinessVersionId: artifact.businessVersion.business_version_id,
        outputWorkingRevisionId: artifact.workingRevision.working_revision_id,
        contentSemanticHash: 'output-hash-1',
      };
      const result = await computeJobService.completeJobSuccess(completionParams);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.job.status).toBe('succeeded');
      const replay = await computeJobService.completeJobSuccess(completionParams);
      expect(replay).toEqual(expect.objectContaining({ ok: true }));
      const collision = await computeJobService.completeJobSuccess({
        ...completionParams,
        contentSemanticHash: 'colliding-output-hash',
      });
      expect(collision).toEqual(
        expect.objectContaining({ ok: false, code: 'OUTPUT_ALREADY_COMMITTED' })
      );
    });

    it('completeJobSuccess fails closed after STALE_SOURCE propagation and leaves publication untouched', async () => {
      const artifact = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'BASELINE_MODEL',
        createdBy: preparerId,
      });
      const jobType = `stale_publication_${randomUUID()}`;
      const enqueued = await computeJobService.enqueue({
        organizationId: orgId,
        jobType,
        inputArtifactId: artifact.artifact.artifact_id,
        inputRevisionHash: 'stale-input',
        engineManifestId: artifact.businessVersion.engine_manifest_id,
        idempotencyKey: randomUUID(),
        requestedByUserId: preparerId,
      });
      const [claimed] = await computeJobService.claim({
        workerId: 'stale-publication-worker',
        jobTypes: [jobType],
        limit: 1,
      });
      expect(claimed.id).toBe(enqueued.job.id);
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `UPDATE finance_business_versions
              SET freshness='STALE_SOURCE',freshness_reason='upstream changed',stale_since=now()
            WHERE business_version_id=? AND organization_id=?`,
          [artifact.businessVersion.business_version_id, orgId]
        )
      );

      const result = await computeJobService.completeJobSuccess({
        jobId: claimed.id,
        organizationId: orgId,
        outputArtifactId: artifact.artifact.artifact_id,
        outputBusinessVersionId: artifact.businessVersion.business_version_id,
        outputWorkingRevisionId: artifact.workingRevision.working_revision_id,
        contentSemanticHash: 'must-not-publish',
      });
      expect(result).toEqual(expect.objectContaining({ ok: false, code: 'STALE_PUBLICATION' }));
      const readback = await withPinnedPostgresTransaction(async (tx) => ({
        version: await tx.queryOne<{ freshness: string }>(
          `SELECT freshness FROM finance_business_versions WHERE business_version_id=?`,
          [artifact.businessVersion.business_version_id]
        ),
        revision: await tx.queryOne<{ content_semantic_hash: string; compute_run_id: string | null }>(
          `SELECT content_semantic_hash,compute_run_id FROM finance_working_revisions WHERE working_revision_id=?`,
          [artifact.workingRevision.working_revision_id]
        ),
        outputs: await tx.queryOne<{ count: string }>(
          `SELECT count(*)::text AS count FROM compute_job_outputs WHERE job_id=?`,
          [claimed.id]
        ),
      }));
      expect(readback.version?.freshness).toBe('STALE_SOURCE');
      expect(readback.revision?.content_semantic_hash).toBe(
        artifact.workingRevision.content_semantic_hash
      );
      expect(readback.revision?.compute_run_id).toBeNull();
      expect(readback.outputs?.count).toBe('0');
    });

    it('a delayed older completion cannot overwrite a newer successful publication', async () => {
      const artifact = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'BASELINE_MODEL',
        createdBy: preparerId,
      });
      const jobType = `publication_order_${randomUUID()}`;
      const older = await computeJobService.enqueue({
        organizationId: orgId,
        jobType,
        inputArtifactId: artifact.artifact.artifact_id,
        inputRevisionHash: 'older-input',
        engineManifestId: artifact.businessVersion.engine_manifest_id,
        idempotencyKey: randomUUID(),
        requestedByUserId: preparerId,
      });
      const newer = await computeJobService.enqueue({
        organizationId: orgId,
        jobType,
        inputArtifactId: artifact.artifact.artifact_id,
        inputRevisionHash: 'newer-input',
        engineManifestId: artifact.businessVersion.engine_manifest_id,
        idempotencyKey: randomUUID(),
        requestedByUserId: preparerId,
      });
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE compute_jobs SET created_at=created_at+interval '1 second' WHERE id=?`, [
          newer.job.id,
        ])
      );
      const claimed = await computeJobService.claim({
        workerId: 'publication-order-worker',
        jobTypes: [jobType],
        limit: 2,
      });
      expect(new Set(claimed.map((job) => job.id))).toEqual(
        new Set([older.job.id, newer.job.id])
      );
      const newerResult = await computeJobService.completeJobSuccess({
        jobId: newer.job.id,
        organizationId: orgId,
        outputArtifactId: artifact.artifact.artifact_id,
        outputBusinessVersionId: artifact.businessVersion.business_version_id,
        outputWorkingRevisionId: artifact.workingRevision.working_revision_id,
        contentSemanticHash: 'newer-output',
      });
      expect(newerResult.ok).toBe(true);
      const delayedOlder = await computeJobService.completeJobSuccess({
        jobId: older.job.id,
        organizationId: orgId,
        outputArtifactId: artifact.artifact.artifact_id,
        outputBusinessVersionId: artifact.businessVersion.business_version_id,
        outputWorkingRevisionId: artifact.workingRevision.working_revision_id,
        contentSemanticHash: 'older-must-not-overwrite',
      });
      expect(delayedOlder).toEqual(
        expect.objectContaining({ ok: false, code: 'STALE_PUBLICATION' })
      );
      const readback = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ content_semantic_hash: string; compute_run_id: string }>(
          `SELECT content_semantic_hash,compute_run_id FROM finance_working_revisions
            WHERE working_revision_id=?`,
          [artifact.workingRevision.working_revision_id]
        )
      );
      expect(readback).toEqual({
        content_semantic_hash: 'newer-output',
        compute_run_id: newer.job.id,
      });
    });
  });

  describe('exceptionLedgerService — raise / accept / waive', () => {
    it('raise + accept moves finance_exceptions_current.state OPEN -> ACCEPTED', async () => {
      const artifact = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: preparerId,
      });

      const raised = await exceptionLedgerService.raise({
        organizationId: orgId,
        artifactId: artifact.artifact.artifact_id,
        severity: 'WARNING',
        sourceRef: { statementLineCode: 'REV-001' },
        reasonCode: 'ROUNDING',
        raisedBy: preparerId,
      });
      expect(raised.ok).toBe(true);
      if (!raised.ok) throw new Error('unreachable');

      const openState = await exceptionLedgerService.getCurrent(orgId, raised.exception.exception_group_id);
      expect(openState?.state).toBe('OPEN');

      const accepted = await exceptionLedgerService.accept({
        organizationId: orgId,
        exceptionGroupId: raised.exception.exception_group_id,
        actorId: approverId,
        reason: 'Acceptable rounding delta',
      });
      expect(accepted.ok).toBe(true);

      const acceptedState = await exceptionLedgerService.getCurrent(orgId, raised.exception.exception_group_id);
      expect(acceptedState?.state).toBe('ACCEPTED');
    });

    it('SECURITY severity without blockingCategory is rejected before hitting the DB', async () => {
      const artifact = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: preparerId,
      });
      const result = await exceptionLedgerService.raise({
        organizationId: orgId,
        artifactId: artifact.artifact.artifact_id,
        severity: 'SECURITY',
        sourceRef: {},
        raisedBy: preparerId,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code).toBe('BLOCKING_CATEGORY_REQUIRED');
    });

    it('waive on a MATERIAL exception without expiry is rejected (chk_finance_exceptions_expiry_required)', async () => {
      const artifact = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        createdBy: preparerId,
      });
      const raised = await exceptionLedgerService.raise({
        organizationId: orgId,
        artifactId: artifact.artifact.artifact_id,
        severity: 'MATERIAL',
        sourceRef: { cellRef: 'B12' },
        raisedBy: preparerId,
      });
      if (!raised.ok) throw new Error('unreachable');

      const result = await exceptionLedgerService.waive({
        organizationId: orgId,
        exceptionGroupId: raised.exception.exception_group_id,
        actorId: approverId,
        reason: 'temporary waiver',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code).toBe('EXPIRY_REQUIRED');
    });

    it('a blocking OPEN SECURITY exception blocks approveVersion (WP-B02 §5.1 point (a)(ii))', async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'HISTORICAL_ANALYSIS',
        createdBy: preparerId,
      });
      const bvId = created.businessVersion.business_version_id;
      let version = created.businessVersion.version;
      const t1 = await artifactVersionService.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'submit_for_review',
        actorId: preparerId,
        role: 'preparer',
        expectedVersion: version,
      });
      if (!t1.ok) throw new Error('unreachable');
      version = t1.businessVersion.version;
      const t2 = await artifactVersionService.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'start_review',
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      if (!t2.ok) throw new Error('unreachable');
      version = t2.businessVersion.version;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId])
      );

      const raised = await exceptionLedgerService.raise({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        businessVersionId: bvId,
        severity: 'SECURITY',
        blockingCategory: 'TENANT_BREACH',
        sourceRef: { detectedBy: 'test' },
        raisedBy: preparerId,
      });
      if (!raised.ok) throw new Error('unreachable');

      const result = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: bvId,
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code).toBe('APPROVAL_BLOCKED');
    });
  });
});

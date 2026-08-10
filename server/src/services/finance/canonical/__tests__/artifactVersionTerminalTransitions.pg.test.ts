/**
 * BUG-APWAVE-TRANSITION — T10 `archive` / T11 `invalidate` against a REAL
 * PostgreSQL, plus the immutability envelope around the statuses they produce.
 *
 * WHY THIS FILE EXISTS. `archive` and `invalidate` are the only two transitions
 * in `lifecycleService.TRANSITIONS` whose `from` is `APPROVED`. Both were dead
 * in production: `transition()` issued `version = version + 1`, `version` is
 * not on `finance_bv_enforce_immutability()`'s allow-list, and that trigger
 * rejects any non-allow-listed column changing on a row whose `OLD.status` is
 * `APPROVED`. Every call raised, unconditionally:
 *
 *   P0001 finance_business_versions: <id> is APPROVED; only status and its
 *         associated metadata columns may change
 *   PL/pgSQL function finance_bv_enforce_immutability() line 27 at RAISE
 *
 * Nothing caught it because the only coverage was `lifecycleService.test.ts`,
 * a pure unit test over `validateTransition()` that never reaches SQL. A mock
 * database cannot prove any of this — the whole defect lived in a DB trigger —
 * so this suite is `.pg.test.ts` and `describe.skipIf`-gated on a real
 * connection, never a false green.
 *
 * Every write below is proven PHYSICAL (`changes`/`rowCount` plus an
 * independent read-back through `getBusinessVersion`) rather than inferred
 * from a service returning `ok: true` — this program has already been burned
 * by an "UPDATE 0 looks like PASS" false proof.
 *
 * HOW TO RUN (own throwaway ephemeral cluster only — NEVER the shared local
 * Postgres and NEVER a demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config vitest.config.ts \
 *     src/services/finance/canonical/__tests__/artifactVersionTerminalTransitions.pg.test.ts \
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

describe.skipIf(!REAL_PG)('Finance v3 — T10/T11 terminal transitions (real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let svc: typeof import('../artifactVersionService.js');

  const orgId = `org-apwave-t10t11-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  const approverId = `user-approver-${randomUUID()}`;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    svc = await import('../artifactVersionService.js');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'APWAVE T10/T11 Test Org'])
    );
  });

  /**
   * DRAFT -> READY_FOR_REVIEW -> IN_REVIEW -> APPROVED through the real
   * services, so the APPROVED row under test is one production actually
   * produces (real compute snapshot, real audit trail), not a hand-INSERTed
   * fixture that could sidestep the very trigger this file is about.
   * HISTORICAL_ANALYSIS is the LOW-risk-tier type, which keeps the SoD gate
   * out of the way of what we are measuring.
   */
  async function makeApprovedVersion(): Promise<{ artifactId: string; bvId: string; version: number }> {
    const created = await svc.createArtifact({
      organizationId: orgId,
      artifactType: 'HISTORICAL_ANALYSIS',
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
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) throw new Error('unreachable');
    version = submitted.businessVersion.version;

    const started = await svc.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'start_review',
      actorId: approverId,
      role: 'approver',
      expectedVersion: version,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error('unreachable');
    version = started.businessVersion.version;

    // freshness defaults to NEVER_COMPUTED on create; approve requires CURRENT.
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId])
    );

    const approved = await svc.approveVersion({
      organizationId: orgId,
      businessVersionId: bvId,
      actorId: approverId,
      role: 'approver',
      expectedVersion: version,
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) throw new Error('unreachable');
    expect(approved.businessVersion.status).toBe('APPROVED');

    return {
      artifactId: created.artifact.artifact_id,
      bvId,
      version: approved.businessVersion.version,
    };
  }

  /** Raw single-column UPDATE, bypassing the services, to interrogate the trigger directly. */
  async function tamper(bvId: string, column: 'content_semantic_hash' | 'compute_snapshot_id', value: string) {
    return withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET ${column} = ? WHERE business_version_id = ?`, [value, bvId])
    );
  }

  describe('T10 — archive', () => {
    it('archives an APPROVED version (this raised P0001 from the immutability trigger before the fix)', async () => {
      const { bvId, version } = await makeApprovedVersion();

      const result = await svc.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'archive',
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(`archive failed: ${result.code} ${result.message}`);
      expect(result.businessVersion.status).toBe('ARCHIVED');
      expect(result.businessVersion.archived_by).toBe(approverId);
      expect(result.businessVersion.archived_at).toBeTruthy();

      // Physical proof: independent read-back, not the service's return value.
      const readBack = await svc.getBusinessVersion(orgId, bvId);
      expect(readBack).not.toBeNull();
      expect(readBack?.status).toBe('ARCHIVED');
      expect(readBack?.archived_by).toBe(approverId);

      // The audit row for the transition physically exists too.
      const events = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ action: string; from_status: string; to_status: string }>(
          `SELECT action, from_status, to_status FROM artifact_lifecycle_events
            WHERE business_version_id = ? AND action = 'ARCHIVE'`,
          [bvId]
        )
      );
      expect(events).toHaveLength(1);
      expect(events[0].from_status).toBe('APPROVED');
      expect(events[0].to_status).toBe('ARCHIVED');
    });
  });

  describe('T11 — invalidate', () => {
    it('invalidates an APPROVED version and persists the reason', async () => {
      const { bvId, version } = await makeApprovedVersion();
      const reason = `source restated upstream ${randomUUID()}`;

      const result = await svc.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'invalidate',
        actorId: approverId,
        role: 'finance_admin',
        expectedVersion: version,
        reason,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(`invalidate failed: ${result.code} ${result.message}`);
      expect(result.businessVersion.status).toBe('INVALIDATED');
      expect(result.businessVersion.invalidated_reason).toBe(reason);

      const readBack = await svc.getBusinessVersion(orgId, bvId);
      expect(readBack?.status).toBe('INVALIDATED');
      expect(readBack?.invalidated_reason).toBe(reason);

      const events = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ reason: string | null }>(
          `SELECT reason FROM artifact_lifecycle_events WHERE business_version_id = ? AND action = 'INVALIDATE'`,
          [bvId]
        )
      );
      expect(events).toHaveLength(1);
      expect(events[0].reason).toBe(reason);
    });

    it('still refuses to invalidate without a reason (DEC-FIN-007), before touching the DB', async () => {
      const { bvId, version } = await makeApprovedVersion();

      const result = await svc.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'invalidate',
        actorId: approverId,
        role: 'finance_admin',
        expectedVersion: version,
        reason: '   ',
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code).toBe('REASON_REQUIRED');
      // And the row genuinely did not move.
      expect((await svc.getBusinessVersion(orgId, bvId))?.status).toBe('APPROVED');
    });
  });

  describe('immutability is NOT loosened by the fix', () => {
    it('rejects a content change on an APPROVED version (the original b01 invariant)', async () => {
      const { bvId } = await makeApprovedVersion();

      await expect(tamper(bvId, 'content_semantic_hash', 'TAMPERED')).rejects.toThrow(
        /is APPROVED; only status and its associated metadata columns may change/
      );
      expect((await svc.getBusinessVersion(orgId, bvId))?.content_semantic_hash).not.toBe('TAMPERED');
    });

    it.each([
      ['ARCHIVED', 'content_semantic_hash'],
      ['ARCHIVED', 'compute_snapshot_id'],
      ['INVALIDATED', 'content_semantic_hash'],
      ['INVALIDATED', 'compute_snapshot_id'],
    ] as const)('rejects a %s version having its %s rewritten', async (targetStatus, column) => {
      const { bvId, version } = await makeApprovedVersion();
      const before = await svc.getBusinessVersion(orgId, bvId);
      expect(before?.status).toBe('APPROVED');

      const retired = await svc.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: targetStatus === 'ARCHIVED' ? 'archive' : 'invalidate',
        actorId: approverId,
        role: 'finance_admin',
        expectedVersion: version,
        reason: targetStatus === 'INVALIDATED' ? 'retired for the immutability probe' : undefined,
      });
      expect(retired.ok).toBe(true);
      if (!retired.ok) throw new Error('unreachable');
      expect((await svc.getBusinessVersion(orgId, bvId))?.status).toBe(targetStatus);

      // Archiving must not be a back door into an approved version's contents.
      await expect(tamper(bvId, column, randomUUID())).rejects.toThrow(
        /its contents are frozen, only freshness\/result_quality metadata may change/
      );

      const after = await svc.getBusinessVersion(orgId, bvId);
      expect(after?.status).toBe(targetStatus);
      expect(after?.content_semantic_hash).toBe(before?.content_semantic_hash ?? null);
      expect(after?.compute_snapshot_id).toBe(before?.compute_snapshot_id ?? null);
    });

    it('keeps a terminal version terminal (no resurrection via a raw status UPDATE)', async () => {
      const { bvId, version } = await makeApprovedVersion();
      const archived = await svc.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'archive',
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      expect(archived.ok).toBe(true);

      await expect(
        withPinnedPostgresTransaction((tx) =>
          tx.queryRun(`UPDATE finance_business_versions SET status = 'APPROVED' WHERE business_version_id = ?`, [bvId])
        )
      ).rejects.toThrow(/is ARCHIVED \(terminal\); no further status transition is allowed/);

      expect((await svc.getBusinessVersion(orgId, bvId))?.status).toBe('ARCHIVED');
    });

    it('still lets the freshness-propagation columns move on a terminal version', async () => {
      const { bvId, version } = await makeApprovedVersion();
      const archived = await svc.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'archive',
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      expect(archived.ok).toBe(true);

      const res = await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `UPDATE finance_business_versions
              SET freshness = 'STALE_SOURCE', freshness_reason = ?, stale_since = now()
            WHERE business_version_id = ?`,
          ['upstream statement restated', bvId]
        )
      );
      expect(res.changes).toBe(1);

      const readBack = await svc.getBusinessVersion(orgId, bvId);
      expect(readBack?.freshness).toBe('STALE_SOURCE');
      expect(readBack?.freshness_reason).toBe('upstream statement restated');
    });
  });

  describe('concurrency', () => {
    it('two simultaneous archives: exactly one wins, the loser gets a typed conflict, not a raw DB error', async () => {
      const { bvId, version } = await makeApprovedVersion();

      const call = () =>
        svc.transition({
          organizationId: orgId,
          businessVersionId: bvId,
          action: 'archive',
          actorId: approverId,
          role: 'approver',
          expectedVersion: version,
        });

      // `Promise.all` (not sequential awaits) so both really are in flight;
      // `withPinnedPostgresTransaction` checks out a separate pooled
      // connection per call, so these are two genuine concurrent transactions.
      // `allSettled`, because a REJECTED promise here would itself be the
      // regression: the loser must come back as a typed `ok: false`, never as
      // a thrown Postgres error.
      const settled = await Promise.allSettled([call(), call()]);

      const rejected = settled.filter((s) => s.status === 'rejected');
      expect(
        rejected.map((r) => String((r as PromiseRejectedResult).reason?.message ?? r))
      ).toEqual([]);

      const results = settled.map((s) => (s as PromiseFulfilledResult<Awaited<ReturnType<typeof call>>>).value);
      const winners = results.filter((r) => r.ok);
      const losers = results.filter((r) => !r.ok);

      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);

      const loser = losers[0];
      if (loser.ok) throw new Error('unreachable');
      // The from-status guard that replaced the `version` increment is what
      // catches this: the loser re-reads the row under FOR UPDATE after the
      // winner commits, sees a terminal status, and is refused by
      // `validateTransition` with a typed code and a human-readable message.
      expect(['STATE_PRECONDITION_FAILED', 'VERSION_CONFLICT']).toContain(loser.code);
      expect(loser.message).toMatch(/ARCHIVED/);

      // Exactly one archive physically happened.
      const readBack = await svc.getBusinessVersion(orgId, bvId);
      expect(readBack?.status).toBe('ARCHIVED');

      const events = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ event_id: string }>(
          `SELECT event_id FROM artifact_lifecycle_events WHERE business_version_id = ? AND action = 'ARCHIVE'`,
          [bvId]
        )
      );
      expect(events).toHaveLength(1);
    });

    it('a stale expectedVersion is still rejected by CAS on a non-terminal transition', async () => {
      const created = await svc.createArtifact({
        organizationId: orgId,
        artifactType: 'HISTORICAL_ANALYSIS',
        createdBy: preparerId,
      });
      const bvId = created.businessVersion.business_version_id;
      const staleVersion = created.businessVersion.version;

      const first = await svc.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'submit_for_review',
        actorId: preparerId,
        role: 'preparer',
        expectedVersion: staleVersion,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error('unreachable');
      // The increment is untouched for transitions that do not start from APPROVED.
      expect(first.businessVersion.version).toBe(staleVersion + 1);

      const second = await svc.transition({
        organizationId: orgId,
        businessVersionId: bvId,
        action: 'start_review',
        actorId: approverId,
        role: 'approver',
        expectedVersion: staleVersion, // stale on purpose
      });
      expect(second.ok).toBe(false);
      if (second.ok) throw new Error('unreachable');
      expect(second.code).toBe('VERSION_CONFLICT');
      expect((await svc.getBusinessVersion(orgId, bvId))?.status).toBe('READY_FOR_REVIEW');
    });
  });
});

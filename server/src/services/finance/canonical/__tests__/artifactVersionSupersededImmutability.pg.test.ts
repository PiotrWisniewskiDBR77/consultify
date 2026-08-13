/**
 * BUG-APWAVE-SUPERSEDED — a `SUPERSEDED` business version's content must be
 * frozen, against a REAL PostgreSQL.
 *
 * WHY THIS FILE EXISTS. `finance_bv_enforce_immutability()`
 * (`20260809_finance_v3_b01_core_artifacts.sql:231`) guarded content only
 * under `IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED'`.
 * `20260823_finance_v3_bv_terminal_immutability.sql` extended that to
 * `ARCHIVED`/`INVALIDATED` and explicitly REPORTED `SUPERSEDED` as the same
 * hole left open — because SUPERSEDED is not an exotic corner: every single
 * approval of a successor supersedes its parent (T9, inside `approveVersion`).
 * So the content of *every version ever displaced by a newer one* was freely
 * rewritable, and the row could be walked back out of its terminal state.
 *
 * Measured on the pre-fix schema, on a row driven to SUPERSEDED through the
 * real services (approve v1 -> reopen -> approve v2):
 *
 *   content_semantic_hash      : UPDATE ACCEPTED (changes=1)
 *   compute_snapshot_id        : UPDATE ACCEPTED (changes=1)
 *   source_working_revision_id : UPDATE ACCEPTED (changes=1)
 *   status -> 'DRAFT'          : UPDATE ACCEPTED (changes=1)
 *
 * TWO TRAPS THIS FILE DELIBERATELY AVOIDS.
 *
 *  1. FALSE PROOF BY FOREIGN KEY. A first pass tampered with
 *     `compute_snapshot_id`/`source_working_revision_id` using random UUIDs and
 *     got a rejection — from `fk_finance_bv_compute_snapshot` /
 *     `fk_finance_bv_source_wr`, NOT from the immutability trigger. That would
 *     have read as protection that did not exist. Every tamper below therefore
 *     uses an FK-VALID donor value taken from a real sibling version, and
 *     asserts on the trigger's own P0001 text.
 *
 *  2. FALSE PROOF BY MISSING ROW. Every write is proven PHYSICAL — `changes`
 *     from the statement AND an independent read-back through
 *     `getBusinessVersion` — never inferred from a service returning
 *     `ok: true`. "UPDATE 0 looks like PASS" has already burned this program.
 *
 * The most important tests here are NOT the rejections but the
 * `legal writers` block: SUPERSEDED, unlike ARCHIVED/INVALIDATED, is on the
 * hot path, so the proof that matters is that tightening the trigger did not
 * break supersede itself, the freshness-propagation stream, or the d01c
 * `result_quality` trigger's write pattern.
 *
 * HOW TO RUN (own throwaway ephemeral cluster only — NEVER the shared local
 * Postgres and NEVER a demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config vitest.config.ts \
 *     src/services/finance/canonical/__tests__/artifactVersionSupersededImmutability.pg.test.ts \
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

describe.skipIf(!REAL_PG)('Finance v3 — SUPERSEDED immutability (real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let svc: typeof import('../artifactVersionService.js');

  const orgId = `org-apwave-superseded-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  const approverId = `user-approver-${randomUUID()}`;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    svc = await import('../artifactVersionService.js');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'APWAVE SUPERSEDED Test Org'])
    );
  });

  /**
   * DRAFT -> READY_FOR_REVIEW -> IN_REVIEW -> APPROVED through the real
   * services. `content_semantic_hash` is stamped while the row is still DRAFT
   * (where nothing guards it) so that the later "content survived" assertions
   * compare a real value rather than NULL-to-NULL, which would pass whether or
   * not the trigger works.
   */
  async function makeApprovedVersion(): Promise<{ artifactId: string; bvId: string; version: number }> {
    const created = await svc.createArtifact({
      organizationId: orgId,
      artifactType: 'HISTORICAL_ANALYSIS',
      createdBy: preparerId,
    });
    const bvId = created.businessVersion.business_version_id;
    const stampRes = await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET content_semantic_hash = ? WHERE business_version_id = ?`, [
        `sha256:${randomUUID()}`,
        bvId,
      ])
    );
    expect(stampRes.changes).toBe(1);

    let version = created.businessVersion.version;
    version = await advance(bvId, 'submit_for_review', preparerId, 'preparer', version);
    version = await advance(bvId, 'start_review', approverId, 'approver', version);

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
    if (!approved.ok) throw new Error(`approve failed: ${JSON.stringify(approved)}`);
    expect(approved.businessVersion.status).toBe('APPROVED');

    return { artifactId: created.artifact.artifact_id, bvId, version: approved.businessVersion.version };
  }

  async function advance(
    bvId: string,
    action: 'submit_for_review' | 'start_review',
    actorId: string,
    role: 'preparer' | 'approver',
    expectedVersion: number
  ): Promise<number> {
    const r = await svc.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action,
      actorId,
      role,
      expectedVersion,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(`${action} failed: ${r.code} ${r.message}`);
    return r.businessVersion.version;
  }

  /**
   * The REAL supersede path: reopen the approved parent into a child, then
   * approve the child — `approveVersion` step (b) flips the parent to
   * SUPERSEDED (T9). No hand-crafted `UPDATE ... SET status = 'SUPERSEDED'`
   * anywhere, so what is under test is the state production actually produces.
   */
  async function supersede(parentBvId: string, parentVersion: number): Promise<{ childBvId: string; childVersion: number }> {
    const reopened = await svc.reopenVersion({
      organizationId: orgId,
      businessVersionId: parentBvId,
      actorId: approverId,
      role: 'approver',
      expectedVersion: parentVersion,
      reason: `apwave superseded immutability ${randomUUID()}`,
    });
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) throw new Error(`reopen failed: ${reopened.code} ${reopened.message}`);

    const childBvId = reopened.businessVersion.business_version_id;
    let childVersion = reopened.businessVersion.version;
    childVersion = await advance(childBvId, 'submit_for_review', preparerId, 'preparer', childVersion);
    childVersion = await advance(childBvId, 'start_review', approverId, 'approver', childVersion);
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [childBvId])
    );

    const approvedChild = await svc.approveVersion({
      organizationId: orgId,
      businessVersionId: childBvId,
      actorId: approverId,
      role: 'approver',
      expectedVersion: childVersion,
    });
    expect(approvedChild.ok).toBe(true);
    if (!approvedChild.ok) throw new Error(`approve child failed: ${JSON.stringify(approvedChild)}`);

    return { childBvId, childVersion: approvedChild.businessVersion.version };
  }

  /** Approved v1 that has since been displaced by v2 — the row every test here is about. */
  async function makeSupersededVersion() {
    const { bvId, version } = await makeApprovedVersion();
    const before = await svc.getBusinessVersion(orgId, bvId);
    expect(before).not.toBeNull();
    expect(before?.status).toBe('APPROVED');
    expect(before?.content_semantic_hash).toBeTruthy();
    expect(before?.compute_snapshot_id).toBeTruthy();
    expect(before?.source_working_revision_id).toBeTruthy();

    const { childBvId } = await supersede(bvId, version);

    const after = await svc.getBusinessVersion(orgId, bvId);
    expect(after?.status).toBe('SUPERSEDED');

    // FK-valid donors, so a rejection can only come from the trigger.
    const donor = await svc.getBusinessVersion(orgId, childBvId);
    expect(donor?.compute_snapshot_id).toBeTruthy();
    expect(donor?.source_working_revision_id).toBeTruthy();

    return { bvId, childBvId, before: before!, donor: donor! };
  }

  /** Raw single-column UPDATE, bypassing the services, to interrogate the trigger directly. */
  async function tamper(bvId: string, column: string, value: string) {
    return withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET ${column} = ? WHERE business_version_id = ?`, [value, bvId])
    );
  }

  describe('the supersede path itself still works end to end', () => {
    it('approving a successor supersedes the parent and leaves its content byte-identical', async () => {
      const { bvId, childBvId, before } = await makeSupersededVersion();

      const parent = await svc.getBusinessVersion(orgId, bvId);
      expect(parent).not.toBeNull();
      expect(parent?.status).toBe('SUPERSEDED');
      expect(parent?.superseded_by_version_id).toBe(childBvId);
      expect(parent?.superseded_at).toBeTruthy();

      // The whole point: retiring a version must not alter what it said.
      expect(parent?.content_semantic_hash).toBe(before.content_semantic_hash);
      expect(parent?.compute_snapshot_id).toBe(before.compute_snapshot_id);
      expect(parent?.source_working_revision_id).toBe(before.source_working_revision_id);
      expect(parent?.version).toBe(before.version);

      // And the successor really is the live one.
      const child = await svc.getBusinessVersion(orgId, childBvId);
      expect(child?.status).toBe('APPROVED');
    });

    it('supersedes again down a chain (v1 -> v2 -> v3) without disturbing the already-SUPERSEDED v1', async () => {
      const { bvId: v1, version: v1Version } = await makeApprovedVersion();
      const v1Before = await svc.getBusinessVersion(orgId, v1);

      const { childBvId: v2, childVersion: v2Version } = await supersede(v1, v1Version);
      expect((await svc.getBusinessVersion(orgId, v1))?.status).toBe('SUPERSEDED');

      const { childBvId: v3 } = await supersede(v2, v2Version);

      const v1After = await svc.getBusinessVersion(orgId, v1);
      const v2After = await svc.getBusinessVersion(orgId, v2);
      const v3After = await svc.getBusinessVersion(orgId, v3);

      expect(v1After?.status).toBe('SUPERSEDED');
      expect(v1After?.superseded_by_version_id).toBe(v2);
      expect(v1After?.content_semantic_hash).toBe(v1Before?.content_semantic_hash);
      expect(v2After?.status).toBe('SUPERSEDED');
      expect(v2After?.superseded_by_version_id).toBe(v3);
      expect(v3After?.status).toBe('APPROVED');
    });
  });

  describe('content of a SUPERSEDED version is frozen', () => {
    it.each(['content_semantic_hash', 'compute_snapshot_id', 'source_working_revision_id'] as const)(
      'rejects rewriting %s on a SUPERSEDED version (with an FK-valid value, so only the trigger can reject)',
      async (column) => {
        const { bvId, before, donor } = await makeSupersededVersion();

        const donorValue =
          column === 'content_semantic_hash' ? `sha256:TAMPERED-${randomUUID()}` : (donor[column] as string);
        // The donor value must really differ, otherwise the trigger's
        // OLD-vs-NEW comparison would pass for the wrong reason.
        expect(donorValue).not.toBe(before[column]);

        await expect(tamper(bvId, column, donorValue)).rejects.toThrow(
          /is SUPERSEDED; its contents are frozen, only freshness\/result_quality metadata may change/
        );

        const after = await svc.getBusinessVersion(orgId, bvId);
        expect(after).not.toBeNull();
        expect(after?.status).toBe('SUPERSEDED');
        expect(after?.[column]).toBe(before[column]);
      }
    );

    it.each(['DRAFT', 'APPROVED', 'ARCHIVED'] as const)(
      'refuses to resurrect a SUPERSEDED version into %s via a raw status UPDATE',
      async (target) => {
        const { bvId } = await makeSupersededVersion();

        await expect(
          withPinnedPostgresTransaction((tx) =>
            tx.queryRun(`UPDATE finance_business_versions SET status = ? WHERE business_version_id = ?`, [target, bvId])
          )
        ).rejects.toThrow(/is SUPERSEDED \(terminal\); no further status transition is allowed/);

        expect((await svc.getBusinessVersion(orgId, bvId))?.status).toBe('SUPERSEDED');
      }
    );

    it('refuses to rewrite the record of WHY the version was retired', async () => {
      const { bvId, before, childBvId } = await makeSupersededVersion();
      expect(childBvId).toBeTruthy();

      await expect(tamper(bvId, 'superseded_by_version_id', before.business_version_id)).rejects.toThrow(
        /is SUPERSEDED; its contents are frozen/
      );

      const after = await svc.getBusinessVersion(orgId, bvId);
      expect(after?.superseded_by_version_id).toBe(childBvId);
    });

    it('leaves the pre-existing APPROVED invariant exactly as it was (no message drift)', async () => {
      const { bvId } = await makeApprovedVersion();

      await expect(tamper(bvId, 'content_semantic_hash', 'TAMPERED-APPROVED')).rejects.toThrow(
        /is APPROVED; only status and its associated metadata columns may change/
      );
      expect((await svc.getBusinessVersion(orgId, bvId))?.content_semantic_hash).not.toBe('TAMPERED-APPROVED');
    });
  });

  /**
   * THE LOAD-BEARING BLOCK. Tightening a status that production reaches on
   * every approval is only safe if the writers that legitimately touch such a
   * row still get through. These are the two identified by the blast-radius
   * sweep in `20260824_finance_v3_bv_superseded_immutability.sql`.
   */
  describe('legal writers to a SUPERSEDED row still work', () => {
    it('freshness propagation can still mark a SUPERSEDED version stale', async () => {
      const { bvId } = await makeSupersededVersion();
      const reason = `upstream statement restated ${randomUUID()}`;

      const res = await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `UPDATE finance_business_versions
              SET freshness = 'STALE_SOURCE', freshness_reason = ?, stale_since = now()
            WHERE business_version_id = ?`,
          [reason, bvId]
        )
      );
      expect(res.changes).toBe(1);

      const readBack = await svc.getBusinessVersion(orgId, bvId);
      expect(readBack).not.toBeNull();
      expect(readBack?.freshness).toBe('STALE_SOURCE');
      expect(readBack?.freshness_reason).toBe(reason);
      expect(readBack?.stale_since).toBeTruthy();
      expect(readBack?.status).toBe('SUPERSEDED');
    });

    it("the d01c retained-earnings trigger's write pattern still lands result_quality", async () => {
      const { bvId } = await makeSupersededVersion();

      // Verbatim shape of the statement in
      // 20260810_finance_v3_d01c_real_company_integrity_fix.sql:288 — its
      // `status <> 'APPROVED'` filter is precisely what makes SUPERSEDED rows
      // one of its targets.
      const res = await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `UPDATE finance_business_versions
              SET result_quality = CASE
                    WHEN result_quality = 'PROVISIONAL' THEN 'PROVISIONAL'
                    ELSE 'CONDITIONAL'
                  END
            WHERE business_version_id = ? AND status <> 'APPROVED'`,
          [bvId]
        )
      );
      expect(res.changes).toBe(1);

      const readBack = await svc.getBusinessVersion(orgId, bvId);
      expect(readBack).not.toBeNull();
      expect(['PROVISIONAL', 'CONDITIONAL']).toContain(readBack?.result_quality);
      expect(readBack?.status).toBe('SUPERSEDED');
    });

    it('the backfill script pattern still skips an already-SUPERSEDED row instead of erroring', async () => {
      const { bvId } = await makeSupersededVersion();

      // server/scripts/finance-v3-backfill-dry-run.ts:314 — its
      // `status NOT IN (...)` filter means it must simply match nothing here,
      // not raise. If the trigger ever fired for this, the backfill would die.
      const res = await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `UPDATE finance_business_versions
              SET status = 'SUPERSEDED', superseded_by_version_id = ?, superseded_at = now()
            WHERE business_version_id = ? AND status NOT IN ('SUPERSEDED', 'ARCHIVED', 'INVALIDATED')`,
          [bvId, bvId]
        )
      );
      expect(res.changes).toBe(0);
      expect((await svc.getBusinessVersion(orgId, bvId))?.status).toBe('SUPERSEDED');
    });
  });
});

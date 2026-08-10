/**
 * AP-11 point 9 — lineage staleness propagation, real PostgreSQL.
 *
 * The requirement: "zmiana wersji źródłowej oznacza potomków jako
 * nieaktualnych, BEZ automatycznego przeliczania". Before this suite, BOTH
 * halves were unprovable — `finance_lineage_freshness_events` had zero writers
 * anywhere in `server/src`, so nothing was ever marked, and "nothing is
 * recomputed" was vacuously true because nothing happened at all.
 *
 * Everything here runs against the ACTUAL migrated schema (B01 core artifacts,
 * B03 lineage edges + freshness ledger, B04 compute jobs) and against the REAL
 * production entry points — `artifactVersionService.approveVersion()` and
 * `.transition({action:'invalidate'})` — not against the propagation function
 * called in isolation. A mock would prove nothing about a feature whose whole
 * point is which physical rows exist afterwards.
 *
 * Every assertion is backed by a read-back from the database. Writes made by
 * the harness itself assert `changes === 1` first: in this program a
 * zero-row `UPDATE` that "looks like a PASS" has already happened once, so a
 * setup step that silently did nothing must fail the test, not decorate it.
 *
 * Same env-var contract as the other `.pg.test.ts` suites here
 * (`RUN_DB_TESTS=1`, `MOCK_DB=false`, postgres `DATABASE_URL`) —
 * `describe.skipIf`-gated so a run without a real database reports SKIPPED
 * rather than a false green. Note that `NODE_ENV=test` ALONE yields a mock
 * database in which every write is a silent no-op; both flags are required.
 *
 * HOW TO RUN (throwaway/ephemeral cluster only — never a shared/demo/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/lineageFreshnessService.pg.test.ts \
 *     --no-file-parallelism
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { FinanceArtifactType } from '../lifecycleService.js';
import type { LineageEdgeType, LineageTransformationKind } from '../lineageService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('AP-11 pt 9 — lineage staleness propagation, real PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let lineageService: typeof import('../lineageService.js');
  let lineageFreshnessService: typeof import('../lineageFreshnessService.js');

  const orgA = `org-ap11-chain-${randomUUID()}`;
  const orgB = `org-ap11-priority-${randomUUID()}`;
  const orgC = `org-ap11-tenant-${randomUUID()}`;
  const orgD = `org-ap11-depth-${randomUUID()}`;

  const preparerId = `user-preparer-${randomUUID()}`;
  const approverId = `user-approver-${randomUUID()}`;
  const adminId = `user-admin-${randomUUID()}`;

  interface Node {
    artifactId: string;
    bvId: string;
    version: number;
  }

  // -------------------------------------------------------------------------
  // Harness helpers — every write verified physically.
  // -------------------------------------------------------------------------

  async function createOrg(id: string, name: string): Promise<void> {
    const res = await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [id, name])
    );
    expect(res.changes).toBe(1);
  }

  async function setFreshnessCurrent(bvId: string): Promise<void> {
    const res = await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `UPDATE finance_business_versions SET freshness = 'CURRENT', freshness_reason = NULL, stale_since = NULL
          WHERE business_version_id = ?`,
        [bvId]
      )
    );
    expect(res.changes).toBe(1);
    const readBack = await readVersion(bvId);
    expect(readBack?.freshness).toBe('CURRENT');
  }

  async function readVersion(bvId: string) {
    return withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{
        business_version_id: string;
        organization_id: string;
        artifact_id: string;
        status: string;
        version: number;
        freshness: string;
        freshness_reason: string | null;
        stale_since: string | null;
        compute_snapshot_id: string | null;
        content_semantic_hash: string | null;
        source_working_revision_id: string | null;
      }>(`SELECT * FROM finance_business_versions WHERE business_version_id = ?`, [bvId])
    );
  }

  /** A plain (never-approved) graph node whose freshness starts at CURRENT. */
  async function createNode(orgId: string, type: FinanceArtifactType, key: string): Promise<Node> {
    const created = await artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: type,
      naturalKey: key,
      createdBy: preparerId,
    });
    await setFreshnessCurrent(created.businessVersion.business_version_id);
    return {
      artifactId: created.artifact.artifact_id,
      bvId: created.businessVersion.business_version_id,
      version: created.businessVersion.version,
    };
  }

  /** Drive a DRAFT version all the way to APPROVED through the real state machine. */
  async function approveDraft(orgId: string, bvId: string, startVersion: number): Promise<number> {
    const submitted = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'submit_for_review',
      actorId: preparerId,
      role: 'preparer',
      expectedVersion: startVersion,
    });
    if (!submitted.ok) throw new Error(`submit failed: ${submitted.message}`);

    const started = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'start_review',
      actorId: approverId,
      role: 'approver',
      expectedVersion: submitted.businessVersion.version,
    });
    if (!started.ok) throw new Error(`start_review failed: ${started.message}`);

    await setFreshnessCurrent(bvId);

    const approved = await artifactVersionService.approveVersion({
      organizationId: orgId,
      businessVersionId: bvId,
      actorId: approverId,
      role: 'approver',
      expectedVersion: started.businessVersion.version,
    });
    if (!approved.ok) throw new Error(`approve failed: ${approved.code} ${approved.message}`);
    expect(approved.businessVersion.status).toBe('APPROVED');
    return approved.businessVersion.version;
  }

  async function createApprovedNode(orgId: string, type: FinanceArtifactType, key: string): Promise<Node> {
    const node = await createNode(orgId, type, key);
    const version = await approveDraft(orgId, node.bvId, node.version);
    return { ...node, version };
  }

  /**
   * Reopen an APPROVED version and approve the resulting vN+1 — the real
   * "source version changed" event from WP-B03 §6.2 row 1. Returns the
   * approve result so the test can inspect `freshnessPropagation`.
   */
  async function reopenAndApprove(orgId: string, node: Node) {
    const reopened = await artifactVersionService.reopenVersion({
      organizationId: orgId,
      businessVersionId: node.bvId,
      actorId: approverId,
      role: 'approver',
      expectedVersion: node.version,
      reason: 'AP-11 staleness propagation test — new source version',
    });
    if (!reopened.ok) throw new Error(`reopen failed: ${reopened.code} ${reopened.message}`);
    const childBvId = reopened.businessVersion.business_version_id;

    const submitted = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: childBvId,
      action: 'submit_for_review',
      actorId: preparerId,
      role: 'preparer',
      expectedVersion: reopened.businessVersion.version,
    });
    if (!submitted.ok) throw new Error(`submit failed: ${submitted.message}`);

    const started = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: childBvId,
      action: 'start_review',
      actorId: approverId,
      role: 'approver',
      expectedVersion: submitted.businessVersion.version,
    });
    if (!started.ok) throw new Error(`start_review failed: ${started.message}`);

    await setFreshnessCurrent(childBvId);

    const approved = await artifactVersionService.approveVersion({
      organizationId: orgId,
      businessVersionId: childBvId,
      actorId: approverId,
      role: 'approver',
      expectedVersion: started.businessVersion.version,
    });
    if (!approved.ok) throw new Error(`approve failed: ${approved.code} ${approved.message}`);
    return { approved, childBvId };
  }

  async function link(
    orgId: string,
    source: { node: Node; type: FinanceArtifactType },
    target: { node: Node; type: FinanceArtifactType },
    edgeType: LineageEdgeType,
    opts: { hash?: string; kind?: LineageTransformationKind } = {}
  ): Promise<string> {
    const result = await lineageService.insertEdge({
      organizationId: orgId,
      sourceVersionId: source.node.bvId,
      sourceArtifactType: source.type,
      targetVersionId: target.node.bvId,
      targetArtifactType: target.type,
      edgeType,
      transformationKind: opts.kind ?? 'COMPUTE',
      authorId: preparerId,
      assumptionSnapshotHash: opts.hash ?? null,
    });
    if (!result.ok) throw new Error(`insertEdge failed: ${result.code} ${result.message}`);
    return result.edge.id;
  }

  /**
   * `stale_since` comes back from `pg` as a `Date`. Comparing two `Date`
   * objects with `toBe` compares identity, so an assertion that "the timestamp
   * did not move" would pass on two DIFFERENT instants — exactly the shape of
   * false proof this suite exists to avoid. Compare the instant, explicitly.
   */
  function instant(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return new Date(value as string).toISOString();
  }

  async function countRows(sql: string, params: unknown[]): Promise<number> {
    const row = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ n: string }>(sql, params));
    return Number(row?.n ?? -1);
  }

  async function ledgerFor(orgId: string) {
    return withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{
        id: string;
        triggering_edge_id: string | null;
        triggering_version_id: string | null;
        target_version_id: string;
        previous_state: string | null;
        new_state: string;
        reason_code: string;
      }>(
        `SELECT * FROM finance_lineage_freshness_events WHERE organization_id = ? ORDER BY created_at ASC, id ASC`,
        [orgId]
      )
    );
  }

  /**
   * The "nothing was recomputed" fingerprint of an organization: every table a
   * real recompute would have to touch. Compared before/after the trigger.
   */
  async function computeFootprint(orgId: string, excludeArtifactIds: string[] = []) {
    const exclude = excludeArtifactIds.length > 0 ? excludeArtifactIds : ['__none__'];
    return {
      computeJobs: await countRows(`SELECT count(*) AS n FROM compute_jobs WHERE organization_id = ?`, [orgId]),
      computeJobOutputs: await countRows(`SELECT count(*) AS n FROM compute_job_outputs WHERE organization_id = ?`, [orgId]),
      computeJobRuns: await countRows(
        `SELECT count(*) AS n FROM compute_job_runs r JOIN compute_jobs j ON j.id = r.job_id WHERE j.organization_id = ?`,
        [orgId]
      ),
      snapshotsOfDescendants: await countRows(
        `SELECT count(*) AS n FROM finance_compute_snapshots WHERE organization_id = ? AND artifact_id <> ALL(?)`,
        [orgId, exclude]
      ),
      workingRevisionsOfDescendants: await countRows(
        `SELECT count(*) AS n FROM finance_working_revisions WHERE organization_id = ? AND artifact_id <> ALL(?)`,
        [orgId, exclude]
      ),
      businessVersionsOfDescendants: await countRows(
        `SELECT count(*) AS n FROM finance_business_versions WHERE organization_id = ? AND artifact_id <> ALL(?)`,
        [orgId, exclude]
      ),
    };
  }

  // -------------------------------------------------------------------------
  // Fixtures
  // -------------------------------------------------------------------------

  // Org A — a 4-level chain: SP -> HA -> BM -> PS.
  let aStatement: Node;
  let aAnalysis: Node;
  let aModel: Node;
  let aScenario: Node;

  // Org B — a fan-in node with three parents, for the §6.4 severity ordering.
  let bStatement1: Node;
  let bStatement2: Node;
  let bAnalysis: Node;
  let bModel: Node;

  // Org C — a mirror of org A's first two levels, must never be touched.
  let cStatement: Node;
  let cAnalysis: Node;

  // Org D — a 5-level chain for the depth limit.
  let dNodes: Node[] = [];

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    lineageService = await import('../lineageService.js');
    lineageFreshnessService = await import('../lineageFreshnessService.js');

    await createOrg(orgA, 'AP-11 chain org');
    await createOrg(orgB, 'AP-11 priority org');
    await createOrg(orgC, 'AP-11 tenant-isolation org');
    await createOrg(orgD, 'AP-11 depth-limit org');

    // --- Org A -------------------------------------------------------------
    // The direct child is APPROVED on purpose: B01's immutability trigger
    // whitelists exactly freshness/freshness_reason/stale_since for APPROVED
    // rows, so marking an approved descendant is the case most likely to be
    // rejected by the database if the implementation touched anything else.
    aStatement = await createApprovedNode(orgA, 'STATEMENT_PACK', 'ap11-a-statement');
    aAnalysis = await createApprovedNode(orgA, 'HISTORICAL_ANALYSIS', 'ap11-a-analysis');
    aModel = await createNode(orgA, 'BASELINE_MODEL', 'ap11-a-model');
    aScenario = await createNode(orgA, 'PREDICTION_SCENARIO', 'ap11-a-scenario');

    await link(orgA, { node: aStatement, type: 'STATEMENT_PACK' }, { node: aAnalysis, type: 'HISTORICAL_ANALYSIS' }, 'STATEMENT_TO_ANALYSIS');
    await link(orgA, { node: aAnalysis, type: 'HISTORICAL_ANALYSIS' }, { node: aModel, type: 'BASELINE_MODEL' }, 'ANALYSIS_TO_MODEL', {
      hash: 'sha-ap11-a-analysis-to-model',
    });
    await link(orgA, { node: aModel, type: 'BASELINE_MODEL' }, { node: aScenario, type: 'PREDICTION_SCENARIO' }, 'MODEL_TO_SCENARIO', {
      hash: 'sha-ap11-a-model-to-scenario',
    });

    // --- Org B -------------------------------------------------------------
    bStatement1 = await createApprovedNode(orgB, 'STATEMENT_PACK', 'ap11-b-statement-1');
    bStatement2 = await createApprovedNode(orgB, 'STATEMENT_PACK', 'ap11-b-statement-2');
    bAnalysis = await createApprovedNode(orgB, 'HISTORICAL_ANALYSIS', 'ap11-b-analysis');
    bModel = await createNode(orgB, 'BASELINE_MODEL', 'ap11-b-model');

    await link(orgB, { node: bStatement1, type: 'STATEMENT_PACK' }, { node: bModel, type: 'BASELINE_MODEL' }, 'STATEMENT_TO_MODEL');
    await link(orgB, { node: bStatement2, type: 'STATEMENT_PACK' }, { node: bModel, type: 'BASELINE_MODEL' }, 'STATEMENT_TO_MODEL');
    await link(orgB, { node: bAnalysis, type: 'HISTORICAL_ANALYSIS' }, { node: bModel, type: 'BASELINE_MODEL' }, 'ANALYSIS_TO_MODEL', {
      hash: 'sha-ap11-b-analysis-to-model',
    });

    // --- Org C -------------------------------------------------------------
    cStatement = await createApprovedNode(orgC, 'STATEMENT_PACK', 'ap11-c-statement');
    cAnalysis = await createApprovedNode(orgC, 'HISTORICAL_ANALYSIS', 'ap11-c-analysis');
    await link(orgC, { node: cStatement, type: 'STATEMENT_PACK' }, { node: cAnalysis, type: 'HISTORICAL_ANALYSIS' }, 'STATEMENT_TO_ANALYSIS');

    // --- Org D -------------------------------------------------------------
    const dStatement = await createNode(orgD, 'STATEMENT_PACK', 'ap11-d-statement');
    const dAnalysis = await createNode(orgD, 'HISTORICAL_ANALYSIS', 'ap11-d-analysis');
    const dModel = await createNode(orgD, 'BASELINE_MODEL', 'ap11-d-model');
    const dScenario = await createNode(orgD, 'PREDICTION_SCENARIO', 'ap11-d-scenario');
    const dValuation = await createNode(orgD, 'VALUATION_CASE', 'ap11-d-valuation');
    dNodes = [dStatement, dAnalysis, dModel, dScenario, dValuation];

    await link(orgD, { node: dStatement, type: 'STATEMENT_PACK' }, { node: dAnalysis, type: 'HISTORICAL_ANALYSIS' }, 'STATEMENT_TO_ANALYSIS');
    await link(orgD, { node: dAnalysis, type: 'HISTORICAL_ANALYSIS' }, { node: dModel, type: 'BASELINE_MODEL' }, 'ANALYSIS_TO_MODEL', {
      hash: 'sha-ap11-d-1',
    });
    await link(orgD, { node: dModel, type: 'BASELINE_MODEL' }, { node: dScenario, type: 'PREDICTION_SCENARIO' }, 'MODEL_TO_SCENARIO', {
      hash: 'sha-ap11-d-2',
    });
    await link(orgD, { node: dScenario, type: 'PREDICTION_SCENARIO' }, { node: dValuation, type: 'VALUATION_CASE' }, 'SCENARIO_TO_VALUATION', {
      hash: 'sha-ap11-d-3',
    });
  }, 180_000);

  afterAll(async () => {
    // Best-effort, same convention as the other canonical pg suites: the
    // append-only triggers make finance_lineage_edges / finance_business_versions
    // undeletable by design. Only the freshness ledger is cleaned.
    if (!REAL_PG) return;
    // Set AP11_KEEP_LEDGER=1 to leave the propagation ledger in place so a
    // reviewer can read the physical rows with psql after the run instead of
    // taking the assertions' word for it.
    if (process.env.AP11_KEEP_LEDGER === '1') return;
    await withPinnedPostgresTransaction(async (tx) => {
      for (const org of [orgA, orgB, orgC, orgD]) {
        await tx.queryRun(`DELETE FROM finance_lineage_freshness_events WHERE organization_id = ?`, [org]);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 1-4. The core requirement, driven by the REAL approveVersion() trigger.
  // -------------------------------------------------------------------------

  let orgAFootprintBefore: Awaited<ReturnType<typeof computeFootprint>>;
  let orgADescendantsBefore: Array<NonNullable<Awaited<ReturnType<typeof readVersion>>>>;

  it('a new approved source version marks its DIRECT child STALE_SOURCE (level 1)', async () => {
    // Precondition, read from the database, not assumed.
    for (const node of [aAnalysis, aModel, aScenario]) {
      const row = await readVersion(node.bvId);
      expect(row?.freshness).toBe('CURRENT');
      expect(row?.stale_since).toBeNull();
    }
    expect(await ledgerFor(orgA)).toHaveLength(0);

    orgAFootprintBefore = await computeFootprint(orgA, [aStatement.artifactId]);
    orgADescendantsBefore = [];
    for (const node of [aAnalysis, aModel, aScenario]) {
      const row = await readVersion(node.bvId);
      if (!row) throw new Error('missing descendant row');
      orgADescendantsBefore.push(row);
    }


    const { approved } = await reopenAndApprove(orgA, aStatement);
    expect(approved.ok).toBe(true);
    if (!approved.ok) throw new Error('unreachable');

    // The service reports what it did — including the literal "no recompute".
    expect(approved.freshnessPropagation).toBeTruthy();
    expect(approved.freshnessPropagation?.rootVersionId).toBe(aStatement.bvId);
    expect(approved.freshnessPropagation?.reasonCode).toBe('NEW_SOURCE_VERSION');
    expect(approved.freshnessPropagation?.recomputeEnqueued).toBe(false);
    expect(approved.freshnessPropagation?.depthLimitReached).toBe(false);

    // Physical read-back of the DIRECT child (an APPROVED row).
    const analysis = await readVersion(aAnalysis.bvId);
    expect(analysis?.status).toBe('APPROVED');
    expect(analysis?.freshness).toBe('STALE_SOURCE');
    expect(analysis?.freshness_reason).toBe('NEW_SOURCE_VERSION');
    expect(analysis?.stale_since).toBeTruthy();

    // The superseded source itself is NOT marked stale — it is superseded,
    // which is a different axis (§7.2).
    const oldStatement = await readVersion(aStatement.bvId);
    expect(oldStatement?.status).toBe('SUPERSEDED');
    expect(oldStatement?.freshness).toBe('CURRENT');
  }, 120_000);

  it('propagation reaches INDIRECT descendants at depth 2 and 3', async () => {
    const model = await readVersion(aModel.bvId);
    expect(model?.freshness).toBe('STALE_SOURCE');
    expect(model?.freshness_reason).toBe('NEW_SOURCE_VERSION');
    expect(model?.stale_since).toBeTruthy();

    const scenario = await readVersion(aScenario.bvId);
    expect(scenario?.freshness).toBe('STALE_SOURCE');
    expect(scenario?.freshness_reason).toBe('NEW_SOURCE_VERSION');
    expect(scenario?.stale_since).toBeTruthy();
  });

  it('one append-only ledger row per real transition, with the NEAREST ancestor as trigger', async () => {
    const events = await ledgerFor(orgA);
    expect(events).toHaveLength(3);

    const byTarget = new Map(events.map((e) => [e.target_version_id, e]));
    expect([...byTarget.keys()].sort()).toEqual([aAnalysis.bvId, aModel.bvId, aScenario.bvId].sort());

    for (const e of events) {
      expect(e.previous_state).toBe('CURRENT');
      expect(e.new_state).toBe('STALE_SOURCE');
      expect(e.reason_code).toBe('NEW_SOURCE_VERSION');
      expect(e.triggering_edge_id).toBeTruthy();
    }

    // §6.3 step 6 — triggering_version_id is the closest ancestor on the path,
    // not always the root, so "source changed" reads usefully near the node.
    expect(byTarget.get(aAnalysis.bvId)?.triggering_version_id).toBe(aStatement.bvId);
    expect(byTarget.get(aModel.bvId)?.triggering_version_id).toBe(aAnalysis.bvId);
    expect(byTarget.get(aScenario.bvId)?.triggering_version_id).toBe(aModel.bvId);

    // And the edge each event blames really is the edge between those two.
    for (const [target, expectedSource] of [
      [aAnalysis.bvId, aStatement.bvId],
      [aModel.bvId, aAnalysis.bvId],
      [aScenario.bvId, aModel.bvId],
    ] as const) {
      const edge = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ source_version_id: string; target_version_id: string }>(
          `SELECT source_version_id, target_version_id FROM finance_lineage_edges WHERE id = ?`,
          [byTarget.get(target)?.triggering_edge_id]
        )
      );
      expect(edge?.source_version_id).toBe(expectedSource);
      expect(edge?.target_version_id).toBe(target);
    }
  });

  it('NOTHING was recomputed — no compute jobs, no snapshots, no new versions for any descendant', async () => {
    const after = await computeFootprint(orgA, [aStatement.artifactId]);

    // The whole point of the requirement: marking must not schedule work.
    expect(after.computeJobs).toBe(0);
    expect(orgAFootprintBefore.computeJobs).toBe(0);
    expect(after.computeJobOutputs).toBe(0);
    expect(after.computeJobRuns).toBe(0);

    // The approved artifact itself legitimately gains a compute snapshot (that
    // is approve's step (b)); its DESCENDANTS must gain nothing at all.
    expect(after.snapshotsOfDescendants).toBe(orgAFootprintBefore.snapshotsOfDescendants);
    expect(after.workingRevisionsOfDescendants).toBe(orgAFootprintBefore.workingRevisionsOfDescendants);
    expect(after.businessVersionsOfDescendants).toBe(orgAFootprintBefore.businessVersionsOfDescendants);

    // Column-level proof that only the three freshness columns moved: the CAS
    // counter, the frozen snapshot pointer, the content hash and the working
    // revision pointer of every descendant are byte-identical.
    for (const before of orgADescendantsBefore) {
      const now = await readVersion(before.business_version_id);
      expect(now?.version).toBe(before.version);
      expect(now?.status).toBe(before.status);
      expect(now?.compute_snapshot_id).toBe(before.compute_snapshot_id);
      expect(now?.content_semantic_hash).toBe(before.content_semantic_hash);
      expect(now?.source_working_revision_id).toBe(before.source_working_revision_id);
      // ...and the freshness columns DID move, so this is not a no-op test.
      expect(now?.freshness).not.toBe(before.freshness);
    }
  });

  // -------------------------------------------------------------------------
  // 5. Idempotency (§6.3 step 1).
  // -------------------------------------------------------------------------

  it('replaying the same event changes nothing and does NOT refresh stale_since', async () => {
    const before = await Promise.all([aAnalysis, aModel, aScenario].map((n) => readVersion(n.bvId)));
    const ledgerBefore = await ledgerFor(orgA);

    const summary = await lineageFreshnessService.propagateStaleness({
      organizationId: orgA,
      rootVersionId: aStatement.bvId,
      reasonCode: 'NEW_SOURCE_VERSION',
    });

    expect(summary.visited).toBe(3);
    expect(summary.unchanged).toBe(3);
    expect(summary.marked).toBe(0);
    expect(summary.reasonSuppressed).toBe(0);
    expect(summary.eventsWritten).toBe(0);

    // No new ledger rows...
    expect(await ledgerFor(orgA)).toHaveLength(ledgerBefore.length);

    // ...and, the load-bearing bit, the AGE of the staleness is preserved.
    const after = await Promise.all([aAnalysis, aModel, aScenario].map((n) => readVersion(n.bvId)));
    for (let i = 0; i < before.length; i += 1) {
      expect(instant(after[i]?.stale_since)).toBe(instant(before[i]?.stale_since));
      expect(instant(after[i]?.stale_since)).not.toBeNull();
      expect(after[i]?.freshness).toBe('STALE_SOURCE');
      expect(after[i]?.freshness_reason).toBe('NEW_SOURCE_VERSION');
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 6. Reason severity ordering (§6.4), all three steps via REAL triggers.
  // -------------------------------------------------------------------------

  let bModelStaleSinceAfterFirst: string | null = null;

  it('step 1: a new approved source version marks the fan-in node NEW_SOURCE_VERSION', async () => {
    const { approved } = await reopenAndApprove(orgB, bAnalysis);
    if (!approved.ok) throw new Error('unreachable');
    expect(approved.freshnessPropagation?.marked).toBe(1);

    const model = await readVersion(bModel.bvId);
    expect(model?.freshness).toBe('STALE_SOURCE');
    expect(model?.freshness_reason).toBe('NEW_SOURCE_VERSION');
    expect(model?.stale_since).toBeTruthy();
    bModelStaleSinceAfterFirst = instant(model?.stale_since);
  }, 120_000);

  /**
   * PRE-EXISTING DEFECT, discovered by this work package and deliberately NOT
   * fixed here (`artifactVersionService.transition()` is frozen-wave code and
   * the fix belongs to WP-B02, not AP-11).
   *
   * `transition()` writes `SET status = ?, version = version + 1, ...` for
   * EVERY action. `finance_bv_enforce_immutability()` (B01 migration §6)
   * whitelists exactly `status, superseded_by_version_id, invalidated_reason,
   * updated_at, archived_by, archived_at, superseded_at, freshness,
   * freshness_reason, stale_since` for a row that is already APPROVED —
   * `version` is NOT on that list. So the CAS bump itself trips the
   * immutability trigger, and BOTH transitions whose only legal source state
   * is APPROVED — T10 `archive` and T11 `invalidate` — throw a raw Postgres
   * error against a real database, unconditionally. Verified directly in psql:
   * the same UPDATE without `version = version + 1` succeeds.
   *
   * Nothing caught this before because the only existing coverage of
   * invalidate/archive is `lifecycleService.test.ts`, which unit-tests the
   * PURE `validateTransition()` decision table and never reaches SQL.
   *
   * Consequence for AP-11: the `SOURCE_INVALIDATED` propagation IS wired into
   * `transition()` (one additive call, same transaction) and is correct, but
   * it cannot fire today because the statement before it throws. This test
   * pins the blocker so it is visible rather than silently worked around —
   * when WP-B02 fixes the version bump, this test goes red and the step-2 test
   * below should be rewritten to drive the real `transition({action:
   * 'invalidate'})` path again.
   */
  it('BLOCKER (pre-existing, WP-B02): transition(invalidate) on an APPROVED version is rejected by the B01 immutability trigger', async () => {
    await expect(
      artifactVersionService.transition({
        organizationId: orgB,
        businessVersionId: bStatement1.bvId,
        action: 'invalidate',
        actorId: adminId,
        role: 'finance_admin',
        expectedVersion: bStatement1.version,
        reason: 'AP-11 test — source found to be wrong',
      })
    ).rejects.toThrow(/is APPROVED; only status and its associated metadata columns may change/);

    // The failed transaction rolled back completely: the version is untouched,
    // so nothing downstream was marked either.
    const source = await readVersion(bStatement1.bvId);
    expect(source?.status).toBe('APPROVED');
    expect(source?.version).toBe(bStatement1.version);
    const model = await readVersion(bModel.bvId);
    expect(model?.freshness_reason).toBe('NEW_SOURCE_VERSION');
  }, 120_000);

  it('step 2: a STRONGER reason (SOURCE_INVALIDATED) overrides the weaker one, keeping stale_since', async () => {
    // Driven through the service API rather than `transition({action:
    // 'invalidate'})` ONLY because of the blocker pinned by the test above —
    // this is the exact same function, with the exact same arguments, that the
    // wired-in trigger passes (`rootVersionId` = the invalidated version,
    // `reasonCode: 'SOURCE_INVALIDATED'`).
    const summary = await lineageFreshnessService.propagateStaleness({
      organizationId: orgB,
      rootVersionId: bStatement1.bvId,
      reasonCode: 'SOURCE_INVALIDATED',
    });
    expect(summary.marked).toBe(1);
    expect(summary.recomputeEnqueued).toBe(false);

    const model = await readVersion(bModel.bvId);
    expect(model?.freshness).toBe('STALE_SOURCE');
    expect(model?.freshness_reason).toBe('SOURCE_INVALIDATED');
    // Escalating the reason must not reset how long this has been stale.
    expect(instant(model?.stale_since)).toBe(bModelStaleSinceAfterFirst);
    expect(bModelStaleSinceAfterFirst).not.toBeNull();
  }, 120_000);

  it('step 3: a WEAKER reason arriving later does NOT overwrite it, but IS recorded in the ledger', async () => {
    const ledgerBefore = await ledgerFor(orgB);

    const { approved } = await reopenAndApprove(orgB, bStatement2);
    if (!approved.ok) throw new Error('unreachable');
    expect(approved.freshnessPropagation?.reasonCode).toBe('NEW_SOURCE_VERSION');
    expect(approved.freshnessPropagation?.marked).toBe(0);
    expect(approved.freshnessPropagation?.reasonSuppressed).toBe(1);

    // The version row kept the more serious reason and the original timestamp.
    const model = await readVersion(bModel.bvId);
    expect(model?.freshness).toBe('STALE_SOURCE');
    expect(model?.freshness_reason).toBe('SOURCE_INVALIDATED');
    expect(instant(model?.stale_since)).toBe(bModelStaleSinceAfterFirst);

    // ...while the ledger still records the suppressed attempt (§6.4 "pełna historia").
    const ledgerAfter = await ledgerFor(orgB);
    expect(ledgerAfter).toHaveLength(ledgerBefore.length + 1);
    const suppressed = ledgerAfter[ledgerAfter.length - 1];
    expect(suppressed.target_version_id).toBe(bModel.bvId);
    expect(suppressed.reason_code).toBe('NEW_SOURCE_VERSION');
    expect(suppressed.previous_state).toBe('STALE_SOURCE');
    expect(suppressed.new_state).toBe('STALE_SOURCE');
    expect(suppressed.triggering_version_id).toBe(bStatement2.bvId);
  }, 120_000);

  // -------------------------------------------------------------------------
  // 7. Tenant isolation.
  // -------------------------------------------------------------------------

  it('propagation never crosses an organization boundary', async () => {
    // Org C has the same graph shape as org A and has seen all of the above
    // activity happen next to it in the same database.
    for (const node of [cStatement, cAnalysis]) {
      const row = await readVersion(node.bvId);
      expect(row?.organization_id).toBe(orgC);
      expect(row?.freshness).toBe('CURRENT');
      expect(row?.freshness_reason).toBeNull();
      expect(row?.stale_since).toBeNull();
    }
    expect(await ledgerFor(orgC)).toHaveLength(0);

    // Now the adversarial case: ask for org A's root while claiming org C.
    // The walk must find nothing rather than following the edge.
    const crossTenant = await lineageFreshnessService.propagateStaleness({
      organizationId: orgC,
      rootVersionId: aStatement.bvId,
      reasonCode: 'SOURCE_INVALIDATED',
    });
    expect(crossTenant.visited).toBe(0);
    expect(crossTenant.marked).toBe(0);
    expect(crossTenant.eventsWritten).toBe(0);
    expect(await ledgerFor(orgC)).toHaveLength(0);

    // And the mirror: org C's own source change must not reach org A's graph.
    const orgALedgerBefore = await ledgerFor(orgA);
    const { approved } = await reopenAndApprove(orgC, cStatement);
    if (!approved.ok) throw new Error('unreachable');
    expect(approved.freshnessPropagation?.marked).toBe(1);

    const cAnalysisRow = await readVersion(cAnalysis.bvId);
    expect(cAnalysisRow?.freshness).toBe('STALE_SOURCE');

    const orgCEvents = await ledgerFor(orgC);
    expect(orgCEvents).toHaveLength(1);
    expect(orgCEvents[0].target_version_id).toBe(cAnalysis.bvId);

    // Org A gained nothing from org C's activity.
    expect(await ledgerFor(orgA)).toHaveLength(orgALedgerBefore.length);
    for (const node of [aAnalysis, aModel, aScenario]) {
      const row = await readVersion(node.bvId);
      expect(row?.freshness_reason).toBe('NEW_SOURCE_VERSION');
    }
  }, 180_000);

  // -------------------------------------------------------------------------
  // 8. Depth limit — explicit, never silent.
  // -------------------------------------------------------------------------

  it('exceeding the depth limit stops the walk, reports it, and records it in the ledger', async () => {
    const [dStatement, dAnalysis, dModel, dScenario, dValuation] = dNodes;

    const summary = await lineageFreshnessService.propagateStaleness({
      organizationId: orgD,
      rootVersionId: dStatement.bvId,
      reasonCode: 'NEW_SOURCE_VERSION',
      maxDepth: 2,
    });

    expect(summary.visited).toBe(2);
    expect(summary.marked).toBe(2);
    expect(summary.depthLimitReached).toBe(true);
    expect(summary.truncatedAtVersionIds).toEqual([dModel.bvId]);

    expect((await readVersion(dAnalysis.bvId))?.freshness).toBe('STALE_SOURCE');
    expect((await readVersion(dModel.bvId))?.freshness).toBe('STALE_SOURCE');
    // Beyond the limit: untouched, and provably so.
    expect((await readVersion(dScenario.bvId))?.freshness).toBe('CURRENT');
    expect((await readVersion(dValuation.bvId))?.freshness).toBe('CURRENT');

    const events = await ledgerFor(orgD);
    expect(events).toHaveLength(3);
    const marker = events.find((e) => e.reason_code === 'PROPAGATION_DEPTH_LIMIT_EXCEEDED');
    expect(marker).toBeTruthy();
    expect(marker?.target_version_id).toBe(dModel.bvId);
    expect(marker?.previous_state).toBe('STALE_SOURCE');
    expect(marker?.new_state).toBe('STALE_SOURCE');
  }, 120_000);

  it('the default depth is enough for the whole domain — the same graph completes without truncation', async () => {
    const [dStatement, , , dScenario, dValuation] = dNodes;

    const summary = await lineageFreshnessService.propagateStaleness({
      organizationId: orgD,
      rootVersionId: dStatement.bvId,
      reasonCode: 'NEW_SOURCE_VERSION',
    });

    expect(summary.depthLimitReached).toBe(false);
    expect(summary.truncatedAtVersionIds).toEqual([]);
    expect(summary.visited).toBe(4);
    // The two already-stale nodes are idempotent no-ops; only the two beyond
    // the previous limit are newly marked.
    expect(summary.unchanged).toBe(2);
    expect(summary.marked).toBe(2);

    expect((await readVersion(dScenario.bvId))?.freshness).toBe('STALE_SOURCE');
    expect((await readVersion(dValuation.bvId))?.freshness).toBe('STALE_SOURCE');
  }, 120_000);

  // -------------------------------------------------------------------------
  // 9. Pure severity table (no DB) — guards the ordering itself.
  // -------------------------------------------------------------------------

  it('the severity ordering matches WP-B03 §6.4 exactly', async () => {
    const { reasonOverrides } = lineageFreshnessService;
    expect(reasonOverrides('SOURCE_INVALIDATED', 'ASSUMPTION_REGISTRY_CHANGED')).toBe(true);
    expect(reasonOverrides('ASSUMPTION_REGISTRY_CHANGED', 'NEW_SOURCE_VERSION')).toBe(true);
    expect(reasonOverrides('NEW_SOURCE_VERSION', 'COMPUTE_ERROR')).toBe(true);
    expect(reasonOverrides('COMPUTE_ERROR', 'NEW_SOURCE_VERSION')).toBe(false);
    expect(reasonOverrides('NEW_SOURCE_VERSION', 'ASSUMPTION_REGISTRY_CHANGED')).toBe(false);
    expect(reasonOverrides('ASSUMPTION_REGISTRY_CHANGED', 'SOURCE_INVALIDATED')).toBe(false);
    // Equal severity re-applies (a second invalidation is not "weaker").
    expect(reasonOverrides('SOURCE_INVALIDATED', 'SOURCE_INVALIDATED')).toBe(true);
    // No reason at all, and an opaque legacy string, both lose to a real one.
    expect(reasonOverrides('NEW_SOURCE_VERSION', null)).toBe(true);
    expect(reasonOverrides('NEW_SOURCE_VERSION', 'GOLDCO_UPSTREAM_SOURCE_REFRESH_2026Q2')).toBe(true);
  });
});

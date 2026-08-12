/**
 * Finance v3 canonical adapter — Pakiet B2 cross-cutting surface,
 * `crosscutting.routes.ts` (`GET /versions/:id/lineage`, `GET
 * /versions/:id/freshness-events`, `GET /exceptions/open`, `GET
 * /exceptions/inbox`), real PostgreSQL + real HTTP.
 *
 * Gate J1 finding (`J1_ENDPOINT_INVENTORY_report.md` section 5.1): only
 * `/lineage` and `/exceptions/open` had any test call at all (in
 * `pkg-b2-cross-tenant.routes.pg.test.ts`, and only the cross-tenant empty-
 * result shape, never a populated one). `GET /versions/:id/freshness-events`
 * and `GET /exceptions/inbox` had ZERO calls anywhere. This file closes both:
 *   1. freshness-events — drives the REAL `artifactVersionService.
 *      reopenVersion`/`approveVersion` workflow to produce a genuine
 *      `finance_lineage_freshness_events` row (the same production trigger
 *      `lineageFreshnessService.pg.test.ts` exercises at the service layer),
 *      then reads it back through THIS router and cross-checks the HTTP body
 *      against an independent SQL read of the ledger row.
 *   2. exceptions/inbox — raises a real `finance_exceptions` row via
 *      `exceptionLedgerService.raise()` (category tie_out_fail) and confirms
 *      the router's dedupe/DTO wiring surfaces it.
 * Each test includes a cross-tenant isolation check.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Finance v2 Pakiet B2 — crosscutting freshness-events + exceptions/inbox (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let lineageService: typeof import('../../../../services/finance/canonical/lineageService.js');
  let exceptionLedgerService: typeof import('../../../../services/finance/canonical/exceptionLedgerService.js');
  let financeV2Router: express.Router;

  const orgA = `org-crosscut-a-${randomUUID()}`;
  const orgB = `org-crosscut-b-${randomUUID()}`;
  const userA = `user-crosscut-a-${randomUUID()}`;
  const userB = `user-crosscut-b-${randomUUID()}`;
  const approverA = `approver-crosscut-a-${randomUUID()}`;

  function appAsOrg(orgId: string, userId: string) {
    const a = express();
    a.use(express.json());
    a.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
      req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
      next();
    });
    a.use('/api/v8/finance-v2', financeV2Router);
    a.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: String(err?.message || err) }));
    return a;
  }
  let appA: express.Express;
  let appB: express.Express;

  // freshness-events fixture.
  let analysisBvId = '';
  let ledgerRowId = '';

  // exceptions/inbox fixture.
  let inboxArtifactId = '';
  let exceptionGroupId = '';

  async function approveDraft(orgId: string, bvId: string, startVersion: number, approverId: string): Promise<number> {
    const submitted = await av.transition({ organizationId: orgId, businessVersionId: bvId, action: 'submit_for_review', actorId: userA, role: 'preparer', expectedVersion: startVersion });
    if (!submitted.ok) throw new Error(`submit failed: ${submitted.message}`);
    const started = await av.transition({ organizationId: orgId, businessVersionId: bvId, action: 'start_review', actorId: approverId, role: 'approver', expectedVersion: submitted.businessVersion.version });
    if (!started.ok) throw new Error(`start_review failed: ${started.message}`);
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT', freshness_reason = NULL, stale_since = NULL WHERE business_version_id = ?`, [bvId])
    );
    const approved = await av.approveVersion({ organizationId: orgId, businessVersionId: bvId, actorId: approverId, role: 'approver', expectedVersion: started.businessVersion.version });
    if (!approved.ok) throw new Error(`approve failed: ${approved.code} ${approved.message}`);
    return approved.businessVersion.version;
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    lineageService = await import('../../../../services/finance/canonical/lineageService.js');
    exceptionLedgerService = await import('../../../../services/finance/canonical/exceptionLedgerService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [orgA, 'Crosscutting Tenant A', orgB, 'Crosscutting Tenant B'])
    );
    appA = appAsOrg(orgA, userA);
    appB = appAsOrg(orgB, userB);

    // --- freshness-events fixture: STATEMENT_PACK -> HISTORICAL_ANALYSIS, both APPROVED, linked;
    //     reopening+re-approving the statement pack marks the analysis STALE_SOURCE and writes ONE
    //     real finance_lineage_freshness_events row (the exact production trigger
    //     `lineageFreshnessService.pg.test.ts` proves at the service layer).
    const stmt = await av.createArtifact({ organizationId: orgA, artifactType: 'STATEMENT_PACK', createdBy: userA });
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [stmt.businessVersion.business_version_id])
    );
    const stmtVersionAfterApprove = await approveDraft(orgA, stmt.businessVersion.business_version_id, stmt.businessVersion.version, approverA);

    const analysis = await av.createArtifact({ organizationId: orgA, artifactType: 'HISTORICAL_ANALYSIS', createdBy: userA });
    analysisBvId = analysis.businessVersion.business_version_id;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [analysisBvId])
    );
    await approveDraft(orgA, analysisBvId, analysis.businessVersion.version, approverA);

    const edge = await lineageService.insertEdge({
      organizationId: orgA,
      sourceVersionId: stmt.businessVersion.business_version_id,
      sourceArtifactType: 'STATEMENT_PACK',
      targetVersionId: analysisBvId,
      targetArtifactType: 'HISTORICAL_ANALYSIS',
      edgeType: 'STATEMENT_TO_ANALYSIS',
      transformationKind: 'COMPUTE',
      authorId: userA,
      assumptionSnapshotHash: null,
    });
    if (!edge.ok) throw new Error(`fixture setup: STATEMENT_TO_ANALYSIS edge insert failed: ${edge.code}`);

    // Reopen the (now APPROVED) statement pack and re-approve v2 -> real "new source version"
    // event, propagated to the analysis via the edge just inserted.
    const reopened = await av.reopenVersion({ organizationId: orgA, businessVersionId: stmt.businessVersion.business_version_id, actorId: approverA, role: 'approver', expectedVersion: stmtVersionAfterApprove, reason: 'J1 freshness-events fixture' });
    if (!reopened.ok) throw new Error(`fixture setup: reopen failed: ${reopened.code} ${reopened.message}`);
    const childBvId = reopened.businessVersion.business_version_id;
    await withPinnedPostgresTransaction((tx) => tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [childBvId]));
    const reapproveVersion = await approveDraft(orgA, childBvId, reopened.businessVersion.version, approverA);
    void reapproveVersion;

    const ledgerRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(`SELECT id FROM finance_lineage_freshness_events WHERE organization_id = ? AND target_version_id = ?`, [orgA, analysisBvId])
    );
    if (!ledgerRow) throw new Error('fixture setup: expected finance_lineage_freshness_events row not found — propagation did not fire');
    ledgerRowId = ledgerRow.id;

    // --- exceptions/inbox fixture: one real tie_out_fail exception.
    const inboxArtifact = await av.createArtifact({ organizationId: orgA, artifactType: 'STATEMENT_PACK', createdBy: userA });
    inboxArtifactId = inboxArtifact.artifact.artifact_id;
    const raised = await exceptionLedgerService.raise({
      organizationId: orgA,
      artifactId: inboxArtifactId,
      businessVersionId: inboxArtifact.businessVersion.business_version_id,
      severity: 'MATERIAL',
      sourceRef: { statement_line_code: 'CASH' },
      reasonCode: 'J1_INBOX_FIXTURE_TIE_OUT_FAIL',
      raisedBy: userA,
    });
    if (!raised.ok) throw new Error(`fixture setup: raise() failed: ${raised.code}`);
    exceptionGroupId = raised.exception.exception_group_id;
  }, 120_000);

  it('GET /versions/:id/freshness-events — real propagation ledger row round-trips through HTTP, matches independent SQL read', async () => {
    const res = await request(appA).get(`/api/v8/finance-v2/versions/${analysisBvId}/freshness-events`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const event = res.body.data[0];
    expect(event.id).toBe(ledgerRowId);
    expect(event.targetVersionId).toBe(analysisBvId);
    expect(event.previousState).toBe('CURRENT');
    expect(event.newState).toBe('STALE_SOURCE');
    expect(event.reasonCode).toBe('NEW_SOURCE_VERSION');
    expect(event.triggeringEdgeId).toBeTruthy();
    expect(event.createdAt).toBeTruthy();

    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ reason_code: string; previous_state: string; new_state: string }>(`SELECT reason_code, previous_state, new_state FROM finance_lineage_freshness_events WHERE id = ?`, [ledgerRowId])
    );
    expect(sqlRow?.reason_code).toBe('NEW_SOURCE_VERSION');
    expect(sqlRow?.previous_state).toBe('CURRENT');
    expect(sqlRow?.new_state).toBe('STALE_SOURCE');

    const analysisRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ freshness: string; freshness_reason: string }>(`SELECT freshness, freshness_reason FROM finance_business_versions WHERE business_version_id = ?`, [analysisBvId])
    );
    expect(analysisRow?.freshness).toBe('STALE_SOURCE');
    expect(analysisRow?.freshness_reason).toBe('NEW_SOURCE_VERSION');
  });

  it('GET /versions/:id/freshness-events?limit=not-a-number — non-numeric limit -> 400 INVALID_QUERY', async () => {
    const badRes = await request(appA).get(`/api/v8/finance-v2/versions/${analysisBvId}/freshness-events?limit=not-a-number`);
    expect(badRes.status).toBe(400);
    expect(badRes.body).toHaveProperty('code', 'INVALID_QUERY');
  });

  it('CROSS-TENANT GET /versions/:id/freshness-events — org B never sees org A\'s real ledger row (empty result, not an error leak)', async () => {
    const res = await request(appB).get(`/api/v8/finance-v2/versions/${analysisBvId}/freshness-events`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);

    // Legit same-org read still works — proves the empty array above is the tenant boundary, not a bug.
    const legit = await request(appA).get(`/api/v8/finance-v2/versions/${analysisBvId}/freshness-events`);
    expect(legit.status).toBe(200);
    expect(legit.body.data).toHaveLength(1);
  });

  it('GET /exceptions/inbox — real tie_out_fail row surfaces with the correct category/severity/deep link, SQL confirms the raw exception row', async () => {
    const res = await request(appA).get(`/api/v8/finance-v2/exceptions/inbox?artifactId=${inboxArtifactId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const entry = res.body.data[0];
    expect(entry.category).toBe('tie_out_fail');
    expect(entry.mergedCategories).toContain('tie_out_fail');
    expect(entry.severity).toBe('MATERIAL');
    expect(entry.reason).toBe('J1_INBOX_FIXTURE_TIE_OUT_FAIL');
    expect(entry.artifactId).toBe(inboxArtifactId);
    expect(entry.deepLink.artifactId).toBe(inboxArtifactId);

    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ severity: string; reason_code: string; state: string }>(`SELECT severity, reason_code, state FROM finance_exceptions_current WHERE exception_group_id = ?`, [exceptionGroupId])
    );
    expect(sqlRow?.severity).toBe('MATERIAL');
    expect(sqlRow?.reason_code).toBe('J1_INBOX_FIXTURE_TIE_OUT_FAIL');
    expect(sqlRow?.state).toBe('OPEN');
  });

  it('CROSS-TENANT GET /exceptions/inbox — org B never sees org A\'s real exception (empty result, not an error leak)', async () => {
    const res = await request(appB).get(`/api/v8/finance-v2/exceptions/inbox?artifactId=${inboxArtifactId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);

    const legit = await request(appA).get(`/api/v8/finance-v2/exceptions/inbox?artifactId=${inboxArtifactId}`);
    expect(legit.status).toBe(200);
    expect(legit.body.data).toHaveLength(1);
  });
});

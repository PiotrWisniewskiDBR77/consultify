#!/usr/bin/env tsx
/**
 * J4 audit probe — RBAC matrix (rola x stan x akcja), maker-checker
 * (DEC-FIN-001) i niemutowalność APPROVED (DEC-FIN-007) dla Finance v3.
 *
 * Real HTTP (express + supertest) against the real `financeV2Router`, real
 * PostgreSQL (this agent's ephemeral local cluster), and independent
 * verification via a SEPARATE `pg.Client` connection (own TCP socket) that
 * never goes through the app's own `PostgresDatabase` pool.
 *
 * Usage:
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=postgresql://... \
 *     npx tsx scripts/finance-v3-audit/j4-rbac-probe.ts [--rule=<idPrefix>] [--json=<path>]
 *
 * `--rule=<idPrefix>` restricts execution to checks whose id starts with the
 * given prefix (used by the mutant negative-control cycle, so a single
 * mutated check can be re-run in isolation without paying for the whole
 * suite each time). Exit code is 1 iff any EXECUTED check's `pass` is false
 * — the bash orchestrator around the mutant cycle reads this to confirm
 * red/green.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

import express from 'express';
import { Client } from 'pg';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Env gate — same four-variable contract as this repo's *.pg.test.ts suites.
// ---------------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const GATE_OK =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && DATABASE_URL.startsWith('postgres');
if (!GATE_OK) {
  console.error(
    'j4-rbac-probe: refusing to run — need RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=postgresql://... (got DATABASE_URL=' +
      (DATABASE_URL ? '<set, non-postgres or gate flags missing>' : '<unset>') +
      ')'
  );
  process.exit(2);
}
if (!/127\.0\.0\.1|localhost/.test(DATABASE_URL)) {
  console.error('j4-rbac-probe: refusing to run — DATABASE_URL must target 127.0.0.1/localhost only. Got: ' + DATABASE_URL);
  process.exit(2);
}
process.env.DB_TYPE = 'postgres';

// ---------------------------------------------------------------------------
// Result bookkeeping
// ---------------------------------------------------------------------------
type CheckResult = {
  id: string;
  task: string;
  description: string;
  expected: string;
  actual: string;
  pass: boolean;
  detail?: string;
};

const results: CheckResult[] = [];
const ruleFilter = (process.argv.find((a) => a.startsWith('--rule=')) ?? '').slice('--rule='.length) || null;
const jsonOut = (process.argv.find((a) => a.startsWith('--json=')) ?? '').slice('--json='.length) || null;

function record(r: CheckResult) {
  if (ruleFilter && !r.id.startsWith(ruleFilter)) return;
  results.push(r);
  const tag = r.pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${r.id} — ${r.description}`);
  if (!r.pass) {
    console.log(`         expected: ${r.expected}`);
    console.log(`         actual:   ${r.actual}`);
  }
}

function shouldRun(idPrefix: string): boolean {
  return !ruleFilter || idPrefix.startsWith(ruleFilter) || ruleFilter.startsWith(idPrefix);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();

  const { withPinnedPostgresTransaction } = await import('../../src/database/PostgresDatabase.js');
  const financeV2Router = (await import('../../src/routes/v8/finance-v2/index.js')).default;
  const artifactVersionService = await import('../../src/services/finance/canonical/artifactVersionService.js');
  const lifecycleService = await import('../../src/services/finance/canonical/lifecycleService.js');
  const kpiComputeService = await import('../../src/services/finance/canonical/kpiComputeService.js');
  const statementMappingService = await import('../../src/services/finance/canonical/statementMappingService.js');

  // Independent verification connection — its own socket, never the app pool.
  // statement_timeout guards against this shared PG cluster's other
  // concurrently-running agents (J1/J2/J3) holding a catalog lock (e.g.
  // CREATE/DROP ROLE against pg_authid, which is cluster-wide, not
  // per-database) — a hang here previously left a stuck "idle in
  // transaction (aborted)" backend for several minutes.
  const verifyClient = new Client({ connectionString: DATABASE_URL, statement_timeout: 15000, query_timeout: 15000 });
  await verifyClient.connect();

  const orgId = `org-j4-${randomUUID()}`;
  const orgIdOther = `org-j4-other-${randomUUID()}`;
  await withPinnedPostgresTransaction((tx) =>
    tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [orgId, 'J4 RBAC Org', orgIdOther, 'J4 RBAC Org (other tenant)'])
  );

  function appAs(userId: string, organizationId: string, orgRole: string) {
    const a = express();
    a.use(express.json());
    a.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId, role: orgRole };
      req.v8Context = { organizationId, userId, userRole: orgRole };
      next();
    });
    a.use('/api/v8/finance-v2', financeV2Router);
    a.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: String(err?.message || err), stack: err?.stack });
    });
    return a;
  }

  // org roles this codebase actually assigns (mapOrgRoleToFinanceRole's domain).
  // 'reviewer' deliberately NOT included here in the "real org role" list — see
  // RULE-REVIEWER-UNREACHABLE below, this absence IS the finding.
  const ORG_ROLE_FOR_FINANCE_ROLE: Record<string, string> = {
    finance_admin: 'finance_admin',
    approver: 'owner',
    preparer: 'editor',
    viewer: 'member', // anything not in the explicit mapping list -> viewer
  };

  async function createArtifactViaHttp(app: express.Express, artifactType: string, naturalKey?: string) {
    const res = await request(app)
      .post('/api/v8/finance-v2/artifacts')
      .send({ artifactType, naturalKey: naturalKey ?? `nk-${randomUUID()}` });
    if (res.status !== 201) throw new Error(`createArtifactViaHttp failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.data as { artifactId: string; currentBusinessVersion: { businessVersionId: string; version: number; status: string } };
  }

  async function getVersion(businessVersionId: string) {
    return withPinnedPostgresTransaction((tx) =>
      tx.queryOne<any>(`SELECT * FROM finance_business_versions WHERE business_version_id = ?`, [businessVersionId])
    );
  }

  async function verifyIndependently(businessVersionId: string): Promise<any> {
    const r = await verifyClient.query(`SELECT * FROM finance_business_versions WHERE business_version_id = $1`, [businessVersionId]);
    return r.rows[0] ?? null;
  }

  /**
   * TEST SETUP ONLY (never the attack under test): `approveVersion()` step
   * (a2) requires `freshness = 'CURRENT'`, which in production is only ever
   * set by `computeJobService` on a completed compute job. Standing up a
   * full compute run per fixture (baseline/prediction/valuation engines,
   * each with their own input schema) is out of scope for an RBAC probe —
   * this direct UPDATE arranges the precondition so the actual attacks below
   * exercise the role/identity/immutability gates, not the freshness gate.
   * Safe to do via plain SQL here: at IN_REVIEW (non-terminal OLD.status)
   * `trg_finance_bv_immutability` does not restrict which columns change.
   */
  async function forceFreshnessCurrent(businessVersionId: string): Promise<void> {
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [businessVersionId])
    );
  }

  const preparerId = `user-preparer-${randomUUID()}`;
  const preparer2Id = `user-preparer2-${randomUUID()}`;
  const approverId = `user-approver-${randomUUID()}`;
  const financeAdminId = `user-fa-${randomUUID()}`;
  const viewerId = `user-viewer-${randomUUID()}`;
  const dualRoleUserId = `user-dual-${randomUUID()}`; // preparer AND approver at once (org role 'owner' path used separately)

  const appPreparer = appAs(preparerId, orgId, 'editor');
  const appPreparer2 = appAs(preparer2Id, orgId, 'editor');
  const appApprover = appAs(approverId, orgId, 'owner');
  const appFinanceAdmin = appAs(financeAdminId, orgId, 'finance_admin');
  const appViewer = appAs(viewerId, orgId, 'member');

  // =========================================================================
  // TASK 1 — role x state x action matrix, via the generic transitions
  // endpoint (T2-T7/T10-T11) AND the dedicated approve/reopen endpoints.
  // =========================================================================

  async function driveToStatus(app: express.Express, artifactType: string, targetStatus: string): Promise<{ artifactId: string; businessVersionId: string; version: number }> {
    const created = await createArtifactViaHttp(app, artifactType);
    let businessVersionId = created.currentBusinessVersion.businessVersionId;
    let version = created.currentBusinessVersion.version;
    const step = async (action: string, byApp: express.Express, reason?: string) => {
      const res = await request(byApp)
        .post(`/api/v8/finance-v2/versions/${businessVersionId}/transitions`)
        .send({ action, expectedVersion: version, ...(reason ? { reason } : {}) });
      if (res.status !== 200) throw new Error(`driveToStatus step ${action} failed: ${res.status} ${JSON.stringify(res.body)}`);
      version = res.body.data.version;
    };
    if (targetStatus === 'DRAFT') return { artifactId: created.artifactId, businessVersionId, version };
    await step('submit_for_review', appPreparer);
    if (targetStatus === 'READY_FOR_REVIEW') return { artifactId: created.artifactId, businessVersionId, version };
    await step('start_review', appApprover);
    if (targetStatus === 'IN_REVIEW') return { artifactId: created.artifactId, businessVersionId, version };
    if (targetStatus === 'NEEDS_CHANGES') {
      await step('request_changes', appApprover, 'needs more detail');
      return { artifactId: created.artifactId, businessVersionId, version };
    }
    if (targetStatus === 'APPROVED') {
      await forceFreshnessCurrent(businessVersionId);
      const approveRes = await request(appApprover)
        .post(`/api/v8/finance-v2/models/${created.artifactId}/approve`)
        .set('Idempotency-Key', randomUUID())
        .send({ expectedVersion: version });
      if (approveRes.status !== 200) throw new Error(`driveToStatus approve failed: ${approveRes.status} ${JSON.stringify(approveRes.body)}`);
      const bv = await getVersion(businessVersionId);
      return { artifactId: created.artifactId, businessVersionId, version: bv!.version };
    }
    if (targetStatus === 'ARCHIVED' || targetStatus === 'INVALIDATED' || targetStatus === 'SUPERSEDED') {
      await forceFreshnessCurrent(businessVersionId);
      const approveRes = await request(appApprover)
        .post(`/api/v8/finance-v2/models/${created.artifactId}/approve`)
        .set('Idempotency-Key', randomUUID())
        .send({ expectedVersion: version });
      if (approveRes.status !== 200) throw new Error(`driveToStatus approve failed: ${approveRes.status} ${JSON.stringify(approveRes.body)}`);
      let bv = await getVersion(businessVersionId);
      if (targetStatus === 'ARCHIVED') {
        const r = await request(appApprover)
          .post(`/api/v8/finance-v2/versions/${businessVersionId}/transitions`)
          .send({ action: 'archive', expectedVersion: bv!.version });
        if (r.status !== 200) throw new Error(`archive failed: ${r.status} ${JSON.stringify(r.body)}`);
        bv = await getVersion(businessVersionId);
      } else if (targetStatus === 'INVALIDATED') {
        const r = await request(appApprover)
          .post(`/api/v8/finance-v2/versions/${businessVersionId}/transitions`)
          .send({ action: 'invalidate', expectedVersion: bv!.version, reason: 'test invalidate' });
        if (r.status !== 200) throw new Error(`invalidate failed: ${r.status} ${JSON.stringify(r.body)}`);
        bv = await getVersion(businessVersionId);
      } else if (targetStatus === 'SUPERSEDED') {
        // reopen -> v2, then approve v2 -> v1 becomes SUPERSEDED.
        const reopenRes = await request(appApprover)
          .post(`/api/v8/finance-v2/models/${created.artifactId}/reopen`)
          .set('Idempotency-Key', randomUUID())
          .send({ expectedVersion: bv!.version, reason: 'restate for supersede test' });
        if (reopenRes.status !== 201) throw new Error(`reopen failed: ${reopenRes.status} ${JSON.stringify(reopenRes.body)}`);
        const v2Id = reopenRes.body.data.businessVersionId;
        await request(appPreparer).post(`/api/v8/finance-v2/versions/${v2Id}/transitions`).send({ action: 'submit_for_review', expectedVersion: 1 });
        await request(appApprover).post(`/api/v8/finance-v2/versions/${v2Id}/transitions`).send({ action: 'start_review', expectedVersion: 2 });
        await forceFreshnessCurrent(v2Id);
        const approveV2 = await request(appApprover)
          .post(`/api/v8/finance-v2/models/${created.artifactId}/approve`)
          .set('Idempotency-Key', randomUUID())
          .send({ expectedVersion: 3 });
        if (approveV2.status !== 200) throw new Error(`approve v2 failed: ${approveV2.status} ${JSON.stringify(approveV2.body)}`);
        bv = await getVersion(businessVersionId); // v1, should now be SUPERSEDED
      }
      return { artifactId: created.artifactId, businessVersionId, version: bv!.version };
    }
    throw new Error(`driveToStatus: unsupported targetStatus ${targetStatus}`);
  }

  // --- 1a. legal (allowed) transitions must succeed, for the role the table says may perform them.
  const LEGAL_CASES: Array<{ id: string; from: string; action: string; app: express.Express; reasonNeeded?: string; artifactType?: string }> = [
    { id: 'T2', from: 'DRAFT', action: 'submit_for_review', app: appPreparer },
    { id: 'T3', from: 'READY_FOR_REVIEW', action: 'withdraw', app: appPreparer },
    { id: 'T4', from: 'READY_FOR_REVIEW', action: 'start_review', app: appApprover },
    { id: 'T5', from: 'IN_REVIEW', action: 'withdraw', app: appPreparer },
    { id: 'T6', from: 'IN_REVIEW', action: 'request_changes', app: appApprover, reasonNeeded: 'needs fixes' },
    { id: 'T7', from: 'NEEDS_CHANGES', action: 'resume_editing', app: appPreparer },
    { id: 'T10', from: 'APPROVED', action: 'archive', app: appApprover },
    { id: 'T11', from: 'APPROVED', action: 'invalidate', app: appApprover, reasonNeeded: 'bad data' },
  ];

  for (const c of LEGAL_CASES) {
    if (!shouldRun(`RULE-MATRIX-LEGAL-${c.id}`)) continue;
    const st = await driveToStatus(appPreparer, 'HISTORICAL_ANALYSIS', c.from);
    const res = await request(c.app)
      .post(`/api/v8/finance-v2/versions/${st.businessVersionId}/transitions`)
      .send({ action: c.action, expectedVersion: st.version, ...(c.reasonNeeded ? { reason: c.reasonNeeded } : {}) });
    record({
      id: `RULE-MATRIX-LEGAL-${c.id}`,
      task: 'TASK1',
      description: `legal transition ${c.action} from ${c.from} succeeds for its allowed role`,
      expected: 'HTTP 200',
      actual: `HTTP ${res.status} ${JSON.stringify(res.body)}`,
      pass: res.status === 200,
    });
  }

  // --- 1b. the important half: illegal transitions must be REJECTED, with a
  // typed code + correct HTTP status, never a silent no-op / silent 200.
  const ILLEGAL_CASES: Array<{
    id: string;
    description: string;
    setupStatus: string;
    action: string;
    app: express.Express;
    expectStatus: number;
    expectCode: string;
  }> = [
    {
      id: 'RULE-MATRIX-VIEWER-SUBMIT',
      description: 'viewer tries submit_for_review on a DRAFT (not preparer/finance_admin)',
      setupStatus: 'DRAFT',
      action: 'submit_for_review',
      app: appViewer,
      expectStatus: 403,
      expectCode: 'FORBIDDEN',
    },
    {
      id: 'RULE-MATRIX-PREPARER-STARTREVIEW',
      description: 'preparer tries start_review (T4, reviewer/approver/finance_admin only)',
      setupStatus: 'READY_FOR_REVIEW',
      action: 'start_review',
      app: appPreparer,
      expectStatus: 403,
      expectCode: 'FORBIDDEN',
    },
    {
      id: 'RULE-MATRIX-VIEWER-ARCHIVE',
      description: 'viewer tries archive on an APPROVED version',
      setupStatus: 'APPROVED',
      action: 'archive',
      app: appViewer,
      expectStatus: 403,
      expectCode: 'FORBIDDEN',
    },
    {
      id: 'RULE-MATRIX-INVALIDATE-NO-REASON',
      description: 'approver invalidates APPROVED without a reason (requiresReason=true)',
      setupStatus: 'APPROVED',
      action: 'invalidate',
      app: appApprover,
      expectStatus: 400,
      expectCode: 'REASON_REQUIRED',
    },
    {
      id: 'RULE-MATRIX-ARCHIVED-RESURRECT',
      description: 'approver tries submit_for_review on an already-ARCHIVED version (terminal -> non-terminal)',
      setupStatus: 'ARCHIVED',
      action: 'submit_for_review',
      app: appApprover,
      expectStatus: 409,
      expectCode: 'STATE_PRECONDITION_FAILED',
    },
    {
      id: 'RULE-MATRIX-INVALIDATED-ARCHIVE',
      description: 'approver tries archive on an already-INVALIDATED version (terminal, zero outgoing transitions)',
      setupStatus: 'INVALIDATED',
      action: 'archive',
      app: appApprover,
      expectStatus: 409,
      expectCode: 'STATE_PRECONDITION_FAILED',
    },
    {
      id: 'RULE-MATRIX-APPROVED-EDIT-VIA-TRANSITIONS',
      description: 'preparer tries withdraw (edit-shaped) on an APPROVED version — no such (from=APPROVED, action=withdraw) transition exists',
      setupStatus: 'APPROVED',
      action: 'withdraw',
      app: appPreparer,
      expectStatus: 409,
      expectCode: 'STATE_PRECONDITION_FAILED',
    },
  ];

  for (const c of ILLEGAL_CASES) {
    if (!shouldRun(c.id)) continue;
    const st = await driveToStatus(appPreparer, 'HISTORICAL_ANALYSIS', c.setupStatus);
    const before = await verifyIndependently(st.businessVersionId);
    const res = await request(c.app)
      .post(`/api/v8/finance-v2/versions/${st.businessVersionId}/transitions`)
      .send({ action: c.action, expectedVersion: st.version });
    const after = await verifyIndependently(st.businessVersionId);
    const statusOk = res.status === c.expectStatus;
    const codeOk = res.body?.code === c.expectCode;
    const rowUnchanged = before.status === after.status && before.version === after.version;
    record({
      id: c.id,
      task: 'TASK1',
      description: c.description,
      expected: `HTTP ${c.expectStatus} {code:'${c.expectCode}'}, row unchanged (independent SQL)`,
      actual: `HTTP ${res.status} {code:'${res.body?.code}'}, row status ${before.status}->${after.status}, version ${before.version}->${after.version}`,
      pass: statusOk && codeOk && rowUnchanged,
    });
  }

  // --- 1c. reviewer role reachability via real org roles (structural finding, not a vulnerability).
  if (shouldRun('RULE-REVIEWER-UNREACHABLE')) {
    const st = await driveToStatus(appPreparer, 'HISTORICAL_ANALYSIS', 'READY_FOR_REVIEW');
    // No org role in this codebase's mapOrgRoleToFinanceRole ever produces 'reviewer' —
    // confirmed by static read of _shared.ts / models.routes.ts (both private copies
    // identical). We simulate the closest a real user can get: a bare org role with no
    // special mapping (-> 'viewer'), which correctly cannot start_review.
    const res = await request(appViewer)
      .post(`/api/v8/finance-v2/versions/${st.businessVersionId}/transitions`)
      .send({ action: 'start_review', expectedVersion: st.version });
    record({
      id: 'RULE-REVIEWER-UNREACHABLE',
      task: 'TASK1',
      description:
        "STRUCTURAL FINDING: mapOrgRoleToFinanceRole (_shared.ts + models.routes.ts private copy) never returns 'reviewer' for any real org role (owner/admin->approver, editor/finance_editor->preparer, finance_admin->finance_admin, everything else->viewer) — reviewer-only matrix cells are unreachable via HTTP by a real user today",
      expected: "no real org role maps to FinanceRole 'reviewer'",
      actual: 'confirmed by source read; viewer (fallback) correctly rejected from start_review as evidence the fallback path is not secretly reviewer',
      pass: res.status === 403,
    });
  }

  // =========================================================================
  // P0 CHECK — approve endpoint role gate. `approveVersion()` in
  // artifactVersionService.ts accepts `params.role: FinanceRole` but NEVER
  // reads it anywhere in its body (grep confirmed zero references), and
  // `models.routes.ts`'s POST /models/:modelId/approve route calls it with
  // no role check of its own either — unlike reopenVersion (REOPEN_ALLOWED_ROLES)
  // and transition() (validateTransition's allowedRoles check).
  // =========================================================================
  if (shouldRun('RULE-P0-VIEWER-APPROVE')) {
    const st = await driveToStatus(appPreparer, 'HISTORICAL_ANALYSIS', 'IN_REVIEW');
    await forceFreshnessCurrent(st.businessVersionId);
    const before = await verifyIndependently(st.businessVersionId);
    const res = await request(appViewer)
      .post(`/api/v8/finance-v2/models/${st.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: st.version });
    const after = await verifyIndependently(st.businessVersionId);
    record({
      id: 'RULE-P0-VIEWER-APPROVE',
      task: 'TASK1-P0',
      description:
        'P0: a user whose org role maps to FinanceRole viewer (not the submitter) calls POST /models/:id/approve on an IN_REVIEW version',
      expected: 'HTTP 403 FORBIDDEN, row stays IN_REVIEW (independent SQL)',
      actual: `HTTP ${res.status} ${JSON.stringify(res.body)}; row status after (independent SQL): ${after.status}`,
      pass: res.status === 403 && after.status !== 'APPROVED',
      detail:
        after.status === 'APPROVED'
          ? 'CONFIRMED VULNERABLE: viewer successfully approved. approveVersion() never checks params.role; models.routes.ts never gates the route by role either.'
          : undefined,
    });
  }

  // Same P0 probed with preparer (not viewer) — a preparer who is NOT the
  // submitter should also not be able to approve, since T8 in the ADR
  // restricts approve to approver/finance_admin, but no code enforces it.
  if (shouldRun('RULE-P0-PREPARER-APPROVE-NOT-SUBMITTER')) {
    const created = await createArtifactViaHttp(appPreparer, 'HISTORICAL_ANALYSIS');
    let bvId = created.currentBusinessVersion.businessVersionId;
    let ver = created.currentBusinessVersion.version;
    let r = await request(appPreparer).post(`/api/v8/finance-v2/versions/${bvId}/transitions`).send({ action: 'submit_for_review', expectedVersion: ver });
    ver = r.body.data.version;
    r = await request(appApprover).post(`/api/v8/finance-v2/versions/${bvId}/transitions`).send({ action: 'start_review', expectedVersion: ver });
    ver = r.body.data.version;
    await forceFreshnessCurrent(bvId);
    // preparer2 (org role editor -> FinanceRole preparer) never submitted this one (preparerId did) — tries to approve.
    const res = await request(appPreparer2)
      .post(`/api/v8/finance-v2/models/${created.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: ver });
    const after = await verifyIndependently(bvId);
    record({
      id: 'RULE-P0-PREPARER-APPROVE-NOT-SUBMITTER',
      task: 'TASK1-P0',
      description: 'preparer (FinanceRole preparer, not approver/finance_admin), not the submitter, calls approve on an IN_REVIEW version',
      expected: 'HTTP 403 FORBIDDEN, row stays IN_REVIEW',
      actual: `HTTP ${res.status} ${JSON.stringify(res.body)}; row status after: ${after.status}`,
      pass: res.status === 403 && after.status !== 'APPROVED',
      detail: after.status === 'APPROVED' ? 'CONFIRMED VULNERABLE: preparer successfully approved own workstream artifact.' : undefined,
    });
  }

  // =========================================================================
  // TASK 2 — MAKER-CHECKER (DEC-FIN-001)
  // =========================================================================

  // 2a. literal self-approval (submitter === approver) IS correctly blocked
  // for MATERIAL/HIGH_RISK, even though the route has no role gate — the SoD
  // identity check runs regardless of role.
  if (shouldRun('RULE-SOD-LITERAL-SELF-APPROVE')) {
    // Same PHYSICAL user, org role switched between calls (finance_admin can
    // both submit and approve per the transition table) so that
    // submitted_by === the approver's own actorId.
    const selfApproveUserId = `user-selfapprove-${randomUUID()}`;
    const appSelfApprove = appAs(selfApproveUserId, orgId, 'finance_admin');
    const created = await createArtifactViaHttp(appSelfApprove, 'VALUATION_CASE'); // HIGH_RISK by default
    let bvId = created.currentBusinessVersion.businessVersionId;
    let ver = created.currentBusinessVersion.version;
    let r = await request(appSelfApprove).post(`/api/v8/finance-v2/versions/${bvId}/transitions`).send({ action: 'submit_for_review', expectedVersion: ver });
    ver = r.body.data.version;
    r = await request(appSelfApprove).post(`/api/v8/finance-v2/versions/${bvId}/transitions`).send({ action: 'start_review', expectedVersion: ver });
    ver = r.body.data.version;
    await forceFreshnessCurrent(bvId);
    const res = await request(appSelfApprove) // same user (finance_admin) submitted AND now approves
      .post(`/api/v8/finance-v2/models/${created.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: ver });
    const after = await verifyIndependently(bvId);
    record({
      id: 'RULE-SOD-LITERAL-SELF-APPROVE',
      task: 'TASK2',
      description: 'same user submits (submitted_by) AND tries to approve a HIGH_RISK artifact — must be blocked by checkSelfApproval identity check',
      expected: 'HTTP 403 SELF_APPROVAL_FORBIDDEN, row stays IN_REVIEW',
      actual: `HTTP ${res.status} ${JSON.stringify(res.body)}; row after: ${after.status}`,
      pass: res.status === 403 && res.body?.code === 'SELF_APPROVAL_FORBIDDEN' && after.status !== 'APPROVED',
    });
  }

  // 2b. GAP FINDING: identity-based check is IDENTITY-of-submitter only, not
  // identity-of-every-editor. The production route never populates
  // `editorUserIds`/`reviewStartedBy` (grep: zero non-test callers pass
  // them; autosaveService.ts, the real edit path, never writes to
  // artifact_lifecycle_events at all, so there is no data source the route
  // COULD read them from even if it wanted to). This demonstrates the gap
  // concretely: preparer A edits, preparer B (a different literal user, also
  // holding approver via a second org role — modeled here as the SAME
  // physical approver acting AFTER a different submitter B) submits, and
  // then... actually the cleanest reproduction: the editor of the content is
  // NEVER submitted_by (someone else submits on their behalf), and that
  // editor also happens to hold approver rights. Since nothing in this
  // codebase records "editor" at all beyond the single last-writer
  // `edited_by` column on `finance_working_revisions` (never surfaced to
  // approveVersion), the SoD check has no way to catch them.
  if (shouldRun('RULE-SOD-EDITOR-NOT-SUBMITTER-GAP')) {
    // dualRoleUserId acts as an "editor" by being created_by on the artifact
    // (closest concrete hook this schema exposes for "who touched the
    // content" outside of submitted_by), then a DIFFERENT user submits, then
    // dualRoleUserId (who also holds approver via org role owner in a second
    // app instance) approves.
    const appDualAsPreparer = appAs(dualRoleUserId, orgId, 'editor');
    const appDualAsApprover = appAs(dualRoleUserId, orgId, 'owner');
    const created = await createArtifactViaHttp(appDualAsPreparer, 'VALUATION_CASE'); // HIGH_RISK, dualRoleUserId is created_by/edited_by
    let bvId = created.currentBusinessVersion.businessVersionId;
    let ver = created.currentBusinessVersion.version;
    // A DIFFERENT preparer (preparer2Id) submits on the artifact's behalf —
    // submitted_by = preparer2Id, NOT dualRoleUserId, even though
    // dualRoleUserId created/holds the working revision's edited_by.
    let r = await request(appPreparer2)
      .post(`/api/v8/finance-v2/versions/${bvId}/transitions`)
      .send({ action: 'submit_for_review', expectedVersion: ver });
    ver = r.body.data.version;
    r = await request(appApprover).post(`/api/v8/finance-v2/versions/${bvId}/transitions`).send({ action: 'start_review', expectedVersion: ver });
    ver = r.body.data.version;
    await forceFreshnessCurrent(bvId);
    const before = await verifyIndependently(bvId);
    const res = await request(appDualAsApprover)
      .post(`/api/v8/finance-v2/models/${created.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: ver });
    const after = await verifyIndependently(bvId);
    const wrRow = await verifyClient.query(`SELECT edited_by FROM finance_working_revisions WHERE business_version_id = $1`, [bvId]);
    const editorWasIndeedDualUser = wrRow.rows[0]?.edited_by === dualRoleUserId;
    // `pass` uses the SAME "true means secure" convention as every other
    // check in this file: the ideal/secure behavior is 403
    // SELF_APPROVAL_FORBIDDEN (the editor's identity should conflict). Given
    // the confirmed gap (editorUserIds has no production data source), the
    // ACTUAL current behavior is 200 — so this check is EXPECTED to record
    // pass:false on an unmodified tree, and that false is itself the finding.
    record({
      id: 'RULE-SOD-EDITOR-NOT-SUBMITTER-GAP',
      task: 'TASK2',
      description:
        'GAP: the working revision editor (finance_working_revisions.edited_by) is a different physical user from submitted_by, and also holds approver rights via org role — approveVersion() has no editorUserIds data source in production (autosaveService never writes artifact_lifecycle_events; the route never passes editorUserIds/reviewStartedBy), so self-approval-by-editor is not caught even though the ADR (WP-B02 7.2.6) says it should be',
      expected: 'ideally: HTTP 403 SELF_APPROVAL_FORBIDDEN (editor identity should conflict)',
      actual: `HTTP ${res.status} ${JSON.stringify(res.body)}; row before=${before.status} after=${after.status}; edited_by was indeed the approving user: ${editorWasIndeedDualUser}`,
      pass: res.status === 403 && res.body?.code === 'SELF_APPROVAL_FORBIDDEN',
      detail:
        res.status === 200
          ? 'CONFIRMED GAP (not neutralized by any other layer): the editor of the artifact approved their own content because the SoD check only ever compares against submitted_by, and editorUserIds is structurally unreachable (no data source) from the real HTTP route.'
          : 'gap not reproduced this run — investigate before relying on this finding',
    });
  }

  // 2c. dual-role user (holds BOTH preparer and approver org context) — must
  // still be blocked from approving their OWN literal submission (identity,
  // not role, is the gate).
  if (shouldRun('RULE-SOD-DUAL-ROLE-USER')) {
    const appDualAsPreparer = appAs(dualRoleUserId, orgId, 'editor');
    const appDualAsApprover = appAs(dualRoleUserId, orgId, 'owner');
    const created = await createArtifactViaHttp(appDualAsPreparer, 'BASELINE_MODEL'); // MATERIAL
    let bvId = created.currentBusinessVersion.businessVersionId;
    let ver = created.currentBusinessVersion.version;
    let r = await request(appDualAsPreparer).post(`/api/v8/finance-v2/versions/${bvId}/transitions`).send({ action: 'submit_for_review', expectedVersion: ver });
    ver = r.body.data.version;
    r = await request(appApprover).post(`/api/v8/finance-v2/versions/${bvId}/transitions`).send({ action: 'start_review', expectedVersion: ver });
    ver = r.body.data.version;
    await forceFreshnessCurrent(bvId);
    const res = await request(appDualAsApprover) // SAME physical user, now acting with org role 'owner'
      .post(`/api/v8/finance-v2/models/${created.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: ver });
    const after = await verifyIndependently(bvId);
    record({
      id: 'RULE-SOD-DUAL-ROLE-USER',
      task: 'TASK2',
      description: "user who holds preparer AND approver (via two org-role contexts) submitted as themselves, then tries to approve as themselves — identity check must still fire",
      expected: 'HTTP 403 SELF_APPROVAL_FORBIDDEN, row stays IN_REVIEW',
      actual: `HTTP ${res.status} ${JSON.stringify(res.body)}; row after: ${after.status}`,
      pass: res.status === 403 && res.body?.code === 'SELF_APPROVAL_FORBIDDEN' && after.status !== 'APPROVED',
    });
  }

  // 2d. LOW risk tier has NO SoD gate at all (by design, WP-B02 7.2) — same
  // literal self-approval must be ALLOWED for LOW (HISTORICAL_ANALYSIS).
  if (shouldRun('RULE-SOD-LOW-TIER-NO-GATE')) {
    const st = await driveToStatus(appPreparer, 'HISTORICAL_ANALYSIS', 'IN_REVIEW');
    await forceFreshnessCurrent(st.businessVersionId);
    // preparerId submitted (driveToStatus uses appPreparer for submit) — now
    // let the SAME approver context but check LOW tier explicitly allows the
    // submitter's own finance_admin to approve too; use finance_admin here to
    // avoid re-deriving submitted_by.
    const res = await request(appFinanceAdmin)
      .post(`/api/v8/finance-v2/models/${st.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: st.version });
    record({
      id: 'RULE-SOD-LOW-TIER-NO-GATE',
      task: 'TASK2',
      description: 'LOW risk tier (HISTORICAL_ANALYSIS default) has no SoD gate by design — a different approver may approve regardless of who prepared it',
      expected: 'HTTP 200 (no SoD gate applies at LOW tier — this is by-design behavior, not a bug)',
      actual: `HTTP ${res.status} ${JSON.stringify(res.body)}`,
      pass: res.status === 200,
    });
  }

  // 2e. emergency/break-glass override — confirmed NOT IMPLEMENTED anywhere
  // in the codebase (grepped: zero routes/services beyond one doc comment
  // mentioning "emergency approve" as a concept). Nothing to attack; record
  // as an explicit non-finding so the report doesn't silently omit it.
  if (shouldRun('RULE-EMERGENCY-OVERRIDE-NOT-IMPLEMENTED')) {
    record({
      id: 'RULE-EMERGENCY-OVERRIDE-NOT-IMPLEMENTED',
      task: 'TASK2',
      description: 'emergency/break-glass approval override — checked whether it exists at all',
      expected: 'N/A (nothing to test if absent) — if present, must require permission+justification+expiry+audit trail',
      actual:
        'confirmed absent by source grep across server/src/services/finance and server/src/routes/v8/finance-v2 (only one doc-comment mention of "emergency approve" as a future concept in workspaceBarContract.ts:419, zero implementation)',
      pass: true,
    });
  }

  // =========================================================================
  // TASK 3 — IMMUTABILITY OF APPROVED (DEC-FIN-007)
  // =========================================================================

  let approvedFixture: { artifactId: string; businessVersionId: string; version: number } | null = null;
  if (
    shouldRun('RULE-IMMUT') ||
    shouldRun('RULE-REOPEN-PRESERVES-PARENT') ||
    shouldRun('RULE-TRIGGER') ||
    shouldRun('RULE-DRAFT-DELETE')
  ) {
    approvedFixture = await driveToStatus(appPreparer, 'BASELINE_MODEL', 'APPROVED');
  }

  // 3a. no PUT/PATCH/DELETE route exists at all for business versions/artifacts.
  if (shouldRun('RULE-IMMUT-NO-MUTATING-ROUTES') && approvedFixture) {
    const bvId = approvedFixture.businessVersionId;
    const put = await request(appFinanceAdmin).put(`/api/v8/finance-v2/versions/${bvId}`).send({ status: 'DRAFT' });
    const patch = await request(appFinanceAdmin).patch(`/api/v8/finance-v2/versions/${bvId}`).send({ contentSemanticHash: 'TAMPERED' });
    const del = await request(appFinanceAdmin).delete(`/api/v8/finance-v2/versions/${bvId}`);
    const putArt = await request(appFinanceAdmin).put(`/api/v8/finance-v2/artifacts/${approvedFixture.artifactId}`).send({});
    const delArt = await request(appFinanceAdmin).delete(`/api/v8/finance-v2/artifacts/${approvedFixture.artifactId}`);
    const allNotFoundOrMethodNotAllowed = [put, patch, del, putArt, delArt].every((r) => r.status === 404);
    record({
      id: 'RULE-IMMUT-NO-MUTATING-ROUTES',
      task: 'TASK3',
      description: 'PUT/PATCH/DELETE on /versions/:id and /artifacts/:id — no such route is mounted anywhere in finance-v2',
      expected: 'HTTP 404 for all five attempts (no route to even attempt an edit/delete)',
      actual: `PUT versions=${put.status} PATCH versions=${patch.status} DELETE versions=${del.status} PUT artifacts=${putArt.status} DELETE artifacts=${delArt.status}`,
      pass: allNotFoundOrMethodNotAllowed,
    });
  }

  // 3b. attempt to re-approve an already-APPROVED version through the
  // approve endpoint itself (route-level, not raw SQL) — should be rejected
  // because findCurrentArtifactVersion only looks for IN_REVIEW.
  if (shouldRun('RULE-IMMUT-REAPPROVE-VIA-ROUTE') && approvedFixture) {
    const before = await verifyIndependently(approvedFixture.businessVersionId);
    const res = await request(appApprover)
      .post(`/api/v8/finance-v2/models/${approvedFixture.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: approvedFixture.version });
    const after = await verifyIndependently(approvedFixture.businessVersionId);
    record({
      id: 'RULE-IMMUT-REAPPROVE-VIA-ROUTE',
      task: 'TASK3',
      description: 're-approve an already-APPROVED artifact via the real route (models.routes.ts only ever looks up IN_REVIEW versions)',
      expected: 'HTTP 409 STATE_PRECONDITION_FAILED, row unchanged (independent SQL)',
      actual: `HTTP ${res.status} ${JSON.stringify(res.body)}; row unchanged: ${before.updated_at?.getTime?.() === after.updated_at?.getTime?.()}`,
      pass: res.status === 409 && before.content_semantic_hash === after.content_semantic_hash && before.compute_snapshot_id === after.compute_snapshot_id,
    });
  }

  // 3c. DIRECT SQL tamper attempt against an APPROVED row's content columns —
  // must be rejected by trg_finance_bv_immutability, confirmed via the
  // INDEPENDENT verifyClient connection (own socket).
  if (shouldRun('RULE-IMMUT-DIRECT-SQL-TAMPER') && approvedFixture) {
    const before = await verifyIndependently(approvedFixture.businessVersionId);
    let sqlRejected = false;
    let sqlErrorMessage = '';
    try {
      await verifyClient.query(`UPDATE finance_business_versions SET content_semantic_hash = 'TAMPERED-BY-J4-PROBE' WHERE business_version_id = $1`, [
        approvedFixture.businessVersionId,
      ]);
    } catch (e: any) {
      sqlRejected = true;
      sqlErrorMessage = String(e?.message || e);
    }
    const after = await verifyIndependently(approvedFixture.businessVersionId);
    record({
      id: 'RULE-IMMUT-DIRECT-SQL-TAMPER',
      task: 'TASK3',
      description: 'direct UPDATE of content_semantic_hash on an APPROVED row via raw SQL on a SEPARATE connection (bypasses the app entirely) — trg_finance_bv_immutability must reject it',
      expected: 'SQL statement raises (trigger EXCEPTION), row unchanged',
      actual: `sqlRejected=${sqlRejected} (${sqlErrorMessage.slice(0, 200)}); hash before=${before.content_semantic_hash} after=${after.content_semantic_hash}`,
      pass: sqlRejected && before.content_semantic_hash === after.content_semantic_hash,
    });
  }

  // 3d. direct SQL attempt to hard-DELETE an APPROVED row.
  if (shouldRun('RULE-IMMUT-DIRECT-SQL-DELETE') && approvedFixture) {
    let deleteRejectedOrNoop = false;
    let detail = '';
    try {
      const r = await verifyClient.query(`DELETE FROM finance_business_versions WHERE business_version_id = $1`, [approvedFixture.businessVersionId]);
      deleteRejectedOrNoop = r.rowCount === 0;
      detail = `DELETE returned rowCount=${r.rowCount} (no trigger fired — FK RESTRICT from dependent tables is the only defense, if the row happened to have zero children this would have silently succeeded)`;
    } catch (e: any) {
      deleteRejectedOrNoop = true;
      detail = `DELETE raised: ${String(e?.message || e).slice(0, 200)}`;
    }
    const stillThere = await verifyIndependently(approvedFixture.businessVersionId);
    record({
      id: 'RULE-IMMUT-DIRECT-SQL-DELETE',
      task: 'TASK3',
      description: 'direct hard-DELETE of an APPROVED business_versions row via raw SQL — no BEFORE DELETE deny trigger exists on this table; only FK RESTRICT from dependent rows (finance_stmt_lines, finance_compute_snapshots, etc.) defends it',
      expected: 'DELETE fails (FK RESTRICT) because this fixture has dependent finance_compute_snapshots/finance_working_revisions rows',
      actual: `${detail}; row still present after: ${Boolean(stillThere)}`,
      pass: Boolean(stillThere),
      detail: 'NOTE: this table has NO explicit deny-delete trigger — protection is incidental (FK RESTRICT), not a designed invariant. A hypothetically childless APPROVED row would have no DB-level defense against hard delete at all.',
    });
  }

  // 3e. reopen creates vN+1 WITHOUT mutating vN; vN keeps its snapshot and
  // stays openable.
  if (shouldRun('RULE-REOPEN-PRESERVES-PARENT') && approvedFixture) {
    const before = await verifyIndependently(approvedFixture.businessVersionId);
    const reopenRes = await request(appApprover)
      .post(`/api/v8/finance-v2/models/${approvedFixture.artifactId}/reopen`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: approvedFixture.version, reason: 'independent verification of reopen non-mutation' });
    const after = await verifyIndependently(approvedFixture.businessVersionId);
    const childBv = reopenRes.body?.data?.businessVersionId ? await verifyIndependently(reopenRes.body.data.businessVersionId) : null;
    const parentByteIdentical =
      before.status === after.status &&
      before.content_semantic_hash === after.content_semantic_hash &&
      before.compute_snapshot_id === after.compute_snapshot_id &&
      before.approved_by === after.approved_by &&
      before.approved_at?.getTime?.() === after.approved_at?.getTime?.();
    record({
      id: 'RULE-REOPEN-PRESERVES-PARENT',
      task: 'TASK3',
      description: 'reopen() creates vN+1=DRAFT via INSERT; vN (APPROVED) must be byte-identical before/after, confirmed by independent SQL read',
      expected: '201, vN row byte-identical (status/hash/snapshot/approved_by/approved_at unchanged), child is DRAFT with parent_version_id=vN',
      actual: `reopen HTTP ${reopenRes.status}; parent byte-identical=${parentByteIdentical}; child status=${childBv?.status}; child.parent_version_id===vN: ${childBv?.parent_version_id === approvedFixture.businessVersionId}`,
      pass: reopenRes.status === 201 && parentByteIdentical && childBv?.status === 'DRAFT' && childBv?.parent_version_id === approvedFixture.businessVersionId,
    });
  }

  // 3g. reopen ROLE gate (REOPEN_ALLOWED_ROLES = ['approver','finance_admin'])
  // — a viewer must not be able to reopen an APPROVED version. Fresh fixture
  // (independent of 3e above, which already consumes its own approvedFixture
  // via reopen).
  if (shouldRun('RULE-REOPEN-VIEWER-FORBIDDEN')) {
    const fixture2 = await driveToStatus(appPreparer, 'BASELINE_MODEL', 'APPROVED');
    const before = await verifyIndependently(fixture2.businessVersionId);
    const res = await request(appViewer)
      .post(`/api/v8/finance-v2/models/${fixture2.artifactId}/reopen`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: fixture2.version, reason: 'viewer should not be able to do this' });
    const after = await verifyIndependently(fixture2.businessVersionId);
    record({
      id: 'RULE-REOPEN-VIEWER-FORBIDDEN',
      task: 'TASK3',
      description: 'viewer tries to reopen an APPROVED version (reopenVersion() checks REOPEN_ALLOWED_ROLES explicitly, unlike approveVersion())',
      expected: 'HTTP 403 FORBIDDEN, row stays APPROVED, no child DRAFT created',
      actual: `HTTP ${res.status} ${JSON.stringify(res.body)}; row status after: ${after.status}`,
      pass: res.status === 403 && res.body?.code === 'FORBIDDEN' && after.status === 'APPROVED',
    });
  }

  // 3h. approve's blocking-SECURITY-exception gate (WP-B02 5.1 point 1(ii) /
  // DEC-FIN-009, step a3 in approveVersion()).
  if (shouldRun('RULE-APPROVAL-BLOCKED-SECURITY-EXCEPTION')) {
    const fixture3 = await driveToStatus(appPreparer, 'BASELINE_MODEL', 'IN_REVIEW');
    await forceFreshnessCurrent(fixture3.businessVersionId);
    const exceptionId = randomUUID();
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_exceptions (
           id, exception_group_id, organization_id, artifact_id, business_version_id,
           event_type, severity, blocking_category, source_ref, reason, created_by
         ) VALUES (?, ?, ?, ?, ?, 'RAISED', 'SECURITY', 'TENANT_BREACH', '{}'::jsonb, 'j4 probe blocking exception', ?)`,
        [exceptionId, exceptionId, orgId, fixture3.artifactId, fixture3.businessVersionId, preparerId]
      )
    );
    const res = await request(appApprover)
      .post(`/api/v8/finance-v2/models/${fixture3.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: fixture3.version });
    const after = await verifyIndependently(fixture3.businessVersionId);
    record({
      id: 'RULE-APPROVAL-BLOCKED-SECURITY-EXCEPTION',
      task: 'TASK3',
      description: 'approve is attempted while an OPEN SECURITY-severity exception is attached to the version (approveVersion() step a3)',
      expected: 'HTTP 422 APPROVAL_BLOCKED, row stays IN_REVIEW',
      actual: `HTTP ${res.status} ${JSON.stringify(res.body)}; row status after: ${after.status}`,
      pass: res.status === 422 && res.body?.code === 'APPROVAL_BLOCKED' && after.status !== 'APPROVED',
    });
  }

  // 3f. Draft-with-no-children vs Draft-with-children delete — CONFIRMED
  // NOT IMPLEMENTED: there is no delete endpoint for finance_artifacts or
  // finance_business_versions anywhere in the codebase, for any status.
  if (shouldRun('RULE-DRAFT-DELETE')) {
    record({
      id: 'RULE-DRAFT-DELETE',
      task: 'TASK3',
      description: 'Draft (no children) deletable per permissions, Draft WITH children not deletable — checked whether ANY delete capability exists for finance_artifacts/finance_business_versions',
      expected: 'N/A if absent — grep confirms zero DELETE routes and zero deleteArtifact/deleteBusinessVersion service functions anywhere in server/src',
      actual: 'confirmed absent (grep: no `router.delete` touches finance-v2 artifact/version paths; no delete* function in artifactVersionService.ts or any sibling canonical service)',
      pass: true,
      detail: 'This is a scope gap in the delivered feature set, not a security defect — nothing to bypass because nothing exists yet.',
    });
  }

  // =========================================================================
  // TASK 4 — no silent zero at the data layer
  // =========================================================================
  // 4a. The formulaAstEvaluator NA-reachability fix is verified by RUNNING
  // kpiComputeService.pg.test.ts's real-DB suite as part of this probe run
  // (see report — 10/10 passed against this exact ephemeral DB) rather than
  // re-deriving the same GoldCo fixture here. This probe adds the ONE
  // scenario that suite does not cover: the "excluded by analyst" vs
  // "simply never mapped" ambiguity at the KPI engine's actual read path.

  if (shouldRun('RULE-NA-EXCLUDED-VS-FORGOTTEN')) {
    // Minimal statement pack fixture: one canonical line intentionally
    // excluded via a mapping rule with excludeKind='ANALYST_DECISION', one
    // canonical line simply never referenced by any rule/rawLine at all.
    const bvCreated = await createArtifactViaHttp(appPreparer, 'HISTORICAL_ANALYSIS');
    const bvId = bvCreated.currentBusinessVersion.businessVersionId;

    // No finance_stmt_entities/finance_stmt_periods rows are required to
    // reach the EXCLUDE branch (verified by reading mapStatementLines: an
    // unresolved entityCode just makes `entityId` null on the EXCLUDED
    // result, it does not block the branch) — an unresolved periodId also
    // does not block it, since the EXCLUDE branch returns before the
    // `knownPeriods.has(...)` check. This keeps the fixture to exactly what
    // the defect needs.
    const periodId = `per-does-not-exist-${randomUUID()}`;

    const canonicalLineRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string; line_code: string }>(
        `SELECT id, line_code FROM financial_statement_lines WHERE statement_type = 'BS' AND organization_id IS NULL LIMIT 1`
      )
    );
    if (!canonicalLineRow) throw new Error('RULE-NA-EXCLUDED-VS-FORGOTTEN: no global BS canonical line found in financial_statement_lines seed data');

    const sourceLabel = 'Some raw label the analyst decided does not apply';
    const mapResult = await statementMappingService.mapStatementLines({
      organizationId: orgId,
      businessVersionId: bvId,
      unit: 'UNITS',
      presentationCurrency: 'USD',
      createdBy: preparerId,
      rawLines: [
        {
          lineItem: sourceLabel,
          entityCode: `ENT-DOES-NOT-EXIST-${randomUUID()}`,
          periodId,
          currency: 'USD',
          value: 1000,
          sourceRef: {},
        },
      ],
      rules: [
        {
          sourceLabel,
          statementType: 'BS',
          lineCode: canonicalLineRow.line_code,
          action: 'EXCLUDE',
          excludeReasonCode: 'NOT_APPLICABLE_TO_ENTITY',
          excludeKind: 'ANALYST_DECISION',
        },
      ],
    });

    const stmtLinesForCanonicalLine = (
      await verifyClient.query(`SELECT * FROM finance_stmt_lines WHERE business_version_id = $1 AND canonical_line_id = $2`, [bvId, canonicalLineRow.id])
    ).rows;
    const reconciliationHasExcludedRecord = mapResult.some((r: any) => r.bucket === 'EXCLUDED');

    record({
      id: 'RULE-NA-EXCLUDED-VS-FORGOTTEN',
      task: 'TASK4',
      description:
        'known open defect (CONFIRM, not fix): a canonical line the analyst deliberately EXCLUDEs (excludeKind=ANALYST_DECISION) never gets a finance_stmt_lines row at all (mapStatementLines `continue`s before the INSERT for the EXCLUDED branch) — identical, at the finance_stmt_lines table the KPI engine actually reads, to a canonical line nobody ever mapped',
      expected: 'CONFIRMED: zero finance_stmt_lines rows for the excluded canonical_line_id (mapping response records bucket=EXCLUDED, but that record is NOT consulted by kpiComputeService — its CellResolver SELECTs only finance_stmt_lines)',
      actual: `stmtLinesForCanonicalLine.length=${stmtLinesForCanonicalLine.length}; mapping response recorded EXCLUDED bucket=${reconciliationHasExcludedRecord}`,
      pass: stmtLinesForCanonicalLine.length === 0 && (canonicalLineRow ? reconciliationHasExcludedRecord : true),
      detail:
        'User-facing consequence: a KPI that depends on this line surfaces as MISSING (or NA if it is a ratio denominator) with no way for a report viewer to tell "reviewed, does not apply" apart from "nobody filled this in yet" without manually cross-referencing the one-time /statements/:id/map HTTP response or the finance_stmt_reconciliation ledger by hand — neither is surfaced by the KPI/analysis read API.',
    });
  }

  // =========================================================================
  // CROSS-ORG substituted-identifier access (scope item 5). This is
  // primarily J2's mandate, but the coordinator asked J4 to prove it too for
  // the specific RBAC-relevant surfaces (versions/models/artifacts) this
  // probe already drives, using an approver-in-org-A identity substituting
  // an org-B businessVersionId/artifactId that value happens to exist.
  // =========================================================================
  if (shouldRun('RULE-CROSSORG-GET-VERSION') || shouldRun('RULE-CROSSORG-TRANSITION') || shouldRun('RULE-CROSSORG-APPROVE')) {
    const otherOrgPreparer = appAs(`user-otherorg-prep-${randomUUID()}`, orgIdOther, 'editor');
    const otherOrgApprover = appAs(`user-otherorg-appr-${randomUUID()}`, orgIdOther, 'owner');
    const victim = await createArtifactViaHttp(otherOrgPreparer, 'HISTORICAL_ANALYSIS'); // lives in orgIdOther
    let vBvId = victim.currentBusinessVersion.businessVersionId;
    let vVer = victim.currentBusinessVersion.version;
    let vr = await request(otherOrgPreparer).post(`/api/v8/finance-v2/versions/${vBvId}/transitions`).send({ action: 'submit_for_review', expectedVersion: vVer });
    vVer = vr.body.data.version;
    vr = await request(otherOrgApprover).post(`/api/v8/finance-v2/versions/${vBvId}/transitions`).send({ action: 'start_review', expectedVersion: vVer });
    vVer = vr.body.data.version;
    await forceFreshnessCurrent(vBvId);

    if (shouldRun('RULE-CROSSORG-GET-VERSION')) {
      const res = await request(appApprover).get(`/api/v8/finance-v2/versions/${vBvId}`); // approver is in orgId, version belongs to orgIdOther
      record({
        id: 'RULE-CROSSORG-GET-VERSION',
        task: 'CROSS-ORG',
        description: "GET /versions/:id with an org-A caller and an org-B businessVersionId (substituted identifier) — must fail closed as NOT_FOUND, not leak the other tenant's row",
        expected: 'HTTP 404 NOT_FOUND',
        actual: `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`,
        pass: res.status === 404,
      });
    }

    if (shouldRun('RULE-CROSSORG-TRANSITION')) {
      const before = await verifyIndependently(vBvId);
      const res = await request(appApprover) // org-A approver, substituting org-B's businessVersionId
        .post(`/api/v8/finance-v2/versions/${vBvId}/transitions`)
        .send({ action: 'archive', expectedVersion: vVer }); // action irrelevant here since v is IN_REVIEW not APPROVED, but this proves org-scoping fires BEFORE state validation
      const after = await verifyIndependently(vBvId);
      record({
        id: 'RULE-CROSSORG-TRANSITION',
        task: 'CROSS-ORG',
        description: 'org-A caller POSTs a transition against org-B businessVersionId (substituted identifier)',
        expected: 'HTTP 404/409, never a 200; row unchanged (independent SQL)',
        actual: `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}; row status before=${before.status} after=${after.status}`,
        pass: res.status !== 200 && before.status === after.status && before.version === after.version,
      });
    }

    if (shouldRun('RULE-CROSSORG-APPROVE')) {
      const before = await verifyIndependently(vBvId);
      const res = await request(appApprover) // org-A approver, substituting org-B's artifactId
        .post(`/api/v8/finance-v2/models/${victim.artifactId}/approve`)
        .set('Idempotency-Key', randomUUID())
        .send({ expectedVersion: vVer });
      const after = await verifyIndependently(vBvId);
      record({
        id: 'RULE-CROSSORG-APPROVE',
        task: 'CROSS-ORG',
        description: 'org-A approver POSTs approve against org-B artifactId (substituted identifier) — getArtifact/findCurrentArtifactVersion are org-scoped',
        expected: 'HTTP 404 Model not found, row stays IN_REVIEW (independent SQL)',
        actual: `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}; row status after: ${after.status}`,
        pass: res.status === 404 && after.status !== 'APPROVED',
      });
    }
  }

  // =========================================================================
  // Capability-vs-endpoint consistency (scope item 6): the /capabilities
  // read endpoint (allowedActionsFromStatus) is a UI HINT ONLY — it must
  // never be treated as, or substitute for, the endpoint's own gate. Proven
  // by the sharpest possible case: for a viewer on an IN_REVIEW version, the
  // capabilities endpoint correctly does NOT list 'approve' (viewer is not
  // in allowedActionsFromStatus's approver/finance_admin set) — yet, per the
  // confirmed P0 above, the real approve ENDPOINT allows it anyway. This
  // check makes that inconsistency an explicit, independently-recorded
  // finding rather than an inference from the P0 result alone.
  // =========================================================================
  if (shouldRun('RULE-CAPABILITY-NOT-A-GATE')) {
    const st = await driveToStatus(appPreparer, 'HISTORICAL_ANALYSIS', 'IN_REVIEW');
    await forceFreshnessCurrent(st.businessVersionId);
    const capRes = await request(appViewer).get(`/api/v8/finance-v2/artifacts/${st.artifactId}/capabilities`);
    const capabilitySaysApproveAllowed = Array.isArray(capRes.body?.data?.allowedActions) && capRes.body.data.allowedActions.includes('approve');
    const approveRes = await request(appViewer)
      .post(`/api/v8/finance-v2/models/${st.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: st.version });
    const after = await verifyIndependently(st.businessVersionId);
    record({
      id: 'RULE-CAPABILITY-NOT-A-GATE',
      task: 'CAPABILITY-VS-ENDPOINT',
      description:
        "capabilities read for a viewer correctly omits 'approve' from allowedActions, but the real approve endpoint does not consult capabilities/allowedActionsFromStatus at all — it must reject independently of what capabilities says",
      expected: "capabilities.allowedActions does NOT include 'approve' (capRes correctly UI-gates) AND the real endpoint ALSO rejects (403) — capability absence and endpoint rejection must agree",
      actual: `capabilities allowedActions=${JSON.stringify(capRes.body?.data?.allowedActions)} (says approve allowed: ${capabilitySaysApproveAllowed}); real approve endpoint HTTP ${approveRes.status}; row after: ${after.status}`,
      pass: !capabilitySaysApproveAllowed && approveRes.status === 403,
      detail:
        after.status === 'APPROVED'
          ? "CONFIRMED: capabilities correctly says viewer may NOT approve (UI would hide the button), but the real endpoint approved anyway — proof that the endpoint has NO independent gate of its own and silently trusts nothing-at-all rather than the (correct) capability computation. A UI built on capabilities alone would look secure while the API is not."
          : undefined,
    });
  }

  // =========================================================================
  // RLS — local-only, restricted-role check (NOT a substitute for Railway).
  // =========================================================================
  if (shouldRun('RULE-RLS-RESTRICTED-ROLE')) {
    const restrictedRole = `j4_restricted_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    let outcome = 'not run';
    let leakDetected = false;
    let policyBlocked = false;
    try {
      await verifyClient.query(`CREATE ROLE ${restrictedRole} LOGIN PASSWORD 'j4probepw' NOSUPERUSER NOBYPASSRLS`);
      await verifyClient.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON compute_jobs TO ${restrictedRole}`);
      const dbNameFromUrl = new URL(DATABASE_URL).pathname.replace(/^\//, '');
      await verifyClient.query(`GRANT CONNECT ON DATABASE ${dbNameFromUrl} TO ${restrictedRole}`);

      const jobA = randomUUID();
      const jobB = randomUUID();
      const insertJob = `INSERT INTO compute_jobs (
           id, organization_id, job_type, status, input_artifact_id, input_revision_hash,
           engine_manifest_id, idempotency_key, requested_by_user_id
         ) VALUES ($1, $2, 'BASELINE_MODEL', 'queued', $3, 'j4-probe-hash', $4, $5, $6)`;
      const engineManifestRow = await verifyClient.query(`SELECT engine_manifest_id FROM finance_engine_manifests LIMIT 1`);
      const engineManifestId = engineManifestRow.rows[0]?.engine_manifest_id;
      const artifactA = await createArtifactViaHttp(appAs(preparerId, orgId, 'editor'), 'BASELINE_MODEL');
      const artifactB = await createArtifactViaHttp(appAs(preparerId, orgIdOther, 'editor'), 'BASELINE_MODEL');
      await verifyClient.query(insertJob, [jobA, orgId, artifactA.artifactId, engineManifestId, `j4-probe-${jobA}`, preparerId]);
      await verifyClient.query(insertJob, [jobB, orgIdOther, artifactB.artifactId, engineManifestId, `j4-probe-${jobB}`, preparerId]);

      const restrictedUrl = DATABASE_URL.replace(/^postgresql:\/\/[^@]+@/, `postgresql://${restrictedRole}:j4probepw@`);
      const restrictedClient = new Client({ connectionString: restrictedUrl, statement_timeout: 15000, query_timeout: 15000 });
      await restrictedClient.connect();
      await restrictedClient.query(`BEGIN`);
      // SET LOCAL's grammar does not accept bind parameters ($1) — that is
      // what caused the earlier hang (the statement raised a syntax error,
      // aborting the transaction, and the stuck backend was still sitting in
      // pg_stat_activity afterwards). set_config() is the parameterized
      // equivalent (`is_local=true` == LOCAL).
      await restrictedClient.query(`SELECT set_config('app.organization_id', $1, true)`, [orgId]);
      const rows = await restrictedClient.query(`SELECT id, organization_id FROM compute_jobs WHERE id IN ($1, $2)`, [jobA, jobB]);
      await restrictedClient.query(`COMMIT`);
      await restrictedClient.end();

      const seenIds = rows.rows.map((r) => r.id);
      leakDetected = seenIds.includes(jobB); // cross-tenant row visible despite SET LOCAL app.organization_id = orgId
      policyBlocked = seenIds.includes(jobA) && !seenIds.includes(jobB);
      outcome = `restricted-role SELECT saw ${seenIds.length} of 2 rows (own-org visible=${seenIds.includes(jobA)}, other-org visible=${seenIds.includes(jobB)})`;

      await verifyClient.query(`DELETE FROM compute_jobs WHERE id IN ($1, $2)`, [jobA, jobB]);
    } catch (e: any) {
      outcome = `error: ${String(e?.message || e)}`;
    } finally {
      // DROP ROLE fails while ANY privilege (including the DATABASE-level
      // CONNECT grant, easy to forget since it is granted separately above)
      // still references the role — both REVOKEs are required, not just the
      // table-level one, or this leaks a role per run.
      try {
        await verifyClient.query(`REVOKE ALL ON compute_jobs FROM ${restrictedRole}`);
      } catch {}
      try {
        const dbNameForCleanup = new URL(DATABASE_URL).pathname.replace(/^\//, '');
        await verifyClient.query(`REVOKE ALL ON DATABASE ${dbNameForCleanup} FROM ${restrictedRole}`);
      } catch {}
      try {
        await verifyClient.query(`DROP ROLE IF EXISTS ${restrictedRole}`);
      } catch {}
    }
    record({
      id: 'RULE-RLS-RESTRICTED-ROLE',
      task: 'RLS-LOCAL-ONLY',
      description:
        'LOCAL-ONLY check, does NOT replace a Railway measurement: under a freshly-created NOSUPERUSER NOBYPASSRLS role (not postgres), with SET LOCAL app.organization_id set correctly, does the compute_jobs tenant_isolation policy actually hide the other tenant row? This answers "is the policy written correctly", not "is production protected" (production still connects as postgres superuser, which unconditionally bypasses RLS even with FORCE — see 20260826_finance_v3_w2_rls_pilot_policies.sql header, unchanged by this probe).',
      expected: 'own-org row visible, other-org row hidden (policy correctly written)',
      actual: outcome,
      pass: policyBlocked,
    });
  }

  await verifyClient.end();

  // ---------------------------------------------------------------------
  const durationMs = Date.now() - t0;
  const failCount = results.filter((r) => !r.pass).length;
  console.log('\n=========================================');
  console.log(`j4-rbac-probe: ${results.length} checks, ${failCount} FAIL, duration ${durationMs}ms`);
  console.log('=========================================\n');
  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ results, durationMs, ranAt: new Date().toISOString() }, null, 2));
  }
  process.exitCode = failCount > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error('j4-rbac-probe: fatal error', e);
  process.exit(1);
});

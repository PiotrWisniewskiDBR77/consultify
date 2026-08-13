/**
 * ROI-E006 — `listOrganizationRoiPirOutcomes` (AC-05, Decision D14), against
 * a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E006_DESIGN.md §6.
 *
 * Proves: (1) management-chain scoping — a manager sees a direct report's
 * closed case, an unrelated manager's case is excluded; (2) portfolio
 * totals bucket by `pirOutcome` correctly; (3) AC-05's literal mechanism —
 * reading the repository's OWN generated SQL confirms zero legacy table
 * names anywhere in it (`roi_realized_values`/`initiative_benefits`/
 * `benefits_register`/`v8_roi_realization_entries`/`analysis_financials`/
 * `digitization_analyses` — ROI-E001 §2's permanently-excluded set).
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildClientConfig,
  cleanupRoiPirFixtures,
  DB_CONFIGURED,
  insertInitiative,
  insertOrganization,
  insertVisibilityPolicy,
  loadRoiPirTestModules,
  type PirStartedBuildResult,
  buildCaseThroughPirStarted,
  type RoiPirTestModules,
} from './roiPirRealdbFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-e006-orgpir-org-${tag}`;
const MANAGER_ID = `roi-e006-orgpir-manager-${tag}`;
const DIRECT_REPORT_ID = `roi-e006-orgpir-report-${tag}`;
const UNRELATED_OWNER_ID = `roi-e006-orgpir-unrelated-${tag}`;
const USER_APPROVER = `roi-e006-orgpir-approver-${tag}`;
const USER_CLOSER = `roi-e006-orgpir-closer-${tag}`;
const INITIATIVE_ID = `roi-e006-orgpir-init-${tag}`;

let client: Client;
let reachable = false;
let modules: RoiPirTestModules;

async function insertManagementChainEdge(ancestorUserId: string, descendantUserId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_management_chain_closure (organization_id, ancestor_user_id, descendant_user_id, depth)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT DO NOTHING`,
    [ORG_ID, ancestorUserId, descendantUserId]
  );
}

async function closeWithOutcome(
  started: PirStartedBuildResult,
  outcome: 'benefits_fully_realized' | 'benefits_partially_realized' | 'benefits_not_realized'
): Promise<void> {
  await modules.updateRoiPostInvestmentReviewDraft({
    pirId: started.pirId,
    caseId: started.caseId,
    organizationId: ORG_ID,
    expectedVersion: started.pirRowVersion,
    outcome,
    lessonsLearned: `Outcome fixture: ${outcome}`,
    actorUserId: started.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `draft-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  await modules.closeRoiCase({
    caseId: started.caseId,
    organizationId: ORG_ID,
    expectedVersion: started.rowVersion,
    actorUserId: USER_CLOSER,
    actorEffectiveRole: 'admin',
    idempotencyKey: `close-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
}

describe('ROI-E006 listOrganizationRoiPirOutcomes (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E006 org PIR-outcomes realdb tests did NOT run. This run is not evidence.');
      return;
    }
    client = new Client(buildClientConfig() as ClientConfig);
    await client.connect();
    await client.query('SELECT 1 FROM rvn_roi_post_investment_reviews LIMIT 0');
    reachable = true;

    modules = await loadRoiPirTestModules();

    await insertOrganization(client, ORG_ID, 'ROI-E006 Org PIR Outcomes RealDB Org');
    await insertVisibilityPolicy(client, ORG_ID, 'roi', 'OPEN_ORG', MANAGER_ID);
    await insertManagementChainEdge(MANAGER_ID, DIRECT_REPORT_ID);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM rvn_platform_management_chain_closure WHERE organization_id = $1`, [ORG_ID]);
    await cleanupRoiPirFixtures(client, ORG_ID);
    await client.end();
    if (modules.closePgPool) await modules.closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB('chain-scoping: manager sees a direct report\'s closed case; an unrelated owner\'s case is excluded; portfolio totals bucket by outcome', async () => {
    // Direct report's case: closed, benefits_fully_realized — MUST appear.
    await insertInitiative(client, `${INITIATIVE_ID}-report`, ORG_ID, 'Direct report case');
    const reportStarted = await buildCaseThroughPirStarted(client, modules, {
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-report`,
      ownerUserId: DIRECT_REPORT_ID,
      approverId: USER_APPROVER,
    });
    await closeWithOutcome(reportStarted, 'benefits_fully_realized');

    // A SECOND direct-report case, still just past PIR-start (status
    // 'post_investment_review', not yet closed) — MUST appear (design §6:
    // scoped to status IN ('post_investment_review', 'closed')) with
    // pirOutcome null (draft PIR, outcome not yet recorded) and must NOT
    // count toward portfolioTotals (only 'closed' cases count there).
    await insertInitiative(client, `${INITIATIVE_ID}-inflight`, ORG_ID, 'Direct report in-flight case');
    const inFlight = await buildCaseThroughPirStarted(client, modules, {
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-inflight`,
      ownerUserId: DIRECT_REPORT_ID,
      approverId: USER_APPROVER,
    });

    // Unrelated owner's case (no management-chain edge to MANAGER_ID) —
    // MUST be excluded entirely.
    await insertInitiative(client, `${INITIATIVE_ID}-unrelated`, ORG_ID, 'Unrelated owner case');
    const unrelatedStarted = await buildCaseThroughPirStarted(client, modules, {
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-unrelated`,
      ownerUserId: UNRELATED_OWNER_ID,
      approverId: USER_APPROVER,
    });
    await closeWithOutcome(unrelatedStarted, 'benefits_not_realized');

    const result = await modules.listOrganizationRoiPirOutcomes({ managerId: MANAGER_ID, organizationId: ORG_ID });

    const caseIds = result.cases.map((c) => c.caseId);
    expect(caseIds).toContain(reportStarted.caseId);
    expect(caseIds).toContain(inFlight.caseId);
    expect(caseIds).not.toContain(unrelatedStarted.caseId);

    const reportRow = result.cases.find((c) => c.caseId === reportStarted.caseId);
    expect(reportRow).toMatchObject({ status: 'closed', pirOutcome: 'benefits_fully_realized' });
    expect(reportRow!.finalizedAt).not.toBeNull();

    const inFlightRow = result.cases.find((c) => c.caseId === inFlight.caseId);
    expect(inFlightRow).toMatchObject({ status: 'post_investment_review', pirOutcome: null, finalizedAt: null });

    // Portfolio totals: exactly the ONE closed+in-chain case counts.
    expect(result.portfolioTotals.closedCaseCount).toBe(1);
    expect(result.portfolioTotals.fullyRealizedCount).toBe(1);
    expect(result.portfolioTotals.partiallyRealizedCount).toBe(0);
    expect(result.portfolioTotals.notRealizedCount).toBe(0);
  });

  itDB('AC-05: the repository\'s own generated SQL references zero legacy tables', async () => {
    const orgPerspectiveModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.js'
    );
    const base = await orgPerspectiveModule.buildScopedRoiCasesBase(MANAGER_ID, ORG_ID, [
      'post_investment_review',
      'closed',
    ]);
    const legacyTableNames = [
      'roi_realized_values',
      'initiative_benefits',
      'benefits_register',
      'v8_roi_realization_entries',
      'analysis_financials',
      'digitization_analyses',
    ];
    for (const legacyName of legacyTableNames) {
      expect(base.sql).not.toContain(legacyName);
    }
    // Positive control — the CTE text DOES reference the governed tables
    // AC-05 requires.
    expect(base.sql).toContain('rvn_roi_cases');
  });
});

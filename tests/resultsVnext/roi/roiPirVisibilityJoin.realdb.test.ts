/**
 * ROI-E006 — `rvn_roi_post_investment_reviews` visibility join, against a
 * REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E006_DESIGN.md §5/§7, Decision D11.
 *
 * `rvn_roi_post_investment_reviews` inherits visibility via `case_id` only
 * — no dedicated `resource_type`. `roiPirRepository.ts`'s
 * `listRoiPostInvestmentReviews`/`getRoiPostInvestmentReview` both join
 * `rvn_visible_resources` on `pir.case_id::text` — the exact `::text` cast
 * bug class fixed program-wide in EXECUTION_LEDGER.md §24. This suite
 * proves: (1) a user WITH visibility into the case sees its PIR rows;
 * (2) a user with NO visibility grant sees none (PRIVATE case, different
 * owner) — proving the join is actually load-bearing, not a no-op that
 * would pass even with the cast dropped.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildCaseThroughPirStarted,
  buildClientConfig,
  cleanupRoiPirFixtures,
  DB_CONFIGURED,
  insertInitiative,
  insertOrganization,
  insertVisibilityPolicy,
  loadRoiPirTestModules,
  type RoiPirTestModules,
} from './roiPirRealdbFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-e006-visjoin-org-${tag}`;
const USER_OWNER = `roi-e006-visjoin-owner-${tag}`;
const USER_APPROVER = `roi-e006-visjoin-approver-${tag}`;
const USER_OUTSIDER = `roi-e006-visjoin-outsider-${tag}`;
const INITIATIVE_ID = `roi-e006-visjoin-init-${tag}`;

let client: Client;
let reachable = false;
let modules: RoiPirTestModules;

describe('ROI-E006 rvn_roi_post_investment_reviews visibility join (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E006 visibility-join realdb tests did NOT run. This run is not evidence.');
      return;
    }
    client = new Client(buildClientConfig() as ClientConfig);
    await client.connect();
    await client.query('SELECT 1 FROM rvn_roi_post_investment_reviews LIMIT 0');
    reachable = true;

    modules = await loadRoiPirTestModules();

    await insertOrganization(client, ORG_ID, 'ROI-E006 Visibility-Join RealDB Org');
    // PRIVATE mode: only the owner (and RBAC-override roles) sees the case
    // — the strictest branch, so a false-positive leak here would be the
    // clearest possible proof the ::text cast (or the join itself) is
    // broken.
    await insertVisibilityPolicy(client, ORG_ID, 'roi', 'PRIVATE', USER_OWNER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
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

  itDB('the case owner sees the PIR via both listRoiPostInvestmentReviews and getRoiPostInvestmentReview', async () => {
    await insertInitiative(client, INITIATIVE_ID, ORG_ID, 'Visibility-join fixture');
    const started = await buildCaseThroughPirStarted(client, modules, {
      organizationId: ORG_ID,
      initiativeId: INITIATIVE_ID,
      ownerUserId: USER_OWNER,
      approverId: USER_APPROVER,
    });

    const list = await modules.listRoiPostInvestmentReviews({ userId: USER_OWNER, organizationId: ORG_ID, caseId: started.caseId });
    expect(list.map((p) => p.pirId)).toContain(started.pirId);

    const single = await modules.getRoiPostInvestmentReview({
      userId: USER_OWNER,
      organizationId: ORG_ID,
      caseId: started.caseId,
      pirId: started.pirId,
    });
    expect(single).not.toBeNull();
    expect(single!.pirId).toBe(started.pirId);
  });

  itDB('an outsider with no ACL/visibility grant on the PRIVATE case sees NO PIR rows for it (join is load-bearing, not a no-op)', async () => {
    const list = await modules.listRoiPostInvestmentReviews({
      userId: USER_OUTSIDER,
      organizationId: ORG_ID,
      caseId: (await client.query<{ case_id: string }>(`SELECT case_id FROM rvn_roi_cases WHERE organization_id = $1 LIMIT 1`, [ORG_ID]))
        .rows[0]!.case_id,
    });
    expect(list).toHaveLength(0);

    const caseRow = await client.query<{ case_id: string }>(`SELECT case_id FROM rvn_roi_cases WHERE organization_id = $1 LIMIT 1`, [ORG_ID]);
    const pirRow = await client.query<{ pir_id: string }>(`SELECT pir_id FROM rvn_roi_post_investment_reviews WHERE case_id = $1 LIMIT 1`, [
      caseRow.rows[0]!.case_id,
    ]);
    expect(pirRow.rows.length).toBeGreaterThan(0); // sanity: the row genuinely exists in the DB

    const single = await modules.getRoiPostInvestmentReview({
      userId: USER_OUTSIDER,
      organizationId: ORG_ID,
      caseId: caseRow.rows[0]!.case_id,
      pirId: pirRow.rows[0]!.pir_id,
    });
    expect(single).toBeNull();
  });
});

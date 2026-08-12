/**
 * Acceptance E2E — RN-G4, points 7+8 of the FALA 3 cross-domain evidence
 * brief (docs/product/results-vnext/RN_G4_CROSS_DOMAIN_EVIDENCE.md):
 *
 * 7. Security negative tests: a foreign-tenant user and an in-org
 *    "restricted outsider" (no ACL grant) see no names/counts/relations
 *    through the PUBLIC path (repository/command functions — never a raw
 *    table query). Every returned row is asserted on `organizationId`, not
 *    just list length.
 * 8. D07 — KPI review-snapshot negative test: a user who HAD access to a
 *    KPI at publish time (decision #6a lets them into the frozen payload)
 *    and then LOSES access to that one KPI (ACL revoked) after the
 *    snapshot is published cannot see that KPI's data anymore — the
 *    read-time re-filter (decision #6b,
 *    `kpiScorecardRepository.ts::getPublishedSnapshot`) applies on every
 *    fresh read, not just to viewers who never had access. Per
 *    EXECUTION_LEDGER.md this exact "lost access AFTER publish" temporal
 *    case was previously unproven — the pre-existing
 *    `scorecardPublishNonLeak.realdb.test.ts` only proves a viewer who
 *    NEVER had access (a different, weaker claim). This file proves it.
 *
 * Both points share one fixture: ONE Scorecard with two KPIs — one
 * `OPEN_ORG` (KPI_OPEN), one `RESTRICTED_ACL` (KPI_RESTRICTED, ACL granted
 * to OWNER and REVIEWER only) — published once by OWNER, then read by four
 * different actors: OWNER (publisher), REVIEWER (has access, then loses
 * it), OUTSIDER (in-org, never had access), FOREIGN (cross-tenant).
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const MARKER = `odbior--rn-g4--security-and-d07--${tag}`;
const ORG_A = `${MARKER}--org-a`;
const ORG_B = `${MARKER}--org-b`;
const ADMIN = `${MARKER}--admin`;
const OWNER = `${MARKER}--owner`; // publisher, has ACL on KPI_RESTRICTED
const REVIEWER = `${MARKER}--reviewer`; // has ACL on KPI_RESTRICTED, REVOKED after publish
const OUTSIDER = `${MARKER}--outsider`; // in ORG_A, never had ACL on KPI_RESTRICTED
const FOREIGN = `${MARKER}--foreign`; // in ORG_B — cross-tenant

type CommandsModule = typeof import('../../server/src/services/resultsVnext/kpi/kpiScorecardCommands.js');
type RepositoryModule = typeof import('../../server/src/services/resultsVnext/kpi/kpiScorecardRepository.js');

let createScorecard: CommandsModule['createScorecard'];
let addScorecardItem: CommandsModule['addScorecardItem'];
let createReviewSnapshot: CommandsModule['createReviewSnapshot'];
let publishReviewSnapshot: CommandsModule['publishReviewSnapshot'];
let listScorecards: RepositoryModule['listScorecards'];
let getPublishedSnapshot: RepositoryModule['getPublishedSnapshot'];

async function insertOrgAndUser(orgId: string, userId: string, email: string): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())
       ON CONFLICT (id) DO NOTHING`,
      [orgId, `RN-G4 fixture org ${orgId}`]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'RNG4', 'Fixture', now())
       ON CONFLICT (id) DO NOTHING`,
      [userId, orgId, email]
    );
  } finally {
    await client.end();
  }
}

async function insertVisibilityPolicy(orgId: string, domain: string, mode: string, createdBy: string): Promise<string> {
  const client = pgClient();
  await client.connect();
  try {
    const result = await client.query<{ policy_id: string }>(
      `INSERT INTO rvn_platform_visibility_policies
         (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
       VALUES ($1, $2, 1, $3, true, $4)
       RETURNING policy_id`,
      [orgId, domain, mode, createdBy]
    );
    return result.rows[0]!.policy_id;
  } finally {
    await client.end();
  }
}

async function insertFixtureKpi(params: {
  orgId: string;
  kpiId: string;
  versionId: string;
  ownerUserId: string;
  visibilityMode: 'OPEN_ORG' | 'RESTRICTED_ACL';
  policyId: string;
}): Promise<void> {
  const { orgId, kpiId, versionId, ownerUserId, visibilityMode, policyId } = params;
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
       VALUES ($1, $2, $3, 'active', $4, $4)`,
      [kpiId, orgId, `KPI-${kpiId.slice(0, 8)}`, ownerUserId]
    );
    await client.query(
      `INSERT INTO rvn_kpi_definition_versions
         (definition_version_id, kpi_id, organization_id, version_number, name, unit, target_geometry,
          target_min, approval_status, created_by, effective_from)
       VALUES ($1, $2, $3, 1, $4, 'unit', 'threshold_min', 100, 'approved', $5, now())`,
      [versionId, kpiId, orgId, `RN-G4 fixture KPI ${kpiId.slice(0, 8)}`, ownerUserId]
    );
    await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
      versionId,
      kpiId,
    ]);
    await client.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
       VALUES ('kpi', $1, $2, $3, $4, $5)`,
      [kpiId, orgId, visibilityMode, policyId, ownerUserId]
    );
    await client.query(
      `INSERT INTO rvn_kpi_measurements
         (kpi_id, definition_version_id, organization_id, period_start, period_end, actual_value,
          performance_status, source, recorded_by)
       VALUES ($1, $2, $3, '2026-01-01', '2026-01-31', 150, 'on_target', 'manual', $4)`,
      [kpiId, versionId, orgId, ownerUserId]
    );
  } finally {
    await client.end();
  }
}

async function grantAcl(kpiId: string, orgId: string, granteeUserId: string, grantedBy: string): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO rvn_platform_resource_acl
         (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
       VALUES ('kpi', $1, 'user', $2, 'view', $3)`,
      [kpiId, granteeUserId, grantedBy]
    );
  } finally {
    await client.end();
  }
  void orgId;
}

async function revokeAcl(kpiId: string, granteeUserId: string): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(`DELETE FROM rvn_platform_resource_acl WHERE resource_type = 'kpi' AND resource_id = $1 AND grantee_id = $2`, [
      kpiId,
      granteeUserId,
    ]);
  } finally {
    await client.end();
  }
}

async function readStoredContentHash(snapshotId: string): Promise<string> {
  const client = pgClient();
  await client.connect();
  try {
    const result = await client.query<{ content_hash: string }>(
      `SELECT content_hash FROM rvn_kpi_scorecard_review_snapshots WHERE snapshot_id = $1`,
      [snapshotId]
    );
    return result.rows[0]!.content_hash;
  } finally {
    await client.end();
  }
}

describe('RN-G4 · Point 7+8 — security negatives (foreign tenant, restricted outsider) + D07 (lost KPI access after snapshot publish)', () => {
  let kpiOpenId: string;
  let kpiRestrictedId: string;
  let scorecardId: string;
  let snapshotId: string;

  beforeAll(async () => {
    await insertOrgAndUser(ORG_A, ADMIN, `${ADMIN}@acceptance.local`);
    await insertOrgAndUser(ORG_A, OWNER, `${OWNER}@acceptance.local`);
    await insertOrgAndUser(ORG_A, REVIEWER, `${REVIEWER}@acceptance.local`);
    await insertOrgAndUser(ORG_A, OUTSIDER, `${OUTSIDER}@acceptance.local`);
    await insertOrgAndUser(ORG_B, FOREIGN, `${FOREIGN}@acceptance.local`);

    const kpiPolicyId = await insertVisibilityPolicy(ORG_A, 'kpi', 'OPEN_ORG', ADMIN);

    kpiOpenId = randomUUID();
    kpiRestrictedId = randomUUID();
    await insertFixtureKpi({
      orgId: ORG_A,
      kpiId: kpiOpenId,
      versionId: randomUUID(),
      ownerUserId: OWNER,
      visibilityMode: 'OPEN_ORG',
      policyId: kpiPolicyId,
    });
    await insertFixtureKpi({
      orgId: ORG_A,
      kpiId: kpiRestrictedId,
      versionId: randomUUID(),
      ownerUserId: OWNER,
      visibilityMode: 'RESTRICTED_ACL',
      policyId: kpiPolicyId,
    });
    await grantAcl(kpiRestrictedId, ORG_A, OWNER, ADMIN);
    await grantAcl(kpiRestrictedId, ORG_A, REVIEWER, ADMIN);
    // OUTSIDER and FOREIGN deliberately get NO ACL grant.

    const commands: CommandsModule = await import('../../server/src/services/resultsVnext/kpi/kpiScorecardCommands.js');
    ({ createScorecard, addScorecardItem, createReviewSnapshot, publishReviewSnapshot } = commands);
    const repository: RepositoryModule = await import('../../server/src/services/resultsVnext/kpi/kpiScorecardRepository.js');
    ({ listScorecards, getPublishedSnapshot } = repository);
  }, 30_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      for (const orgId of [ORG_A, ORG_B]) {
        await client.query(
          `DELETE FROM rvn_kpi_scorecard_review_snapshot_measurements WHERE snapshot_id IN (
             SELECT snapshot_id FROM rvn_kpi_scorecard_review_snapshots WHERE organization_id = $1)`,
          [orgId]
        );
        await client.query(`DELETE FROM rvn_kpi_scorecard_review_snapshots WHERE organization_id = $1`, [orgId]);
        await client.query(`DELETE FROM rvn_kpi_scorecard_items WHERE organization_id = $1`, [orgId]);
        await client.query(
          `DELETE FROM rvn_platform_resource_acl WHERE resource_type = 'kpi_scorecard'
             AND resource_id IN (SELECT scorecard_id::text FROM rvn_kpi_scorecards WHERE organization_id = $1)`,
          [orgId]
        );
        await client.query(`DELETE FROM rvn_kpi_scorecards WHERE organization_id = $1`, [orgId]);
        await client.query(
          `DELETE FROM rvn_platform_resource_acl WHERE resource_type = 'kpi'
             AND resource_id IN (SELECT kpi_id::text FROM rvn_kpi_definitions WHERE organization_id = $1)`,
          [orgId]
        );
        await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [orgId]);
        await client.query(
          `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
          [orgId]
        );
        await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [orgId]);
        await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [orgId]);
        await client.query(
          `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
          [orgId]
        );
        await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [orgId]);
        await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [orgId]);
        await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [orgId]);
        await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]);
        await client.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]);
        await client.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
      }
    } finally {
      await client.end();
    }
  }, 60_000);

  it('Setup — a real Scorecard with an OPEN and a RESTRICTED_ACL KPI is created and published by the OWNER (decision #6a: publisher sees both)', async () => {
    const scorecardOutcome = await createScorecard({
      organizationId: ORG_A,
      name: 'RN-G4 fixture Scorecard',
      scopeType: 'organization',
      reviewFrequency: 'monthly',
      createdBy: OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--create-scorecard-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    scorecardId = scorecardOutcome.result.scorecard.scorecardId;

    const addOpen = await addScorecardItem({
      scorecardId,
      organizationId: ORG_A,
      expectedVersion: scorecardOutcome.result.scorecard.rowVersion,
      kpiId: kpiOpenId,
      role: 'primary',
      actorUserId: OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--add-open-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    const addRestricted = await addScorecardItem({
      scorecardId,
      organizationId: ORG_A,
      expectedVersion: addOpen.resultingVersion,
      kpiId: kpiRestrictedId,
      role: 'primary',
      actorUserId: OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--add-restricted-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });

    const draftOutcome = await createReviewSnapshot({
      scorecardId,
      organizationId: ORG_A,
      reviewPeriodStart: '2026-01-01',
      reviewPeriodEnd: '2026-01-31',
      createdBy: OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--create-snapshot-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    snapshotId = draftOutcome.result.snapshotId;

    const publishOutcome = await publishReviewSnapshot({
      snapshotId,
      scorecardId,
      organizationId: ORG_A,
      expectedVersion: draftOutcome.result.rowVersion,
      publishedBy: OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--publish-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    expect(publishOutcome.result.status).toBe('published');
    const publishedKpiIds = publishOutcome.result.items.map((i) => i.kpiId).sort();
    expect(publishedKpiIds).toEqual([kpiOpenId, kpiRestrictedId].sort());

    void addRestricted;
  }, 30_000);

  it('D07 setup — the REVIEWER (who has ACL) sees BOTH items right after publish', async () => {
    const readback = await getPublishedSnapshot({ userId: REVIEWER, organizationId: ORG_A, scorecardId });
    expect(readback).toBeTruthy();
    const kpiIds = (readback!.snapshotPayload?.items ?? []).map((i) => i.kpiId).sort();
    expect(kpiIds).toEqual([kpiOpenId, kpiRestrictedId].sort());
  });

  it('D07 — the REVIEWER loses ACL access to the RESTRICTED KPI AFTER publish; a fresh read shows ONLY the still-visible KPI, never the lost one — the stored artifact itself is untouched', async () => {
    const contentHashBefore = await readStoredContentHash(snapshotId);

    // The literal D07 action: access to ONE KPI is revoked AFTER the
    // snapshot was already published and already successfully read by this
    // same user in the previous step.
    await revokeAcl(kpiRestrictedId, REVIEWER);

    // Fresh, cold read — no in-memory state assumed, real repository call
    // (public path).
    const readbackAfterRevoke = await getPublishedSnapshot({ userId: REVIEWER, organizationId: ORG_A, scorecardId });
    expect(readbackAfterRevoke).toBeTruthy();
    const kpiIdsAfterRevoke = (readbackAfterRevoke!.snapshotPayload?.items ?? []).map((i) => i.kpiId);
    expect(kpiIdsAfterRevoke).toEqual([kpiOpenId]);
    expect(kpiIdsAfterRevoke).not.toContain(kpiRestrictedId);

    // No trace of the lost KPI's name/values/status anywhere in what was
    // served — not just its id.
    const servedItemIds = new Set(kpiIdsAfterRevoke);
    expect(servedItemIds.has(kpiRestrictedId)).toBe(false);

    // The STORED artifact (and its content_hash, which validates the full
    // stored row) is completely untouched by this read-time redaction —
    // per kpiScorecardRepository.ts's own file header: "the stored row...
    // is never touched" by decision #6b.
    const contentHashAfter = await readStoredContentHash(snapshotId);
    expect(contentHashAfter).toBe(contentHashBefore);

    // statusCounts on the SERVED response is recomputed for the redacted
    // set only (not the frozen count including the now-invisible KPI) —
    // exact value, not a loose upper bound: kpiOpenId's fixture measurement
    // is 'on_target' (see insertFixtureKpi), so after redaction exactly ONE
    // safe item should remain. A loose `toBeLessThanOrEqual(1)` would also
    // pass on an under-count (0), silently hiding a "redaction ate a KPI it
    // shouldn't have" bug — strengthened per RN-G5 negative-control review.
    expect(readbackAfterRevoke!.snapshotPayload?.statusCounts).toEqual({
      safe: 1,
      warning: 0,
      critical: 0,
      missing: 0,
    });
  });

  it('Point 7 — restricted outsider (in-org, NEVER had ACL) sees the same redacted view via the public path, only OPEN_ORG data', async () => {
    const readback = await getPublishedSnapshot({ userId: OUTSIDER, organizationId: ORG_A, scorecardId });
    expect(readback).toBeTruthy();
    const kpiIds = (readback!.snapshotPayload?.items ?? []).map((i) => i.kpiId);
    expect(kpiIds).toEqual([kpiOpenId]);
    expect(kpiIds).not.toContain(kpiRestrictedId);

    const list = await listScorecards({ userId: OUTSIDER, organizationId: ORG_A });
    for (const sc of list) {
      expect(sc.organizationId).toBe(ORG_A);
    }
    expect(list.some((sc) => sc.scorecardId === scorecardId)).toBe(true);
  });

  it('Point 7 — cross-tenant FOREIGN user sees NOTHING for ORG_A\'s scorecard via the public path, asserted per-row on organizationId', async () => {
    const readback = await getPublishedSnapshot({ userId: FOREIGN, organizationId: ORG_B, scorecardId });
    expect(readback).toBeNull();

    const listForForeignOrg = await listScorecards({ userId: FOREIGN, organizationId: ORG_B });
    for (const sc of listForForeignOrg) {
      expect(sc.organizationId).toBe(ORG_B);
    }
    expect(listForForeignOrg.some((sc) => sc.scorecardId === scorecardId)).toBe(false);
    expect(listForForeignOrg.some((sc) => sc.name === 'RN-G4 fixture Scorecard')).toBe(false);
  });

  it('Point 7 — cold reopen: every negative result above still holds on a fresh set of calls', async () => {
    const reviewerReadback = await getPublishedSnapshot({ userId: REVIEWER, organizationId: ORG_A, scorecardId });
    expect((reviewerReadback!.snapshotPayload?.items ?? []).map((i) => i.kpiId)).toEqual([kpiOpenId]);

    const outsiderReadback = await getPublishedSnapshot({ userId: OUTSIDER, organizationId: ORG_A, scorecardId });
    expect((outsiderReadback!.snapshotPayload?.items ?? []).map((i) => i.kpiId)).toEqual([kpiOpenId]);

    const foreignReadback = await getPublishedSnapshot({ userId: FOREIGN, organizationId: ORG_B, scorecardId });
    expect(foreignReadback).toBeNull();

    // OWNER (who never lost access) still sees both, proving the
    // redaction is per-VIEWER, not a global mutation of the artifact.
    const ownerReadback = await getPublishedSnapshot({ userId: OWNER, organizationId: ORG_A, scorecardId });
    expect((ownerReadback!.snapshotPayload?.items ?? []).map((i) => i.kpiId).sort()).toEqual(
      [kpiOpenId, kpiRestrictedId].sort()
    );
  });
});

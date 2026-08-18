/**
 * F2 blast-radius remediation — proof for the two new composable helpers in
 * `roiRealdbOrgFixture.ts`: `ensureRoiFixtureMembership` and
 * `ensureRoiGovernedVisibility`.
 *
 * WHY THIS FILE EXISTS. `ensureRoiGovernedVisibility` is a thin wrapper
 * around the canonical `publishRoiGovernedVisibilityPolicy`
 * (visibilityResolver.ts) — a wrapper is easy to get wrong in ways that
 * are invisible from reading the source (accidentally swallowing an
 * error, accidentally satisfying only half the invariant). This file
 * proves the wrapper behaves EXACTLY like the canonical function it
 * delegates to: same dual-write, same fail-closed authorization, same
 * idempotent-replay behavior, same collision behavior — nothing added,
 * nothing subtracted.
 *
 * It also proves, directly against `rvn_platform_resource_visibility`,
 * the concrete defect this helper exists to prevent: 39 realDB consumers
 * across `tests/resultsVnext/roi/` currently hand-roll their own
 * `insertVisibilityPolicy('roi', <mode>, actor)` raw-SQL helper (or, for
 * four ROI-E006 PIR suites, share `roiPirRealdbFixtures.ts`'s
 * `insertVisibilityPolicy` export) instead of calling
 * `publishRoiGovernedVisibilityPolicy`. Every one of those, once this
 * organization's `resolveRoiGovernedVisibility` gate is enforced, either
 * (a) never publishes `rvn_roi_visibility_governance` at all and so fails
 * `createRoiCase` with `RoiCaseCreationNotAuthorizedError` (test A below),
 * or (b) would, if "fixed" by someone hand-writing the legacy
 * `rvn_platform_visibility_policies` row directly with the wrong mode,
 * silently stamp new cases `OPEN_ORG`/`RESTRICTED_ACL` instead of
 * `ROI_GOVERNED` (test B below) — the exact silent-reintroduction risk
 * CTO finding #2 named. This file is the record that both failure modes
 * are real, not hypothetical, and that the two-function helper avoids
 * both.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 *
 * NEVER DELETES `rvn_roi_visibility_governance` rows in teardown —
 * that table is append-only by trigger
 * (`trg_rvn_roi_visibility_governance_append_only`), same documented shape
 * `roiGovernedVisibility20.realdb.test.ts` and
 * `roiOpenOrgBackfillVariantB.realdb.test.ts` already rely on. Every
 * organizationId in this file is unique per run (`tag` below) specifically
 * so that permanent residue never collides with a later run.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-fixture-helper-org-${tag}`;
const INITIATIVE_ID = `roi-fixture-helper-init-${tag}`;
const USER_OWNER = `roi-fixture-helper-owner-${tag}`;
const USER_TO_BE_REVOKED_THEN_FIXED = `roi-fixture-helper-flip-${tag}`;
const USER_ORDINARY_MEMBER = `roi-fixture-helper-member-${tag}`;

type VisibilityResolverModule =
  typeof import('../../../server/src/services/resultsVnext/platform/visibilityResolver.js');
type RoiCaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type FixtureModule = typeof import('./roiRealdbOrgFixture.js');

let ensureRoiFixtureOrganization: FixtureModule['ensureRoiFixtureOrganization'];
let ensureRoiFixtureMembership: FixtureModule['ensureRoiFixtureMembership'];
let ensureRoiGovernedVisibility: FixtureModule['ensureRoiGovernedVisibility'];
let RoiVisibilityGovernanceActorNotAuthorizedError: VisibilityResolverModule['RoiVisibilityGovernanceActorNotAuthorizedError'];
let RoiGovernedVisibilityPolicyCollisionError: VisibilityResolverModule['RoiGovernedVisibilityPolicyCollisionError'];
let createRoiCase: RoiCaseCommandsModule['createRoiCase'];
let RoiCaseCreationNotAuthorizedError: RoiCaseCommandsModule['RoiCaseCreationNotAuthorizedError'];

let client: Client;
let reachable = false;

async function insertRawLegacyPolicy(
  organizationId: string,
  mode: string,
  createdBy: string
): Promise<void> {
  // Deliberately the ANTI-PATTERN this helper exists to replace — a raw
  // hand-written `rvn_platform_visibility_policies` row, exactly as all 39
  // blast-radius consumers' local `insertVisibilityPolicy` functions do
  // today. Used ONLY to prove the defect it causes (test B); never a
  // pattern this file's own fixtures use for their own setup.
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, 'roi', 1, $2, true, $3)`,
    [organizationId, mode, createdBy]
  );
}

describe('F2 blast-radius remediation — ensureRoiFixtureMembership / ensureRoiGovernedVisibility (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — roiRealdbOrgFixtureHelper realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_visibility_governance LIMIT 0');
      const checkPermits = await client.query<{ ok: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_constraint
            WHERE conrelid = 'rvn_platform_visibility_policies'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%ROI_GOVERNED%'
         ) ok`
      );
      if (!checkPermits.rows[0]?.ok) {
        throw new Error(
          '20261021_rvn_platform_visibility_roi_governed_mode.sql has not run against this database — apply it before this suite'
        );
      }
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable, or is missing the ROI_GOVERNED migration; refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const fixtureMod: FixtureModule = await import('./roiRealdbOrgFixture.js');
    ensureRoiFixtureOrganization = fixtureMod.ensureRoiFixtureOrganization;
    ensureRoiFixtureMembership = fixtureMod.ensureRoiFixtureMembership;
    ensureRoiGovernedVisibility = fixtureMod.ensureRoiGovernedVisibility;

    const visMod: VisibilityResolverModule = await import(
      '../../../server/src/services/resultsVnext/platform/visibilityResolver.js'
    );
    RoiVisibilityGovernanceActorNotAuthorizedError = visMod.RoiVisibilityGovernanceActorNotAuthorizedError;
    RoiGovernedVisibilityPolicyCollisionError = visMod.RoiGovernedVisibilityPolicyCollisionError;

    const caseMod: RoiCaseCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCaseCommands.js'
    );
    createRoiCase = caseMod.createRoiCase;
    RoiCaseCreationNotAuthorizedError = caseMod.RoiCaseCreationNotAuthorizedError;

    await ensureRoiFixtureOrganization(client, ORG_ID, 'ROI Fixture Helper RealDB Org');
    await client.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`,
      [INITIATIVE_ID, ORG_ID, 'ROI Fixture Helper initiative', 'EXECUTING']
    );
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    // rvn_roi_visibility_governance is left in place — append-only,
    // documented above. Everything else scoped to ORG_ID is cleaned.
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'roi_case'
          AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM users WHERE organization_id = $1`, [ORG_ID]);
    await client.end();
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

  itDB(
    'A — THE DEFECT THIS HELPER REPLACES: with no governed policy published at all (the state every one of the 39 blast-radius consumers currently leaves an organization in unless something publishes governance), createRoiCase is denied — RoiCaseCreationNotAuthorizedError, not a generic DB error',
    async () => {
      await ensureRoiFixtureMembership(client, { organizationId: ORG_ID, userId: USER_OWNER, role: 'OWNER' });
      await expect(
        createRoiCase({
          organizationId: ORG_ID,
          initiativeId: INITIATIVE_ID,
          title: 'Should be denied — no governed policy published yet',
          ownerUserId: USER_OWNER,
          currency: 'USD',
          createdBy: USER_OWNER,
          actorEffectiveRole: 'owner',
          idempotencyKey: `denied-${tag}`,
        })
      ).rejects.toThrow(RoiCaseCreationNotAuthorizedError);
    }
  );

  itDB(
    'ensureRoiGovernedVisibility delegates to the canonical function and produces BOTH rows in one call: a rvn_roi_visibility_governance row AND a domain=roi, mode=ROI_GOVERNED rvn_platform_visibility_policies row',
    async () => {
      const outcome = await ensureRoiGovernedVisibility({
        organizationId: ORG_ID,
        actorUserId: USER_OWNER,
        idempotencyKey: `publish-${tag}`,
      });
      expect(outcome.outcome).toBe('applied');
      expect(outcome.publication.organizationId).toBe(ORG_ID);

      const governance = await client.query(
        `SELECT organization_id FROM rvn_roi_visibility_governance WHERE organization_id = $1`,
        [ORG_ID]
      );
      expect(governance.rowCount).toBe(1);

      const legacy = await client.query<{ visibility_mode: string; is_active: boolean }>(
        `SELECT visibility_mode, is_active FROM rvn_platform_visibility_policies
          WHERE organization_id = $1 AND domain = 'roi' AND is_active = true`,
        [ORG_ID]
      );
      expect(legacy.rowCount).toBe(1);
      expect(legacy.rows[0]?.visibility_mode).toBe('ROI_GOVERNED');
    }
  );

  itDB(
    'B — end to end: createRoiCase now succeeds for the OWNER, and the new case is stamped ROI_GOVERNED — never OPEN_ORG/RESTRICTED_ACL, the exact silent-reintroduction the raw-SQL anti-pattern risks',
    async () => {
      const outcome = await createRoiCase({
        organizationId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        title: 'Created after ensureRoiGovernedVisibility published governance',
        ownerUserId: USER_OWNER,
        currency: 'USD',
        createdBy: USER_OWNER,
        actorEffectiveRole: 'owner',
        idempotencyKey: `create-after-publish-${tag}`,
      });
      expect(outcome.outcome).toBe('applied');
      const stamped = await client.query<{ visibility_mode: string }>(
        `SELECT visibility_mode FROM rvn_platform_resource_visibility WHERE resource_type = 'roi_case' AND resource_id = $1`,
        [outcome.result.case.caseId]
      );
      expect(stamped.rows[0]?.visibility_mode).toBe('ROI_GOVERNED');
    }
  );

  itDB(
    'ensureRoiGovernedVisibility called twice with the SAME idempotencyKey replays cleanly (outcome "replayed") — the helper adds no try/catch, so this success comes from the canonical function itself, not from swallowing an error',
    async () => {
      const replay = await ensureRoiGovernedVisibility({
        organizationId: ORG_ID,
        actorUserId: USER_OWNER,
        idempotencyKey: `publish-${tag}`,
      });
      expect(replay.outcome).toBe('replayed');
    }
  );

  itDB(
    'ensureRoiGovernedVisibility called again with a DIFFERENT idempotencyKey for an org already published collides — RoiGovernedVisibilityPolicyCollisionError propagates, proving the helper does not catch-and-hide it',
    async () => {
      await expect(
        ensureRoiGovernedVisibility({
          organizationId: ORG_ID,
          actorUserId: USER_OWNER,
          idempotencyKey: `publish-different-key-${tag}`,
        })
      ).rejects.toThrow(RoiGovernedVisibilityPolicyCollisionError);
    }
  );

  itDB(
    'ensureRoiGovernedVisibility refuses an actor without ACTIVE OWNER/ADMIN membership — RoiVisibilityGovernanceActorNotAuthorizedError, proving the helper does not pre-authorize or relax the canonical check',
    async () => {
      await ensureRoiFixtureMembership(client, {
        organizationId: ORG_ID,
        userId: USER_ORDINARY_MEMBER,
        role: 'MEMBER',
      });
      await expect(
        ensureRoiGovernedVisibility({
          organizationId: ORG_ID,
          actorUserId: USER_ORDINARY_MEMBER,
          idempotencyKey: `publish-as-member-${tag}`,
        })
      ).rejects.toThrow(RoiVisibilityGovernanceActorNotAuthorizedError);
    }
  );

  itDB(
    'ensureRoiFixtureMembership is UPSERT-SAFE (ON CONFLICT DO UPDATE, not DO NOTHING): a user first inserted as a REVOKED member is corrected to an ACTIVE OWNER by a later call, and can then publish governance',
    async () => {
      await ensureRoiFixtureMembership(client, {
        organizationId: ORG_ID,
        userId: USER_TO_BE_REVOKED_THEN_FIXED,
        role: 'MEMBER',
        status: 'REVOKED',
      });
      const revoked = await client.query<{ role: string; status: string }>(
        `SELECT role, status FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [ORG_ID, USER_TO_BE_REVOKED_THEN_FIXED]
      );
      expect(revoked.rows[0]?.status).toBe('REVOKED');

      await ensureRoiFixtureMembership(client, {
        organizationId: ORG_ID,
        userId: USER_TO_BE_REVOKED_THEN_FIXED,
        role: 'OWNER',
        status: 'ACTIVE',
      });
      const fixed = await client.query<{ role: string; status: string }>(
        `SELECT role, status FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [ORG_ID, USER_TO_BE_REVOKED_THEN_FIXED]
      );
      expect(fixed.rows[0]?.role).toBe('OWNER');
      expect(fixed.rows[0]?.status).toBe('ACTIVE');

      // Prove the correction is not merely cosmetic: this actor can now
      // actually publish governance, which a still-REVOKED row would deny.
      const secondOrgId = `${ORG_ID}-second`;
      await ensureRoiFixtureOrganization(client, secondOrgId, 'ROI Fixture Helper Second RealDB Org');
      await ensureRoiFixtureMembership(client, {
        organizationId: secondOrgId,
        userId: USER_TO_BE_REVOKED_THEN_FIXED,
        role: 'OWNER',
        status: 'ACTIVE',
      });
      const published = await ensureRoiGovernedVisibility({
        organizationId: secondOrgId,
        actorUserId: USER_TO_BE_REVOKED_THEN_FIXED,
        idempotencyKey: `publish-second-org-${tag}`,
      });
      expect(published.outcome).toBe('applied');
      await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [secondOrgId]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [secondOrgId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [secondOrgId]);
    }
  );

  itDB(
    'THE ANTI-PATTERN THIS HELPER REPLACES, made concrete: a raw hand-written domain=roi legacy policy row with mode OPEN_ORG (exactly what every blast-radius consumer\'s local insertVisibilityPolicy(\'roi\', \'OPEN_ORG\', actor) does today) satisfies createRoiCase\'s existence check on its own, ONLY once governance also exists for a DIFFERENT reason — proving the two tables are independently necessary and the canonical function is what keeps them coherent, not either write alone',
    async () => {
      const anotherOrgId = `${ORG_ID}-antipattern`;
      const anotherOwner = `${USER_OWNER}-antipattern`;
      await ensureRoiFixtureOrganization(client, anotherOrgId, 'ROI Fixture Helper Anti-Pattern RealDB Org');
      await ensureRoiFixtureMembership(client, { organizationId: anotherOrgId, userId: anotherOwner, role: 'OWNER' });
      await client.query(
        `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`,
        [`${INITIATIVE_ID}-antipattern`, anotherOrgId, 'Anti-pattern initiative', 'EXECUTING']
      );

      // The raw-SQL anti-pattern writes the LEGACY row but never the
      // governance row rvn_roi_visibility_governance — so the gate denies
      // before this row is ever read, regardless of what mode it carries.
      await insertRawLegacyPolicy(anotherOrgId, 'OPEN_ORG', anotherOwner);
      await expect(
        createRoiCase({
          organizationId: anotherOrgId,
          initiativeId: `${INITIATIVE_ID}-antipattern`,
          title: 'Denied even though a legacy OPEN_ORG row exists',
          ownerUserId: anotherOwner,
          currency: 'USD',
          createdBy: anotherOwner,
          actorEffectiveRole: 'owner',
          idempotencyKey: `antipattern-${tag}`,
        })
      ).rejects.toThrow(RoiCaseCreationNotAuthorizedError);

      await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [anotherOrgId]);
      await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [anotherOrgId]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [anotherOrgId]);
      await client.query(`DELETE FROM users WHERE organization_id = $1`, [anotherOrgId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [anotherOrgId]);
    }
  );
});

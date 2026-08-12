/**
 * Case Workspace — Initiative/Execution capability adapter, proved against a
 * REAL PostgreSQL (Strumień C, Golden Case "Initiative/Execution").
 *
 * Same shape and same six required proofs as decisionAdapter.pg.test.ts —
 * see that file's header for the full rationale, not repeated verbatim here.
 * Exercises server/src/services/caseWorkspace/adapters/initiativeAdapter.ts
 * end-to-end through capabilityAdapterService.executeCapability.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/adapters/initiativeAdapter.pg.test.ts \
 *   --environment node
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as capabilityAdapterService from '../../capabilityAdapterService.js';
import * as artifactLinkService from '../../artifactLinkService.js';
import {
  INITIATIVE_CREATE_CAPABILITY_ID,
  INITIATIVE_CREATE_CAPABILITY_VERSION,
  buildInitiativeCreateBinding,
  getInitiativeReadback,
  initiativeCreateRegistrationInput,
  type InitiativeAdapterDeps,
} from '../../adapters/initiativeAdapter.js';
import { buildEnvelope, seedCaseFixture, seedMember, seedMemberedUser, teardownCaseFixture } from './_fixtures.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const capabilities = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_capabilities'
          AND column_name IN ('capability_registry_id', 'capability_id', 'capability_version')`
    );
    const links = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_artifact_links'
          AND column_name IN ('link_id', 'case_id', 'artifact_type', 'artifact_id')`
    );
    const initiatives = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'initiatives'
          AND column_name IN ('id', 'organization_id', 'name', 'status')`
    );
    return (
      Number(capabilities.rows[0]?.present ?? 0) === 3 &&
      Number(links.rows[0]?.present ?? 0) === 4 &&
      Number(initiatives.rows[0]?.present ?? 0) === 4
    );
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[initiativeAdapter pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the case ` +
      `workspace + initiatives schema applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

// ---------------------------------------------------------------------------
// PRIVATE, per-run-unique capability id — NOT the platform-global
// INITIATIVE_CREATE_CAPABILITY_ID constant.
//
// Cross-file collision REPRODUCED LIVE (this packet, P1, 2026-08-12, same
// mechanism as the already-fixed documentsAdapter/assessmentAdapter/
// resultsAdapter packet H1): `case_workspace_capabilities` is UNIQUE on
// (capability_id, capability_version) with NO organization scoping
// (capabilityRegistryService.ts:496). Vitest runs test FILES concurrently by
// default (server/vitest.config.ts sets no fileParallelism:false).
// `capabilityBootstrap.pg.test.ts`'s `deleteBuiltinCapabilityRows()` (its
// tests 1, 3-7) issues `DELETE FROM case_workspace_capabilities WHERE
// capability_id = $1` for the REAL `INITIATIVE_CREATE_CAPABILITY_ID` as
// pre-cleanup — a genuinely necessary step for ITS OWN "zero registrations"
// assertions against the real builtin ids `registerBuiltinCapabilityAdapters`
// uses at real process boot. When that delete lands between this file's
// `beforeAll` registering its row and capabilityBootstrap's own row-count
// assertion, capabilityBootstrap's own test 1 fails
// (`AssertionError: initiative: expected +0 to be 1`) — reproduced live,
// paired against capabilityBootstrap.pg.test.ts alone (no other files).
// DB readback (polling `case_workspace_capabilities` every 100ms) additionally
// showed a state where ONLY `case-workspace.initiative.create` had count 1
// (all three sibling builtin ids at 0) — provably this file's own `beforeAll`
// — immediately followed by that same row dropping to 0 well before this
// file's own `afterAll`.
//
// Fix: this file registers its OWN test row under a private id instead, so
// no other file's cleanup — targeted at the real, fixed builtin id — can
// ever delete it. The registry/binding PLUMBING (registerCapabilityWithAdapter,
// registerCapabilityBinding) and the HANDLER code under test
// (buildInitiativeCreateBinding, an exported, unmodified production function
// from initiativeAdapter.ts) are identical to what the real id uses — only
// the capability_id STRING used as the registry/dispatch key is test-private.
const INITIATIVE_ADAPTER_PG_TEST_RUN_ID = randomUUID();
const INITIATIVE_TEST_CAPABILITY_ID = `${INITIATIVE_CREATE_CAPABILITY_ID}.pgtest.${INITIATIVE_ADAPTER_PG_TEST_RUN_ID}`;

suite('initiativeAdapter — Initiative capability, dispatched end-to-end through executeCapability', () => {
  let control: Pool;
  let registrarOrgId: string;

  function resetInitiativeTestBinding(deps: InitiativeAdapterDeps = {}): void {
    capabilityAdapterService.registerCapabilityBinding(
      INITIATIVE_TEST_CAPABILITY_ID,
      INITIATIVE_CREATE_CAPABILITY_VERSION,
      buildInitiativeCreateBinding(deps)
    );
  }

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    registrarOrgId = `cwtest-adapter-registrar-initiative-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      registrarOrgId,
      'Initiative adapter registrar org',
    ]);
    const registrarActorId = await seedMemberedUser(control, registrarOrgId, 'registrar', 'ADMIN');
    // Private test id (see the block above this describe) — NOT
    // registerInitiativeCreateCapability, which hard-codes the
    // platform-global INITIATIVE_CREATE_CAPABILITY_ID.
    // registerCapabilityWithAdapter is the same production registration
    // primitive that helper calls internally; only the capabilityId field of
    // the input is overridden.
    await capabilityAdapterService.registerCapabilityWithAdapter(
      { ...initiativeCreateRegistrationInput(registrarActorId), capabilityId: INITIATIVE_TEST_CAPABILITY_ID },
      buildInitiativeCreateBinding(),
      registrarOrgId
    );
  }, 60_000);

  afterAll(async () => {
    await control
      .query(
        `DELETE FROM case_workspace_capability_idempotency_keys
          WHERE capability_registry_id IN (
            SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_id = $1)`,
        [INITIATIVE_TEST_CAPABILITY_ID]
      )
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_capabilities WHERE capability_id = $1`, [INITIATIVE_TEST_CAPABILITY_ID])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM organization_members WHERE organization_id = $1`, [registrarOrgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM users WHERE organization_id = $1`, [registrarOrgId]).catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [registrarOrgId]).catch(() => undefined);
    await control?.end().catch(() => undefined);
  }, 60_000);

  afterEach(() => {
    resetInitiativeTestBinding();
  });

  async function initiativeCountForOrg(orgId: string): Promise<number> {
    const result = await control.query(`SELECT count(*)::int AS n FROM initiatives WHERE organization_id = $1`, [
      orgId,
    ]);
    return Number(result.rows[0]?.n ?? 0);
  }

  function validPayload(caseId: string, overrides: Record<string, unknown> = {}) {
    return {
      caseId,
      title: 'Pilot rollout to region B',
      summary: 'Expand the region-A pilot footprint to region B.',
      axis: 'GROWTH',
      ...overrides,
    };
  }

  // =========================================================================
  // 1. Success
  // =========================================================================
  it('creates a real Initiative row and a real ACTIVE artifact link, readback agrees', async () => {
    const fixture = await seedCaseFixture(control, 'initiative-success');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: INITIATIVE_TEST_CAPABILITY_ID,
          capabilityVersion: INITIATIVE_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      expect(result.outcome).toBe('SUCCEEDED');
      expect(result.errorCode).toBeNull();
      const initiativeId = result.output.initiativeId as string;
      expect(typeof initiativeId).toBe('string');
      expect(result.resultRef).toBe(`initiative:${initiativeId}`);
      expect((result.output.artifactLink as { linked: boolean }).linked).toBe(true);

      const initiative = await getInitiativeReadback(initiativeId, fixture.orgId);
      expect(initiative?.title).toBe('Pilot rollout to region B');
      expect(initiative?.organization_id).toBe(fixture.orgId);

      const links = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'initiative', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(links).toHaveLength(1);
      expect(links[0].artifactId).toBe(initiativeId);
      expect(links[0].relation).toBe('OUTPUT');
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 2. Denial
  // =========================================================================
  it('refuses invalid input and an actor with no case access, writing nothing', async () => {
    const fixture = await seedCaseFixture(control, 'initiative-denial');
    const strangerOrgId = `cwtest-adapter-stranger-initiative-${randomUUID()}`;
    let strangerActorId: string | null = null;
    try {
      const badInput = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: INITIATIVE_TEST_CAPABILITY_ID,
          capabilityVersion: INITIATIVE_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId, { title: '' }),
        })
      );
      expect(badInput.outcome).toBe('FAILED');
      expect(badInput.errorCode).toBe('CAPABILITY_INPUT_INVALID');
      expect(await initiativeCountForOrg(fixture.orgId)).toBe(0);

      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        strangerOrgId,
        'Initiative adapter stranger org',
      ]);
      strangerActorId = await seedMemberedUser(control, strangerOrgId, 'stranger');

      const noAccess = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: INITIATIVE_TEST_CAPABILITY_ID,
          capabilityVersion: INITIATIVE_CREATE_CAPABILITY_VERSION,
          orgId: strangerOrgId,
          actorId: strangerActorId,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(noAccess.outcome).toBe('FAILED');
      expect(noAccess.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await initiativeCountForOrg(fixture.orgId)).toBe(0);
      expect(await initiativeCountForOrg(strangerOrgId)).toBe(0);
    } finally {
      await control
        .query(`DELETE FROM organization_members WHERE organization_id = $1`, [strangerOrgId])
        .catch(() => undefined);
      await control.query(`DELETE FROM users WHERE organization_id = $1`, [strangerOrgId]).catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [strangerOrgId]).catch(() => undefined);
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 3. Retry
  // =========================================================================
  it('suppresses a replayed idempotency key and still lets a fresh key recover after a rejected attempt', async () => {
    const fixture = await seedCaseFixture(control, 'initiative-retry');
    try {
      const key1 = `idem-${randomUUID()}`;
      const first = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: INITIATIVE_TEST_CAPABILITY_ID,
          capabilityVersion: INITIATIVE_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(first.outcome).toBe('SUCCEEDED');
      expect(await initiativeCountForOrg(fixture.orgId)).toBe(1);

      const replay = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: INITIATIVE_TEST_CAPABILITY_ID,
          capabilityVersion: INITIATIVE_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(replay.outcome).toBe('DUPLICATE_SUPPRESSED');
      expect(await initiativeCountForOrg(fixture.orgId)).toBe(1);

      const key2 = `idem-${randomUUID()}`;
      const rejected = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: INITIATIVE_TEST_CAPABILITY_ID,
          capabilityVersion: INITIATIVE_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key2,
          payload: validPayload(fixture.caseId, { title: '' }),
        })
      );
      expect(rejected.outcome).toBe('FAILED');
      expect(await initiativeCountForOrg(fixture.orgId)).toBe(1);

      const key3 = `idem-${randomUUID()}`;
      const second = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: INITIATIVE_TEST_CAPABILITY_ID,
          capabilityVersion: INITIATIVE_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key3,
          payload: validPayload(fixture.caseId, { title: 'A second, distinct initiative' }),
        })
      );
      expect(second.outcome).toBe('SUCCEEDED');
      expect(second.output.initiativeId).not.toBe(first.output.initiativeId);
      expect(await initiativeCountForOrg(fixture.orgId)).toBe(2);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 4. Partial failure
  // =========================================================================
  it('still creates the Initiative when the artifact-link step fails, surfaces it, and stays re-linkable', async () => {
    const fixture = await seedCaseFixture(control, 'initiative-partial');
    try {
      resetInitiativeTestBinding({
        linkArtifactToCase: async () => {
          throw new Error('injected_link_failure');
        },
      });

      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: INITIATIVE_TEST_CAPABILITY_ID,
          capabilityVersion: INITIATIVE_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      expect(result.outcome).toBe('SUCCEEDED');
      const initiativeId = result.output.initiativeId as string;
      const artifactLink = result.output.artifactLink as { linked: boolean; error: string | null };
      expect(artifactLink.linked).toBe(false);
      expect(artifactLink.error).toBeTruthy();
      expect(JSON.stringify(artifactLink)).not.toContain('injected_link_failure');

      const initiative = await getInitiativeReadback(initiativeId, fixture.orgId);
      expect(initiative).not.toBeNull();

      const linksBefore = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'initiative', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksBefore).toHaveLength(0);

      await artifactLinkService.linkArtifactToCase({
        caseId: fixture.caseId,
        artifactType: 'initiative',
        artifactId: initiativeId,
        relation: 'OUTPUT',
        linkedByActorId: fixture.actorId,
      });
      const linksAfter = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'initiative', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksAfter).toHaveLength(1);
      expect(linksAfter[0].artifactId).toBe(initiativeId);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 5. Cross-tenant
  // =========================================================================
  it('refuses when the envelope organizationId does not match the Case tenant, writing nothing', async () => {
    const fixture = await seedCaseFixture(control, 'initiative-crosstenant');
    const otherOrgId = `cwtest-adapter-other-initiative-${randomUUID()}`;
    try {
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        otherOrgId,
        'Initiative adapter other org',
      ]);
      await seedMember(control, otherOrgId, fixture.actorId, 'MEMBER');

      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: INITIATIVE_TEST_CAPABILITY_ID,
          capabilityVersion: INITIATIVE_CREATE_CAPABILITY_VERSION,
          orgId: otherOrgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await initiativeCountForOrg(fixture.orgId)).toBe(0);
      expect(await initiativeCountForOrg(otherOrgId)).toBe(0);
    } finally {
      await control
        .query(`DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`, [
          otherOrgId,
          fixture.actorId,
        ])
        .catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [otherOrgId]).catch(() => undefined);
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 6. Stable deep link
  // =========================================================================
  it('produces a resultRef and an artifact link that both resolve to the SAME object on repeated reads', async () => {
    const fixture = await seedCaseFixture(control, 'initiative-deeplink');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: INITIATIVE_TEST_CAPABILITY_ID,
          capabilityVersion: INITIATIVE_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(result.outcome).toBe('SUCCEEDED');
      const initiativeId = result.output.initiativeId as string;
      expect(result.resultRef).toBe(`initiative:${initiativeId}`);

      const readback1 = await getInitiativeReadback(initiativeId, fixture.orgId);
      const readback2 = await getInitiativeReadback(initiativeId, fixture.orgId);
      expect(readback1?.id).toBe(initiativeId);
      expect(readback2?.id).toBe(initiativeId);
      expect(readback1?.title).toBe(readback2?.title);

      const linksRead1 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'initiative', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      const linksRead2 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'initiative', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksRead1).toHaveLength(1);
      expect(linksRead2).toHaveLength(1);
      expect(linksRead1[0].linkId).toBe(linksRead2[0].linkId);
      expect(linksRead1[0].artifactId).toBe(initiativeId);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);
});

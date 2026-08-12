/**
 * Case Workspace — Decision capability adapter, proved against a REAL
 * PostgreSQL (Strumień C, Golden Case "Decision").
 *
 * Exercises server/src/services/caseWorkspace/adapters/decisionAdapter.ts
 * end-to-end through capabilityAdapterService.executeCapability — the FULL
 * path: registry lookup -> lifecycle/health gate -> idempotency ->
 * dispatch -> decisionService.createDecision -> late-bound artifact link ->
 * audit event. Nothing here calls decisionAdapter's internal handler
 * directly; every assertion goes through the same public entry point a real
 * caller (a future NodeRun dispatcher, or Teresa) would use.
 *
 * ===========================================================================
 * GATE — real database only, same convention as every other *.pg.test.ts
 * ===========================================================================
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/adapters/decisionAdapter.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT THE SIX REQUIRED TESTS EACH PROVE
 * ===========================================================================
 *   1. success         — a real `decisions` row lands, a real ACTIVE
 *                         `case_workspace_artifact_links` row points at it,
 *                         and a readback through decisionService itself
 *                         (never this suite's own SELECT) agrees.
 *   2. denial           — bad input and case-access-denied are BOTH refused
 *                         with the RIGHT taxonomy code and create NOTHING.
 *   3. retry             — a replayed idempotency key is suppressed without a
 *                         second `decisions` row; a FRESH key after a
 *                         rejected attempt still recovers cleanly (proves the
 *                         registry's idempotency bookkeeping never blocks a
 *                         legitimate distinct retry).
 *   4. partial failure    — the artifact-link step is made to fail via an
 *                         injected dependency; the Decision itself is still
 *                         real, addressable, and re-linkable afterwards — not
 *                         silently lost, and not silently reported as fully
 *                         linked either.
 *   5. cross-tenant       — an envelope whose claimed organizationId does not
 *                         match the Case's real tenant is refused before any
 *                         write, and so is an actor with no standing on the
 *                         Case's real org at all.
 *   6. stable deep link   — resultRef and the artifact link both resolve to
 *                         the SAME object across repeated, independent reads.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as capabilityAdapterService from '../../capabilityAdapterService.js';
import * as artifactLinkService from '../../artifactLinkService.js';
import { getDecision } from '../../../decisionService.js';
import {
  DECISION_CREATE_CAPABILITY_ID,
  DECISION_CREATE_CAPABILITY_VERSION,
  buildDecisionCreateBinding,
  decisionCreateRegistrationInput,
  type DecisionAdapterDeps,
} from '../../adapters/decisionAdapter.js';
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
    const decisions = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'decisions'
          AND column_name IN ('id', 'organization_id', 'decision_maker_id', 'title')`
    );
    return (
      Number(capabilities.rows[0]?.present ?? 0) === 3 &&
      Number(links.rows[0]?.present ?? 0) === 4 &&
      Number(decisions.rows[0]?.present ?? 0) === 4
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
    `[decisionAdapter pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the case ` +
      `workspace + decisions schema applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

// ---------------------------------------------------------------------------
// PRIVATE, per-run-unique capability id — NOT the platform-global
// DECISION_CREATE_CAPABILITY_ID constant.
//
// Cross-file collision proven (this packet, P1, 2026-08-12, same mechanism as
// the already-fixed documentsAdapter/assessmentAdapter/resultsAdapter
// packet H1): `case_workspace_capabilities` is UNIQUE on (capability_id,
// capability_version) with NO organization scoping
// (capabilityRegistryService.ts:496). Vitest runs test FILES concurrently by
// default (server/vitest.config.ts sets no fileParallelism:false).
// `capabilityBootstrap.pg.test.ts`'s `deleteBuiltinCapabilityRows()` (its
// tests 1, 3-7) issues `DELETE FROM case_workspace_capabilities WHERE
// capability_id = $1` for the REAL `DECISION_CREATE_CAPABILITY_ID` as
// pre-cleanup — a genuinely necessary step for ITS OWN "zero registrations"
// assertions against the real builtin ids `registerBuiltinCapabilityAdapters`
// uses at real process boot.
//
// DB readback proof (this packet, paired run against capabilityBootstrap.pg.
// test.ts, polling `case_workspace_capabilities` every 100ms): a state where
// ONLY `case-workspace.decision.create` had count 1 (all three sibling
// builtin ids at 0) — which can only be this file's OWN `beforeAll`
// registration landing before capabilityBootstrap's own boot registers the
// others — was repeatedly followed within the SAME run by that row's count
// dropping straight back to 0 well before this file's own `afterAll`, e.g.:
//   19:47:56.523Z {"decision":1,"initiative":0,"kpi":0,"finance":0}
//   19:48:02.204Z {"decision":0,"initiative":0,"kpi":0,"finance":0}
// repeated across every one of 6 consecutive paired runs — i.e. this file's
// registration is provably deleted out from under it by
// capabilityBootstrap.pg.test.ts every single time, even though this
// specific file's own assertions did not happen to land inside that narrow
// window in ~25 sampled runs (unlike the sibling initiative/kpi/finance
// adapter suites, which DID reproduce a live assertion failure from the
// identical mechanism — see this packet's final report). Same danger, same
// fix, applied uniformly rather than left as a live but rarely-observed race.
//
// Fix: this file registers its OWN test row under a private id instead, so
// no other file's cleanup — targeted at the real, fixed builtin id — can
// ever delete it. The registry/binding PLUMBING (registerCapabilityWithAdapter,
// registerCapabilityBinding) and the HANDLER code under test
// (buildDecisionCreateBinding, an exported, unmodified production function
// from decisionAdapter.ts) are identical to what the real id uses — only the
// capability_id STRING used as the registry/dispatch key is test-private.
const DECISION_ADAPTER_PG_TEST_RUN_ID = randomUUID();
const DECISION_TEST_CAPABILITY_ID = `${DECISION_CREATE_CAPABILITY_ID}.pgtest.${DECISION_ADAPTER_PG_TEST_RUN_ID}`;

suite('decisionAdapter — Decision capability, dispatched end-to-end through executeCapability', () => {
  let control: Pool;
  /** The registry row is registered ONCE for the whole file, under DECISION_TEST_CAPABILITY_ID (see block above). */
  let registrarOrgId: string;

  function resetDecisionTestBinding(deps: DecisionAdapterDeps = {}): void {
    capabilityAdapterService.registerCapabilityBinding(
      DECISION_TEST_CAPABILITY_ID,
      DECISION_CREATE_CAPABILITY_VERSION,
      buildDecisionCreateBinding(deps)
    );
  }

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    registrarOrgId = `cwtest-adapter-registrar-decision-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      registrarOrgId,
      'Decision adapter registrar org',
    ]);
    const registrarActorId = await seedMemberedUser(control, registrarOrgId, 'registrar', 'ADMIN');
    // Private test id (see the block above this describe) — NOT
    // registerDecisionCreateCapability, which hard-codes the platform-global
    // DECISION_CREATE_CAPABILITY_ID. registerCapabilityWithAdapter is the
    // same production registration primitive that helper calls internally;
    // only the capabilityId field of the input is overridden.
    await capabilityAdapterService.registerCapabilityWithAdapter(
      { ...decisionCreateRegistrationInput(registrarActorId), capabilityId: DECISION_TEST_CAPABILITY_ID },
      buildDecisionCreateBinding(),
      registrarOrgId
    );
  }, 60_000);

  afterAll(async () => {
    await control
      .query(
        `DELETE FROM case_workspace_capability_idempotency_keys
          WHERE capability_registry_id IN (
            SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_id = $1)`,
        [DECISION_TEST_CAPABILITY_ID]
      )
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_capabilities WHERE capability_id = $1`, [DECISION_TEST_CAPABILITY_ID])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM organization_members WHERE organization_id = $1`, [registrarOrgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM users WHERE organization_id = $1`, [registrarOrgId]).catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [registrarOrgId]).catch(() => undefined);
    await control?.end().catch(() => undefined);
  }, 60_000);

  afterEach(() => {
    // Reset to the real, production binding (rebound at THIS file's private
    // test id — see the block above this describe) after any test that
    // injected a custom one — never let a stubbed dependency leak into the
    // next test.
    resetDecisionTestBinding();
  });

  async function decisionCountForOrg(orgId: string): Promise<number> {
    const result = await control.query(`SELECT count(*)::int AS n FROM decisions WHERE organization_id = $1`, [
      orgId,
    ]);
    return Number(result.rows[0]?.n ?? 0);
  }

  function validPayload(caseId: string, actorId: string, overrides: Record<string, unknown> = {}) {
    return {
      caseId,
      title: 'Go/No-Go: expand pilot to region B',
      type: 'GO_NO_GO',
      decisionMakerId: actorId,
      criteria: 'ROI > 15% within 2 quarters',
      ...overrides,
    };
  }

  // =========================================================================
  // 1. Success
  // =========================================================================
  it('creates a real Decision row and a real ACTIVE artifact link, readback agrees', async () => {
    const fixture = await seedCaseFixture(control, 'decision-success');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: DECISION_TEST_CAPABILITY_ID,
          capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId, fixture.actorId),
        })
      );

      expect(result.outcome).toBe('SUCCEEDED');
      expect(result.errorCode).toBeNull();
      const decisionId = result.output.decisionId as string;
      expect(typeof decisionId).toBe('string');
      expect(result.resultRef).toBe(`decision:${decisionId}`);
      expect((result.output.artifactLink as { linked: boolean }).linked).toBe(true);

      // Real row, read by the module's OWN service — not this suite's SELECT.
      const decision = await getDecision(decisionId);
      expect(decision?.title).toBe('Go/No-Go: expand pilot to region B');
      expect(decision?.organizationId).toBe(fixture.orgId);
      expect(decision?.status).toBe('pending');

      const links = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'decision', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(links).toHaveLength(1);
      expect(links[0].artifactId).toBe(decisionId);
      expect(links[0].relation).toBe('OUTPUT');
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 2. Denial — bad input, and no case access.
  // =========================================================================
  it('refuses invalid input and an actor with no case access, writing nothing', async () => {
    const fixture = await seedCaseFixture(control, 'decision-denial');
    const strangerOrgId = `cwtest-adapter-stranger-decision-${randomUUID()}`;
    let strangerActorId: string | null = null;
    try {
      const badInput = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: DECISION_TEST_CAPABILITY_ID,
          capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId, fixture.actorId, { decisionMakerId: '' }),
        })
      );
      expect(badInput.outcome).toBe('FAILED');
      expect(badInput.errorCode).toBe('CAPABILITY_INPUT_INVALID');
      expect(await decisionCountForOrg(fixture.orgId)).toBe(0);

      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        strangerOrgId,
        'Decision adapter stranger org',
      ]);
      strangerActorId = await seedMemberedUser(control, strangerOrgId, 'stranger');

      const noAccess = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: DECISION_TEST_CAPABILITY_ID,
          capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
          orgId: strangerOrgId,
          actorId: strangerActorId,
          payload: validPayload(fixture.caseId, strangerActorId),
        })
      );
      expect(noAccess.outcome).toBe('FAILED');
      expect(noAccess.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await decisionCountForOrg(fixture.orgId)).toBe(0);
      expect(await decisionCountForOrg(strangerOrgId)).toBe(0);
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
  // 3. Retry — idempotent replay is suppressed; a fresh key after a rejected
  //    attempt still recovers cleanly.
  // =========================================================================
  it('suppresses a replayed idempotency key and still lets a fresh key recover after a rejected attempt', async () => {
    const fixture = await seedCaseFixture(control, 'decision-retry');
    try {
      const key1 = `idem-${randomUUID()}`;
      const first = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: DECISION_TEST_CAPABILITY_ID,
          capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId, fixture.actorId),
        })
      );
      expect(first.outcome).toBe('SUCCEEDED');
      expect(await decisionCountForOrg(fixture.orgId)).toBe(1);

      const replay = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: DECISION_TEST_CAPABILITY_ID,
          capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId, fixture.actorId),
        })
      );
      expect(replay.outcome).toBe('DUPLICATE_SUPPRESSED');
      expect(await decisionCountForOrg(fixture.orgId)).toBe(1);

      // A DIFFERENT, genuinely invalid attempt with a fresh key is rejected,
      // and does not consume the retry.
      const key2 = `idem-${randomUUID()}`;
      const rejected = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: DECISION_TEST_CAPABILITY_ID,
          capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key2,
          payload: validPayload(fixture.caseId, fixture.actorId, { title: '' }),
        })
      );
      expect(rejected.outcome).toBe('FAILED');
      expect(await decisionCountForOrg(fixture.orgId)).toBe(1);

      // A genuinely NEW, valid attempt with its own fresh key recovers cleanly.
      const key3 = `idem-${randomUUID()}`;
      const second = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: DECISION_TEST_CAPABILITY_ID,
          capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key3,
          payload: validPayload(fixture.caseId, fixture.actorId, { title: 'A second, distinct decision' }),
        })
      );
      expect(second.outcome).toBe('SUCCEEDED');
      expect(second.output.decisionId).not.toBe(first.output.decisionId);
      expect(await decisionCountForOrg(fixture.orgId)).toBe(2);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 4. Partial failure — the module write lands even when the artifact link
  //    step fails; the result says so plainly, and the object is recoverable.
  // =========================================================================
  it('still creates the Decision when the artifact-link step fails, surfaces it, and stays re-linkable', async () => {
    const fixture = await seedCaseFixture(control, 'decision-partial');
    try {
      resetDecisionTestBinding({
        linkArtifactToCase: async () => {
          throw new Error('injected_link_failure');
        },
      });

      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: DECISION_TEST_CAPABILITY_ID,
          capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId, fixture.actorId),
        })
      );

      // The capability as a whole SUCCEEDED — the primary business effect
      // (a real Decision) is not thrown away over a secondary linking step.
      expect(result.outcome).toBe('SUCCEEDED');
      const decisionId = result.output.decisionId as string;
      const artifactLink = result.output.artifactLink as { linked: boolean; error: string | null };
      expect(artifactLink.linked).toBe(false);
      expect(artifactLink.error).toBeTruthy();
      // The injected message itself never leaks into the output.
      expect(JSON.stringify(artifactLink)).not.toContain('injected_link_failure');

      // Not lost: a real, independently-readable row exists.
      const decision = await getDecision(decisionId);
      expect(decision).not.toBeNull();
      expect(decision?.organizationId).toBe(fixture.orgId);

      // Not linked yet — no ACTIVE link row for it.
      const linksBefore = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'decision', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksBefore).toHaveLength(0);

      // RECOVERY: the platform's own late-binding primitive can attach the
      // already-created object to the Case at any later time.
      await artifactLinkService.linkArtifactToCase({
        caseId: fixture.caseId,
        artifactType: 'decision',
        artifactId: decisionId,
        relation: 'OUTPUT',
        linkedByActorId: fixture.actorId,
      });
      const linksAfter = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'decision', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksAfter).toHaveLength(1);
      expect(linksAfter[0].artifactId).toBe(decisionId);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 5. Cross-tenant — envelope org mismatch, and a genuine stranger.
  // =========================================================================
  it('refuses when the envelope organizationId does not match the Case tenant, writing nothing', async () => {
    const fixture = await seedCaseFixture(control, 'decision-crosstenant');
    const otherOrgId = `cwtest-adapter-other-decision-${randomUUID()}`;
    try {
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        otherOrgId,
        'Decision adapter other org',
      ]);
      // A REALISTIC multi-tenant actor: also an ACTIVE member of otherOrgId,
      // so the registry-lookup layer's own org-membership check (which would
      // otherwise turn this into an earlier, blunter CAPABILITY_NOT_FOUND)
      // does not mask the adapter's OWN cross-tenant guard being exercised.
      await seedMember(control, otherOrgId, fixture.actorId, 'MEMBER');

      // The actor genuinely belongs to the Case's real org (fixture.orgId)
      // AND to otherOrgId, but the ENVELOPE claims otherOrgId for THIS Case.
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: DECISION_TEST_CAPABILITY_ID,
          capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
          orgId: otherOrgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId, fixture.actorId),
        })
      );

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await decisionCountForOrg(fixture.orgId)).toBe(0);
      expect(await decisionCountForOrg(otherOrgId)).toBe(0);

      // And a genuine stranger — no membership anywhere near this Case's org
      // — is refused too (the registry-lookup layer's own guard this time).
      const strangerOrgId = `cwtest-adapter-stranger2-decision-${randomUUID()}`;
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        strangerOrgId,
        'Decision adapter stranger2 org',
      ]);
      const strangerActorId = await seedMemberedUser(control, strangerOrgId, 'stranger2');
      const strangerResult = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: DECISION_TEST_CAPABILITY_ID,
          capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
          orgId: strangerOrgId,
          actorId: strangerActorId,
          payload: validPayload(fixture.caseId, strangerActorId),
        })
      );
      expect(strangerResult.outcome).toBe('FAILED');
      expect(['CAPABILITY_NOT_FOUND', 'CAPABILITY_UNAUTHORIZED']).toContain(strangerResult.errorCode);
      expect(await decisionCountForOrg(fixture.orgId)).toBe(0);
      await control
        .query(`DELETE FROM organization_members WHERE organization_id = $1`, [strangerOrgId])
        .catch(() => undefined);
      await control.query(`DELETE FROM users WHERE organization_id = $1`, [strangerOrgId]).catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [strangerOrgId]).catch(() => undefined);
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
  // 6. Stable deep link — resultRef and the link both resolve identically
  //    across repeated, independent reads.
  // =========================================================================
  it('produces a resultRef and an artifact link that both resolve to the SAME object on repeated reads', async () => {
    const fixture = await seedCaseFixture(control, 'decision-deeplink');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: DECISION_TEST_CAPABILITY_ID,
          capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId, fixture.actorId),
        })
      );
      expect(result.outcome).toBe('SUCCEEDED');
      const decisionId = result.output.decisionId as string;
      expect(result.resultRef).toBe(`decision:${decisionId}`);

      const readback1 = await getDecision(decisionId);
      const readback2 = await getDecision(decisionId);
      expect(readback1?.id).toBe(decisionId);
      expect(readback2?.id).toBe(decisionId);
      expect(readback1?.title).toBe(readback2?.title);

      const linksRead1 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'decision', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      const linksRead2 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'decision', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksRead1).toHaveLength(1);
      expect(linksRead2).toHaveLength(1);
      expect(linksRead1[0].linkId).toBe(linksRead2[0].linkId);
      expect(linksRead1[0].artifactId).toBe(decisionId);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);
});

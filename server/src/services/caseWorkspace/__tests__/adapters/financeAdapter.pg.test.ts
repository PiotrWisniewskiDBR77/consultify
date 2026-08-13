/**
 * Case Workspace — Finance capability adapter, proved against a REAL
 * PostgreSQL (Strumień C / B2, Golden Case "Finance model create").
 *
 * Exercises server/src/services/caseWorkspace/adapters/financeAdapter.ts
 * end-to-end through capabilityAdapterService.executeCapability — the FULL
 * path: registry lookup -> lifecycle/health gate -> idempotency ->
 * dispatch -> financialModelingService.createModel -> late-bound artifact
 * link -> audit event. Nothing here calls financeAdapter's internal handler
 * directly; every assertion goes through the same public entry point a real
 * caller (a future NodeRun dispatcher, or Teresa) would use. Same structure
 * as decisionAdapter.pg.test.ts — see that file's header for the shared
 * fixture conventions this suite reuses via ./_fixtures.js.
 *
 * ===========================================================================
 * GATE — real database only, same convention as every other *.pg.test.ts
 * ===========================================================================
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/adapters/financeAdapter.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT THE SIX REQUIRED TESTS EACH PROVE (plus one bonus negative control)
 * ===========================================================================
 *   1. success            — a real `financial_models` row lands, a real
 *                            ACTIVE `case_workspace_artifact_links` row
 *                            points at it, and a readback through
 *                            financialModelingService itself (never this
 *                            suite's own SELECT) agrees.
 *   2. denial              — bad input and case-access-denied are BOTH
 *                            refused with the RIGHT taxonomy code and create
 *                            NOTHING.
 *   3. retry                — a replayed idempotency key is suppressed
 *                            without a second `financial_models` row; a
 *                            FRESH key after a rejected attempt still
 *                            recovers cleanly.
 *   4. partial failure       — the artifact-link step is made to fail via an
 *                            injected dependency; the model itself is still
 *                            real, addressable, and re-linkable afterwards.
 *   5. cross-tenant          — an envelope whose claimed organizationId does
 *                            not match the Case's real tenant is refused
 *                            before any write, and so is an actor with no
 *                            standing on the Case's real org at all.
 *   6. stable deep link      — resultRef and the artifact link both resolve
 *                            to the SAME object across repeated, independent
 *                            reads.
 *   7. BONUS negative control — proves the adapter's own defense (see
 *                            financeAdapter.ts's header) against the
 *                            confirmed DbPromise fallback-swallow defect in
 *                            `financialModelingService.createModel`: a
 *                            `start_date` malformed enough to make the real
 *                            Postgres INSERT fail must surface as a FAILED
 *                            capability, never a false SUCCEEDED pointing at
 *                            a row that was never written.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as capabilityAdapterService from '../../capabilityAdapterService.js';
import * as artifactLinkService from '../../artifactLinkService.js';
import { getModel } from '../../../financialModelingService.js';
import {
  FINANCE_MODEL_CREATE_CAPABILITY_ID,
  FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
  buildFinanceModelCreateBinding,
  financeModelCreateRegistrationInput,
  type FinanceAdapterDeps,
} from '../../adapters/financeAdapter.js';
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
    const models = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'financial_models'
          AND column_name IN ('id', 'organization_id', 'name', 'start_date', 'status')`
    );
    return (
      Number(capabilities.rows[0]?.present ?? 0) === 3 &&
      Number(links.rows[0]?.present ?? 0) === 4 &&
      Number(models.rows[0]?.present ?? 0) === 5
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
    `[financeAdapter pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the case ` +
      `workspace + financial_models schema applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

// ---------------------------------------------------------------------------
// PRIVATE, per-run-unique capability id — NOT the platform-global
// FINANCE_MODEL_CREATE_CAPABILITY_ID constant.
//
// Cross-file collision REPRODUCED LIVE, repeatedly (this packet, P1,
// 2026-08-12, same mechanism as the already-fixed documentsAdapter/
// assessmentAdapter/resultsAdapter packet H1): `case_workspace_capabilities`
// is UNIQUE on (capability_id, capability_version) with NO organization
// scoping (capabilityRegistryService.ts:496). Vitest runs test FILES
// concurrently by default (server/vitest.config.ts sets no
// fileParallelism:false). `capabilityBootstrap.pg.test.ts`'s
// `deleteBuiltinCapabilityRows()` (its tests 1, 3-7) issues `DELETE FROM
// case_workspace_capabilities WHERE capability_id = $1` for the REAL
// `FINANCE_MODEL_CREATE_CAPABILITY_ID` as pre-cleanup — a genuinely necessary
// step for ITS OWN "zero registrations" assertions against the real builtin
// ids `registerBuiltinCapabilityAdapters` uses at real process boot. Paired
// against capabilityBootstrap.pg.test.ts alone (no other files), 3 of 8
// consecutive runs produced real assertion failures, e.g.:
//   AssertionError: expected 'CAPABILITY_NOT_FOUND' to be 'CAPABILITY_INTERNAL_ERROR'
//     (this file's own negative-control test, dispatch failing with the
//     registry row gone instead of reaching the adapter's own guard)
//   AssertionError: finance: expected +0 to be 1 (capabilityBootstrap's own
//     "all 8 builtin rows reachable" assertion)
//   AssertionError: expected 'FAILED' to be 'SUCCEEDED' (this file's own
//     stable-deep-link test)
//
// Fix: this file registers its OWN test row under a private id instead, so
// no other file's cleanup — targeted at the real, fixed builtin id — can
// ever delete it. The registry/binding PLUMBING (registerCapabilityWithAdapter,
// registerCapabilityBinding) and the HANDLER code under test
// (buildFinanceModelCreateBinding, an exported, unmodified production
// function from financeAdapter.ts — including its own critical re-read guard
// against createModel's DbPromise fallback-swallow defect, see
// financeAdapter.ts's header) are identical to what the real id uses — only
// the capability_id STRING used as the registry/dispatch key is test-private.
const FINANCE_ADAPTER_PG_TEST_RUN_ID = randomUUID();
const FINANCE_TEST_CAPABILITY_ID = `${FINANCE_MODEL_CREATE_CAPABILITY_ID}.pgtest.${FINANCE_ADAPTER_PG_TEST_RUN_ID}`;

suite('financeAdapter — Finance model-create capability, dispatched end-to-end through executeCapability', () => {
  let control: Pool;
  /** The registry row is registered ONCE for the whole file, under FINANCE_TEST_CAPABILITY_ID (see block above). */
  let registrarOrgId: string;

  function resetFinanceTestBinding(deps: FinanceAdapterDeps = {}): void {
    capabilityAdapterService.registerCapabilityBinding(
      FINANCE_TEST_CAPABILITY_ID,
      FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
      buildFinanceModelCreateBinding(deps)
    );
  }

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    registrarOrgId = `cwtest-adapter-registrar-finance-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      registrarOrgId,
      'Finance adapter registrar org',
    ]);
    const registrarActorId = await seedMemberedUser(control, registrarOrgId, 'registrar', 'ADMIN');
    // Private test id (see the block above this describe) — NOT
    // registerFinanceModelCreateCapability, which hard-codes the
    // platform-global FINANCE_MODEL_CREATE_CAPABILITY_ID.
    // registerCapabilityWithAdapter is the same production registration
    // primitive that helper calls internally; only the capabilityId field of
    // the input is overridden.
    await capabilityAdapterService.registerCapabilityWithAdapter(
      { ...financeModelCreateRegistrationInput(registrarActorId), capabilityId: FINANCE_TEST_CAPABILITY_ID },
      buildFinanceModelCreateBinding(),
      registrarOrgId
    );
  }, 60_000);

  afterAll(async () => {
    await control
      .query(
        `DELETE FROM case_workspace_capability_idempotency_keys
          WHERE capability_registry_id IN (
            SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_id = $1)`,
        [FINANCE_TEST_CAPABILITY_ID]
      )
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_capabilities WHERE capability_id = $1`, [FINANCE_TEST_CAPABILITY_ID])
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
    resetFinanceTestBinding();
  });

  async function modelCountForOrg(orgId: string): Promise<number> {
    const result = await control.query(`SELECT count(*)::int AS n FROM financial_models WHERE organization_id = $1`, [
      orgId,
    ]);
    return Number(result.rows[0]?.n ?? 0);
  }

  function validPayload(caseId: string, overrides: Record<string, unknown> = {}) {
    return {
      caseId,
      name: 'Pilot expansion — region B financial model',
      startDate: '2026-09-01',
      currency: 'PLN',
      horizonMonths: 36,
      granularity: 'monthly',
      scenario: 'base',
      ...overrides,
    };
  }

  // =========================================================================
  // 1. Success
  // =========================================================================
  it('creates a real financial_models row and a real ACTIVE artifact link, readback agrees', async () => {
    const fixture = await seedCaseFixture(control, 'finance-success');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      expect(result.outcome).toBe('SUCCEEDED');
      expect(result.errorCode).toBeNull();
      const modelId = result.output.modelId as string;
      expect(typeof modelId).toBe('string');
      expect(result.resultRef).toBe(`finance_model:${modelId}`);
      expect((result.output.artifactLink as { linked: boolean }).linked).toBe(true);
      expect(result.output.status).toBe('draft');
      expect(result.output.projectId).toBe(fixture.projectId);

      // Real row, read by the module's OWN service — not this suite's SELECT.
      const model = await getModel(modelId, fixture.orgId);
      expect(model?.name).toBe('Pilot expansion — region B financial model');
      expect(model?.organization_id).toBe(fixture.orgId);
      expect(model?.status).toBe('draft');
      expect(String(model?.currency)).toBe('PLN');

      const links = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'finance_model', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(links).toHaveLength(1);
      expect(links[0].artifactId).toBe(modelId);
      expect(links[0].relation).toBe('OUTPUT');
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 2. Denial — bad input, and no case access.
  // =========================================================================
  it('refuses invalid input and an actor with no case access, writing nothing', async () => {
    const fixture = await seedCaseFixture(control, 'finance-denial');
    const strangerOrgId = `cwtest-adapter-stranger-finance-${randomUUID()}`;
    let strangerActorId: string | null = null;
    try {
      const badInput = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId, { name: '' }),
        })
      );
      expect(badInput.outcome).toBe('FAILED');
      expect(badInput.errorCode).toBe('CAPABILITY_INPUT_INVALID');
      expect(await modelCountForOrg(fixture.orgId)).toBe(0);

      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        strangerOrgId,
        'Finance adapter stranger org',
      ]);
      strangerActorId = await seedMemberedUser(control, strangerOrgId, 'stranger');

      const noAccess = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: strangerOrgId,
          actorId: strangerActorId,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(noAccess.outcome).toBe('FAILED');
      expect(noAccess.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await modelCountForOrg(fixture.orgId)).toBe(0);
      expect(await modelCountForOrg(strangerOrgId)).toBe(0);
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
    const fixture = await seedCaseFixture(control, 'finance-retry');
    try {
      const key1 = `idem-${randomUUID()}`;
      const first = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(first.outcome).toBe('SUCCEEDED');
      expect(await modelCountForOrg(fixture.orgId)).toBe(1);

      const replay = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(replay.outcome).toBe('DUPLICATE_SUPPRESSED');
      expect(await modelCountForOrg(fixture.orgId)).toBe(1);

      // A DIFFERENT, genuinely invalid attempt with a fresh key is rejected,
      // and does not consume the retry.
      const key2 = `idem-${randomUUID()}`;
      const rejected = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key2,
          payload: validPayload(fixture.caseId, { name: '' }),
        })
      );
      expect(rejected.outcome).toBe('FAILED');
      expect(await modelCountForOrg(fixture.orgId)).toBe(1);

      // A genuinely NEW, valid attempt with its own fresh key recovers cleanly.
      const key3 = `idem-${randomUUID()}`;
      const second = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key3,
          payload: validPayload(fixture.caseId, { name: 'A second, distinct financial model' }),
        })
      );
      expect(second.outcome).toBe('SUCCEEDED');
      expect(second.output.modelId).not.toBe(first.output.modelId);
      expect(await modelCountForOrg(fixture.orgId)).toBe(2);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 4. Partial failure — the module write lands even when the artifact link
  //    step fails; the result says so plainly, and the object is recoverable.
  // =========================================================================
  it('still creates the financial model when the artifact-link step fails, surfaces it, and stays re-linkable', async () => {
    const fixture = await seedCaseFixture(control, 'finance-partial');
    try {
      resetFinanceTestBinding({
        linkArtifactToCase: async () => {
          throw new Error('injected_link_failure');
        },
      });

      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      // The capability as a whole SUCCEEDED — the primary business effect
      // (a real financial model) is not thrown away over a secondary linking
      // step.
      expect(result.outcome).toBe('SUCCEEDED');
      const modelId = result.output.modelId as string;
      const artifactLink = result.output.artifactLink as { linked: boolean; error: string | null };
      expect(artifactLink.linked).toBe(false);
      expect(artifactLink.error).toBeTruthy();
      // The injected message itself never leaks into the output.
      expect(JSON.stringify(artifactLink)).not.toContain('injected_link_failure');

      // Not lost: a real, independently-readable row exists.
      const model = await getModel(modelId, fixture.orgId);
      expect(model).not.toBeNull();
      expect(model?.organization_id).toBe(fixture.orgId);

      // Not linked yet — no ACTIVE link row for it.
      const linksBefore = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'finance_model', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksBefore).toHaveLength(0);

      // RECOVERY: the platform's own late-binding primitive can attach the
      // already-created object to the Case at any later time.
      await artifactLinkService.linkArtifactToCase({
        caseId: fixture.caseId,
        artifactType: 'finance_model',
        artifactId: modelId,
        relation: 'OUTPUT',
        linkedByActorId: fixture.actorId,
      });
      const linksAfter = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'finance_model', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksAfter).toHaveLength(1);
      expect(linksAfter[0].artifactId).toBe(modelId);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 5. Cross-tenant — envelope org mismatch, and a genuine stranger.
  // =========================================================================
  it('refuses when the envelope organizationId does not match the Case tenant, writing nothing', async () => {
    const fixture = await seedCaseFixture(control, 'finance-crosstenant');
    const otherOrgId = `cwtest-adapter-other-finance-${randomUUID()}`;
    try {
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        otherOrgId,
        'Finance adapter other org',
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
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: otherOrgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await modelCountForOrg(fixture.orgId)).toBe(0);
      expect(await modelCountForOrg(otherOrgId)).toBe(0);

      // And a genuine stranger — no membership anywhere near this Case's org
      // — is refused too (the registry-lookup layer's own guard this time).
      const strangerOrgId = `cwtest-adapter-stranger2-finance-${randomUUID()}`;
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        strangerOrgId,
        'Finance adapter stranger2 org',
      ]);
      const strangerActorId = await seedMemberedUser(control, strangerOrgId, 'stranger2');
      const strangerResult = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: strangerOrgId,
          actorId: strangerActorId,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(strangerResult.outcome).toBe('FAILED');
      expect(['CAPABILITY_NOT_FOUND', 'CAPABILITY_UNAUTHORIZED']).toContain(strangerResult.errorCode);
      expect(await modelCountForOrg(fixture.orgId)).toBe(0);
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
    const fixture = await seedCaseFixture(control, 'finance-deeplink');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(result.outcome).toBe('SUCCEEDED');
      const modelId = result.output.modelId as string;
      expect(result.resultRef).toBe(`finance_model:${modelId}`);

      const readback1 = await getModel(modelId, fixture.orgId);
      const readback2 = await getModel(modelId, fixture.orgId);
      expect(readback1?.id).toBe(modelId);
      expect(readback2?.id).toBe(modelId);
      expect(readback1?.name).toBe(readback2?.name);

      const linksRead1 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'finance_model', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      const linksRead2 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'finance_model', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksRead1).toHaveLength(1);
      expect(linksRead2).toHaveLength(1);
      expect(linksRead1[0].linkId).toBe(linksRead2[0].linkId);
      expect(linksRead1[0].artifactId).toBe(modelId);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 7. BONUS negative control — the adapter's defense against
  //    financialModelingService.createModel's confirmed DbPromise
  //    fallback-swallow defect (see financeAdapter.ts's header). A
  //    `start_date` malformed enough that the real Postgres INSERT rejects
  //    it (`invalid input syntax for type date`) must surface as a FAILED
  //    capability — never a false SUCCEEDED pointing at a row nothing wrote.
  // =========================================================================
  it('[negative control] surfaces a failure instead of a false success when the underlying INSERT cannot persist', async () => {
    const fixture = await seedCaseFixture(control, 'finance-negctrl');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: FINANCE_TEST_CAPABILITY_ID,
          capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          // Not a valid date literal in any format Postgres accepts for a
          // `date` column — the INSERT itself must fail server-side.
          payload: validPayload(fixture.caseId, { startDate: 'definitely-not-a-date' }),
        })
      );

      // MUST NOT be a lying SUCCEEDED — this is the whole point of the
      // adapter's post-create re-read guard.
      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_INTERNAL_ERROR');
      expect(await modelCountForOrg(fixture.orgId)).toBe(0);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);
});

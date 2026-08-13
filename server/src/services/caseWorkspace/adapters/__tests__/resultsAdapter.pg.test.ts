/**
 * Case Workspace — Results capability adapter, proved against a REAL
 * PostgreSQL (Strumień C / D1b, Golden Case "Results scorecard create").
 *
 * Exercises server/src/services/caseWorkspace/adapters/resultsAdapter.ts
 * end-to-end through capabilityAdapterService.executeCapability — the FULL
 * path: registry lookup -> lifecycle/health gate -> idempotency ->
 * dispatch -> kpiScorecardService.createScorecard -> late-bound artifact
 * link -> audit event. Nothing here calls resultsAdapter's internal handler
 * directly; every assertion goes through the same public entry point a real
 * caller (a future NodeRun dispatcher, or Teresa) would use. Same structure
 * as financeAdapter.pg.test.ts — see that file's header for the shared
 * fixture conventions this suite reuses via ../../__tests__/adapters/_fixtures.js.
 *
 * NOTE ON FILE LOCATION: the sibling suites (decisionAdapter/initiativeAdapter/
 * kpiAdapter/financeAdapter) live at
 * server/src/services/caseWorkspace/__tests__/adapters/*.pg.test.ts. This
 * file is deliberately placed at
 * server/src/services/caseWorkspace/adapters/__tests__/resultsAdapter.pg.test.ts
 * per this packet's task brief allowlist, and reaches the shared
 * `_fixtures.ts` via a relative import into that other directory rather than
 * duplicating it.
 *
 * ===========================================================================
 * GATE — real database only, same convention as every other *.pg.test.ts
 * ===========================================================================
 *   cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
 *   npx vitest run src/services/caseWorkspace/adapters/__tests__/resultsAdapter.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT THE SIX REQUIRED TESTS EACH PROVE (plus one bonus negative control)
 * ===========================================================================
 *   1. success            — a real `kpi_scorecards` row lands, a real ACTIVE
 *                            `case_workspace_artifact_links` row points at it,
 *                            and a readback through kpiScorecardService itself
 *                            (never this suite's own SELECT) agrees.
 *   2. denial              — bad input and case-access-denied are BOTH
 *                            refused with the RIGHT taxonomy code and create
 *                            NOTHING.
 *   3. retry                — a replayed idempotency key is suppressed
 *                            without a second `kpi_scorecards` row; a FRESH
 *                            key after a rejected attempt still recovers
 *                            cleanly.
 *   4. partial failure       — the artifact-link step is made to fail via an
 *                            injected dependency; the scorecard itself is
 *                            still real, addressable, and re-linkable
 *                            afterwards.
 *   5. cross-tenant          — an envelope whose claimed organizationId does
 *                            not match the Case's real tenant is refused
 *                            before any write, and so is an actor with no
 *                            standing on the Case's real org at all.
 *   6. stable deep link      — resultRef and the artifact link both resolve
 *                            to the SAME object across repeated, independent
 *                            reads.
 *   7. BONUS negative control — proves a genuine Postgres-level INSERT
 *                            failure (a `periodStart` malformed enough that
 *                            the real `date` column rejects it) surfaces as a
 *                            FAILED capability, never a false SUCCEEDED
 *                            pointing at a row that was never written — see
 *                            resultsAdapter.ts's header for why
 *                            kpiScorecardService's own `{ fallback: false }`
 *                            usage already makes this the expected outcome,
 *                            and why this test proves it rather than assumes
 *                            it.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as capabilityAdapterService from '../../capabilityAdapterService.js';
import * as artifactLinkService from '../../artifactLinkService.js';
import { getScorecard } from '../../../results/kpiScorecardService.js';
import {
  RESULTS_SCORECARD_CREATE_CAPABILITY_ID,
  RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
  buildResultsScorecardCreateBinding,
  resultsScorecardCreateRegistrationInput,
  type ResultsAdapterDeps,
} from '../resultsAdapter.js';
import {
  buildEnvelope,
  seedCaseFixture,
  seedMember,
  seedMemberedUser,
  teardownCaseFixture,
} from '../../__tests__/adapters/_fixtures.js';

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
    const scorecards = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'kpi_scorecards'
          AND column_name IN ('id', 'organization_id', 'name', 'status')`
    );
    return (
      Number(capabilities.rows[0]?.present ?? 0) === 3 &&
      Number(links.rows[0]?.present ?? 0) === 4 &&
      Number(scorecards.rows[0]?.present ?? 0) === 4
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
    `[resultsAdapter pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the case ` +
      `workspace + kpi_scorecards (RES-10) schema applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

// ---------------------------------------------------------------------------
// PRIVATE, per-run-unique capability id — NOT the platform-global
// RESULTS_SCORECARD_CREATE_CAPABILITY_ID constant.
//
// Cross-file collision (packet H4, 2026-08-12, same class as documentsAdapter
// H1 / assessmentAdapter H3): `case_workspace_capabilities` is UNIQUE on
// (capability_id, capability_version) with NO organization scoping
// (capabilityRegistryService.ts:496), and vitest runs test FILES
// concurrently by default (server/vitest.config.ts sets no
// fileParallelism:false). This file's OLD beforeAll registered its row under
// the real, platform-global RESULTS_SCORECARD_CREATE_CAPABILITY_ID for the
// entire suite's lifetime — the exact shape assessmentAdapter.pg.test.ts had
// before its own fix, and the exact shape
// capabilityBootstrap.pg.test.ts's deleteBuiltinCapabilityRows() (its tests
// 1, 3-7) targets as pre-cleanup for its OWN "zero registrations" assertions
// against the real builtin ids `registerBuiltinCapabilityAdapters` uses at
// real process boot.
//
// DB readback proof this file's row IS churned by that cross-file delete,
// not merely a theoretical risk: polling
// `SELECT count(*) FROM case_workspace_capabilities WHERE capability_id =
// 'case-workspace.results.scorecard.create'` every 20ms while running this
// file alongside assessmentAdapter.pg.test.ts + capabilityBootstrap.pg.test.ts
// + capabilityBootWiring.pg.test.ts showed the SAME 0->1->0->1->0 churn on
// this file's real-id row as on assessmentAdapter's (both flipped at
// +7.6-7.9s, +10.0-11.1s, +11.9-11.3s, +13.0-14.1s — see this packet's final
// report). That run happened not to land a failing assertion on THIS file
// (assessmentAdapter's slower, ensureAssessmentSchema-heavy suite keeps its
// row live for a longer, more collision-prone window, which is why it fails
// far more often empirically), but the row is demonstrably not exclusively
// owned by this suite for its duration — a genuine, reproducible defect of
// the same class, not a false alarm.
//
// Fix: this file registers its OWN test row under a private id instead, so
// no other file's cleanup — targeted at the real, fixed builtin id — can
// ever delete it, and this file's own dispatch never collides with another
// file's "zero registrations for the real id" assertion either. The
// registry/binding PLUMBING (registerCapabilityWithAdapter,
// registerCapabilityBinding) and the HANDLER code under test
// (buildResultsScorecardCreateBinding, the exported, unmodified production
// function from resultsAdapter.ts) are identical to what the real id uses —
// only the capability_id STRING used as the registry/dispatch key is
// test-private. This suite needs *a* capability of the right shape to
// dispatch through — it does not exist to prove the REAL builtin id
// specifically is reachable (that is capabilityBootstrap.pg.test.ts's and
// capabilityBootWiring.pg.test.ts's job) — so the advisory-lock shape those
// two files use would be the wrong fix here: it would only add contention
// with a resource this file doesn't need to touch, whereas a private id
// removes the contention entirely.
const RESULTS_ADAPTER_PG_TEST_RUN_ID = randomUUID();
const RESULTS_TEST_CAPABILITY_ID = `${RESULTS_SCORECARD_CREATE_CAPABILITY_ID}.pgtest.${RESULTS_ADAPTER_PG_TEST_RUN_ID}`;

function resetResultsTestBinding(deps: ResultsAdapterDeps = {}): void {
  capabilityAdapterService.registerCapabilityBinding(
    RESULTS_TEST_CAPABILITY_ID,
    RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
    buildResultsScorecardCreateBinding(deps)
  );
}

suite('resultsAdapter — Results scorecard-create capability, dispatched end-to-end through executeCapability', () => {
  let control: Pool;
  /** The registry row is registered ONCE for the whole file, under this file's PRIVATE test capability id (see the block above this describe). */
  let registrarOrgId: string;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    registrarOrgId = `cwtest-adapter-registrar-results-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      registrarOrgId,
      'Results adapter registrar org',
    ]);
    const registrarActorId = await seedMemberedUser(control, registrarOrgId, 'registrar', 'ADMIN');
    // Private test id — NOT registerResultsScorecardCreateCapability, which
    // hard-codes the platform-global RESULTS_SCORECARD_CREATE_CAPABILITY_ID.
    // registerCapabilityWithAdapter is the same production registration
    // primitive that helper calls internally; only the capabilityId field of
    // the input is overridden.
    await capabilityAdapterService.registerCapabilityWithAdapter(
      { ...resultsScorecardCreateRegistrationInput(registrarActorId), capabilityId: RESULTS_TEST_CAPABILITY_ID },
      buildResultsScorecardCreateBinding(),
      registrarOrgId
    );
  }, 60_000);

  afterAll(async () => {
    await control
      .query(
        `DELETE FROM case_workspace_capability_idempotency_keys
          WHERE capability_registry_id IN (
            SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_id = $1)`,
        [RESULTS_TEST_CAPABILITY_ID]
      )
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_capabilities WHERE capability_id = $1`, [RESULTS_TEST_CAPABILITY_ID])
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
    resetResultsTestBinding();
  });

  async function scorecardCountForOrg(orgId: string): Promise<number> {
    const result = await control.query(`SELECT count(*)::int AS n FROM kpi_scorecards WHERE organization_id = $1`, [
      orgId,
    ]);
    return Number(result.rows[0]?.n ?? 0);
  }

  /**
   * kpi_scorecards/kpi_scorecard_items are NOT part of the shared
   * teardownCaseFixture's cleanup list (that helper only knows about
   * decisions/initiatives/initiative_kpis/financial_models — the four
   * modules the OTHER three adapters in this directory write to). This
   * suite is the sole owner of cleaning up its own scorecard rows.
   */
  async function teardownScorecards(orgId: string): Promise<void> {
    await control
      .query(`DELETE FROM kpi_scorecard_items WHERE organization_id = $1`, [orgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM kpi_scorecards WHERE organization_id = $1`, [orgId]).catch(() => undefined);
  }

  function validPayload(caseId: string, overrides: Record<string, unknown> = {}) {
    return {
      caseId,
      name: 'Q3 2026 — Finance scorecard',
      department: 'Finance',
      periodLabel: 'Q3 2026',
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      ...overrides,
    };
  }

  // =========================================================================
  // 1. Success
  // =========================================================================
  it('creates a real kpi_scorecards row and a real ACTIVE artifact link, readback agrees', async () => {
    const fixture = await seedCaseFixture(control, 'results-success');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      expect(result.outcome).toBe('SUCCEEDED');
      expect(result.errorCode).toBeNull();
      const scorecardId = result.output.scorecardId as string;
      expect(typeof scorecardId).toBe('string');
      expect(result.resultRef).toBe(`kpi_scorecard:${scorecardId}`);
      expect((result.output.artifactLink as { linked: boolean }).linked).toBe(true);
      expect(result.output.status).toBe('active');
      expect(result.output.department).toBe('Finance');

      // Real row, read by the module's OWN service — not this suite's SELECT.
      const scorecard = await getScorecard(fixture.orgId, scorecardId);
      expect(scorecard?.id).toBe(scorecardId);
      expect(scorecard?.name).toBe('Q3 2026 — Finance scorecard');

      const links = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'kpi_scorecard', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(links).toHaveLength(1);
      expect(links[0].artifactId).toBe(scorecardId);
      expect(links[0].relation).toBe('OUTPUT');
    } finally {
      await teardownScorecards(fixture.orgId);
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 2. Denial — bad input, and no case access.
  // =========================================================================
  it('refuses invalid input and an actor with no case access, writing nothing', async () => {
    const fixture = await seedCaseFixture(control, 'results-denial');
    const strangerOrgId = `cwtest-adapter-stranger-results-${randomUUID()}`;
    let strangerActorId: string | null = null;
    try {
      const badInput = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId, { name: '' }),
        })
      );
      expect(badInput.outcome).toBe('FAILED');
      expect(badInput.errorCode).toBe('CAPABILITY_INPUT_INVALID');
      expect(await scorecardCountForOrg(fixture.orgId)).toBe(0);

      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        strangerOrgId,
        'Results adapter stranger org',
      ]);
      strangerActorId = await seedMemberedUser(control, strangerOrgId, 'stranger');

      const noAccess = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: strangerOrgId,
          actorId: strangerActorId,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(noAccess.outcome).toBe('FAILED');
      expect(noAccess.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await scorecardCountForOrg(fixture.orgId)).toBe(0);
      expect(await scorecardCountForOrg(strangerOrgId)).toBe(0);
    } finally {
      await teardownScorecards(fixture.orgId);
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
    const fixture = await seedCaseFixture(control, 'results-retry');
    try {
      const key1 = `idem-${randomUUID()}`;
      const first = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(first.outcome).toBe('SUCCEEDED');
      expect(await scorecardCountForOrg(fixture.orgId)).toBe(1);

      const replay = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(replay.outcome).toBe('DUPLICATE_SUPPRESSED');
      expect(await scorecardCountForOrg(fixture.orgId)).toBe(1);

      // A DIFFERENT, genuinely invalid attempt with a fresh key is rejected,
      // and does not consume the retry.
      const key2 = `idem-${randomUUID()}`;
      const rejected = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key2,
          payload: validPayload(fixture.caseId, { name: '' }),
        })
      );
      expect(rejected.outcome).toBe('FAILED');
      expect(await scorecardCountForOrg(fixture.orgId)).toBe(1);

      // A genuinely NEW, valid attempt with its own fresh key recovers cleanly.
      const key3 = `idem-${randomUUID()}`;
      const second = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key3,
          payload: validPayload(fixture.caseId, { name: 'A second, distinct scorecard' }),
        })
      );
      expect(second.outcome).toBe('SUCCEEDED');
      expect(second.output.scorecardId).not.toBe(first.output.scorecardId);
      expect(await scorecardCountForOrg(fixture.orgId)).toBe(2);
    } finally {
      await teardownScorecards(fixture.orgId);
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 4. Partial failure — the module write lands even when the artifact link
  //    step fails; the result says so plainly, and the object is recoverable.
  // =========================================================================
  it('still creates the scorecard when the artifact-link step fails, surfaces it, and stays re-linkable', async () => {
    const fixture = await seedCaseFixture(control, 'results-partial');
    try {
      resetResultsTestBinding({
        linkArtifactToCase: async () => {
          throw new Error('injected_link_failure');
        },
      });

      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      // The capability as a whole SUCCEEDED — the primary business effect
      // (a real scorecard) is not thrown away over a secondary linking step.
      expect(result.outcome).toBe('SUCCEEDED');
      const scorecardId = result.output.scorecardId as string;
      const artifactLink = result.output.artifactLink as { linked: boolean; error: string | null };
      expect(artifactLink.linked).toBe(false);
      expect(artifactLink.error).toBeTruthy();
      // The injected message itself never leaks into the output.
      expect(JSON.stringify(artifactLink)).not.toContain('injected_link_failure');

      // Not lost: a real, independently-readable row exists.
      const scorecard = await getScorecard(fixture.orgId, scorecardId);
      expect(scorecard).not.toBeNull();
      expect(scorecard?.id).toBe(scorecardId);

      // Not linked yet — no ACTIVE link row for it.
      const linksBefore = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'kpi_scorecard', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksBefore).toHaveLength(0);

      // RECOVERY: the platform's own late-binding primitive can attach the
      // already-created object to the Case at any later time.
      await artifactLinkService.linkArtifactToCase({
        caseId: fixture.caseId,
        artifactType: 'kpi_scorecard',
        artifactId: scorecardId,
        relation: 'OUTPUT',
        linkedByActorId: fixture.actorId,
      });
      const linksAfter = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'kpi_scorecard', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksAfter).toHaveLength(1);
      expect(linksAfter[0].artifactId).toBe(scorecardId);
    } finally {
      await teardownScorecards(fixture.orgId);
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 5. Cross-tenant — envelope org mismatch, and a genuine stranger.
  // =========================================================================
  it('refuses when the envelope organizationId does not match the Case tenant, writing nothing', async () => {
    const fixture = await seedCaseFixture(control, 'results-crosstenant');
    const otherOrgId = `cwtest-adapter-other-results-${randomUUID()}`;
    try {
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        otherOrgId,
        'Results adapter other org',
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
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: otherOrgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await scorecardCountForOrg(fixture.orgId)).toBe(0);
      expect(await scorecardCountForOrg(otherOrgId)).toBe(0);

      // And a genuine stranger — no membership anywhere near this Case's org
      // — is refused too (the registry-lookup layer's own guard this time).
      const strangerOrgId = `cwtest-adapter-stranger2-results-${randomUUID()}`;
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        strangerOrgId,
        'Results adapter stranger2 org',
      ]);
      const strangerActorId = await seedMemberedUser(control, strangerOrgId, 'stranger2');
      const strangerResult = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: strangerOrgId,
          actorId: strangerActorId,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(strangerResult.outcome).toBe('FAILED');
      expect(['CAPABILITY_NOT_FOUND', 'CAPABILITY_UNAUTHORIZED']).toContain(strangerResult.errorCode);
      expect(await scorecardCountForOrg(fixture.orgId)).toBe(0);
      await control
        .query(`DELETE FROM organization_members WHERE organization_id = $1`, [strangerOrgId])
        .catch(() => undefined);
      await control.query(`DELETE FROM users WHERE organization_id = $1`, [strangerOrgId]).catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [strangerOrgId]).catch(() => undefined);
    } finally {
      await teardownScorecards(fixture.orgId);
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
    const fixture = await seedCaseFixture(control, 'results-deeplink');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(result.outcome).toBe('SUCCEEDED');
      const scorecardId = result.output.scorecardId as string;
      expect(result.resultRef).toBe(`kpi_scorecard:${scorecardId}`);

      const readback1 = await getScorecard(fixture.orgId, scorecardId);
      const readback2 = await getScorecard(fixture.orgId, scorecardId);
      expect(readback1?.id).toBe(scorecardId);
      expect(readback2?.id).toBe(scorecardId);
      expect(readback1?.name).toBe(readback2?.name);

      const linksRead1 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'kpi_scorecard', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      const linksRead2 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'kpi_scorecard', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksRead1).toHaveLength(1);
      expect(linksRead2).toHaveLength(1);
      expect(linksRead1[0].linkId).toBe(linksRead2[0].linkId);
      expect(linksRead1[0].artifactId).toBe(scorecardId);
    } finally {
      await teardownScorecards(fixture.orgId);
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 7. BONUS negative control — a genuine Postgres INSERT failure must
  //    surface as FAILED, never a false SUCCEEDED (see resultsAdapter.ts's
  //    header for why kpiScorecardService's own { fallback: false } usage
  //    already makes this the expected, provable outcome).
  // =========================================================================
  it('[negative control] surfaces a failure instead of a false success when the underlying INSERT cannot persist', async () => {
    const fixture = await seedCaseFixture(control, 'results-negctrl');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: RESULTS_TEST_CAPABILITY_ID,
          capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          // Not a valid date literal in any format Postgres accepts for a
          // `date` column — the INSERT itself must fail server-side.
          payload: validPayload(fixture.caseId, { periodStart: 'definitely-not-a-date' }),
        })
      );

      // MUST NOT be a lying SUCCEEDED.
      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_INPUT_INVALID');
      expect(await scorecardCountForOrg(fixture.orgId)).toBe(0);
    } finally {
      await teardownScorecards(fixture.orgId);
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);
});

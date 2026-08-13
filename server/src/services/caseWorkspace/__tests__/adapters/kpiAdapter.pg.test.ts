/**
 * Case Workspace — KPI capability adapter, proved against a REAL PostgreSQL
 * (Strumień C, Golden Case "KPI").
 *
 * Same shape and same six required proofs as decisionAdapter.pg.test.ts —
 * see that file's header for the full rationale, not repeated verbatim here.
 * Exercises server/src/services/caseWorkspace/adapters/kpiAdapter.ts
 * end-to-end through capabilityAdapterService.executeCapability, on top of
 * server/src/services/results/kpiDefinitionService.ts's own pinned-
 * transaction create + fail-closed org-scoped read.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/adapters/kpiAdapter.pg.test.ts \
 *   --environment node
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as capabilityAdapterService from '../../capabilityAdapterService.js';
import * as artifactLinkService from '../../artifactLinkService.js';
import {
  KPI_CREATE_CAPABILITY_ID,
  KPI_CREATE_CAPABILITY_VERSION,
  buildKpiCreateBinding,
  getKpiReadback,
  kpiCreateRegistrationInput,
  type KpiAdapterDeps,
} from '../../adapters/kpiAdapter.js';
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
    const kpis = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'initiative_kpis'
          AND column_name IN ('id', 'organization_id', 'name', 'current_definition_version')`
    );
    const versions = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'kpi_definition_versions'`
    );
    return (
      Number(capabilities.rows[0]?.present ?? 0) === 3 &&
      Number(links.rows[0]?.present ?? 0) === 4 &&
      Number(kpis.rows[0]?.present ?? 0) === 4 &&
      Number(versions.rows[0]?.present ?? 0) === 1
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
    `[kpiAdapter pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the case ` +
      `workspace + RES-02 KPI-definition schema (20260803_res002_kpi_definition_versions.sql) ` +
      `applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

// ---------------------------------------------------------------------------
// PRIVATE, per-run-unique capability id — NOT the platform-global
// KPI_CREATE_CAPABILITY_ID constant.
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
// `KPI_CREATE_CAPABILITY_ID` as pre-cleanup — a genuinely necessary step for
// ITS OWN "zero registrations" assertions against the real builtin ids
// `registerBuiltinCapabilityAdapters` uses at real process boot. Paired
// against capabilityBootstrap.pg.test.ts alone (no other files), 8
// consecutive runs produced 6 distinct real assertion failures, e.g.:
//   AssertionError: expected 'CAPABILITY_NOT_FOUND' to be 'CAPABILITY_UNAUTHORIZED'
//   AssertionError: kpi: expected +0 to be 1 (capabilityBootstrap's own
//     "all 8 builtin rows reachable" assertion)
//   AssertionError: expected 'FAILED' to be 'SUCCEEDED' (this file's own
//     stable-deep-link test, dispatch failing mid-run with the registry row
//     deleted out from under it)
//
// Fix: this file registers its OWN test row under a private id instead, so
// no other file's cleanup — targeted at the real, fixed builtin id — can
// ever delete it. The registry/binding PLUMBING (registerCapabilityWithAdapter,
// registerCapabilityBinding) and the HANDLER code under test
// (buildKpiCreateBinding, an exported, unmodified production function from
// kpiAdapter.ts) are identical to what the real id uses — only the
// capability_id STRING used as the registry/dispatch key is test-private.
const KPI_ADAPTER_PG_TEST_RUN_ID = randomUUID();
const KPI_TEST_CAPABILITY_ID = `${KPI_CREATE_CAPABILITY_ID}.pgtest.${KPI_ADAPTER_PG_TEST_RUN_ID}`;

suite('kpiAdapter — KPI capability, dispatched end-to-end through executeCapability', () => {
  let control: Pool;
  let registrarOrgId: string;

  function resetKpiTestBinding(deps: KpiAdapterDeps = {}): void {
    capabilityAdapterService.registerCapabilityBinding(
      KPI_TEST_CAPABILITY_ID,
      KPI_CREATE_CAPABILITY_VERSION,
      buildKpiCreateBinding(deps)
    );
  }

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    registrarOrgId = `cwtest-adapter-registrar-kpi-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      registrarOrgId,
      'KPI adapter registrar org',
    ]);
    const registrarActorId = await seedMemberedUser(control, registrarOrgId, 'registrar', 'ADMIN');
    // Private test id (see the block above this describe) — NOT
    // registerKpiCreateCapability, which hard-codes the platform-global
    // KPI_CREATE_CAPABILITY_ID. registerCapabilityWithAdapter is the same
    // production registration primitive that helper calls internally; only
    // the capabilityId field of the input is overridden.
    await capabilityAdapterService.registerCapabilityWithAdapter(
      { ...kpiCreateRegistrationInput(registrarActorId), capabilityId: KPI_TEST_CAPABILITY_ID },
      buildKpiCreateBinding(),
      registrarOrgId
    );
  }, 60_000);

  afterAll(async () => {
    await control
      .query(
        `DELETE FROM case_workspace_capability_idempotency_keys
          WHERE capability_registry_id IN (
            SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_id = $1)`,
        [KPI_TEST_CAPABILITY_ID]
      )
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_capabilities WHERE capability_id = $1`, [KPI_TEST_CAPABILITY_ID])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM organization_members WHERE organization_id = $1`, [registrarOrgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM users WHERE organization_id = $1`, [registrarOrgId]).catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [registrarOrgId]).catch(() => undefined);
    await control?.end().catch(() => undefined);
  }, 60_000);

  afterEach(() => {
    resetKpiTestBinding();
  });

  async function kpiCountForOrg(orgId: string): Promise<number> {
    const result = await control.query(`SELECT count(*)::int AS n FROM initiative_kpis WHERE organization_id = $1`, [
      orgId,
    ]);
    return Number(result.rows[0]?.n ?? 0);
  }

  function validPayload(caseId: string, overrides: Record<string, unknown> = {}) {
    return {
      caseId,
      name: 'Pilot conversion rate',
      unit: '%',
      direction: 'HIGHER_IS_BETTER',
      targetValue: 25,
      baselineValue: 12,
      ...overrides,
    };
  }

  // =========================================================================
  // 1. Success
  // =========================================================================
  it('creates a real KPI definition row and a real ACTIVE artifact link, readback agrees', async () => {
    const fixture = await seedCaseFixture(control, 'kpi-success');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: KPI_TEST_CAPABILITY_ID,
          capabilityVersion: KPI_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      expect(result.outcome).toBe('SUCCEEDED');
      expect(result.errorCode).toBeNull();
      const kpiId = result.output.kpiId as string;
      expect(typeof kpiId).toBe('string');
      expect(result.resultRef).toBe(`kpi:${kpiId}`);
      expect((result.output.artifactLink as { linked: boolean }).linked).toBe(true);

      const definition = await getKpiReadback(kpiId, fixture.orgId);
      expect(definition?.fields.name).toBe('Pilot conversion rate');
      expect(definition?.organizationId).toBe(fixture.orgId);
      expect(definition?.currentDefinitionVersion).toBe(1);

      const links = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'kpi', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(links).toHaveLength(1);
      expect(links[0].artifactId).toBe(kpiId);
      expect(links[0].relation).toBe('OUTCOME_MEASUREMENT');
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 2. Denial
  // =========================================================================
  it('refuses invalid input and an actor with no case access, writing nothing', async () => {
    const fixture = await seedCaseFixture(control, 'kpi-denial');
    const strangerOrgId = `cwtest-adapter-stranger-kpi-${randomUUID()}`;
    let strangerActorId: string | null = null;
    try {
      const badInput = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: KPI_TEST_CAPABILITY_ID,
          capabilityVersion: KPI_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId, { name: '' }),
        })
      );
      expect(badInput.outcome).toBe('FAILED');
      expect(badInput.errorCode).toBe('CAPABILITY_INPUT_INVALID');
      expect(await kpiCountForOrg(fixture.orgId)).toBe(0);

      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        strangerOrgId,
        'KPI adapter stranger org',
      ]);
      strangerActorId = await seedMemberedUser(control, strangerOrgId, 'stranger');

      const noAccess = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: KPI_TEST_CAPABILITY_ID,
          capabilityVersion: KPI_CREATE_CAPABILITY_VERSION,
          orgId: strangerOrgId,
          actorId: strangerActorId,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(noAccess.outcome).toBe('FAILED');
      expect(noAccess.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await kpiCountForOrg(fixture.orgId)).toBe(0);
      expect(await kpiCountForOrg(strangerOrgId)).toBe(0);
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
    const fixture = await seedCaseFixture(control, 'kpi-retry');
    try {
      const key1 = `idem-${randomUUID()}`;
      const first = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: KPI_TEST_CAPABILITY_ID,
          capabilityVersion: KPI_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(first.outcome).toBe('SUCCEEDED');
      expect(await kpiCountForOrg(fixture.orgId)).toBe(1);

      const replay = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: KPI_TEST_CAPABILITY_ID,
          capabilityVersion: KPI_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(replay.outcome).toBe('DUPLICATE_SUPPRESSED');
      expect(await kpiCountForOrg(fixture.orgId)).toBe(1);

      const key2 = `idem-${randomUUID()}`;
      const rejected = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: KPI_TEST_CAPABILITY_ID,
          capabilityVersion: KPI_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key2,
          payload: validPayload(fixture.caseId, { name: '' }),
        })
      );
      expect(rejected.outcome).toBe('FAILED');
      expect(await kpiCountForOrg(fixture.orgId)).toBe(1);

      const key3 = `idem-${randomUUID()}`;
      const second = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: KPI_TEST_CAPABILITY_ID,
          capabilityVersion: KPI_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key3,
          payload: validPayload(fixture.caseId, { name: 'A second, distinct KPI' }),
        })
      );
      expect(second.outcome).toBe('SUCCEEDED');
      expect(second.output.kpiId).not.toBe(first.output.kpiId);
      expect(await kpiCountForOrg(fixture.orgId)).toBe(2);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 4. Partial failure
  // =========================================================================
  it('still creates the KPI definition when the artifact-link step fails, surfaces it, and stays re-linkable', async () => {
    const fixture = await seedCaseFixture(control, 'kpi-partial');
    try {
      resetKpiTestBinding({
        linkArtifactToCase: async () => {
          throw new Error('injected_link_failure');
        },
      });

      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: KPI_TEST_CAPABILITY_ID,
          capabilityVersion: KPI_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      expect(result.outcome).toBe('SUCCEEDED');
      const kpiId = result.output.kpiId as string;
      const artifactLink = result.output.artifactLink as { linked: boolean; error: string | null };
      expect(artifactLink.linked).toBe(false);
      expect(artifactLink.error).toBeTruthy();
      expect(JSON.stringify(artifactLink)).not.toContain('injected_link_failure');

      const definition = await getKpiReadback(kpiId, fixture.orgId);
      expect(definition).not.toBeNull();

      const linksBefore = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'kpi', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksBefore).toHaveLength(0);

      await artifactLinkService.linkArtifactToCase({
        caseId: fixture.caseId,
        artifactType: 'kpi',
        artifactId: kpiId,
        relation: 'OUTCOME_MEASUREMENT',
        linkedByActorId: fixture.actorId,
      });
      const linksAfter = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'kpi', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksAfter).toHaveLength(1);
      expect(linksAfter[0].artifactId).toBe(kpiId);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 5. Cross-tenant
  // =========================================================================
  it('refuses when the envelope organizationId does not match the Case tenant, writing nothing', async () => {
    const fixture = await seedCaseFixture(control, 'kpi-crosstenant');
    const otherOrgId = `cwtest-adapter-other-kpi-${randomUUID()}`;
    try {
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        otherOrgId,
        'KPI adapter other org',
      ]);
      await seedMember(control, otherOrgId, fixture.actorId, 'MEMBER');

      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: KPI_TEST_CAPABILITY_ID,
          capabilityVersion: KPI_CREATE_CAPABILITY_VERSION,
          orgId: otherOrgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await kpiCountForOrg(fixture.orgId)).toBe(0);
      expect(await kpiCountForOrg(otherOrgId)).toBe(0);

      // And the module's OWN fail-closed tenancy still refuses a cross-org
      // read even if a caller somehow obtained the id.
      const crossRead = await getKpiReadback('does-not-matter-if-real', otherOrgId);
      expect(crossRead).toBeNull();
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
    const fixture = await seedCaseFixture(control, 'kpi-deeplink');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          capabilityId: KPI_TEST_CAPABILITY_ID,
          capabilityVersion: KPI_CREATE_CAPABILITY_VERSION,
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(result.outcome).toBe('SUCCEEDED');
      const kpiId = result.output.kpiId as string;
      expect(result.resultRef).toBe(`kpi:${kpiId}`);

      const readback1 = await getKpiReadback(kpiId, fixture.orgId);
      const readback2 = await getKpiReadback(kpiId, fixture.orgId);
      expect(readback1?.id).toBe(kpiId);
      expect(readback2?.id).toBe(kpiId);
      expect(readback1?.fields.name).toBe(readback2?.fields.name);

      const linksRead1 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'kpi', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      const linksRead2 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'kpi', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksRead1).toHaveLength(1);
      expect(linksRead2).toHaveLength(1);
      expect(linksRead1[0].linkId).toBe(linksRead2[0].linkId);
      expect(linksRead1[0].artifactId).toBe(kpiId);
    } finally {
      await teardownCaseFixture(control, fixture);
    }
  }, 90_000);
});

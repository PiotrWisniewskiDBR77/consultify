/**
 * Case Workspace — Assessment capability adapter, proved against a REAL
 * PostgreSQL (Strumień C / packet D1a).
 *
 * Exercises server/src/services/caseWorkspace/adapters/assessmentAdapter.ts
 * end-to-end through capabilityAdapterService.executeCapability — the FULL
 * path: registry lookup -> lifecycle/health gate -> idempotency -> dispatch
 * -> the real `assessments`/`assessment_sessions` INSERT (same table, same
 * columns as routes/v8/assessment.routes.ts's own POST /) -> late-bound
 * artifact link -> audit event. Nothing here calls assessmentAdapter's
 * internal handler directly; every assertion goes through the same public
 * entry point a real caller (a future NodeRun dispatcher, or Teresa) would
 * use. Same fixture/assertion shape as
 * ../../__tests__/adapters/financeAdapter.pg.test.ts, deliberately
 * SELF-CONTAINED in this new `adapters/__tests__/` directory instead of
 * reusing `../../__tests__/adapters/_fixtures.ts` for org-role seeding — that
 * shared fixture's `seedMember` only accepts
 * 'OWNER'|'ADMIN'|'MEMBER'|'CONSULTANT', and this suite specifically needs a
 * read-only org role ('VIEWER') to prove the Assessment-specific RBAC gate
 * (assessmentAdapter.ts's header, "A SECOND, ASSESSMENT-SPECIFIC PERMISSION
 * GATE") — so this file seeds its own org/project/case/actor quadruple
 * directly against caseCoreService, matching that shared fixture's shape by
 * hand rather than importing (and being unable to extend) it.
 *
 * ===========================================================================
 * GATE — real database only, same convention as every other *.pg.test.ts
 * ===========================================================================
 *   cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 \
 *   MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
 *   npx vitest run server/src/services/caseWorkspace/adapters/__tests__/assessmentAdapter.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT EACH TEST PROVES
 * ===========================================================================
 *   1. success             — a real `assessments` row lands (plus its
 *                            `assessment_sessions` sibling), a real ACTIVE
 *                            `case_workspace_artifact_links` row points at
 *                            it, and a readback through the adapter's OWN
 *                            `getAssessmentReadback` (never this suite's own
 *                            ad hoc SELECT) agrees.
 *   2. input denial         — bad input (blank name, bad assessmentType) is
 *                            refused with CAPABILITY_INPUT_INVALID and
 *                            creates nothing.
 *   3. role denial          — an actor with real standing on the Case (and
 *                            on its org) but an explicit read-only org role
 *                            (VIEWER) is refused with CAPABILITY_UNAUTHORIZED
 *                            — proving the Assessment-specific RBAC gate is
 *                            actually wired, not just Case-level access.
 *   4. retry                — a replayed idempotency key is suppressed
 *                            without a second `assessments` row; a FRESH key
 *                            after a rejected attempt still recovers
 *                            cleanly.
 *   5. partial failure       — the artifact-link step is made to fail via an
 *                            injected dependency; the assessment itself is
 *                            still real, addressable, and re-linkable
 *                            afterwards.
 *   6. cross-tenant          — an envelope whose claimed organizationId does
 *                            not match the Case's real tenant is refused
 *                            before any write, and so is an actor with no
 *                            standing on the Case's real org at all.
 *   7. stable deep link      — resultRef and the artifact link both resolve
 *                            to the SAME object across repeated, independent
 *                            reads.
 *   8. negative control      — proves the adapter's own re-read guard (see
 *                            assessmentAdapter.ts's header, "THE 'DbPromise
 *                            SWALLOWS ERRORS' TRAP"): a `createAssessment`
 *                            dependency injected to return a plausible id
 *                            WITHOUT writing anything (the same observable
 *                            shape a DbPromise fallback-swallow produces)
 *                            must surface as a FAILED capability, never a
 *                            false SUCCEEDED pointing at a row nothing
 *                            wrote.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as capabilityAdapterService from '../../capabilityAdapterService.js';
import type { CapabilityExecutionEnvelope } from '../../capabilityAdapterService.js';
import * as caseCoreService from '../../caseCoreService.js';
import * as artifactLinkService from '../../artifactLinkService.js';
import { ensureAssessmentSchema } from '../../../../controllers/AssessmentController.js';
import {
  ASSESSMENT_CREATE_CAPABILITY_ID,
  ASSESSMENT_CREATE_CAPABILITY_VERSION,
  getAssessmentReadback,
  registerAssessmentCreateAdapterBinding,
  registerAssessmentCreateCapability,
} from '../assessmentAdapter.js';

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
    if (Number(capabilities.rows[0]?.present ?? 0) !== 3 || Number(links.rows[0]?.present ?? 0) !== 4) {
      return false;
    }

    // `assessments`/`assessment_sessions` are NOT created by a migration —
    // they only exist once `ensureAssessmentSchema()` has run at least once
    // (see assessmentAdapter.ts's header). Calling it here (idempotent, the
    // exact function every real Assessment route calls before touching the
    // table) guarantees the reachability probe below is meaningful on a
    // freshly-provisioned test database, not just one a prior suite happened
    // to warm up.
    await ensureAssessmentSchema();

    const assessments = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'assessments'
          AND column_name IN ('id', 'organization_id', 'project_id', 'assessment_type', 'name', 'status', 'created_by')`
    );
    const sessions = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'assessment_sessions'
          AND column_name IN ('id', 'assessment_id', 'user_id')`
    );
    return Number(assessments.rows[0]?.present ?? 0) === 7 && Number(sessions.rows[0]?.present ?? 0) === 3;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[assessmentAdapter pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the case ` +
      `workspace + assessments schema applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface Fixture {
  orgId: string;
  projectId: string;
  caseId: string;
  actorId: string;
}

async function seedUser(control: Pool, orgId: string, label: string): Promise<string> {
  const userId = `cwtest-asm-user-${label}-${randomUUID()}`;
  await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
    userId,
    orgId,
    `${userId}@example.test`,
  ]);
  return userId;
}

async function seedMemberWithRole(control: Pool, orgId: string, userId: string, role: string): Promise<void> {
  await control.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
    [`cwtest-asm-member-${randomUUID()}`, orgId, userId, role]
  );
}

async function seedFixture(control: Pool, label: string, actorRole = 'MEMBER'): Promise<Fixture> {
  const suffix = randomUUID();
  const orgId = `cwtest-asm-org-${label}-${suffix}`;
  const projectId = `cwtest-asm-project-${label}-${suffix}`;
  await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [orgId, `Assessment adapter org (${label})`]);
  await control.query(`INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)`, [
    projectId,
    orgId,
    `Assessment adapter project (${label})`,
  ]);
  const actorId = await seedUser(control, orgId, label);
  await seedMemberWithRole(control, orgId, actorId, actorRole);
  const created = await caseCoreService.createCase({
    projectId,
    organizationId: orgId,
    contractedClosureType: 'DELIVERY_COMPLETED',
    createdByActorId: actorId,
  });
  return { orgId, projectId, caseId: created.caseId, actorId };
}

async function teardownFixture(control: Pool, fixture: Fixture): Promise<void> {
  await control.query(`DELETE FROM assessment_sessions WHERE assessment_id IN (SELECT id FROM assessments WHERE organization_id = $1)`, [
    fixture.orgId,
  ]).catch(() => undefined);
  await control.query(`DELETE FROM assessments WHERE organization_id = $1`, [fixture.orgId]).catch(() => undefined);
  await control
    .query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [fixture.caseId])
    .catch(() => undefined);
  await control
    .query(`DELETE FROM case_workspace_events WHERE case_id = $1`, [fixture.caseId])
    .catch(() => undefined);
  await control.query(`DELETE FROM case_core WHERE case_id = $1`, [fixture.caseId]).catch(() => undefined);
  await control
    .query(`DELETE FROM organization_members WHERE organization_id = $1`, [fixture.orgId])
    .catch(() => undefined);
  await control.query(`DELETE FROM projects WHERE organization_id = $1`, [fixture.orgId]).catch(() => undefined);
  await control.query(`DELETE FROM users WHERE organization_id = $1`, [fixture.orgId]).catch(() => undefined);
  await control.query(`DELETE FROM organizations WHERE id = $1`, [fixture.orgId]).catch(() => undefined);
}

function buildEnvelope(params: {
  orgId: string;
  actorId: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}): CapabilityExecutionEnvelope {
  return {
    capabilityId: ASSESSMENT_CREATE_CAPABILITY_ID,
    capabilityVersion: ASSESSMENT_CREATE_CAPABILITY_VERSION,
    organizationId: params.orgId,
    actor: { type: 'HUMAN', actorId: params.actorId },
    idempotencyKey: params.idempotencyKey ?? `idem-${randomUUID()}`,
    payload: params.payload,
  };
}

suite('assessmentAdapter — Assessment create capability, dispatched end-to-end through executeCapability', () => {
  let control: Pool;
  let registrarOrgId: string;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    registrarOrgId = `cwtest-asm-registrar-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      registrarOrgId,
      'Assessment adapter registrar org',
    ]);
    const registrarActorId = await seedUser(control, registrarOrgId, 'registrar');
    await seedMemberWithRole(control, registrarOrgId, registrarActorId, 'ADMIN');
    await registerAssessmentCreateCapability({
      createdByActorId: registrarActorId,
      callerOrganizationId: registrarOrgId,
    });
  }, 60_000);

  afterAll(async () => {
    await control
      .query(
        `DELETE FROM case_workspace_capability_idempotency_keys
          WHERE capability_registry_id IN (
            SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_id = $1)`,
        [ASSESSMENT_CREATE_CAPABILITY_ID]
      )
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_capabilities WHERE capability_id = $1`, [ASSESSMENT_CREATE_CAPABILITY_ID])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM organization_members WHERE organization_id = $1`, [registrarOrgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM users WHERE organization_id = $1`, [registrarOrgId]).catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [registrarOrgId]).catch(() => undefined);
    await control?.end().catch(() => undefined);
  }, 60_000);

  afterEach(() => {
    // Reset to the real, production binding after any test that injected a
    // custom one — never let a stubbed dependency leak into the next test.
    registerAssessmentCreateAdapterBinding();
  });

  async function assessmentCountForOrg(orgId: string): Promise<number> {
    const result = await control.query(`SELECT count(*)::int AS n FROM assessments WHERE organization_id = $1`, [orgId]);
    return Number(result.rows[0]?.n ?? 0);
  }

  function validPayload(caseId: string, overrides: Record<string, unknown> = {}) {
    return {
      caseId,
      assessmentType: 'DRD',
      name: 'Digital readiness — pilot plant assessment',
      ...overrides,
    };
  }

  // =========================================================================
  // 1. Success
  // =========================================================================
  it('creates a real assessments row (+ session) and a real ACTIVE artifact link, readback agrees', async () => {
    const fixture = await seedFixture(control, 'success');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({ orgId: fixture.orgId, actorId: fixture.actorId, payload: validPayload(fixture.caseId) })
      );

      expect(result.outcome).toBe('SUCCEEDED');
      expect(result.errorCode).toBeNull();
      const assessmentId = result.output.assessmentId as string;
      expect(typeof assessmentId).toBe('string');
      expect(result.resultRef).toBe(`assessment:${assessmentId}`);
      expect((result.output.artifactLink as { linked: boolean }).linked).toBe(true);
      expect(result.output.status).toBe('DRAFT');
      expect(result.output.backendStatus).toBe('DRAFT');
      expect(result.output.projectId).toBe(fixture.projectId);

      // Real row, read by the adapter's OWN read path — not this suite's SELECT.
      const readback = await getAssessmentReadback(assessmentId, fixture.orgId);
      expect(readback?.name).toBe('Digital readiness — pilot plant assessment');
      expect(readback?.organization_id).toBe(fixture.orgId);
      expect(readback?.assessment_type).toBe('DRD');
      expect(readback?.status).toBe('DRAFT');

      // A real assessment_sessions sibling row exists too (parity with the
      // real POST /assessments route — see assessmentAdapter.ts's
      // insertAssessment doc).
      const sessionRow = await control.query(`SELECT id FROM assessment_sessions WHERE assessment_id = $1`, [
        assessmentId,
      ]);
      expect(sessionRow.rows).toHaveLength(1);

      const links = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'assessment', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(links).toHaveLength(1);
      expect(links[0].artifactId).toBe(assessmentId);
      expect(links[0].relation).toBe('OUTPUT');
    } finally {
      await teardownFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 2. Input denial
  // =========================================================================
  it('refuses invalid input, writing nothing', async () => {
    const fixture = await seedFixture(control, 'input-denial');
    try {
      const blankName = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId, { name: '' }),
        })
      );
      expect(blankName.outcome).toBe('FAILED');
      expect(blankName.errorCode).toBe('CAPABILITY_INPUT_INVALID');

      const badType = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          payload: validPayload(fixture.caseId, { assessmentType: 'NOT_A_REAL_TYPE' }),
        })
      );
      expect(badType.outcome).toBe('FAILED');
      expect(badType.errorCode).toBe('CAPABILITY_INPUT_INVALID');

      expect(await assessmentCountForOrg(fixture.orgId)).toBe(0);
    } finally {
      await teardownFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 3. Role denial — Assessment-specific RBAC, not just Case access.
  // =========================================================================
  it('refuses an actor with real Case standing but a read-only org role (GUEST), writing nothing', async () => {
    // NOTE: `organization_members.role` carries a DB CHECK constraint
    // (`organization_members_role_check`) allowing ONLY
    // OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST — confirmed by querying
    // `pg_constraint` against the real test database. Of
    // routes/v8/assessment.routes.ts:152-160's ASSESSMENT_READ_ONLY_ORG_ROLES
    // (VIEWER/GUEST/CLIENT/READONLY/OBSERVER/STAKEHOLDER), only 'GUEST' is
    // actually a value this column can ever hold — the rest of that set can
    // never be exercised against this schema. See this suite's final report
    // for this finding; GUEST is the only real-world-reachable read-only
    // role, so it is what this test proves the gate against.
    const fixture = await seedFixture(control, 'role-denial', 'GUEST');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({ orgId: fixture.orgId, actorId: fixture.actorId, payload: validPayload(fixture.caseId) })
      );
      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await assessmentCountForOrg(fixture.orgId)).toBe(0);
    } finally {
      await teardownFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 4. Retry
  // =========================================================================
  it('suppresses a replayed idempotency key and still lets a fresh key recover after a rejected attempt', async () => {
    const fixture = await seedFixture(control, 'retry');
    try {
      const key1 = `idem-${randomUUID()}`;
      const first = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(first.outcome).toBe('SUCCEEDED');
      expect(await assessmentCountForOrg(fixture.orgId)).toBe(1);

      const replay = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key1,
          payload: validPayload(fixture.caseId),
        })
      );
      expect(replay.outcome).toBe('DUPLICATE_SUPPRESSED');
      expect(await assessmentCountForOrg(fixture.orgId)).toBe(1);

      const key2 = `idem-${randomUUID()}`;
      const rejected = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key2,
          payload: validPayload(fixture.caseId, { name: '' }),
        })
      );
      expect(rejected.outcome).toBe('FAILED');
      expect(await assessmentCountForOrg(fixture.orgId)).toBe(1);

      const key3 = `idem-${randomUUID()}`;
      const second = await capabilityAdapterService.executeCapability(
        buildEnvelope({
          orgId: fixture.orgId,
          actorId: fixture.actorId,
          idempotencyKey: key3,
          payload: validPayload(fixture.caseId, { name: 'A second, distinct assessment' }),
        })
      );
      expect(second.outcome).toBe('SUCCEEDED');
      expect(second.output.assessmentId).not.toBe(first.output.assessmentId);
      expect(await assessmentCountForOrg(fixture.orgId)).toBe(2);
    } finally {
      await teardownFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 5. Partial failure
  // =========================================================================
  it('still creates the assessment when the artifact-link step fails, surfaces it, and stays re-linkable', async () => {
    const fixture = await seedFixture(control, 'partial');
    try {
      registerAssessmentCreateAdapterBinding({
        linkArtifactToCase: async () => {
          throw new Error('injected_link_failure');
        },
      });

      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({ orgId: fixture.orgId, actorId: fixture.actorId, payload: validPayload(fixture.caseId) })
      );

      expect(result.outcome).toBe('SUCCEEDED');
      const assessmentId = result.output.assessmentId as string;
      const artifactLink = result.output.artifactLink as { linked: boolean; error: string | null };
      expect(artifactLink.linked).toBe(false);
      expect(artifactLink.error).toBeTruthy();
      expect(JSON.stringify(artifactLink)).not.toContain('injected_link_failure');

      const readback = await getAssessmentReadback(assessmentId, fixture.orgId);
      expect(readback).not.toBeNull();
      expect(readback?.organization_id).toBe(fixture.orgId);

      const linksBefore = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'assessment', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksBefore).toHaveLength(0);

      await artifactLinkService.linkArtifactToCase({
        caseId: fixture.caseId,
        artifactType: 'assessment',
        artifactId: assessmentId,
        relation: 'OUTPUT',
        linkedByActorId: fixture.actorId,
      });
      const linksAfter = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'assessment', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksAfter).toHaveLength(1);
      expect(linksAfter[0].artifactId).toBe(assessmentId);
    } finally {
      await teardownFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 6. Cross-tenant
  // =========================================================================
  it('refuses when the envelope organizationId does not match the Case tenant, writing nothing', async () => {
    const fixture = await seedFixture(control, 'crosstenant');
    const otherOrgId = `cwtest-asm-other-${randomUUID()}`;
    try {
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        otherOrgId,
        'Assessment adapter other org',
      ]);
      // The actor genuinely belongs to the Case's real org AND to otherOrgId
      // (with create-capable role there too), but the ENVELOPE claims
      // otherOrgId for THIS Case.
      await seedMemberWithRole(control, otherOrgId, fixture.actorId, 'MEMBER');

      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({ orgId: otherOrgId, actorId: fixture.actorId, payload: validPayload(fixture.caseId) })
      );

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
      expect(await assessmentCountForOrg(fixture.orgId)).toBe(0);
      expect(await assessmentCountForOrg(otherOrgId)).toBe(0);

      // And a genuine stranger — no membership anywhere near this Case's org.
      const strangerOrgId = `cwtest-asm-stranger-${randomUUID()}`;
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        strangerOrgId,
        'Assessment adapter stranger org',
      ]);
      const strangerActorId = await seedUser(control, strangerOrgId, 'stranger');
      await seedMemberWithRole(control, strangerOrgId, strangerActorId, 'MEMBER');
      const strangerResult = await capabilityAdapterService.executeCapability(
        buildEnvelope({ orgId: strangerOrgId, actorId: strangerActorId, payload: validPayload(fixture.caseId) })
      );
      expect(strangerResult.outcome).toBe('FAILED');
      expect(['CAPABILITY_NOT_FOUND', 'CAPABILITY_UNAUTHORIZED']).toContain(strangerResult.errorCode);
      expect(await assessmentCountForOrg(fixture.orgId)).toBe(0);

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
      await teardownFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 7. Stable deep link
  // =========================================================================
  it('produces a resultRef and an artifact link that both resolve to the SAME object on repeated reads', async () => {
    const fixture = await seedFixture(control, 'deeplink');
    try {
      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({ orgId: fixture.orgId, actorId: fixture.actorId, payload: validPayload(fixture.caseId) })
      );
      expect(result.outcome).toBe('SUCCEEDED');
      const assessmentId = result.output.assessmentId as string;
      expect(result.resultRef).toBe(`assessment:${assessmentId}`);

      const readback1 = await getAssessmentReadback(assessmentId, fixture.orgId);
      const readback2 = await getAssessmentReadback(assessmentId, fixture.orgId);
      expect(readback1?.id).toBe(assessmentId);
      expect(readback2?.id).toBe(assessmentId);
      expect(readback1?.name).toBe(readback2?.name);

      const linksRead1 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'assessment', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      const linksRead2 = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'assessment', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(linksRead1).toHaveLength(1);
      expect(linksRead2).toHaveLength(1);
      expect(linksRead1[0].linkId).toBe(linksRead2[0].linkId);
      expect(linksRead1[0].artifactId).toBe(assessmentId);
    } finally {
      await teardownFixture(control, fixture);
    }
  }, 90_000);

  // =========================================================================
  // 8. Negative control — the adapter's re-read guard against a write that
  //    lies about success (see assessmentAdapter.ts's header, "THE
  //    'DbPromise SWALLOWS ERRORS' TRAP").
  // =========================================================================
  it('[negative control] surfaces a failure instead of a false success when the write silently persists nothing', async () => {
    const fixture = await seedFixture(control, 'negctrl');
    try {
      registerAssessmentCreateAdapterBinding({
        // Mimics the exact observable shape of a DbPromise fallback-swallow:
        // a plausible id is returned, but nothing was actually written.
        createAssessment: async () => randomUUID(),
      });

      const result = await capabilityAdapterService.executeCapability(
        buildEnvelope({ orgId: fixture.orgId, actorId: fixture.actorId, payload: validPayload(fixture.caseId) })
      );

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_INTERNAL_ERROR');
      expect(await assessmentCountForOrg(fixture.orgId)).toBe(0);

      const links = await artifactLinkService.listArtifactLinksForCase(
        fixture.caseId,
        { artifactType: 'assessment', linkStatus: 'ACTIVE' },
        fixture.actorId
      );
      expect(links).toHaveLength(0);
    } finally {
      await teardownFixture(control, fixture);
    }
  }, 90_000);
});

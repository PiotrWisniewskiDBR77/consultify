/**
 * Case Workspace — Stream E adversarial security specification for
 * playService.ts (CW-P08, EPIC E12 "Reusable Plays").
 *
 * SPECIFICATION, NOT YET RUN — see caseCoreService.security.pg.test.ts's
 * header for the full rationale (shared disposable Postgres + services
 * under concurrent modification by other streams right now; a clean SKIP
 * via the standard gate is the correct, expected outcome until fan-in).
 *
 * ===========================================================================
 * A GENUINE FINDING, discovered while reading playService.ts to write this
 * suite (not assumed, not copied from PACKET_REGISTRY.md):
 * ===========================================================================
 * `isAuthorizedPublisher(actorUserId, organizationId)` (playService.ts,
 * ~line 565) is playService's OWN bespoke authorization check — NOT the
 * shared caseWorkspaceAuthContext.ts primitive — and its query is:
 *
 *   SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1
 *
 * This has NO `status = 'ACTIVE'` filter, unlike
 * caseWorkspaceAuthContext.resolveActorMembership's deliberate
 * `if ((row.status ?? '').trim().toUpperCase() !== 'ACTIVE') return null;`
 * gate. Consequence: a REVOKED or SUSPENDED OWNER/ADMIN can still call
 * shareProcessDefinition successfully — membership revocation does NOT
 * revoke Play-sharing authority. Test (B).2 below proves this concretely
 * against a real Postgres row rather than asserting it from reading code.
 * This is a distinct, more specific finding than "CW-P08 has no auth check
 * at all" (it DOES have one — it's just missing the status filter every
 * sibling active-membership check in this codebase applies).
 *
 * instantiateProcessVersion has its own RESOURCE-to-RESOURCE consistency
 * check (`caseRow.organization_id !== definition.organization_id` throws
 * `process_version_case_organization_mismatch` — this is the fix from
 * commit 44769e6bc9 the PACKET_REGISTRY.md documents), but that is NOT an
 * ACTOR authorization check: it never confirms the calling actor belongs to
 * either organization. Test (B).1 below proves an actor with zero standing
 * in the (matching) organization can still instantiate.
 *
 * Two describe blocks, same convention as the sibling security suites:
 *   (A) target contract — requireCaseAccess composed in front. Expected PASS.
 *   (B) known gap (P1) — direct calls proving the two findings above.
 *       Expected to currently succeed where SEC-001/SEC-007 says they must
 *       not — a red/succeeding result here is correct, not a Stream E defect.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../../caseCoreService.js';
import type { CanonicalGraph } from '../../casePlanVersionService.js';
import { requireCaseAccess } from '../../caseWorkspaceAuthContext.js';
import * as playService from '../../playService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const definitionsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'process_definitions'
          AND column_name IN ('process_definition_id', 'organization_id', 'visibility', 'version')`
    );
    const versionsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'process_versions'
          AND column_name IN ('process_version_id', 'process_definition_id', 'status', 'version')`
    );
    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    return (
      Number(definitionsResult.rows[0]?.present ?? 0) === 4 &&
      Number(versionsResult.rows[0]?.present ?? 0) === 4 &&
      Number(orgMembersResult.rows[0]?.present ?? 0) === 4
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
    `[playService SECURITY pg suite SKIPPED — clean skip pending Stream A/B/C fan-in, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `plays + case_core + organization_members migrations applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

const SIMPLE_GRAPH: CanonicalGraph = {
  schemaVersion: '1',
  graphId: 'graph-secplay',
  entryNodeIds: ['n1'],
  terminalNodeIds: ['n2'],
  nodes: [
    { nodeId: 'n1', type: 'TASK' },
    { nodeId: 'n2', type: 'TASK' },
  ],
  edges: [{ edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' }],
};

suite('playService — adversarial security (Stream E, CW-P08/E12)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  async function seedOrg(label: string): Promise<string> {
    const orgId = `secplay-org-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      orgId,
      `Stream E play test org (${label})`,
    ]);
    return orgId;
  }

  async function seedUser(orgId: string, label: string): Promise<string> {
    const userId = `secplay-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    return userId;
  }

  async function seedMember(
    orgId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
    status: string = 'ACTIVE'
  ): Promise<string> {
    const membershipId = `secplay-member-${randomUUID()}`;
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES ($1, $2, $3, $4, $5)`,
      [membershipId, orgId, userId, role, status]
    );
    return membershipId;
  }

  async function setMemberStatus(membershipId: string, status: string): Promise<void> {
    await control.query(`UPDATE organization_members SET status = $1 WHERE id = $2`, [status, membershipId]);
  }

  /**
   * Post-Stream-A addendum: caseCoreService.createCase,
   * playService.createProcessDefinition/createProcessVersionDraft/
   * proposeProcessVersion/reviewProcessVersion/publishProcessVersion all now
   * call requireOrgMember/requireCaseAccess internally using their
   * ALREADY-EXISTING actor fields, so every fixture actor that drives one of
   * these calls must itself be a real ACTIVE member of the relevant org — a
   * bare unseeded string id (the pre-retrofit fixture shape) now fails at
   * fixture-setup with CaseWorkspaceAuthError('not_org_member', ...), not
   * inside the test body.
   */
  async function seedActiveActor(
    orgId: string,
    tag: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT' = 'MEMBER'
  ): Promise<string> {
    const userId = await seedUser(orgId, tag);
    await seedMember(orgId, userId, role, 'ACTIVE');
    return userId;
  }

  async function seedOrgProjectCase(label: string): Promise<{ orgId: string; projectId: string; caseId: string }> {
    const orgId = await seedOrg(label);
    const projectId = `secplay-project-${label}-${randomUUID()}`;
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Stream E play test project (${label})`]
    );
    const creatorUserId = await seedActiveActor(orgId, `${label}-creator`, 'OWNER');
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: creatorUserId,
    });
    return { orgId, projectId, caseId: created.caseId };
  }

  async function publishedPlay(orgId: string, tag: string): Promise<{ definitionId: string; versionId: string }> {
    // Both the owner and the reviewer must be real ACTIVE members of orgId:
    // createProcessDefinition/createProcessVersionDraft/proposeProcessVersion/
    // publishProcessVersion all now call requireOrgMember(actorUserId, org)
    // (using the definition's own organization_id), and reviewProcessVersion
    // does the same for the reviewer.
    const ownerActorId = await seedActiveActor(orgId, `owner-${tag}`, 'OWNER');
    const reviewerActorId = await seedActiveActor(orgId, `reviewer-${tag}`, 'ADMIN');
    const definition = await playService.createProcessDefinition({
      organizationId: orgId,
      name: `Play (${tag})`,
      ownerActorId,
      createdByActorId: ownerActorId,
    });
    const draft = await playService.createProcessVersionDraft({
      processDefinitionId: definition.processDefinitionId,
      semanticGraph: SIMPLE_GRAPH,
      createdByActorId: ownerActorId,
    });
    const proposed = await playService.proposeProcessVersion(draft.processVersionId, { actorUserId: ownerActorId }, draft.version);
    const reviewed = await playService.reviewProcessVersion(
      proposed.processVersionId,
      { actorUserId: reviewerActorId },
      'APPROVED',
      undefined,
      proposed.version
    );
    const published = await playService.publishProcessVersion(reviewed.processVersionId, { actorUserId: ownerActorId }, reviewed.version);
    return { definitionId: definition.processDefinitionId, versionId: published.processVersionId };
  }

  async function teardown(opts: { orgIds?: string[]; projectIds?: string[]; userIds?: string[]; definitionIds?: string[] }): Promise<void> {
    for (const definitionId of opts.definitionIds ?? []) {
      await control.query(`DELETE FROM process_versions WHERE process_definition_id = $1`, [definitionId]).catch(() => undefined);
      await control.query(`DELETE FROM process_definitions WHERE process_definition_id = $1`, [definitionId]).catch(() => undefined);
    }
    for (const projectId of opts.projectIds ?? []) {
      await control.query(`DELETE FROM case_core WHERE project_id = $1`, [projectId]).catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const userId of opts.userIds ?? []) {
      await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    }
    for (const orgId of opts.orgIds ?? []) {
      // organization_members cascades automatically (ON DELETE CASCADE from
      // organizations); users does not carry that FK, so any actor seeded
      // via seedActiveActor()/seedUser() for this org is swept here by
      // organization_id rather than needing per-test tracking.
      await control.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]).catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  // =========================================================================
  // (A) TARGET CONTRACT
  // =========================================================================
  describe('(A) target contract: requireCaseAccess in front of instantiateProcessVersion fails closed', () => {
    it('IDOR: an actor with no standing in the case-owning org is denied requireCaseAccess before instantiateProcessVersion would even run', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('idor-instantiate');
      const { definitionId, versionId } = await publishedPlay(orgId, 'idor-instantiate');
      const attackerOrgId = await seedOrg('idor-instantiate-attacker');
      const attackerUserId = await seedUser(attackerOrgId, 'idor-instantiate-attacker');
      await seedMember(attackerOrgId, attackerUserId, 'OWNER', 'ACTIVE');

      try {
        await expect(requireCaseAccess(attackerUserId, caseId)).rejects.toMatchObject({
          code: 'case_access_denied',
        });
      } finally {
        await teardown({ orgIds: [orgId, attackerOrgId], projectIds: [projectId], userIds: [attackerUserId], definitionIds: [definitionId] });
      }
      void versionId;
    }, 30_000);
  });

  // =========================================================================
  // (B) GAP CLOSED by Stream A (formerly known gap P1). Both concrete
  //     findings verified directly against the CURRENT code
  //     (server/src/services/caseWorkspace/playService.ts):
  //       1. instantiateProcessVersion now opens with
  //          `const version = await getProcessVersion(id, actorUserId);`
  //          (~line 1622) — actor-authorization on top of the pre-existing
  //          resource-to-resource organization_id consistency check — and
  //          then `await requireCaseAccess(actorUserId, targetCaseId);`
  //          (~line 1640) as a second, independent gate. getProcessVersion
  //          itself calls `requireOrgMember(actor,
  //          definitionRow.organization_id)` (caseWorkspaceAuthContext.ts),
  //          so a zero-standing actor is denied even earlier, at the
  //          version-read step.
  //
  //          IMPORTANT, and DIFFERENT from an earlier draft of this test:
  //          getProcessVersion does NOT let that denial surface as a
  //          distinguishable CaseWorkspaceAuthError('not_org_member', ...).
  //          It was subsequently hardened for CW-SEC-ENUM-PLAYS-01 (a
  //          separate, real 403-vs-404 existence-oracle finding on this
  //          same by-id read: processVersionId is caller-supplied and
  //          attacker-controlled, exactly the case the enumeration-oracle
  //          decision in caseWorkspaceAuthContext.ts's header calls out as
  //          needing the collapse, unlike the "organizationId already known
  //          to the caller's session" case that header says keeps
  //          'not_org_member' distinguishable). getProcessVersion now
  //          catches CaseWorkspaceAuthError and returns null instead of
  //          throwing, so instantiateProcessVersion's
  //          `if (!version) throw new Error('process_version_not_found')`
  //          fires — a plain, uncoded Error, identical to what a genuinely
  //          nonexistent processVersionId would produce. The actor is still
  //          rejected (this test's core property); only the error's SHAPE
  //          changed, deliberately, as a side effect of closing the
  //          enumeration oracle at the layer underneath this one. See
  //          playsEnumeration.security.pg.test.ts for that fix's own
  //          dedicated coverage.
  //       2. isAuthorizedPublisher (~line 662) no longer runs its own bespoke
  //          `SELECT role FROM organization_members WHERE ...` query — it now
  //          delegates to `requireOrgRole(userId, orgId, 'ADMIN')` (the
  //          shared caseWorkspaceAuthContext primitive), which composes
  //          requireOrgMember -> resolveActorMembership, and
  //          resolveActorMembership DOES filter `status !== 'ACTIVE'`. A
  //          REVOKED OWNER/ADMIN is therefore now denied.
  //     Both tests below now assert REJECTION, proving each gap is closed —
  //     polarity inverted from the original spec, coverage kept.
  // =========================================================================
  describe('(B) gap CLOSED by Stream A (formerly known gap P1): playService now self-enforces actor-authorization on both paths', () => {
    it('GAP CLOSED: instantiateProcessVersion now REJECTS an actor with ZERO standing in the (matching) organization (was: only resource-to-resource consistency was checked, never the actor)', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('gap-instantiate');
      const { definitionId, versionId } = await publishedPlay(orgId, 'gap-instantiate');
      // The attacker is a real identity string, but has NO organization_members
      // row for `orgId` at all — process version and case both legitimately
      // belong to the SAME org, so the OLD resource-to-resource consistency
      // check alone would have passed; the actor-authorization checks added
      // by Stream A are what now deny this.
      const attackerUserId = `ghost-instantiator-${randomUUID()}`;

      try {
        // Denied at the FIRST actor-authorization checkpoint reached:
        // instantiateProcessVersion's own internal getProcessVersion(id,
        // actorUserId) call requires org membership on the Play's
        // organization before instantiateProcessVersion's own
        // requireCaseAccess(actorUserId, targetCaseId) is even reached. The
        // denial is NOT surfaced as CaseWorkspaceAuthError('not_org_member')
        // though — getProcessVersion's CW-SEC-ENUM-PLAYS-01 hardening
        // collapses that into `null`, so instantiateProcessVersion throws
        // its own plain `process_version_not_found`, the SAME error a
        // genuinely nonexistent processVersionId would produce (that
        // collapse is the point: it is what keeps this by-id read from
        // being a cross-tenant existence oracle). Asserted on .message,
        // not .code — no CaseWorkspaceAuthError reaches this call site.
        await expect(
          playService.instantiateProcessVersion(versionId, caseId, { actorUserId: attackerUserId })
        ).rejects.toThrow('process_version_not_found');

        const rows = await control.query(`SELECT case_plan_version_id FROM case_plan_versions WHERE case_id = $1`, [caseId]);
        expect(rows.rows).toHaveLength(0); // no plan draft was ever created
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId], definitionIds: [definitionId] });
      }
    }, 30_000);

    it('GAP CLOSED (concrete defect, formerly not just "no check"): shareProcessDefinition now REJECTS an OWNER whose organization_members row is REVOKED (was: isAuthorizedPublisher had no status filter)', async () => {
      const orgId = await seedOrg('gap-share-revoked');
      // Seed the owner ACTIVE first — every step of building a publishable
      // Play version (createProcessDefinition/createProcessVersionDraft/
      // proposeProcessVersion/publishProcessVersion) now self-enforces
      // requireOrgMember, which requires ACTIVE standing at call time.
      const revokedOwnerId = await seedUser(orgId, 'gap-share-revoked-owner');
      const revokedOwnerMembershipId = await seedMember(orgId, revokedOwnerId, 'OWNER', 'ACTIVE');
      const reviewerId = await seedActiveActor(orgId, 'gap-share-revoked-reviewer', 'ADMIN');

      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Play (gap-share-revoked)',
        ownerActorId: revokedOwnerId,
        createdByActorId: revokedOwnerId,
      });
      const draft = await playService.createProcessVersionDraft({
        processDefinitionId: definition.processDefinitionId,
        semanticGraph: SIMPLE_GRAPH,
        createdByActorId: revokedOwnerId,
      });
      const proposed = await playService.proposeProcessVersion(draft.processVersionId, { actorUserId: revokedOwnerId }, draft.version);
      const reviewed = await playService.reviewProcessVersion(
        proposed.processVersionId,
        { actorUserId: reviewerId },
        'APPROVED',
        undefined,
        proposed.version
      );
      await playService.publishProcessVersion(reviewed.processVersionId, { actorUserId: revokedOwnerId }, reviewed.version);

      // NOW revoke — simulates the owner's standing being pulled AFTER they
      // published, before they attempt to share.
      await setMemberStatus(revokedOwnerMembershipId, 'REVOKED');

      try {
        // Formerly succeeded silently (isAuthorizedPublisher's bespoke query
        // had no `status = 'ACTIVE'` filter — the concrete P1 this test used
        // to document). isAuthorizedPublisher now delegates to
        // requireOrgRole -> requireOrgMember -> resolveActorMembership,
        // which DOES filter non-ACTIVE rows, so this REVOKED owner is denied
        // exactly like the role-insufficient MEMBER in the positive-control
        // test below — same public error, 'process_definition_share_not_authorized'
        // (isAuthorizedPublisher collapses both not_org_member and
        // insufficient_org_role to a plain `false`, so the caller cannot
        // distinguish "revoked" from "role too low" from the error alone).
        const currentDefinition = await playService.getProcessDefinition(definition.processDefinitionId, reviewerId);
        await expect(
          playService.shareProcessDefinition(
            definition.processDefinitionId,
            'ORGANIZATION',
            { actorUserId: revokedOwnerId },
            currentDefinition!.version
          )
        ).rejects.toThrow('process_definition_share_not_authorized');

        const after = await control.query(`SELECT visibility FROM process_definitions WHERE process_definition_id = $1`, [definition.processDefinitionId]);
        expect(after.rows[0]?.visibility).toBe('PRIVATE'); // unchanged
      } finally {
        await teardown({ orgIds: [orgId], userIds: [revokedOwnerId, reviewerId], definitionIds: [definition.processDefinitionId] });
      }
    }, 30_000);

    it('positive control (this one was already enforced, and still is): shareProcessDefinition rejects a MEMBER (below the OWNER/ADMIN floor)', async () => {
      const orgId = await seedOrg('gap-share-role-floor');
      const memberUserId = await seedUser(orgId, 'gap-share-role-floor-member');
      await seedMember(orgId, memberUserId, 'MEMBER', 'ACTIVE');
      const reviewerId = await seedActiveActor(orgId, 'gap-share-role-floor-reviewer', 'ADMIN');

      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Play (gap-share-role-floor)',
        ownerActorId: memberUserId,
        createdByActorId: memberUserId,
      });
      const draft = await playService.createProcessVersionDraft({
        processDefinitionId: definition.processDefinitionId,
        semanticGraph: SIMPLE_GRAPH,
        createdByActorId: memberUserId,
      });
      const proposed = await playService.proposeProcessVersion(draft.processVersionId, { actorUserId: memberUserId }, draft.version);
      const reviewed = await playService.reviewProcessVersion(
        proposed.processVersionId,
        { actorUserId: reviewerId },
        'APPROVED',
        undefined,
        proposed.version
      );
      await playService.publishProcessVersion(reviewed.processVersionId, { actorUserId: memberUserId }, reviewed.version);

      try {
        const currentDefinition = await playService.getProcessDefinition(definition.processDefinitionId, reviewerId);
        await expect(
          playService.shareProcessDefinition(
            definition.processDefinitionId,
            'ORGANIZATION',
            { actorUserId: memberUserId },
            currentDefinition!.version
          )
        ).rejects.toThrow('process_definition_share_not_authorized');
      } finally {
        await teardown({ orgIds: [orgId], userIds: [memberUserId, reviewerId], definitionIds: [definition.processDefinitionId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (C) Stale version / optimistic concurrency
  // =========================================================================
  describe('(C) stale version / optimistic concurrency', () => {
    it('two CONCURRENT updateProcessVersionDraft calls with the SAME expectedVersion: exactly one wins, the other gets process_version_conflict', async () => {
      const orgId = await seedOrg('occ-draft');
      // createProcessDefinition/createProcessVersionDraft/updateProcessVersionDraft
      // all now self-enforce requireOrgMember — every actor must be a real
      // ACTIVE member of orgId.
      const ownerId = await seedActiveActor(orgId, 'owner-occ-draft', 'OWNER');
      const editorAId = await seedActiveActor(orgId, 'editor-occ-a');
      const editorBId = await seedActiveActor(orgId, 'editor-occ-b');
      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Play (occ-draft)',
        ownerActorId: ownerId,
        createdByActorId: ownerId,
      });
      const draft = await playService.createProcessVersionDraft({
        processDefinitionId: definition.processDefinitionId,
        semanticGraph: SIMPLE_GRAPH,
        createdByActorId: ownerId,
      });

      try {
        const staleExpectedVersion = draft.version;
        const outcomes = await Promise.allSettled([
          playService.updateProcessVersionDraft(
            draft.processVersionId,
            { semanticGraph: SIMPLE_GRAPH, policyRef: 'policy-a', expectedVersion: staleExpectedVersion },
            { actorUserId: editorAId }
          ),
          playService.updateProcessVersionDraft(
            draft.processVersionId,
            { semanticGraph: SIMPLE_GRAPH, policyRef: 'policy-b', expectedVersion: staleExpectedVersion },
            { actorUserId: editorBId }
          ),
        ]);
        const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
        const rejected = outcomes.filter((o) => o.status === 'rejected');
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(
          (rejected[0] as PromiseRejectedResult).reason?.message ?? String((rejected[0] as PromiseRejectedResult).reason)
        ).toMatch(/process_version_conflict/);
      } finally {
        await teardown({ orgIds: [orgId], definitionIds: [definition.processDefinitionId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (D) Malformed input
  // =========================================================================
  describe('(D) malformed input rejected with stable domain errors', () => {
    it('createProcessDefinition rejects a missing organizationId with a domain error', async () => {
      await expect(
        playService.createProcessDefinition({
          organizationId: '',
          name: 'Malformed Play',
          ownerActorId: 'owner-malformed',
          createdByActorId: 'owner-malformed',
        })
      ).rejects.toThrow('process_definition_organization_id_required');
    }, 30_000);

    it('shareProcessDefinition rejects a NARROWING visibility change (ORGANIZATION -> TEAM is not a valid target enum member here, PRIVATE-only-widening is enforced by rank check)', async () => {
      const orgId = await seedOrg('malformed-narrow');
      const ownerUserId = await seedUser(orgId, 'malformed-narrow');
      await seedMember(orgId, ownerUserId, 'OWNER', 'ACTIVE');
      const { definitionId, versionId } = await publishedPlay(orgId, 'malformed-narrow');
      void versionId;
      try {
        const widened = await playService.shareProcessDefinition(
          definitionId,
          'ORGANIZATION',
          { actorUserId: ownerUserId },
          1
        );
        expect(widened.visibility).toBe('ORGANIZATION');
        // Attempting to "widen" again to the same/lower rank is rejected —
        // this file's target visibility enum is {TEAM, ORGANIZATION} only,
        // so re-sharing at ORGANIZATION (already the ceiling) must fail the
        // strict-widening check rather than silently no-op.
        await expect(
          playService.shareProcessDefinition(definitionId, 'ORGANIZATION', { actorUserId: ownerUserId }, widened.version)
        ).rejects.toThrow(/process_definition_share_not_a_widening/);
      } finally {
        await teardown({ orgIds: [orgId], userIds: [ownerUserId], definitionIds: [definitionId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (E) Duplicate / concurrent creation safety (no idempotencyKey field on
  //     this file's create methods — the definition-row lock inside
  //     createProcessVersionDraft is the actual duplicate-prevention
  //     mechanism, so this category tests THAT lock, not a replay key).
  // =========================================================================
  describe('(E) duplicate / concurrent creation safety', () => {
    it('two CONCURRENT createProcessVersionDraft calls for the SAME definition never collide on version_number — serialized via the definition row lock, not a lost update', async () => {
      const orgId = await seedOrg('dup-concurrent-draft');
      // createProcessDefinition/createProcessVersionDraft both now
      // self-enforce requireOrgMember — every actor must be a real ACTIVE
      // member of orgId.
      const ownerId = await seedActiveActor(orgId, 'owner-dup', 'OWNER');
      const editorAId = await seedActiveActor(orgId, 'editor-dup-a');
      const editorBId = await seedActiveActor(orgId, 'editor-dup-b');
      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Play (dup-concurrent-draft)',
        ownerActorId: ownerId,
        createdByActorId: ownerId,
      });
      try {
        const [a, b] = await Promise.all([
          playService.createProcessVersionDraft({
            processDefinitionId: definition.processDefinitionId,
            semanticGraph: SIMPLE_GRAPH,
            createdByActorId: editorAId,
          }),
          playService.createProcessVersionDraft({
            processDefinitionId: definition.processDefinitionId,
            semanticGraph: SIMPLE_GRAPH,
            createdByActorId: editorBId,
          }),
        ]);
        expect([a.versionNumber, b.versionNumber].sort()).toEqual([1, 2]);
        expect(a.processVersionId).not.toBe(b.processVersionId);
      } finally {
        await teardown({ orgIds: [orgId], definitionIds: [definition.processDefinitionId] });
      }
    }, 30_000);
  });
});

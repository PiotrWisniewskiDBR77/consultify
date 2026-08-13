/**
 * Case Workspace — Stream E adversarial security specification for
 * artifactLinkService.ts (CW-P09, EPIC E10 "Artifacts, evidence and
 * deliverables").
 *
 * SPECIFICATION, NOT YET RUN — see caseCoreService.security.pg.test.ts's
 * header for the full rationale (shared disposable Postgres + services
 * under concurrent modification by other streams right now; a clean SKIP
 * via the standard gate is the correct, expected outcome until fan-in).
 *
 * SEC-008 is the requirement this file most directly probes: "Case linking
 * validates ACL on both Case and artifact." Read directly from
 * linkArtifactToCase's body (server/src/services/caseWorkspace/
 * artifactLinkService.ts): the function confirms the CASE exists
 * (`SELECT ... FROM case_core WHERE case_id = ?`) but never checks the
 * calling actor's standing in that case's organization, and — by this
 * service's own explicit collision-avoidance mandate (this file's own
 * header comment) — it CANNOT check the artifact's own ACL either, because
 * it deliberately never reads into any other module's tables ("stores NO
 * copy of any artifact's business content — only typed pointers"). So
 * SEC-008 is unimplemented on BOTH halves at this layer today, not
 * partially. Verified directly:
 *   grep -rl "caseWorkspaceAuthContext\|requireCaseAccess\|requireOrgMember\|requireOrgRole" \
 *     server/src/services/caseWorkspace --include="*.ts" | grep -v caseWorkspaceAuthContext.ts
 * against the reference worktree: zero matches.
 *
 * Two describe blocks, same convention as the sibling security suites:
 *   (A) target contract — requireCaseAccess composed in front. Expected PASS.
 *   (B) known gap (P1) — direct calls proving SEC-008's Case-ACL half is
 *       unenforced today. Expected to currently succeed where it must not —
 *       a red/succeeding result here is correct, not a Stream E defect.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as artifactLinkService from '../../artifactLinkService.js';
import type { LinkArtifactToCaseInput } from '../../artifactLinkService.js';
import * as caseCoreService from '../../caseCoreService.js';
import { requireCaseAccess } from '../../caseWorkspaceAuthContext.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const linksResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_artifact_links'
          AND column_name IN ('link_id', 'case_id', 'artifact_type', 'artifact_id', 'link_status', 'version', 'dedupe_key')`
    );
    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    return (
      Number(linksResult.rows[0]?.present ?? 0) === 7 &&
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
    `[artifactLinkService SECURITY pg suite SKIPPED — clean skip pending Stream A/B/C fan-in, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `artifact_links + case_core + organization_members migrations applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('artifactLinkService — adversarial security (Stream E, CW-P09/E10)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  async function seedOrg(label: string): Promise<string> {
    const orgId = `seclink-org-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      orgId,
      `Stream E artifact-link test org (${label})`,
    ]);
    return orgId;
  }

  async function seedUser(orgId: string, label: string): Promise<string> {
    const userId = `seclink-user-${label}-${randomUUID()}`;
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
  ): Promise<void> {
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES ($1, $2, $3, $4, $5)`,
      [`seclink-member-${randomUUID()}`, orgId, userId, role, status]
    );
  }

  /**
   * Post-Stream-A addendum: caseCoreService.createCase now calls
   * requireOrgMember(createdByActorId, organizationId) internally, so the
   * fixture's creator actor must be a real ACTIVE member of the org — a
   * bare unseeded string id (the pre-retrofit fixture shape) now fails at
   * fixture-setup with CaseWorkspaceAuthError('not_org_member', ...).
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
    const projectId = `seclink-project-${label}-${randomUUID()}`;
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Stream E artifact-link test project (${label})`]
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

  function minimalLinkInput(params: {
    caseId: string;
    tag: string;
    linkedByActorId?: string;
    dedupeKey?: string | null;
    artifactId?: string;
  }): LinkArtifactToCaseInput {
    return {
      caseId: params.caseId,
      artifactType: 'DOCUMENT',
      artifactId: params.artifactId ?? `artifact-${params.tag}-${randomUUID()}`,
      relation: 'EVIDENCE',
      linkedByActorId: params.linkedByActorId ?? `linker-${params.tag}`,
      dedupeKey: params.dedupeKey ?? null,
    };
  }

  async function readLinkRow(linkId: string) {
    const result = await control.query(`SELECT * FROM case_workspace_artifact_links WHERE link_id = $1`, [linkId]);
    return result.rows[0] ?? null;
  }

  async function teardown(opts: { orgIds?: string[]; projectIds?: string[]; userIds?: string[] }): Promise<void> {
    for (const projectId of opts.projectIds ?? []) {
      await control.query(`DELETE FROM case_workspace_artifact_links WHERE project_id = $1`, [projectId]).catch(() => undefined);
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
  describe('(A) target contract: requireCaseAccess in front of artifactLinkService fails closed', () => {
    it('IDOR: an actor with no standing in the victim org is denied requireCaseAccess before linkArtifactToCase would even run', async () => {
      const { orgId: victimOrgId, projectId: victimProjectId, caseId: victimCaseId } = await seedOrgProjectCase('idor-victim');
      const attackerOrgId = await seedOrg('idor-attacker');
      const attackerUserId = await seedUser(attackerOrgId, 'idor-attacker');
      await seedMember(attackerOrgId, attackerUserId, 'ADMIN', 'ACTIVE');

      try {
        await expect(requireCaseAccess(attackerUserId, victimCaseId)).rejects.toMatchObject({
          code: 'case_access_denied',
        });
      } finally {
        await teardown({ orgIds: [victimOrgId, attackerOrgId], projectIds: [victimProjectId], userIds: [attackerUserId] });
      }
    }, 30_000);

    it('information leakage: requireCaseAccess gives byte-for-byte identical denial for a real cross-tenant caseId and a nonexistent one, before any artifact-link call', async () => {
      const { orgId: victimOrgId, projectId: victimProjectId, caseId: victimCaseId } = await seedOrgProjectCase('leak');
      const attackerOrgId = await seedOrg('leak-attacker');
      const attackerUserId = await seedUser(attackerOrgId, 'leak-attacker');
      await seedMember(attackerOrgId, attackerUserId, 'OWNER', 'ACTIVE');
      const nonexistentCaseId = `case-nonexistent-${randomUUID()}`;

      try {
        const errors: Array<{ code?: string; message: string }> = [];
        for (const caseId of [victimCaseId, nonexistentCaseId]) {
          try {
            await requireCaseAccess(attackerUserId, caseId);
            throw new Error(`expected throw for ${caseId}`);
          } catch (err) {
            errors.push({ code: (err as Error & { code?: string }).code, message: (err as Error).message });
          }
        }
        expect(errors[0].code).toBe(errors[1].code);
        expect(errors[0].message).toBe(errors[1].message);
      } finally {
        await teardown({ orgIds: [victimOrgId, attackerOrgId], projectIds: [victimProjectId], userIds: [attackerUserId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (B) GAP CLOSED by Stream A (formerly known gap P1, SEC-008's Case-ACL
  //     half). Verified directly against the CURRENT code
  //     (server/src/services/caseWorkspace/artifactLinkService.ts):
  //     linkArtifactToCase now opens with
  //     `await requireCaseAccess(linkedByActorId, caseId);` (line 402, using
  //     the input's ALREADY-EXISTING linkedByActorId field — no signature
  //     change), and markLinkArtifactUnavailable now opens with
  //     `await requireCaseAccess(actorUserId, row.case_id);` (line 603,
  //     using the already-existing actor.actorUserId field). Both tests
  //     below now assert REJECTION, proving the gap is closed — polarity
  //     inverted from the original spec, coverage kept (not deleted).
  //     Note: SEC-008's OTHER half (validating the artifact's own ACL) is
  //     still out of scope for this service by its own explicit
  //     collision-avoidance mandate (stores no copy of any artifact's
  //     business content) — that half is not this file's gap to close.
  // =========================================================================
  describe('(B) gap CLOSED by Stream A (formerly known gap P1): artifactLinkService now self-enforces the Case-ACL half of SEC-008', () => {
    it('GAP CLOSED: linkArtifactToCase now REJECTS a caseId belonging to a DIFFERENT organization than the calling actor (was: succeeded silently)', async () => {
      const { orgId: victimOrgId, projectId: victimProjectId, caseId: victimCaseId } = await seedOrgProjectCase('gap-link');
      const attackerOrgId = await seedOrg('gap-link-attacker');
      const attackerUserId = await seedUser(attackerOrgId, 'gap-link-attacker');
      await seedMember(attackerOrgId, attackerUserId, 'CONSULTANT', 'ACTIVE');

      try {
        // Formerly succeeded silently (the P1 this test used to document).
        // linkArtifactToCase now requires the caller to hold requireCaseAccess
        // over the target caseId before it ever inserts a row — the
        // attacker is only a member of a different org.
        await expect(
          artifactLinkService.linkArtifactToCase(
            minimalLinkInput({ caseId: victimCaseId, tag: 'gap-link', linkedByActorId: attackerUserId })
          )
        ).rejects.toMatchObject({ code: 'case_access_denied' });

        const rows = await control.query(`SELECT link_id FROM case_workspace_artifact_links WHERE case_id = $1`, [victimCaseId]);
        expect(rows.rows).toHaveLength(0); // no row was ever inserted
      } finally {
        await teardown({ orgIds: [victimOrgId, attackerOrgId], projectIds: [victimProjectId], userIds: [attackerUserId] });
      }
    }, 30_000);

    it('GAP CLOSED: markLinkArtifactUnavailable now REJECTS an out-of-org actor against a real link (was: an attacker could make a victim\'s evidence appear unavailable)', async () => {
      const { orgId: victimOrgId, projectId: victimProjectId, caseId: victimCaseId } = await seedOrgProjectCase('gap-unavailable');
      const attackerOrgId = await seedOrg('gap-unavailable-attacker');
      const attackerUserId = await seedUser(attackerOrgId, 'gap-unavailable-attacker');
      await seedMember(attackerOrgId, attackerUserId, 'MEMBER', 'ACTIVE');
      // The legitimate linker must itself be a real ACTIVE member of
      // victimOrgId now that linkArtifactToCase self-enforces requireCaseAccess.
      const legitLinkerId = await seedActiveActor(victimOrgId, 'gap-unavailable-legit-linker');

      const link = await artifactLinkService.linkArtifactToCase(
        minimalLinkInput({ caseId: victimCaseId, tag: 'gap-unavailable', linkedByActorId: legitLinkerId })
      );

      try {
        // Formerly succeeded silently. markLinkArtifactUnavailable now
        // requires requireCaseAccess(actorUserId, row.case_id) before
        // mutating link_status — the attacker has no standing in victimOrgId.
        await expect(
          artifactLinkService.markLinkArtifactUnavailable(
            link.linkId,
            { actorUserId: attackerUserId },
            'attacker-forged-unavailability'
          )
        ).rejects.toMatchObject({ code: 'case_access_denied' });

        const row = await readLinkRow(link.linkId);
        expect(row?.link_status).toBe('ACTIVE'); // unchanged — the forged mutation never landed
        expect(row?.unavailable_marked_by_actor_id).toBeNull();
      } finally {
        await teardown({ orgIds: [victimOrgId, attackerOrgId], projectIds: [victimProjectId], userIds: [attackerUserId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (C) Concurrency safety — every mutating method in this file uses the
  //     internal SELECT...FOR UPDATE + WHERE version=<locked-row-version>
  //     pattern (no caller-supplied expectedVersion anywhere in this file,
  //     same shape as caseCoreService.ts), so true concurrent calls
  //     serialize via the row lock rather than racing into a *_conflict.
  //     This asserts the property that actually matters: no lost update.
  // =========================================================================
  describe('(C) concurrency safety (no caller-supplied expectedVersion in this file)', () => {
    it('two concurrent pinArtifactRevision calls on the same link never lose an update: both entries land in revision_pin_history, version increments exactly twice', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('occ-pin');
      // linkArtifactToCase and pinArtifactRevision both self-enforce
      // requireCaseAccess now — every actor here must be a real ACTIVE
      // member of orgId.
      const linkerId = await seedActiveActor(orgId, 'occ-pin-linker');
      const pinnerAId = await seedActiveActor(orgId, 'occ-pin-pinner-a');
      const pinnerBId = await seedActiveActor(orgId, 'occ-pin-pinner-b');
      const link = await artifactLinkService.linkArtifactToCase(
        minimalLinkInput({ caseId, tag: 'occ-pin', linkedByActorId: linkerId })
      );
      try {
        const [a, b] = await Promise.all([
          artifactLinkService.pinArtifactRevision(link.linkId, 'rev-a', { actorUserId: pinnerAId }, 'concurrent A'),
          artifactLinkService.pinArtifactRevision(link.linkId, 'rev-b', { actorUserId: pinnerBId }, 'concurrent B'),
        ]);
        expect([a.version, b.version].sort()).toEqual([2, 3]);
        const row = await readLinkRow(link.linkId);
        const history = JSON.parse(row?.revision_pin_history ?? '[]');
        expect(history).toHaveLength(2);
        expect(row?.version).toBe(3);
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (D) Malformed input
  // =========================================================================
  describe('(D) malformed input rejected with stable domain errors', () => {
    it('linkArtifactToCase rejects an invalid relation enum value with a domain error, not a raw constraint error', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('malformed-relation');
      try {
        const badInput = {
          ...minimalLinkInput({ caseId, tag: 'malformed-relation' }),
          relation: 'NOT_A_REAL_RELATION' as LinkArtifactToCaseInput['relation'],
        };
        await expect(artifactLinkService.linkArtifactToCase(badInput)).rejects.toThrow('artifact_link_relation_invalid');
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    it('linkArtifactToCase rejects a missing artifactId with a domain error', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('malformed-missing-artifact');
      try {
        const badInput = { ...minimalLinkInput({ caseId, tag: 'malformed-missing-artifact' }), artifactId: '' };
        await expect(artifactLinkService.linkArtifactToCase(badInput)).rejects.toThrow('artifact_link_artifact_id_required');
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    it('linkArtifactToCase rejects a nonexistent caseId — post-Stream-A this now surfaces as the SAME anonymized case_access_denied requireCaseAccess uses for every denial shape (SEC-009), not the old artifact_link_case_not_found', async () => {
      // Pre-Stream-A this hit artifactLinkService's own internal
      // `if (!caseRow) throw new Error('artifact_link_case_not_found')`
      // check first. Post-Stream-A, linkArtifactToCase opens with
      // `await requireCaseAccess(linkedByActorId, caseId);` (line 402) —
      // BEFORE that internal check ever runs — and requireCaseAccess's own
      // enumeration-oracle design (caseWorkspaceAuthContext.ts) deliberately
      // makes "case not found" externally identical to "access denied" so a
      // caller cannot use the error shape to learn whether a caseId exists.
      // This is a legitimate, intentional behavior change (not a spec
      // authoring mistake, not a residual vulnerability) — updated to
      // assert on the new stable .code per this packet's own instructions.
      const orgId = await seedOrg('malformed-no-case');
      const actorId = await seedActiveActor(orgId, 'malformed-no-case-actor');
      const nonexistentCaseId = `case-nonexistent-${randomUUID()}`;
      try {
        const input = minimalLinkInput({ caseId: nonexistentCaseId, tag: 'malformed-no-case', linkedByActorId: actorId });
        await expect(artifactLinkService.linkArtifactToCase(input)).rejects.toMatchObject({
          code: 'case_access_denied',
        });
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [] });
      }
    }, 30_000);

    it('pinArtifactRevision rejects re-pinning a NON-ACTIVE (already unlinked) link with a domain error', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('malformed-inactive-pin');
      // linkedByActorId must now be a real ACTIVE member of orgId —
      // linkArtifactToCase self-enforces requireCaseAccess (line 402).
      const linkerId = await seedActiveActor(orgId, 'malformed-inactive-pin-linker');
      const link = await artifactLinkService.linkArtifactToCase(
        minimalLinkInput({ caseId, tag: 'malformed-inactive-pin', linkedByActorId: linkerId })
      );
      try {
        await artifactLinkService.unlinkArtifactFromCase(link.linkId, { actorUserId: linkerId }, 'no longer needed');
        await expect(
          artifactLinkService.pinArtifactRevision(link.linkId, 'rev-after-unlink', { actorUserId: linkerId })
        ).rejects.toThrow('artifact_link_not_active');
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (E) Duplicate request / retry-replay
  // =========================================================================
  describe('(E) duplicate request / retry-replay', () => {
    it('sequential linkArtifactToCase calls with the SAME dedupeKey replay safely: exactly one row, same linkId returned both times', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('dup-sequential');
      const linkerId = await seedActiveActor(orgId, 'dup-sequential-linker');
      const dedupeKey = `dedupe-sequential-${randomUUID()}`;
      try {
        const first = await artifactLinkService.linkArtifactToCase(
          minimalLinkInput({ caseId, tag: 'dup-sequential', dedupeKey, linkedByActorId: linkerId })
        );
        const replay = await artifactLinkService.linkArtifactToCase(
          minimalLinkInput({ caseId, tag: 'dup-sequential', dedupeKey, linkedByActorId: linkerId })
        );
        expect(replay.linkId).toBe(first.linkId);

        const rows = await control.query(`SELECT link_id FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId]);
        expect(rows.rows).toHaveLength(1);
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    it('CONCURRENT linkArtifactToCase calls with the SAME dedupeKey (Promise.all): exactly one row lands, both callers observe the same linkId', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('dup-concurrent');
      const linkerId = await seedActiveActor(orgId, 'dup-concurrent-linker');
      const dedupeKey = `dedupe-concurrent-${randomUUID()}`;
      try {
        const [a, b] = await Promise.all([
          artifactLinkService.linkArtifactToCase(minimalLinkInput({ caseId, tag: 'dup-concurrent', dedupeKey, linkedByActorId: linkerId })),
          artifactLinkService.linkArtifactToCase(minimalLinkInput({ caseId, tag: 'dup-concurrent', dedupeKey, linkedByActorId: linkerId })),
        ]);
        expect(a.linkId).toBe(b.linkId);

        const rows = await control.query(`SELECT link_id FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId]);
        expect(rows.rows).toHaveLength(1);
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);
  });
});

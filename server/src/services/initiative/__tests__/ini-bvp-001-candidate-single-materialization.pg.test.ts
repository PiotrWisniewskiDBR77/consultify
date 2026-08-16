/**
 * INI-BVP-001 — real-PostgreSQL regression test for the candidate
 * double-materialization defect.
 *
 * Two independent subsystems both write the SAME `initiative_candidates` row
 * and used to claim it through DISJOINT guard columns:
 *
 *   - Subsystem A (classic funnel): initiativeCandidateService.acceptCandidate()
 *     claimed via `UPDATE ... WHERE id = ? AND initiative_id IS NULL` and
 *     creates a REAL row in the relational `initiatives` table via
 *     createInitiativeService. Its cross-record dedup (findDuplicateInitiative)
 *     queries ONLY `initiatives`.
 *
 *   - Subsystem B (event-sourced runtime-v1): registerInitiative.ts /
 *     postgresMaterialCommandUnitOfWork.markSourceProposalRegistered() claims
 *     via `UPDATE ... WHERE ... AND status = 'pending' AND
 *     registered_initiative_id IS NULL` and writes ONLY an `ie_aggregate_state`
 *     aggregate row — never `initiatives`.
 *
 * Before the fix, B-then-A left ONE candidate row with BOTH
 * `registered_initiative_id` AND `initiative_id` set = two materializations in
 * two stores, because A's guard never looked at B's claim column (A-then-B was
 * already safe: A also sets status='accepted' on claim, which IS part of B's
 * guard).
 *
 * The fix (initiativeCandidateService.ts):
 *   - `acceptCandidate` now short-circuits when `registeredInitiativeId` is
 *     already set (no `initiativeId`) — adopts that receipt, mints nothing.
 *   - the receipt-claim UPDATE's WHERE clause now also requires
 *     `registered_initiative_id IS NULL`, and the "claim not ours" fallback
 *     re-read now also adopts a concurrent runtime-v1 winner.
 * Plus a symmetric defensive `AND initiative_id IS NULL` on B's own claim UPDATE
 * (postgresMaterialCommandUnitOfWork.ts markSourceProposalRegistered).
 *
 * WHY REAL POSTGRES: the bug is about which row a guarded UPDATE's WHERE
 * clause matches after a concurrent/prior write — invisible against a mock.
 * Follows the RUN_DB_TESTS=1 + MOCK_DB=false + NODE_ENV=test contract other
 * `.pg.test.ts` files in this tree use (see initiativeCapabilityMatrix.pg.test.ts)
 * — `NODE_ENV=test` alone silently substitutes a mock DB (Database.ts:80-89).
 *
 * HOW TO RUN
 * ----------
 *   DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:55811/consultinity \
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run server/src/services/initiative/__tests__/ini-bvp-001-candidate-single-materialization.pg.test.ts \
 *     --retry=0 --no-file-parallelism --maxWorkers=1
 *
 * Without that env combination the whole suite is SKIPPED (describe.skipIf),
 * never silently green.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

// `server/vitest.config.ts` forces `DB_TYPE: 'sqlite'` via `test.env` for every
// suite, which wins over whatever the shell/operator passed. Correct it back to
// 'postgres' before queryHelpers/Database.ts is first imported (see the sibling
// initiativeCapabilityMatrix.pg.test.ts, which established this pattern).
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)(
  'INI-BVP-001 — candidate single materialization (real PostgreSQL)',
  () => {
    let queryHelpers: typeof import('../../../utils/queryHelpers.js');
    let candidateService: typeof import('../initiativeCandidateService.js');
    let submitMod: typeof import('../../../domain/initiatives-execution/submitSourceProposal.js');
    let registerMod: typeof import('../../../domain/initiatives-execution/registerInitiative.js');
    let uowMod: typeof import('../../../domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js');
    let Pool: typeof import('pg').Pool;
    let pool: InstanceType<typeof import('pg').Pool>;
    let unitOfWork: InstanceType<typeof uowMod.PostgresMaterialCommandUnitOfWork>;

    const createdOrgIds: string[] = [];

    beforeAll(async () => {
      ({ Pool } = await import('pg'));
      pool = new Pool({ connectionString: CONNECTION_STRING });

      // Import the REAL app modules only after env vars are set — Database.ts /
      // DatabaseConfig.ts read process.env at module-load time.
      queryHelpers = await import('../../../utils/queryHelpers.js');
      candidateService = await import('../initiativeCandidateService.js');
      submitMod = await import('../../../domain/initiatives-execution/submitSourceProposal.js');
      registerMod = await import('../../../domain/initiatives-execution/registerInitiative.js');
      uowMod = await import(
        '../../../domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js'
      );
      unitOfWork = new uowMod.PostgresMaterialCommandUnitOfWork(pool);
      void queryHelpers; // imported for side-effect parity with the app's real DB layer
    }, 30000);

    afterAll(async () => {
      if (pool) {
        if (createdOrgIds.length > 0) {
          // initiative_candidates / ie_* runtime-v1 tables carry no FK to
          // organizations, so they must be cleaned explicitly (not covered by
          // organizations' ON DELETE CASCADE). `audit_events.org_id` is
          // ON DELETE SET NULL (not CASCADE) — delete those rows explicitly too
          // or they'd survive as orphans. `initiatives` DOES cascade from
          // organizations, so deleting the org fixture cleans those up.
          await pool.query(`DELETE FROM initiative_candidates WHERE organization_id = ANY($1)`, [
            createdOrgIds,
          ]);
          await pool.query(`DELETE FROM ie_aggregate_state WHERE organization_id = ANY($1)`, [
            createdOrgIds,
          ]);
          await pool.query(`DELETE FROM ie_command_receipts WHERE organization_id = ANY($1)`, [
            createdOrgIds,
          ]);
          await pool.query(`DELETE FROM ie_audit_events WHERE organization_id = ANY($1)`, [
            createdOrgIds,
          ]);
          await pool.query(`DELETE FROM ie_outbox_events WHERE organization_id = ANY($1)`, [
            createdOrgIds,
          ]);
          await pool.query(`DELETE FROM ie_aggregate_relations WHERE organization_id = ANY($1)`, [
            createdOrgIds,
          ]);
          await pool.query(`DELETE FROM audit_events WHERE org_id = ANY($1)`, [createdOrgIds]);
          await pool.query(`DELETE FROM projects WHERE organization_id = ANY($1)`, [
            createdOrgIds,
          ]);
          await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [createdOrgIds]);
        }
        await pool.end();
      }
    });

    function freshOrg(): string {
      const id = `claude_b_org_${randomUUID()}`;
      createdOrgIds.push(id);
      return id;
    }

    async function seedOrg(orgId: string): Promise<void> {
      await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        orgId,
        'INI-BVP-001 fixture',
      ]);
    }

    // Deterministic per `proposalId` (NOT randomUUID() per call) — registerInitiative.ts
    // requires the Register payload's content (title/problem/proposedOutcome/
    // projectId/visibility/initiativeOwnerId) to exactly match what was submitted
    // (`contentMatches` check). submitProposal() and registerProposal() below each
    // call this independently, so it must return byte-identical values both times.
    function buildSubmitPayload(proposalId: string, sourceId: string) {
      return {
        sourceType: 'claude_b_source_type',
        sourceId,
        sourceVersion: 1,
        provenance: {
          system: 'claude-b-test',
          recordType: 'fixture',
          capturedAt: new Date().toISOString(),
          evidenceRefs: ['claude-b-evidence-1'],
        },
        title: `INI-BVP-001 candidate ${proposalId}`,
        problem: 'Problem statement for INI-BVP-001 fixture.',
        proposedOutcome: 'Outcome for INI-BVP-001 fixture.',
        projectId: `claude_b_project_${proposalId}`,
        initiativeOwnerId: `claude_b_owner_${proposalId}`,
        visibility: 'PROJECT' as const,
      };
    }

    /** Subsystem B, step 1: submit a source proposal (creates the candidate row). */
    async function submitProposal(params: {
      orgId: string;
      proposalId: string;
      sourceId: string;
      actorId: string;
    }): ReturnType<typeof submitMod.submitSourceProposal> {
      const { orgId, proposalId, sourceId, actorId } = params;
      const submitPayload = buildSubmitPayload(proposalId, sourceId);
      return submitMod.submitSourceProposal(unitOfWork, {
        organizationId: orgId,
        actorId,
        aggregateType: 'source_proposal',
        aggregateId: proposalId,
        expectedVersion: 0,
        createIfMissing: true,
        clientRequestId: `claude_b_submit_${proposalId}`,
        correlationId: `claude_b_corr_submit_${proposalId}`,
        policyId: 'claude-b-policy',
        policyVersion: 1,
        commandType: 'source-proposal.submit',
        payload: submitPayload,
      });
    }

    /** Subsystem B, step 2: register the proposal (the actual CLAIM). */
    async function registerProposal(params: {
      orgId: string;
      proposalId: string;
      initiativeAggregateId: string;
      sourceId: string;
      actorId: string;
    }): ReturnType<typeof registerMod.registerInitiative> {
      const { orgId, proposalId, initiativeAggregateId, sourceId, actorId } = params;
      const submitPayload = buildSubmitPayload(proposalId, sourceId);
      return registerMod.registerInitiative(unitOfWork, {
        organizationId: orgId,
        actorId,
        aggregateType: 'initiative',
        aggregateId: initiativeAggregateId,
        expectedVersion: 0,
        createIfMissing: true,
        clientRequestId: `claude_b_register_${proposalId}`,
        correlationId: `claude_b_corr_register_${proposalId}`,
        policyId: 'claude-b-policy',
        policyVersion: 1,
        commandType: 'initiative.register',
        payload: {
          proposalId,
          proposalVersion: 1,
          sourceType: submitPayload.sourceType,
          sourceId: submitPayload.sourceId,
          sourceVersion: submitPayload.sourceVersion,
          title: submitPayload.title,
          problem: submitPayload.problem,
          proposedOutcome: submitPayload.proposedOutcome,
          projectId: submitPayload.projectId,
          visibility: submitPayload.visibility,
          initiativeOwnerId: submitPayload.initiativeOwnerId,
          validatorCapability: 'INITIATIVE_REGISTER' as const,
        },
      });
    }

    /** Direct fixture insert matching Subsystem A's OWN row shape (as
     * `scanForCandidates`/`createCandidateFromSource` produce) — a
     * pure-classic-funnel candidate untouched by runtime-v1. */
    async function insertClassicCandidate(params: {
      orgId: string;
      candidateId: string;
      title: string;
    }): Promise<void> {
      await pool.query(
        `INSERT INTO initiative_candidates
           (id, organization_id, source_type, source_id, title, rationale, fit_score, status, created_by)
         VALUES ($1, $2, 'claude_b_classic_source', $3, $4, 'INI-BVP-001 fixture rationale', 0.5, 'pending', $5)`,
        [
          params.candidateId,
          params.orgId,
          `claude_b_srcid_${randomUUID()}`,
          params.title,
          `claude_b_actor_${randomUUID()}`,
        ]
      );
    }

    async function readCandidateRow(candidateId: string): Promise<{
      status: string;
      registered_initiative_id: string | null;
      initiative_id: string | null;
    }> {
      const res = await pool.query(
        `SELECT status, registered_initiative_id, initiative_id
           FROM initiative_candidates WHERE id = $1`,
        [candidateId]
      );
      return res.rows[0];
    }

    async function countInitiatives(orgId: string): Promise<number> {
      const res = await pool.query(`SELECT count(*)::int AS n FROM initiatives WHERE organization_id = $1`, [
        orgId,
      ]);
      return res.rows[0].n;
    }

    it('FIXED: B-then-A no longer double-materializes — A adopts B\'s receipt instead of minting a second DRAFT', async () => {
      const orgId = freshOrg();
      await seedOrg(orgId);
      const proposalId = `claude_b_cand_${randomUUID()}`;
      const initiativeAggregateId = `claude_b_agg_init_${randomUUID()}`;
      const sourceId = `claude_b_srcid_${randomUUID()}`;
      const actorId = `claude_b_actor_${randomUUID()}`;

      // Subsystem B (event-sourced runtime-v1) claims first.
      await submitProposal({ orgId, proposalId, sourceId, actorId });
      await registerProposal({ orgId, proposalId, initiativeAggregateId, sourceId, actorId });

      const afterB = await readCandidateRow(proposalId);
      expect(afterB.status).toBe('accepted');
      expect(afterB.registered_initiative_id).toBe(initiativeAggregateId);
      expect(afterB.initiative_id).toBeNull();

      // Subsystem A (classic funnel) now accepts the SAME candidate row.
      const payloadA = await candidateService.acceptCandidate(undefined, proposalId, {
        orgId,
        userId: actorId,
        fill: false,
      });

      // THE FIX: A adopts B's receipt — it does NOT mint a second DRAFT.
      expect(payloadA?.receiptPersisted).toBe(true);
      expect(payloadA?.initiativeId).toBeNull();
      expect(payloadA?.registeredInitiativeId).toBe(initiativeAggregateId);

      const afterA = await readCandidateRow(proposalId);
      // EXACTLY ONE claim column is set — never both.
      expect(afterA.registered_initiative_id).toBe(initiativeAggregateId);
      expect(afterA.initiative_id).toBeNull();

      // No second row was created in the relational `initiatives` table.
      expect(await countInitiatives(orgId)).toBe(0);

      // NEGATIVE CONTROL (c) — retry/replay: calling accept again is idempotent,
      // returns the SAME resolved receipt, and still creates nothing.
      const payloadRetry = await candidateService.acceptCandidate(undefined, proposalId, {
        orgId,
        userId: actorId,
        fill: false,
      });
      expect(payloadRetry?.receiptPersisted).toBe(true);
      expect(payloadRetry?.initiativeId).toBeNull();
      expect(payloadRetry?.registeredInitiativeId).toBe(initiativeAggregateId);
      expect(await countInitiatives(orgId)).toBe(0);
      const afterRetry = await readCandidateRow(proposalId);
      expect(afterRetry.registered_initiative_id).toBe(initiativeAggregateId);
      expect(afterRetry.initiative_id).toBeNull();
    });

    it('PRESERVED: A-then-B stays safe (unchanged direction) — B is rejected once A has accepted', async () => {
      const orgId = freshOrg();
      await seedOrg(orgId);
      const proposalId = `claude_b_cand_${randomUUID()}`;
      const initiativeAggregateId = `claude_b_agg_init_${randomUUID()}`;
      const sourceId = `claude_b_srcid_${randomUUID()}`;
      const actorId = `claude_b_actor_${randomUUID()}`;

      // The candidate row must exist for A to read it (Subsystem A's SELECT
      // doesn't create rows) — submit via B first (this is just the row
      // creation, not a claim: status stays 'pending').
      await submitProposal({ orgId, proposalId, sourceId, actorId });

      // Subsystem A (classic funnel) claims first.
      const payloadA = await candidateService.acceptCandidate(undefined, proposalId, {
        orgId,
        userId: actorId,
        fill: false,
      });
      expect(payloadA?.receiptPersisted).toBe(true);
      expect(payloadA?.initiativeId).toBeTruthy();
      expect(payloadA?.registeredInitiativeId).toBeFalsy();

      // Subsystem B now attempts to register the SAME proposal — must be
      // rejected (candidate is no longer 'pending'), leaving registered_initiative_id
      // NULL forever on this row.
      await expect(
        registerProposal({ orgId, proposalId, initiativeAggregateId, sourceId, actorId })
      ).rejects.toThrow(/no longer registerable/i);

      const afterB = await readCandidateRow(proposalId);
      expect(afterB.initiative_id).toBe(payloadA?.initiativeId);
      expect(afterB.registered_initiative_id).toBeNull();

      // Exactly one materialization: one row in `initiatives`, zero in
      // ie_aggregate_state for the attempted (never-created) aggregate id.
      expect(await countInitiatives(orgId)).toBe(1);
      const aggRow = await pool.query(
        `SELECT 1 FROM ie_aggregate_state WHERE organization_id = $1 AND aggregate_type = 'initiative' AND aggregate_id = $2`,
        [orgId, initiativeAggregateId]
      );
      expect(aggRow.rowCount).toBe(0);
    });

    it('CONCURRENT (negative control a): registerInitiative (B) and acceptCandidate (A) racing on the SAME row converge to EXACTLY ONE claim column, never both', async () => {
      const orgId = freshOrg();
      await seedOrg(orgId);
      const proposalId = `claude_b_cand_${randomUUID()}`;
      const initiativeAggregateId = `claude_b_agg_init_${randomUUID()}`;
      const sourceId = `claude_b_srcid_${randomUUID()}`;
      const actorId = `claude_b_actor_${randomUUID()}`;

      // Row exists, uncontested (status still 'pending').
      await submitProposal({ orgId, proposalId, sourceId, actorId });

      // Fire B's register and A's accept CONCURRENTLY — real row-lock race.
      const [bResult, aResult] = await Promise.allSettled([
        registerProposal({ orgId, proposalId, initiativeAggregateId, sourceId, actorId }),
        candidateService.acceptCandidate(undefined, proposalId, {
          orgId,
          userId: actorId,
          fill: false,
        }),
      ]);

      const finalRow = await readCandidateRow(proposalId);
      // Exactly one of the two claim columns is set — NEVER both.
      const bClaimed = finalRow.registered_initiative_id != null;
      const aClaimed = finalRow.initiative_id != null;
      expect(bClaimed !== aClaimed).toBe(true); // XOR: exactly one
      expect(finalRow.status).toBe('accepted');

      // The canonical materialization count matches whichever side won:
      // `initiatives` has exactly 1 row iff A's claim is the one that stuck.
      expect(await countInitiatives(orgId)).toBe(aClaimed ? 1 : 0);

      if (aResult.status === 'fulfilled' && aResult.value) {
        if (aClaimed) {
          expect(aResult.value.initiativeId).toBe(finalRow.initiative_id);
          expect(aResult.value.registeredInitiativeId).toBeFalsy();
        } else {
          // A observed B's win and adopted it instead of minting a second DRAFT.
          expect(aResult.value.initiativeId).toBeNull();
          expect(aResult.value.registeredInitiativeId).toBe(finalRow.registered_initiative_id);
        }
      }
      if (bResult.status === 'rejected') {
        // B lost the race (A claimed first: status flipped away from 'pending').
        expect(String(bResult.reason)).toMatch(/no longer registerable/i);
      }
    });

    it('CONCURRENT (negative control a, sanity): two concurrent acceptCandidate calls on a pure classic-funnel candidate converge to ONE canonical initiative', async () => {
      const orgId = freshOrg();
      await seedOrg(orgId);
      const candidateId = `claude_b_cand_${randomUUID()}`;
      const actorId = `claude_b_actor_${randomUUID()}`;
      await insertClassicCandidate({
        orgId,
        candidateId,
        title: `INI-BVP-001 concurrent-A ${candidateId}`,
      });

      const [r1, r2] = await Promise.all([
        candidateService.acceptCandidate(undefined, candidateId, { orgId, userId: actorId, fill: false }),
        candidateService.acceptCandidate(undefined, candidateId, { orgId, userId: actorId, fill: false }),
      ]);

      expect(r1?.receiptPersisted).toBe(true);
      expect(r2?.receiptPersisted).toBe(true);
      expect(r1?.initiativeId).toBeTruthy();
      expect(r1?.initiativeId).toBe(r2?.initiativeId); // both converge to ONE canonical id

      const finalRow = await readCandidateRow(candidateId);
      expect(finalRow.initiative_id).toBe(r1?.initiativeId);
      expect(finalRow.registered_initiative_id).toBeNull();

      // If both calls minted a DRAFT before the claim, the losing caller now
      // compensates its own unlinked row before adopting the durable winner.
      expect(await countInitiatives(orgId)).toBe(1);
    });

    it('NEGATIVE CONTROL (b): cross-tenant accept is denied — an org-B caller cannot accept an org-A candidate', async () => {
      const orgA = freshOrg();
      const orgB = freshOrg();
      await seedOrg(orgA);
      await seedOrg(orgB);
      const candidateId = `claude_b_cand_${randomUUID()}`;
      await insertClassicCandidate({
        orgId: orgA,
        candidateId,
        title: `INI-BVP-001 cross-tenant ${candidateId}`,
      });

      const crossTenantResult = await candidateService.acceptCandidate(undefined, candidateId, {
        orgId: orgB,
        userId: `claude_b_actor_${randomUUID()}`,
        fill: false,
      });
      expect(crossTenantResult).toBeNull();

      // The org-A row is untouched — still pending, nothing materialized.
      const row = await readCandidateRow(candidateId);
      expect(row.status).toBe('pending');
      expect(row.initiative_id).toBeNull();
      expect(row.registered_initiative_id).toBeNull();
      expect(await countInitiatives(orgA)).toBe(0);
      expect(await countInitiatives(orgB)).toBe(0);

      // The legitimate org-A caller can still accept it normally.
      const legitResult = await candidateService.acceptCandidate(undefined, candidateId, {
        orgId: orgA,
        userId: `claude_b_actor_${randomUUID()}`,
        fill: false,
      });
      expect(legitResult?.receiptPersisted).toBe(true);
      expect(legitResult?.initiativeId).toBeTruthy();
    });
  }
);

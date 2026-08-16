/**
 * tenantIsolation — AUD-MVP-LIFECYCLE-001 DoD item 9.
 *
 * Org B cannot register org A's proposal, cannot read org A's proposal by
 * id, and cannot see org A's lifecycle rows (criteria, findings) in its own
 * listings — proven against real Postgres, through the actual services
 * (server/src/services/audits/**, read-only for this lane).
 *
 * Run (from repo root):
 *   DATABASE_URL=postgresql://... DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run server/src/services/auditProgramHandoff/__tests__/tenantIsolation.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  actorFor,
  addMember,
  cleanupOrg,
  insertOrganization,
  makeProgram,
  REAL_PG,
  requireRealPg,
  uid,
} from './helpers.js';

const describeDb = REAL_PG ? describe : describe.skip;
if (REAL_PG) requireRealPg();

describeDb('tenant isolation — org B cannot touch org A audit data (real Postgres)', () => {
  let pool: InstanceType<typeof import('pg').Pool>;
  let proposalService: typeof import('../../audits/proposalService.js');
  let criterionService: typeof import('../../audits/criterionService.js');
  let findingService: typeof import('../../audits/findingService.js');

  const orgA = uid('org-tenant-a');
  const orgB = uid('org-tenant-b');
  const userA = uid('user-a');
  const userB = uid('user-b');

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    proposalService = await import('../../audits/proposalService.js');
    criterionService = await import('../../audits/criterionService.js');
    findingService = await import('../../audits/findingService.js');
    await insertOrganization(pool, orgA);
    await insertOrganization(pool, orgB);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupOrg(pool, orgA);
    await cleanupOrg(pool, orgB);
    await pool.end();
  });

  it('org B cannot register org A\'s proposal, and lifecycle rows stay invisible cross-tenant', async () => {
    const programA = await makeProgram(pool, orgA, userA);
    await addMember(pool, orgA, programA, userA, 'lead_auditor');
    await addMember(pool, orgA, programA, userA, 'program_owner');

    const criterionId = uid('crit');
    await pool.query(
      `INSERT INTO audit_program_criteria (id, program_id, organization_id, ordinal, ref_code, title, requirement_text)
       VALUES ($1,$2,$3,1,'A.1','Kryterium izolacji','Wymaganie testowe — izolacja')`,
      [criterionId, programA, orgA],
    );

    const findingId = uid('find');
    await pool.query(
      `INSERT INTO audit_program_findings (id, program_id, organization_id, statement, classification, severity, status, criterion_id)
       VALUES ($1,$2,$3,'Ustalenie org A — izolacja','nonconforming','medium','confirmed',$4)`,
      [findingId, programA, orgA, criterionId],
    );

    const [proposal] = await proposalService.draftProposalsFromFindings(orgA, actorFor(orgA, userA), programA, {
      findingIds: [findingId],
      title: 'Propozycja org A — izolacja',
    });

    // 1. org B cannot READ org A's proposal by id.
    const readAsB = await proposalService.getProposal(orgB, proposal.id);
    expect(readAsB).toBeNull();

    // 2. org B cannot LIST org A's proposal under its own program.
    const programB = await makeProgram(pool, orgB, userB);
    await addMember(pool, orgB, programB, userB, 'program_owner');
    const listAsB = await proposalService.listProposals(orgB, { programId: programB });
    expect(listAsB).toHaveLength(0);

    // 3. org B cannot REGISTER org A's proposal — even with a program_owner
    //    actor in ITS OWN org, calling with orgB as the tenant scope.
    await expect(proposalService.registerAsInitiative(orgB, actorFor(orgB, userB), proposal.id)).rejects.toMatchObject({
      code: 'AUDIT_NOT_FOUND',
    });

    // 4. org B cannot read org A's criterion or finding directly.
    // getCriterion returns null on a cross-tenant miss (never leaks the row);
    // getFinding throws AUDIT_NOT_FOUND — both are "invisible", just via
    // different (and both legitimate) not-found conventions in this kernel.
    const criterionAsB = await criterionService.getCriterion(orgB, criterionId);
    expect(criterionAsB).toBeNull();
    await expect(findingService.getFinding(orgB, findingId)).rejects.toMatchObject({
      code: 'AUDIT_NOT_FOUND',
    });

    // Positive control: org A can still do all of the above on its own data.
    const readAsA = await proposalService.getProposal(orgA, proposal.id);
    expect(readAsA?.id).toBe(proposal.id);
    const registeredByA = await proposalService.registerAsInitiative(orgA, actorFor(orgA, userA), proposal.id);
    expect(registeredByA.status).toBe('registered');
  }, 60_000);
});

/**
 * proposalService.test — REALNA baza (consultify_audits_u5). Uruchamiaj z
 * korzenia worktree z prefiksem:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false
 *   POSTGRES_SKIP_INIT_IN_TEST=1
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u5"
 *
 * Sprawdza piątą powierzchnię: draft powstaje TYLKO z ustaleń confirmed+,
 * jedna propozycja może łączyć kilka ustaleń, żadna propozycja NIE powstaje
 * automatycznie z samej niezgodności, rejestracja zapisuje lineage przez
 * kanoniczny kreator inicjatyw, i izolację organizacji.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');

describe.skipIf(!REAL_PG)('proposalService (real Postgres)', () => {
  let pool: InstanceType<typeof import('pg').Pool>;
  let proposalService: typeof import('../proposalService.js');

  const orgA = `org-u5-prop-${randomUUID()}`;
  const orgB = `org-u5-prop-b-${randomUUID()}`;
  const ownerUser = `user-u5-owner-${randomUUID()}`;

  const allOrgIds = [orgA, orgB];
  const createdInitiativeIds: string[] = [];

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    proposalService = await import('../proposalService.js');

    // registerAsInitiative goes through the canonical `initiatives` funnel,
    // whose organization_id column carries a real FK to `organizations` — a
    // fabricated org id would make the canonical creator fail with an FK
    // violation, which is a DIFFERENT scenario (schema-missing-data) than the
    // one this test is proving (lineage gets recorded on success).
    for (const orgId of allOrgIds) {
      await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [orgId, `U5 test org ${orgId}`]);
    }
  }, 60000);

  afterAll(async () => {
    if (!pool) return;
    if (createdInitiativeIds.length > 0) {
      await pool.query(`DELETE FROM initiatives WHERE id = ANY($1)`, [createdInitiativeIds]);
    }
    for (const table of [
      'audit_initiative_proposals',
      'audit_program_findings',
      'audit_program_members',
      'audit_programs',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id = ANY($1)`, [allOrgIds]);
    }
    await pool.query(`DELETE FROM projects WHERE organization_id = ANY($1)`, [allOrgIds]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [allOrgIds]);
    await pool.end();
  });

  async function makeProgram(orgId: string): Promise<string> {
    const id = `prog-u5-prop-${randomUUID()}`;
    await pool.query(
      `INSERT INTO audit_programs (id, organization_id, name, status, created_by)
       VALUES ($1,$2,'Program propozycji','fieldwork',$3)`,
      [id, orgId, ownerUser],
    );
    // lead_auditor covers proposal.draft; program_owner additionally covers
    // proposal.register (permissions.ts keeps registration to program-owner
    // level — a stricter capability than drafting).
    await pool.query(
      `INSERT INTO audit_program_members (id, program_id, organization_id, user_id, member_role, independence_declared)
       VALUES ($1,$2,$3,$4,'lead_auditor', TRUE)`,
      [`memb-${randomUUID()}`, id, orgId, ownerUser],
    );
    await pool.query(
      `INSERT INTO audit_program_members (id, program_id, organization_id, user_id, member_role, independence_declared)
       VALUES ($1,$2,$3,$4,'program_owner', TRUE)`,
      [`memb-${randomUUID()}`, id, orgId, ownerUser],
    );
    return id;
  }

  async function insertFinding(
    programId: string,
    orgId: string,
    status: string,
    extra: Partial<Record<string, unknown>> = {},
  ): Promise<string> {
    const id = `find-${randomUUID()}`;
    await pool.query(
      `INSERT INTO audit_program_findings
         (id, program_id, organization_id, statement, classification, severity, status,
          root_cause, root_cause_confirmed, criterion_id)
       VALUES ($1,$2,$3,$4,'nonconforming',$5,$6,$7,$8,$9)`,
      [
        id,
        programId,
        orgId,
        (extra.statement as string) ?? `Ustalenie ${id}`,
        (extra.severity as string) ?? 'medium',
        status,
        (extra.rootCause as string) ?? null,
        (extra.rootCauseConfirmed as boolean) ?? false,
        (extra.criterionId as string) ?? null,
      ],
    );
    return id;
  }

  function actorFor(orgId: string, userId: string = ownerUser) {
    return { userId, organizationId: orgId };
  }

  it('draft powstaje TYLKO z ustaleń w statusie confirmed lub późniejszym — odrzuca draft/in_review/rejected', async () => {
    const programId = await makeProgram(orgA);
    const draftFind = await insertFinding(programId, orgA, 'draft');
    const inReviewFind = await insertFinding(programId, orgA, 'in_review');
    const rejectedFind = await insertFinding(programId, orgA, 'rejected');

    await expect(
      proposalService.draftProposalsFromFindings(orgA, actorFor(orgA), programId, {
        findingIds: [draftFind, inReviewFind, rejectedFind],
      }),
    ).rejects.toMatchObject({ code: 'AUDIT_PROPOSAL_NO_ELIGIBLE_FINDINGS' });
  });

  it('jedna propozycja może wynikać z KILKU ustaleń (domyślnie scala wskazane)', async () => {
    const programId = await makeProgram(orgA);
    const f1 = await insertFinding(programId, orgA, 'confirmed', { statement: 'Ustalenie A' });
    const f2 = await insertFinding(programId, orgA, 'closed', { statement: 'Ustalenie B' });

    const proposals = await proposalService.draftProposalsFromFindings(orgA, actorFor(orgA), programId, {
      findingIds: [f1, f2],
    });

    expect(proposals).toHaveLength(1);
    expect(proposals[0].sourceFindingIds.sort()).toEqual([f1, f2].sort());
    expect(proposals[0].status).toBe('draft');
  });

  it('draft NIE powstaje automatycznie z każdej niezgodności — tylko z jawnie wskazanych ustaleń', async () => {
    const programId = await makeProgram(orgA);
    // Trzy ustalenia kwalifikujące się, ale wskazujemy tylko jedno.
    const eligible1 = await insertFinding(programId, orgA, 'confirmed', { statement: 'Wskazane' });
    await insertFinding(programId, orgA, 'confirmed', { statement: 'NIE wskazane #1' });
    await insertFinding(programId, orgA, 'confirmed', { statement: 'NIE wskazane #2' });

    const proposals = await proposalService.draftProposalsFromFindings(orgA, actorFor(orgA), programId, {
      findingIds: [eligible1],
    });

    expect(proposals).toHaveLength(1);
    expect(proposals[0].sourceFindingIds).toEqual([eligible1]);

    const allProposalsForProgram = await proposalService.listProposals(orgA, { programId });
    expect(allProposalsForProgram).toHaveLength(1);
  });

  it('draft z filtrem: część ustaleń jest eligible a część nie — tylko eligible trafiają do propozycji', async () => {
    const programId = await makeProgram(orgA);
    const eligible = await insertFinding(programId, orgA, 'confirmed', { statement: 'Kwalifikuje się' });
    const notEligible = await insertFinding(programId, orgA, 'draft', { statement: 'Nie kwalifikuje się' });

    const proposals = await proposalService.draftProposalsFromFindings(orgA, actorFor(orgA), programId, {
      findingIds: [eligible, notEligible],
    });

    expect(proposals).toHaveLength(1);
    expect(proposals[0].sourceFindingIds).toEqual([eligible]);
  });

  it('suggestSystemicProposals grupuje po potwierdzonej przyczynie źródłowej i NIE zapisuje niczego', async () => {
    const programId = await makeProgram(orgA);
    await insertFinding(programId, orgA, 'confirmed', {
      statement: 'Ustalenie systemowe 1',
      rootCause: 'Brak szkolenia',
      rootCauseConfirmed: true,
    });
    await insertFinding(programId, orgA, 'confirmed', {
      statement: 'Ustalenie systemowe 2',
      rootCause: 'Brak szkolenia',
      rootCauseConfirmed: true,
    });
    // Przyczyna niepotwierdzona — nie powinna trafić do sugestii.
    await insertFinding(programId, orgA, 'confirmed', {
      statement: 'Ustalenie bez potwierdzonej przyczyny',
      rootCause: 'Podejrzewana przyczyna',
      rootCauseConfirmed: false,
    });

    const before = await proposalService.listProposals(orgA, { programId });
    const suggestions = await proposalService.suggestSystemicProposals(orgA, programId);
    const after = await proposalService.listProposals(orgA, { programId });

    expect(after).toHaveLength(before.length); // nic nie zostało zapisane
    const grouped = suggestions.find((s) => s.systemicCause === 'Brak szkolenia');
    expect(grouped).toBeDefined();
    expect(grouped?.sourceFindingIds).toHaveLength(2);
  });

  it('rejestracja jako inicjatywa woła kanoniczny kreator i zapisuje lineage (registered_initiative_id, registered_at)', async () => {
    const programId = await makeProgram(orgA);
    const f1 = await insertFinding(programId, orgA, 'confirmed', {
      statement: 'Brak MFA na kontach administracyjnych',
      severity: 'critical',
    });

    const [proposal] = await proposalService.draftProposalsFromFindings(orgA, actorFor(orgA), programId, {
      findingIds: [f1],
      title: 'Wdrożyć MFA dla kont administracyjnych',
    });

    const registered = await proposalService.registerAsInitiative(orgA, actorFor(orgA), proposal.id);
    expect(registered.status).toBe('registered');
    expect(registered.registeredInitiativeId).toBeTruthy();
    expect(registered.registeredAt).toBeTruthy();
    createdInitiativeIds.push(registered.registeredInitiativeId as string);

    const initiativeRow = await pool.query(`SELECT id, source_type, source_id, title FROM initiatives WHERE id=$1`, [
      registered.registeredInitiativeId,
    ]);
    expect(initiativeRow.rows).toHaveLength(1);
    expect(initiativeRow.rows[0].source_type).toBe('audit');
    expect(initiativeRow.rows[0].source_id).toBe(proposal.id);

    // Ponowna rejestracja tej samej propozycji jest zablokowana.
    await expect(proposalService.registerAsInitiative(orgA, actorFor(orgA), proposal.id)).rejects.toMatchObject({
      code: 'AUDIT_INVALID_STATE',
    });
  });

  it('izolacja organizacji — propozycje z org A są niewidoczne dla org B', async () => {
    const programA = await makeProgram(orgA);
    const f1 = await insertFinding(programA, orgA, 'confirmed', { statement: 'Ustalenie izolacja' });
    const [proposal] = await proposalService.draftProposalsFromFindings(orgA, actorFor(orgA), programA, {
      findingIds: [f1],
    });

    const fromOrgB = await proposalService.getProposal(orgB, proposal.id);
    expect(fromOrgB).toBeNull();

    const programB = await makeProgram(orgB);
    const listForOrgB = await proposalService.listProposals(orgB, { programId: programB });
    expect(listForOrgB).toHaveLength(0);
  });

  it('draft wymaga co najmniej jednego wskazanego findingId', async () => {
    const programId = await makeProgram(orgA);
    await expect(
      proposalService.draftProposalsFromFindings(orgA, actorFor(orgA), programId, { findingIds: [] }),
    ).rejects.toMatchObject({ code: 'AUDIT_PROPOSAL_NO_FINDINGS' });
  });
});

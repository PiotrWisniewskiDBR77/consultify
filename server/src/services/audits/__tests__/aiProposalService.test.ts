/**
 * aiProposalService.test — Intent → Preview → Confirmation → Commit → Settle
 * na REALNEJ PostgreSQL (patrz nagłówek zadania U6: bez RUN_DB_TESTS=1 +
 * MOCK_DB=false suita cicho zamockuje bazę i „przejdzie" nic nie testując).
 *
 * URUCHOM (z korzenia worktree, NIE z server/):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u6" \
 *   npx vitest run server/src/services/audits/__tests__/aiProposalService.test.ts
 *
 * `AI_PROVIDER_MODE=mock` wymusza tryb bez klucza dostawcy LLM — dokładnie ten
 * sam mechanizm co produkcyjny fallback, więc te testy dowodzą, że moduł
 * przechodzi bez klucza API, a nie tylko że "da się to skonfigurować".
 */

import { randomUUID } from 'crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import { auditGet, auditRun } from '../auditsDb.js';
import type { AuditActor } from '../types.js';
import * as aiProposalService from '../aiProposalService.js';

const REACHABLE =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && !!process.env.DATABASE_URL;

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    '[aiProposalService.test SKIPPED — clean skip, not a failure] needs NODE_ENV=test DB_TYPE=postgres ' +
      'RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<consultify_audits_u6>'
  );
}

const describeDb = REACHABLE ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function uid(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

async function seedProgram(organizationId: string, programId: string): Promise<void> {
  await auditRun(
    `INSERT INTO audit_programs (id, organization_id, name, status, lifecycle_state, created_by)
     VALUES ($1,$2,'U6 test program','active','fieldwork','seed')`,
    [programId, organizationId]
  );
}

async function addMember(
  organizationId: string,
  programId: string,
  userId: string,
  role: string
): Promise<void> {
  await auditRun(
    `INSERT INTO audit_program_members (id, program_id, organization_id, user_id, member_role)
     VALUES ($1,$2,$3,$4,$5)`,
    [uid('apm'), programId, organizationId, userId, role]
  );
}

async function seedCriterion(
  organizationId: string,
  programId: string,
  criterionId: string,
  overrides: Partial<{
    title: string;
    refCode: string;
    requirementText: string;
    auditQuestion: string;
    expectedEvidence: Array<Record<string, unknown>>;
    testResult: string | null;
    auditorConclusion: string | null;
    conformityStatus: string;
  }> = {}
): Promise<void> {
  await auditRun(
    `INSERT INTO audit_program_criteria
       (id, program_id, organization_id, ordinal, ref_code, title, requirement_text, audit_question,
        expected_evidence, test_result, auditor_conclusion, conformity_status, work_status)
     VALUES ($1,$2,$3,0,$4,$5,$6,$7,$8,$9,$10,$11,'open')`,
    [
      criterionId,
      programId,
      organizationId,
      overrides.refCode ?? 'A.1',
      overrides.title ?? 'Polityka bezpieczeństwa jest udokumentowana',
      overrides.requirementText ??
        'Organizacja musi posiadać udokumentowaną politykę bezpieczeństwa.',
      overrides.auditQuestion ?? 'Czy polityka bezpieczeństwa istnieje i jest zatwierdzona?',
      JSON.stringify(
        overrides.expectedEvidence ?? [
          {
            kind: 'document',
            description: 'Zatwierdzony dokument polityki bezpieczeństwa',
            mandatory: true,
          },
        ]
      ),
      overrides.testResult ?? null,
      overrides.auditorConclusion ?? null,
      overrides.conformityStatus ?? 'not_tested',
    ]
  );
}

async function seedEvidence(
  organizationId: string,
  programId: string,
  criterionId: string,
  title: string
): Promise<string> {
  const id = uid('aev');
  await auditRun(
    `INSERT INTO audit_evidence (id, program_id, organization_id, criterion_id, evidence_kind, title)
     VALUES ($1,$2,$3,$4,'document',$5)`,
    [id, programId, organizationId, criterionId, title]
  );
  return id;
}

async function seedFinding(
  organizationId: string,
  programId: string,
  criterionId: string | null,
  status = 'draft'
): Promise<string> {
  const id = uid('apf');
  await auditRun(
    `INSERT INTO audit_program_findings
       (id, program_id, organization_id, criterion_id, statement, classification, status)
     VALUES ($1,$2,$3,$4,'Wstępne ustalenie testowe','nonconforming',$5)`,
    [id, programId, organizationId, criterionId, status]
  );
  return id;
}

function actorFor(organizationId: string, userId: string): AuditActor {
  return { organizationId, userId };
}

describeDb('aiProposalService — Intent → Preview → Confirmation → Commit → Settle', () => {
  beforeAll(() => {
    // Wymuś tryb mock niezależnie od env poza tym procesem — generatory nie
    // mogą wykonać żadnego realnego wywołania sieciowego w testach.
    process.env.AI_PROVIDER_MODE = 'mock';
  });

  it('explain_criterion: buduje propozycję, wymaga decyzji przed commit, zapisuje auditor_note', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const criterionId = uid('crit');
    const leadAuditor = uid('user-lead');

    await seedProgram(organizationId, programId);
    await addMember(organizationId, programId, leadAuditor, 'lead_auditor');
    await seedCriterion(organizationId, programId, criterionId);

    const actor = actorFor(organizationId, leadAuditor);

    const created = await aiProposalService.createIntent(organizationId, actor, {
      programId,
      targetType: 'criterion',
      targetId: criterionId,
      intent: 'explain_criterion',
      context: {},
    });

    expect(created.status).toBe('pending');
    expect(created.sources.length).toBeGreaterThan(0);
    expect(String((created.proposal as any).explanation)).toContain('Polityka bezpieczeństwa');
    expect(created.rationale).toContain('TRYB MOCK');

    // commit przed decyzją człowieka musi się nie udać.
    await expect(aiProposalService.commit(organizationId, actor, created.id)).rejects.toThrow(
      /zaakceptowan/i
    );

    const decided = await aiProposalService.decide(organizationId, actor, created.id, {
      decision: 'accept',
      note: 'wygląda dobrze',
    });
    expect(decided.status).toBe('accepted');

    const committed = await aiProposalService.commit(organizationId, actor, created.id);
    expect(committed.committedAt).toBeTruthy();

    const criterionRow = await auditGet<{ auditor_note: string | null }>(
      `SELECT auditor_note FROM audit_program_criteria WHERE organization_id=$1 AND id=$2`,
      [organizationId, criterionId]
    );
    expect(criterionRow?.auditor_note).toContain('[Teresa]');
    expect(criterionRow?.auditor_note).toContain('Polityka bezpieczeństwa');

    // Powtórny commit tej samej propozycji musi się nie udać.
    await expect(aiProposalService.commit(organizationId, actor, created.id)).rejects.toThrow(
      /już wykonana/i
    );
  });

  it('draft_evidence_request: commit tworzy wiersz audit_evidence_requests i przestawia work_status', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const criterionId = uid('crit');
    const auditor = uid('user-auditor');

    await seedProgram(organizationId, programId);
    await addMember(organizationId, programId, auditor, 'lead_auditor');
    await seedCriterion(organizationId, programId, criterionId);

    const actor = actorFor(organizationId, auditor);
    const created = await aiProposalService.createIntent(organizationId, actor, {
      programId,
      targetType: 'evidence_request',
      targetId: criterionId,
      intent: 'draft_evidence_request',
      context: {},
    });
    expect((created.proposal as any).title).toContain('Dowód dla:');

    await aiProposalService.decide(organizationId, actor, created.id, { decision: 'accept' });
    await aiProposalService.commit(organizationId, actor, created.id);

    const requestRow = await auditGet<{ id: string; criterion_id: string; status: string }>(
      `SELECT id, criterion_id, status FROM audit_evidence_requests WHERE organization_id=$1 AND criterion_id=$2`,
      [organizationId, criterionId]
    );
    expect(requestRow?.status).toBe('open');

    const criterionRow = await auditGet<{ work_status: string }>(
      `SELECT work_status FROM audit_program_criteria WHERE organization_id=$1 AND id=$2`,
      [organizationId, criterionId]
    );
    expect(criterionRow?.work_status).toBe('evidence_requested');
  });

  it('draft_finding: wymaga wykonanego testu, zawiera rozdzielone pola i tworzy nowe ustalenie ai_proposed', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const criterionId = uid('crit');
    const auditor = uid('user-auditor');

    await seedProgram(organizationId, programId);
    await addMember(organizationId, programId, auditor, 'auditor');
    await seedCriterion(organizationId, programId, criterionId, { testResult: null });

    const actor = actorFor(organizationId, auditor);

    // Bez wykonanego testu — generator musi odmówić.
    await expect(
      aiProposalService.createIntent(organizationId, actor, {
        programId,
        targetType: 'finding',
        targetId: criterionId,
        intent: 'draft_finding',
        context: {},
      })
    ).rejects.toThrow(/wykonanego testu/i);

    await auditRun(
      `UPDATE audit_program_criteria
          SET test_result='fail', auditor_conclusion='Brak zatwierdzonego dokumentu polityki w repozytorium',
              conformity_status='nonconforming'
        WHERE organization_id=$1 AND id=$2`,
      [organizationId, criterionId]
    );
    const evidenceId = await seedEvidence(
      organizationId,
      programId,
      criterionId,
      'Zrzut repozytorium dokumentów'
    );

    const created = await aiProposalService.createIntent(organizationId, actor, {
      programId,
      targetType: 'finding',
      targetId: criterionId,
      intent: 'draft_finding',
      context: {},
    });

    const proposal = created.proposal as any;
    expect(proposal.requirementText).toContain('polityk');
    expect(proposal.conditionText).toContain('Brak zatwierdzonego dokumentu');
    expect(proposal.gapText).toBeTruthy();
    expect(proposal.objectiveEvidence).toContain(evidenceId);
    // Cztery pola rozdzielne — zlanie ich w jedną "odpowiedź" jest zakazane.
    expect(String(proposal.statement)).toMatch(/Stan oczekiwany/);
    expect(String(proposal.statement)).toMatch(/Stan stwierdzony/);
    expect(String(proposal.statement)).toMatch(/Luka/);

    await aiProposalService.decide(organizationId, actor, created.id, { decision: 'accept' });
    await aiProposalService.commit(organizationId, actor, created.id);

    const findingRow = await auditGet<{
      ai_proposed: boolean;
      ai_rationale: string | null;
      status: string;
    }>(
      `SELECT ai_proposed, ai_rationale, status FROM audit_program_findings WHERE organization_id=$1 AND criterion_id=$2`,
      [organizationId, criterionId]
    );
    expect(findingRow?.ai_proposed).toBe(true);
    expect(findingRow?.ai_rationale).toBeTruthy();
    expect(findingRow?.status).toBe('draft');
  });

  it('propose_corrective_options: commit tworzy 2-3 akcje w statusie proposed, rozróżniając correction i corrective_action', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const auditor = uid('user-auditor');

    await seedProgram(organizationId, programId);
    // lead_auditor: jedyna rola łącząca ai.commit i action.approve — patrz
    // komentarz przy INTENT_CAPABILITY w aiProposalService.ts.
    await addMember(organizationId, programId, auditor, 'lead_auditor');
    const findingId = await seedFinding(organizationId, programId, null);
    await auditRun(
      `UPDATE audit_program_findings SET gap_text='Brak zatwierdzonej polityki bezpieczeństwa' WHERE id=$1`,
      [findingId]
    );

    const actor = actorFor(organizationId, auditor);
    const created = await aiProposalService.createIntent(organizationId, actor, {
      programId,
      targetType: 'corrective_action',
      targetId: findingId,
      intent: 'propose_corrective_options',
      context: {},
    });
    const options = (created.proposal as any).options as Array<{ actionKind: string }>;
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options.some((o) => o.actionKind === 'correction')).toBe(true);
    expect(options.some((o) => o.actionKind === 'corrective_action')).toBe(true);

    await aiProposalService.decide(organizationId, actor, created.id, { decision: 'accept' });
    await aiProposalService.commit(organizationId, actor, created.id);

    const rows = await auditGet<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_corrective_actions WHERE organization_id=$1 AND finding_id=$2 AND status='proposed'`,
      [organizationId, findingId]
    );
    expect(Number(rows?.count)).toBe(options.length);
  });

  it('draft_report_section: commit zapisuje sekcję w payload raportu w statusie draft', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const auditor = uid('user-auditor');

    await seedProgram(organizationId, programId);
    await addMember(organizationId, programId, auditor, 'lead_auditor');
    const findingId = await seedFinding(organizationId, programId, null, 'confirmed');
    await auditRun(
      `UPDATE audit_program_findings SET statement='Brak zatwierdzonej polityki bezpieczeństwa', severity='high', reference_code='F-1' WHERE id=$1`,
      [findingId]
    );

    const reportId = uid('arep');
    await auditRun(
      `INSERT INTO audit_reports (id, program_id, organization_id, title, status, payload)
       VALUES ($1,$2,$3,'Raport testowy','draft','{}'::jsonb)`,
      [reportId, programId, organizationId]
    );

    const actor = actorFor(organizationId, auditor);
    const created = await aiProposalService.createIntent(organizationId, actor, {
      programId,
      targetType: 'report_section',
      targetId: reportId,
      intent: 'draft_report_section',
      context: { sectionKey: 'findings_summary' },
    });
    expect(String((created.proposal as any).content)).toContain('F-1');

    await aiProposalService.decide(organizationId, actor, created.id, { decision: 'accept' });
    await aiProposalService.commit(organizationId, actor, created.id);

    const reportRow = await auditGet<{ payload: unknown }>(
      `SELECT payload FROM audit_reports WHERE organization_id=$1 AND id=$2`,
      [organizationId, reportId]
    );
    const payload =
      typeof reportRow?.payload === 'string' ? JSON.parse(reportRow.payload) : reportRow?.payload;
    expect(payload?.sections?.findings_summary?.content).toContain('F-1');
    expect(payload?.sections?.findings_summary?.aiProposed).toBe(true);
  });

  it('detectEvidenceGaps: wykrywa kryteria bez dowodu, dowody starsze niż zakres audytu i sprzeczne dowody', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');

    await auditRun(
      `INSERT INTO audit_programs (id, organization_id, name, status, lifecycle_state, planned_start, planned_end, created_by)
       VALUES ($1,$2,'U6 gaps program','active','fieldwork','2026-01-01','2026-06-30','seed')`,
      [programId, organizationId]
    );

    const criterionNoEvidence = uid('crit');
    await seedCriterion(organizationId, programId, criterionNoEvidence, { refCode: 'B.1' });

    const criterionOutdated = uid('crit');
    await seedCriterion(organizationId, programId, criterionOutdated, { refCode: 'B.2' });
    await auditRun(
      `INSERT INTO audit_evidence (id, program_id, organization_id, criterion_id, evidence_kind, title, period_to)
       VALUES ($1,$2,$3,$4,'document','Dowód sprzed okresu audytu','2024-01-01')`,
      [uid('aev'), programId, organizationId, criterionOutdated]
    );

    const criterionContradicting = uid('crit');
    await seedCriterion(organizationId, programId, criterionContradicting, { refCode: 'B.3' });
    await auditRun(
      `INSERT INTO audit_evidence (id, program_id, organization_id, criterion_id, evidence_kind, title, supports_conformity)
       VALUES ($1,$2,$3,$4,'document','Dowód A — potwierdza',TRUE)`,
      [uid('aev'), programId, organizationId, criterionContradicting]
    );
    await auditRun(
      `INSERT INTO audit_evidence (id, program_id, organization_id, criterion_id, evidence_kind, title, supports_conformity)
       VALUES ($1,$2,$3,$4,'document','Dowód B — przeczy',FALSE)`,
      [uid('aev'), programId, organizationId, criterionContradicting]
    );

    const result = await aiProposalService.detectEvidenceGaps(organizationId, programId);
    const proposal = result.proposal as any;

    expect(proposal.criteriaWithoutEvidence.some((c: any) => c.id === criterionNoEvidence)).toBe(
      true
    );
    expect(proposal.outdatedEvidence.some((e: any) => e.criterion_id === criterionOutdated)).toBe(
      true
    );
    expect(
      proposal.contradictingEvidence.some((c: any) => c.criterionId === criterionContradicting)
    ).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it('listProposals / getProposal / settle: propozycje konkurencyjne dla tego samego targetu stają się superseded', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const criterionId = uid('crit');
    const auditor = uid('user-auditor');

    await seedProgram(organizationId, programId);
    await addMember(organizationId, programId, auditor, 'lead_auditor');
    await seedCriterion(organizationId, programId, criterionId);

    const actor = actorFor(organizationId, auditor);
    const first = await aiProposalService.createIntent(organizationId, actor, {
      programId,
      targetType: 'criterion',
      targetId: criterionId,
      intent: 'explain_criterion',
      context: {},
    });
    const second = await aiProposalService.createIntent(organizationId, actor, {
      programId,
      targetType: 'criterion',
      targetId: criterionId,
      intent: 'explain_criterion',
      context: {},
    });

    const listed = await aiProposalService.listProposals(organizationId, { programId });
    expect(listed.map((p) => p.id).sort()).toEqual([first.id, second.id].sort());

    await aiProposalService.settle(organizationId, second.id);

    const firstAfter = await aiProposalService.getProposal(organizationId, first.id);
    const secondAfter = await aiProposalService.getProposal(organizationId, second.id);
    expect(firstAfter.status).toBe('superseded');
    expect(secondAfter.status).toBe('pending');
  });
});

/**
 * auditTrailService.test — ścieżka audytowa domeny i kontrola niezależności,
 * na REALNEJ PostgreSQL.
 *
 * URUCHOM (z korzenia worktree, NIE z server/):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u6" \
 *   npx vitest run server/src/services/audits/__tests__/auditTrailService.test.ts
 */

import { randomUUID } from 'crypto';

import { describe, expect, it } from 'vitest';

import * as auditTrailService from '../auditTrailService.js';
import { auditRun, recordAuditEvent } from '../auditsDb.js';

const REACHABLE =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && !!process.env.DATABASE_URL;

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    '[auditTrailService.test SKIPPED — clean skip, not a failure] needs NODE_ENV=test DB_TYPE=postgres ' +
      'RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<consultify_audits_u6>'
  );
}

const describeDb = REACHABLE ? describe : describe.skip;

function uid(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

async function seedProgram(organizationId: string, programId: string): Promise<void> {
  await auditRun(
    `INSERT INTO audit_programs (id, organization_id, name, status, lifecycle_state, created_by)
     VALUES ($1,$2,'U6 trail program','active','fieldwork','seed')`,
    [programId, organizationId]
  );
}

describeDb('auditTrailService — ścieżka audytowa domeny', () => {
  it('getEntityHistory: pełna historia jednego obiektu w porządku chronologicznym', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const entityId = uid('crit');
    await seedProgram(organizationId, programId);

    await recordAuditEvent({
      organizationId,
      programId,
      entityType: 'criterion',
      entityId,
      eventType: 'criterion.evidence_requested',
      actorId: 'user-1',
      summary: 'Poproszono o dowód',
      payload: {},
    });
    await new Promise((r) => setTimeout(r, 5));
    await recordAuditEvent({
      organizationId,
      programId,
      entityType: 'criterion',
      entityId,
      eventType: 'criterion.tested',
      actorId: 'user-2',
      summary: 'Wykonano test',
      payload: {},
    });
    await new Promise((r) => setTimeout(r, 5));
    await recordAuditEvent({
      organizationId,
      programId,
      entityType: 'criterion',
      entityId,
      eventType: 'criterion.concluded',
      actorId: 'user-2',
      summary: 'Wyciągnięto wniosek',
      payload: {},
    });

    // Zdarzenie innej encji w tym samym programie nie może wyciekać do historii.
    await recordAuditEvent({
      organizationId,
      programId,
      entityType: 'criterion',
      entityId: uid('other-crit'),
      eventType: 'criterion.tested',
      actorId: 'user-3',
      summary: 'Inne kryterium',
      payload: {},
    });

    const history = await auditTrailService.getEntityHistory(organizationId, 'criterion', entityId);
    expect(history.map((e) => e.eventType)).toEqual([
      'criterion.evidence_requested',
      'criterion.tested',
      'criterion.concluded',
    ]);
    for (let i = 1; i < history.length; i += 1) {
      expect(new Date(history[i].occurredAt).getTime()).toBeGreaterThanOrEqual(
        new Date(history[i - 1].occurredAt).getTime()
      );
    }
  });

  it('listEvents: filtruje po programie, typie encji i paginuje', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const otherProgramId = uid('prog-other');
    await seedProgram(organizationId, programId);
    await seedProgram(organizationId, otherProgramId);

    for (let i = 0; i < 5; i += 1) {
      await recordAuditEvent({
        organizationId,
        programId,
        entityType: 'criterion',
        entityId: uid('crit'),
        eventType: 'criterion.tested',
        payload: {},
      });
    }
    // Szum z innego programu tej samej organizacji — nie powinien wyciekać.
    await recordAuditEvent({
      organizationId,
      programId: otherProgramId,
      entityType: 'criterion',
      entityId: uid('crit'),
      eventType: 'criterion.tested',
      payload: {},
    });

    const page1 = await auditTrailService.listEvents(organizationId, {
      programId,
      limit: 2,
      offset: 0,
    });
    expect(page1.total).toBe(5);
    expect(page1.items.length).toBe(2);

    const all = await auditTrailService.listEvents(organizationId, {
      programId,
      limit: 200,
      offset: 0,
    });
    expect(all.items.length).toBe(5);
    expect(all.items.every((e) => e.eventType === 'criterion.tested')).toBe(true);
  });

  it('getProgramTimeline: grupuje zdarzenia po etapie lifecycle z payload.to', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    await seedProgram(organizationId, programId);

    await recordAuditEvent({
      organizationId,
      programId,
      entityType: 'program',
      entityId: programId,
      eventType: 'program.created',
      payload: {},
    });
    await recordAuditEvent({
      organizationId,
      programId,
      entityType: 'program',
      entityId: programId,
      eventType: 'program.lifecycle_transition',
      payload: { to: 'fieldwork' },
    });
    await recordAuditEvent({
      organizationId,
      programId,
      entityType: 'criterion',
      entityId: uid('crit'),
      eventType: 'criterion.tested',
      payload: {},
    });

    const timeline = await auditTrailService.getProgramTimeline(organizationId, programId);
    expect(timeline[0].stage).toBe('planning');
    expect(timeline[0].events[0].eventType).toBe('program.created');
    const fieldworkGroup = timeline.find((g) => g.stage === 'fieldwork');
    expect(fieldworkGroup).toBeTruthy();
    expect(fieldworkGroup?.events.some((e) => e.eventType === 'criterion.tested')).toBe(true);
  });

  it('exportTrail: struktura kto/co/kiedy/w jakiej roli, w porządku chronologicznym', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    await seedProgram(organizationId, programId);

    await recordAuditEvent({
      organizationId,
      programId,
      entityType: 'finding',
      entityId: uid('finding'),
      eventType: 'finding.confirmed',
      actorId: 'user-lead',
      actorRole: 'lead_auditor',
      summary: 'Ustalenie potwierdzone',
      payload: {},
    });

    const trail = await auditTrailService.exportTrail(organizationId, programId);
    expect(trail.programId).toBe(programId);
    expect(trail.entries.length).toBe(1);
    expect(trail.entries[0]).toMatchObject({
      who: 'user-lead',
      role: 'lead_auditor',
      what: 'finding.confirmed',
    });
  });

  describe('getIndependenceReport — raport wykrywający, uruchamiany na danych', () => {
    it('wykrywa osobę, która odpowiadała jako auditee i sama wyciągnęła wniosek dla tego samego kryterium', async () => {
      const organizationId = uid('org');
      const programId = uid('prog');
      const criterionId = uid('crit');
      const person = uid('user-same-person');
      await seedProgram(organizationId, programId);

      // Naruszenie zasiane WPROST w tabeli — dokładnie scenariusz z zadania:
      // "ma znaleźć naruszenia nawet jeśli powstały poza API".
      await auditRun(
        `INSERT INTO audit_program_criteria
           (id, program_id, organization_id, ordinal, ref_code, title, work_status,
            auditee_responded_by, concluded_by, conformity_status)
         VALUES ($1,$2,$3,0,'C.1','Kryterium ze skażoną niezależnością','concluded',$4,$4,'conforming')`,
        [criterionId, programId, organizationId, person]
      );

      const report = await auditTrailService.getIndependenceReport(organizationId, programId);
      expect(report.programId).toBe(programId);
      const violation = report.violations.find((v) => v.kind === 'criterion_self_conclusion');
      expect(violation).toBeTruthy();
      expect(violation?.entityId).toBe(criterionId);
      expect(violation?.personId).toBe(person);
    });

    it('wykrywa właściciela działania, który sam zweryfikował jego skuteczność', async () => {
      const organizationId = uid('org');
      const programId = uid('prog');
      const findingId = uid('finding');
      const actionId = uid('action');
      const person = uid('user-same-person');
      await seedProgram(organizationId, programId);

      await auditRun(
        `INSERT INTO audit_program_findings (id, program_id, organization_id, statement, classification, status)
         VALUES ($1,$2,$3,'Ustalenie testowe','nonconforming','remediation_in_progress')`,
        [findingId, programId, organizationId]
      );
      await auditRun(
        `INSERT INTO audit_corrective_actions
           (id, finding_id, program_id, organization_id, action_kind, title, owner_user_id, status)
         VALUES ($1,$2,$3,$4,'corrective_action','Działanie testowe',$5,'implemented')`,
        [actionId, findingId, programId, organizationId, person]
      );
      await auditRun(
        `INSERT INTO audit_verifications
           (id, corrective_action_id, finding_id, program_id, organization_id, verification_kind, performed_by, result)
         VALUES ($1,$2,$3,$4,$5,'effectiveness',$6,'effective')`,
        [uid('averif'), actionId, findingId, programId, organizationId, person]
      );

      const report = await auditTrailService.getIndependenceReport(organizationId, programId);
      const violation = report.violations.find((v) => v.kind === 'action_self_verification');
      expect(violation).toBeTruthy();
      expect(violation?.entityId).toBe(actionId);
      expect(violation?.personId).toBe(person);
    });

    it('wykrywa autora ustalenia, który sam był jego recenzentem', async () => {
      const organizationId = uid('org');
      const programId = uid('prog');
      const findingId = uid('finding');
      const person = uid('user-same-person');
      await seedProgram(organizationId, programId);

      await auditRun(
        `INSERT INTO audit_program_findings
           (id, program_id, organization_id, statement, classification, status, author_id, reviewed_by)
         VALUES ($1,$2,$3,'Ustalenie recenzowane przez autora','nonconforming','in_review',$4,$4)`,
        [findingId, programId, organizationId, person]
      );

      const report = await auditTrailService.getIndependenceReport(organizationId, programId);
      const violation = report.violations.find((v) => v.kind === 'finding_self_review');
      expect(violation).toBeTruthy();
      expect(violation?.entityId).toBe(findingId);
      expect(violation?.personId).toBe(person);
    });

    it('nie zgłasza naruszenia, gdy role są poprawnie rozdzielone', async () => {
      const organizationId = uid('org');
      const programId = uid('prog');
      const criterionId = uid('crit');
      await seedProgram(organizationId, programId);
      await auditRun(
        `INSERT INTO audit_program_criteria
           (id, program_id, organization_id, ordinal, ref_code, title, work_status,
            auditee_responded_by, concluded_by, conformity_status)
         VALUES ($1,$2,$3,0,'C.2','Kryterium z poprawną niezależnością','concluded','user-a','user-b','conforming')`,
        [criterionId, programId, organizationId]
      );

      const report = await auditTrailService.getIndependenceReport(organizationId, programId);
      expect(report.violations.some((v) => v.entityId === criterionId)).toBe(false);
    });

    it('izolacja organizacji: naruszenie w organizacji A nie wycieka do raportu organizacji B', async () => {
      const orgA = uid('org-a');
      const orgB = uid('org-b');
      const programA = uid('prog-a');
      const programB = uid('prog-b');
      const criterionA = uid('crit-a');
      const person = uid('user-same-person');

      await seedProgram(orgA, programA);
      await seedProgram(orgB, programB);
      await auditRun(
        `INSERT INTO audit_program_criteria
           (id, program_id, organization_id, ordinal, ref_code, title, work_status,
            auditee_responded_by, concluded_by, conformity_status)
         VALUES ($1,$2,$3,0,'D.1','Kryterium organizacji A','concluded',$4,$4,'conforming')`,
        [criterionA, programA, orgA, person]
      );

      const reportA = await auditTrailService.getIndependenceReport(orgA, programA);
      expect(reportA.violations.length).toBe(1);

      const reportB = await auditTrailService.getIndependenceReport(orgB, programB);
      expect(reportB.violations.length).toBe(0);
    });
  });
});

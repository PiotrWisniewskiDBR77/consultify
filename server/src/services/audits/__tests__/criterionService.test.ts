/**
 * criterionService — testy przeciw REALNEJ bazie Postgres (U3, blok E).
 *
 * URUCHOMIENIE (z korzenia worktree, NIE z `server/`):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u3" \
 *   npx vitest run server/src/services/audits/__tests__/criterionService.test.ts
 *
 * Pokrywa z listy E zadania U3:
 *   E.3 — concludeCriterion odrzuca wniosek bez wykonanego testu.
 *   E.4 — concludeCriterion odrzuca 'conforming' bez zaakceptowanego dowodu.
 *   E.5 — osoba, która odpowiedziała jako audytowany, nie może wyciągnąć
 *         wniosku dla tego kryterium (deny-path), NAWET gdy ma też rolę
 *         audytową dającą capability `criterion.conclude`.
 *   E.6 — osoba bez roli audytowej w programie dostaje odmowę na `recordTest`
 *         (deny-path).
 *
 * Dodatkowo: happy-path (test wykonany + dowód zaakceptowany → 'conforming'
 * się udaje) — negatywna kontrola pokazująca, że reguły E.3/E.4 rzeczywiście
 * BLOKUJĄ, a nie że funkcja zawsze odrzuca.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG) {
  process.env.DB_TYPE = 'postgres';
}

const suite = REAL_PG ? describe : describe.skip;

if (!REAL_PG) {
  // eslint-disable-next-line no-console
  console.warn(
    '[criterionService.test.ts SKIPPED — clean skip, not a failure] wymaga NODE_ENV=test DB_TYPE=postgres ' +
      'RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://...',
  );
}

suite('criterionService (Postgres realny — U3)', () => {
  let auditsDb: typeof import('../auditsDb.js');
  let programService: typeof import('../programService.js');
  let criterionService: typeof import('../criterionService.js');
  let evidenceService: typeof import('../evidenceService.js');

  const orgId = `u3-crit-org-${randomUUID()}`;
  const adminActor = { userId: `u3-crit-admin-${randomUUID()}`, organizationId: orgId, platformRole: 'admin' as const };
  const leadAuditorUserId = `u3-crit-lead-${randomUUID()}`;
  const auditeeUserId = `u3-crit-auditee-${randomUUID()}`;
  const noRoleUserId = `u3-crit-norole-${randomUUID()}`;
  const dualRoleUserId = `u3-crit-dual-${randomUUID()}`;

  const leadAuditorActor = { userId: leadAuditorUserId, organizationId: orgId };
  const auditeeActor = { userId: auditeeUserId, organizationId: orgId };
  const noRoleActor = { userId: noRoleUserId, organizationId: orgId };
  const dualRoleActor = { userId: dualRoleUserId, organizationId: orgId };

  let packId: string;
  let programId: string;
  /** ref_code → id kryterium w programie (jeden program, po jednym kryterium na scenariusz). */
  const criterionIdByRef: Record<string, string> = {};

  async function insertPackLeaf(refCode: string, ordinal: number): Promise<string> {
    const id = `u3critpkc_${randomUUID()}`;
    await auditsDb.auditRun(
      `INSERT INTO audit_pack_criteria
         (id, pack_id, parent_id, ordinal, ref_code, node_kind, title, requirement_text,
          audit_question, expected_evidence, mandatory)
       VALUES ($1,$2,NULL,$3,$4,'criterion',$5,'Wymaganie testowe','Pytanie testowe','[]'::jsonb,true)`,
      [id, packId, ordinal, refCode, `Kryterium ${refCode}`],
    );
    return id;
  }

  beforeAll(async () => {
    auditsDb = await import('../auditsDb.js');
    programService = await import('../programService.js');
    criterionService = await import('../criterionService.js');
    evidenceService = await import('../evidenceService.js');

    packId = `u3critpk_${randomUUID()}`;
    await auditsDb.auditRun(
      `INSERT INTO audit_packs
         (id, organization_id, pack_key, version, title, classification, publication_status,
          finding_taxonomy, required_roles, expert_approved_by, expert_approved_at,
          published_by, published_at, created_at, updated_at)
       VALUES ($1,$2,$3,1,$4,'DEMONSTRATION','published',$5,$6,'u3-tester',NOW(),'u3-tester',NOW(),NOW(),NOW())`,
      [
        packId,
        orgId,
        `u3-crit-pack-key-${packId}`,
        'Pakiet testowy U3 — criterionService',
        JSON.stringify([
          { key: 'nonconforming', label: 'Niezgodność', nonConforming: true, requiresCorrectiveAction: true },
        ]),
        JSON.stringify(['lead_auditor', 'auditor', 'auditee']),
      ],
    );

    await insertPackLeaf('T1-no-test', 1);
    await insertPackLeaf('T2-no-evidence', 2);
    await insertPackLeaf('T3-self-conclude', 3);
    await insertPackLeaf('T4-no-role', 4);
    await insertPackLeaf('T5-happy-path', 5);

    const detail = await programService.createProgramFromPack(orgId, adminActor, {
      packId,
      name: 'Program testowy criterionService',
    });
    programId = detail.program.id;

    const rows = await auditsDb.auditAll<{ id: string; ref_code: string }>(
      `SELECT id, ref_code FROM audit_program_criteria WHERE program_id = $1`,
      [programId],
    );
    for (const r of rows) criterionIdByRef[r.ref_code] = r.id;

    await programService.addMember(orgId, adminActor, programId, {
      userId: leadAuditorUserId,
      memberRole: 'lead_auditor',
    });
    await programService.addMember(orgId, adminActor, programId, {
      userId: auditeeUserId,
      memberRole: 'auditee',
    });
    // dualRoleUser jest RÓWNOCZEŚNIE auditee i lead_auditor — reguła segregacji
    // obowiązków (assertNotConcludingOwnResponse) musi zablokować mimo capability
    // `criterion.conclude` z drugiej roli.
    await programService.addMember(orgId, adminActor, programId, {
      userId: dualRoleUserId,
      memberRole: 'auditee',
    });
    await programService.addMember(orgId, adminActor, programId, {
      userId: dualRoleUserId,
      memberRole: 'lead_auditor',
    });
  });

  afterAll(async () => {
    if (!auditsDb) return;
    await auditsDb.auditRun(`DELETE FROM audit_evidence WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_program_members WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_program_criteria WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_programs WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_pack_criteria WHERE pack_id = $1`, [packId]);
    await auditsDb.auditRun(`DELETE FROM audit_packs WHERE id = $1`, [packId]);
  });

  it("E.3 — concludeCriterion odrzuca wniosek 'nonconforming'/'conforming' bez wykonanego testu", async () => {
    const criterionId = criterionIdByRef['T1-no-test'];
    expect(criterionId).toBeTruthy();

    await expect(
      criterionService.concludeCriterion(orgId, leadAuditorActor, criterionId, {
        conformityStatus: 'nonconforming',
        auditorConclusion: 'Próbuję bez testu',
      }),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_STATE' });

    await expect(
      criterionService.concludeCriterion(orgId, leadAuditorActor, criterionId, {
        conformityStatus: 'conforming',
        auditorConclusion: 'Próbuję bez testu',
      }),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_STATE' });

    // Wyjątek z zadania: 'evidence_insufficient' NIE wymaga testu — musi przejść.
    const concluded = await criterionService.concludeCriterion(orgId, leadAuditorActor, criterionId, {
      conformityStatus: 'evidence_insufficient',
      auditorConclusion: 'Za mało danych, bez testu',
    });
    expect(concluded.conformityStatus).toBe('evidence_insufficient');
  });

  it("E.4 — concludeCriterion odrzuca 'conforming' bez zaakceptowanego dowodu (mimo wykonanego testu)", async () => {
    const criterionId = criterionIdByRef['T2-no-evidence'];
    expect(criterionId).toBeTruthy();

    await criterionService.recordTest(orgId, leadAuditorActor, criterionId, {
      procedurePerformed: 'Przegląd dokumentacji',
      testPerformed: 'Sprawdzono politykę',
      testResult: 'pass',
    });

    await expect(
      criterionService.concludeCriterion(orgId, leadAuditorActor, criterionId, {
        conformityStatus: 'conforming',
        auditorConclusion: 'Test wykonany, ale brak dowodu',
      }),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_STATE' });

    // 'nonconforming' NIE wymaga zaakceptowanego dowodu (tylko 'conforming') — musi przejść.
    const concluded = await criterionService.concludeCriterion(orgId, leadAuditorActor, criterionId, {
      conformityStatus: 'nonconforming',
      auditorConclusion: 'Test wykonany, wynik negatywny',
    });
    expect(concluded.conformityStatus).toBe('nonconforming');
  });

  it('E.5 — audytowany, który sam odpowiedział, nie może wyciągnąć wniosku dla tego kryterium (deny-path)', async () => {
    const criterionId = criterionIdByRef['T3-self-conclude'];
    expect(criterionId).toBeTruthy();

    await criterionService.submitAuditeeResponse(
      orgId,
      dualRoleActor,
      criterionId,
      'Odpowiedź audytowanego (ta sama osoba ma też rolę lead_auditor)',
    );

    // dualRoleActor MA capability criterion.conclude (rola lead_auditor) — użyto
    // 'observation', żeby nie mieszać tej reguły z regułą E.3 (test wymagany
    // tylko dla conforming/nonconforming). Blokerem musi być WYŁĄCZNIE
    // segregacja obowiązków.
    await expect(
      criterionService.concludeCriterion(orgId, dualRoleActor, criterionId, {
        conformityStatus: 'observation',
        auditorConclusion: 'Próbuję zamknąć własną odpowiedź',
      }),
    ).rejects.toMatchObject({ code: 'AUDIT_FORBIDDEN' });

    // Inna osoba z rolą audytową (leadAuditorActor) MOŻE wyciągnąć wniosek.
    const concluded = await criterionService.concludeCriterion(orgId, leadAuditorActor, criterionId, {
      conformityStatus: 'observation',
      auditorConclusion: 'Niezależny wniosek innej osoby',
    });
    expect(concluded.conformityStatus).toBe('observation');
  });

  it('E.6 — osoba bez roli audytowej w programie dostaje odmowę na recordTest (deny-path)', async () => {
    const criterionId = criterionIdByRef['T4-no-role'];
    expect(criterionId).toBeTruthy();

    await expect(
      criterionService.recordTest(orgId, noRoleActor, criterionId, {
        testPerformed: 'Próba bez roli',
        testResult: 'pass',
      }),
    ).rejects.toMatchObject({ code: 'AUDIT_FORBIDDEN' });

    // Negatywna kontrola: ta sama osoba z rolą audytową (leadAuditorActor) — dozwolone.
    const tested = await criterionService.recordTest(orgId, leadAuditorActor, criterionId, {
      testPerformed: 'Wykonano z właściwą rolą',
      testResult: 'pass',
    });
    expect(tested.workStatus).toBe('tested');
  });

  it('happy-path — test wykonany + dowód zaakceptowany → conforming się udaje (dowód, że reguły E.3/E.4 realnie bramkują)', async () => {
    const criterionId = criterionIdByRef['T5-happy-path'];
    expect(criterionId).toBeTruthy();

    await criterionService.recordTest(orgId, leadAuditorActor, criterionId, {
      procedurePerformed: 'Przegląd dokumentacji',
      testPerformed: 'Sprawdzono politykę',
      testResult: 'pass',
    });

    const evidence = await evidenceService.submitEvidence(orgId, auditeeActor, {
      programId,
      criterionId,
      kind: 'document',
      title: 'Polityka bezpieczeństwa v3',
      contentSnapshot: 'treść polityki...',
    });
    await evidenceService.reviewEvidence(orgId, leadAuditorActor, evidence.id, {
      sufficiency: 'sufficient',
      reliability: 'reliable',
      currencyStatus: 'current',
      supportsConformity: true,
      accepted: true,
    });

    const concluded = await criterionService.concludeCriterion(orgId, leadAuditorActor, criterionId, {
      conformityStatus: 'conforming',
      auditorConclusion: 'Test wykonany, dowód zaakceptowany',
    });
    expect(concluded.conformityStatus).toBe('conforming');
  });
});

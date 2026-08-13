/**
 * programService — testy przeciw REALNEJ bazie Postgres (U3, blok E).
 *
 * URUCHOMIENIE (z korzenia worktree, NIE z `server/`):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u3" \
 *   npx vitest run server/src/services/audits/__tests__/programService.test.ts
 *
 * Pokrywa z listy E zadania U3:
 *   E.1 — createProgramFromPack robi snapshot kryteriów i zachowuje hierarchię parent.
 *   E.2 — zmiana pakietu PO utworzeniu programu NIE zmienia kryteriów programu.
 *   E.7 — izolacja organizacji: program org A niewidoczny/niemodyfikowalny z org B.
 *
 * Dane testowe (pakiet + kryteria) wstawiane bezpośrednio SQL-em — U3 nie
 * zależy od packService/packSeed (własność U2).
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
    '[programService.test.ts SKIPPED — clean skip, not a failure] wymaga NODE_ENV=test DB_TYPE=postgres ' +
      'RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://... (patrz komentarz na górze pliku)',
  );
}

suite('programService (Postgres realny — U3)', () => {
  let auditsDb: typeof import('../auditsDb.js');
  let programService: typeof import('../programService.js');

  const orgA = `u3-prog-org-a-${randomUUID()}`;
  const orgB = `u3-prog-org-b-${randomUUID()}`;
  const adminActor = { userId: `u3-admin-${randomUUID()}`, organizationId: orgA, platformRole: 'admin' as const };

  let packId: string;
  let rootCriterionId: string;
  let childCriterionId: string;
  const ORIGINAL_REQUIREMENT_TEXT = 'Wymaganie testowe v1 — nie ruszać';

  beforeAll(async () => {
    auditsDb = await import('../auditsDb.js');
    programService = await import('../programService.js');

    packId = `u3progpk_${randomUUID()}`;
    await auditsDb.auditRun(
      `INSERT INTO audit_packs
         (id, organization_id, pack_key, version, title, classification, publication_status,
          finding_taxonomy, required_roles, expert_approved_by, expert_approved_at,
          published_by, published_at, created_at, updated_at)
       VALUES ($1,$2,$3,1,$4,'DEMONSTRATION','published',$5,$6,'u3-tester',NOW(),'u3-tester',NOW(),NOW(),NOW())`,
      [
        packId,
        orgA,
        `u3-prog-pack-key-${packId}`,
        'Pakiet testowy U3 — programService',
        JSON.stringify([
          { key: 'nonconforming', label: 'Niezgodność', nonConforming: true, requiresCorrectiveAction: true },
        ]),
        JSON.stringify(['lead_auditor', 'auditor', 'auditee']),
      ],
    );

    rootCriterionId = `u3progpkc_${randomUUID()}`;
    childCriterionId = `u3progpkc_${randomUUID()}`;
    await auditsDb.auditRun(
      `INSERT INTO audit_pack_criteria
         (id, pack_id, parent_id, ordinal, ref_code, node_kind, title, requirement_text,
          audit_question, expected_evidence, mandatory)
       VALUES ($1,$2,NULL,1,'A','domain','Domena A', NULL, NULL, '[]'::jsonb, true)`,
      [rootCriterionId, packId],
    );
    await auditsDb.auditRun(
      `INSERT INTO audit_pack_criteria
         (id, pack_id, parent_id, ordinal, ref_code, node_kind, title, requirement_text,
          audit_question, expected_evidence, mandatory)
       VALUES ($1,$2,$3,1,'A.1','criterion','Kryterium A.1',$4,'Czy X jest spełnione?',$5,true)`,
      [
        childCriterionId,
        packId,
        rootCriterionId,
        ORIGINAL_REQUIREMENT_TEXT,
        JSON.stringify([{ kind: 'document', description: 'polityka', mandatory: true }]),
      ],
    );
  });

  afterAll(async () => {
    if (!auditsDb) return;
    await auditsDb.auditRun(`DELETE FROM audit_domain_events WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await auditsDb.auditRun(`DELETE FROM audit_program_members WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await auditsDb.auditRun(`DELETE FROM audit_program_criteria WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await auditsDb.auditRun(`DELETE FROM audit_programs WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await auditsDb.auditRun(`DELETE FROM audit_pack_criteria WHERE pack_id = $1`, [packId]);
    await auditsDb.auditRun(`DELETE FROM audit_packs WHERE id = $1`, [packId]);
  });

  it('E.1 — createProgramFromPack robi snapshot kryteriów i zachowuje hierarchię parent → child', async () => {
    const detail = await programService.createProgramFromPack(orgA, adminActor, {
      packId,
      name: 'Program testowy E.1',
      objective: 'Cel testowy E.1',
    });

    expect(detail.program.packId).toBe(packId);
    expect(detail.program.lifecycleState).toBe('planning');
    expect(detail.program.criteriaSnapshotAt).toBeTruthy();
    expect(detail.stats.criteriaTotal).toBe(2);
    expect(detail.members.some((m) => m.userId === adminActor.userId && m.memberRole === 'program_owner')).toBe(
      true,
    );

    const criteria = await auditsDb.auditAll<Record<string, unknown>>(
      `SELECT * FROM audit_program_criteria WHERE program_id = $1 ORDER BY ordinal ASC`,
      [detail.program.id],
    );
    expect(criteria).toHaveLength(2);

    const root = criteria.find((c) => c.pack_criterion_id === rootCriterionId);
    const child = criteria.find((c) => c.pack_criterion_id === childCriterionId);
    expect(root).toBeTruthy();
    expect(child).toBeTruthy();
    expect(root!.parent_id).toBeNull();
    // Hierarchia zachowana: parent_id dziecka wskazuje na NOWE id snapshotu roota, nie na stare id pakietu.
    expect(child!.parent_id).toBe(root!.id);
    expect(child!.parent_id).not.toBe(rootCriterionId);
    expect(child!.requirement_text).toBe(ORIGINAL_REQUIREMENT_TEXT);
  });

  it("E.2 — zmiana pakietu PO utworzeniu programu NIE zmienia kryteriów programu (immutability snapshotu)", async () => {
    const detail = await programService.createProgramFromPack(orgA, adminActor, {
      packId,
      name: 'Program testowy E.2',
    });

    await auditsDb.auditRun(`UPDATE audit_pack_criteria SET requirement_text = $1 WHERE id = $2`, [
      'ZMIENIONE W PAKIECIE PO UTWORZENIU PROGRAMU',
      childCriterionId,
    ]);

    try {
      const criteria = await auditsDb.auditAll<Record<string, unknown>>(
        `SELECT * FROM audit_program_criteria WHERE program_id = $1 AND pack_criterion_id = $2`,
        [detail.program.id, childCriterionId],
      );
      expect(criteria).toHaveLength(1);
      expect(criteria[0].requirement_text).toBe(ORIGINAL_REQUIREMENT_TEXT);
      expect(criteria[0].requirement_text).not.toBe('ZMIENIONE W PAKIECIE PO UTWORZENIU PROGRAMU');
    } finally {
      // Przywróć oryginał — inne testy w tym pliku tworzą kolejne programy z tego samego pakietu.
      await auditsDb.auditRun(`UPDATE audit_pack_criteria SET requirement_text = $1 WHERE id = $2`, [
        ORIGINAL_REQUIREMENT_TEXT,
        childCriterionId,
      ]);
    }
  });

  it('E.7 — izolacja organizacji: program org A niewidoczny i niemodyfikowalny z org B', async () => {
    const detail = await programService.createProgramFromPack(orgA, adminActor, {
      packId,
      name: 'Program testowy E.7',
    });

    const fromOrgB = await programService.getProgram(orgB, detail.program.id);
    expect(fromOrgB).toBeNull();

    const orgBAdmin = {
      userId: `u3-admin-b-${randomUUID()}`,
      organizationId: orgB,
      platformRole: 'admin' as const,
    };
    await expect(
      programService.updateProgram(orgB, orgBAdmin, detail.program.id, { name: 'HACKED FROM ORG B' }),
    ).rejects.toMatchObject({ code: 'AUDIT_NOT_FOUND' });
    await expect(programService.deleteProgram(orgB, orgBAdmin, detail.program.id)).rejects.toMatchObject({
      code: 'AUDIT_NOT_FOUND',
    });

    const fromOrgA = await programService.getProgram(orgA, detail.program.id);
    expect(fromOrgA?.program.name).toBe('Program testowy E.7');
  });
});

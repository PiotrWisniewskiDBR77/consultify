/**
 * evidenceService — testy przeciw REALNEJ bazie Postgres (U3, blok E).
 *
 * URUCHOMIENIE (z korzenia worktree, NIE z `server/`):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u3" \
 *   npx vitest run server/src/services/audits/__tests__/evidenceService.test.ts
 *
 * Pokrywa z listy E zadania U3:
 *   E.9  — dowód przeczący (supportsConformity=false) zapisuje się i jest zwracany.
 *   E.10 — getEvidenceGaps wskazuje kryterium bez dowodu.
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
    '[evidenceService.test.ts SKIPPED — clean skip, not a failure] wymaga NODE_ENV=test DB_TYPE=postgres ' +
      'RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://...',
  );
}

suite('evidenceService (Postgres realny — U3)', () => {
  let auditsDb: typeof import('../auditsDb.js');
  let programService: typeof import('../programService.js');
  let evidenceService: typeof import('../evidenceService.js');

  const orgId = `u3-evid-org-${randomUUID()}`;
  const adminActor = { userId: `u3-evid-admin-${randomUUID()}`, organizationId: orgId, platformRole: 'admin' as const };
  const leadAuditorUserId = `u3-evid-lead-${randomUUID()}`;
  const evidenceOwnerUserId = `u3-evid-owner-${randomUUID()}`;

  const leadAuditorActor = { userId: leadAuditorUserId, organizationId: orgId };
  const evidenceOwnerActor = { userId: evidenceOwnerUserId, organizationId: orgId };

  let packId: string;
  let programId: string;
  const criterionIdByRef: Record<string, string> = {};

  beforeAll(async () => {
    auditsDb = await import('../auditsDb.js');
    programService = await import('../programService.js');
    evidenceService = await import('../evidenceService.js');

    packId = `u3evidpk_${randomUUID()}`;
    await auditsDb.auditRun(
      `INSERT INTO audit_packs
         (id, organization_id, pack_key, version, title, classification, publication_status,
          finding_taxonomy, required_roles, expert_approved_by, expert_approved_at,
          published_by, published_at, created_at, updated_at)
       VALUES ($1,$2,$3,1,$4,'DEMONSTRATION','published',$5,$6,'u3-tester',NOW(),'u3-tester',NOW(),NOW(),NOW())`,
      [
        packId,
        orgId,
        `u3-evid-pack-key-${packId}`,
        'Pakiet testowy U3 — evidenceService',
        JSON.stringify([
          { key: 'nonconforming', label: 'Niezgodność', nonConforming: true, requiresCorrectiveAction: true },
        ]),
        JSON.stringify(['lead_auditor', 'evidence_owner']),
      ],
    );

    // Kryterium Z1 ma zdefiniowany oczekiwany dowód i NIE dostanie żadnego
    // dowodu — to jest luka, którą ma wykryć E.10.
    const gapCriterionId = `u3evidpkc_${randomUUID()}`;
    await auditsDb.auditRun(
      `INSERT INTO audit_pack_criteria
         (id, pack_id, parent_id, ordinal, ref_code, node_kind, title, requirement_text,
          audit_question, expected_evidence, mandatory)
       VALUES ($1,$2,NULL,1,'Z1-gap','criterion','Kryterium bez dowodu','Wymaganie testowe','Pytanie testowe',$3,true)`,
      [
        gapCriterionId,
        packId,
        JSON.stringify([{ kind: 'document', description: 'polityka bezpieczeństwa', mandatory: true }]),
      ],
    );

    // Kryterium Z2 dostanie dowód (positive control — NIE powinno pojawić się w lukach).
    const coveredCriterionId = `u3evidpkc_${randomUUID()}`;
    await auditsDb.auditRun(
      `INSERT INTO audit_pack_criteria
         (id, pack_id, parent_id, ordinal, ref_code, node_kind, title, requirement_text,
          audit_question, expected_evidence, mandatory)
       VALUES ($1,$2,NULL,2,'Z2-covered','criterion','Kryterium z dowodem','Wymaganie testowe','Pytanie testowe',$3,true)`,
      [
        coveredCriterionId,
        packId,
        JSON.stringify([{ kind: 'document', description: 'polityka bezpieczeństwa', mandatory: true }]),
      ],
    );

    const detail = await programService.createProgramFromPack(orgId, adminActor, {
      packId,
      name: 'Program testowy evidenceService',
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
      userId: evidenceOwnerUserId,
      memberRole: 'evidence_owner',
    });

    // Wypełnij pokrycie dla Z2, żeby E.10 miał negatywną kontrolę.
    await evidenceService.submitEvidence(orgId, evidenceOwnerActor, {
      programId,
      criterionId: criterionIdByRef['Z2-covered'],
      kind: 'document',
      title: 'Polityka bezpieczeństwa — Z2',
      contentSnapshot: 'treść polityki Z2',
    });
  });

  afterAll(async () => {
    if (!auditsDb) return;
    await auditsDb.auditRun(`DELETE FROM audit_evidence_requests WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_evidence WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_program_members WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_program_criteria WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_programs WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_pack_criteria WHERE pack_id = $1`, [packId]);
    await auditsDb.auditRun(`DELETE FROM audit_packs WHERE id = $1`, [packId]);
  });

  it('E.9 — dowód przeczący (supportsConformity=false) zapisuje się i jest zwracany bez wyjątków', async () => {
    const criterionId = criterionIdByRef['Z2-covered'];
    expect(criterionId).toBeTruthy();

    const evidence = await evidenceService.submitEvidence(orgId, evidenceOwnerActor, {
      programId,
      criterionId,
      kind: 'observation',
      title: 'Obserwacja przecząca zgodności',
      contentSnapshot: 'W praktyce proces nie jest stosowany mimo udokumentowanej polityki',
    });
    expect(evidence.contentHash).toBeTruthy();

    const reviewed = await evidenceService.reviewEvidence(orgId, leadAuditorActor, evidence.id, {
      sufficiency: 'sufficient',
      reliability: 'reliable',
      currencyStatus: 'current',
      supportsConformity: false,
      accepted: true,
      reviewNote: 'Dowód wskazuje na niezgodność mimo istniejącej polityki',
    });

    // `false` musi zostać zapisane DOSŁOWNIE jako false — nie jako null/undefined/true.
    expect(reviewed.supportsConformity).toBe(false);
    expect(reviewed.accepted).toBe(true);

    // Re-fetch niezależną ścieżką (listEvidence), żeby wykluczyć, że to tylko
    // wartość zwrócona w pamięci bez realnego zapisu w bazie.
    const refetched = await evidenceService.listEvidence(orgId, { programId, criterionId });
    const persisted = refetched.find((e) => e.id === evidence.id);
    expect(persisted).toBeTruthy();
    expect(persisted!.supportsConformity).toBe(false);
  });

  it('E.10 — getEvidenceGaps wskazuje kryterium bez dowodu i pomija kryterium z dowodem (positive control)', async () => {
    const gaps = await evidenceService.getEvidenceGaps(orgId, programId);

    const gapForZ1 = gaps.find((g) => g.criterionId === criterionIdByRef['Z1-gap']);
    expect(gapForZ1).toBeTruthy();
    expect(gapForZ1!.missingKinds).toContain('document');

    const gapForZ2 = gaps.find((g) => g.criterionId === criterionIdByRef['Z2-covered']);
    expect(gapForZ2).toBeUndefined();
  });
});

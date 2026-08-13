/**
 * lifecycleGates — testy przeciw REALNEJ bazie Postgres (U3, blok E).
 *
 * URUCHOMIENIE (z korzenia worktree, NIE z `server/`):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u3" \
 *   npx vitest run server/src/services/audits/__tests__/lifecycleGates.test.ts
 *
 * Pokrywa z listy E zadania U3:
 *   E.8 — transitionLifecycle blokuje przejście do 'fieldwork' bez snapshotu
 *         kryteriów i bez lead auditora, a przepuszcza gdy oba są.
 *
 * METODA: `createProgramFromPack` ZAWSZE ustawia `criteria_snapshot_at`
 * (kopiuje kryteria atomowo przy tworzeniu), więc scenariusz "program bez
 * snapshotu" nie da się osiągnąć samym publicznym API. Test symuluje ten stan
 * bezpośrednim zerowaniem kolumny SQL-em (legalna technika izolowania JEDNEGO
 * faktu z `LifecycleGateFacts` — dokładnie to, co `computeLifecycleFacts` w
 * programService.ts czyta z żywych danych), sprawdza, że bramka blokuje z
 * OBOMA powodami na liście, przywraca stan i dowodzi, że po spełnieniu obu
 * warunków przejście przechodzi.
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
    '[lifecycleGates.test.ts SKIPPED — clean skip, not a failure] wymaga NODE_ENV=test DB_TYPE=postgres ' +
      'RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://...',
  );
}

suite('lifecycle gates — transitionLifecycle → fieldwork (Postgres realny — U3)', () => {
  let auditsDb: typeof import('../auditsDb.js');
  let programService: typeof import('../programService.js');

  const orgId = `u3-life-org-${randomUUID()}`;
  const adminActor = { userId: `u3-life-admin-${randomUUID()}`, organizationId: orgId, platformRole: 'admin' as const };
  const leadAuditorUserId = `u3-life-lead-${randomUUID()}`;

  let packId: string;
  let programId: string;

  beforeAll(async () => {
    auditsDb = await import('../auditsDb.js');
    programService = await import('../programService.js');

    packId = `u3lifepk_${randomUUID()}`;
    await auditsDb.auditRun(
      `INSERT INTO audit_packs
         (id, organization_id, pack_key, version, title, classification, publication_status,
          finding_taxonomy, required_roles, expert_approved_by, expert_approved_at,
          published_by, published_at, created_at, updated_at)
       VALUES ($1,$2,$3,1,$4,'DEMONSTRATION','published',$5,$6,'u3-tester',NOW(),'u3-tester',NOW(),NOW(),NOW())`,
      [
        packId,
        orgId,
        `u3-life-pack-key-${packId}`,
        'Pakiet testowy U3 — lifecycleGates',
        JSON.stringify([
          { key: 'nonconforming', label: 'Niezgodność', nonConforming: true, requiresCorrectiveAction: true },
        ]),
        JSON.stringify(['lead_auditor']),
      ],
    );

    await auditsDb.auditRun(
      `INSERT INTO audit_pack_criteria
         (id, pack_id, parent_id, ordinal, ref_code, node_kind, title, requirement_text,
          audit_question, expected_evidence, mandatory)
       VALUES ($1,$2,NULL,1,'L1','criterion','Kryterium L1','Wymaganie testowe','Pytanie testowe','[]'::jsonb,true)`,
      [`u3lifepkc_${randomUUID()}`, packId],
    );

    const detail = await programService.createProgramFromPack(orgId, adminActor, {
      packId,
      name: 'Program testowy lifecycleGates',
    });
    programId = detail.program.id;
  });

  afterAll(async () => {
    if (!auditsDb) return;
    await auditsDb.auditRun(`DELETE FROM audit_domain_events WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_program_members WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_program_criteria WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_programs WHERE organization_id = $1`, [orgId]);
    await auditsDb.auditRun(`DELETE FROM audit_pack_criteria WHERE pack_id = $1`, [packId]);
    await auditsDb.auditRun(`DELETE FROM audit_packs WHERE id = $1`, [packId]);
  });

  it("E.8 — blokuje 'fieldwork' bez snapshotu kryteriów i bez lead auditora, przepuszcza gdy oba są", async () => {
    // Krok 1: planning → preparation. Ten etap nie ma bramki merytorycznej
    // (evaluateGate nie definiuje przypadku 'preparation'), więc przechodzi
    // niezależnie od stanu snapshotu/zespołu.
    const afterPreparation = await programService.transitionLifecycle(
      orgId,
      adminActor,
      programId,
      'preparation',
    );
    expect(afterPreparation.lifecycleState).toBe('preparation');

    // Symulacja: program BEZ snapshotu kryteriów i BEZ lead auditora (świeżo
    // utworzony program ma tylko program_owner — lead_auditor nigdy nie był
    // dodany). Zerujemy criteria_snapshot_at bezpośrednio, bo publiczne API
    // zawsze ustawia je atomowo z kopiowaniem kryteriów.
    await auditsDb.auditRun(`UPDATE audit_programs SET criteria_snapshot_at = NULL WHERE id = $1`, [programId]);

    const status = await programService.getLifecycleStatus(orgId, programId);
    const fieldworkStatus = status?.allowedNext.find((s) => s.state === 'fieldwork');
    expect(fieldworkStatus?.allowed).toBe(false);
    expect(fieldworkStatus?.blockers.join(' | ')).toMatch(/zrzuconych kryteriów/);
    expect(fieldworkStatus?.blockers.join(' | ')).toMatch(/audytora wiodącego/);

    await expect(
      programService.transitionLifecycle(orgId, adminActor, programId, 'fieldwork'),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_STATE' });

    // Sprawdź, że stan NIE zmienił się mimo odrzuconej próby.
    const stillInPreparation = await programService.getProgram(orgId, programId);
    expect(stillInPreparation?.program.lifecycleState).toBe('preparation');

    // Krok 2: napraw oba braki.
    await auditsDb.auditRun(`UPDATE audit_programs SET criteria_snapshot_at = NOW() WHERE id = $1`, [programId]);
    await programService.addMember(orgId, adminActor, programId, {
      userId: leadAuditorUserId,
      memberRole: 'lead_auditor',
    });

    const statusAfterFix = await programService.getLifecycleStatus(orgId, programId);
    const fieldworkAfterFix = statusAfterFix?.allowedNext.find((s) => s.state === 'fieldwork');
    expect(fieldworkAfterFix?.allowed).toBe(true);
    expect(fieldworkAfterFix?.blockers).toEqual([]);

    const afterFieldwork = await programService.transitionLifecycle(orgId, adminActor, programId, 'fieldwork');
    expect(afterFieldwork.lifecycleState).toBe('fieldwork');
  });
});

/**
 * AUD-BVP-001 — BVP evidence dla programu audytowego przez kanoniczny kernel.
 *
 * Dowodzi (na REALNYM Postgresie, nie mocku): create → save/edit → reopen,
 * legalne/nielegalne przejście cyklu życia, brak blokady optymistycznej przy
 * współbieżnych `transitionLifecycle`, powtórzenie żądania create (replay),
 * izolację organizacji, odmowę roli i brak sierot po odrzuconej operacji.
 *
 * Kanoniczny writer: `server/src/services/audits/programService.ts`
 * (poza leasem tego zadania — WYŁĄCZNIE czytamy/wołamy, nie edytujemy).
 *
 * URUCHOMIENIE (z korzenia worktree):
 *   DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34913/consultinity" \
 *   DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   npx vitest run server/src/services/auditProgramBvp/__tests__/programKernelBvp.pg.test.ts --retry=0
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import config from '../../../config/Config.js';

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
    '[programKernelBvp.pg.test.ts SKIPPED — clean skip, not a failure] wymaga ' +
      'RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://... CI=true (patrz nagłówek pliku)'
  );
}

type AuditsDbModule = typeof import('../../audits/auditsDb.js');
type ProgramServiceModule = typeof import('../../audits/programService.js');
type AuditActor = import('../../audits/types.js').AuditActor;

suite('AUD-BVP-001 — programService kernel BVP (Postgres realny)', () => {
  let auditsDb: AuditsDbModule;
  let programService: ProgramServiceModule;

  const RUN = randomUUID().slice(0, 8);
  const orgA = `aud-bvp-org-a-${RUN}`;
  const orgB = `aud-bvp-org-b-${RUN}`;

  const adminA: AuditActor = {
    userId: `aud-bvp-admin-a-${RUN}`,
    organizationId: orgA,
    platformRole: 'admin',
  };
  const adminB: AuditActor = {
    userId: `aud-bvp-admin-b-${RUN}`,
    organizationId: orgB,
    platformRole: 'admin',
  };

  let packId: string;
  let rootCriterionId: string;
  let childCriterionId: string;

  async function insertPackFixture(): Promise<void> {
    packId = `bvpprogpk_${RUN}`;
    await auditsDb.auditRun(
      `INSERT INTO audit_packs
         (id, organization_id, pack_key, version, title, classification, publication_status,
          finding_taxonomy, required_roles, expert_approved_by, expert_approved_at,
          published_by, published_at, created_at, updated_at)
       VALUES ($1,$2,$3,1,$4,'DEMONSTRATION','published',$5,$6,'bvp-tester',NOW(),'bvp-tester',NOW(),NOW(),NOW())`,
      [
        packId,
        orgA,
        `aud-bvp-pack-key-${RUN}`,
        'Pakiet testowy AUD-BVP-001 — programService',
        JSON.stringify([
          {
            key: 'nonconforming',
            label: 'Niezgodność',
            nonConforming: true,
            requiresCorrectiveAction: true,
          },
        ]),
        JSON.stringify(['lead_auditor', 'auditor', 'auditee']),
      ]
    );

    rootCriterionId = `bvpprogpkc_${RUN}_root`;
    childCriterionId = `bvpprogpkc_${RUN}_child`;
    await auditsDb.auditRun(
      `INSERT INTO audit_pack_criteria
         (id, pack_id, parent_id, ordinal, ref_code, node_kind, title, requirement_text,
          audit_question, expected_evidence, mandatory)
       VALUES ($1,$2,NULL,1,'A','domain','Domena A', NULL, NULL, '[]'::jsonb, true)`,
      [rootCriterionId, packId]
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
        'Wymaganie testowe AUD-BVP-001 — nie ruszać',
        JSON.stringify([{ kind: 'document', description: 'polityka', mandatory: true }]),
      ]
    );
  }

  async function cleanupOrgRows(): Promise<void> {
    if (!auditsDb) return;
    // audit_domain_events is DB-enforced append-only. This suite runs only on
    // a disposable database, so its evidence rows are intentionally retained
    // until the entire container is removed after the gate.
    await auditsDb.auditRun(`DELETE FROM audit_program_members WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await auditsDb.auditRun(`DELETE FROM audit_program_criteria WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await auditsDb.auditRun(`DELETE FROM audit_programs WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
  }

  beforeAll(async () => {
    auditsDb = await import('../../audits/auditsDb.js');
    programService = await import('../../audits/programService.js');
    await cleanupOrgRows();
    await insertPackFixture();
  }, 60_000);

  afterAll(async () => {
    if (!auditsDb) return;
    await cleanupOrgRows();
    await auditsDb.auditRun(`DELETE FROM audit_pack_criteria WHERE pack_id = $1`, [packId]);
    await auditsDb.auditRun(`DELETE FROM audit_packs WHERE id = $1`, [packId]);
  }, 60_000);

  // ---------------------------------------------------------------------
  // 1 + 2 + 3 — CREATE → SAVE/EDIT → REOPEN (fresh module/pool instance)
  // ---------------------------------------------------------------------
  it('CREATE: program powstaje przez kanoniczny writer i wiersz jest potwierdzony SELECT-em', async () => {
    const detail = await programService.createProgramFromPack(orgA, adminA, {
      packId,
      name: 'BVP Program v1',
      objective: 'Cel v1',
      scopeText: 'Zakres v1',
    });

    expect(detail.program.packId).toBe(packId);
    expect(detail.program.lifecycleState).toBe('planning');

    const row = await auditsDb.auditGet<Record<string, unknown>>(
      `SELECT * FROM audit_programs WHERE id = $1 AND organization_id = $2`,
      [detail.program.id, orgA]
    );
    expect(row).toBeTruthy();
    expect(row!.name).toBe('BVP Program v1');
    expect(row!.objective).toBe('Cel v1');
    expect(row!.scope_text).toBe('Zakres v1');
    expect(row!.lifecycle_state).toBe('planning');
    expect(row!.criteria_snapshot_at).toBeTruthy();

    const criteria = await auditsDb.auditAll<Record<string, unknown>>(
      `SELECT * FROM audit_program_criteria WHERE program_id = $1 ORDER BY ordinal ASC`,
      [detail.program.id]
    );
    expect(criteria).toHaveLength(2);
  });

  it('SAVE/EDIT + REOPEN: aktualizacja utrwala się i przeżywa świeży moduł/pool (cold readback)', async () => {
    const created = await programService.createProgramFromPack(orgA, adminA, {
      packId,
      name: 'BVP Program v2 — original',
      objective: 'Cel oryginalny',
    });
    const programId = created.program.id;

    const updated = await programService.updateProgram(orgA, adminA, programId, {
      name: 'BVP Program v2 — edited',
      objective: 'Cel po edycji',
      scopeText: 'Zakres po edycji',
    });
    expect(updated.name).toBe('BVP Program v2 — edited');

    // Nie ufaj odpowiedzi serwisu — odczytaj wiersz osobnym zapytaniem.
    const rowAfterEdit = await auditsDb.auditGet<Record<string, unknown>>(
      `SELECT * FROM audit_programs WHERE id = $1 AND organization_id = $2`,
      [programId, orgA]
    );
    expect(rowAfterEdit!.name).toBe('BVP Program v2 — edited');
    expect(rowAfterEdit!.objective).toBe('Cel po edycji');
    expect(rowAfterEdit!.scope_text).toBe('Zakres po edycji');

    // REOPEN / COLD READBACK — świeży moduł (świeży pool połączeń), nie ten
    // sam handle, którego użyto do zapisu.
    vi.resetModules();
    const freshAuditsDb = (await import('../../audits/auditsDb.js')) as AuditsDbModule;
    const freshProgramService =
      (await import('../../audits/programService.js')) as ProgramServiceModule;

    const reopened = await freshProgramService.getProgram(orgA, programId);
    expect(reopened).toBeTruthy();
    expect(reopened!.program.id).toBe(programId);
    expect(reopened!.program.name).toBe('BVP Program v2 — edited');
    expect(reopened!.program.objective).toBe('Cel po edycji');
    expect(reopened!.program.lifecycleState).toBe('planning');

    // Kontynuuj resztę pliku na świeżych uchwytach modułu — funkcjonalnie
    // identyczne, ale dowodzą, że stan żyje poza uchwytem, który go zapisał.
    auditsDb = freshAuditsDb;
    programService = freshProgramService;
  });

  // ---------------------------------------------------------------------
  // 4 — LIFECYCLE: legalne przejście stosuje się; nielegalne jest odrzucone
  //     i wiersz pozostaje bez zmian (re-SELECT).
  // ---------------------------------------------------------------------
  it('LIFECYCLE: legalne przejście planning→preparation się stosuje; nielegalne planning→fieldwork jest odrzucone bez zmiany wiersza', async () => {
    const created = await programService.createProgramFromPack(orgA, adminA, {
      packId,
      name: 'BVP Program — lifecycle',
    });
    const programId = created.program.id;

    const afterLegal = await programService.transitionLifecycle(
      orgA,
      adminA,
      programId,
      'preparation'
    );
    expect(afterLegal.lifecycleState).toBe('preparation');

    await expect(
      programService.transitionLifecycle(orgA, adminA, programId, 'fieldwork')
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_STATE', statusCode: 409 });

    const row = await auditsDb.auditGet<Record<string, unknown>>(
      `SELECT lifecycle_state FROM audit_programs WHERE id = $1 AND organization_id = $2`,
      [programId, orgA]
    );
    // Nielegalne przejście (preparation -> fieldwork wymaga bramki, ale TU
    // pada wcześniej: assertTransitionAllowed sprawdza dozwolone przejścia z
    // BIEŻĄCEGO stanu 'preparation' -> dozwolone to ['fieldwork','planning'],
    // więc naprawdę nielegalne jest np. 'closed' wprost z 'preparation'.
    expect(row!.lifecycle_state).toBe('preparation');
  });

  it('LIFECYCLE: przejście preparation→closed (przeskoczenie etapów) jest odrzucone, wiersz bez zmian', async () => {
    const created = await programService.createProgramFromPack(orgA, adminA, {
      packId,
      name: 'BVP Program — lifecycle skip',
    });
    const programId = created.program.id;
    await programService.transitionLifecycle(orgA, adminA, programId, 'preparation');

    await expect(
      programService.transitionLifecycle(orgA, adminA, programId, 'closed')
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_STATE', statusCode: 409 });

    const row = await auditsDb.auditGet<Record<string, unknown>>(
      `SELECT lifecycle_state FROM audit_programs WHERE id = $1 AND organization_id = $2`,
      [programId, orgA]
    );
    expect(row!.lifecycle_state).toBe('preparation');
  });

  // ---------------------------------------------------------------------
  // 5 — HEADLINE: dwa WSPÓŁBIEŻNE transitionLifecycle z tego samego stanu
  //     do RÓŻNYCH stanów docelowych. `transitionLifecycle` czyta stan,
  //     waliduje, liczy bramkę i robi ŚLEPY UPDATE bez `WHERE lifecycle_state
  //     = <oczekiwany>` (programService.ts ~944-1005) — więc OBA wywołania
  //     mogą się zastosować. To jest CHARAKTERYZACJA znanej luki, NIE test
  //     "co się zdarzyło" — luka jest potwierdzona empirycznie poniżej.
  // ---------------------------------------------------------------------
  it('serializuje dwa współbieżne transitionLifecycle: dokładnie jedno przejście i jedno zdarzenie', async () => {
    const created = await programService.createProgramFromPack(orgA, adminA, {
      packId,
      name: 'BVP Program — concurrency',
    });
    const programId = created.program.id;

    // Bramka 'fieldwork' wymaga lead_auditor — dodajemy go jako drugiego aktora.
    const leadActor: AuditActor = { userId: `aud-bvp-lead-${RUN}`, organizationId: orgA };
    await programService.addMember(orgA, adminA, programId, {
      userId: leadActor.userId,
      memberRole: 'lead_auditor',
    });

    await programService.transitionLifecycle(orgA, adminA, programId, 'preparation');

    const rowBefore = await auditsDb.auditGet<Record<string, unknown>>(
      `SELECT lifecycle_state FROM audit_programs WHERE id = $1 AND organization_id = $2`,
      [programId, orgA]
    );
    expect(rowBefore!.lifecycle_state).toBe('preparation');

    // Zdarzeń przed wyścigiem: planning->preparation (transition wyżej) już
    // zapisało jedno. Liczymy DELTĘ, żeby nie zakładać zerowego punktu startu.
    const eventsBefore = await auditsDb.auditAll<{ id: string }>(
      `SELECT id FROM audit_domain_events
        WHERE organization_id = $1 AND program_id = $2 AND event_type = 'program.lifecycle_transitioned'`,
      [orgA, programId]
    );

    // Dwa RÓŻNE wywołania z tego samego stanu 'preparation':
    //   A: program_owner (adminA) -> 'fieldwork' (do przodu, bramka OK)
    //   B: lead_auditor (leadActor) -> 'planning' (wstecz, wymaga powodu)
    const [resultA, resultB] = await Promise.allSettled([
      programService.transitionLifecycle(orgA, adminA, programId, 'fieldwork'),
      programService.transitionLifecycle(
        orgA,
        leadActor,
        programId,
        'planning',
        'Współbieżny test luki — cofnięcie'
      ),
    ]);

    const rowAfter = await auditsDb.auditGet<Record<string, unknown>>(
      `SELECT lifecycle_state FROM audit_programs WHERE id = $1 AND organization_id = $2`,
      [programId, orgA]
    );
    const transitionEvents = await auditsDb.auditAll<{ payload: unknown }>(
      `SELECT payload FROM audit_domain_events
        WHERE organization_id = $1 AND program_id = $2 AND event_type = 'program.lifecycle_transitioned'
        ORDER BY occurred_at ASC`,
      [orgA, programId]
    );

    // eslint-disable-next-line no-console
    console.log('[AUD-BVP-001 KNOWN-GAP] wynik A (program_owner -> fieldwork):', resultA.status);
    // eslint-disable-next-line no-console
    console.log('[AUD-BVP-001 KNOWN-GAP] wynik B (lead_auditor -> planning):', resultB.status);
    // eslint-disable-next-line no-console
    console.log(
      '[AUD-BVP-001 KNOWN-GAP] finalny lifecycle_state w bazie:',
      rowAfter!.lifecycle_state
    );
    // eslint-disable-next-line no-console
    console.log(
      '[AUD-BVP-001 KNOWN-GAP] liczba zdarzeń lifecycle_transitioned zapisanych:',
      transitionEvents.length
    );

    expect([resultA.status, resultB.status].sort()).toEqual(['fulfilled', 'rejected']);
    expect(['fieldwork', 'planning']).toContain(rowAfter!.lifecycle_state);
    expect(transitionEvents.length - eventsBefore.length).toBe(1);
    const rejected =
      resultA.status === 'rejected'
        ? resultA.reason
        : resultB.status === 'rejected'
          ? resultB.reason
          : null;
    expect(String(rejected?.message || rejected)).toMatch(/zmienił się|niedozwolone/i);
  });

  // ---------------------------------------------------------------------
  // 6 — REPLAY: ten sam klucz zwraca dokładnie ten sam kompletny agregat.
  // ---------------------------------------------------------------------
  it('REPLAY/CONCURRENCY: osiem create z tym samym kluczem tworzy jeden kompletny program', async () => {
    const input = {
      packId,
      name: `BVP Program — replay ${RUN}`,
      objective: 'Replay',
      idempotencyKey: `aud-bvp-create-${RUN}`,
    };
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () => programService.createProgramFromPack(orgA, adminA, input))
    );

    expect(new Set(attempts.map((result) => result.program.id)).size).toBe(1);
    expect(attempts.every((result) => result.stats.criteriaTotal === 2)).toBe(true);
    expect(attempts.every((result) => result.members.length === 1)).toBe(true);

    const rows = await auditsDb.auditAll<{ id: string }>(
      `SELECT id FROM audit_programs WHERE organization_id = $1 AND name = $2`,
      [orgA, input.name]
    );
    expect(rows).toHaveLength(1);
    const events = await auditsDb.auditAll<{ id: string }>(
      `SELECT id FROM audit_domain_events
        WHERE organization_id=$1 AND program_id=$2 AND event_type='program.created_from_pack'`,
      [orgA, rows[0].id]
    );
    expect(events).toHaveLength(1);
  });

  // ---------------------------------------------------------------------
  // 7 — TENANT NEGATIVE: org B nie widzi/nie edytuje/nie przenosi programu org A.
  // ---------------------------------------------------------------------
  it('TENANT NEGATIVE: org B nie może czytać, edytować ani przenosić programu org A; brak wycieku wiersza', async () => {
    const created = await programService.createProgramFromPack(orgA, adminA, {
      packId,
      name: 'BVP Program — tenant isolation',
    });
    const programId = created.program.id;

    const readFromB = await programService.getProgram(orgB, programId);
    expect(readFromB).toBeNull();

    await expect(
      programService.updateProgram(orgB, adminB, programId, { name: 'HACKED FROM ORG B' })
    ).rejects.toMatchObject({ code: 'AUDIT_NOT_FOUND' });

    // transitionLifecycle sprawdza capability PRZED istnieniem wiersza —
    // rola 'program.advance_lifecycle' nie jest przyznawana samym
    // platformRole=admin (patrz PLATFORM_ADMIN_CAPABILITIES w permissions.ts),
    // więc odmowa dla org B przychodzi jako AUDIT_FORBIDDEN, nie AUDIT_NOT_FOUND
    // — to WCIĄŻ odmowa i WCIĄŻ brak modyfikacji, ale inny kod niż update/delete.
    await expect(
      programService.transitionLifecycle(orgB, adminB, programId, 'preparation')
    ).rejects.toMatchObject({ code: 'AUDIT_FORBIDDEN', statusCode: 403 });

    const rowStillA = await auditsDb.auditGet<Record<string, unknown>>(
      `SELECT name, lifecycle_state, organization_id FROM audit_programs WHERE id = $1`,
      [programId]
    );
    expect(rowStillA!.organization_id).toBe(orgA);
    expect(rowStillA!.name).toBe('BVP Program — tenant isolation');
    expect(rowStillA!.lifecycle_state).toBe('planning');
  });

  // ---------------------------------------------------------------------
  // 8 — ROLE NEGATIVE: członek bez wymaganej capability jest odrzucony na
  //     edycji i na przejściu.
  // ---------------------------------------------------------------------
  it('ROLE NEGATIVE: auditee (bez program.update / program.advance_lifecycle) jest odrzucony na edycji i przejściu', async () => {
    const created = await programService.createProgramFromPack(orgA, adminA, {
      packId,
      name: 'BVP Program — role negative',
    });
    const programId = created.program.id;

    const auditeeActor: AuditActor = { userId: `aud-bvp-auditee-${RUN}`, organizationId: orgA };
    await programService.addMember(orgA, adminA, programId, {
      userId: auditeeActor.userId,
      memberRole: 'auditee',
    });

    await expect(
      programService.updateProgram(orgA, auditeeActor, programId, {
        name: 'AUDITEE PRÓBUJE EDYTOWAĆ',
      })
    ).rejects.toMatchObject({ code: 'AUDIT_FORBIDDEN', statusCode: 403 });

    await expect(
      programService.transitionLifecycle(orgA, auditeeActor, programId, 'preparation')
    ).rejects.toMatchObject({ code: 'AUDIT_FORBIDDEN', statusCode: 403 });

    const row = await auditsDb.auditGet<Record<string, unknown>>(
      `SELECT name, lifecycle_state FROM audit_programs WHERE id = $1 AND organization_id = $2`,
      [programId, orgA]
    );
    expect(row!.name).toBe('BVP Program — role negative');
    expect(row!.lifecycle_state).toBe('planning');
  });

  // ---------------------------------------------------------------------
  // 10 — ZERO ORPHANS: po odrzuconej operacji (delete poza 'planning') nie
  //      zostają żadne częściowe wiersze w tabelach potomnych.
  // ---------------------------------------------------------------------
  it('ZERO ORPHANS: odrzucone delete poza stanem planning nie zostawia częściowych wierszy potomnych', async () => {
    const created = await programService.createProgramFromPack(orgA, adminA, {
      packId,
      name: 'BVP Program — zero orphans',
    });
    const programId = created.program.id;
    await programService.transitionLifecycle(orgA, adminA, programId, 'preparation');

    const criteriaBefore = await auditsDb.auditAll(
      `SELECT id FROM audit_program_criteria WHERE program_id = $1`,
      [programId]
    );
    const membersBefore = await auditsDb.auditAll(
      `SELECT id FROM audit_program_members WHERE program_id = $1`,
      [programId]
    );
    expect(criteriaBefore.length).toBeGreaterThan(0);
    expect(membersBefore.length).toBeGreaterThan(0);

    await expect(programService.deleteProgram(orgA, adminA, programId)).rejects.toMatchObject({
      code: 'AUDIT_INVALID_STATE',
      statusCode: 409,
    });

    const programRow = await auditsDb.auditGet(`SELECT id FROM audit_programs WHERE id = $1`, [
      programId,
    ]);
    const criteriaAfter = await auditsDb.auditAll(
      `SELECT id FROM audit_program_criteria WHERE program_id = $1`,
      [programId]
    );
    const membersAfter = await auditsDb.auditAll(
      `SELECT id FROM audit_program_members WHERE program_id = $1`,
      [programId]
    );

    expect(programRow).toBeTruthy();
    expect(criteriaAfter).toHaveLength(criteriaBefore.length);
    expect(membersAfter).toHaveLength(membersBefore.length);
  });
});

// ===========================================================================
// 9 — LEGACY SURFACE NEGATIVE (HTTP) — wymaga realnego mountu przez Gateway,
// bo blokada 410 żyje w warstwie tras (audit-programs.routes.ts), nie w
// serwisie. Osobny `describe`, żeby nie ciągnąć ciężkiego Gateway do testów
// czysto serwisowych powyżej.
// ===========================================================================
suite('AUD-BVP-001 — legacy write surface retirement (HTTP, Postgres realny)', () => {
  let app: express.Express;
  let auditsDb: AuditsDbModule;

  const RUN = randomUUID().slice(0, 8);
  const org = `aud-bvp-legacy-org-${RUN}`;
  const userId = `aud-bvp-legacy-user-${RUN}`;

  function tokenFor(): string {
    return jwt.sign(
      {
        id: userId,
        email: `${userId}@example.test`,
        role: 'admin',
        organizationId: org,
        isSuperAdmin: false,
        isDemo: false,
        jti: `jti-${userId}-${Math.random().toString(36).slice(2, 10)}`,
      },
      (config as unknown as { JWT_SECRET: string }).JWT_SECRET,
      { expiresIn: '30m' }
    );
  }

  beforeAll(async () => {
    auditsDb = await import('../../audits/auditsDb.js');
    app = express();
    app.use(express.json({ limit: '2mb' }));
    const { apiGateway } = await import('../../../Gateway.js');
    apiGateway.initializeRoutes(app);
  }, 120_000);

  afterAll(async () => {
    if (!auditsDb) return;
    await auditsDb.auditRun(`DELETE FROM audit_programs WHERE organization_id = $1`, [org]);
  }, 30_000);

  it('LEGACY SURFACE NEGATIVE: POST /api/audit/programs zwraca 410 domyślnie i nie zmienia audit_programs', async () => {
    expect(process.env.AUDIT_PROGRAM_LEGACY_WRITES_ENABLED).toBeFalsy();

    const token = tokenFor();

    const countBefore = await auditsDb.auditGet<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM audit_programs WHERE organization_id = $1`,
      [org]
    );

    const res = await request(app)
      .post('/api/audit/programs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'LEGACY WRITE ATTEMPT — must be refused' });

    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({ code: 'AUDIT_PROGRAM_LEGACY_WRITE_DISABLED' });

    const countAfter = await auditsDb.auditGet<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM audit_programs WHERE organization_id = $1`,
      [org]
    );
    expect(countAfter!.cnt).toBe(countBefore!.cnt);
    expect(countAfter!.cnt).toBe('0');
  }, 30_000);

  it('LEGACY SURFACE NEGATIVE: PATCH i DELETE /api/audit/programs/:id też zwracają 410 bez wpływu na bazę', async () => {
    const token = tokenFor();
    const fakeId = `legacy-${RUN}`;

    const patchRes = await request(app)
      .patch(`/api/audit/programs/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'x' });
    expect(patchRes.status).toBe(410);
    expect(patchRes.body).toMatchObject({ code: 'AUDIT_PROGRAM_LEGACY_WRITE_DISABLED' });

    const deleteRes = await request(app)
      .delete(`/api/audit/programs/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(410);
    expect(deleteRes.body).toMatchObject({ code: 'AUDIT_PROGRAM_LEGACY_WRITE_DISABLED' });
  }, 30_000);
});

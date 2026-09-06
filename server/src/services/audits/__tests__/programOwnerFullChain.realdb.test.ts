/**
 * programOwnerFullChain.realdb.test — 1.1-A5 / DEC-428.
 *
 * POMIAR (A4): właściciel programu audytu (rola `program_owner`, i TYLKO ta
 * rola — bez `lead_auditor`/`auditor` równolegle) urywał łańcuch
 * sesja → wynik → raport → wniosek dokładnie na trzech progach:
 *   - `POST /audits/outputs/finalize` wymaga `output.finalize`,
 *   - `POST /audits/reports` (i ten sam strażnik na `POST /reports/:id/conclusion`)
 *     wymaga `report.draft`,
 *   - `POST /audits/reports/:id/publish` wymaga `report.publish`.
 * Żadnej z tych trzech capability `program_owner` nie miał w macierzy
 * (`permissions.ts`), więc solo-właściciel programu mógł co najwyżej
 * zaakceptować raport (`report.approve` już miał) — nigdy go sam wytworzyć,
 * sfinalizować outputu ani opublikować.
 *
 * DEC-428: w MVP program_owner robi to WSZYSTKO sam (segregacja obowiązków
 * lead_auditor/auditor to Fala 2, audyty zewnętrzne). Ten test dowodzi, że
 * pojedynczy aktor z JEDNĄ rolą `program_owner` przechodzi cały łańcuch przez
 * prawdziwe serwisy (nie mocki) na prawdziwej Postgres:
 *   program (fixture) → assignCriterion → recordTest → concludeCriterion
 *   → finalizeOutput → generateReport → approveReport → publishReport
 *   → wniosek (buildAuditReportConclusion + safePersistAuditReportConclusion,
 *   dokładnie to, co woła `POST /reports/:id/conclusion`).
 *
 * DOPISKA 1.1-A5b: ZNALEZISKO A5 — program_owner miał już output.finalize/
 * report.draft/report.publish, ale nie miał capability do samej SESJI
 * audytu (`criterion.assign`/`.perform_test`/`.conclude`), więc solo-
 * właściciel programu nie mógł nikomu przypisać kryterium, wykonać
 * procedury testowej ani wyciągnąć wniosku — łańcuch urywał się PRZED
 * `output.finalize`. Kroki 1-3 poniżej dowodzą, że praca merytoryczna w
 * sesji przechodzi teraz przez tego samego aktora.
 *
 * Celowo NIE tworzymy żadnego ustalenia (`audit_program_findings`) — fixture
 * ma tylko jedno kryterium i jeden dowód, zero findingów w draft/in_review —
 * dzięki temu test mierzy WYŁĄCZNIE bramkę uprawnień, a nie inne reguły stanu
 * (TWARDA REGUŁA 1 w `outputService.finalizeOutput`). Wniosek kryterium
 * używa `conformityStatus: 'nonconforming'` (nie `conforming`), żeby nie
 * zależeć dodatkowo od akceptacji dowodu (TWARDA REGUŁA 2 w
 * `concludeCriterion`) — to osobna reguła stanu, nie przedmiot tego testu.
 *
 * RUN:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:noc@127.0.0.1:54400/consultify_noc \
 *   npx vitest run server/src/services/audits/__tests__/programOwnerFullChain.realdb.test.ts \
 *     --maxWorkers=1 --no-file-parallelism
 *
 * DOWÓD MUTACYJNY 1 (A5, zachowany): z `permissions.ts` usunięto chwilowo
 * `output.finalize`/`report.draft`/`report.publish` z `program_owner` — ten
 * sam test poszedł RED na `finalizeOutput` (`AuditPermissionError`), po
 * przywróceniu wrócił GREEN.
 *
 * DOWÓD MUTACYJNY 2 (A5b, ten dyżur): z `permissions.ts` usunięto chwilowo
 * `criterion.perform_test` z `program_owner` — test poszedł RED na kroku
 * `recordTest` (`AuditPermissionError: Ta czynność (criterion.perform_test)
 * wymaga roli audytowej, której nie masz w tym programie`), po przywróceniu
 * wrócił GREEN. Patrz meldunek robotnika 1.1-A5b.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auditGet, auditRun } from '../auditsDb.js';
import { assignCriterion, concludeCriterion, recordTest } from '../criterionService.js';
import { finalizeOutput } from '../outputService.js';
import { requireCapability } from '../permissions.js';
import { approveReport, generateReport, publishReport } from '../reportService.js';
import type { AuditActor } from '../types.js';
import { addMember, cleanupFixture, createFixture, requireRealPg, uid } from './testHelpers.js';

import {
  buildAuditReportConclusion,
  safePersistAuditReportConclusion,
  type AuditReportDocumentLike,
} from '../../conclusions/auditReportConclusionBridge.js';

const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  (process.env.DATABASE_URL || '').startsWith('postgres');

const suite = REAL_PG ? describe : describe.skip;

if (!REAL_PG) {
  // eslint-disable-next-line no-console
  console.warn(
    '[programOwnerFullChain.realdb.test.ts SKIPPED — clean skip, not a failure] wymaga ' +
      'NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://...',
  );
}

suite('program_owner — pełny łańcuch sesja → wynik → raport → wniosek (real Postgres)', () => {
  let organizationId = '';

  afterAll(async () => {
    if (!organizationId) return;
    // Sprzątanie WŁASNYCH tabel tego testu (spoza `cleanupFixture`), potem
    // fixture bazowy — organizationId jest unikalny per-run, więc DELETE po
    // nim nigdy nie rusza cudzych danych.
    await auditRun(`DELETE FROM conclusions WHERE organization_id = $1`, [organizationId]);
    await auditRun(`DELETE FROM conclusion_source_packs WHERE organization_id = $1`, [organizationId]);
    await auditRun(`DELETE FROM audit_reports WHERE organization_id = $1`, [organizationId]);
    await auditRun(`DELETE FROM audit_outputs WHERE organization_id = $1`, [organizationId]);
    await cleanupFixture(organizationId);

    // Kontrola zera po sprzątaniu (rekordy testowe nie mogą zostać w bazie).
    const leftovers = await Promise.all(
      [
        'conclusions',
        'conclusion_source_packs',
        'audit_reports',
        'audit_outputs',
        'audit_program_members',
        'audit_program_criteria',
        'audit_evidence',
        'audit_programs',
        'audit_packs',
      ].map(async (table) => {
        const row = await auditGet<{ count: string }>(
          `SELECT count(*)::text AS count FROM ${table} WHERE organization_id = $1`,
          [organizationId],
        );
        return [table, row?.count ?? '0'] as const;
      }),
    );
    for (const [table, count] of leftovers) {
      expect(count, `${table} powinno mieć 0 wierszy dla ${organizationId} po sprzątaniu`).toBe('0');
    }
  }, 60_000);

  it('program_owner SAM (bez lead_auditor/auditor) finalizuje wynik, tworzy, zatwierdza i publikuje raport, po czym rejestruje wniosek', async () => {
    requireRealPg();

    const fixture = await createFixture();
    organizationId = fixture.organizationId;

    const ownerUserId = uid('user-owner');
    await addMember(organizationId, fixture.programId, ownerUserId, 'program_owner');
    const owner: AuditActor = { organizationId, userId: ownerUserId, platformRole: 'user' };

    // Kontrola wstępna: to JEDYNA rola tego aktora w tym programie — gdyby
    // test przechodził dzięki jakiejś domyślnej roli, to złapałoby się tutaj.
    const access = await requireCapability(owner, fixture.programId, 'program.read');
    expect(access.roles).toEqual(['program_owner']);

    // 1) SESJA — praca merytoryczna na kryterium, JEDNYM aktorem:
    //    przypisanie (`criterion.assign`) → procedura testowa
    //    (`criterion.perform_test`) → wniosek o zgodności
    //    (`criterion.conclude`). To dokładnie ZNALEZISKO A5b: bez tych
    //    trzech capability solo program_owner nie mógł ruszyć pracy w
    //    sesji, mimo że miał już capability do wyniku/raportu.
    const assigned = await assignCriterion(organizationId, owner, fixture.criterionId, {
      auditorId: ownerUserId,
      auditeeId: null,
    });
    expect(assigned.assignedAuditorId).toBe(ownerUserId);

    const tested = await recordTest(organizationId, owner, fixture.criterionId, {
      procedurePerformed: 'Przegląd próbki dokumentów A5b',
      sampleDescription: '1 z 1',
      testPerformed: 'Porównanie zapisu z wymaganiem',
      testResult: 'fail',
      auditorNote: 'Test A5b',
    });
    expect(tested.workStatus).toBe('tested');

    const concluded = await concludeCriterion(organizationId, owner, fixture.criterionId, {
      auditorConclusion: 'Wniosek A5b — niezgodność bez wymogu akceptacji dowodu',
      conformityStatus: 'nonconforming',
    });
    expect(concluded.workStatus).toBe('concluded');
    expect(concluded.conformityStatus).toBe('nonconforming');

    // 2) SESJA → WYNIK: finalizacja Outputu (`output.finalize`).
    const output = await finalizeOutput(organizationId, owner, fixture.programId, {
      title: 'Wynik testowy A5',
    });
    expect(output.version).toBe(1);
    expect((output.payload as { findings?: unknown[] }).findings ?? []).toHaveLength(0);

    // 3) WYNIK → RAPORT (szkic): `report.draft`.
    const report = await generateReport(organizationId, owner, {
      programId: fixture.programId,
      outputId: output.id,
      reportKind: 'audit_report',
      title: 'Raport testowy A5',
    });
    expect(report.status).toBe('draft');

    // 4) Zatwierdzenie: `report.approve` (program_owner miał to już PRZED A5 —
    // sanity check, że nic tu nie zepsuliśmy).
    const approved = await approveReport(organizationId, owner, report.id);
    expect(approved.status).toBe('approved');

    // 5) RAPORT → PUBLIKACJA: `report.publish`.
    const published = await publishReport(organizationId, owner, report.id);
    expect(published.status).toBe('published');

    // 6) RAPORT → WNIOSEK: dokładnie ta sama para kroków, co
    // `POST /reports/:id/conclusion` w reports.routes.ts — ten sam strażnik
    // (`report.draft`), ten sam most (`buildAuditReportConclusion` +
    // `safePersistAuditReportConclusion`).
    await requireCapability(owner, published.programId, 'report.draft');

    const document = published.payload as unknown as AuditReportDocumentLike;
    const candidate = buildAuditReportConclusion(document, {
      reportId: published.id,
      reportTitle: published.title,
      reportStatus: published.status,
      reportVersion: published.version,
      programId: published.programId,
      programName: null,
      projectId: null,
    });
    expect(candidate).not.toBeNull();

    const persisted = await safePersistAuditReportConclusion({
      organizationId,
      actorUserId: owner.userId,
      document,
      source: {
        reportId: published.id,
        reportTitle: published.title,
        reportStatus: published.status,
        reportVersion: published.version,
        programId: published.programId,
        programName: null,
        projectId: null,
      },
    });
    expect(persisted).toBe(true);

    const conclusionRow = await auditGet<{ id: string; status: string }>(
      `SELECT id, status FROM conclusions
        WHERE organization_id = $1 AND source_module = 'audit'
          AND source_artifact_refs_json LIKE $2
        LIMIT 1`,
      [organizationId, `%${published.id}%`],
    );
    expect(conclusionRow?.id, 'wniosek musi mieć rodowód do raportu audytu').toBeTruthy();
  }, 60_000);

  it('sanity: bez roli program_owner w OGÓLE (brak wpisu w audit_program_members) łańcuch jest zablokowany od pierwszego kroku', async () => {
    requireRealPg();

    const fixture = await createFixture();
    try {
      const stranger: AuditActor = {
        organizationId: fixture.organizationId,
        userId: uid('user-stranger'),
        platformRole: 'user',
      };
      await expect(
        finalizeOutput(fixture.organizationId, stranger, fixture.programId, {}),
      ).rejects.toThrow(/output\.finalize|rol/i);
    } finally {
      await auditRun(`DELETE FROM audit_reports WHERE organization_id = $1`, [fixture.organizationId]);
      await auditRun(`DELETE FROM audit_outputs WHERE organization_id = $1`, [fixture.organizationId]);
      await cleanupFixture(fixture.organizationId);
    }
  }, 30_000);
});

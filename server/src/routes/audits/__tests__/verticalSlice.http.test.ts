/**
 * P5 — VERTICAL SLICE przez realny HTTP na realnym PostgreSQL.
 *
 * Poprzedni golden flow szedł przez serwisy. To nie wystarcza: między
 * serwisem a użytkownikiem stoi warstwa tras, uwierzytelnienie, walidacja
 * wejścia i kształt odpowiedzi — a właśnie tam ten projekt ma udokumentowaną
 * historię defektów (trasy kompletne w pliku, ale niezamontowane; endpoint
 * zwracający 404 mimo działającego kodu).
 *
 * Ten test buduje aplikację tym samym `initializeRoutes`, którego używa
 * produkcyjny bootstrap, i przechodzi całą drogę wyłącznie żądaniami HTTP:
 *
 *   Library → Session → praca na kryterium → Output → Report → Initiative
 *
 * Każdy krok to prawdziwe żądanie z tokenem, prawdziwy zapis do PostgreSQL
 * i sprawdzenie w bazie, że dane faktycznie tam są.
 *
 * Uruchamianie (z korzenia repo):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://<user>@127.0.0.1:5439/<db>" \
 *   npx vitest run server/src/routes/audits/__tests__/verticalSlice.http.test.ts
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';
import { auditAll, auditRun } from '../../../services/audits/auditsDb.js';

const RUN = Date.now();
const ORG = `slice-org-${RUN}`;

/** Aktorzy — celowo różni, żeby segregacja obowiązków miała kogo rozdzielać. */
const USERS = {
  admin: `slice-admin-${RUN}`,
  lead: `slice-lead-${RUN}`,
  auditee: `slice-auditee-${RUN}`,
  reviewer: `slice-reviewer-${RUN}`,
};

let app: express.Express;

function tokenFor(userId: string, role = 'admin'): string {
  return jwt.sign(
    {
      id: userId,
      email: `${userId}@example.test`,
      role,
      organizationId: ORG,
      isSuperAdmin: false,
      isDemo: false,
      jti: `jti-${userId}-${Math.random().toString(36).slice(2, 10)}`,
    },
    (config as unknown as { JWT_SECRET: string }).JWT_SECRET,
    { expiresIn: '30m' },
  );
}

function as(userId: string, role = 'admin') {
  const token = tokenFor(userId, role);
  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
  };
}

/** Rozpakowuje kopertę `{success, data}` albo surowe ciało. */
function body<T = Record<string, unknown>>(res: { body: unknown }): T {
  const b = res.body as { success?: boolean; data?: unknown };
  return (b && typeof b === 'object' && 'data' in b ? b.data : b) as T;
}

async function cleanup(): Promise<void> {
  for (const table of [
    'audit_initiative_proposals',
    'audit_reports',
    'audit_outputs',
    'audit_verifications',
    'audit_corrective_actions',
    'audit_management_responses',
    'audit_program_findings',
    'audit_evidence',
    'audit_evidence_requests',
    'audit_program_criteria',
    'audit_program_members',
    'audit_ai_proposals',
    'audit_programs',
  ]) {
    await auditRun(`DELETE FROM ${table} WHERE organization_id = $1`, [ORG]);
  }
  await auditRun(
    `DELETE FROM audit_pack_criteria WHERE pack_id IN (SELECT id FROM audit_packs WHERE organization_id = $1)`,
    [ORG],
  );
  await auditRun(`DELETE FROM audit_packs WHERE organization_id = $1`, [ORG]);
  await auditRun(`DELETE FROM audit_norm_sources WHERE organization_id = $1`, [ORG]);
}

beforeAll(async () => {
  app = express();
  app.use(express.json({ limit: '5mb' }));
  const { apiGateway } = await import('../../../Gateway.js');
  apiGateway.initializeRoutes(app);
  await cleanup();
}, 180_000);

afterAll(cleanup, 60_000);

describe('P5 — vertical slice: Library → Session → Output → Report → Initiative (HTTP)', () => {
  it('przechodzi całą drogę żądaniami HTTP i zostawia ślad w bazie', async () => {
    const admin = as(USERS.admin);
    const lead = as(USERS.lead);
    const auditee = as(USERS.auditee);
    const reviewer = as(USERS.reviewer);

    // ---------------------------------------------------- LIBRARY: źródło
    // Pakiet zweryfikowany opiera się na WŁASNEJ procedurze klienta — prawa
    // są bezsporne. Żaden pakiet w tym teście nie udaje normy ISO/IATF.
    const sourceRes = await admin.post('/api/audits/sources').send({
      sourceKey: `proc-qms-${RUN}`,
      title: 'Procedura obsługi zgłoszeń — Elmax Industries, wyd. 4',
      publisher: 'Elmax Industries',
      sourceVersion: 'wyd. 4 (2026)',
      sourceKind: 'internal_procedure',
      sourceType: 'INTERNAL_PROCEDURE',
      rightsStatus: 'owned_internal',
    });
    expect(sourceRes.status, JSON.stringify(sourceRes.body)).toBe(201);
    const source = body<{ id: string; sourceType: string; verificationStatus: string }>(sourceRes);
    expect(source.sourceType).toBe('INTERNAL_PROCEDURE');
    expect(source.verificationStatus).toBe('UNVERIFIED');

    const verifyRes = await admin
      .post(`/api/audits/sources/${source.id}/verify`)
      .send({ verificationStatus: 'VERIFIED', verificationNote: 'Sprawdzone z właścicielem procesu' });
    expect(verifyRes.status).toBe(200);
    const verified = body<{ sourceType: string; verificationStatus: string }>(verifyRes);
    // Sedno P0: weryfikacja nie przepisała natury dokumentu.
    expect(verified.verificationStatus).toBe('VERIFIED');
    expect(verified.sourceType).toBe('INTERNAL_PROCEDURE');

    // ---------------------------------------------------- LIBRARY: pakiet
    const packRes = await admin.post('/api/audits/packs').send({
      packKey: `slice-pack-${RUN}`,
      title: 'Audyt obsługi zgłoszeń — procedura klienta',
      sourceId: source.id,
      sourceType: 'INTERNAL_PROCEDURE',
      scope: 'Proces obsługi zgłoszeń klienta',
      objectives: 'Potwierdzić zgodność z procedurą wewnętrzną',
      requiredRoles: ['lead_auditor', 'auditee'],
      findingTaxonomy: [
        { key: 'conforming', label: 'Zgodne', nonConforming: false, requiresCorrectiveAction: false },
        { key: 'nonconforming', label: 'Niezgodne', nonConforming: true, requiresCorrectiveAction: true },
        {
          key: 'evidence_insufficient',
          label: 'Dowód niewystarczający',
          nonConforming: false,
          requiresCorrectiveAction: false,
        },
      ],
    });
    expect(packRes.status, JSON.stringify(packRes.body)).toBe(201);
    const pack = body<{ id: string }>(packRes);

    const criteriaRes = await admin.put(`/api/audits/packs/${pack.id}/criteria`).send({
      criteria: [
        { id: 'tmp-dom', nodeKind: 'domain', title: 'Obsługa zgłoszeń', ordinal: 0 },
        {
          id: 'tmp-c1',
          parentId: 'tmp-dom',
          nodeKind: 'criterion',
          ordinal: 1,
          refCode: 'OZ.1',
          title: 'Rejestracja zgłoszenia',
          requirementText: 'Zgłoszenie jest rejestrowane w ciągu jednego dnia roboczego.',
          sourceReference: 'Procedura, pkt 3.1',
          auditQuestion: 'Czy zgłoszenia z próby zarejestrowano w terminie?',
          auditProcedure: 'Pobierz próbę 10 zgłoszeń i porównaj daty.',
          expectedEvidence: [{ kind: 'system_export', description: 'Eksport rejestru' }],
          mandatory: true,
        },
      ],
    });
    expect(criteriaRes.status, JSON.stringify(criteriaRes.body)).toBe(200);

    await admin
      .post(`/api/audits/packs/${pack.id}/approve-expert`)
      .send({ note: 'Mapowanie sprawdzone' })
      .expect(200);
    const publishRes = await admin.post(`/api/audits/packs/${pack.id}/publish`).send({});
    expect(publishRes.status, JSON.stringify(publishRes.body)).toBe(200);

    // ---------------------------------------------------- SESSION (Processes)
    const programRes = await lead.post('/api/audits/programs').send({
      packId: pack.id,
      name: 'Audyt obsługi zgłoszeń — cykl testowy',
      objective: 'Potwierdzić zgodność procesu',
      scopeText: 'Dział obsługi klienta',
    });
    expect(programRes.status, JSON.stringify(programRes.body)).toBe(201);
    const program = body<{ program: { id: string; lifecycleState: string } }>(programRes);
    const programId = program.program.id;
    expect(program.program.lifecycleState).toBe('planning');

    // Snapshot kryteriów musi istnieć w BAZIE, nie tylko w odpowiedzi.
    const snapshot = await auditAll<{ id: string; ref_code: string; requirement_text: string }>(
      `SELECT id, ref_code, requirement_text FROM audit_program_criteria
        WHERE organization_id = $1 AND program_id = $2 AND node_kind = 'criterion'`,
      [ORG, programId],
    );
    expect(snapshot).toHaveLength(1);
    const criterionId = snapshot[0].id;
    expect(snapshot[0].requirement_text).toContain('jednego dnia roboczego');

    for (const [userId, role] of [
      [USERS.lead, 'lead_auditor'],
      [USERS.auditee, 'auditee'],
      [USERS.reviewer, 'reviewer'],
    ] as const) {
      await lead
        .post(`/api/audits/programs/${programId}/members`)
        .send({ userId, memberRole: role })
        .expect(201);
    }

    await lead
      .post(`/api/audits/programs/${programId}/transition`)
      .send({ targetState: 'preparation' })
      .expect(200);
    await lead
      .post(`/api/audits/programs/${programId}/transition`)
      .send({ targetState: 'fieldwork' })
      .expect(200);

    // ---------------------------------------------------- dowód
    const reqRes = await lead.post('/api/audits/evidence/requests').send({
      programId,
      criterionId,
      title: 'Eksport rejestru zgłoszeń',
      requestedFromUserId: USERS.auditee,
    });
    expect(reqRes.status, JSON.stringify(reqRes.body)).toBe(201);
    const evidenceRequest = body<{ id: string }>(reqRes);

    const evRes = await auditee.post('/api/audits/evidence').send({
      programId,
      criterionId,
      requestId: evidenceRequest.id,
      kind: 'system_export',
      title: 'Rejestr zgłoszeń — eksport CSV',
      materialId: 'mat-slice-001',
      materialVersion: 'v3',
    });
    expect(evRes.status, JSON.stringify(evRes.body)).toBe(201);
    const evidence = body<{ id: string; contentHash: string | null }>(evRes);
    expect(evidence.contentHash).toBeTruthy();

    await lead
      .post(`/api/audits/evidence/${evidence.id}/review`)
      .send({
        sufficiency: 'sufficient',
        reliability: 'reliable',
        currencyStatus: 'current',
        supportsConformity: false,
        accepted: true,
        reviewNote: 'Trzy z dziesięciu po terminie',
      })
      .expect(200);

    // ---------------------------------------------------- test i wniosek
    await lead
      .post(`/api/audits/criteria/${criterionId}/test`)
      .send({
        procedurePerformed: 'Porównano daty wpływu i rejestracji dla 10 zgłoszeń',
        sampleDescription: 'Próba 10 z 128',
        testPerformed: 'Porównanie dat',
        testResult: 'fail',
        auditorNote: 'Trzy przekroczenia terminu',
      })
      .expect(200);

    const concludeRes = await lead.post(`/api/audits/criteria/${criterionId}/conclude`).send({
      auditorConclusion: 'Wymaganie niespełnione — 3 z 10 po terminie',
      conformityStatus: 'nonconforming',
    });
    expect(concludeRes.status, JSON.stringify(concludeRes.body)).toBe(200);

    // ---------------------------------------------------- ustalenie
    const findingRes = await lead.post('/api/audits/findings').send({
      programId,
      criterionId,
      statement: 'Zgłoszenia nie zawsze rejestrowane w terminie',
      requirementText: 'Rejestracja w ciągu jednego dnia roboczego',
      conditionText: '3 z 10 zgłoszeń po terminie',
      classification: 'nonconforming',
      severity: 'medium',
      objectiveEvidence: [evidence.id],
      ownerUserId: USERS.auditee,
    });
    expect(findingRes.status, JSON.stringify(findingRes.body)).toBe(201);
    const finding = body<{ id: string; referenceCode: string }>(findingRes);

    await reviewer
      .post(`/api/audits/findings/${finding.id}/review`)
      .send({ decision: 'confirm', note: 'Oparte na dowodzie i teście' })
      .expect(200);

    await lead
      .post(`/api/audits/programs/${programId}/transition`)
      .send({ targetState: 'evidence_review' })
      .expect(200);
    await lead
      .post(`/api/audits/programs/${programId}/transition`)
      .send({ targetState: 'findings_review' })
      .expect(200);

    await auditee
      .post(`/api/audits/findings/${finding.id}/response`)
      .send({ position: 'accept', statement: 'Przyjmujemy. Brak alertu o zaleganiu.' })
      .expect(201);

    // ---------------------------------------------------- naprawa
    const correctionRes = await auditee.post('/api/audits/actions').send({
      findingId: finding.id,
      actionKind: 'correction',
      title: 'Uzupełnić rejestrację trzech zaległych zgłoszeń',
      ownerUserId: USERS.auditee,
      dueDate: '2026-09-01',
    });
    expect(correctionRes.status, JSON.stringify(correctionRes.body)).toBe(201);
    const correction = body<{ id: string }>(correctionRes);

    const correctiveRes = await auditee.post('/api/audits/actions').send({
      findingId: finding.id,
      actionKind: 'corrective_action',
      title: 'Alert o zgłoszeniu bez rejestracji po 8 godzinach',
      ownerUserId: USERS.auditee,
      dueDate: '2026-10-01',
    });
    expect(correctiveRes.status).toBe(201);
    const corrective = body<{ id: string }>(correctiveRes);

    await lead.post(`/api/audits/actions/${correction.id}/approve`).send({}).expect(200);
    await lead.post(`/api/audits/actions/${corrective.id}/approve`).send({}).expect(200);

    for (const actionId of [correction.id, corrective.id]) {
      await auditee
        .post(`/api/audits/actions/${actionId}/implementation`)
        .send({ evidenceId: evidence.id, note: 'Wdrożone' })
        .expect(200);
    }

    // ---------------------------------------------------- weryfikacja
    const planRes = await lead.post('/api/audits/actions/verifications').send({
      findingId: finding.id,
      correctiveActionId: corrective.id,
      verificationKind: 'effectiveness',
      method: 'resample',
      plannedDate: '2026-11-01',
    });
    expect(planRes.status, JSON.stringify(planRes.body)).toBe(201);
    const verification = body<{ id: string }>(planRes);

    await lead
      .post(`/api/audits/actions/verifications/${verification.id}/perform`)
      .send({ result: 'effective', note: 'Ponowna próba czysta', evidenceId: evidence.id })
      .expect(200);

    const closeRes = await reviewer
      .post(`/api/audits/findings/${finding.id}/close`)
      .send({ note: 'Zamknięte po potwierdzeniu skuteczności' });
    expect(closeRes.status, JSON.stringify(closeRes.body)).toBe(200);

    // ---------------------------------------------------- OUTPUT
    for (const target of [
      'management_response',
      'approval',
      'remediation',
      'effectiveness_verification',
      'closure',
    ]) {
      await lead
        .post(`/api/audits/programs/${programId}/transition`)
        .send({ targetState: target })
        .expect(200);
    }

    const outputRes = await lead
      .post('/api/audits/outputs/finalize')
      .send({ programId, title: 'Wynik audytu obsługi zgłoszeń' });
    expect(outputRes.status, JSON.stringify(outputRes.body)).toBe(201);
    const output = body<{ id: string; version: number; contentHash: string }>(outputRes);
    expect(output.version).toBe(1);
    expect(output.contentHash).toBeTruthy();

    // ---------------------------------------------------- REPORT
    const reportRes = await lead.post('/api/audits/reports').send({
      programId,
      outputId: output.id,
      reportKind: 'audit_report',
      title: 'Raport poaudytowy — obsługa zgłoszeń',
      language: 'pl',
    });
    expect(reportRes.status, JSON.stringify(reportRes.body)).toBe(201);
    const report = body<{ id: string; status: string }>(reportRes);
    expect(report.status).toBe('draft');

    // ---------------------------------------------------- INITIATIVE PROPOSAL
    const proposalRes = await lead
      .post('/api/audits/proposals')
      .send({ programId, findingIds: [finding.id] });
    expect(proposalRes.status, JSON.stringify(proposalRes.body)).toBe(201);
    const proposals = body<Array<{ id: string; sourceFindingIds: string[] }>>(proposalRes);
    const proposalList = Array.isArray(proposals) ? proposals : [proposals as never];
    expect(proposalList.length).toBeGreaterThan(0);

    // ---------------------------------------------------- LINEAGE Z BAZY
    // Nie z odpowiedzi HTTP — z tabel. Odpowiedź może kłamać, baza nie.
    const chain = await auditAll<Record<string, unknown>>(
      `SELECT f.reference_code, c.ref_code, c.test_result, c.conformity_status,
              e.material_version, e.content_hash,
              a.action_kind, v.result AS verification_result,
              o.version AS output_version, r.report_kind
         FROM audit_program_findings f
         JOIN audit_program_criteria c ON c.id = f.criterion_id
         JOIN audit_evidence e         ON e.criterion_id = c.id
         JOIN audit_corrective_actions a ON a.finding_id = f.id AND a.action_kind = 'corrective_action'
         JOIN audit_verifications v    ON v.corrective_action_id = a.id
         JOIN audit_outputs o          ON o.program_id = f.program_id
         JOIN audit_reports r          ON r.output_id = o.id
        WHERE f.id = $1 AND f.organization_id = $2`,
      [finding.id, ORG],
    );

    expect(chain).toHaveLength(1);
    expect(chain[0].ref_code).toBe('OZ.1');
    expect(chain[0].test_result).toBe('fail');
    expect(chain[0].conformity_status).toBe('nonconforming');
    expect(chain[0].material_version).toBe('v3');
    expect(chain[0].verification_result).toBe('effective');
    expect(chain[0].output_version).toBe(1);
    expect(chain[0].report_kind).toBe('audit_report');

    // Zdarzenia przeszły przez kontrakt kernela.
    const events = await auditAll<{ kernel_event_type: string | null; actor_kind: string }>(
      `SELECT kernel_event_type, actor_kind FROM audit_domain_events
        WHERE organization_id = $1 AND program_id = $2`,
      [ORG, programId],
    );
    expect(events.length).toBeGreaterThan(5);
    expect(events.every((e) => e.actor_kind === 'human')).toBe(true);
    expect(events.some((e) => e.kernel_event_type === 'DECISION_APPROVED')).toBe(true);
    expect(events.some((e) => e.kernel_event_type === 'OUTPUT_CREATED')).toBe(true);
  }, 300_000);

  it('reopen: dane przeżywają ponowny odczyt przez świeże żądanie HTTP', async () => {
    const lead = as(USERS.lead);
    const listRes = await lead.get('/api/audits/programs');
    expect(listRes.status).toBe(200);
    const programs = body<{ programs?: unknown[] } | unknown[]>(listRes);
    const arr = Array.isArray(programs) ? programs : ((programs as { programs?: unknown[] }).programs ?? []);
    expect(arr.length).toBeGreaterThan(0);
  }, 60_000);
});

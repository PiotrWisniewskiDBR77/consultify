/**
 * Acceptance E2E — H3 dowody (rejestr H3.1 + H3.4 + H3.5 + H6.13).
 *
 * REALNY runtime, zero mocków logiki biznesowej:
 *  - H3.1  SWOT tool-sesja: REALNY router `server/src/routes/tools.routes.ts`
 *          (ToolController.createToolSession/updateToolSession/getToolSession)
 *          za REALNYM verifyToken. create → answer (accepted SWOT items +
 *          wygenerowany W2 `answers.summary`) → reload (GET persist+reload)
 *          → dowód że wniosek (W2 verdict/executiveSummary) wylądował w
 *          tabeli `conclusions` przez CONCLUSION_LAYER bridge
 *          (`server/src/services/conclusions/toolConclusionBridge.ts`,
 *          wpięty fire-and-forget w `ToolController.updateToolSession`).
 *  - H3.4/H3.5 SIRI/ADMA: REALNY router
 *          `server/src/routes/assessment-workflow-v2.routes.ts`
 *          (AssessmentController.createAssessment/updateAssessment/
 *          getAssessment) za REALNYM verifyToken. create (assessmentType
 *          SIRI | ADMA) → zapis odpowiedzi + scoreSummary → reload (GET) —
 *          per typ, osobny dowód.
 *  - H6.13 Eksport PDF: REALNY serwis `server/src/services/reportPdfService.ts`
 *          (`renderReportPdf`, pure — pdfkit, brak DB/HTTP) wołany
 *          bezpośrednio na minimalnym wejściu (ten sam kontrakt co
 *          `reportPdf.routes.ts` GET /:reportId/pdf, który przekazuje wynik
 *          `statusReportService.getReport()` 1:1 do tej funkcji). Dowód:
 *          bufor zaczyna się od magic `%PDF-` i ma > 5 kB.
 *
 * Izolacja: prefiks `odbior--h3--`. Sprzątanie w afterAll. NIE push.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--h3--';

function evidence(line: string): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

// ---------------------------------------------------------------------------
// Apps — REAL routers, self-mounted auth (tools.routes.ts and
// assessment-workflow-v2.routes.ts both call router.use(verifyToken) /
// requireOrgAccess() / demoContextMiddleware INSIDE the router file itself),
// so buildApp only needs express.json() + the router mount.
// ---------------------------------------------------------------------------
async function buildToolsApp(): Promise<Express> {
  const toolsRouter = (await import('../../server/src/routes/tools.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/tools', toolsRouter);
  return app;
}

async function buildAssessmentApp(): Promise<Express> {
  const assessmentWorkflowV2Router = (
    await import('../../server/src/routes/assessment-workflow-v2.routes.js')
  ).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/assessment-workflow-v2', assessmentWorkflowV2Router);
  return app;
}

let toolsApp: Express;
let assessmentApp: Express;
let token: string;

const createdToolSessionIds: string[] = [];
const createdConclusionIds: string[] = [];
const createdAssessmentIds: string[] = [];

beforeAll(async () => {
  await seed(); // idempotent — org/user/membership odbioru
  toolsApp = await buildToolsApp();
  assessmentApp = await buildAssessmentApp();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (createdConclusionIds.length) {
      await client.query('DELETE FROM conclusions WHERE id = ANY($1)', [createdConclusionIds]);
    }
    if (createdToolSessionIds.length) {
      await client
        .query('DELETE FROM tool_initiative_links WHERE tool_session_id = ANY($1)', [
          createdToolSessionIds,
        ])
        .catch(() => {});
      await client
        .query('DELETE FROM tool_decisions WHERE tool_session_id = ANY($1)', [
          createdToolSessionIds,
        ])
        .catch(() => {});
      await client.query('DELETE FROM tool_sessions WHERE id = ANY($1)', [createdToolSessionIds]);
    }
    if (createdAssessmentIds.length) {
      await client
        .query('DELETE FROM assessment_sessions WHERE assessment_id = ANY($1)', [
          createdAssessmentIds,
        ])
        .catch(() => {});
      await client
        .query('DELETE FROM assessment_initiative_links WHERE assessment_id = ANY($1)', [
          createdAssessmentIds,
        ])
        .catch(() => {});
      await client
        .query('DELETE FROM assessment_decisions WHERE assessment_id = ANY($1)', [
          createdAssessmentIds,
        ])
        .catch(() => {});
      await client.query('DELETE FROM assessments WHERE id = ANY($1)', [createdAssessmentIds]);
    }
  } finally {
    await client.end();
  }
}, 30_000);

// ===========================================================================
// H3.1 — SWOT tool-sesja e2e (dynamicSwot): create → answer → W2 → reload
// ===========================================================================
describe('H3.1 — SWOT (dynamicSwot) tool-sesja e2e (real router + auth + DB)', () => {
  it('creates the session, saves accepted SWOT items + a W2 verdict, reloads, and the conclusion lands in `conclusions`', async () => {
    // 1) CREATE — POST /api/tools (real ToolController.createToolSession).
    const createRes = await request(toolsApp)
      .post('/api/tools')
      .set('Authorization', `Bearer ${token}`)
      .send({ toolType: 'dynamicSwot', name: `${PREFIX}swot-session` });

    expect(createRes.status).toBe(200);
    const sessionId: string = createRes.body?.id;
    expect(sessionId).toBeTruthy();
    expect(createRes.body?.status).toBe('DRAFT');
    const createdVersion: number = createRes.body?.version;
    expect(createdVersion).toBe(1);
    createdToolSessionIds.push(sessionId);
    evidence(`[h3.1] created tool_sessions.id=${sessionId} version=${createdVersion}`);

    // 2) ANSWER — PUT /api/tools/:id with an accepted SWOT item + a W2
    //    finishing block (summary.verdict/executiveSummary — the shape
    //    the tool-agnostic bridge reads, per toolConclusionBridge.ts).
    const verdict = 'Przewaga w segmencie B2B (61% przychodu) wymaga ochrony przed erozją marży.';
    const executiveSummary =
      'Analiza SWOT wskazuje silną pozycję rynkową klienta, ale rosnącą presję kosztową ze strony dwóch nowych konkurentów regionalnych.';
    const updateRes = await request(toolsApp)
      .put(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'IN_PROGRESS',
        completionPercent: 80,
        confidenceAvg: 4,
        expectedVersion: createdVersion,
        answers: {
          items: [
            {
              id: 'strength-1',
              text: 'Silna pozycja rynkowa — klient B2B odpowiada za 61% przychodu',
              proposalStatus: 'accepted',
            },
            {
              id: 'threat-1',
              text: 'Dwóch nowych konkurentów regionalnych',
              proposalStatus: 'accepted',
            },
          ],
          summary: {
            verdict,
            executiveSummary,
          },
        },
      });

    expect(updateRes.status, JSON.stringify(updateRes.body)).toBe(200);
    expect(updateRes.body?.id).toBe(sessionId);
    expect(updateRes.body?.version).toBe(createdVersion + 1);
    evidence(
      `[h3.1] PUT answers ok, status=${updateRes.body?.status} version=${createdVersion}->${updateRes.body?.version}`
    );

    // 3) RELOAD — GET /api/tools/:id: proves answers PERSISTED + reload.
    const getRes = await request(toolsApp)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body?.version).toBe(createdVersion + 1);
    expect(getRes.body?.answers?.summary?.verdict).toBe(verdict);
    expect(getRes.body?.answers?.items).toHaveLength(2);
    evidence(
      `[h3.1] reload OK — answers.summary.verdict="${getRes.body?.answers?.summary?.verdict}"`
    );

    // 4) CONCLUSION (W2) — the update triggers safePersistToolSessionConclusion
    //    fire-and-forget; poll `conclusions` briefly (same-process async write).
    const client = pgClient();
    await client.connect();
    try {
      let row: any = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const res = await client.query(
          `SELECT id, title, statement, confidence_level, status
           FROM conclusions
           WHERE organization_id = $1 AND source_module = 'tool'
             AND source_artifact_refs_json LIKE $2
           LIMIT 1`,
          [SEED.ORG_ID, `%${sessionId}%`]
        );
        if (res.rows.length) {
          row = res.rows[0];
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }

      expect(row).not.toBeNull();
      expect(row.id).toBeTruthy();
      expect(String(row.statement || '').length).toBeGreaterThan(0);
      expect(row.statement).toContain(verdict);
      createdConclusionIds.push(row.id);
      evidence(
        `[h3.1] W2 conclusion persisted — conclusions.id=${row.id} status=${row.status} statement.length=${row.statement.length}`
      );
    } finally {
      await client.end();
    }
  });
});

// ===========================================================================
// H3.4 / H3.5 — SIRI / ADMA assessment e2e: create → answers/score → reload
// ===========================================================================
describe.each([
  { type: 'SIRI', label: 'H3.4' },
  { type: 'ADMA', label: 'H3.5' },
])('$label — $type assessment e2e (real router + auth + DB)', ({ type }) => {
  it(`creates a ${type} assessment, records answers + score, reloads, and the state persists`, async () => {
    // 1) CREATE — POST /api/assessment-workflow-v2 (AssessmentController.createAssessment).
    //    Requires an admin-tier globalRole; SEED.ROLE='OWNER' qualifies
    //    (isGlobalAdminRole in assessment-workflow-v2.routes.ts).
    const createRes = await request(assessmentApp)
      .post('/api/assessment-workflow-v2')
      .set('Authorization', `Bearer ${token}`)
      .send({ assessmentType: type, name: `${PREFIX}${type.toLowerCase()}-assessment` });

    expect(createRes.status).toBe(200);
    const assessmentId: string = createRes.body?.id;
    expect(assessmentId).toBeTruthy();
    expect(createRes.body?.status).toBe('DRAFT');
    createdAssessmentIds.push(assessmentId);
    evidence(`[${type}] created assessments.id=${assessmentId}`);

    // 2) ANSWER + SCORE — PUT /:assessmentId (AssessmentController.updateAssessment).
    const answers = {
      axis1: { area1: { level: 3, notes: `${type} odpowiedź osi 1` } },
      axis2: { area1: { level: 2, notes: `${type} odpowiedź osi 2` } },
    };
    const scoreSummary = {
      overallScore: 62,
      maturityLevel: type === 'SIRI' ? 'Band 2' : 'Level 3',
    };
    const updateRes = await request(assessmentApp)
      .put(`/api/assessment-workflow-v2/${assessmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers,
        completionPercent: 55,
        confidenceAvg: 4,
        scoreSummary,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body?.id).toBe(assessmentId);
    evidence(`[${type}] PUT answers+score ok`);

    // 3) RELOAD — GET /:assessmentId: proves persist + reload.
    const getRes = await request(assessmentApp)
      .get(`/api/assessment-workflow-v2/${assessmentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body?.assessment_type).toBe(type);
    expect(getRes.body?.answers?.axis1?.area1?.level).toBe(3);
    expect(getRes.body?.scoreSummary?.overallScore).toBe(62);
    evidence(
      `[${type}] reload OK — assessments.id=${assessmentId} assessment_type=${getRes.body?.assessment_type} ` +
        `overallScore=${getRes.body?.scoreSummary?.overallScore} maturityLevel=${getRes.body?.scoreSummary?.maturityLevel}`
    );
  });
});

// ===========================================================================
// H6.13 — Eksport PDF: realny serwis (reportPdfService.renderReportPdf)
// ===========================================================================
describe('H6.13 — PDF export mechanika (real reportPdfService, minimal input)', () => {
  it('renders a real PDF buffer (%PDF- magic, >5kB) from a minimal status-report shape', async () => {
    const { renderReportPdf } = (await import('../../server/src/services/reportPdfService.js'))
      .default;

    const pdf = await renderReportPdf({
      title: `${PREFIX}status-report`,
      initiativeName: `${PREFIX}initiative`,
      period: 'Q3 2026',
      overallStatus: 'AMBER',
      executiveSummary:
        'Inicjatywa postępuje zgodnie z harmonogramem, ale budżet wykazuje presję kosztową ' +
        'w drugim kwartale — wymagana korekta zakresu lub dodatkowe finansowanie.',
      sections: [
        {
          name: 'SCHEDULE',
          status: 'GREEN',
          content:
            'Wszystkie kamienie milowe Q3 dostarczone na czas. Zespół utrzymuje tempo ' +
            'sprintów zgodne z planem bazowym; brak odchyleń na ścieżce krytycznej.',
          highlights: [
            'Kamień milowy M1 zamknięty tydzień przed terminem',
            'Zespół deweloperski utrzymał velocity 42 punkty/sprint trzeci sprint z rzędu',
          ],
          issues: [],
        },
        {
          name: 'BUDGET',
          status: 'AMBER',
          content:
            'Wydatki 12% powyżej planu z powodu dodatkowych zasobów wdrożeniowych ' +
            'zaangażowanych do integracji z systemem klienta oraz nadgodzin zespołu QA.',
          highlights: [],
          issues: [
            'Przekroczenie budżetu Q3 o 12%',
            'Wymagana rewizja prognozy Q4',
            'Dodatkowy koszt integracji nieujęty w pierwotnym budżecie',
          ],
        },
        {
          name: 'SCOPE',
          status: 'RED',
          content:
            'Dwa żądania zmiany zakresu oczekują na decyzję sponsora, co blokuje ' +
            'planowanie sprintu 7 i grozi poślizgiem daty uruchomienia produkcyjnego.',
          highlights: [],
          issues: [
            'CR-014 blokuje ścieżkę krytyczną',
            'CR-017 wymaga dodatkowej analizy technicznej przed wyceną',
          ],
        },
        {
          name: 'QUALITY',
          status: 'GREEN',
          content:
            'Pokrycie testami automatycznymi utrzymane na poziomie 87%; brak defektów ' +
            'krytycznych w środowisku staging od trzech tygodni.',
          highlights: ['Zero defektów P1 w bieżącym okresie sprawozdawczym'],
          issues: [],
        },
        {
          name: 'RESOURCES',
          status: 'AMBER',
          content:
            'Obciążenie zespołu wdrożeniowego przekracza planowane 100% w dwóch ' +
            'kolejnych sprintach; rekomendowane wzmocnienie o jednego inżyniera backend.',
          highlights: [],
          issues: ['Ryzyko wypalenia zespołu przy utrzymaniu obecnego tempa'],
        },
        {
          name: 'STAKEHOLDERS',
          status: 'GREEN',
          content:
            'Komitet sterujący potwierdził priorytety na Q4; cotygodniowe spotkania ' +
            'statusowe z klientem przebiegają zgodnie z harmonogramem komunikacji.',
          highlights: ['Pozytywna ocena demo Q3 przez sponsora biznesowego'],
          issues: [],
        },
      ],
      narrative: {
        accomplishments: [
          'Wdrożono moduł raportowania statusu z eksportem PDF',
          'Zamknięto 8 z 10 zadań sprintu bez przenoszenia zakresu',
          'Ukończono integrację z systemem klienta w środowisku staging',
          'Przeprowadzono warsztat retro z udziałem sponsora biznesowego',
        ],
        nextSteps: [
          'Decyzja sponsora ws. CR-014 do końca tygodnia',
          'Rewizja budżetu Q4 na spotkaniu komitetu sterującego',
          'Wzmocnienie zespołu wdrożeniowego o inżyniera backend',
          'Domknięcie wyceny CR-017 przed planowaniem sprintu 7',
        ],
        escalations: [
          'Budżet Q3 przekroczony o 12% — wymaga akceptacji sponsora',
          'Obciążenie zespołu powyżej 100% w dwóch kolejnych sprintach',
        ],
        risksAndIssues:
          'Ryzyko poślizgu zakresu przy braku decyzji w ciągu 2 tygodni; ryzyko ' +
          'wypalenia zespołu wdrożeniowego przy utrzymaniu obecnego obciążenia.',
        recommendations:
          'Zamrozić zakres do czasu decyzji sponsora; przyspieszyć CR-014; ' +
          'zaakceptować rewizję budżetu Q4; wzmocnić zespół wdrożeniowy o jeden etat.',
      },
      generatedAt: new Date('2026-07-18T12:00:00.000Z'),
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    const magic = pdf.subarray(0, 5).toString('utf8');
    expect(magic).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5 * 1024);
    evidence(`[h6.13] PDF rendered — bytes=${pdf.length} magic="${magic}"`);
  });
});

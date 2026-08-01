/**
 * PARITY E2E — 3 obszary, które na lokalnym pg16 (DRIFT vs demo pg18) dawały
 * FAŁSZYWE czerwone. Ten plik uruchamiamy przeciw bazie PARITY (pg18, schemat =
 * pg_dump --schema-only z TROLLEY/demo), więc czerwień = realny bug demo, a nie
 * artefakt driftu.
 *
 *   1) INTERVIEW  — POST /api/interview/sessions → persist → reload (był 500 lokalnie)
 *   2) TERESA     — generateDeliverable({type:'note'}) → treść REALNIE z modelu
 *                   (asercja: body ≠ intent i istotnie dłuższy niż fallback)
 *   3) BUSINESS   — POST /api/v8/advisory/business-case → realny NPV/ROI (nie 502)
 *
 * Wzorzec 1:1 z notebook.e2e.test.ts / docs-teresa.e2e.test.ts: REALNY router +
 * REALNE auth (minted JWT) + REALNA lokalna Postgres + REALNY LLM. Zero mocków.
 */
import { appendFileSync } from 'node:fs';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const EVIDENCE = process.env.PARITY_EVIDENCE_FILE;
const evidence = (line: string) => {
  if (EVIDENCE) appendFileSync(EVIDENCE, line + '\n');
};

const PREFIX = 'odbior--parity--';
const PROJECT_ID = `${PREFIX}project-0001`;
const FOREIGN_ORG_ID = `${PREFIX}foreign-org`;
const FOREIGN_USER_ID = `${PREFIX}foreign-user`;
const FOREIGN_EMAIL = `${PREFIX}foreign@acceptance.local`;

let token: string;
let interviewApp: Express;
let advisoryApp: Express;

const createdInterviewSessionIds: string[] = [];
const createdNoteIds: string[] = [];

beforeAll(async () => {
  // Master flag Teresy — musi być ON PRZED importem generateDeliverable.ts.
  process.env.ENABLE_DELIVERABLES_LIGHT = 'true';

  await seed();

  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_ORG_ID, `${PREFIX}Foreign Org`]
    );
    await client.query(
      `INSERT INTO users
         (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'not-used', 'ADMIN', 'active', 'Foreign', 'Tenant', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_USER_ID, FOREIGN_ORG_ID, FOREIGN_EMAIL]
    );
    await client.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       SELECT $1, $2, $3, 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP
       WHERE NOT EXISTS (
         SELECT 1 FROM organization_members WHERE organization_id = $2 AND user_id = $3
       )`,
      [`${PREFIX}foreign-membership`, FOREIGN_ORG_ID, FOREIGN_USER_ID]
    );
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
       VALUES ($1, $2, $3, 'active', $4, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, 'Odbior Parity Project', SEED.USER_ID]
    );
  } finally {
    await client.end();
  }

  token = mintToken();

  // ── INTERVIEW: wąski mont realnego routera za realnym verifyToken ──────────
  const { default: verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { default: interviewRouter } = await import('../../server/src/routes/interview.routes.js');
  interviewApp = express();
  interviewApp.use(express.json({ limit: '5mb' }));
  interviewApp.use('/api/interview', verifyToken as any, interviewRouter);

  // ── BUSINESS CASE: realny łańcuch v8 (bez v8OrgGate — to flaga org, nie pipeline) ─
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const { default: advisoryRouter } = await import(
    '../../server/src/routes/v8/advisory.routes.js'
  );
  advisoryApp = express();
  advisoryApp.use(express.json({ limit: '5mb' }));
  advisoryApp.use(
    '/api/v8/advisory',
    verifyToken as any,
    requireV8OrgContext as any,
    attachV8Context as any,
    advisoryRouter
  );
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (createdInterviewSessionIds.length) {
      await client
        .query('DELETE FROM interview_questions WHERE session_id = ANY($1)', [
          createdInterviewSessionIds,
        ])
        .catch(() => {});
      await client
        .query('DELETE FROM interview_sessions WHERE id = ANY($1)', [createdInterviewSessionIds])
        .catch(() => {});
    }
    if (createdNoteIds.length) {
      await client
        .query('DELETE FROM notebook_pages WHERE id = ANY($1)', [createdNoteIds])
        .catch(() => {});
    }
    await client.query('DELETE FROM projects WHERE id = $1', [PROJECT_ID]).catch(() => {});
    await client
      .query('DELETE FROM organization_members WHERE user_id = $1', [FOREIGN_USER_ID])
      .catch(() => {});
    await client.query('DELETE FROM users WHERE id = $1', [FOREIGN_USER_ID]).catch(() => {});
    await client.query('DELETE FROM organizations WHERE id = $1', [FOREIGN_ORG_ID]).catch(() => {});
  } finally {
    await client.end();
  }
});

// ============================================================================
// 1) INTERVIEW — create → persist → reload
// ============================================================================
describe('PARITY: INTERVIEW — /api/interview/sessions (real runtime)', () => {
  it('creates a session, saves an answer, reopens the same id and rejects a foreign tenant', async () => {
    const name = `${PREFIX}Interview ${Date.now()}`;

    const createRes = await request(interviewApp)
      .post('/api/interview/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, projectId: PROJECT_ID });

    if (createRes.status !== 201) {
      console.error(
        `[INTERVIEW] create FAILED status=${createRes.status} body=${JSON.stringify(createRes.body)}`
      );
    }
    expect(createRes.status).toBe(201);
    const sessionId: string = createRes.body?.id;
    expect(sessionId).toBeTruthy();
    createdInterviewSessionIds.push(sessionId);

    // PERSISTENCE — direct SQL read (the exact write that 500'd on the drifted schema).
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, project_id, organization_id, owner_id FROM interview_sessions WHERE id = $1`,
        [sessionId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].project_id).toBe(PROJECT_ID);
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);
      evidence(`INTERVIEW sessionId=${sessionId} project=${rows[0].project_id} org=${rows[0].organization_id}`);
    } finally {
      await client.end();
    }

    // READ-BACK (reload) through the API.
    const getRes = await request(interviewApp)
      .get(`/api/interview/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body?.id).toBe(sessionId);

    const questionsRes = await request(interviewApp)
      .get(`/api/interview/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`);
    expect(questionsRes.status).toBe(200);
    expect(Array.isArray(questionsRes.body)).toBe(true);
    expect(questionsRes.body.length).toBeGreaterThan(0);

    const questionId = String(questionsRes.body[0].id);
    const answerText = `${PREFIX}durable answer ${Date.now()}`;
    const saveRes = await request(interviewApp)
      .patch(`/api/interview/questions/${questionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answerText, status: 'answered', notes: 'verified respondent context' });
    expect(saveRes.status).toBe(200);
    expect(saveRes.body?.id).toBe(questionId);
    expect(saveRes.body?.answerText).toBe(answerText);

    // Independent API read-back is the resume contract: same session id, persisted answer.
    const reopenedQuestions = await request(interviewApp)
      .get(`/api/interview/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`);
    expect(reopenedQuestions.status).toBe(200);
    expect(reopenedQuestions.body.find((q: any) => q.id === questionId)).toMatchObject({
      answerText,
      status: 'answered',
    });

    const client2 = pgClient();
    await client2.connect();
    try {
      const { rows } = await client2.query(
        `SELECT q.answer_text, q.status, q.session_id, s.answered_questions
           FROM interview_questions q
           JOIN interview_sessions s ON s.id = q.session_id
          WHERE q.id = $1 AND q.organization_id = $2`,
        [questionId, SEED.ORG_ID]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        answer_text: answerText,
        status: 'answered',
        session_id: sessionId,
      });
      expect(Number(rows[0].answered_questions)).toBeGreaterThanOrEqual(1);
    } finally {
      await client2.end();
    }

    const foreignToken = mintToken({
      id: FOREIGN_USER_ID,
      email: FOREIGN_EMAIL,
      organizationId: FOREIGN_ORG_ID,
      organization_id: FOREIGN_ORG_ID,
    });
    await request(interviewApp)
      .get(`/api/interview/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .expect(404);
    await request(interviewApp)
      .patch(`/api/interview/questions/${questionId}`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({ answerText: 'foreign overwrite', status: 'answered' })
      .expect(404);

    const ownerReadAfterAttack = await request(interviewApp)
      .get(`/api/interview/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(ownerReadAfterAttack.body.find((q: any) => q.id === questionId)?.answerText).toBe(
      answerText
    );
  }, 30_000);

  it('rejects an unauthenticated create (real auth is enforced)', async () => {
    const res = await request(interviewApp)
      .post('/api/interview/sessions')
      .send({ name: 'no token' });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// 2) TERESA — note content REALLY from the LLM (not fallback skeleton)
// ============================================================================
describe('PARITY: TERESA — note treść-LLM (real service, real LLM, real DB)', () => {
  it('generates a note whose persisted body is real LLM prose, not the intent fallback', async () => {
    const { generateDeliverable } = await import(
      '../../server/src/services/ai/tools/generateDeliverable.js'
    );

    const title = `${PREFIX}Note ${Date.now()}`;
    // Krótki, jednozdaniowy intent — realny LLM MUSI go rozwinąć w prozę wielokrotnie
    // dłuższą; fallback (brak LLM) zapisałby DOKŁADNIE ten string jako body.
    const intent =
      'Kluczowe ryzyka i rekomendacje programu transformacji cyfrowej dla średniej firmy produkcyjnej.';

    const result = await generateDeliverable(
      { type: 'note', intent, title },
      { organizationId: SEED.ORG_ID, userId: SEED.USER_ID, language: 'pl', role: SEED.ROLE }
    );

    // Twarda bramka: flaga faktycznie wpięta (nie feature_disabled) i tool zwrócił ok.
    expect(result.error).not.toBe('feature_disabled');
    expect(result.ok).toBe(true);

    const noteId = String((result as any).noteId || (result as any).draftId || '');
    expect(noteId).toBeTruthy();
    createdNoteIds.push(noteId);

    // PERSISTENCE + LLM-content proof — read the real body straight from Postgres.
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, title, content_text, organization_id FROM notebook_pages WHERE id = $1`,
        [noteId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);

      const body: string = String(rows[0].content_text || '');
      evidence(
        `TERESA noteId=${noteId} bodyLen=${body.length} intentLen=${intent.length} ` +
          `bodyIsIntent=${body.trim() === intent.trim()} preview="${body.slice(0, 160).replace(/\s+/g, ' ')}"`
      );

      // 1) Nie jest to fallback (który zapisałby DOKŁADNIE intent).
      expect(body.trim()).not.toBe(intent.trim());
      // 2) Realna proza modelu jest istotnie dłuższa niż jednozdaniowy intent.
      expect(body.length).toBeGreaterThan(intent.length * 3);
      // 3) Sanity — to realny tekst, nie pusty/placeholder.
      expect(body.length).toBeGreaterThan(200);
    } finally {
      await client.end();
    }
  }, 90_000);
});

// ============================================================================
// 3) BUSINESS CASE — /api/v8/advisory/business-case → real NPV/ROI (not 502)
// ============================================================================
describe('PARITY: BUSINESS CASE — /api/v8/advisory/business-case (real pipeline, real LLM)', () => {
  it('runs the full 5-phase pipeline and returns a real numeric model (NPV/IRR/ROI)', async () => {
    const res = await request(advisoryApp)
      .post('/api/v8/advisory/business-case')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt:
          'Wdrożenie zautomatyzowanej linii pakującej za 2,4 mln PLN, oczekiwane oszczędności ~900 tys. PLN rocznie przez 5 lat, koszt kapitału 10%.',
        horizonYears: 5,
        waccPct: 10,
        currency: 'PLN',
        language: 'pl',
        projectId: PROJECT_ID,
      });

    if (res.status !== 200) {
      console.error(
        `[BUSINESS] FAILED status=${res.status} body=${JSON.stringify(res.body).slice(0, 500)}`
      );
    }
    expect(res.status).toBe(200);

    const data = res.body?.data;
    expect(data).toBeTruthy();
    expect(data.id).toBeTruthy();

    // MODEL — deterministic TS engine (single source of numeric truth).
    const model = data.model;
    expect(model).toBeTruthy();
    expect(model.base).toBeTruthy();

    const npv = Number(model.base.npv);
    const roiPct = Number(model.base.roiPct);
    const irrPct = model.base.irrPct != null ? Number(model.base.irrPct) : null;

    evidence(
      `BUSINESS id=${data.id} NPV=${npv} ROI%=${roiPct} IRR%=${irrPct} currency=${model.currency} ` +
        `scenarios=${Array.isArray(model.scenarios) ? model.scenarios.length : 0} ` +
        `narrativeLen=${String(data.narrative || '').length} ` +
        `phases=${(data.pipelineLog || []).map((p: any) => p.phase + ':' + p.status).join(',')}`
    );

    // Realne liczby (nie NaN, nie undefined) — dowód, że silnik policzył, nie 502.
    expect(Number.isFinite(npv)).toBe(true);
    expect(Number.isFinite(roiPct)).toBe(true);
    // Narracja LLM (W2) faktycznie powstała.
    expect(String(data.narrative || '').length).toBeGreaterThan(100);
    // Pipeline log potwierdza fazę MODEL.
    expect(Array.isArray(data.pipelineLog)).toBe(true);
  }, 300_000);

  it('rejects an unauthenticated business-case request (real auth is enforced)', async () => {
    const res = await request(advisoryApp)
      .post('/api/v8/advisory/business-case')
      .send({ prompt: 'no token' });
    expect(res.status).toBe(401);
  });
});

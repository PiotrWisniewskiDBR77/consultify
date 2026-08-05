import fs from 'node:fs/promises';

import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  LEGACY_FLAG_FALSE,
  LEGACY_FLAG_TRUE,
} from '../../server/src/services/interview/interviewLegacyFlags.js';
import { SEED, seed } from '../acceptance/seed.mjs';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://consultinity:consultinity@localhost:5442/consultinity';
process.env.DATABASE_URL = DATABASE_URL;
process.env.DB_TYPE = 'postgres';

const PREFIX = `int001-${Date.now()}-`;
let TEMPLATE_ID = '';
let sessionAId = '';
const PROJECT_ID = `${PREFIX}project`;
const ORG_B = `${PREFIX}org-b`;
let app: Express;
let setFault: (typeof import('../../server/src/services/interview/interviewTemplatePublicationService.js'))['setTemplatePublicationFaultInjectorForTests'];
let getSnapshot: (typeof import('../../server/src/services/interview/interviewTemplatePublicationService.js'))['getPublishedInterviewTemplateSnapshot'];

async function db(): Promise<Client> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

beforeAll(async () => {
  await seed();
  const client = await db();
  try {
    await client.query(
      await fs.readFile(
        'server/migrations/20260802_int001_template_publication_versions.sql',
        'utf8'
      )
    );
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, 'INT-01 foreign org', 'enterprise', 'active', 1, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [ORG_B]
    );
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
       VALUES ($1, $2, 'INT-01 project', 'active', $3, NOW())`,
      [PROJECT_ID, SEED.ORG_ID, SEED.USER_ID]
    );
  } finally {
    await client.end();
  }

  const InterviewController = (await import('../../server/src/controllers/InterviewController.js'))
    .default;
  ({
    setTemplatePublicationFaultInjectorForTests: setFault,
    getPublishedInterviewTemplateSnapshot: getSnapshot,
  } = await import('../../server/src/services/interview/interviewTemplatePublicationService.js'));
  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: SEED.USER_ID,
      email: SEED.EMAIL,
      role: 'ADMIN',
      organizationId: req.header('x-test-org') || SEED.ORG_ID,
    };
    next();
  });
  app.post('/api/interview/templates', InterviewController.createTemplate);
  app.post('/api/interview/templates/:id/publish', InterviewController.publishTemplate);
  app.post('/api/interview/templates/:id/use', InterviewController.useTemplate);
  app.use((error: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: String(error?.message || error) });
  });
}, 30_000);

afterAll(async () => {
  setFault?.(null);
  const client = await db();
  try {
    await client.query(
      `DELETE FROM interview_questions WHERE session_id IN
       (SELECT id FROM interview_sessions WHERE name LIKE $1)`,
      [`${PREFIX}%`]
    );
    await client.query(`DELETE FROM interview_sessions WHERE name LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM interview_library_template_versions WHERE template_id = $1`, [
      TEMPLATE_ID,
    ]);
    await client.query(`DELETE FROM interview_library_template_questions WHERE template_id = $1`, [
      TEMPLATE_ID,
    ]);
    await client.query(`DELETE FROM interview_library_templates WHERE id = $1`, [TEMPLATE_ID]);
    // Szablony założone przez przypadki follow-upu (świeża fixture per case).
    await client.query(
      `DELETE FROM interview_library_template_versions WHERE template_id IN
       (SELECT id FROM interview_library_templates WHERE name LIKE $1)`,
      [`${PREFIX}%`]
    );
    await client.query(
      `DELETE FROM interview_library_template_questions WHERE template_id IN
       (SELECT id FROM interview_library_templates WHERE name LIKE $1)`,
      [`${PREFIX}%`]
    );
    await client.query(`DELETE FROM interview_library_templates WHERE name LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await client.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_B]);
  } finally {
    await client.end();
  }
});

const v1Questions = [
  {
    category: 'strategy',
    questionText: 'What is the v1 strategic priority?',
    sortOrder: 1,
    answerType: 'open',
    isRequired: true,
  },
];

describe('INT-01 — immutable Interview template publication versions', () => {
  it('creates a draft at version 0', async () => {
    const response = await request(app).post('/api/interview/templates').send({
      id: TEMPLATE_ID,
      name: 'INT-01 governed template',
      description: 'Draft before first publication',
      category: 'CUSTOM',
      scope: 'organization',
      status: 'draft',
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    TEMPLATE_ID = response.body.id;
    expect(response.body.version).toBe(0);
  });

  it('publishes v1 atomically and creates session A from that snapshot', async () => {
    const publication = await request(app)
      .post(`/api/interview/templates/${TEMPLATE_ID}/publish`)
      .send({
        expectedVersion: 0,
        template: {
          name: 'INT-01 governed template',
          category: 'CUSTOM',
          scope: 'private',
          isDefault: true,
        },
        questions: v1Questions,
      });
    expect(publication.status, JSON.stringify(publication.body)).toBe(200);
    // Kontrakt typu: wersja jest LICZBĄ na każdej publicznej powierzchni, a
    // top-level i snapshot niosą tę samą wartość — inaczej klient nie ma jak
    // porównać, co właściwie opublikował.
    expect(typeof publication.body.version).toBe('number');
    expect(publication.body.version).toBe(1);
    expect(typeof publication.body.snapshot.template.version).toBe('number');
    expect(publication.body.snapshot.template.version).toBe(publication.body.version);
    expect(publication.body.snapshot.template.template_scope).toBe('private');
    // M03R-002 (P2 review `cb47528a53`): `is_default` to kolumna TEXT. Ścieżka
    // publikacji zapisuje JEDNO kodowanie legacy; test pilnuje właśnie tego,
    // zamiast utrwalać czwarty wariant (`1`) obok `'0' | 'false' | 'true'`.
    expect(publication.body.snapshot.template.is_default).toBe(LEGACY_FLAG_TRUE);
    expect(publication.body.snapshot.questions).toHaveLength(1);

    const session = await request(app)
      .post(`/api/interview/templates/${TEMPLATE_ID}/use`)
      .send({ projectId: PROJECT_ID, name: `${PREFIX}session-a` });
    expect(session.status, JSON.stringify(session.body)).toBe(201);
    expect(session.body.id).toBeTruthy();
    expect(session.body.templateVersion).toBe(1);
    sessionAId = session.body.id;
    const client = await db();
    try {
      const copied = await client.query(
        `SELECT question_text FROM interview_questions WHERE session_id = $1`,
        [sessionAId]
      );
      expect(copied.rows.map((row) => row.question_text)).toEqual([
        'What is the v1 strategic priority?',
      ]);
    } finally {
      await client.end();
    }
  });

  it('publishes v2 while session A remains byte-for-byte on v1 and session B gets v2', async () => {
    const publication = await request(app)
      .post(`/api/interview/templates/${TEMPLATE_ID}/publish`)
      .send({
        expectedVersion: 1,
        template: { name: 'INT-01 governed template v2', category: 'CUSTOM' },
        questions: [
          {
            ...v1Questions[0],
            questionText: 'What is the v2 strategic priority?',
          },
        ],
      });
    expect(publication.status).toBe(200);
    expect(typeof publication.body.version).toBe('number');
    expect(publication.body.version).toBe(2);
    expect(publication.body.snapshot.template.version).toBe(2);

    const sessionB = await request(app)
      .post(`/api/interview/templates/${TEMPLATE_ID}/use`)
      .send({ projectId: PROJECT_ID, name: `${PREFIX}session-b` });
    expect(sessionB.status, JSON.stringify(sessionB.body)).toBe(201);
    expect(sessionB.body.templateVersion).toBe(2);

    const client = await db();
    try {
      const a = await client.query(
        `SELECT question_text FROM interview_questions WHERE session_id = $1 ORDER BY sort_order`,
        [sessionAId]
      );
      const b = await client.query(
        `SELECT question_text FROM interview_questions WHERE session_id = $1 ORDER BY sort_order`,
        [sessionB.body.id]
      );
      expect(a.rows.map((row) => row.question_text)).toEqual([
        'What is the v1 strategic priority?',
      ]);
      expect(b.rows.map((row) => row.question_text)).toEqual([
        'What is the v2 strategic priority?',
      ]);
      const versions = await client.query(
        `SELECT version FROM interview_library_template_versions
         WHERE template_id = $1 ORDER BY version`,
        [TEMPLATE_ID]
      );
      expect(versions.rows.map((row) => row.version)).toEqual([1, 2]);
    } finally {
      await client.end();
    }
  });

  it('uses optimistic concurrency so two publishers cannot both replace v2', async () => {
    const payload = {
      expectedVersion: 2,
      template: { name: 'Concurrent v3', category: 'CUSTOM' },
      questions: [{ ...v1Questions[0], questionText: 'Concurrent v3 question' }],
    };
    const [one, two] = await Promise.all([
      request(app).post(`/api/interview/templates/${TEMPLATE_ID}/publish`).send(payload),
      request(app).post(`/api/interview/templates/${TEMPLATE_ID}/publish`).send(payload),
    ]);
    expect([one.status, two.status].sort()).toEqual([200, 409]);
  });

  it('foreign tenant receives 404 and cannot publish', async () => {
    const response = await request(app)
      .post(`/api/interview/templates/${TEMPLATE_ID}/publish`)
      .set('x-test-org', ORG_B)
      .send({
        expectedVersion: 3,
        template: { name: 'Foreign overwrite', category: 'CUSTOM' },
        questions: v1Questions,
      });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('rolls back live changes and version snapshot after an injected mid-transaction failure', async () => {
    setFault((stage) => {
      if (stage === 'live-updated') throw new Error('int001 injected failure');
    });
    const failed = await request(app)
      .post(`/api/interview/templates/${TEMPLATE_ID}/publish`)
      .send({
        expectedVersion: 3,
        template: { name: 'Must roll back', category: 'CUSTOM' },
        questions: [{ ...v1Questions[0], questionText: 'Must not persist' }],
      });
    expect(failed.status).toBe(500);
    setFault(null);

    const client = await db();
    try {
      const template = await client.query(
        `SELECT name, version FROM interview_library_templates WHERE id = $1`,
        [TEMPLATE_ID]
      );
      const questions = await client.query(
        `SELECT question_text FROM interview_library_template_questions WHERE template_id = $1`,
        [TEMPLATE_ID]
      );
      expect(template.rows[0]).toMatchObject({ name: 'Concurrent v3', version: 3 });
      expect(questions.rows[0].question_text).toBe('Concurrent v3 question');
    } finally {
      await client.end();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Follow-up po review `cb47528a53` — każdy przypadek zakłada WŁASNY szablon,
  // żeby nie zależeć od pozycji w sekwencji v1→v2→v3 powyżej.
  // ─────────────────────────────────────────────────────────────────────────

  async function freshDraft(label: string): Promise<string> {
    const created = await request(app).post('/api/interview/templates').send({
      name: `${PREFIX}${label}`,
      description: 'follow-up fixture',
      category: 'CUSTOM',
      scope: 'organization',
      status: 'draft',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return created.body.id;
  }

  it('fresh read after publish returns the immutable snapshot with a numeric version', async () => {
    const id = await freshDraft('fresh-read');
    const published = await request(app)
      .post(`/api/interview/templates/${id}/publish`)
      .send({
        expectedVersion: 0,
        template: { name: `${PREFIX}fresh-read`, category: 'CUSTOM' },
        questions: [{ ...v1Questions[0], questionText: 'Fresh read question' }],
      });
    expect(published.status, JSON.stringify(published.body)).toBe(200);
    expect(published.body.version).toBe(1);

    // Read-path serwisu, nie pamięć procesu — dowód, że wersja jest TRWAŁA.
    const snapshot = await getSnapshot(SEED.ORG_ID, id, 1);
    expect(snapshot).toBeTruthy();
    expect(typeof snapshot!.template.version).toBe('number');
    expect(snapshot!.template.version).toBe(published.body.version);
    expect(snapshot!.questions.map((q: any) => q.question_text)).toEqual([
      'Fresh read question',
    ]);
  });

  it('stale expectedVersion is rejected without a new version and without partial mutation', async () => {
    const id = await freshDraft('stale-cas');
    await request(app)
      .post(`/api/interview/templates/${id}/publish`)
      .send({
        expectedVersion: 0,
        template: { name: `${PREFIX}stale-cas`, category: 'CUSTOM' },
        questions: [{ ...v1Questions[0], questionText: 'Committed question' }],
      })
      .expect(200);

    const stale = await request(app)
      .post(`/api/interview/templates/${id}/publish`)
      .send({
        // Klient trzyma wersję sprzed publikacji.
        expectedVersion: 0,
        template: { name: `${PREFIX}stale-cas OVERWRITTEN`, category: 'CUSTOM' },
        questions: [{ ...v1Questions[0], questionText: 'Must not persist' }],
      });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('TEMPLATE_VERSION_CONFLICT');

    const client = await db();
    try {
      const versions = await client.query(
        `SELECT version FROM interview_library_template_versions WHERE template_id = $1 ORDER BY version`,
        [id]
      );
      expect(versions.rows.map((r) => r.version)).toEqual([1]);
      const live = await client.query(
        `SELECT name, version FROM interview_library_templates WHERE id = $1`,
        [id]
      );
      // Odrzucenie nie może zostawić NICZEGO z odrzuconego żądania.
      expect(live.rows[0].name).toBe(`${PREFIX}stale-cas`);
      expect(live.rows[0].version).toBe(1);
      const questions = await client.query(
        `SELECT question_text FROM interview_library_template_questions WHERE template_id = $1`,
        [id]
      );
      expect(questions.rows.map((r) => r.question_text)).toEqual(['Committed question']);
    } finally {
      await client.end();
    }
  });

  it('a retry after a lost response does not create a second publication', async () => {
    const id = await freshDraft('lost-response');
    const payload = {
      expectedVersion: 0,
      template: { name: `${PREFIX}lost-response`, category: 'CUSTOM' },
      questions: [{ ...v1Questions[0], questionText: 'Only once' }],
    };
    const first = await request(app).post(`/api/interview/templates/${id}/publish`).send(payload);
    expect(first.status).toBe(200);

    // Klient nie zobaczył odpowiedzi i powtarza DOKŁADNIE to samo żądanie.
    const retry = await request(app).post(`/api/interview/templates/${id}/publish`).send(payload);
    expect(retry.status).toBe(409);

    const client = await db();
    try {
      const versions = await client.query(
        `SELECT count(*)::int AS n FROM interview_library_template_versions WHERE template_id = $1`,
        [id]
      );
      expect(versions.rows[0].n).toBe(1);
    } finally {
      await client.end();
    }
  });

  it('publishing with isDefault leaves exactly one default template in the organization', async () => {
    const first = await freshDraft('default-a');
    const second = await freshDraft('default-b');
    for (const [id, label] of [
      [first, 'default-a'],
      [second, 'default-b'],
    ] as const) {
      const res = await request(app)
        .post(`/api/interview/templates/${id}/publish`)
        .send({
          expectedVersion: 0,
          template: { name: `${PREFIX}${label}`, category: 'CUSTOM', isDefault: true },
          questions: [{ ...v1Questions[0], questionText: `${label} question` }],
        });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.snapshot.template.is_default).toBe(LEGACY_FLAG_TRUE);
    }

    const client = await db();
    try {
      const defaults = await client.query(
        `SELECT id FROM interview_library_templates
          WHERE organization_id = $1
            AND lower(coalesce(is_default::text, '')) IN ('1','true','t','yes')`,
        [SEED.ORG_ID]
      );
      expect(defaults.rows.map((r) => r.id)).toEqual([second]);
      // Poprzedni default zapisany JEDNYM kodowaniem, nie czwartym wariantem.
      const previous = await client.query(
        `SELECT is_default FROM interview_library_templates WHERE id = $1`,
        [first]
      );
      expect(previous.rows[0].is_default).toBe(LEGACY_FLAG_FALSE);
    } finally {
      await client.end();
    }
  });
});

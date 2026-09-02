/**
 * Generator 3 (`server/src/routes/assessment-reports.routes.ts`) uruchomiony
 * PRZEZ PRAWDZIWĄ TRASĘ HTTP, na tych samych danych co generatory 1 i 2
 * (zestaw Metalpol, `scripts/demo-seed/metalpolDrdDataset.ts`).
 *
 * Wzorzec harnessu skopiowany z `tests/acceptance/o1-drd-report-benchmark.e2e.test.ts`:
 * realny router + realny verifyToken + realny Postgres, zero mocków logiki.
 *
 * Mierzy cztery wyjścia generatora 3:
 *   POST /api/assessment-reports                       — utworzenie raportu (liczy axis_data)
 *   POST /api/assessment-reports/:id/generate          — sekcje pisane przez LLM
 *   GET  /api/assessment-reports/:id/drd-report        — HTML (ta trasa woła silnik generatora 2)
 *   GET  /api/assessment-reports/:id/export/pdf|pptx   — eksporty
 *
 * Wymaga LOKALNEJ bazy:
 *   DATABASE_URL=postgresql://... NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *     npx tsx scripts/dev/probe-drd-report-gen3-routes.ts
 */
import '../../tests/acceptance/harness.js';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';

import { mintToken, requireLocalDbUrl } from '../../tests/acceptance/harness.js';
import { seed, SEED } from '../../tests/acceptance/seed.mjs';
import { METALPOL_CLIENT, METALPOL_DRD_AREAS } from '../demo-seed/metalpolDrdDataset';

const PROJECT_ID = 'm03gen3--project-0001';
const ASSESSMENT_ID = 'm03gen3--assessment-0001';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, '..', '..', 'evidence/raport-oceny');

function pgClient() {
  return new pg.Client({ connectionString: requireLocalDbUrl() });
}

/** Odpowiedzi z zestawu Metalpol w kształcie, jaki trzyma produkt (`answers_json`). */
function buildAnswersJson(): string {
  const areas: Record<string, { achievedLevel: number; targetLevel: number }> = {};
  for (const a of METALPOL_DRD_AREAS) {
    areas[a.unitId] = { achievedLevel: a.currentLevel, targetLevel: a.targetLevel };
  }
  return JSON.stringify({ drd: { areas } });
}

async function seedFixtures(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
       VALUES ($1,$2,'M03 Gen3 Metalpol','active',$3,$4)
       ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, SEED.USER_ID, now]
    );
    await client.query(
      `INSERT INTO assessments (id, organization_id, project_id, status, name, assessment_type,
                                answers_json, created_at, updated_at, created_by)
       VALUES ($1,$2,$3,'IN_PROGRESS',$4,'DRD',$5,$6,$6,$7)
       ON CONFLICT (id) DO UPDATE SET answers_json = EXCLUDED.answers_json`,
      [
        ASSESSMENT_ID,
        SEED.ORG_ID,
        PROJECT_ID,
        `Ocena DRD · ${METALPOL_CLIENT.sessionRef}`,
        buildAnswersJson(),
        now,
        SEED.USER_ID,
      ]
    );
    // Nazwa organizacji trafia na okładkę raportu — ustawiamy klienta z zestawu.
    await client.query(`UPDATE organizations SET name = $1 WHERE id = $2`, [
      METALPOL_CLIENT.name,
      SEED.ORG_ID,
    ]);
  } finally {
    await client.end();
  }
}

async function cleanup(reportId: string | null): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    if (reportId) {
      await client.query(`DELETE FROM assessment_report_sections WHERE report_id = $1`, [reportId]);
      await client.query(`DELETE FROM assessment_reports WHERE id = $1`, [reportId]);
    }
    await client.query(`DELETE FROM assessments WHERE id = $1`, [ASSESSMENT_ID]);
    await client.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);
  } finally {
    await client.end();
  }
}

async function main() {
  requireLocalDbUrl();
  await seed();
  await seedFixtures();
  const token = mintToken();

  const { default: router } = await import('../../server/src/routes/assessment-reports.routes.js');
  const app: Express = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/assessment-reports', router);

  mkdirSync(OUT_DIR, { recursive: true });
  const log: string[] = [];
  const say = (line: string) => {
    log.push(line);
    // eslint-disable-next-line no-console
    console.log(line);
  };

  let reportId: string | null = null;
  try {
    // 1. utworzenie raportu — trasa sama liczy axis_data z odpowiedzi
    const created = await request(app)
      .post('/api/assessment-reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ assessmentId: ASSESSMENT_ID, name: `Raport z oceny DRD — ${METALPOL_CLIENT.name}` });
    say(`POST / → ${created.status} ${JSON.stringify(created.body).slice(0, 200)}`);
    if (created.status !== 201) throw new Error('nie udało się utworzyć raportu');
    reportId = String(created.body.id);

    // 1b. co realnie wylądowało w axis_data
    {
      const client = pgClient();
      await client.connect();
      const row = await client.query(`SELECT axis_data FROM assessment_reports WHERE id = $1`, [
        reportId,
      ]);
      await client.end();
      say(`axis_data zapisane przez produkt: ${JSON.stringify(row.rows[0]?.axis_data)}`);
    }

    // 2. szablony
    const templates = await request(app)
      .get('/api/assessment-reports/templates')
      .set('Authorization', `Bearer ${token}`);
    say(`GET /templates → ${templates.status}, sztuk: ${
      Array.isArray(templates.body?.templates) ? templates.body.templates.length : '?'
    } ${JSON.stringify(templates.body).slice(0, 300)}`);

    // 3. generowanie sekcji przez LLM
    const firstTemplateId = Array.isArray(templates.body?.templates)
      ? templates.body.templates[0]?.id
      : undefined;
    const generated = await request(app)
      .post(`/api/assessment-reports/${reportId}/generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ templateId: firstTemplateId, language: 'pl' });
    say(
      `POST /:id/generate (templateId=${firstTemplateId ?? 'brak'}) → ${generated.status} ` +
        `${JSON.stringify(generated.body).slice(0, 300)}`
    );

    // 4. HTML przez trasę produkcyjną
    const htmlRes = await request(app)
      .get(`/api/assessment-reports/${reportId}/drd-report`)
      .query({ lang: 'pl' })
      .set('Authorization', `Bearer ${token}`);
    say(`GET /:id/drd-report → ${htmlRes.status}, bajtów: ${htmlRes.text?.length ?? 0}`);
    if (htmlRes.status === 200 && htmlRes.text) {
      writeFileSync(resolve(OUT_DIR, 'raport-oceny-3-html-przez-trase.html'), htmlRes.text, 'utf8');
    }

    // 5. eksporty
    for (const kind of ['pdf', 'pptx'] as const) {
      const res = await request(app)
        .get(`/api/assessment-reports/${reportId}/export/${kind}`)
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      say(`GET /:id/export/${kind} → ${res.status}, bajtów: ${(res.body as Buffer)?.length ?? 0}`);
      if (res.status === 200 && Buffer.isBuffer(res.body)) {
        writeFileSync(resolve(OUT_DIR, `raport-oceny-3-eksport.${kind}`), res.body);
      }
    }
  } finally {
    writeFileSync(resolve(OUT_DIR, 'raport-oceny-3-przebieg.txt'), `${log.join('\n')}\n`, 'utf8');
    await cleanup(reportId);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

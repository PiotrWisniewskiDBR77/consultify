/**
 * FIN-003A — real router + real local PostgreSQL statement-import acceptance.
 *
 * Run only through scripts/testing/run-fin003a-real-statement-e2e.mjs. Both the
 * runner and this test fail closed unless the target is the local
 * consultinity_test database.
 */
import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { mintToken } from './harness.js';
import { SEED, seed } from './seed.mjs';

const MARK = 'odbior--fin003a--';
const FILE_NAME = `${MARK}pnl-fy2025-pln.xlsx`;

function guardedDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('[FIN-003A] DATABASE_URL is unset');
  const url = new URL(raw);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || dbName !== 'consultinity_test') {
    throw new Error(`[FIN-003A] REFUSING database target host=${url.hostname} db=${dbName}`);
  }
  return raw;
}

function client(): pg.Client {
  return new pg.Client({ connectionString: guardedDatabaseUrl() });
}

function makeFixture(): Buffer {
  const rows = [
    ['Rachunek zysków i strat', 'FY2025', 'PLN'],
    ['Okres', '2025-01-01', '2025-12-31'],
    ['Przychody ze sprzedaży', 1_250_000, 'PLN'],
    ['Koszt własny sprzedaży', -700_000, 'PLN'],
    ['Zysk brutto', 550_000, 'PLN'],
    ['Koszty operacyjne', -300_000, 'PLN'],
    ['EBITDA', 250_000, 'PLN'],
    ['Amortyzacja', -50_000, 'PLN'],
    ['EBIT', 200_000, 'PLN'],
    ['Podatek dochodowy', -38_000, 'PLN'],
    ['Zysk netto', 162_000, 'PLN'],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'P&L FY2025');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

async function buildFinanceApp(): Promise<Express> {
  const router = (await import('../../server/src/routes/finance-statements.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/finance-statements', router);
  return app;
}

async function cleanup(): Promise<void> {
  const db = client();
  await db.connect();
  try {
    const statements = await db.query(
      `SELECT id FROM financial_statements WHERE source_file_name LIKE $1`,
      [`${MARK}%`]
    );
    for (const { id } of statements.rows) {
      await db.query(`DELETE FROM financial_statement_value_evidence WHERE statement_value_id IN (SELECT id FROM financial_statement_values WHERE statement_id = $1)`, [id]);
      const childTables = [
        'financial_statement_mapping_candidates',
        'financial_statement_candidate_rows',
        'financial_statement_extracted_sections',
        'financial_statement_quality_runs',
        'financial_statement_repair_sessions',
        'financial_statement_source_artifacts',
        'financial_statement_validations',
        'financial_statement_versions',
        'financial_statement_ingest_runs',
        'financial_statement_values',
      ];
      for (const table of childTables) {
        await db.query(`DELETE FROM ${table} WHERE statement_id = $1`, [id]);
      }
      await db.query(`DELETE FROM financial_statements WHERE id = $1`, [id]);
    }
    await db.query(
      `DELETE FROM financial_statement_packs WHERE source_file_name LIKE $1 OR entity_name LIKE $1`,
      [`${MARK}%`]
    );
  } finally {
    await db.end();
  }
}

describe('FIN-003A financial statement XLSX import — real route and PostgreSQL', () => {
  let app: Express;
  let token: string;
  let statementId: string;
  let foreignOrgId: string;

  beforeAll(async () => {
    guardedDatabaseUrl();
    await seed();
    await cleanup();
    app = await buildFinanceApp();
    token = mintToken();

    const db = client();
    await db.connect();
    try {
      foreignOrgId = `${MARK}foreign-org`;
      await db.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1, $2, 'enterprise', 'active', 1, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [foreignOrgId, `${MARK}Foreign Org`]
      );
    } finally {
      await db.end();
    }
  });

  afterAll(async () => {
    await cleanup();
    const db = client();
    await db.connect();
    try {
      await db.query(`DELETE FROM organizations WHERE id = $1`, [foreignOrgId]);
    } finally {
      await db.end();
    }
  });

  it('uploads, detects, extracts, maps, manually corrects, validates, confirms and reads back', async () => {
    const upload = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', makeFixture(), {
        filename: FILE_NAME,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    statementId = upload.body.statementId;
    expect(statementId).toBeTruthy();
    expect(upload.body.detection.statementType).toBe('P&L');
    expect(upload.body.detection.currency).toBe('PLN');
    expect(upload.body.parseMethod).toBe('excel_import');

    const detect = await request(app)
      .post(`/api/finance-statements/${statementId}/detect`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detect.body.detection.statementType).toBe('P&L');
    expect(detect.body.detection.currency).toBe('PLN');

    const extract = await request(app)
      .post(`/api/finance-statements/${statementId}/extract`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(extract.body.lines.length).toBeGreaterThanOrEqual(3);

    const mapping = await request(app)
      .post(`/api/finance-statements/${statementId}/map`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const mapped = mapping.body.mappedLines.filter((line: any) => line.suggestedCanonicalId);
    expect(mapped.length).toBeGreaterThanOrEqual(3);

    const correctionTarget = mapped.find((line: any) => /przychod/i.test(line.originalLabel)) || mapped[0];
    const correctedValue = Number(correctionTarget.value) + 1_234;
    const values = mapping.body.mappedLines.map((line: any) => ({
      canonicalLineId: line.suggestedCanonicalId || null,
      originalLabel: line.originalLabel,
      value: line === correctionTarget ? correctedValue : Number(line.value),
      confidence: Number(line.confidence || 0.8),
      sourceRow: line.sourceRow,
      mappingStatus: line === correctionTarget ? 'manual' : line.suggestedCanonicalId ? 'auto' : 'unmapped',
      valueOrigin: line === correctionTarget ? 'manual' : line.suggestedCanonicalId ? 'mapped' : 'source',
      manualOverrideReason: line === correctionTarget ? 'FIN-003A verified source correction' : null,
      evidenceJson:
        line === correctionTarget
          ? {
              sourceRow: line.sourceRow,
              lineageType: 'manual_note',
              manualCorrectionReason: 'FIN-003A verified source correction',
            }
          : undefined,
      isNonFinancial: Boolean(line.isNonFinancial),
    }));

    const save = await request(app)
      .put(`/api/finance-statements/${statementId}/values`)
      .set('Authorization', `Bearer ${token}`)
      .send({ values })
      .expect(200);
    expect(save.body.statementId).toBe(statementId);

    const validation = await request(app)
      .post(`/api/finance-statements/${statementId}/validate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(['pass', 'warnings']).toContain(validation.body.validation.status);
    expect(validation.body.readiness.isReady).toBe(true);

    const confirmation = await request(app)
      .post(`/api/finance-statements/${statementId}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(confirmation.body.status).toBe('confirmed');

    const readBack = await request(app)
      .get(`/api/finance-statements/${statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(readBack.body.status).toBe('confirmed');
    expect(readBack.body.values.length).toBeGreaterThanOrEqual(3);
    expect(readBack.body.versions.some((v: any) => v.version_kind === 'confirmed')).toBe(true);
    expect(readBack.body.qualityRuns.some((q: any) => q.stage === 'confirm')).toBe(true);
    expect(readBack.body.ingestRuns.some((run: any) => run.current_stage === 'confirm')).toBe(true);
    const corrected = readBack.body.values.find((v: any) => v.original_label === correctionTarget.originalLabel);
    expect(Number(corrected.value)).toBe(correctedValue);
    expect(corrected.value_origin).toBe('manual');
    expect(corrected.is_manually_corrected).toBe(true);
    expect(corrected.evidence_json).toMatchObject({
      lineageType: 'manual_note',
      manualCorrectionReason: 'FIN-003A verified source correction',
    });

    const db = client();
    await db.connect();
    try {
      const persisted = await db.query(
        `SELECT organization_id, status, readiness_status, values_version
           FROM financial_statements WHERE id = $1`,
        [statementId]
      );
      expect(persisted.rows[0].organization_id).toBe(SEED.ORG_ID);
      expect(persisted.rows[0].status).toBe('confirmed');
      expect(persisted.rows[0].readiness_status).toBe('ready');
      expect(Number(persisted.rows[0].values_version)).toBeGreaterThan(0);
    } finally {
      await db.end();
    }
  }, 120_000);

  it('does not expose the statement to a different tenant', async () => {
    const foreignToken = mintToken({ organizationId: foreignOrgId, organization_id: foreignOrgId });
    await request(app)
      .get(`/api/finance-statements/${statementId}`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .expect(404);
  });
});

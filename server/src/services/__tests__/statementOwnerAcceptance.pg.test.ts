import crypto from 'crypto';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { inputSanitizationMiddleware } from '../../middleware/inputSanitization.middleware.js';
import financeRoutes from '../../routes/v8/finance.routes.js';
import PDFParserService from '../pdfParserService.js';
import {
  createStatement,
  loadStatementSourceText,
  locateStatementSections,
} from '../financialStatementService.js';
import { getStatementDetail } from '../financialStatementReadService.js';
import { recomputeStatementPack, syncStatementToPack } from '../financialStatementPackService.js';
import { stageSelectedStatementSections } from '../statementMultiSectionImportService.js';
import {
  approveVersion,
  createArtifact,
  getBusinessVersion,
  reopenVersion,
  transition,
} from '../finance/canonical/artifactVersionService.js';
import { computeAnalysisKpis } from '../finance/canonical/kpiComputeService.js';
import { insertEdge } from '../finance/canonical/lineageService.js';
import { mapStatementLines } from '../finance/canonical/statementMappingService.js';
import { runReconciliation } from '../finance/canonical/statementReconciliationService.js';
import { runBaselineCompute } from '../finance/canonical/baselineComputeService.js';
import { runPredictionCompute } from '../finance/canonical/predictionComputeService.js';
import { runPreflight } from '../finance/canonical/predictionPreflightService.js';
import { runDcfFcffValuation } from '../finance/canonical/valuationComputeService.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const PDF_PATH = process.env.FINANCE_STATEMENT_ACCEPTANCE_PDF || '';
const EXPECTED_PDF_SHA = 'e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e';
const enabled = process.env.RUN_DB_TESTS === '1';
let disposableDatabaseName = '';
if (enabled) {
  if (process.env.MOCK_DB !== 'false') throw new Error('RealPG proof requires MOCK_DB=false.');
  if (!DATABASE_URL.startsWith('postgres')) throw new Error('RealPG proof requires DATABASE_URL.');
  if (!PDF_PATH) throw new Error('FINANCE_STATEMENT_ACCEPTANCE_PDF is required.');
  if (process.env.FINANCE_STATEMENT_DROP_DATABASE_AFTER !== '1') {
    throw new Error(
      'FINANCE_STATEMENT_DROP_DATABASE_AFTER=1 is required for immutable-ledger cleanup.'
    );
  }
  const parsed = new URL(DATABASE_URL);
  disposableDatabaseName = parsed.pathname.replace(/^\//, '');
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error(`Refusing non-local PostgreSQL host: ${parsed.hostname}`);
  }
  const historicalTestDatabase =
    /^consultify_fin_statement_owner_fix_bd740_pgtest_[a-z0-9_]+$/.test(disposableDatabaseName);
  const wave3OwnerDatabase = /^consultify_w3_finance_owner_[a-z0-9_]+$/.test(
    disposableDatabaseName
  );
  if (!historicalTestDatabase && !wave3OwnerDatabase) {
    throw new Error(`Refusing non-disposable database: ${disposableDatabaseName}`);
  }
  if (
    wave3OwnerDatabase &&
    (process.env.SEED_WAVE3_FINANCE_OWNER_REVIEW !== 'YES' ||
      !process.env.FINANCE_OWNER_FIXTURE_MANIFEST)
  ) {
    throw new Error('Wave 3 Finance owner database requires explicit YES and manifest path');
  }
}

describe.runIf(enabled)(
  'Finance Statement owner acceptance — real PostgreSQL + official PDF',
  () => {
    const nonce = crypto.randomUUID().slice(0, 8);
    const organizationId = 'wave3-finance-owner-org-v1';
    const userId = 'wave3-finance-owner-user-v1';
    const adminId = 'wave3-finance-admin-user-v1';
    const foreignOrganizationId = 'wave3-finance-foreign-org-v1';
    const foreignUserId = 'wave3-finance-foreign-user-v1';
    let pool: Pool;
    let pdfText: string;

    beforeAll(async () => {
      const bytes = await fs.readFile(PDF_PATH);
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(EXPECTED_PDF_SHA);
      pdfText = await PDFParserService.extractText(PDF_PATH);
      pool = new Pool({ connectionString: DATABASE_URL });
      await pool.query(`INSERT INTO organizations(id,name,status) VALUES ($1,$2,'active')`, [
        organizationId,
        'Finance owner PG proof',
      ]);
      await pool.query(
        `INSERT INTO users(id,organization_id,email,role,status) VALUES ($1,$2,$3,'OWNER','active')`,
        [userId, organizationId, `${userId}@example.test`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
        [`member-${nonce}`, organizationId, userId]
      );
      await pool.query(
        `INSERT INTO users(id,organization_id,email,role,status) VALUES ($1,$2,$3,'ADMIN','active')`,
        [adminId, organizationId, 'wave3-finance-admin@example.test']
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'ADMIN','ACTIVE')`,
        [`member-admin-${nonce}`, organizationId, adminId]
      );
      await pool.query(`INSERT INTO organizations(id,name,status) VALUES ($1,$2,'active')`, [
        foreignOrganizationId,
        'Finance owner foreign boundary',
      ]);
      await pool.query(
        `INSERT INTO users(id,organization_id,email,role,status) VALUES ($1,$2,$3,'OWNER','active')`,
        [foreignUserId, foreignOrganizationId, 'wave3-finance-foreign@example.test']
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
        [`member-foreign-${nonce}`, foreignOrganizationId, foreignUserId]
      );
    }, 30_000);

    afterAll(async () => {
      if (!pool) return;
      await pool.end();
      // Governance receipts are intentionally immutable, so cleanup is the
      // whole explicitly named scratch database—not row deletion. WITH FORCE
      // closes the application pool owned by the service imports in this test.
      const adminUrl = new URL(DATABASE_URL);
      adminUrl.pathname = '/postgres';
      const admin = new Pool({ connectionString: adminUrl.toString() });
      await admin.query(`DROP DATABASE "${disposableDatabaseName}" WITH (FORCE)`);
      await admin.end();
    });

    it('backfills every confidence boundary and rejects recurrence at the database wall', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`CREATE SCHEMA confidence_${nonce}`);
        await client.query(`SET LOCAL search_path TO confidence_${nonce}`);
        await client.query(`CREATE TABLE financial_statements(id text, overall_confidence real)`);
        await client.query(
          `CREATE TABLE financial_statement_values(id text, confidence real, mapping_confidence real)`
        );
        await client.query(
          `CREATE TABLE financial_statement_extracted_sections(id text, confidence real)`
        );
        await client.query(
          `CREATE TABLE financial_statement_candidate_rows(id text, confidence real)`
        );
        await client.query(
          `CREATE TABLE financial_statement_mapping_candidates(id text, score real)`
        );
        await client.query(`CREATE TABLE financial_statement_value_evidence(id text, weight real)`);
        await client.query(
          `INSERT INTO financial_statements VALUES ('high',1.7),('low',-0.2),('null',NULL)`
        );
        await client.query(`INSERT INTO financial_statement_values VALUES ('value',2,-1)`);
        await client.query(
          `INSERT INTO financial_statement_extracted_sections VALUES ('section',1.4)`
        );
        await client.query(`INSERT INTO financial_statement_candidate_rows VALUES ('row',-0.4)`);
        await client.query(
          `INSERT INTO financial_statement_mapping_candidates VALUES ('mapping',8)`
        );
        await client.query(`INSERT INTO financial_statement_value_evidence VALUES ('evidence',-5)`);
        const migration = await fs.readFile(
          path.resolve('server/migrations/20261054_finance_statement_confidence_bounds.sql'),
          'utf8'
        );
        await client.query(migration);
        const values = await client.query(
          `SELECT
           (SELECT array_agg(overall_confidence ORDER BY id) FROM financial_statements) statements,
           (SELECT array_agg(confidence) FROM financial_statement_values) value_confidence,
           (SELECT array_agg(mapping_confidence) FROM financial_statement_values) mapping_confidence,
           (SELECT array_agg(confidence) FROM financial_statement_extracted_sections) section_confidence,
           (SELECT array_agg(confidence) FROM financial_statement_candidate_rows) row_confidence,
           (SELECT array_agg(score) FROM financial_statement_mapping_candidates) mapping_score,
           (SELECT array_agg(weight) FROM financial_statement_value_evidence) evidence_weight`
        );
        expect(values.rows[0]).toMatchObject({
          statements: [1, 0, 0],
          value_confidence: [1],
          mapping_confidence: [0],
          section_confidence: [1],
          row_confidence: [0],
          mapping_score: [1],
          evidence_weight: [0],
        });
        await expect(
          client.query(`INSERT INTO financial_statement_values VALUES ('invalid',1.01,0.5)`)
        ).rejects.toThrow(/confidence_bounds/);
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    });

    it('rolls back every later-section write and stages the official PDF as exactly six siblings', async () => {
      const failedPrimary = await createStatement({
        organizationId,
        statementType: 'P&L',
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
        periodLabel: '2025',
        currency: 'PLN',
        scaling: 'thousands',
        sourceFileName: 'failure.pdf',
        sourceFilePath: PDF_PATH,
        parseMethod: 'text_extraction',
        overallConfidence: 0.5,
        createdBy: userId,
      });
      await pool.query(`UPDATE financial_statements SET notes=$1 WHERE id=$2`, [
        'durable smart-upload source text',
        failedPrimary,
      ]);
      const failedPackId = await syncStatementToPack(failedPrimary);
      expect(failedPackId).toBeTruthy();
      expect(await loadStatementSourceText(failedPrimary)).toBe('durable smart-upload source text');
      const before = await pool.query(
        `SELECT count(*)::int count FROM financial_statements WHERE organization_id=$1`,
        [organizationId]
      );
      const app = express();
      app.use(express.json());
      app.use(inputSanitizationMiddleware);
      app.use((req, _res, next) => {
        (req as any).userId = userId;
        (req as any).organizationId = organizationId;
        (req as any).user = { id: userId, organizationId, role: 'OWNER' };
        (req as any).v8Context = {
          userId,
          organizationId,
          userRole: 'OWNER',
          isSuperAdmin: false,
        };
        next();
      });
      app.use('/api/v8/finance', financeRoutes);

      // Every table reached by the atomic writer is capability-checked before
      // BEGIN. Cover an ingest column, the immutable receipt ledger, and pack
      // recompute so no late missing-schema error can degrade into 25P02.
      for (const capability of [
        { table: 'financial_statement_ingest_runs', column: 'latest_reason_codes' },
        { table: 'finance_statement_source_receipts', column: 'periods_json' },
        { table: 'financial_statement_packs', column: 'pack_readiness_status' },
        { table: 'financial_statement_validations', column: 'expected_value' },
      ]) {
        const hidden = `${capability.column}_missing_test`;
        await pool.query(
          `ALTER TABLE ${capability.table} RENAME COLUMN ${capability.column} TO ${hidden}`
        );
        let schemaFailure: any;
        try {
          schemaFailure = await request(app)
            .post(`/api/v8/finance/statements/${failedPrimary}/extract`)
            .send({
              statementType: 'BS',
              statementTypes: ['P&L', 'BS', 'CF'],
              periodLabel: '2025',
              currency: 'PLN',
              scaling: 'thousands',
              entityName: 'CD PROJEKT S.A.',
            });
        } finally {
          await pool.query(
            `ALTER TABLE ${capability.table} RENAME COLUMN ${hidden} TO ${capability.column}`
          );
        }
        expect(schemaFailure.status, capability.table).toBe(503);
        expect(schemaFailure.body).toMatchObject({ code: 'STATEMENT_IMPORT_SCHEMA_INCOMPLETE' });
        expect(schemaFailure.body.error).toContain(`${capability.table}.${capability.column}`);
        expect(JSON.stringify(schemaFailure.body)).not.toContain('25P02');
        const afterSchemaFailure = await pool.query(
          `SELECT count(*)::int count FROM financial_statements WHERE organization_id=$1`,
          [organizationId]
        );
        expect(afterSchemaFailure.rows[0].count).toBe(before.rows[0].count);
        for (const table of [
          'financial_statement_ingest_runs',
          'financial_statement_extracted_sections',
          'financial_statement_candidate_rows',
          'financial_statement_mapping_candidates',
          'finance_statement_source_receipts',
        ]) {
          const result = await pool.query(
            `SELECT count(*)::int count FROM ${table} WHERE statement_id=$1`,
            [failedPrimary]
          );
          expect(result.rows[0].count, `${capability.table}:${table}`).toBe(0);
        }
      }

      await pool.query(`DROP INDEX idx_fs_pack_active_type_period`);
      await pool.query(
        `CREATE UNIQUE INDEX idx_fs_pack_active_type
         ON financial_statements(statement_pack_id, statement_type)
       WHERE statement_pack_id IS NOT NULL AND COALESCE(status, 'draft') <> 'archived'`
      );
      let indexDriftFailure: any;
      try {
        indexDriftFailure = await request(app)
          .post(`/api/v8/finance/statements/${failedPrimary}/extract`)
          .send({
            statementType: 'BS',
            statementTypes: ['P&L', 'BS', 'CF'],
            periodLabel: '2025',
            currency: 'PLN',
            scaling: 'thousands',
            entityName: 'CD PROJEKT S.A.',
          });
      } finally {
        await pool.query(`DROP INDEX IF EXISTS idx_fs_pack_active_type`);
        await pool.query(
          `CREATE UNIQUE INDEX idx_fs_pack_active_type_period
           ON financial_statements(
             statement_pack_id, statement_type,
             COALESCE(period_start, DATE '0001-01-01'),
             COALESCE(period_end, DATE '0001-01-01')
           )
         WHERE statement_pack_id IS NOT NULL AND COALESCE(status, 'draft') <> 'archived'`
        );
      }
      expect(indexDriftFailure.status).toBe(503);
      expect(indexDriftFailure.body).toMatchObject({
        code: 'STATEMENT_IMPORT_SCHEMA_INCOMPLETE',
        invalidIndexes: expect.arrayContaining(['idx_fs_pack_active_type']),
      });
      expect(JSON.stringify(indexDriftFailure.body)).not.toContain('25P02');

      const officialProfitAndLoss = locateStatementSections(pdfText, 'P&L').find(
        (section) => section.confidence >= 0.5
      );
      expect(officialProfitAndLoss).toBeDefined();
      let rollbackFailure: any;
      try {
        await stageSelectedStatementSections({
          primaryStatementId: failedPrimary,
          organizationId,
          userId,
          statement: {
            source_file_path: PDF_PATH,
            source_file_name: 'failure.pdf',
            parse_method: 'text_extraction',
            period_start: '2025-01-01',
            period_end: '2025-12-31',
            statement_pack_id: failedPackId,
          },
          // Use the locator's official-PDF P&L boundary: it is independently
          // stageable, contains both comparative periods, and intentionally has
          // no BS section so failure can only happen after both P&L writes.
          text: officialProfitAndLoss!.text,
          statementTypes: ['P&L', 'BS'],
          periodLabel: '2025',
          currency: 'PLN',
          scaling: 'thousands',
          entityName: 'CD PROJEKT S.A.',
        });
      } catch (error) {
        rollbackFailure = error;
      }
      expect(rollbackFailure).toMatchObject({
        code: 'STATEMENT_SECTION_NOT_FOUND',
        statementType: 'BS',
        stagedBeforeFailure: [
          { statementType: 'P&L', periodLabel: '2025' },
          { statementType: 'P&L', periodLabel: '2024' },
        ],
      });
      expect(
        rollbackFailure.stagedBeforeFailure.every(
          (item: any) => item.statementId && item.sourceReceiptId
        )
      ).toBe(true);
      const after = await pool.query(
        `SELECT count(*)::int count FROM financial_statements WHERE organization_id=$1`,
        [organizationId]
      );
      expect(after.rows[0].count).toBe(before.rows[0].count);
      for (const table of [
        'financial_statement_ingest_runs',
        'financial_statement_extracted_sections',
        'financial_statement_candidate_rows',
        'financial_statement_mapping_candidates',
        'finance_statement_source_receipts',
      ]) {
        const result = await pool.query(
          `SELECT count(*)::int count FROM ${table} WHERE statement_id=$1`,
          [failedPrimary]
        );
        expect(result.rows[0].count, table).toBe(0);
      }

      const primary = await createStatement({
        organizationId,
        statementType: 'P&L',
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
        periodLabel: '2025',
        currency: 'PLN',
        scaling: 'thousands',
        sourceFileName: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
        sourceFilePath: PDF_PATH,
        parseMethod: 'text_extraction',
        overallConfidence: 0.36,
        createdBy: userId,
      });
      await pool.query(`UPDATE financial_statements SET notes=$1 WHERE id=$2`, [pdfText, primary]);
      const mountedPackId = await syncStatementToPack(primary);
      expect(mountedPackId).toBeTruthy();
      const mounted = await request(app)
        .post(`/api/v8/finance/statements/${primary}/extract`)
        .send({
          statementType: 'BS',
          statementTypes: ['P&L', 'BS', 'CF'],
          periodLabel: '2025',
          currency: 'PLN',
          scaling: 'thousands',
          entityName: 'CD PROJEKT S.A.',
        });
      expect(mounted.status, JSON.stringify(mounted.body)).toBe(200);
      expect(mounted.body.data.selectedStatementTypes).toEqual(['P&L', 'BS', 'CF']);
      const staged = {
        statements: mounted.body.data.statements as Array<{
          statementId: string;
          statementType: 'P&L' | 'BS' | 'CF';
          periodLabel: string;
          sourceReceiptId: string;
          sourceSha256: string;
          lines: Array<{
            originalLabel: string;
            suggestedCanonicalId?: string;
            suggestedExclusionReason?: string;
            isNonFinancial?: boolean;
          }>;
        }>,
      };
      expect(staged.statements.map((item) => `${item.statementType}:${item.periodLabel}`)).toEqual([
        'P&L:2025',
        'P&L:2024',
        'BS:2025',
        'BS:2024',
        'CF:2025',
        'CF:2024',
      ]);
      expect(new Set(staged.statements.map((item) => item.statementId)).size).toBe(6);
      expect(new Set(staged.statements.map((item) => item.sourceReceiptId)).size).toBe(6);
      const unresolvedWithoutGovernedPath = staged.statements.flatMap((item) =>
        item.lines
          .filter(
            (line) =>
              !line.suggestedCanonicalId && !line.suggestedExclusionReason && !line.isNonFinancial
          )
          .map((line) => `${item.statementType}:${item.periodLabel}:${line.originalLabel}`)
      );
      expect(unresolvedWithoutGovernedPath).toEqual([]);
      expect(staged.statements.every((item) => item.sourceSha256 === EXPECTED_PDF_SHA)).toBe(true);
      const packMembership = await pool.query(
        `SELECT id, statement_pack_id
         FROM financial_statements
        WHERE id = ANY($1::text[])
        ORDER BY id`,
        [staged.statements.map((item) => item.statementId)]
      );
      expect(packMembership.rows).toHaveLength(6);
      expect(packMembership.rows.every((row) => Boolean(row.statement_pack_id))).toBe(true);
      expect(new Set(packMembership.rows.map((row) => row.statement_pack_id)).size).toBe(1);
      const statementPackId = String(packMembership.rows[0].statement_pack_id);
      const coldPack = await request(app).get(`/api/v8/finance/statement-packs/${statementPackId}`);
      expect(coldPack.status, JSON.stringify(coldPack.body)).toBe(200);
      expect(coldPack.body.data.pack.id).toBe(statementPackId);
      expect(
        new Set(
          coldPack.body.data.pack.statements.map(
            (item: any) => `${item.statement_type}:${item.period_label}`
          )
        )
      ).toEqual(new Set(['P&L:2025', 'P&L:2024', 'BS:2025', 'BS:2024', 'CF:2025', 'CF:2024']));
      expect(Number(coldPack.body.data.pack.source_statement_count)).toBe(6);
      const beforeForeignStatementRowCount = await pool.query(
        `SELECT count(*)::int count FROM financial_statements WHERE organization_id IN ($1,$2)`,
        [organizationId, foreignOrganizationId]
      );
      const foreignApp = express();
      foreignApp.use(express.json());
      foreignApp.use(inputSanitizationMiddleware);
      foreignApp.use((req, _res, next) => {
        (req as any).userId = foreignUserId;
        (req as any).organizationId = foreignOrganizationId;
        (req as any).user = {
          id: foreignUserId,
          organizationId: foreignOrganizationId,
          role: 'OWNER',
        };
        (req as any).v8Context = {
          userId: foreignUserId,
          organizationId: foreignOrganizationId,
          userRole: 'OWNER',
          isSuperAdmin: false,
        };
        next();
      });
      foreignApp.use('/api/v8/finance', financeRoutes);
      const foreignRead = await request(foreignApp).get(
        `/api/v8/finance/statement-packs/${statementPackId}`
      );
      expect([403, 404]).toContain(foreignRead.status);
      const afterForeignStatementRowCount = await pool.query(
        `SELECT count(*)::int count FROM financial_statements WHERE organization_id IN ($1,$2)`,
        [organizationId, foreignOrganizationId]
      );
      // This probe proves only that the denied foreign read did not change the
      // financial_statements row count. It is not a blanket zero-mutation claim
      // across every Finance table.
      expect(afterForeignStatementRowCount.rows[0].count).toBe(
        beforeForeignStatementRowCount.rows[0].count
      );
      const rejectedUnmappedAccept = await request(app)
        .post(`/api/v8/finance/statements/${primary}/manual-mapping-decisions`)
        .set('Idempotency-Key', `unmapped-accept-${nonce}`)
        .send({
          sourceRow: 11,
          canonicalLineId: null,
          reason: 'Zweryfikowane przez użytkownika podczas przeglądu importu',
          sourceReceiptId: staged.statements[0].sourceReceiptId,
          expectedValuesVersion: 1,
        });
      expect(rejectedUnmappedAccept.status).toBe(400);
      expect(rejectedUnmappedAccept.body).toMatchObject({
        code: 'MANUAL_MAPPING_TARGET_REQUIRED',
      });
      const rejectedDecisionCount = await pool.query(
        `SELECT count(*)::int count
         FROM finance_statement_manual_mapping_decisions
        WHERE organization_id=$1 AND statement_id=$2`,
        [organizationId, primary]
      );
      expect(rejectedDecisionCount.rows[0].count).toBe(0);
      for (const item of staged.statements) {
        const mappedResponse = await request(app).post(
          `/api/v8/finance/statements/${item.statementId}/map`
        );
        expect(mappedResponse.status, JSON.stringify(mappedResponse.body)).toBe(200);
        const mappedLines = mappedResponse.body.data.mappedLines as Array<any>;
        const suggestedExclusions = mappedLines.filter(
          (line) => Boolean(line.suggestedExclusionReason) && !line.suggestedCanonicalId
        );
        if (suggestedExclusions.length > 0) {
          const durableSuggestions = await pool.query(
            `SELECT candidate.source_row, candidate.metadata_json
             FROM financial_statement_candidate_rows candidate
             JOIN financial_statements statement
               ON statement.id=candidate.statement_id
              AND statement.organization_id=$1
            WHERE candidate.statement_id=$2 AND candidate.ingest_run_id IS NOT NULL`,
            [organizationId, item.statementId]
          );
          const durableReasonByRow = new Map(
            durableSuggestions.rows.map((row) => [
              Number(row.source_row),
              JSON.parse(row.metadata_json || '{}').suggestedExclusionReason,
            ])
          );
          for (const line of suggestedExclusions) {
            expect(durableReasonByRow.get(Number(line.sourceRow))).toBe(
              line.suggestedExclusionReason
            );
          }
        }
        const values = mappedLines.map((line) => {
          const excluded = Boolean(line.suggestedExclusionReason) && !line.suggestedCanonicalId;
          const manualAccept =
            Boolean(line.suggestedCanonicalId) && line.mappingTier === 'review_required';
          return {
            canonicalLineId: excluded ? null : line.suggestedCanonicalId || null,
            originalLabel: line.originalLabel,
            value: line.value,
            confidence: line.confidence,
            sourceRow: line.sourceRow,
            mappingStatus: excluded ? 'manual_exclude' : manualAccept ? 'manual' : 'auto',
            isNonFinancial: excluded || Boolean(line.isNonFinancial),
            classificationReason: excluded
              ? line.suggestedExclusionReason
              : line.classificationReason,
            userVerified: excluded || manualAccept,
          };
        });
        const saved = await request(app)
          .put(`/api/v8/finance/statements/${item.statementId}/values`)
          .send({ values });
        expect(saved.status, JSON.stringify(saved.body)).toBe(200);
        const valuesVersion = Number(saved.body.data.valuesVersion);
        if (values.some((entry) => entry.mappingStatus === 'manual_exclude')) {
          const beforeExclusionAudit = await request(app).get(
            `/api/v8/finance/statements/${item.statementId}`
          );
          expect(beforeExclusionAudit.status).toBe(200);
          expect(beforeExclusionAudit.body.data.statement.readinessStatus).not.toBe('ready');
          const rejectedConfirmation = await request(app)
            .post(`/api/v8/finance/statements/${item.statementId}/confirm`)
            .set('Idempotency-Key', `confirm-before-exclude-${item.statementId}-${valuesVersion}`)
            .send({
              sourceReceiptId: item.sourceReceiptId,
              expectedValuesVersion: valuesVersion,
            });
          expect(rejectedConfirmation.status).toBe(409);
          expect(rejectedConfirmation.body.code).toBe('MANUAL_MAPPING_AUDIT_MISSING');
        }
        for (const value of values.filter((entry) =>
          ['manual', 'manual_exclude'].includes(entry.mappingStatus)
        )) {
          const action = value.mappingStatus === 'manual_exclude' ? 'EXCLUDE' : 'ACCEPT';
          const decisionKey = `owner-${action.toLowerCase()}-${item.statementId}-${value.sourceRow}-${valuesVersion}`;
          const decision = await request(app)
            .post(`/api/v8/finance/statements/${item.statementId}/manual-mapping-decisions`)
            .set('Idempotency-Key', decisionKey)
            .send({
              sourceRow: value.sourceRow,
              canonicalLineId: action === 'ACCEPT' ? value.canonicalLineId : null,
              action,
              reason:
                action === 'EXCLUDE'
                  ? value.classificationReason
                  : 'Owner verified deterministic canonical suggestion',
              sourceReceiptId: item.sourceReceiptId,
              expectedValuesVersion: valuesVersion,
            });
          expect(decision.status, JSON.stringify(decision.body)).toBe(200);
          const replay = await request(app)
            .post(`/api/v8/finance/statements/${item.statementId}/manual-mapping-decisions`)
            .set('Idempotency-Key', decisionKey)
            .send({
              sourceRow: value.sourceRow,
              canonicalLineId: action === 'ACCEPT' ? value.canonicalLineId : null,
              action,
              reason:
                action === 'EXCLUDE'
                  ? value.classificationReason
                  : 'Owner verified deterministic canonical suggestion',
              sourceReceiptId: item.sourceReceiptId,
              expectedValuesVersion: valuesVersion,
            });
          expect(replay.status, JSON.stringify(replay.body)).toBe(200);
          expect(replay.body.data.decision.decisionId).toBe(decision.body.data.decision.decisionId);
        }
        const detail = await request(app).get(`/api/v8/finance/statements/${item.statementId}`);
        expect(detail.status).toBe(200);
        expect(
          detail.body.data.statement.readinessStatus,
          JSON.stringify(detail.body.data.statement)
        ).toBe('ready');
        for (const excluded of values.filter((entry) => entry.mappingStatus === 'manual_exclude')) {
          const coldValue = detail.body.data.statement.values.find(
            (entry: any) => Number(entry.source_row) === Number(excluded.sourceRow)
          );
          expect(Number(coldValue.confidence)).toBeCloseTo(Number(excluded.confidence), 6);
          expect(coldValue).toMatchObject({
            is_non_financial: true,
            classification_reason: excluded.classificationReason,
            suggested_exclusion_reason: excluded.classificationReason,
            manual_decision: {
              action: 'EXCLUDE',
              reason: excluded.classificationReason,
              sourceReceiptId: item.sourceReceiptId,
              statementValuesVersion: valuesVersion,
            },
          });
          expect(coldValue.manual_decision.decisionId).toBeTruthy();
          expect(coldValue.manual_decision).not.toHaveProperty('idempotencyKey');
        }
        const confirmed = await request(app)
          .post(`/api/v8/finance/statements/${item.statementId}/confirm`)
          .set('Idempotency-Key', `confirm-${item.statementId}-${valuesVersion}`)
          .send({
            sourceReceiptId: item.sourceReceiptId,
            expectedValuesVersion: valuesVersion,
          });
        expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
      }
      const confirmedPack = await request(app).get(
        `/api/v8/finance/statement-packs/${statementPackId}`
      );
      expect(confirmedPack.status).toBe(200);
      expect(
        confirmedPack.body.data.pack.pack_readiness_status,
        JSON.stringify(confirmedPack.body.data.pack)
      ).toBe('ready');
      expect(
        confirmedPack.body.data.pack.statements.filter(
          (statement: any) => statement.status === 'confirmed'
        )
      ).toHaveLength(6);
      const comparativeCf = staged.statements.find(
        (item) => item.statementType === 'CF' && item.periodLabel === '2024'
      )!;
      await pool.query(`UPDATE financial_statements SET statement_pack_id=NULL WHERE id=$1`, [
        comparativeCf.statementId,
      ]);
      await recomputeStatementPack(statementPackId, { deferShadow: true });
      const missingComparative = await request(app).get(
        `/api/v8/finance/statement-packs/${statementPackId}`
      );
      expect(missingComparative.body.data.pack.pack_readiness_status).not.toBe('ready');
      expect(JSON.parse(missingComparative.body.data.pack.pack_quality_reason_codes)).toContain(
        'MISSING_PERIOD_STATEMENT'
      );
      await pool.query(`UPDATE financial_statements SET statement_pack_id=$1 WHERE id=$2`, [
        statementPackId,
        comparativeCf.statementId,
      ]);
      await recomputeStatementPack(statementPackId, { deferShadow: true });

      const comparativeStatements = staged.statements.filter((item) => item.periodLabel === '2024');
      await pool.query(
        `UPDATE financial_statements SET statement_pack_id=NULL WHERE id=ANY($1::text[])`,
        [comparativeStatements.map((item) => item.statementId)]
      );
      await recomputeStatementPack(statementPackId, { deferShadow: true });
      const onePeriodPack = await request(app).get(
        `/api/v8/finance/statement-packs/${statementPackId}`
      );
      expect(onePeriodPack.body.data.pack.pack_readiness_status).not.toBe('ready');
      expect(JSON.parse(onePeriodPack.body.data.pack.pack_quality_reason_codes)).toContain(
        'INVALID_PERIOD_COUNT'
      );
      await pool.query(
        `UPDATE financial_statements SET statement_pack_id=$1 WHERE id=ANY($2::text[])`,
        [statementPackId, comparativeStatements.map((item) => item.statementId)]
      );
      await recomputeStatementPack(statementPackId, { deferShadow: true });

      const thirdPeriodIds: string[] = [];
      for (const statementType of ['P&L', 'BS', 'CF']) {
        thirdPeriodIds.push(
          await createStatement({
            organizationId,
            statementType,
            periodStart: '2023-01-01',
            periodEnd: '2023-12-31',
            periodLabel: '2023',
            currency: 'PLN',
            scaling: 'thousands',
            sourceFileName: 'generic-third-period.pdf',
            sourceFilePath: PDF_PATH,
            parseMethod: 'text_extraction',
            overallConfidence: 0.5,
            createdBy: userId,
          })
        );
      }
      await pool.query(
        `UPDATE financial_statements SET statement_pack_id=$1 WHERE id=ANY($2::text[])`,
        [statementPackId, thirdPeriodIds]
      );
      await recomputeStatementPack(statementPackId, { deferShadow: true });
      const threePeriodPack = await request(app).get(
        `/api/v8/finance/statement-packs/${statementPackId}`
      );
      expect(threePeriodPack.body.data.pack.pack_readiness_status).not.toBe('ready');
      expect(JSON.parse(threePeriodPack.body.data.pack.pack_quality_reason_codes)).toContain(
        'INVALID_PERIOD_COUNT'
      );
      await pool.query(
        `UPDATE financial_statements SET statement_pack_id=NULL WHERE id=ANY($1::text[])`,
        [thirdPeriodIds]
      );
      await recomputeStatementPack(statementPackId, { deferShadow: true });
      const duplicatePeriod = await createStatement({
        organizationId,
        statementType: 'P&L',
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
        periodLabel: '2025',
        currency: 'PLN',
        scaling: 'thousands',
        sourceFileName: 'duplicate-period.pdf',
        sourceFilePath: PDF_PATH,
        parseMethod: 'text_extraction',
        overallConfidence: 0.5,
        createdBy: userId,
      });
      await expect(
        pool.query(`UPDATE financial_statements SET statement_pack_id=$1 WHERE id=$2`, [
          statementPackId,
          duplicatePeriod,
        ])
      ).rejects.toMatchObject({ code: '23505' });
      const coldDetail = await getStatementDetail(organizationId, primary);
      expect(coldDetail?.sourceSiblings).toHaveLength(6);
      expect(
        new Set(
          (coldDetail?.sourceSiblings as any[]).map(
            (item) => `${item.statement_type}:${item.period_label}`
          )
        )
      ).toEqual(new Set(['P&L:2025', 'P&L:2024', 'BS:2025', 'BS:2024', 'CF:2025', 'CF:2024']));

      const readback = await pool.query(
        `SELECT fs.statement_type,fs.period_label,fs.entity_name,fs.scaling,fs.source_file_name,
              count(DISTINCT rows.id)::int candidate_rows,
              count(DISTINCT receipt.receipt_id)::int receipts,
              min(receipt.content_sha256) sha
         FROM financial_statements fs
         LEFT JOIN financial_statement_candidate_rows rows ON rows.statement_id=fs.id
         LEFT JOIN finance_statement_source_receipts receipt ON receipt.statement_id=fs.id
        WHERE fs.organization_id=$1 AND fs.source_file_name=$2
        GROUP BY fs.id
        ORDER BY CASE fs.statement_type WHEN 'P&L' THEN 1 WHEN 'BS' THEN 2 WHEN 'CF' THEN 3 END,
                 fs.period_label DESC`,
        [organizationId, 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf']
      );
      expect(readback.rows).toHaveLength(6);
      expect(readback.rows.every((row) => row.entity_name === 'CD PROJEKT S.A.')).toBe(true);
      expect(readback.rows.every((row) => row.scaling === 'thousands')).toBe(true);
      expect(readback.rows.every((row) => row.receipts === 1 && row.sha === EXPECTED_PDF_SHA)).toBe(
        true
      );
      const forbidden = await pool.query(
        `SELECT count(*)::int count FROM financial_statement_candidate_rows
        WHERE statement_id = ANY($1::text[]) AND normalized_value IN (10.13,15.34,17.34,20.34)`,
        [staged.statements.map((item) => item.statementId)]
      );
      expect(forbidden.rows[0].count).toBe(0);
      const treasuryShares = await pool.query(
        `SELECT normalized_value, metadata_json
         FROM financial_statement_candidate_rows
        WHERE statement_id=$1 AND row_label ILIKE 'Akcje własne%'
        ORDER BY source_row LIMIT 1`,
        [
          staged.statements.find(
            (item) => item.statementType === 'BS' && item.periodLabel === '2025'
          )!.statementId,
        ]
      );
      expect(Number(treasuryShares.rows[0]?.normalized_value)).toBe(-22424);
      const treasuryMetadata =
        typeof treasuryShares.rows[0]?.metadata_json === 'string'
          ? JSON.parse(treasuryShares.rows[0].metadata_json)
          : treasuryShares.rows[0]?.metadata_json;
      expect(treasuryMetadata?.numericTokens).toEqual(
        expect.arrayContaining([expect.objectContaining({ raw: '23,24', tokenType: 'note_ref' })])
      );

      const secondPrimary = await createStatement({
        organizationId,
        statementType: 'P&L',
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
        periodLabel: '2025',
        currency: 'PLN',
        scaling: 'thousands',
        sourceFileName: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
        sourceFilePath: PDF_PATH,
        parseMethod: 'text_extraction',
        overallConfidence: 0.36,
        createdBy: userId,
      });
      const secondPackId = await syncStatementToPack(secondPrimary);
      expect(secondPackId).toBeTruthy();
      await stageSelectedStatementSections({
        primaryStatementId: secondPrimary,
        organizationId,
        userId,
        statement: {
          source_file_path: PDF_PATH,
          source_file_name: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
          parse_method: 'text_extraction',
          document_class: 'mixed_report',
          period_start: '2025-01-01',
          period_end: '2025-12-31',
          currency: 'PLN',
          scaling: 'thousands',
          statement_pack_id: secondPackId,
        },
        text: pdfText,
        statementTypes: ['P&L', 'BS', 'CF'],
        periodLabel: '2025',
        currency: 'PLN',
        scaling: 'thousands',
        entityName: 'CD PROJEKT S.A.',
      });
      const firstUploadAfterReimport = await getStatementDetail(organizationId, primary);
      const secondUpload = await getStatementDetail(organizationId, secondPrimary);
      expect(firstUploadAfterReimport?.sourceSiblings).toHaveLength(6);
      expect(secondUpload?.sourceSiblings).toHaveLength(6);
      expect(
        new Set((firstUploadAfterReimport?.sourceSiblings as any[]).map((item) => item.id))
      ).not.toContain(secondPrimary);

      const canonicalStatement = await pool.query(
        `SELECT alias.artifact_id,alias.business_version_id
         FROM finance_artifact_aliases alias
        WHERE alias.organization_id=$1 AND alias.legacy_table='financial_statement_packs'
          AND alias.legacy_id=$2 AND alias.legacy_version=''`,
        [organizationId, statementPackId]
      );
      expect(canonicalStatement.rows).toHaveLength(1);
      const downstream = {} as Record<string, { artifactId: string; businessVersionId: string }>;
      for (const [workspace, artifactType] of [
        ['baseline', 'BASELINE_MODEL'],
        ['prediction', 'PREDICTION_SCENARIO'],
        ['valuation', 'VALUATION_CASE'],
      ] as const) {
        const created = await createArtifact({
          organizationId,
          artifactType,
          naturalKey: `wave3-finance-owner-${workspace}-v1`,
          createdBy: userId,
        });
        downstream[workspace] = {
          artifactId: created.artifact.artifact_id,
          businessVersionId: created.businessVersion.business_version_id,
        };
      }

      const statementBusinessVersionId = canonicalStatement.rows[0].business_version_id;
      const calendar = await pool.query(
        `INSERT INTO finance_stmt_calendars
           (organization_id,calendar_type,fiscal_year_end_month,effective_from,created_by)
         VALUES ($1,'STANDARD',12,'2020-01-01',$2)
         RETURNING fiscal_calendar_id`,
        [organizationId, userId]
      );
      const period = await pool.query(
        `INSERT INTO finance_stmt_periods
           (organization_id,fiscal_calendar_id,period_type,fiscal_year,period_start,period_end,label,created_by)
         VALUES ($1,$2,'FY',2025,'2025-01-01','2025-12-31','FY2025',$3)
         RETURNING period_id`,
        [organizationId, calendar.rows[0].fiscal_calendar_id, userId]
      );
      const entity = await pool.query(
        `INSERT INTO finance_stmt_entities
           (organization_id,business_version_id,entity_code,legal_name,role,
            consolidation_method,ownership_pct,functional_currency,created_by)
         VALUES ($1,$2,'CDP-GROUP','CD PROJEKT S.A.','GROUP_PARENT',
                 'FULL',100,'PLN',$3)
         RETURNING id`,
        [organizationId, statementBusinessVersionId, userId]
      );
      const mappedStatement = await mapStatementLines({
        organizationId,
        businessVersionId: statementBusinessVersionId,
        unit: 'UNITS',
        presentationCurrency: 'PLN',
        createdBy: userId,
        rawLines: [
          {
            lineItem: 'Owner fixture current assets',
            periodId: period.rows[0].period_id,
            entityCode: 'CDP-GROUP',
            currency: 'PLN',
            value: 2_100_000,
            sourceRef: { fixture: 'wave3-finance-owner' },
          },
          {
            lineItem: 'Owner fixture current liabilities',
            periodId: period.rows[0].period_id,
            entityCode: 'CDP-GROUP',
            currency: 'PLN',
            value: 700_000,
            sourceRef: { fixture: 'wave3-finance-owner' },
          },
        ],
        rules: [
          {
            sourceLabel: 'Owner fixture current assets',
            statementType: 'BS',
            lineCode: 'CURRENT_ASSETS',
          },
          {
            sourceLabel: 'Owner fixture current liabilities',
            statementType: 'BS',
            lineCode: 'CURRENT_LIABILITIES',
          },
        ],
      });
      const GOLDCO = {
        revenue: 182_000_000,
        cogs: 118_000_000,
        opex: 34_000_000,
        depreciation: 7_000_000,
        capex: 9_000_000,
        cash: 11_000_000,
        ar: 26_000_000,
        inventory: 19_500_000,
        fixedAssets: 101_500_000,
        ap: 17_500_000,
        longTermDebt: 40_500_000,
      } as const;
      const openingAssets = GOLDCO.cash + GOLDCO.ar + GOLDCO.inventory + GOLDCO.fixedAssets;
      const openingLiabilities = GOLDCO.ap + GOLDCO.longTermDebt;
      const openingEquity = openingAssets - openingLiabilities;
      const monthEnd = (year: number, month: number) =>
        new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      const historicalPeriodIds: string[] = [];
      const forecastPeriodIds: string[] = [];
      let previousPeriodId: string | null = null;
      for (let month = 1; month <= 12; month += 1) {
        const historical = await pool.query(
          `INSERT INTO finance_stmt_periods
             (organization_id,fiscal_calendar_id,period_type,fiscal_year,fiscal_month,
              period_start,period_end,label,previous_period_id,created_by)
           VALUES ($1,$2,'MONTH',2025,$3,$4,$5,$6,$7,$8) RETURNING period_id`,
          [
            organizationId,
            calendar.rows[0].fiscal_calendar_id,
            month,
            `2025-${String(month).padStart(2, '0')}-01`,
            monthEnd(2025, month),
            `${month}/2025`,
            previousPeriodId,
            userId,
          ]
        );
        previousPeriodId = historical.rows[0].period_id;
        historicalPeriodIds.push(previousPeriodId!);
      }
      for (let month = 1; month <= 12; month += 1) {
        const forecast = await pool.query(
          `INSERT INTO finance_stmt_periods
             (organization_id,fiscal_calendar_id,period_type,fiscal_year,fiscal_month,
              period_start,period_end,label,previous_period_id,created_by)
           VALUES ($1,$2,'MONTH',2026,$3,$4,$5,$6,$7,$8) RETURNING period_id`,
          [
            organizationId,
            calendar.rows[0].fiscal_calendar_id,
            month,
            `2026-${String(month).padStart(2, '0')}-01`,
            monthEnd(2026, month),
            `${month}/2026`,
            previousPeriodId,
            userId,
          ]
        );
        previousPeriodId = forecast.rows[0].period_id;
        forecastPeriodIds.push(previousPeriodId!);
      }
      const monthlyRawLines = historicalPeriodIds.map((periodId, index) => ({
        lineItem: `Owner fixture monthly revenue ${index + 1}`,
        periodId,
        entityCode: 'CDP-GROUP',
        currency: 'PLN',
        value: GOLDCO.revenue / 12,
        sourceRef: { fixture: 'wave3-finance-owner' },
      }));
      const openingPeriodId = historicalPeriodIds.at(-1)!;
      const openingRows = [
        ['CASH', GOLDCO.cash],
        ['AR', GOLDCO.ar],
        ['INVENTORY', GOLDCO.inventory],
        ['FIXED_ASSETS', GOLDCO.fixedAssets],
        ['AP', GOLDCO.ap],
        ['LONG_TERM_DEBT', GOLDCO.longTermDebt],
        ['EQUITY', openingEquity],
        ['RETAINED_EARNINGS', 40_000_000],
        ['COGS', GOLDCO.cogs / 12],
        ['OPEX', GOLDCO.opex / 12],
      ] as const;
      const baselineSourceMapping = await mapStatementLines({
        organizationId,
        businessVersionId: statementBusinessVersionId,
        unit: 'UNITS',
        presentationCurrency: 'PLN',
        createdBy: userId,
        rawLines: [
          ...monthlyRawLines,
          ...openingRows.map(([lineCode, value]) => ({
            lineItem: `Owner fixture opening ${lineCode}`,
            periodId: openingPeriodId,
            entityCode: 'CDP-GROUP',
            currency: 'PLN',
            value,
            sourceRef: { fixture: 'wave3-finance-owner' },
          })),
        ],
        rules: [
          ...monthlyRawLines.map((row) => ({
            sourceLabel: row.lineItem,
            statementType: 'P&L' as const,
            lineCode: 'REVENUE',
          })),
          ...openingRows.map(([lineCode]) => ({
            sourceLabel: `Owner fixture opening ${lineCode}`,
            statementType: (lineCode === 'COGS' || lineCode === 'OPEX' ? 'P&L' : 'BS') as
              | 'P&L'
              | 'BS',
            lineCode,
          })),
        ],
      });
      const statementReconciliation = await runReconciliation({
        organizationId,
        artifactId: canonicalStatement.rows[0].artifact_id,
        businessVersionId: statementBusinessVersionId,
        sourceSystem: 'wave3:finance-owner-review',
        mappingResults: [...mappedStatement, ...baselineSourceMapping],
        createdBy: userId,
      });
      expect(statementReconciliation.run.status).toBe('CLEAN');
      const analysisArtifact = await createArtifact({
        organizationId,
        artifactType: 'HISTORICAL_ANALYSIS',
        naturalKey: 'wave3-finance-owner-analysis-v1',
        createdBy: userId,
      });
      const analysisBusinessVersionId = analysisArtifact.businessVersion.business_version_id;
      await pool.query(
        `INSERT INTO finance_analysis_definitions
           (organization_id,business_version_id,purpose,analysis_type,
            entity_scope_mode,presentation_currency,unit,created_by)
         VALUES ($1,$2,'INTERNAL_REVIEW','STANDARD','GROUP_CONSOLIDATED','PLN','UNITS',$3)`,
        [organizationId, analysisBusinessVersionId, userId]
      );
      const analysisEdge = await insertEdge({
        organizationId,
        sourceVersionId: statementBusinessVersionId,
        sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: analysisBusinessVersionId,
        targetArtifactType: 'HISTORICAL_ANALYSIS',
        edgeType: 'STATEMENT_TO_ANALYSIS',
        transformationKind: 'MANUAL_LINK',
        authorId: userId,
      });
      expect(analysisEdge.ok).toBe(true);
      const currentRatio = await pool.query(
        `SELECT id FROM finance_analysis_kpi_catalog
          WHERE kpi_code='CURRENT_RATIO' AND status='ACTIVE' LIMIT 1`
      );
      expect(currentRatio.rows).toHaveLength(1);
      await pool.query(
        `INSERT INTO finance_analysis_kpi_values
           (organization_id,business_version_id,kpi_catalog_id,entity_id,period_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          organizationId,
          analysisBusinessVersionId,
          currentRatio.rows[0].id,
          entity.rows[0].id,
          period.rows[0].period_id,
        ]
      );
      const analysisCompute = await computeAnalysisKpis({
        organizationId,
        businessVersionId: analysisBusinessVersionId,
        requestedByUserId: userId,
      });
      expect(analysisCompute.ok).toBe(true);
      if (!analysisCompute.ok) throw new Error(analysisCompute.message);
      expect(analysisCompute.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kpiCode: 'CURRENT_RATIO',
            status: 'PRESENT_NONZERO',
            value: 3,
          }),
        ])
      );
      const approveCanonicalVersion = async (businessVersionId: string) => {
        let version = await getBusinessVersion(organizationId, businessVersionId);
        expect(version).toBeTruthy();
        const submitted = await transition({
          organizationId,
          businessVersionId,
          action: 'submit_for_review',
          actorId: userId,
          role: 'preparer',
          expectedVersion: version!.version,
        });
        expect(submitted.ok).toBe(true);
        version = await getBusinessVersion(organizationId, businessVersionId);
        const started = await transition({
          organizationId,
          businessVersionId,
          action: 'start_review',
          actorId: adminId,
          role: 'approver',
          expectedVersion: version!.version,
        });
        expect(started.ok).toBe(true);
        version = await getBusinessVersion(organizationId, businessVersionId);
        const approved = await approveVersion({
          organizationId,
          businessVersionId,
          actorId: adminId,
          role: 'approver',
          expectedVersion: version!.version,
        });
        if (!approved.ok) {
          process.stderr.write(`CANONICAL_APPROVAL_FAILURE ${JSON.stringify(approved)}\n`);
          throw new Error(`canonical approval failed: ${approved.code}`);
        }
      };
      await approveCanonicalVersion(statementBusinessVersionId);
      await approveCanonicalVersion(analysisBusinessVersionId);
      const baselineBusinessVersionId = downstream.baseline.businessVersionId;
      await pool.query(
        `INSERT INTO finance_baseline_models
           (organization_id,business_version_id,horizon_months,horizon_rationale,
            horizon_rationale_note,circularity_max_iterations,circularity_tolerance_currency,
            interest_income_on_cash_modeled,mandatory_contractual_cash_sweep_modeled,created_by)
         VALUES ($1,$2,12,'DEBT_MATURITY','Wave 3 owner GoldCo lifecycle',50,1,false,true,$3)`,
        [organizationId, baselineBusinessVersionId, userId]
      );
      expect(
        (
          await insertEdge({
            organizationId,
            sourceVersionId: statementBusinessVersionId,
            sourceArtifactType: 'STATEMENT_PACK',
            targetVersionId: baselineBusinessVersionId,
            targetArtifactType: 'BASELINE_MODEL',
            edgeType: 'STATEMENT_TO_MODEL',
            transformationKind: 'COMPUTE',
            authorId: userId,
          })
        ).ok
      ).toBe(true);
      expect(
        (
          await insertEdge({
            organizationId,
            sourceVersionId: analysisBusinessVersionId,
            sourceArtifactType: 'HISTORICAL_ANALYSIS',
            targetVersionId: baselineBusinessVersionId,
            targetArtifactType: 'BASELINE_MODEL',
            edgeType: 'ANALYSIS_TO_MODEL',
            transformationKind: 'COMPUTE',
            assumptionSnapshotHash: 'a'.repeat(64),
            authorId: userId,
          })
        ).ok
      ).toBe(true);
      const assumption = async (
        scheduleType: string,
        driverCode: string,
        value: number,
        unit: string
      ) => {
        await pool.query(
          `INSERT INTO finance_baseline_assumptions
             (organization_id,business_version_id,schedule_type,driver_code,entity_id,
              period_id,rule,value_status,value_decimal,unit,quality,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,'HISTORICAL_AVERAGE','PRESENT_NONZERO',$7,$8,'ESTIMATED',$9)`,
          [
            organizationId,
            baselineBusinessVersionId,
            scheduleType,
            driverCode,
            entity.rows[0].id,
            forecastPeriodIds[0],
            value,
            unit,
            userId,
          ]
        );
      };
      await assumption('revenue_pvm', 'REVENUE_GROWTH_YOY', 0.05, 'PCT');
      await assumption('cogs_opex', 'COGS_PCT_OF_REVENUE', GOLDCO.cogs / GOLDCO.revenue, 'PCT');
      await assumption('cogs_opex', 'OPEX_PCT_OF_REVENUE', GOLDCO.opex / GOLDCO.revenue, 'PCT');
      await assumption('wc_dso_dio_dpo', 'DSO_DAYS', (GOLDCO.ar / GOLDCO.revenue) * 365, 'DAYS');
      await assumption('wc_dso_dio_dpo', 'DIO_DAYS', (GOLDCO.inventory / GOLDCO.cogs) * 365, 'DAYS');
      await assumption('wc_dso_dio_dpo', 'DPO_DAYS', (GOLDCO.ap / GOLDCO.cogs) * 365, 'DAYS');
      await assumption('capex_depreciation', 'CAPEX_PCT_OF_REVENUE', GOLDCO.capex / GOLDCO.revenue, 'PCT');
      await assumption('capex_depreciation', 'USEFUL_LIFE_MONTHS', (12 * GOLDCO.fixedAssets) / GOLDCO.depreciation, 'MONTHS');
      await assumption('tax_nol', 'STATUTORY_TAX_RATE_PCT', 0.19, 'PCT');
      await pool.query(
        `INSERT INTO finance_baseline_schedules
           (organization_id,business_version_id,schedule_type,entity_id,schedule_item_code,
            effective_from_period_id,payload,created_by)
         VALUES ($1,$2,'debt_maturity',$3,'FACILITY-1',$4,$5,$6)`,
        [
          organizationId,
          baselineBusinessVersionId,
          entity.rows[0].id,
          forecastPeriodIds[0],
          JSON.stringify({
            principal_opening: GOLDCO.longTermDebt,
            contractual_rate: 0.048,
            amortization_schedule: Array.from({ length: 12 }, () => 675_000),
            mandatory_sweep_pct: 0.1,
            mandatory_sweep_threshold: 0,
          }),
          userId,
        ]
      );
      const baselineVersion = await getBusinessVersion(organizationId, baselineBusinessVersionId);
      const baselineCompute = await runBaselineCompute({
        organizationId,
        businessVersionId: baselineBusinessVersionId,
        entityId: entity.rows[0].id,
        forecastPeriodIds,
        openingBalanceSheetPeriodId: openingPeriodId,
        engineManifestId: baselineVersion!.engine_manifest_id,
        requestedByUserId: userId,
      });
      expect(baselineCompute.ok).toBe(true);
      if (!baselineCompute.ok) throw new Error(baselineCompute.message);
      expect(baselineCompute.periodsComputed).toBe(12);
      const baselineOutputCount = await pool.query(
        `SELECT count(*)::int AS count FROM finance_baseline_outputs
          WHERE organization_id=$1 AND business_version_id=$2`,
        [organizationId, baselineBusinessVersionId]
      );
      expect(baselineOutputCount.rows[0].count).toBe(372);
      await approveCanonicalVersion(baselineBusinessVersionId);
      const predictionBusinessVersionId = downstream.prediction.businessVersionId;
      await pool.query(
        `INSERT INTO finance_prediction_scenarios
           (organization_id,business_version_id,name,scenario_mode,created_by)
         VALUES ($1,$2,'Wave 3 owner base passthrough','STANDARD_BASE',$3)`,
        [organizationId, predictionBusinessVersionId, userId]
      );
      expect(
        (
          await insertEdge({
            organizationId,
            sourceVersionId: baselineBusinessVersionId,
            sourceArtifactType: 'BASELINE_MODEL',
            targetVersionId: predictionBusinessVersionId,
            targetArtifactType: 'PREDICTION_SCENARIO',
            edgeType: 'MODEL_TO_SCENARIO',
            transformationKind: 'MANUAL_LINK',
            assumptionSnapshotHash: 'sha256:wave3-owner-baseline-passthrough',
            authorId: userId,
          })
        ).ok
      ).toBe(true);
      const predictionPreflight = await runPreflight({
        organizationId,
        businessVersionId: predictionBusinessVersionId,
        runBy: userId,
        entityId: entity.rows[0].id,
        openingBalanceSheetPeriodId: openingPeriodId,
      });
      expect(predictionPreflight.findingsCount).toBe(0);
      const predictionCompute = await runPredictionCompute({
        organizationId,
        businessVersionId: predictionBusinessVersionId,
        requestedByUserId: userId,
        engineManifestId: baselineVersion!.engine_manifest_id,
        entityId: entity.rows[0].id,
        forecastPeriodIds,
        openingBalanceSheetPeriodId: openingPeriodId,
      });
      expect(predictionCompute.ok).toBe(true);
      if (!predictionCompute.ok) throw new Error(predictionCompute.message);
      expect(predictionCompute.mode).toBe('STANDARD_BASE');
      if (predictionCompute.mode !== 'STANDARD_BASE') {
        throw new Error('Expected the canonical STANDARD_BASE passthrough result');
      }
      expect(predictionCompute.passthroughRowCount).toBe(372);
      await approveCanonicalVersion(predictionBusinessVersionId);
      const valuationBusinessVersionId = downstream.valuation.businessVersionId;
      const valuationCase = await pool.query(
        `INSERT INTO finance_valuation_cases (organization_id,name,description,created_by)
         VALUES ($1,'Wave 3 owner GoldCo','DCF owner-review fixture',$2) RETURNING case_id`,
        [organizationId, userId]
      );
      await pool.query(
        `INSERT INTO finance_valuation_variants
           (organization_id,business_version_id,case_id,name,description,created_by)
         VALUES ($1,$2,$3,'Baseline case','Canonical Baseline-sourced DCF',$4)`,
        [organizationId, valuationBusinessVersionId, valuationCase.rows[0].case_id, userId]
      );
      expect(
        (
          await insertEdge({
            organizationId,
            sourceVersionId: baselineBusinessVersionId,
            sourceArtifactType: 'BASELINE_MODEL',
            targetVersionId: valuationBusinessVersionId,
            targetArtifactType: 'VALUATION_CASE',
            edgeType: 'MODEL_TO_VALUATION',
            transformationKind: 'MANUAL_LINK',
            assumptionSnapshotHash: 'sha256:wave3-owner-model-to-valuation',
            authorId: userId,
          })
        ).ok
      ).toBe(true);
      await pool.query(
        `INSERT INTO finance_valuation_wacc_inputs
           (organization_id,business_version_id,risk_free_rate_pct,equity_risk_premium_pct,
            beta_unlevered,target_capital_structure_debt_pct,target_capital_structure_equity_pct,
            current_capital_structure_debt_pct,current_capital_structure_equity_pct,
            cost_of_debt_pretax_pct,cash_tax_rate_pct,currency,nominal_or_real,pre_or_post_tax,created_by)
         VALUES ($1,$2,4.0,5.5,0.9,30,70,30,70,6.0,19,'PLN','NOMINAL','POST_TAX',$3)`,
        [organizationId, valuationBusinessVersionId, userId]
      );
      const valuationParams = {
        organizationId,
        valuationBusinessVersionId,
        entityId: entity.rows[0].id,
        requestedByUserId: userId,
        engineManifestId: baselineVersion!.engine_manifest_id,
        projectionYears: [{ fiscalYear: 2026, periodIds: forecastPeriodIds }],
        openingWorkingCapital: GOLDCO.ar + GOLDCO.inventory - GOLDCO.ap,
        terminal: { gPct: 2.5 },
      } as const;
      const valuationBeforeFailure = await pool.query(
        `SELECT version.freshness,revision.content_semantic_hash,revision.compute_run_id
           FROM finance_business_versions version
           JOIN finance_working_revisions revision
             ON revision.working_revision_id=version.source_working_revision_id
          WHERE version.organization_id=$1 AND version.business_version_id=$2`,
        [organizationId, valuationBusinessVersionId]
      );
      await pool.query(`
        CREATE FUNCTION wave3_fail_valuation_publish() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'WAVE3_INJECTED_VALUATION_PUBLISH_FAILURE'; END $$;
        CREATE TRIGGER wave3_fail_valuation_publish
        BEFORE INSERT OR UPDATE ON finance_valuation_methods
        FOR EACH ROW EXECUTE FUNCTION wave3_fail_valuation_publish();
      `);
      await expect(runDcfFcffValuation(valuationParams)).rejects.toThrow(
        'WAVE3_INJECTED_VALUATION_PUBLISH_FAILURE'
      );
      const valuationFailureReadback = await pool.query(
        `SELECT version.freshness,revision.content_semantic_hash,revision.compute_run_id,
                (SELECT count(*)::int FROM compute_job_outputs output
                  JOIN compute_jobs job ON job.id=output.job_id
                 WHERE job.organization_id=$1 AND job.job_type='VALUATION_COMPUTE'
                   AND job.input_artifact_id=$3) AS output_count,
                (SELECT count(*)::int FROM finance_valuation_methods method
                 WHERE method.organization_id=$1 AND method.business_version_id=$2) AS method_count
           FROM finance_business_versions version
           JOIN finance_working_revisions revision
             ON revision.working_revision_id=version.source_working_revision_id
          WHERE version.organization_id=$1 AND version.business_version_id=$2`,
        [organizationId, valuationBusinessVersionId, downstream.valuation.artifactId]
      );
      expect(valuationFailureReadback.rows[0]).toEqual(
        expect.objectContaining({
          freshness: valuationBeforeFailure.rows[0].freshness,
          content_semantic_hash: valuationBeforeFailure.rows[0].content_semantic_hash,
          compute_run_id: valuationBeforeFailure.rows[0].compute_run_id,
          output_count: 0,
          method_count: 0,
        })
      );
      await pool.query(`DROP TRIGGER wave3_fail_valuation_publish ON finance_valuation_methods`);
      await pool.query(`DROP FUNCTION wave3_fail_valuation_publish()`);
      await pool.query(
        `UPDATE compute_job_runs SET outcome='failed',finished_at=now()
          WHERE job_id IN (SELECT id FROM compute_jobs WHERE organization_id=$1
                            AND job_type='VALUATION_COMPUTE' AND input_artifact_id=$2)
            AND outcome='running'`,
        [organizationId, downstream.valuation.artifactId]
      );
      await pool.query(
        `UPDATE compute_jobs SET status='queued',lease_owner=NULL,lease_expires_at=NULL,
                                started_at=NULL,finished_at=NULL
          WHERE organization_id=$1 AND job_type='VALUATION_COMPUTE' AND input_artifact_id=$2
            AND status='running'`,
        [organizationId, downstream.valuation.artifactId]
      );
      const valuationCompute = await runDcfFcffValuation(valuationParams);
      expect(valuationCompute.ok).toBe(true);
      if (!valuationCompute.ok) throw new Error(valuationCompute.message);
      expect(Number.isFinite(valuationCompute.enterpriseValue)).toBe(true);
      expect(valuationCompute.fcffYears).toHaveLength(1);
      const valuationReadback = await pool.query(
        `SELECT method_type,readiness,result_ev_decimal
           FROM finance_valuation_methods
          WHERE organization_id=$1 AND business_version_id=$2 AND method_type='DCF_FCFF'`,
        [organizationId, valuationBusinessVersionId]
      );
      expect(valuationReadback.rows).toHaveLength(1);
      expect(valuationReadback.rows[0]).toEqual(
        expect.objectContaining({ method_type: 'DCF_FCFF', readiness: 'READY' })
      );
      expect(Number(valuationReadback.rows[0].result_ev_decimal)).toBeCloseTo(
        valuationCompute.enterpriseValue,
        6
      );
      await approveCanonicalVersion(valuationBusinessVersionId);
      downstream.analysis = {
        artifactId: analysisArtifact.artifact.artifact_id,
        businessVersionId: analysisBusinessVersionId,
      };
      const approvedVersionIds = [
        statementBusinessVersionId,
        analysisBusinessVersionId,
        baselineBusinessVersionId,
        predictionBusinessVersionId,
        valuationBusinessVersionId,
      ];
      const coldLifecycleReadback = await pool.query(
        `SELECT version.business_version_id,version.status,version.approved_by,
                version.compute_snapshot_id,version.content_semantic_hash,version.compute_run_id,
                version.source_working_revision_id,revision.working_revision_id,
                revision.content_semantic_hash AS revision_hash,revision.compute_run_id AS revision_run,
                snapshot.content_semantic_hash AS snapshot_hash,snapshot.compute_run_id AS snapshot_run,
                event.actor_id AS approval_actor
           FROM finance_business_versions version
           JOIN finance_working_revisions revision
             ON revision.working_revision_id=version.source_working_revision_id
            AND revision.organization_id=version.organization_id AND revision.is_current=true
           JOIN finance_compute_snapshots snapshot
             ON snapshot.compute_snapshot_id=version.compute_snapshot_id
            AND snapshot.organization_id=version.organization_id
           JOIN artifact_lifecycle_events event
             ON event.business_version_id=version.business_version_id
            AND event.organization_id=version.organization_id AND event.action='APPROVE'
          WHERE version.organization_id=$1 AND version.business_version_id=ANY($2::text[])
          ORDER BY version.business_version_id`,
        [organizationId, approvedVersionIds]
      );
      expect(coldLifecycleReadback.rows).toHaveLength(5);
      for (const row of coldLifecycleReadback.rows) {
        expect(row.status).toBe('APPROVED');
        expect(row.approved_by).toBe(adminId);
        expect(row.approval_actor).toBe(adminId);
        expect(row.source_working_revision_id).toBe(row.working_revision_id);
        expect(row.content_semantic_hash).toBe(row.revision_hash);
        expect(row.content_semantic_hash).toBe(row.snapshot_hash);
        expect(row.compute_run_id).toBe(row.revision_run);
        expect(row.compute_run_id).toBe(row.snapshot_run);
      }
      const downstreamReadback = await pool.query(
        `SELECT artifact.artifact_id,artifact.artifact_type,version.business_version_id
           FROM finance_artifacts artifact
           JOIN finance_business_versions version
             ON version.artifact_id=artifact.artifact_id
            AND version.organization_id=artifact.organization_id
          WHERE artifact.organization_id=$1
            AND artifact.artifact_id=ANY($2::text[])
            AND version.business_version_id=ANY($3::text[])
          ORDER BY artifact.artifact_type`,
        [
          organizationId,
          Object.values(downstream).map((identity) => identity.artifactId),
          Object.values(downstream).map((identity) => identity.businessVersionId),
        ]
      );
      expect(downstreamReadback.rows).toHaveLength(4);
      for (const [workspace, identity] of Object.entries(downstream)) {
        const expectedType = {
          baseline: 'BASELINE_MODEL',
          prediction: 'PREDICTION_SCENARIO',
          analysis: 'HISTORICAL_ANALYSIS',
          valuation: 'VALUATION_CASE',
        }[workspace];
        expect(downstreamReadback.rows).toContainEqual(
          expect.objectContaining({
            artifact_id: identity.artifactId,
            artifact_type: expectedType,
            business_version_id: identity.businessVersionId,
          })
        );
      }
      const analysisReadback = await pool.query(
        `SELECT catalog.kpi_code,value.value_status,value.value_decimal,job.status AS job_status
           FROM finance_analysis_kpi_values value
           JOIN finance_analysis_kpi_catalog catalog ON catalog.id=value.kpi_catalog_id
           JOIN compute_jobs job ON job.input_artifact_id=$3
          WHERE value.organization_id=$1 AND value.business_version_id=$2
            AND catalog.kpi_code='CURRENT_RATIO'
          ORDER BY job.created_at DESC LIMIT 1`,
        [organizationId, downstream.analysis.businessVersionId, downstream.analysis.artifactId]
      );
      expect(analysisReadback.rows).toEqual([
        expect.objectContaining({
          kpi_code: 'CURRENT_RATIO',
          value_status: 'PRESENT_NONZERO',
          value_decimal: '3',
          job_status: 'succeeded',
        }),
      ]);
      const receiptReadback = await pool.query(
        `SELECT receipt_id,content_sha256
           FROM finance_statement_source_receipts
          WHERE organization_id=$1 AND receipt_id=ANY($2::text[])
          ORDER BY receipt_id`,
        [organizationId, staged.statements.map((item) => item.sourceReceiptId)]
      );
      expect(receiptReadback.rows).toHaveLength(6);
      expect(
        receiptReadback.rows.every((receipt) => receipt.content_sha256 === EXPECTED_PDF_SHA)
      ).toBe(true);
      const manifestPath = process.env.FINANCE_OWNER_FIXTURE_MANIFEST;
      if (manifestPath) {
        const statementIdentity = canonicalStatement.rows[0];
        const manifest = {
          schemaVersion: 1,
          fixture: 'wave3-finance-owner-review-v1',
          databaseGuard: 'consultify_w3_finance_owner_*',
          cleanup: 'WHOLE_DATABASE_DROP',
          source: { fileName: path.basename(PDF_PATH), sha256: EXPECTED_PDF_SHA },
          personas: {
            owner: { userId, organizationId, role: 'OWNER', membershipStatus: 'ACTIVE' },
            admin: { userId: adminId, organizationId, role: 'ADMIN', membershipStatus: 'ACTIVE' },
            foreignOwner: {
              userId: foreignUserId,
              organizationId: foreignOrganizationId,
              role: 'OWNER',
              membershipStatus: 'ACTIVE',
            },
          },
          statement: {
            statementPackId,
            artifactId: statementIdentity.artifact_id,
            businessVersionId: statementIdentity.business_version_id,
            statements: staged.statements.map((item) => ({
              statementId: item.statementId,
              statementType: item.statementType,
              periodLabel: item.periodLabel,
              sourceReceiptId: item.sourceReceiptId,
              receiptType: 'finance_statement_source_receipt',
              sourceSha256: item.sourceSha256,
            })),
          },
          workspaces: {
            statement: {
              artifactId: statementIdentity.artifact_id,
              businessVersionId: statementIdentity.business_version_id,
              fixtureState: 'EXACT_SIX_CONFIRMED',
              ownerReviewReady: false,
              deepLinkVerified: false,
              deepLink: `/finance/statements/${encodeURIComponent(primary)}`,
            },
            ...Object.fromEntries(
              Object.entries(downstream).map(([workspace, identity]) => [
                workspace,
                {
                  ...identity,
                  fixtureState:
                    workspace === 'analysis'
                      ? 'COMPUTED_CURRENT_RATIO_CONFIRMED'
                      : workspace === 'baseline'
                        ? 'COMPUTED_7_SCHEDULE_12_PERIOD_CONFIRMED'
                        : workspace === 'prediction'
                          ? 'COMPUTED_STANDARD_BASE_CONFIRMED'
                          : workspace === 'valuation'
                            ? 'COMPUTED_DCF_FCFF_CONFIRMED'
                      : 'IDENTITY_SHELL_NOT_COMPUTED',
                  ownerReviewReady: false,
                  deepLinkVerified: false,
                  deepLink: `/finance/${
                    {
                      baseline: 'models',
                      prediction: 'predictions',
                      analysis: 'analyses',
                      valuation: 'valuations',
                    }[workspace]
                  }/${encodeURIComponent(identity.artifactId)}`,
                },
              ])
            ),
          },
        };
        await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
          mode: 0o600,
          flag: 'wx',
        });
      }
      const reconciliationCountBeforeReopen = await pool.query(
        `SELECT count(*)::int AS count FROM finance_reconciliation_runs
          WHERE organization_id=$1 AND business_version_id=$2`,
        [organizationId, statementBusinessVersionId]
      );
      const approvedStatementVersion = await getBusinessVersion(
        organizationId,
        statementBusinessVersionId
      );
      const reopenedStatement = await reopenVersion({
        organizationId,
        businessVersionId: statementBusinessVersionId,
        actorId: adminId,
        role: 'approver',
        expectedVersion: approvedStatementVersion!.version,
        reason: 'Wave 3 old-BV publication CAS probe',
      });
      expect(reopenedStatement.ok).toBe(true);
      await expect(
        runReconciliation({
          organizationId,
          artifactId: canonicalStatement.rows[0].artifact_id,
          businessVersionId: statementBusinessVersionId,
          sourceSystem: 'wave3:stale-old-bv-probe',
          mappingResults: mappedStatement,
          createdBy: userId,
        })
      ).rejects.toThrow('STATEMENT_RECONCILIATION_STALE_PUBLICATION');
      const reconciliationCountAfterReopen = await pool.query(
        `SELECT count(*)::int AS count FROM finance_reconciliation_runs
          WHERE organization_id=$1 AND business_version_id=$2`,
        [organizationId, statementBusinessVersionId]
      );
      expect(reconciliationCountAfterReopen.rows[0].count).toBe(
        reconciliationCountBeforeReopen.rows[0].count
      );
    }, 30_000);
  }
);

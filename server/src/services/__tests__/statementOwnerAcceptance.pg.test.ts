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
import { createArtifact } from '../finance/canonical/artifactVersionService.js';
import { computeAnalysisKpis } from '../finance/canonical/kpiComputeService.js';
import { insertEdge } from '../finance/canonical/lineageService.js';

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
      for (const [lineCode, value] of [
        ['CURRENT_ASSETS', 2_100_000],
        ['CURRENT_LIABILITIES', 700_000],
      ] as const) {
        const line = await pool.query(
          `SELECT id FROM financial_statement_lines
            WHERE line_code=$1 AND organization_id IS NULL LIMIT 1`,
          [lineCode]
        );
        expect(line.rows).toHaveLength(1);
        await pool.query(
          `INSERT INTO finance_stmt_lines
             (organization_id,business_version_id,statement_type,canonical_line_id,
              entity_id,period_id,accumulation_basis,consolidation_scope,value_status,
              value_decimal,native_currency,presentation_currency,unit,sign_convention,
              accounting_policy,created_by)
           VALUES ($1,$2,'BS',$3,$4,$5,'FULL_YEAR','CONSOLIDATED','PRESENT_NONZERO',
                   $6,'PLN','PLN','UNITS','NATURAL','IFRS',$7)`,
          [
            organizationId,
            statementBusinessVersionId,
            line.rows[0].id,
            entity.rows[0].id,
            period.rows[0].period_id,
            value,
            userId,
          ]
        );
      }
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
      downstream.analysis = {
        artifactId: analysisArtifact.artifact.artifact_id,
        businessVersionId: analysisBusinessVersionId,
      };
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
    }, 30_000);
  }
);

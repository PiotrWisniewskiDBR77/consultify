import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RUN_REAL_DB = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const describeRealDb = RUN_REAL_DB ? describe : describe.skip;
const databaseUrl = String(process.env.DATABASE_URL || '');

describeRealDb('ASM-002 ordered Assessment schema on real PostgreSQL', () => {
  const admin = new Client({ connectionString: databaseUrl });

  beforeAll(async () => {
    if (!databaseUrl.startsWith('postgresql://')) {
      throw new Error('ASM-002 requires an explicit disposable PostgreSQL URL');
    }
    await admin.connect();
    await admin.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'asm_runtime') THEN
          DROP OWNED BY asm_runtime;
          DROP ROLE asm_runtime;
        END IF;
      END $$;
      DROP TABLE IF EXISTS assessment_initiative_generation_runs;
      DROP TABLE IF EXISTS assessment_report_section_history;
      DROP TABLE IF EXISTS assessment_report_sections;
      DROP TABLE IF EXISTS assessment_definitions;
      DROP TABLE IF EXISTS assessment_reports;
      DROP TABLE IF EXISTS assessments;

      CREATE TABLE assessments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL);
      CREATE TABLE assessment_reports (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE assessment_initiative_generation_runs (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        report_id TEXT,
        mode TEXT NOT NULL,
        methodology_id TEXT NOT NULL,
        requested_count INTEGER NOT NULL,
        batch_size INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_by TEXT NOT NULL,
        inputs_json TEXT,
        stats_json TEXT,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const schemaMigration = readFileSync(
      path.join(
        process.cwd(),
        'server',
        'migrations',
        '20260815_asm002_assessment_runtime_schema.sql'
      ),
      'utf8'
    );
    const idempotencyMigration = readFileSync(
      path.join(
        process.cwd(),
        'server',
        'migrations',
        '20260815_asm003_assessment_initiative_run_idempotency.sql'
      ),
      'utf8'
    );
    await admin.query(schemaMigration);
    await admin.query(idempotencyMigration);
    await admin.query(schemaMigration);
    await admin.query(idempotencyMigration);
    await admin.query(`
      CREATE ROLE asm_runtime NOLOGIN;
      GRANT USAGE ON SCHEMA public TO asm_runtime;
      GRANT SELECT, INSERT, UPDATE ON assessment_definitions,
        assessment_reports, assessment_report_sections,
        assessment_report_section_history,
        assessment_initiative_generation_runs TO asm_runtime;
    `);
  });

  afterAll(async () => {
    await admin.query('RESET ROLE').catch(() => undefined);
    await admin.end();
  });

  it('supports runtime reads/writes without DDL rights and rejects duplicate generation replay identity', async () => {
    await admin.query('SET ROLE asm_runtime');
    await expect(
      admin.query(
        `SELECT id, methodology_id, version, status FROM assessment_definitions WHERE 1 = 0`
      )
    ).resolves.toBeDefined();
    await expect(
      admin.query(
        `SELECT id, builder_report_id, axis_data, rejection_reason
           FROM assessment_reports WHERE 1 = 0`
      )
    ).resolves.toBeDefined();
    await expect(
      admin.query('CREATE TABLE asm_runtime_must_not_create (id TEXT)')
    ).rejects.toMatchObject({
      code: '42501',
    });
    await admin.query('ROLLBACK').catch(() => undefined);
    await admin.query('SET ROLE asm_runtime');

    const insert = `INSERT INTO assessment_initiative_generation_runs
      (id, assessment_id, organization_id, mode, methodology_id, requested_count,
       batch_size, status, created_by, idempotency_key)
      VALUES ($1, 'assessment-1', 'org-1', 'REPORT_ONLY', 'DRD', 5, 5, 'RUNNING', 'user-1', 'retry-1')`;
    await admin.query(insert, ['run-1']);
    await expect(admin.query(insert, ['run-2'])).rejects.toMatchObject({ code: '23505' });
  });
});

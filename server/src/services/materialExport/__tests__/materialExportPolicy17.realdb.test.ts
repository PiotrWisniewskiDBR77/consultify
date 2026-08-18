import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MATERIAL_EXPORT_POLICY_VERSION, requireApprovedExportEngine } from '../materialExportPolicyService.js';
import { resolvePresentationTemplateForCreation } from '../../materials/creationIntent.js';

describe('MAT-POL-001 approved engine lock', () => {
  it('binds the four approved in-process engines to the installed lock versions and MIT', () => {
    const lockPath = path.resolve(process.cwd(), '..', 'package-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const expected = [
      ['native:docx', 'docx', '9.5.1', 'document'],
      ['native:pptxgenjs', 'pptxgenjs', '4.0.1', 'presentation'],
      ['native:exceljs', 'exceljs', '4.4.0', 'workbook'],
      ['native:pdfkit', 'pdfkit', '0.17.2', 'text_summary'],
    ] as const;
    for (const [key, pkg, version, semantics] of expected) {
      const engine = requireApprovedExportEngine(key);
      expect(engine).toMatchObject({ packageName: pkg, version, license: 'MIT', outputSemantics: semantics });
      expect(lock.packages[`node_modules/${pkg}`].version).toBe(version);
    }
    expect(MATERIAL_EXPORT_POLICY_VERSION).toBe('mat-policy-v1');
  });

  it('fails closed for unapproved or version-unbound engines', () => {
    expect(() => requireApprovedExportEngine('native:sharp-svg')).toThrow('MAT_EXPORT_ENGINE_NOT_APPROVED');
    expect(() => requireApprovedExportEngine('external:unknown')).toThrow('MAT_EXPORT_ENGINE_NOT_APPROVED');
  });
});

const DATABASE_URL = process.env.DATABASE_URL || '';
const CALLER_PREFIX = process.env.MAT_POL_FIXTURE_PREFIX || '';
const REAL_PG = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false'
  && process.env.MAT_POL_FIXTURE_OPT_IN === '1' && /^mat_pol_[a-z0-9_]+$/.test(CALLER_PREFIX)
  && /localhost|127\.0\.0\.1/.test(DATABASE_URL);

describe.skipIf(!REAL_PG)('MAT-POL-001 migration17 storage contract (real PG)', () => {
  let pool: Pool;
  let lockClient: PoolClient;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    lockClient = await pool.connect();
    const db = await lockClient.query(`SELECT current_database() AS name`);
    if (!String(db.rows[0]?.name || '').startsWith(CALLER_PREFIX)) {
      throw new Error(`MAT-POL fixture refuses database outside caller prefix ${CALLER_PREFIX}`);
    }
    await lockClient.query(`SELECT pg_advisory_lock(hashtext($1))`, [`${CALLER_PREFIX}:m17`]);
  });

  afterAll(async () => {
    if (!lockClient) return;
    try {
      await lockClient.query('BEGIN');
      await lockClient.query(`DELETE FROM artifact_export_receipts WHERE export_receipt_id LIKE 'mat-pol-%'`);
      await lockClient.query(`DELETE FROM presentation_templates WHERE id LIKE 'mat-pol-template-%'`);
      await lockClient.query('COMMIT');
      const residue = await lockClient.query(
        `SELECT (SELECT count(*) FROM artifact_export_receipts WHERE export_receipt_id LIKE 'mat-pol-%')::int AS receipts,
                (SELECT count(*) FROM presentation_templates WHERE id LIKE 'mat-pol-template-%')::int AS templates`
      );
      expect(residue.rows[0]).toEqual({ receipts: 0, templates: 0 });
      const trigger = await lockClient.query(
        `SELECT tgenabled FROM pg_trigger WHERE tgrelid='artifact_export_receipts'::regclass
          AND tgname='trg_artifact_export_receipt_immutability' AND NOT tgisinternal`
      );
      expect(trigger.rows[0]?.tgenabled).toBe('O');
    } catch (error) {
      await lockClient.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [`${CALLER_PREFIX}:m17`]);
      lockClient.release();
      await pool.end();
    }
  });

  it('keeps historical provenance unknown and rejects a policy receipt outside the approved lock', async () => {
    const id = `mat-pol-${randomUUID()}`;
    try {
      const columns = await pool.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name='artifact_export_receipts'
            AND column_name IN ('policy_contract_version','render_engine_version','render_engine_license','output_semantics')`
      );
      expect(columns.rowCount).toBe(4);
      const templateDefaults = await pool.query(
        `SELECT table_name, column_default FROM information_schema.columns
          WHERE table_schema='public' AND column_name='provenance_status'
            AND table_name IN ('document_studio_templates','report_builder_templates','presentation_templates','tp_base_templates')`
      );
      expect(templateDefaults.rowCount).toBe(4);
      expect(templateDefaults.rows.every((row) => String(row.column_default).includes('unknown'))).toBe(true);

      await expect(pool.query(
        `INSERT INTO artifact_export_receipts (
           export_receipt_id, organization_id, artifact_kind, source_record_id, source_version,
           source_content_hash, output_format, provider_key, status, created_by,
           policy_contract_version, render_engine_version, render_engine_license, output_semantics
         ) VALUES ($1,$2,'presentation',$3,1,$4,'png','native:sharp-svg','pending',$5,
                   'mat-policy-v1','1.0.0','MIT','presentation')`,
        [id, `${id}-org`, `${id}-source`, 'a'.repeat(64), `${id}-user`]
      )).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query(
        `INSERT INTO artifact_export_receipts (
           export_receipt_id, organization_id, artifact_kind, source_record_id, source_version,
           source_content_hash, output_format, provider_key, status, created_by,
           policy_contract_version, render_engine_version
         ) VALUES ($1,$2,'document',$3,1,$4,'docx','native:docx','pending',$5,'mat-policy-v1','9.5.1')`,
        [`${id}-partial`, `${id}-org`, `${id}-partial-source`, 'b'.repeat(64), `${id}-user`]
      )).rejects.toMatchObject({ code: '23514' });
    } finally {
      await pool.query(`DELETE FROM artifact_export_receipts WHERE export_receipt_id=$1`, [id]);
    }
  });

  it('quarantines unknown provenance and resolves only after an explicit approved record', async () => {
    const id = `mat-pol-template-${randomUUID()}`;
    try {
      await pool.query(
        `INSERT INTO presentation_templates
          (id, organization_id, name, deck_type, outline_json, is_system, is_active, lifecycle_state)
         VALUES ($1,NULL,'Policy fixture','policy','[]',TRUE,TRUE,'approved')`,
        [id]
      );
      await expect(resolvePresentationTemplateForCreation(
        { kind: 'internal', canonicalTemplateId: id, originRuntime: 'presentation_template' },
        { organizationId: `mat-pol-org-${id}` }
      )).rejects.toMatchObject({ code: 'TEMPLATE_FORBIDDEN' });
      await expect(pool.query(
        `UPDATE presentation_templates SET provenance_status='approved' WHERE id=$1`, [id]
      )).rejects.toMatchObject({ code: '23514' });
      await pool.query(
        `UPDATE presentation_templates
            SET provenance_status='approved', provenance_json=$2::jsonb
          WHERE id=$1`,
        [id, JSON.stringify({ authority: 'AMD-MAT-POLICY-001', actor: 'test-actor', version: 'v1', evidence: 'test-fixture-only' })]
      );
      await expect(resolvePresentationTemplateForCreation(
        { kind: 'internal', canonicalTemplateId: id, originRuntime: 'presentation_template' },
        { organizationId: `mat-pol-org-${id}` }
      )).resolves.toMatchObject({ canonicalTemplateId: id, source: 'canonical' });
    } finally {
      await pool.query(`DELETE FROM presentation_templates WHERE id=$1`, [id]);
    }
  });

  it('keeps policy metadata immutable across pending to terminal transitions', async () => {
    const id = `mat-pol-tamper-${randomUUID()}`;
    try {
      await pool.query(
        `INSERT INTO artifact_export_receipts (
           export_receipt_id,organization_id,artifact_kind,source_record_id,source_version,
           source_content_hash,output_format,provider_key,status,created_by,
           policy_contract_version,render_engine_version,render_engine_license,output_semantics)
         VALUES($1,$2,'document',$3,1,$4,'docx','native:docx','pending',$5,
                'mat-policy-v1','9.5.1','MIT','document')`,
        [id, `${id}-org`, `${id}-source`, 'c'.repeat(64), `${id}-user`]
      );
      await expect(pool.query(
        `UPDATE artifact_export_receipts SET status='failed', failure_code='X', completed_at=now(),
                render_engine_version='9.5.0' WHERE export_receipt_id=$1`, [id]
      )).rejects.toMatchObject({ code: '55000' });
      const row = await pool.query(
        `SELECT status,render_engine_version FROM artifact_export_receipts WHERE export_receipt_id=$1`, [id]
      );
      expect(row.rows[0]).toMatchObject({ status: 'pending', render_engine_version: '9.5.1' });
    } finally {
      await pool.query(`DELETE FROM artifact_export_receipts WHERE export_receipt_id=$1`, [id]);
    }
  });

  it('rolls back a forced cleanup failure while the retained advisory guard remains held', async () => {
    const client = await pool.connect();
    const id = `mat-pol-cleanup-${randomUUID()}`;
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO artifact_export_receipts (
          export_receipt_id,organization_id,artifact_kind,source_record_id,source_version,
          source_content_hash,output_format,provider_key,status,created_by)
         VALUES($1,$2,'document',$3,1,$4,'legacy','unavailable','pending',$5)`,
        [id, `${id}-org`, `${id}-source`, 'd'.repeat(64), `${id}-user`]
      );
      await expect(client.query(`SELECT definitely_missing_cleanup_column FROM artifact_export_receipts`))
        .rejects.toMatchObject({ code: '42703' });
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    const residue = await pool.query(
      `SELECT count(*)::int AS n FROM artifact_export_receipts WHERE export_receipt_id=$1`, [id]
    );
    expect(residue.rows[0].n).toBe(0);
    const held = await lockClient.query(
      `SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()`
    );
    expect(held.rows[0].n).toBeGreaterThan(0);
  });
});

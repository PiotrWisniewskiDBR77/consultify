/** MAT-MVP-EXPORT-001 — DOC/XLSX governed receipts on real PostgreSQL. */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HandoffSpineError } from '../../artifactHandoff/handoffSpineService.js';
import {
  beginMaterialExport,
  completeMaterialExport,
  failMaterialExport,
  hashExportBytes,
} from '../materialExportReceiptService.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const PREFIX = `mat-export-${randomUUID().slice(0, 8)}`;
const ORG_A = `${PREFIX}-org-a`;
const ORG_B = `${PREFIX}-org-b`;
const USER_A = `${PREFIX}-user-a`;

describe.skipIf(!REAL_PG)('MAT-MVP-EXPORT-001 DOC/XLSX receipts (real PG)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: DATABASE_URL });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM artifact_export_receipts WHERE source_record_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.end();
  });

  it('pins document version/hash/provider and completes with independently reproducible bytes proof', async () => {
    const begun = await beginMaterialExport({
      organizationId: ORG_A,
      artifactKind: 'document',
      sourceRecordId: `${PREFIX}-doc`,
      sourceVersion: 7,
      sourceContent: { sections: [{ id: 's1', text: 'approved v7' }] },
      outputFormat: 'docx',
      createdBy: USER_A,
    });
    const bytes = Buffer.from('real-docx-provider-bytes');
    const receipt = await completeMaterialExport({ begun, organizationId: ORG_A, bytes });
    expect(receipt).toMatchObject({
      artifactKind: 'document',
      sourceVersion: 7,
      providerKey: 'native:docx',
      policyContractVersion: 'mat-policy-v1',
      renderEngineVersion: '9.5.1',
      renderEngineLicense: 'MIT',
      outputSemantics: 'document',
      status: 'succeeded',
      outputContentHash: hashExportBytes(bytes),
      outputByteSize: bytes.length,
    });
    expect(receipt.providerJobId).toContain('native-job:document:');
  });

  it('coalesces 12 concurrent XLSX requests to one tenant-scoped receipt', async () => {
    const input = {
      organizationId: ORG_A,
      artifactKind: 'workbook' as const,
      sourceRecordId: `${PREFIX}-workbook`,
      sourceVersion: 11,
      sourceContent: { sheets: [{ id: 'sheet-1', rows: [[1, 2, 3]] }] },
      outputFormat: 'xlsx',
      createdBy: USER_A,
      requestKey: 'download-click-1',
    };
    const attempts = await Promise.all(Array.from({ length: 12 }, () => beginMaterialExport(input)));
    expect(new Set(attempts.map((attempt) => attempt.receipt.exportReceiptId)).size).toBe(1);
    expect(attempts.filter((attempt) => attempt.replayed).length).toBe(11);

    const bytes = Buffer.from('real-xlsx-provider-bytes');
    const completed = await completeMaterialExport({
      begun: attempts[0],
      organizationId: ORG_A,
      bytes,
    });
    const replay = await beginMaterialExport(input);
    const replayCompletion = await completeMaterialExport({
      begun: replay,
      organizationId: ORG_A,
      bytes,
    });
    expect(replayCompletion.exportReceiptId).toBe(completed.exportReceiptId);
    expect(replayCompletion.outputContentHash).toBe(completed.outputContentHash);

    const count = await pool.query(
      `SELECT COUNT(*)::int AS count FROM artifact_export_receipts
        WHERE organization_id=$1 AND idempotency_key=$2`,
      [ORG_A, attempts[0].idempotencyKey]
    );
    expect(count.rows[0].count).toBe(1);
    expect(attempts[0].receipt).toMatchObject({
      policyContractVersion: 'mat-policy-v1',
      renderEngineVersion: '4.4.0',
      renderEngineLicense: 'MIT',
      outputSemantics: 'workbook',
    });
  });

  it('rejects same-key source drift and different provider output', async () => {
    const base = {
      organizationId: ORG_A,
      artifactKind: 'document' as const,
      sourceRecordId: `${PREFIX}-drift-doc`,
      sourceVersion: 2,
      sourceContent: { body: 'v2' },
      outputFormat: 'pdf',
      createdBy: USER_A,
      requestKey: 'stable-request',
    };
    const begun = await beginMaterialExport(base);
    await completeMaterialExport({
      begun,
      organizationId: ORG_A,
      bytes: Buffer.from('pdf-v2'),
    });
    await expect(
      beginMaterialExport({ ...base, sourceVersion: 3, sourceContent: { body: 'v3' } })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    const replay = await beginMaterialExport(base);
    await expect(
      completeMaterialExport({
        begun: replay,
        organizationId: ORG_A,
        bytes: Buffer.from('different-pdf-v2'),
      })
    ).rejects.toMatchObject({ code: 'OUTPUT_HASH_CONFLICT' });
  });

  it('records provider failure and refuses a terminal retry', async () => {
    const begun = await beginMaterialExport({
      organizationId: ORG_A,
      artifactKind: 'workbook',
      sourceRecordId: `${PREFIX}-failed-workbook`,
      sourceVersion: 1,
      sourceContent: { sheets: [] },
      outputFormat: 'xlsx',
      createdBy: USER_A,
    });
    const failed = await failMaterialExport({
      begun,
      organizationId: ORG_A,
      failureCode: 'WORKBOOK_RENDER_FAILED',
    });
    expect(failed).toMatchObject({ status: 'failed', failureCode: 'WORKBOOK_RENDER_FAILED' });
    await expect(
      beginMaterialExport({
        organizationId: ORG_A,
        artifactKind: 'workbook',
        sourceRecordId: `${PREFIX}-failed-workbook`,
        sourceVersion: 1,
        sourceContent: { sheets: [] },
        outputFormat: 'xlsx',
        createdBy: USER_A,
      })
    ).rejects.toMatchObject({ code: 'TERMINAL_EXPORT_REPLAY' });
  });

  it('enforces tenant isolation and terminal immutability at the database boundary', async () => {
    const begun = await beginMaterialExport({
      organizationId: ORG_A,
      artifactKind: 'document',
      sourceRecordId: `${PREFIX}-tenant-doc`,
      sourceVersion: 1,
      sourceContent: { body: 'tenant A' },
      outputFormat: 'docx',
      createdBy: USER_A,
    });
    await expect(
      completeMaterialExport({ begun, organizationId: ORG_B, bytes: Buffer.from('no') })
    ).rejects.toThrow(HandoffSpineError);
    const completed = await completeMaterialExport({
      begun,
      organizationId: ORG_A,
      bytes: Buffer.from('tenant-a-docx'),
    });
    await expect(
      pool.query(
        `UPDATE artifact_export_receipts SET source_version=99 WHERE export_receipt_id=$1`,
        [completed.exportReceiptId]
      )
    ).rejects.toThrow(/immutable/);
    await expect(
      pool.query(
        `UPDATE artifact_export_receipts SET status='failed', failure_code='TAMPERED'
          WHERE export_receipt_id=$1`,
        [completed.exportReceiptId]
      )
    ).rejects.toThrow(/terminal immutability/);
  });
});

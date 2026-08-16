/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import {
  beginMaterialExport,
  completeMaterialExport,
  failMaterialExport,
  hashExportBytes,
} from '../../materialExport/materialExportReceiptService.js';

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url))
  throw new Error('DOC BVP requires disposable local PostgreSQL');
const prefix = `doc-bvp-${Date.now()}-${randomUUID().slice(0, 6)}`;
const org = `${prefix}-org`;
const pool = new Pool({ connectionString: url });

afterAll(async () => {
  await pool.query(`DELETE FROM artifact_export_receipts WHERE source_record_id LIKE $1`, [
    `${prefix}%`,
  ]);
  await pool.end();
});

describe('MAT-MVP-DOC-001 governed DOCX export receipts', () => {
  it('pins exact source version/hash and survives cold receipt reopen', async () => {
    const source = {
      title: 'Board memo',
      sections: [{ id: 's1', blocks: [{ text: 'approved v4' }] }],
    };
    const begun = await beginMaterialExport({
      organizationId: org,
      artifactKind: 'document',
      sourceRecordId: `${prefix}-exact`,
      sourceVersion: 4,
      sourceContent: source,
      outputFormat: 'docx',
      createdBy: `${prefix}-user`,
    });
    const bytes = Buffer.from('PK\u0003\u0004-real-docx-output-v4');
    const completed = await completeMaterialExport({ begun, organizationId: org, bytes });

    const cold = new Pool({ connectionString: url, max: 1 });
    try {
      const row = await cold.query(
        `SELECT source_version, source_content_hash, output_content_hash, output_byte_size,
                provider_key, status FROM artifact_export_receipts WHERE export_receipt_id=$1`,
        [completed.exportReceiptId]
      );
      expect(row.rowCount).toBe(1);
      expect(row.rows[0]).toMatchObject({
        source_version: 4,
        source_content_hash: begun.receipt.sourceContentHash,
        output_content_hash: hashExportBytes(bytes),
        output_byte_size: bytes.length,
        provider_key: 'native:docx',
        status: 'succeeded',
      });
    } finally {
      await cold.end();
    }
  });

  it('coalesces concurrent same-version DOCX exports into exactly one receipt', async () => {
    const input = {
      organizationId: org,
      artifactKind: 'document' as const,
      sourceRecordId: `${prefix}-race`,
      sourceVersion: 9,
      sourceContent: { body: 'v9' },
      outputFormat: 'docx',
      createdBy: `${prefix}-user`,
      requestKey: 'double-click',
    };
    const attempts = await Promise.all(Array.from({ length: 8 }, () => beginMaterialExport(input)));
    expect(new Set(attempts.map((a) => a.receipt.exportReceiptId)).size).toBe(1);
    expect(attempts.filter((a) => a.replayed).length).toBe(7);
    await completeMaterialExport({
      begun: attempts[0],
      organizationId: org,
      bytes: Buffer.from('docx-race'),
    });
    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_export_receipts WHERE organization_id=$1 AND source_record_id=$2`,
      [org, input.sourceRecordId]
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('records renderer failure terminally and never fabricates DOCX bytes', async () => {
    const begun = await beginMaterialExport({
      organizationId: org,
      artifactKind: 'document',
      sourceRecordId: `${prefix}-failure`,
      sourceVersion: 2,
      sourceContent: { body: 'v2' },
      outputFormat: 'docx',
      createdBy: `${prefix}-user`,
    });
    const failed = await failMaterialExport({
      begun,
      organizationId: org,
      failureCode: 'DOCX_RENDER_FAILED',
    });
    expect(failed).toMatchObject({
      status: 'failed',
      failureCode: 'DOCX_RENDER_FAILED',
      outputContentHash: null,
    });
    await expect(
      beginMaterialExport({
        organizationId: org,
        artifactKind: 'document',
        sourceRecordId: `${prefix}-failure`,
        sourceVersion: 2,
        sourceContent: { body: 'v2' },
        outputFormat: 'docx',
        createdBy: `${prefix}-user`,
      })
    ).rejects.toMatchObject({ code: 'TERMINAL_EXPORT_REPLAY' });
  });
});

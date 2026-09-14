import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { OrganizationExportResult } from '../organizationLifecycleService.js';
import { writeOrganizationExportArchive } from '../organizationExportArchiveService.js';

const outputs: string[] = [];
afterEach(async () => Promise.all(outputs.splice(0).map((file) => fs.rm(file, { force: true }))));

describe('organization enterprise archive', () => {
  it('writes a ZIP receipt with JSON and table-specific CSV hashes and explicit omissions', async () => {
    const output = path.join(os.tmpdir(), `organization-export-archive-${Date.now()}.zip`);
    outputs.push(output);
    const result: OrganizationExportResult = {
      organization: { id: 'org-a', name: 'A' },
      exportedAt: '2026-09-13T20:00:00.000Z',
      tables: { tasks: [{ id: 'task-1', title: 'Comma, quote " and newline\n' }] },
      rowCounts: { tasks: 1 },
      skipped: [],
      totalRows: 1,
      securityManifest: {
        policyVersion: 'tenant-export-contract-v10-20260913',
        complete: true,
        truncated: false,
        scope: 'exact',
        tableIdentityVersion: 'schema-qualified-v1',
        includedSchemas: ['public'],
        unresolvedTables: [],
        excludedTables: [{ table: 'api_keys', reason: 'credential material' }],
        derivedTables: [{ table: '_migration_518_done', reason: 'marker', derivedFrom: { kind: 'REBUILD_PROCEDURE' } }],
        notIncluded: [{ scope: 'portable_methodology_ip_package', reason: 'separate owner decision' }],
        excludedColumns: [],
      },
    };
    const manifest = await writeOrganizationExportArchive(result, output);
    expect(manifest.files.map((file) => file.path)).toEqual([
      'csv/public.organizations.csv',
      'csv/public.tasks.csv',
      'json/public.organizations.json',
      'json/public.tasks.json',
    ]);
    expect(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
    expect(manifest.notIncluded[0].scope).toBe('portable_methodology_ip_package');
    const archive = await fs.readFile(output);
    expect(archive.subarray(0, 2).toString()).toBe('PK');
    expect(createHash('sha256').update(archive).digest('hex')).toMatch(/^[a-f0-9]{64}$/);
  });
});

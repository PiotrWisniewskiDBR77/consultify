import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import archiver from 'archiver';

import type { OrganizationExportResult } from './organizationLifecycleService.js';

interface ArchiveFileReceipt {
  path: string;
  sha256: string;
  bytes: number;
  rows: number;
}

export interface OrganizationExportArchiveManifest {
  formatVersion: 'consultify-organization-export-archive-v1';
  contractVersion: string;
  asOf: string;
  organizationId: string;
  totalRows: number;
  rowCounts: Record<string, number>;
  files: ArchiveFileReceipt[];
  excludedTables: OrganizationExportResult['securityManifest']['excludedTables'];
  derivedTables: NonNullable<OrganizationExportResult['securityManifest']['derivedTables']>;
  notIncluded: NonNullable<OrganizationExportResult['securityManifest']['notIncluded']>;
  complete: boolean;
}

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonical(nested)])
    );
  }
  return value;
};

const csvCell = (value: unknown): string => {
  const text =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(canonical(value))
        : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const safeIdentity = (identity: string): string => {
  if (!/^(?:public\.)?[A-Za-z_][A-Za-z0-9_]*$|^v8\.[A-Za-z_][A-Za-z0-9_]*$/.test(identity)) {
    throw new Error(`Unsafe export table identity: ${identity}`);
  }
  return identity.startsWith('public.') ? identity : identity.includes('.') ? identity : `public.${identity}`;
};

async function receipt(root: string, relative: string, rows: number): Promise<ArchiveFileReceipt> {
  const bytes = await fs.readFile(path.join(root, relative));
  return {
    path: relative,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    rows,
  };
}

async function writeTableFiles(
  root: string,
  identity: string,
  rows: Record<string, unknown>[]
): Promise<ArchiveFileReceipt[]> {
  const safe = safeIdentity(identity);
  const jsonPath = `json/${safe}.json`;
  const csvPath = `csv/${safe}.csv`;
  await fs.mkdir(path.join(root, 'json'), { recursive: true });
  await fs.mkdir(path.join(root, 'csv'), { recursive: true });
  await fs.writeFile(
    path.join(root, jsonPath),
    `${JSON.stringify(canonical(rows), null, 2)}\n`,
    'utf8'
  );
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(','));
  await fs.writeFile(path.join(root, csvPath), `${lines.join('\n')}\n`, 'utf8');
  return [await receipt(root, jsonPath, rows.length), await receipt(root, csvPath, rows.length)];
}

export async function writeOrganizationExportArchive(
  result: OrganizationExportResult,
  outputPath: string
): Promise<OrganizationExportArchiveManifest> {
  const organizationId = String(result.organization?.id || '');
  if (!organizationId) throw new Error('Organization export archive requires organization.id');
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), `consultify-org-export-${randomUUID()}-`));
  try {
    const files: ArchiveFileReceipt[] = [];
    files.push(...(await writeTableFiles(temporaryRoot, 'public.organizations', [result.organization!] as Record<string, unknown>[])));
    for (const identity of Object.keys(result.tables).sort()) {
      files.push(...(await writeTableFiles(temporaryRoot, identity, result.tables[identity])));
    }
    const manifest: OrganizationExportArchiveManifest = {
      formatVersion: 'consultify-organization-export-archive-v1',
      contractVersion: result.securityManifest.policyVersion,
      asOf: result.exportedAt,
      organizationId,
      totalRows: result.totalRows,
      rowCounts: canonical(result.rowCounts) as Record<string, number>,
      files: files.sort((left, right) => left.path.localeCompare(right.path)),
      excludedTables: result.securityManifest.excludedTables,
      derivedTables: result.securityManifest.derivedTables ?? [],
      notIncluded: result.securityManifest.notIncluded ?? [],
      complete: result.securityManifest.complete,
    };
    await fs.writeFile(
      path.join(temporaryRoot, 'manifest.json'),
      `${JSON.stringify(canonical(manifest), null, 2)}\n`,
      'utf8'
    );
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const archive = archiver('zip', { zlib: { level: 6 } });
    const target = createWriteStream(outputPath, { flags: 'wx' });
    const completed = pipeline(archive, target);
    archive.directory(temporaryRoot, false);
    await archive.finalize();
    await completed;
    return manifest;
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

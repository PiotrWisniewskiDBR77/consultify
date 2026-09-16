import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildTemplate1SheetSnapshot,
  extractMigrationSheetSnapshot,
} from '../template1-sheet-snapshot.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const acceptedWorkbookPath = path.join(
  repoRoot,
  'docs/program/TEMPLATE_1_BASES_20260916/fixtures/supplier-scorecard-accepted.xlsx'
);
const normalizedWorkbookPath = path.join(
  repoRoot,
  'docs/program/TEMPLATE_1_BASES_20260916/artifacts/supplier-scorecard-template-1.xlsx'
);
const migrationPath = path.join(repoRoot, 'server/migrations/20262271_template_base_family.sql');

test('SHEET-BASE schema snapshot exactly matches the accepted XLSX', async () => {
  const generated = await buildTemplate1SheetSnapshot(acceptedWorkbookPath);
  const stored = await extractMigrationSheetSnapshot(migrationPath);
  assert.deepEqual(stored, generated);
});

test('font-normalized output keeps the accepted workbook structure', async () => {
  const accepted = await buildTemplate1SheetSnapshot(acceptedWorkbookPath);
  const normalized = await buildTemplate1SheetSnapshot(normalizedWorkbookPath);
  delete accepted.sourceSha256;
  delete normalized.sourceSha256;
  assert.deepEqual(normalized, accepted);
});

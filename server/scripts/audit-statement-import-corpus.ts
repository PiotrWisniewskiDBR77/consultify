#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  autoMapLines,
  classifyStatementDocument,
  detectStatementType,
  extractFinancialLines,
  locateStatementSections,
  resolveDuplicateSuggestedMappings,
  resolveStatementColumnSelection,
} from '../src/services/financialStatementService.js';

export type ExpectedRow = {
  label: string;
  value?: number;
  canonicalId?: string | null;
};

export type CorpusCase = {
  fixtureFile: string;
  expected: {
    statementType: 'P&L' | 'BS' | 'CF';
    documentClass: string;
    selectedPeriodLabel: string;
    selectionStrategy: string;
    extracted: ExpectedRow[];
    mapped: ExpectedRow[];
  };
};

export type DiffEntry = {
  field: string;
  expected: unknown;
  actual: unknown;
  severity: 'fail';
};

export type AuditResult = {
  fixtureFile: string;
  pass: boolean;
  failureModes: string[];
  diffs: DiffEntry[];
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function pushIfDifferent(diffs: DiffEntry[], field: string, expected: unknown, actual: unknown): void {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return;
  diffs.push({ field, expected, actual, severity: 'fail' });
}

function classifyFailureModes(diffs: DiffEntry[]): string[] {
  const modes = new Set<string>();
  for (const diff of diffs) {
    if (diff.field.startsWith('detection.')) {
      modes.add('detection');
      continue;
    }
    if (diff.field.startsWith('columnSelection.')) {
      modes.add('section_or_period_selection');
      continue;
    }
    if (diff.field.startsWith('extracted.')) {
      modes.add('extraction');
      continue;
    }
    if (diff.field.startsWith('mapped.')) {
      modes.add('mapping');
      continue;
    }
    modes.add('unknown');
  }
  return [...modes];
}

export async function auditCase(root: string, corpusCase: CorpusCase, fixturesDirectory?: string): Promise<AuditResult> {
  const fixturePath = path.join(
    root,
    fixturesDirectory || 'server/scripts/fixtures/statement-ready',
    corpusCase.fixtureFile
  );
  const fixture = readJson<{
    fileName: string;
    text: string;
  }>(fixturePath);

  const documentProfile = classifyStatementDocument({
    fileName: fixture.fileName,
    parseMethod: fixture.fileName.endsWith('.xlsx') ? 'excel_import' : 'text_extraction',
    text: fixture.text,
  });
  const detection = detectStatementType(fixture.text);
  const sections = locateStatementSections(fixture.text, detection.statementType);
  const columnSelection = resolveStatementColumnSelection(fixture.text, detection);
  const extracted = extractFinancialLines(fixture.text, detection.statementType);
  const mapped = resolveDuplicateSuggestedMappings(
    await autoMapLines(extracted.lines, detection.statementType, {
      organizationId: '',
      templateFamily: documentProfile.templateFamily,
    })
  );

  const diffs: DiffEntry[] = [];
  pushIfDifferent(diffs, 'detection.statementType', corpusCase.expected.statementType, detection.statementType);
  pushIfDifferent(diffs, 'detection.documentClass', corpusCase.expected.documentClass, documentProfile.documentClass);
  pushIfDifferent(
    diffs,
    'columnSelection.selectedPeriodLabel',
    corpusCase.expected.selectedPeriodLabel,
    columnSelection.selectedPeriodLabel
  );
  pushIfDifferent(
    diffs,
    'columnSelection.selectionStrategy',
    corpusCase.expected.selectionStrategy,
    columnSelection.selectionStrategy
  );

  const actualExtracted = extracted.lines.map((line) => ({
    label: line.originalLabel,
    value: Number(line.value),
  }));
  const expectedExtracted = corpusCase.expected.extracted.map((row) => ({
    label: row.label,
    value: Number(row.value),
  }));
  pushIfDifferent(diffs, 'extracted.rows', expectedExtracted, actualExtracted);

  const actualMapped = mapped.map((line) => ({
    label: line.originalLabel,
    canonicalId: line.suggestedCanonicalId || null,
  }));
  const expectedMapped = corpusCase.expected.mapped.map((row) => ({
    label: row.label,
    canonicalId: row.canonicalId || null,
  }));
  pushIfDifferent(diffs, 'mapped.rows', expectedMapped, actualMapped);

  pushIfDifferent(diffs, 'extracted.sectionCount', 1, sections.length);

  return {
    fixtureFile: corpusCase.fixtureFile,
    pass: diffs.length === 0,
    failureModes: classifyFailureModes(diffs),
    diffs,
  };
}

function readFlagValue(flag: string): string | null {
  const entry = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return entry ? entry.slice(flag.length + 1) : null;
}

export async function runStatementImportAudit(params?: {
  root?: string;
  corpusPath?: string;
  fixturesDirectory?: string;
}): Promise<{ summary: any; results: AuditResult[] }> {
  const root = params?.root || process.cwd();
  const corpusPath =
    params?.corpusPath || path.join(root, 'server/scripts/fixtures/statement-ready-corpus.v1.json');
  const corpus = readJson<CorpusCase[]>(corpusPath);

  const results: AuditResult[] = [];
  for (const corpusCase of corpus) {
    results.push(await auditCase(root, corpusCase, params?.fixturesDirectory));
  }

  const failures = results.filter((result) => !result.pass);
  const summary = {
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    failureModes: Object.fromEntries(
      [...new Set(failures.flatMap((result) => result.failureModes))].map((mode) => [
        mode,
        failures.filter((result) => result.failureModes.includes(mode)).length,
      ])
    ),
  };

  return { summary, results };
}

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const json = process.argv.includes('--json');
  const root = process.cwd();
  const corpusPath =
    readFlagValue('--corpus') ||
    path.join(root, 'server/scripts/fixtures/statement-ready-corpus.v1.json');
  const fixturesDirectory = readFlagValue('--fixturesDir') || undefined;
  const { summary, results } = await runStatementImportAudit({ root, corpusPath, fixturesDirectory });
  const failures = results.filter((result) => !result.pass);

  if (json) {
    console.log(JSON.stringify({ summary, results }, null, 2));
  } else {
    console.log('\n[audit-statement-import-corpus] Summary');
    console.log(` - total: ${summary.total}`);
    console.log(` - passed: ${summary.passed}`);
    console.log(` - failed: ${summary.failed}`);
    for (const [mode, count] of Object.entries(summary.failureModes)) {
      console.log(` - ${mode}: ${count}`);
    }
    for (const result of results) {
      console.log(`\n[${result.pass ? 'PASS' : 'FAIL'}] ${result.fixtureFile}`);
      for (const diff of result.diffs) {
        console.log(`  - ${diff.field}`);
        console.log(`    expected: ${JSON.stringify(diff.expected)}`);
        console.log(`    actual:   ${JSON.stringify(diff.actual)}`);
      }
    }
  }

  if (strict && failures.length > 0) {
    throw new Error(
      `Statement import corpus audit failed for ${failures.length} case(s): ${failures
        .map((result) => result.fixtureFile)
        .join(', ')}`
    );
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entryUrl && import.meta.url === entryUrl) {
  main().catch((error) => {
    console.error('[audit-statement-import-corpus] Failed:', (error as Error)?.message || error);
    process.exit(1);
  });
}

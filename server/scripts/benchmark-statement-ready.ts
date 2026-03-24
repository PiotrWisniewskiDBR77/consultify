#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

import {
  autoMapLines,
  classifyStatementDocument,
  detectStatementType,
  extractFinancialLines,
  locateStatementSections,
  resolveDuplicateSuggestedMappings,
  resolveStatementColumnSelection,
} from '../src/services/financialStatementService.js';

type Fixture = {
  name: string;
  fileName: string;
  text: string;
  expectedStatementType: 'P&L' | 'BS' | 'CF';
  expectedDocumentClass: string;
  expectedMinExtracted: number;
  expectedMinMapped: number;
};

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const root = process.cwd();
  const fixtureDir = path.join(root, 'server/scripts/fixtures/statement-ready');
  const files = fs
    .readdirSync(fixtureDir)
    .filter((file) => file.endsWith('.json'))
    .sort();

  const fixtures = files.map((file) =>
    JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'))
  ) as Fixture[];

  const results: Array<{ name: string; pass: boolean; details: string }> = [];
  for (const fixture of fixtures) {
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

    const mappedCount = mapped.filter((line) => line.suggestedCanonicalId).length;
    const pass =
      detection.statementType === fixture.expectedStatementType &&
      documentProfile.documentClass === fixture.expectedDocumentClass &&
      sections.length > 0 &&
      !!columnSelection.selectionStrategy &&
      extracted.lines.length >= fixture.expectedMinExtracted &&
      mappedCount >= fixture.expectedMinMapped;

    results.push({
      name: fixture.name,
      pass,
      details: `detected=${detection.statementType}, class=${documentProfile.documentClass}, sections=${sections.length}, extracted=${extracted.lines.length}, mapped=${mappedCount}`,
    });
  }

  console.log('\n[benchmark-statement-ready] Summary:');
  for (const result of results) {
    console.log(` - ${result.pass ? 'OK' : 'FAIL'} ${result.name} :: ${result.details}`);
  }

  const failed = results.filter((result) => !result.pass);
  if (failed.length > 0) {
    console.log(
      `\n[benchmark-statement-ready] ${strict ? 'Strict mode enabled.' : 'Starter corpus currently below target baseline.'}`
    );
  }
  if (strict && failed.length > 0) {
    throw new Error(`Benchmark failed: ${failed.map((result) => result.name).join(', ')}`);
  }
}

main().catch((error) => {
  console.error('[benchmark-statement-ready] Failed:', (error as Error)?.message || error);
  process.exit(1);
});

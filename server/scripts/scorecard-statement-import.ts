#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

import { runStatementImportAudit } from './audit-statement-import-corpus.js';

function readFlagValue(flag: string): string | null {
  const entry = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return entry ? entry.slice(flag.length + 1) : null;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const corpusPath =
    readFlagValue('--corpus') ||
    path.join(root, 'server/scripts/fixtures/statement-ready-corpus.v1.json');
  const fixturesDirectory = readFlagValue('--fixturesDir') || undefined;
  const outputPath =
    readFlagValue('--out') ||
    path.join(root, 'docs/validation/finance-v3/generated/STATEMENT_IMPORT_SCORECARD.md');
  const label = readFlagValue('--label') || path.basename(corpusPath);

  const { summary, results } = await runStatementImportAudit({ root, corpusPath, fixturesDirectory });
  const passRate = summary.total > 0 ? ((summary.passed / summary.total) * 100).toFixed(1) : '0.0';
  const failureLines =
    results
      .filter((result) => !result.pass)
      .map((result) => {
        const modes = result.failureModes.join(', ') || 'unknown';
        return `- \`${result.fixtureFile}\` -> ${modes}`;
      })
      .join('\n') || '- none';

  const markdown = [
    '# Statement Import Scorecard',
    '',
    `- Corpus: \`${label}\``,
    `- Total fixtures: ${summary.total}`,
    `- Passed: ${summary.passed}`,
    `- Failed: ${summary.failed}`,
    `- Pass rate: ${passRate}%`,
    '',
    '## Failure Modes',
    '',
    ...Object.entries(summary.failureModes).map(([mode, count]) => `- ${mode}: ${count}`),
    '',
    '## Failing Fixtures',
    '',
    failureLines,
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown);
  console.log(`[scorecard-statement-import] Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error('[scorecard-statement-import] Failed:', (error as Error)?.message || error);
  process.exit(1);
});

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  SURFACE_KINDS,
  buildVariants,
  matrixContract,
  parseVariant,
  variantKey,
} from './contract.mjs';
import { validateVariantResult } from './evidence.mjs';

const root = path.resolve(process.argv[2] || 'test-results/e2e-1-matrix');
const out = path.resolve(process.argv[3] || path.join(root, 'aggregate'));

function findResults(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return findResults(target);
    return entry.name === 'result.json' ? [target] : [];
  });
}

const results = findResults(root).map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
const byVariant = new Map(results.map((result) => [result.variant, result]));
const variants = buildVariants();
const missingVariants = variants.map(variantKey).filter((key) => !byVariant.has(key));
const cells = results.flatMap((result) => result.cells || []);
const hard = cells.filter((cell) => cell.status !== 'PASS');
const regressions = results.flatMap((result) => result.delta?.regressions || []);
const unexpectedWrites = results.flatMap((result) => result.cleanup?.mutatingRequests || []);
const contract = matrixContract();
const contractErrors = results.flatMap((result) => {
  try {
    return validateVariantResult(result, parseVariant(result.variant)).map(
      (error) => `${result.variant}: ${error}`
    );
  } catch (error) {
    return [`${result.variant || 'UNKNOWN'}: ${String(error)}`];
  }
});
if (results.length !== contract.variantCount) {
  contractErrors.push(`variant denominator ${results.length}/${contract.variantCount}`);
}
const observedModuleRuns = results.reduce((sum, result) => sum + (result.modules?.length || 0), 0);
if (observedModuleRuns !== contract.moduleRuns) {
  contractErrors.push(`module-run denominator ${observedModuleRuns}/${contract.moduleRuns}`);
}
const summary = {
  generatedAt: new Date().toISOString(),
  contract,
  observed: {
    variants: results.length,
    moduleRuns: observedModuleRuns,
    cells: cells.length,
  },
  missingVariants,
  nonPassingCells: hard.length,
  regressions: regressions.length,
  unexpectedWrites,
  contractErrors,
  status:
    missingVariants.length ||
    hard.length ||
    regressions.length ||
    unexpectedWrites.length ||
    contractErrors.length
      ? 'FAIL'
      : 'PASS',
};
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));

const counts = Object.fromEntries(
  SURFACE_KINDS.map((kind) => [kind, { PASS: 0, FAIL: 0, MISSING: 0, BLOCKED: 0 }])
);
for (const cell of cells) counts[cell.kind][cell.status] += 1;
const lines = [
  '# E2E-1 krok 2 — matrix report',
  '',
  `- Result: **${summary.status}**`,
  `- Variants: ${results.length}/${contract.variantCount}`,
  `- Module runs: ${summary.observed.moduleRuns}/${contract.moduleRuns}`,
  `- Non-passing cells: ${hard.length}`,
  `- Regressions vs exact previous variants: ${regressions.length}`,
  `- Unexpected writes: ${unexpectedWrites.length}`,
  `- Contract errors: ${contractErrors.length}`,
  '',
  '| Surface | PASS | FAIL | MISSING | BLOCKED |',
  '| --- | ---: | ---: | ---: | ---: |',
  ...SURFACE_KINDS.map(
    (kind) =>
      `| ${kind} | ${counts[kind].PASS} | ${counts[kind].FAIL} | ${counts[kind].MISSING} | ${counts[kind].BLOCKED} |`
  ),
  '',
  '## Non-passing cells',
  '',
  '| Variant | Module | Surface | Control | Result |',
  '| --- | --- | --- | --- | --- |',
  ...hard
    .slice(0, 500)
    .map(
      (cell) =>
        `| ${cell.variant} | ${cell.module} | ${cell.kind} | ${String(cell.control).replaceAll('|', '\\|')} | ${cell.status} |`
    ),
  '',
];
fs.writeFileSync(path.join(out, 'REPORT.md'), lines.join('\n'));
if (summary.status !== 'PASS') process.exitCode = 1;

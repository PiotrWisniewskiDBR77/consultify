#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [sourceArg, jsonOutArg, markdownOutArg, overridesArg] = process.argv.slice(2);
if (!sourceArg || !jsonOutArg || !markdownOutArg) {
  console.error(
    'Usage: node scripts/cleanup/build-recovered-head-disposition.mjs <independent-heads.json> <output.json> <output.md> [semantic-overrides.json]'
  );
  process.exit(2);
}

const sourcePath = resolve(sourceArg);
const jsonOutPath = resolve(jsonOutArg);
const markdownOutPath = resolve(markdownOutArg);
const sourceBytes = readFileSync(sourcePath);
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
const source = JSON.parse(sourceBytes.toString('utf8'));
const overridesPath = overridesArg ? resolve(overridesArg) : null;
const overrides = overridesPath
  ? JSON.parse(readFileSync(overridesPath, 'utf8'))
  : { schemaVersion: 1, rows: [] };

if (!Array.isArray(overrides.rows)) {
  throw new Error('Invalid semantic overrides: rows must be an array');
}

const overrideByTip = new Map();
for (const override of overrides.rows) {
  if (!override.tip || overrideByTip.has(override.tip)) {
    throw new Error(`Invalid or duplicate semantic override tip: ${override.tip}`);
  }
  overrideByTip.set(override.tip, override);
}

if (!Array.isArray(source.rows) || source.rows.length !== source.independentHeadCount) {
  throw new Error(
    `Invalid inventory: rows=${source.rows?.length ?? 'missing'}, independentHeadCount=${source.independentHeadCount}`
  );
}

const rows = source.rows
  .map((row) => {
    const paths = Array.isArray(row.paths) ? row.paths : [];
    const devRenderOnly = paths.length > 0 && paths.every((path) => path.startsWith('dev-render/'));
    const base = {
      tip: row.tip,
      subject: row.subject,
      modules: row.modules,
      uniqueCommitCount: row.uniqueCommitCount,
      pathCount: row.pathCount,
      migrationPaths: row.migrationPaths,
      verdict: devRenderOnly ? 'REFERENCE_HARNESS_ONLY' : 'SEMANTIC_REVIEW_REQUIRED',
      taskId: null,
      recoveryRef: `refs/recovery/unknown-20260815/${row.tip}`,
      deletionAuthorized: false,
      evidenceRule: devRenderOnly
        ? 'Every unique path for this independent head is under dev-render/.'
        : null,
      nextAction: devRenderOnly
        ? 'Preserve as UX/reference evidence; product code must be implemented through a module gap task, never by merging this head.'
        : 'Review module-scoped diff and assign one semantic verdict plus task ID where integration is required.',
    };
    const override = overrideByTip.get(row.tip);
    return override
      ? {
          ...base,
          verdict: override.verdict,
          taskId: override.taskId ?? null,
          evidenceRule: override.evidenceRule,
          nextAction: override.nextAction,
        }
      : base;
  })
  .sort((a, b) => a.tip.localeCompare(b.tip));

const referenceHarnessOnly = rows.filter((row) => row.verdict === 'REFERENCE_HARNESS_ONLY').length;
const reviewRequired = rows.filter((row) => row.verdict === 'SEMANTIC_REVIEW_REQUIRED').length;
const representedSuperseded = rows.filter((row) => row.verdict === 'REPRESENTED_SUPERSEDED').length;
const integratedCanonical = rows.filter((row) => row.verdict === 'INTEGRATED_CANONICAL').length;
if (
  referenceHarnessOnly + reviewRequired + representedSuperseded + integratedCanonical !==
  source.independentHeadCount
) {
  throw new Error('Disposition count does not match independent head count');
}

for (const tip of overrideByTip.keys()) {
  if (!rows.some((row) => row.tip === tip)) {
    throw new Error(`Semantic override does not match an independent head: ${tip}`);
  }
}

const output = {
  schemaVersion: 1,
  source: {
    path: sourcePath,
    sha256: sourceSha256,
    canonicalEvidenceSha: source.canonicalSha,
    independentHeadCount: source.independentHeadCount,
  },
  rules: {
    referenceHarnessOnly:
      'All unique paths are confined to dev-render/. This is reference evidence, not production integration code.',
  },
  summary: {
    total: rows.length,
    referenceHarnessOnly,
    representedSuperseded,
    integratedCanonical,
    semanticReviewRequired: reviewRequired,
    deletionAuthorized: 0,
  },
  rows,
};

const md = `# Recovered independent-head disposition ledger

- Source SHA-256: \`${sourceSha256}\`
- Canonical evidence SHA: \`${source.canonicalSha}\`
- Independent heads: **${rows.length}**
- \`REFERENCE_HARNESS_ONLY\`: **${referenceHarnessOnly}**
- \`REPRESENTED_SUPERSEDED\`: **${representedSuperseded}**
- \`INTEGRATED_CANONICAL\`: **${integratedCanonical}**
- \`SEMANTIC_REVIEW_REQUIRED\`: **${reviewRequired}**
- Deletion authorized: **0**

The first closed semantic rule is deliberately narrow: a head receives
\`REFERENCE_HARNESS_ONLY\` only when every unique path is confined to
\`dev-render/\`. Such work is preserved as visual/UX reference evidence but is
never merged as product code. Any behavior worth shipping must be represented
by a module gap and implemented on the canonical product surface.

The exact machine ledger is
\`docs/cleanup/generated/recovered-head-disposition.json\`.
`;

writeFileSync(jsonOutPath, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(markdownOutPath, md);
console.log(JSON.stringify(output.summary, null, 2));

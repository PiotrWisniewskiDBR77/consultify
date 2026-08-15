#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [sourceArg, jsonOutArg, markdownOutArg] = process.argv.slice(2);

if (!sourceArg || !jsonOutArg || !markdownOutArg) {
  console.error(
    'Usage: node scripts/cleanup/build-recovered-tip-disposition.mjs <patch-equivalence.json> <output.json> <output.md>'
  );
  process.exit(2);
}

const sourcePath = resolve(sourceArg);
const jsonOutPath = resolve(jsonOutArg);
const markdownOutPath = resolve(markdownOutArg);
const sourceBytes = readFileSync(sourcePath);
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
const source = JSON.parse(sourceBytes.toString('utf8'));

if (!Array.isArray(source.results) || source.results.length !== source.tipCount) {
  throw new Error(
    `Invalid source ledger: results=${source.results?.length ?? 'missing'}, tipCount=${source.tipCount}`
  );
}

const rows = source.results
  .map((row) => {
    if (row.status === 'PATCH_REPRESENTED') {
      return {
        tip: row.tip,
        verdict: 'REPRESENTED_PATCH_EQUIVALENT',
        taskId: null,
        canonicalEvidenceSha: source.canonicalSha,
        equivalentCommitCount: row.equivalentCommitCount,
        uniqueCommitCount: 0,
        recoveryRef: `refs/recovery/unknown-20260815/${row.tip}`,
        deletionAuthorized: false,
        nextAction: 'Retain recovery ref until CLEAN-003; no product integration required.',
      };
    }

    if (row.status === 'UNIQUE_PATCHES') {
      return {
        tip: row.tip,
        verdict: 'SEMANTIC_REVIEW_REQUIRED',
        taskId: null,
        canonicalEvidenceSha: source.canonicalSha,
        equivalentCommitCount: row.equivalentCommitCount,
        uniqueCommitCount: row.uniqueCommitCount,
        recoveryRef: `refs/recovery/unknown-20260815/${row.tip}`,
        deletionAuthorized: false,
        nextAction: 'Assign module owner and semantic verdict before integration or deletion.',
      };
    }

    throw new Error(`Unsupported source status '${row.status}' for ${row.tip}`);
  })
  .sort((a, b) => a.tip.localeCompare(b.tip));

const represented = rows.filter((row) => row.verdict === 'REPRESENTED_PATCH_EQUIVALENT').length;
const reviewRequired = rows.filter((row) => row.verdict === 'SEMANTIC_REVIEW_REQUIRED').length;

if (represented !== source.patchRepresented || reviewRequired !== source.uniquePatches) {
  throw new Error(
    `Count mismatch: represented=${represented}/${source.patchRepresented}, review=${reviewRequired}/${source.uniquePatches}`
  );
}

const output = {
  schemaVersion: 1,
  source: {
    path: sourcePath,
    sha256: sourceSha256,
    canonicalEvidenceSha: source.canonicalSha,
    tipCount: source.tipCount,
  },
  summary: {
    total: rows.length,
    representedPatchEquivalent: represented,
    semanticReviewRequired: reviewRequired,
    deletionAuthorized: 0,
  },
  rows,
};

const md = `# Recovered tip disposition ledger

Generated mechanically from the protected patch-equivalence evidence.

- Source SHA-256: \`${sourceSha256}\`
- Canonical evidence SHA: \`${source.canonicalSha}\`
- Total recovered divergent tips: **${rows.length}**
- \`REPRESENTED_PATCH_EQUIVALENT\`: **${represented}**
- \`SEMANTIC_REVIEW_REQUIRED\`: **${reviewRequired}**
- Deletion authorized: **0**

\`REPRESENTED_PATCH_EQUIVALENT\` means every commit unique to the recovered tip
has an equivalent patch in the evidence canonical SHA. It does not delete the
recovery ref and does not claim runtime acceptance. \`SEMANTIC_REVIEW_REQUIRED\`
means the tip contains at least one patch not represented at the evidence SHA;
it remains preserved until it has a module owner, task ID and explicit verdict.

The exact 421-row machine ledger is
\`docs/cleanup/generated/recovered-tip-disposition.json\`.
`;

writeFileSync(jsonOutPath, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(markdownOutPath, md);

console.log(
  JSON.stringify({ total: rows.length, represented, reviewRequired, sourceSha256 }, null, 2)
);

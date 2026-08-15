#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const [reportDirArg, outputArg, candidateSha] = process.argv.slice(2);
if (!reportDirArg || !outputArg || !candidateSha) {
  throw new Error('usage: classify-consolidated-gate.mjs <report-dir> <output.json> <candidate-sha>');
}

const reportDir = resolve(reportDirArg);
const summary = JSON.parse(readFileSync(join(reportDir, 'summary.json'), 'utf8'));
const records = [];

const environmentPattern =
  /ECONNREFUSED|ENOTFOUND|ENOENT|Cannot find (?:module|package)|database .*unavailable|PostgreSQL|SQLITE|timeout|timed out|document is not defined|localStorage is not defined|fetch failed|socket hang up|missing dependency/i;
const securityPattern =
  /idor|cross-org|cross-tenant|tenant|auth(?:entication|orization)?|security|permission|role|secret|redact|persistence|autosave|reassign/i;
const legacyPattern =
  /(?:^|\/)(?:routes\/)?(?:ai|analytics|assessment|auth|conversations|decisions|documents|feedback|initiatives|legal|notifications|settings|superadmin-[^/]+|teams|users)\.test\.js$/;

for (let shard = 1; shard <= summary.shardCount; shard += 1) {
  const shardPath = join(reportDir, `shard-${String(shard).padStart(2, '0')}.json`);
  if (!existsSync(shardPath)) throw new Error(`missing shard report: ${shardPath}`);
  const report = JSON.parse(readFileSync(shardPath, 'utf8'));
  for (const fileResult of report.testResults ?? []) {
    if (fileResult.status === 'passed') continue;
    const file = fileResult.name.replace(`${resolve(reportDir, '../..')}/`, '');
    const assertions = fileResult.assertionResults ?? [];
    const failedAssertions = assertions.filter((item) => item.status === 'failed').length;
    const pendingAssertions = assertions.filter((item) =>
      ['pending', 'todo', 'skipped', 'disabled'].includes(item.status),
    ).length;
    const failureText = (fileResult.message ?? '') + '\n' + (fileResult.failureMessage ?? '');

    let category;
    let reason;
    if (failedAssertions === 0) {
      category = 'EXPECTED_PENDING';
      reason = 'No failed assertion; file is non-green only because tests are pending, todo, or skipped.';
    } else if (environmentPattern.test(failureText) || /dbOptimization|pptx-dependency-missing/.test(file)) {
      category = 'HARNESS_ENV';
      reason = 'Failure text or file contract depends on unavailable runtime, database, dependency, or process environment.';
    } else if (legacyPattern.test(file) || /\.test\.js$/.test(file)) {
      category = 'STALE_CONTRACT';
      reason = 'Legacy JavaScript route/integration contract requires current-router validation before product changes.';
    } else {
      category = 'PRODUCT_REGRESSION';
      reason = 'Current TypeScript contract failed without a recognized environment-only signature.';
    }

    const priority =
      category === 'PRODUCT_REGRESSION' ? (securityPattern.test(file) ? 'P0' : 'P1') : 'P2';
    records.push({
      file,
      category,
      priority,
      failedAssertions,
      pendingAssertions,
      reason,
    });
  }
}

records.sort((left, right) =>
  left.priority.localeCompare(right.priority) || left.category.localeCompare(right.category) || left.file.localeCompare(right.file),
);
const categories = Object.fromEntries(
  ['PRODUCT_REGRESSION', 'STALE_CONTRACT', 'HARNESS_ENV', 'EXPECTED_PENDING'].map((category) => [
    category,
    records.filter((record) => record.category === category).length,
  ]),
);
const priorities = Object.fromEntries(
  ['P0', 'P1', 'P2'].map((priority) => [priority, records.filter((record) => record.priority === priority).length]),
);
const agentAllowlists = {
  p0SecurityAndPersistence: records
    .filter((record) => record.priority === 'P0')
    .map((record) => record.file),
  p1ServerAndBackend: records
    .filter(
      (record) =>
        record.priority === 'P1' &&
        (record.file.startsWith('server/') || record.file.startsWith('tests/unit/backend/')),
    )
    .map((record) => record.file),
  p1MountedUi: records
    .filter(
      (record) =>
        record.priority === 'P1' &&
        /^(src\/|tests\/(?:components|frontend|views|hooks)\/)/.test(record.file),
    )
    .map((record) => record.file),
  p1Integration: records
    .filter(
      (record) => record.priority === 'P1' && record.file.startsWith('tests/integration/'),
    )
    .map((record) => record.file),
  p1OtherContracts: records
    .filter(
      (record) =>
        record.priority === 'P1' &&
        !record.file.startsWith('server/') &&
        !record.file.startsWith('tests/unit/backend/') &&
        !/^(src\/|tests\/(?:components|frontend|views|hooks)\/)/.test(record.file) &&
        !record.file.startsWith('tests/integration/'),
    )
    .map((record) => record.file),
  p2ContractAndEnvironment: records
    .filter((record) => record.priority === 'P2')
    .map((record) => record.file),
};
const output = {
  schemaVersion: 1,
  sourceGateSha: summary.gitSha,
  triageCandidateSha: candidateSha,
  generatedFrom: basename(reportDir),
  classificationPolicy: 'Deterministic first-pass allowlist; PRODUCT_REGRESSION items require owner reproduction on triageCandidateSha.',
  categories,
  priorities,
  currentTypechecks: {
    root: {
      status: 'FAIL',
      errors: 3,
      allowlist: [
        'src/components/AIChat/__tests__/TransformationCasesPanel.test.tsx',
        'src/components/AIChat/__tests__/TransformationQualityTrustSection.test.tsx',
        'src/components/MyWork/NotebookContent.tsx',
      ],
    },
    server: {
      status: 'FAIL',
      errors: 21,
      allowlist: ['server/src/routes/v8/partner.routes.ts'],
    },
  },
  agentAllowlists,
  records,
};
mkdirSync(dirname(resolve(outputArg)), { recursive: true });
writeFileSync(resolve(outputArg), `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ categories, priorities, records: records.length }));

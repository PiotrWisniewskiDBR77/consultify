#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const ids = (text, expression) => [...text.matchAll(expression)].map((match) => match[1]);
const unique = (items) => [...new Set(items)];
const master = read('docs/cleanup/POST_CLEANUP_COMPLETION_PLAN.md');
const moduleSection = master.split('## Detailed module task register — 74 tasks')[1]?.split('## Eight cross-program tasks')[0] ?? '';
const crossSection = master.split('## Eight cross-program tasks')[1]?.split('## Execution waves')[0] ?? '';
const authority = unique([
  ...ids(moduleSection, /- `([A-Z][A-Z0-9-]*-001)`/g),
  ...ids(crossSection, /\| `([A-Z][A-Z0-9-]*(?:-001|-T01))` \|/g),
]);

const allocations = [
  ['claude-a', 'docs/cleanup/agents/CLAUDE_LANE_A_15_TASKS_20260816.md'],
  ['claude-b', 'docs/cleanup/agents/CLAUDE_LANE_B_15_TASKS_20260816.md'],
  ['claude-c', 'docs/cleanup/agents/CLAUDE_LANE_C_15_TASKS_20260816.md'],
  ['codex', 'docs/cleanup/agents/CODEX_INTEGRATOR_RETAINED_37_TASKS_20260816.md'],
];
const owner = new Map();
for (const [lane, file] of allocations) {
  for (const taskId of ids(read(file), /^\d+\. `([A-Z][A-Z0-9-]*(?:-001|-T01))`/gm)) owner.set(taskId, lane);
}

const required = [
  'taskId', 'baselineSha', 'productSha', 'leaseSha256', 'changedPaths',
  'changedPathRationale', 'ownerTables', 'commands', 'denominators', 'fixtures',
  'negativeControls', 'browserArtifacts', 'rollback', 'verdict',
];
const acceptedVerdicts = new Set([
  'DONE_CURRENT_SHA',
  'PARTIAL',
  'FIX_REQUIRED',
  'BLOCKED_OWNER',
  'BLOCKED_HUMAN',
  'NOT_VERIFIED',
  'EVIDENCE_MISSING',
]);
const evidenceLaneDirectory = new Map([
  ['claude-a', 'a'],
  ['claude-b', 'b'],
  ['claude-c', 'c'],
  ['codex', 'codex'],
]);
const rows = [];
for (const taskId of authority) {
  const lane = owner.get(taskId);
  const evidenceDirectory = evidenceLaneDirectory.get(lane);
  const file = `docs/program/evidence/closure/${evidenceDirectory}/${taskId}/TASK_EVIDENCE.json`;
  if (!lane || !existsSync(path.join(root, file))) {
    rows.push({ taskId, lane: lane ?? 'UNASSIGNED', verdict: 'MISSING_EVIDENCE', issues: ['missing evidence file'] });
    continue;
  }
  let evidence;
  try {
    evidence = JSON.parse(read(file));
  } catch (error) {
    rows.push({ taskId, lane, verdict: 'INVALID_EVIDENCE', issues: [`invalid JSON: ${error.message}`] });
    continue;
  }
  const issues = required.filter((field) => !(field in evidence)).map((field) => `missing field ${field}`);
  if (evidence.taskId !== taskId) issues.push(`taskId mismatch ${evidence.taskId}`);
  if (!acceptedVerdicts.has(evidence.verdict)) issues.push(`invalid verdict ${evidence.verdict}`);
  if (evidence.productSha) {
    try {
      execFileSync('git', ['cat-file', '-e', `${evidence.productSha}^{commit}`], { cwd: root, stdio: 'ignore' });
    } catch {
      issues.push(`unknown productSha ${evidence.productSha}`);
    }
  }
  rows.push({ taskId, lane, verdict: evidence.verdict ?? 'INVALID_EVIDENCE', issues });
}

const counts = rows.reduce((acc, row) => {
  acc[row.verdict] = (acc[row.verdict] ?? 0) + 1;
  return acc;
}, {});
const invalid = rows.filter((row) => row.issues.length > 0);
const missingEvidence = rows.filter((row) => row.verdict === 'MISSING_EVIDENCE');
const invalidPresentEvidence = invalid.filter((row) => row.verdict !== 'MISSING_EVIDENCE');
const incomplete = rows.filter((row) => row.verdict !== 'DONE_CURRENT_SHA');
console.log(JSON.stringify({
  denominator: authority.length,
  counts,
  missingEvidence,
  invalidPresentEvidence,
  incomplete,
}, null, 2));

if (process.argv.includes('--require-complete') && (authority.length !== 82 || missingEvidence.length || invalidPresentEvidence.length || incomplete.length)) {
  process.exitCode = 1;
}

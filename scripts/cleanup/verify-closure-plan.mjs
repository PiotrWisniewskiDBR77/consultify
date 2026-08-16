#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const fail = (message) => {
  console.error(`closure-plan FAIL: ${message}`);
  process.exitCode = 1;
};
const ids = (text, expression) => [...text.matchAll(expression)].map((match) => match[1]);
const unique = (items) => [...new Set(items)];

const masterPath = 'docs/cleanup/POST_CLEANUP_COMPLETION_PLAN.md';
const master = read(masterPath);
const moduleSection = master.split('## Detailed module task register — 74 tasks')[1]?.split('## Eight cross-program tasks')[0] ?? '';
const crossSection = master.split('## Eight cross-program tasks')[1]?.split('## Execution waves')[0] ?? '';
const moduleIds = unique(ids(moduleSection, /- `([A-Z][A-Z0-9-]*-001)`/g));
const crossIds = unique(ids(crossSection, /\| `([A-Z][A-Z0-9-]*(?:-001|-T01))` \|/g));
if (moduleIds.length !== 74) fail(`expected 74 module IDs, found ${moduleIds.length}`);
if (crossIds.length !== 8) fail(`expected 8 cross-program IDs, found ${crossIds.length}`);
const authority = new Set([...moduleIds, ...crossIds]);
if (authority.size !== 82) fail(`expected 82 unique authority IDs, found ${authority.size}`);

const allocations = [
  ['A', 'docs/cleanup/agents/CLAUDE_LANE_A_15_TASKS_20260816.md', 15],
  ['B', 'docs/cleanup/agents/CLAUDE_LANE_B_15_TASKS_20260816.md', 15],
  ['C', 'docs/cleanup/agents/CLAUDE_LANE_C_15_TASKS_20260816.md', 15],
  ['CODEX', 'docs/cleanup/agents/CODEX_INTEGRATOR_RETAINED_37_TASKS_20260816.md', 37],
];
const assigned = [];
for (const [name, file, expected] of allocations) {
  const text = read(file);
  const taskIds = ids(text, /^\d+\. `([A-Z][A-Z0-9-]*(?:-001|-T01))`/gm);
  if (taskIds.length !== expected) fail(`${name}: expected ${expected} numbered tasks, found ${taskIds.length}`);
  for (const taskId of taskIds) {
    if (!authority.has(taskId)) fail(`${name}: ${taskId} is not in the 82-task authority`);
    if (!text.includes(`| \`${taskId}\` |`)) fail(`${name}: ${taskId} lacks an atomic execution matrix row`);
    assigned.push(taskId);
  }
}
const duplicateAssignments = unique(assigned.filter((id, index) => assigned.indexOf(id) !== index));
if (duplicateAssignments.length) fail(`duplicate task ownership: ${duplicateAssignments.join(', ')}`);
const missing = [...authority].filter((id) => !assigned.includes(id));
if (missing.length) fail(`unassigned authority tasks: ${missing.join(', ')}`);
if (assigned.length !== 82) fail(`expected 82 assigned tasks, found ${assigned.length}`);

const contract = read('docs/cleanup/agents/FOUR_BRANCH_EXECUTION_CONTRACT_20260816.md');
if (!contract.includes('A → C → B → Codex-owned Results/Finance')) fail('integration graph is not A → C → B → Codex Results/Finance');
const leaseFiles = [
  ['A', 'docs/cleanup/agents/generated/CLAUDE_LANE_A_PATH_LEASE.json'],
  ['B', 'docs/cleanup/agents/generated/CLAUDE_LANE_B_PATH_LEASE.json'],
  ['C', 'docs/cleanup/agents/generated/CLAUDE_LANE_C_PATH_LEASE.json'],
  ['CODEX', 'docs/cleanup/agents/generated/CODEX_INTEGRATOR_PATH_LEASE.json'],
];
for (const [lane, file] of leaseFiles) {
  const manifest = JSON.parse(read(file));
  const hash = createHash('sha256').update(`${manifest.files.join('\n')}\n`).digest('hex');
  if (hash !== manifest.sha256) fail(`lane ${lane}: path lease SHA mismatch`);
  if (!contract.includes(manifest.sha256)) fail(`lane ${lane}: lease SHA absent from contract`);
}
const manifests = leaseFiles.map(([, file]) => new Set(JSON.parse(read(file)).files));
for (let left = 0; left < manifests.length; left += 1) {
  for (let right = left + 1; right < manifests.length; right += 1) {
    const overlap = [...manifests[left]].filter((file) => manifests[right].has(file));
    if (overlap.length) fail(`lane path overlap ${left}/${right}: ${overlap.slice(0, 5).join(', ')}`);
  }
}

if (!process.exitCode) {
  console.log('closure-plan PASS: 74 module + 8 cross-program = 82 unique tasks');
  console.log('ownership PASS: A15 + B15 + C15 + Codex37; zero duplicates/missing');
  console.log('leases PASS: A/B/C/Codex SHA-valid and zero tracked-path overlap');
  console.log('graph PASS: A → C → B → Codex Results/Finance');
}

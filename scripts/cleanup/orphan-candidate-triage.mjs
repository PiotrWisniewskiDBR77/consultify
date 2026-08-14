#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const generatedDir = path.join(root, 'docs/cleanup/generated');
const reachability = JSON.parse(fs.readFileSync(path.join(generatedDir, 'source-reachability.json'), 'utf8'));
const moduleInventory = JSON.parse(fs.readFileSync(path.join(generatedDir, 'module-surface-inventory.json'), 'utf8'));
const manualDecisions = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'manual-candidate-decisions.json'), 'utf8'));
const absolute = (file) => path.join(root, file);
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(absolute(file))).digest('hex');

const moduleByFile = new Map();
for (const [module, card] of Object.entries(moduleInventory.cards)) {
  for (const files of Object.values(card.source)) for (const file of files) moduleByFile.set(file, module);
}

const allByHash = new Map();
for (const record of reachability.records) {
  const digest = hash(record.file);
  if (!allByHash.has(digest)) allByHash.set(digest, []);
  allByHash.get(digest).push(record);
}
const allFiles = new Set(reachability.records.map((record) => record.file));

function shadowCounterparts(file) {
  const stem = file.replace(/\.(tsx?|jsx?)$/, '');
  return ['.ts', '.tsx', '.js', '.jsx'].map((extension) => stem + extension)
    .filter((candidate) => candidate !== file && allFiles.has(candidate));
}

function classify(record) {
  const file = record.file;
  const text = fs.readFileSync(absolute(file), 'utf8');
  const duplicateGroup = allByHash.get(hash(file)) ?? [];
  const duplicateRuntime = duplicateGroup.filter((item) => item.file !== file && item.classification === 'RUNTIME_REACHABLE');
  const duplicateOther = duplicateGroup.filter((item) => item.file !== file && item.classification !== 'RUNTIME_REACHABLE');
  const counterparts = shadowCounterparts(file);
  const header = text.split('\n').slice(0, 80).join('\n');

  if (duplicateRuntime.length) return {
    triage: 'EXACT_DUPLICATE_OF_RUNTIME', priority: 'P1_DUPLICATE_REVIEW',
    evidence: duplicateRuntime.map((item) => item.file),
  };
  if (counterparts.length) return {
    triage: 'SOURCE_SHADOW_OR_VARIANT', priority: 'P1_DUPLICATE_REVIEW', evidence: counterparts,
  };
  if (duplicateOther.length) return {
    triage: 'EXACT_NONRUNTIME_DUPLICATE', priority: 'P1_DUPLICATE_REVIEW',
    evidence: duplicateOther.map((item) => item.file),
  };
  if (/\b(createRoot|ReactDOM\.render|\.listen\s*\(|new Worker\s*\()/.test(text)) return {
    triage: 'UNMOUNTED_ENTRYPOINT', priority: 'P0_RECOVERY_REVIEW', evidence: [],
  };
  if (/\b(@deprecated|DEAD\s*(?:—|:)|DO NOT USE|legacy only)\b/i.test(header)) return {
    triage: 'EXPLICIT_DEPRECATED_OR_DEAD', priority: 'P3_REMOVAL_REVIEW', evidence: [],
  };
  if (/\/index\.(tsx?|jsx?)$/.test(file)) return {
    triage: 'UNUSED_BARREL', priority: 'P2_STRUCTURE_REVIEW', evidence: [],
  };
  if (file.includes('/routes/')) return {
    triage: 'UNMOUNTED_ROUTE_CANDIDATE', priority: 'P0_RECOVERY_REVIEW', evidence: [],
  };
  if (file.endsWith('.tsx')) return {
    triage: 'UNMOUNTED_UI_CANDIDATE', priority: 'P0_RECOVERY_REVIEW', evidence: [],
  };
  if (/\/(services?|controllers?|workers?|jobs?|cron)\//.test(file)) return {
    triage: 'UNWIRED_RUNTIME_LOGIC_CANDIDATE', priority: 'P0_RECOVERY_REVIEW', evidence: [],
  };
  if (/\/(types?|schemas?|validators?|constants?)\//.test(file)) return {
    triage: 'UNUSED_CONTRACT_OR_VALIDATOR', priority: 'P2_STRUCTURE_REVIEW', evidence: [],
  };
  return { triage: 'UNIQUE_SOURCE_REVIEW', priority: 'P1_SEMANTIC_REVIEW', evidence: [] };
}

const candidates = reachability.records
  .filter((record) => record.classification === 'ORPHAN_CANDIDATE')
  .map((record) => ({
    file: record.file,
    module: moduleByFile.get(record.file) ?? 'cross-cutting-or-unclassified',
    deletionAuthorized: false,
    manualDecision: manualDecisions.decisions[record.file] ?? null,
    ...classify(record),
  }))
  .sort((a, b) => `${a.priority}:${a.module}:${a.file}`.localeCompare(`${b.priority}:${b.module}:${b.file}`));

const byTriage = {};
const byPriority = {};
const byModule = {};
const byManualDecision = {};
for (const candidate of candidates) {
  byTriage[candidate.triage] = (byTriage[candidate.triage] ?? 0) + 1;
  byPriority[candidate.priority] = (byPriority[candidate.priority] ?? 0) + 1;
  byModule[candidate.module] = (byModule[candidate.module] ?? 0) + 1;
  if (candidate.manualDecision) {
    byManualDecision[candidate.manualDecision.status] = (byManualDecision[candidate.manualDecision.status] ?? 0) + 1;
  }
}
for (const file of Object.keys(manualDecisions.decisions)) {
  if (!candidates.some((candidate) => candidate.file === file)) throw new Error(`manual decision is not an orphan candidate: ${file}`);
}
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceInventoryGitSha: reachability.gitSha,
  deletionAuthorized: false,
  warnings: [
    'No triage category authorizes deletion.',
    'Static non-reachability must still be checked against Git history, runtime registries and product intent.',
    'Exact duplicates may encode intentionally separate ownership and require a canonical-owner decision.',
  ],
  counts: { total: candidates.length, manualDecisions: Object.keys(manualDecisions.decisions).length, byManualDecision, byPriority, byTriage, byModule },
  candidates,
};
fs.writeFileSync(path.join(generatedDir, 'orphan-candidate-triage.json'), JSON.stringify(report, null, 2) + '\n');
const markdown = [
  '# Orphan candidate triage', '',
  `Generated from source inventory \`${reachability.gitSha}\` at ${report.generatedAt}.`, '',
  '> No item in this report is authorized for deletion.', '',
  '## Priority queue', '',
  ...Object.entries(byPriority).sort().map(([name, count]) => `- ${name}: ${count}`),
  '', '## Triage classes', '',
  ...Object.entries(byTriage).sort().map(([name, count]) => `- ${name}: ${count}`),
  '', '## Modules', '',
  ...Object.entries(byModule).sort().map(([name, count]) => `- ${name}: ${count}`),
  '', '## Manual decisions', '',
  ...Object.entries(byManualDecision).sort().map(([name, count]) => `- ${name}: ${count}`),
  '', 'The exact review queue and duplicate evidence are stored in `orphan-candidate-triage.json`.', '',
];
fs.writeFileSync(path.join(generatedDir, 'orphan-candidate-triage.md'), markdown.join('\n'));
console.log(JSON.stringify(report.counts, null, 2));

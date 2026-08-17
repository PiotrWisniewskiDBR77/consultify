#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestArgument = process.argv.find((value) => value.startsWith('--manifest='));
const manifestPath = manifestArgument
  ? manifestArgument.slice('--manifest='.length)
  : 'docs/program/evidence/closure/codex/UI-CANON-ALL-001/UI_MODULE_INVENTORY.json';
const absolute = (file) => path.resolve(root, file);
const readJson = (file) => JSON.parse(readFileSync(absolute(file), 'utf8'));
const fail = (message) => {
  throw new Error(`UI-CANON-ALL verification failed: ${message}`);
};
const commitExists = (sha) => {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const isAncestor = (sha) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
};
const sha256 = (file) =>
  createHash('sha256')
    .update(readFileSync(absolute(file)))
    .digest('hex');

if (!existsSync(absolute(manifestPath))) fail(`missing manifest ${manifestPath}`);
const manifest = readJson(manifestPath);
if (manifest.authorityTaskId !== 'UI-CANON-ALL-001') fail('authorityTaskId mismatch');
if (!commitExists(manifest.reconciliationSha) || !isAncestor(manifest.reconciliationSha)) {
  fail(`reconciliationSha is not current-lineage: ${manifest.reconciliationSha}`);
}

const modules = manifest.modules ?? [];
if (modules.length !== 16) fail(`expected 16 modules, found ${modules.length}`);
if (new Set(modules.map((entry) => entry.moduleId)).size !== 16) fail('duplicate moduleId');
const requiredStates = manifest.requiredStates ?? [];
if (requiredStates.length !== 8 || new Set(requiredStates).size !== 8) {
  fail('requiredStates must contain exactly eight unique DoD states');
}

const allowedCoverage = new Set(['covered', 'partial', 'open', 'historical', 'not_applicable']);
const frozenTasks = new Set();
const plan = readFileSync(absolute('docs/cleanup/POST_CLEANUP_COMPLETION_PLAN.md'), 'utf8');
for (const match of plan.matchAll(/`([A-Z][A-Z0-9-]+-UI-CANON-001)`/g)) frozenTasks.add(match[1]);
const auditEntries = modules.filter((entry) => entry.moduleId === 'AUD');
if (auditEntries.length !== 1) fail('exactly one Audits inventory is required');

let verifiedHashReferences = 0;
for (const entry of modules) {
  if (!Array.isArray(entry.routes) || entry.routes.length === 0)
    fail(`${entry.moduleId}: routes empty`);
  if (!Array.isArray(entry.surfaces) || entry.surfaces.length === 0)
    fail(`${entry.moduleId}: surfaces empty`);
  if (!Array.isArray(entry.openGaps) || entry.openGaps.length === 0)
    fail(`${entry.moduleId}: openGaps empty`);
  if (Object.keys(entry.stateCoverage ?? {}).length !== requiredStates.length)
    fail(`${entry.moduleId}: incomplete state checklist`);
  for (const state of requiredStates) {
    if (!allowedCoverage.has(entry.stateCoverage?.[state]))
      fail(`${entry.moduleId}: invalid or missing state ${state}`);
  }
  if (!existsSync(absolute(entry.g4ResultPath))) fail(`${entry.moduleId}: missing G4 result`);

  if (entry.moduleId === 'AUD') {
    if (
      entry.classification !== 'MISSING_FROZEN_MODULE_PACKET' ||
      entry.taskId !== null ||
      entry.evidencePath !== null
    ) {
      fail('Audits must remain MISSING_FROZEN_MODULE_PACKET with no synthetic authority evidence');
    }
    if (!entry.proposalPath || !existsSync(absolute(entry.proposalPath)))
      fail('Audits proposal must remain explicitly referenced');
    continue;
  }

  if (!entry.taskId || !frozenTasks.has(entry.taskId))
    fail(`${entry.moduleId}: task is not in frozen authority`);
  if (!entry.evidencePath || !existsSync(absolute(entry.evidencePath)))
    fail(`${entry.moduleId}: evidence missing`);
  const evidence = readJson(entry.evidencePath);
  if (evidence.taskId !== entry.taskId) fail(`${entry.moduleId}: evidence taskId mismatch`);
  if (!evidence.denominators || Object.keys(evidence.denominators).length === 0)
    fail(`${entry.moduleId}: evidence denominators missing`);
  if (!commitExists(evidence.productSha)) fail(`${entry.moduleId}: unknown productSha`);
  const reconciliationSha = evidence.reconciliationSha;
  if (!isAncestor(evidence.productSha)) {
    if (!reconciliationSha || !commitExists(reconciliationSha) || !isAncestor(reconciliationSha)) {
      fail(`${entry.moduleId}: product is not ancestor and has no explicit current reconciliation`);
    }
  }

  const g4References = (evidence.browserArtifacts ?? []).filter(
    (artifact) => artifact.resultPath && artifact.resultSha256
  );
  for (const artifact of g4References) {
    if (!existsSync(absolute(artifact.resultPath)))
      fail(`${entry.moduleId}: missing artifact ${artifact.resultPath}`);
    if (sha256(artifact.resultPath) !== artifact.resultSha256)
      fail(`${entry.moduleId}: artifact hash mismatch ${artifact.resultPath}`);
    verifiedHashReferences += 1;
  }
}

if (verifiedHashReferences < 15) {
  fail(`expected at least 15 verified module artifact hashes, found ${verifiedHashReferences}`);
}

const result = {
  taskId: manifest.authorityTaskId,
  modules: modules.length,
  frozenModulePackets: modules.filter((entry) => entry.taskId).length,
  missingFrozenModulePackets: modules
    .filter((entry) => entry.classification === 'MISSING_FROZEN_MODULE_PACKET')
    .map((entry) => entry.moduleId),
  technicalCurrentHumanOnly: modules.filter(
    (entry) => entry.classification === 'TECHNICAL_CURRENT_HUMAN_ONLY'
  ).length,
  technicalCurrentWithGaps: modules.filter(
    (entry) => entry.classification === 'TECHNICAL_CURRENT_WITH_GAPS'
  ).length,
  verifiedHashReferences,
  aggregateVerdictCeiling: 'PARTIAL',
};
console.log(JSON.stringify(result, null, 2));

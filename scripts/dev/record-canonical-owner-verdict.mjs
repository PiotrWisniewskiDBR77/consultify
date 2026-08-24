#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const acceptanceRoot = path.join(repoRoot, 'docs/program/waves/WAVE_03_ACCEPTANCE');
const bindingsPath = path.join(acceptanceRoot, 'canonical-16-module-bindings.json');
const verdictsPath = path.join(acceptanceRoot, 'canonical-16-module-owner-verdicts.json');
const allowedVerdicts = new Set(['ACCEPT', 'CHANGE', 'BLOCKED']);

function fail(message) {
  throw new Error(`[canonical owner verdict] BLOCKED: ${message}`);
}

function option(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? '' : String(process.argv[at + 1] || '').trim();
}

function atomicJsonWrite(target, value) {
  const temporary = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temporary, target);
}

const moduleId = option('--module');
const verdict = option('--verdict').toUpperCase();
const quoteFileArg = option('--quote-file');
const evidenceArg = option('--evidence');

if (!moduleId || !verdict || !quoteFileArg || !evidenceArg) {
  fail('required: --module ID --verdict ACCEPT|CHANGE|BLOCKED --quote-file PATH --evidence PATH[,PATH]');
}
if (!allowedVerdicts.has(verdict)) fail(`unsupported verdict ${verdict}`);

const quoteFile = path.resolve(repoRoot, quoteFileArg);
if (!quoteFile.startsWith(`${acceptanceRoot}${path.sep}`) || !fs.existsSync(quoteFile)) {
  fail('quote file must already exist inside WAVE_03_ACCEPTANCE');
}
const quote = fs.readFileSync(quoteFile, 'utf8').trim();
if (!quote) fail('verbatim owner quote is empty');
if (verdict !== 'ACCEPT' && quote.length < 12) {
  fail(`${verdict} requires an unambiguous owner statement`);
}

const evidence = evidenceArg.split(',').map((item) => item.trim()).filter(Boolean);
if (evidence.length === 0) fail('at least one evidence path is required');
for (const item of evidence) {
  const absolute = path.resolve(repoRoot, item);
  if (!absolute.startsWith(`${acceptanceRoot}${path.sep}`) || !fs.existsSync(absolute)) {
    fail(`evidence must already exist inside WAVE_03_ACCEPTANCE: ${item}`);
  }
}

const bindings = JSON.parse(fs.readFileSync(bindingsPath, 'utf8'));
const verdicts = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'));
const module = bindings.modules.find((entry) => entry.id === moduleId);
if (!module) fail(`unknown module ${moduleId}`);
if (verdicts.records.some((record) => record.module === moduleId)) {
  fail(`${moduleId}: verdict already exists; amendments require a separate reviewed change`);
}
if (module.ownerDecision !== 'PENDING') fail(`${moduleId}: binding is no longer pending`);

const record = {
  sequence: verdicts.records.length + 1,
  module: moduleId,
  verdict,
  quoteFile: path.relative(repoRoot, quoteFile),
  evidence,
  recordedAt: new Date().toISOString(),
};
verdicts.records.push(record);
module.ownerDecision = verdict;
module.ownerDecisionRecord = `canonical-16-module-owner-verdicts.json#${record.sequence}`;

const frozenCount = bindings.modules.filter((entry) => entry.ownerDecision !== 'PENDING').length;
const blockedCount = bindings.modules.filter((entry) => entry.ownerDecision === 'BLOCKED').length;
if (frozenCount === 16) {
  bindings.status = blockedCount === 0 ? 'OWNER_FROZEN' : 'OWNER_FREEZE_BLOCKED';
  verdicts.status = bindings.status;
} else {
  bindings.status = 'OWNER_FREEZE_PENDING';
  verdicts.status = 'OWNER_FREEZE_PENDING';
}

atomicJsonWrite(verdictsPath, verdicts);
atomicJsonWrite(bindingsPath, bindings);
console.log(
  JSON.stringify(
    {
      recorded: record,
      frozenCount,
      pendingCount: 16 - frozenCount,
      blockedCount,
      globalStatus: bindings.status,
      integrationBuildPermitted: frozenCount === 16 && blockedCount === 0,
    },
    null,
    2
  )
);

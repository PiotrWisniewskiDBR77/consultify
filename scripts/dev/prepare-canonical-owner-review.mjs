#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bindingPath = path.join(
  repoRoot,
  'docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-bindings.json'
);
const receiptDirectory = process.env.WAVE3_RECOVERY_MANIFEST_DIR || '/tmp';
const baseUrl = process.env.CANONICAL_OWNER_REVIEW_BASE_URL || 'http://127.0.0.1:4418';

const reviewOrder = Object.freeze([
  ['organization', '/organization', 'W3-ORGANIZATION-OWNER-v1'],
  ['interview', '/interview', 'W3-INTERVIEW-OWNER-v1'],
  ['tools', '/discovery-tools', 'W3-TOOLS-OWNER-v1'],
  ['assessment', '/assessment/overview?tab=library', 'W3-ASSESSMENT-OWNER-v1'],
  ['initiatives', '/initiatives', 'W3-INITIATIVES-OWNER-v1'],
  ['execution', '/execution', 'W3-EXECUTION-OWNER-v1'],
  ['my-work', '/my-work', 'W3-MY-WORK-OWNER-v1'],
  ['meetings', '/meeting', 'W3-MEETINGS-OWNER-v1'],
  ['results', '/results/kpi', 'W3-RESULTS-OWNER-v1'],
  ['finance', '/finance?tab=statements', 'W3-FINANCE-OWNER-v1'],
  ['materials', '/presentations?tab=all', 'W3-MATERIALS-OWNER-v1'],
  ['audits', '/audit-programs', 'W3-AUDITS-OWNER-v1'],
  ['chat', '/chat', 'W3-CHAT-OWNER-v1'],
  ['admin', '/admin', 'W3-ADMIN-OWNER-v1'],
  ['settings', '/settings', 'W3-SETTINGS-OWNER-v1'],
  ['partner', '/partner', 'W3-PARTNER-OWNER-v1'],
]);

const receiptOverrides = Object.freeze({
  materials: 'consultify-wave3-materials-owner-live-20260823.json',
});

function fail(message) {
  throw new Error(`[canonical owner review] BLOCKED: ${message}`);
}

function git(...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

const binding = JSON.parse(fs.readFileSync(bindingPath, 'utf8'));
if (binding.modules?.length !== 16) fail('binding denominator is not 16');
if (reviewOrder.length !== 16) fail('review denominator is not 16');

const byId = new Map(binding.modules.map((module) => [module.id, module]));
const databases = new Set();
const nonces = new Set();
const modules = reviewOrder.map(([id, entryPath, fixtureId], index) => {
  const selected = byId.get(id);
  if (!selected) fail(`${id}: binding is absent`);
  const receiptName =
    receiptOverrides[id] ?? `consultify-wave3-${id}-owner-recovered-20260823.json`;
  const receiptPath = path.join(receiptDirectory, receiptName);
  if (!fs.existsSync(receiptPath)) fail(`${id}: FINAL receipt is absent`);
  const stat = fs.lstatSync(receiptPath);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600) {
    fail(`${id}: receipt must be a regular non-symlink 0600 file`);
  }
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  if (
    receipt.fixtureId !== fixtureId ||
    receipt.ownershipState !== 'FINAL' ||
    receipt.marker?.fixtureId !== fixtureId ||
    receipt.marker?.ownershipNonce !== receipt.ownershipNonce ||
    !/^[a-f0-9]{64}$/.test(String(receipt.ownershipNonce || ''))
  ) {
    fail(`${id}: receipt identity contract is invalid`);
  }
  if (databases.has(receipt.databaseName)) fail(`${id}: duplicate isolated database`);
  if (nonces.has(receipt.ownershipNonce)) fail(`${id}: duplicate ownership nonce`);
  databases.add(receipt.databaseName);
  nonces.add(receipt.ownershipNonce);

  return {
    order: index + 1,
    id,
    entryPath,
    reviewUrl: new URL(entryPath, baseUrl).toString(),
    selectedComponent: selected.component,
    sourceStatus: selected.sourceStatus,
    ownerDecision: selected.ownerDecision,
    fixture: {
      fixtureId,
      receiptPath,
      databaseName: receipt.databaseName,
      ownershipState: receipt.ownershipState,
      receiptMode: '0600',
      authority: 'ISOLATED_MODULE_EVIDENCE_ONLY',
    },
  };
});

const dirtyFingerprint = git('status', '--porcelain=v1');
const output = {
  schema: 'CANONICAL-16-MODULE-OWNER-REVIEW-v1',
  generatedAt: new Date().toISOString(),
  candidate: {
    repository: repoRoot,
    branch: git('branch', '--show-current'),
    sha: git('rev-parse', 'HEAD'),
    clean: dirtyFingerprint.length === 0,
    dirtyPaths: dirtyFingerprint ? dirtyFingerprint.split('\n') : [],
  },
  status: 'DOCUMENT_FREEZE_FIRST',
  denominator: modules.length,
  ownerDecisionsCaptured: modules.filter((module) => module.ownerDecision !== 'PENDING').length,
  fixtureQualification: {
    finalReceipts: modules.length,
    uniqueIsolatedDatabases: databases.size,
    uniqueOwnershipNonces: nonces.size,
    databaseMergePerformed: false,
    databaseWritesPerformed: false,
  },
  safety: {
    protectedRuntime: 'http://127.0.0.1:3987',
    isolatedFixturesAreNotAnIntegratedApplication: true,
    productionWritesAuthorized: false,
    legacyDeletionAuthorized: false,
  },
  nextGate: 'CAPTURE_16_OWNER_VERDICTS_THEN_BUILD_ONE_DETERMINISTIC_INTEGRATION_FIXTURE',
  modules,
};

console.log(JSON.stringify(output, null, 2));

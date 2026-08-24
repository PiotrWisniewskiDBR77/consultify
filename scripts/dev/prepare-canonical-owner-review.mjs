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
const visualManifestPath = path.join(
  repoRoot,
  'docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-visual-candidates.json'
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

const reviewMetadata = Object.freeze({
  organization: ['Organization', '01_ORGANIZATION', 'Profile; Goals; Challenges; Strategy; Context governance'],
  interview: ['Interview', '02_INTERVIEW', 'Inbox; Sessions; Assigned; Templates; Insights; Initiatives'],
  tools: ['Tools', '03_TOOLS', 'Library; Processes/Sessions; Insights; Reports; Initiatives'],
  assessment: ['Assessment', '04_ASSESSMENT', 'Library; Processes; Insights; Reports; Initiatives'],
  initiatives: ['Initiatives', '05_INITIATIVES', 'Initiatives; Plan; Capacity'],
  execution: ['Execution', '06_EXECUTION', 'Realizations; Work; Resources; Steering; Reports'],
  'my-work': ['My Work / Agent', '07_MY_WORK_AGENT', 'Inbox/Triage; Tasks; Decisions; Ideas; Notebook; Agent activity'],
  meetings: ['Meetings', '08_MEETINGS', 'Meetings; Agenda/Templates; Minutes; Decisions/Actions'],
  results: ['Results', '09_RESULTS', 'KPI; OKR; ROI'],
  finance: ['Finance', '10_FINANCE', 'Statements; Analysis; Baseline; Prediction; Valuation'],
  materials: ['Materials', '11_MATERIALS', 'All; Documents; Presentations; Sheets; Template Library'],
  audits: ['Audits', '12_AUDITS', 'Library; Programs/Processes; Evidence; Findings; Reports; Initiatives'],
  chat: ['Chat', '13_CHAT', 'Conversations; Sourced context/Snapshots; Proposals; Decisions'],
  admin: ['Admin', '14_ADMIN', 'Overview; Users; Organizations; Access; AI/Models; Operations/Audit'],
  settings: ['Settings', '15_SETTINGS', 'Profile; Workspace; Notifications; Integrations; Security/Privacy'],
  partner: ['Partner', '16_PARTNER', 'Overview; Opportunities; Connections; Collaboration; Materials; Settings'],
});

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
const visualManifest = JSON.parse(fs.readFileSync(visualManifestPath, 'utf8'));
if (binding.modules?.length !== 16) fail('binding denominator is not 16');
if (reviewOrder.length !== 16) fail('review denominator is not 16');
if (visualManifest.modules?.length !== 16) fail('visual denominator is not 16');

const byId = new Map(binding.modules.map((module) => [module.id, module]));
const visualById = new Map(visualManifest.modules.map((module) => [module.id, module]));
const databases = new Set();
const nonces = new Set();
const modules = reviewOrder.map(([id, entryPath, fixtureId], index) => {
  const selected = byId.get(id);
  if (!selected) fail(`${id}: binding is absent`);
  const visual = visualById.get(id);
  if (!visual) fail(`${id}: visual candidate is absent`);
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

  const [name, registerDirectory, menu2] = reviewMetadata[id] || [];
  if (!name || !registerDirectory || !menu2) fail(`${id}: review metadata is absent`);
  const acceptanceRegister = path.join(
    repoRoot,
    'docs/program/waves/WAVE_03_ACCEPTANCE/modules',
    registerDirectory,
    'MODULE_ACCEPTANCE.md'
  );
  if (!fs.existsSync(acceptanceRegister)) fail(`${id}: module acceptance register is absent`);
  const registerSource = fs.readFileSync(acceptanceRegister, 'utf8');
  const gateMatches = [...registerSource.matchAll(/^\|\s*`?(G(?:0\d|1\d|20))`?\s*\|[^\n]*?\|\s*`?([^|`]+?)`?\s*\|/gm)];
  const gates = Object.fromEntries(gateMatches.map((match) => [match[1], match[2].trim()]));
  const expectedGates = Array.from({ length: 21 }, (_, gate) => `G${String(gate).padStart(2, '0')}`);
  if (gateMatches.length !== 21 || expectedGates.some((gate) => !gates[gate])) {
    fail(`${id}: acceptance register must expose exactly G00-G20`);
  }
  const gateSummary = Object.values(gates).reduce((summary, state) => {
    summary[state] = (summary[state] || 0) + 1;
    return summary;
  }, {});

  return {
    order: index + 1,
    id,
    name,
    entryPath,
    reviewUrl: new URL(entryPath, baseUrl).toString(),
    expectedMenu2: menu2,
    selectedComponent: selected.component,
    sourceStatus: selected.sourceStatus,
    ownerDecision: selected.ownerDecision,
    visual: {
      classification: visual.classification,
      path: visual.path,
      sha256: visual.sha256,
      limitation: visual.limitation,
      authority: 'OWNER_REVIEW_REFERENCE_NOT_CURRENT_RUNTIME_PROOF',
    },
    acceptance: {
      registerPath: path.relative(repoRoot, acceptanceRegister),
      gateDenominator: expectedGates.length,
      gateSummary,
      gates,
      authority: 'CURRENT_REGISTER_STATE_NOT_OWNER_ACCEPTANCE',
    },
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

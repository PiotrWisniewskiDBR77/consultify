#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const explicitPath = process.argv.find((arg) => arg.startsWith('--manifest='))?.split('=')[1];
const manifestPath = path.resolve(
  root,
  explicitPath ??
    'docs/ui-standards/01-shell-layout/artifact-studio/release-evidence.json',
);
const requireComplete = process.argv.includes('--require-complete');
const asJson = process.argv.includes('--json');
const errors = [];

const fail = (message) => errors.push(message);
const isSha = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const array = (value) => (Array.isArray(value) ? value : []);

if (!fs.existsSync(manifestPath)) {
  process.stderr.write(`Artifact Studio release evidence error: missing ${manifestPath}\n`);
  process.exit(2);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  process.stderr.write(
    `Artifact Studio release evidence error: invalid JSON: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(2);
}

if (manifest.schemaVersion !== 1) fail('schemaVersion must equal 1');
for (const field of ['baseSha', 'implementationSha', 'evidenceSha']) {
  if (!isSha(manifest.candidate?.[field])) fail(`candidate.${field} must be a 40-character SHA`);
}
if (!nonEmpty(manifest.candidate?.branch)) fail('candidate.branch is required');

const allowedStatuses = new Set(['evidence_missing', 'failed', 'verified', 'blocked']);
const requiredChecks = [
  'crossFormatTransfer',
  'screenReader',
  'teresaRealProvider',
  'stableWindows',
  'legacyRemoval',
];
for (const id of requiredChecks) {
  const check = manifest.checks?.[id];
  if (!check) fail(`missing check ${id}`);
  else if (!allowedStatuses.has(check.status)) fail(`${id}.status is invalid`);
}

const transfer = manifest.checks?.crossFormatTransfer;
if (transfer?.status === 'verified') {
  const participants = array(transfer.participants);
  const tasks = array(transfer.taskResults);
  if (participants.length < 3) fail('crossFormatTransfer requires at least 3 participants');
  if (tasks.length < 27) fail('crossFormatTransfer requires task-level results across 3 formats');
  if (!tasks.every((task) => nonEmpty(task.participantId) && nonEmpty(task.format) &&
      typeof task.unaided === 'boolean' && Number.isFinite(task.durationSeconds))) {
    fail('crossFormatTransfer task results require participantId, format, unaided and durationSeconds');
  }
  const later = tasks.filter((task) => Number(task.formatOrder) > 1);
  const unaidedRate = later.length ? later.filter((task) => task.unaided).length / later.length : 0;
  if (unaidedRate < 0.85) fail('crossFormatTransfer unaided completion is below 85 percent');
  if (Number(transfer.medianDiscoveryImprovementPercent) < 25) {
    fail('crossFormatTransfer median discovery improvement is below 25 percent');
  }
  if (Number(transfer.stateSeparationAccuracyPercent) < 90) {
    fail('crossFormatTransfer state separation accuracy is below 90 percent');
  }
  if (array(transfer.rawEvidence).length === 0) fail('crossFormatTransfer rawEvidence is required');
}

const screenReader = manifest.checks?.screenReader;
if (screenReader?.status === 'verified') {
  const runs = array(screenReader.runs);
  const formats = new Set(runs.map((run) => run.format));
  if (!['DOC', 'PPT', 'XLSX'].every((format) => formats.has(format))) {
    fail('screenReader requires manual runs for DOC, PPT and XLSX');
  }
  if (!runs.every((run) => nonEmpty(run.tester) && nonEmpty(run.reader) &&
      nonEmpty(run.readerVersion) && nonEmpty(run.osVersion) && run.keyboardPathPassed === true &&
      run.focusReturnPassed === true && ['save', 'error', 'qa', 'asyncJob'].every(
        (event) => run.announcements?.[event] === true,
      ))) {
    fail('screenReader runs require tester/device details, keyboard/focus PASS and all announcements');
  }
  if (array(screenReader.rawEvidence).length === 0) fail('screenReader rawEvidence is required');
}

const provider = manifest.checks?.teresaRealProvider;
if (provider?.status === 'verified') {
  const runs = array(provider.runs);
  const formats = new Set(runs.map((run) => run.format));
  if (!['DOC', 'PPT', 'XLSX'].every((format) => formats.has(format))) {
    fail('teresaRealProvider requires DOC, PPT and XLSX runs');
  }
  if (!runs.every((run) => nonEmpty(run.provider) && nonEmpty(run.model) &&
      nonEmpty(run.requestId) && isSha(run.sha) && nonEmpty(run.artifactId) &&
      nonEmpty(run.versionId) && nonEmpty(run.selection) && run.diffShown === true &&
      run.explicitDecision === true && run.auditRecorded === true && run.undoVerified === true)) {
    fail('teresaRealProvider runs require provider IDs, selection, diff, decision, audit and undo');
  }
  if (array(provider.rawEvidence).length === 0) fail('teresaRealProvider rawEvidence is required');
}

const windows = manifest.checks?.stableWindows;
if (windows?.status === 'verified') {
  const entries = array(windows.windows);
  if (entries.length < 2) fail('stableWindows requires at least two windows');
  if (!entries.every((entry) => isSha(entry.sha) && nonEmpty(entry.environment) &&
      nonEmpty(entry.startedAt) && nonEmpty(entry.endedAt) && entry.rollbackUsed === false &&
      Number.isFinite(entry.openSuccessRate) && Number.isFinite(entry.saveErrorRate) &&
      Number.isFinite(entry.exportSuccessRate) && Number.isFinite(entry.clientExceptionRate) &&
      entry.legacyRouteRequests === 0 && nonEmpty(entry.telemetryReport))) {
    fail('stableWindows entries require candidate SHA, interval, metrics, zero legacy use and no rollback');
  }
  if (array(windows.rawEvidence).length === 0) fail('stableWindows rawEvidence is required');
}

const legacy = manifest.checks?.legacyRemoval;
if (legacy?.status === 'verified') {
  for (const dependency of ['crossFormatTransfer', 'screenReader', 'teresaRealProvider', 'stableWindows']) {
    if (manifest.checks?.[dependency]?.status !== 'verified') {
      fail(`legacyRemoval cannot be verified while ${dependency} is not verified`);
    }
  }
  if (!isSha(legacy.removalSha) || !nonEmpty(legacy.changedFilesManifest) ||
      !nonEmpty(legacy.routeImportScan) || !nonEmpty(legacy.rollbackPlan) ||
      array(legacy.rawEvidence).length === 0) {
    fail('legacyRemoval requires removalSha, manifests, rollback plan and raw evidence');
  }
}

const allVerified = requiredChecks.every((id) => manifest.checks?.[id]?.status === 'verified');
if (manifest.terminalStatus === 'verified' && !allVerified) {
  fail('terminalStatus cannot be verified while a required check is incomplete');
}
if (allVerified && manifest.terminalStatus !== 'verified') {
  fail('terminalStatus must be verified when every required check is verified');
}

if (errors.length) {
  for (const error of errors) process.stderr.write(`Artifact Studio release evidence error: ${error}\n`);
  process.exit(2);
}

const status = Object.fromEntries(requiredChecks.map((id) => [id, manifest.checks[id].status]));
const result = {
  program: manifest.program,
  candidate: manifest.candidate,
  status,
  terminalStatus: manifest.terminalStatus,
  complete: allVerified && manifest.terminalStatus === 'verified',
};
process.stdout.write(`${asJson ? JSON.stringify(result, null, 2) : [
  `${manifest.program}`,
  ...requiredChecks.map((id) => `${id}: ${status[id]}`),
  `terminal: ${manifest.terminalStatus}`,
].join('\n')}\n`);

if (requireComplete && !result.complete) process.exit(1);

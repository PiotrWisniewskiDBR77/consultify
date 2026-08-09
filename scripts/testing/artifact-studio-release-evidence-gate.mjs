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
const formats = ['DOC', 'PPT', 'XLSX'];
const hasAllFormats = (runs) => {
  const present = new Set(runs.map((run) => run.format));
  return formats.every((format) => present.has(format));
};
const validIsoInterval = (startedAt, endedAt) => {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
};
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

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
      formats.includes(task.format) && [1, 2, 3].includes(Number(task.formatOrder)) &&
      typeof task.taskId === 'string' && task.taskId.length > 0 &&
      typeof task.unaided === 'boolean' && Number.isFinite(task.durationSeconds) &&
      task.durationSeconds >= 0 && Number.isFinite(task.wrongClicks) && task.wrongClicks >= 0 &&
      typeof task.stateSeparationTask === 'boolean' &&
      (!task.stateSeparationTask || typeof task.stateSeparationCorrect === 'boolean'))) {
    fail('crossFormatTransfer task results require taskId, participantId, valid format/order, unaided, durationSeconds, wrongClicks and state-separation fields');
  }
  const participantIds = new Set(participants.map((participant) => participant.id));
  if (participantIds.size !== participants.length || participantIds.has(undefined)) {
    fail('crossFormatTransfer participants require unique ids');
  }
  if (!tasks.every((task) => participantIds.has(task.participantId))) {
    fail('crossFormatTransfer task results must reference declared participants');
  }
  for (const participantId of participantIds) {
    const participantTasks = tasks.filter((task) => task.participantId === participantId);
    if (!hasAllFormats(participantTasks)) {
      fail(`crossFormatTransfer participant ${participantId} requires DOC, PPT and XLSX results`);
    }
  }
  const later = tasks.filter((task) => Number(task.formatOrder) > 1);
  const first = tasks.filter((task) => Number(task.formatOrder) === 1);
  const unaidedRate = later.length ? later.filter((task) => task.unaided).length / later.length : 0;
  if (unaidedRate < 0.85) fail('crossFormatTransfer unaided completion is below 85 percent');
  const firstMedian = first.length ? median(first.map((task) => task.durationSeconds)) : NaN;
  const laterMedian = later.length ? median(later.map((task) => task.durationSeconds)) : NaN;
  const computedImprovement = firstMedian > 0 ? ((firstMedian - laterMedian) / firstMedian) * 100 : NaN;
  if (!Number.isFinite(computedImprovement) || computedImprovement < 25) {
    fail('crossFormatTransfer median discovery improvement is below 25 percent');
  }
  if (Math.abs(Number(transfer.medianDiscoveryImprovementPercent) - computedImprovement) > 0.01) {
    fail('crossFormatTransfer declared median improvement does not match task results');
  }
  const separationTasks = tasks.filter((task) => task.stateSeparationTask);
  const computedSeparationAccuracy = separationTasks.length
    ? (separationTasks.filter((task) => task.stateSeparationCorrect).length / separationTasks.length) * 100
    : NaN;
  if (separationTasks.length < 9 || computedSeparationAccuracy < 90) {
    fail('crossFormatTransfer state separation accuracy is below 90 percent');
  }
  if (Math.abs(Number(transfer.stateSeparationAccuracyPercent) - computedSeparationAccuracy) > 0.01) {
    fail('crossFormatTransfer declared state separation accuracy does not match task results');
  }
  if (array(transfer.rawEvidence).length === 0) fail('crossFormatTransfer rawEvidence is required');
}

const screenReader = manifest.checks?.screenReader;
if (screenReader?.status === 'verified') {
  const runs = array(screenReader.runs);
  if (!hasAllFormats(runs)) {
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
  if (!hasAllFormats(runs)) {
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
      validIsoInterval(entry.startedAt, entry.endedAt) && entry.rollbackUsed === false &&
      Number.isFinite(entry.openSuccessRate) && Number.isFinite(entry.saveErrorRate) &&
      Number.isFinite(entry.exportSuccessRate) && Number.isFinite(entry.clientExceptionRate) &&
      entry.openSuccessRate >= 0.99 && entry.saveErrorRate <= 0.01 &&
      entry.exportSuccessRate >= 0.98 && entry.clientExceptionRate <= 0.005 &&
      entry.legacyRouteRequests === 0 && nonEmpty(entry.telemetryReport))) {
    fail('stableWindows entries require candidate SHA, interval, metrics, zero legacy use and no rollback');
  }
  if (new Set(entries.map((entry) => entry.sha)).size !== 1) {
    fail('stableWindows must use one candidate SHA');
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

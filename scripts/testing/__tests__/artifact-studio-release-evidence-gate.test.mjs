import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../../..');
const gate = path.join(root, 'scripts/testing/artifact-studio-release-evidence-gate.mjs');
const source = path.join(
  root,
  'docs/ui-standards/01-shell-layout/artifact-studio/release-evidence.json',
);

const run = (manifest, requireComplete = false) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-studio-evidence-'));
  const manifestPath = path.join(directory, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const result = spawnSync(
    process.execPath,
    [gate, `--manifest=${manifestPath}`, ...(requireComplete ? ['--require-complete'] : [])],
    { cwd: root, encoding: 'utf8' },
  );
  fs.rmSync(directory, { recursive: true, force: true });
  return result;
};

test('accepts the canonical incomplete manifest but fails the terminal gate', () => {
  const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
  assert.equal(run(manifest).status, 0);
  assert.equal(run(manifest, true).status, 1);
});

test('rejects a terminal verified claim while required evidence is incomplete', () => {
  const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
  manifest.terminalStatus = 'verified';
  const result = run(manifest);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /terminalStatus cannot be verified/);
});

test('rejects stable windows below the agreed telemetry thresholds', () => {
  const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
  manifest.checks.stableWindows = {
    status: 'verified',
    rawEvidence: ['telemetry.json'],
    windows: [1, 2].map((index) => ({
      sha: manifest.candidate.evidenceSha,
      environment: 'candidate',
      startedAt: `2026-08-0${index}T10:00:00Z`,
      endedAt: `2026-08-0${index}T12:00:00Z`,
      rollbackUsed: false,
      openSuccessRate: 0.5,
      saveErrorRate: 0,
      exportSuccessRate: 1,
      clientExceptionRate: 0,
      legacyRouteRequests: 0,
      telemetryReport: `window-${index}.json`,
    })),
  };
  const result = run(manifest);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /stableWindows entries require/);
});

test('rejects transfer results that do not cover all formats per participant', () => {
  const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
  const participants = [{ id: 'P1' }, { id: 'P2' }, { id: 'P3' }];
  manifest.checks.crossFormatTransfer = {
    status: 'verified',
    participants,
    taskResults: participants.flatMap(({ id }) => Array.from({ length: 9 }, (_, index) => ({
      taskId: `T${index + 1}`,
      participantId: id,
      format: 'DOC',
      formatOrder: 2,
      unaided: true,
      durationSeconds: 5,
      wrongClicks: 0,
    }))),
    medianDiscoveryImprovementPercent: 30,
    stateSeparationAccuracyPercent: 100,
    rawEvidence: ['transfer.csv'],
  };
  const result = run(manifest);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires DOC, PPT and XLSX results/);
});

test('the gate can be invoked directly by node', () => {
  const output = execFileSync(process.execPath, [gate, '--json'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /"complete": false/);
});

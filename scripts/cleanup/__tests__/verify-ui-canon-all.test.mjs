import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const verifier = path.join(root, 'scripts/cleanup/verify-ui-canon-all.mjs');
const manifestPath = path.join(
  root,
  'docs/program/evidence/closure/codex/UI-CANON-ALL-001/UI_MODULE_INVENTORY.json'
);

test('accepts the exact sixteen-module current evidence inventory', () => {
  const output = execFileSync(process.execPath, [verifier], { cwd: root, encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.modules, 16);
  assert.equal(result.frozenModulePackets, 16);
  assert.deepEqual(result.missingFrozenModulePackets, []);
  assert.equal(result.technicalCurrent, 16);
  assert.equal(result.technicalCurrentWithGaps, 0);
  assert.equal(result.aggregateVerdictCeiling, 'DONE_CURRENT_SHA_INTERNAL_BETA');
});

test('fails closed when a module is removed', () => {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'ui-canon-all-'));
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.modules.pop();
    const candidate = path.join(temporaryDirectory, 'fifteen.json');
    writeFileSync(candidate, JSON.stringify(manifest));
    const run = spawnSync(process.execPath, [verifier, `--manifest=${candidate}`], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /expected 16 modules/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('fails closed when Audits points at the historical non-authority proposal', () => {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'ui-canon-all-'));
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const audit = manifest.modules.find((entry) => entry.moduleId === 'AUD');
    audit.evidencePath = audit.proposalPath;
    const candidate = path.join(temporaryDirectory, 'synthetic-audit.json');
    writeFileSync(candidate, JSON.stringify(manifest));
    const run = spawnSync(process.execPath, [verifier, `--manifest=${candidate}`], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /evidence denominators missing|exact internal-beta owner authorization/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('fails closed when the exact Audit owner authorization is absent', () => {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'ui-canon-all-'));
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const audit = manifest.modules.find((entry) => entry.moduleId === 'AUD');
    const evidence = JSON.parse(readFileSync(path.join(root, audit.evidencePath), 'utf8'));
    delete evidence.internalBetaOwnerAuthorization;
    const evidencePath = path.join(temporaryDirectory, 'audit-without-authorization.json');
    writeFileSync(evidencePath, JSON.stringify(evidence));
    audit.evidencePath = evidencePath;
    const candidate = path.join(temporaryDirectory, 'unauthorized-audit.json');
    writeFileSync(candidate, JSON.stringify(manifest));
    const run = spawnSync(process.execPath, [verifier, `--manifest=${candidate}`], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /exact internal-beta owner authorization/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

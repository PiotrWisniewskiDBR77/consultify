#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const config = path.join(root, '.gitleaks.toml');
const mode = process.argv[2] ?? 'all';
assert.ok(['current', 'history', 'all'].includes(mode), 'mode must be current, history or all');
assert.ok(fs.existsSync(config), '.gitleaks.toml is required');

function run(args) {
  return spawnSync('gitleaks', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

if (run(['version']).status !== 0) {
  throw new Error('gitleaks is required (the pinned CI install is defined in security-scan.yml)');
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'consultify-secret-gate-'));
try {
  const canaryDir = path.join(temp, 'canary');
  fs.mkdirSync(canaryDir);
  fs.writeFileSync(
    path.join(canaryDir, 'canary.env'),
    'JWT_SECRET=Q7mN9vK2xP4rT6wY8zB3dF5hJ7lS9uC2eG4iK6mN8\n'
  );
  const canaryReport = path.join(temp, 'canary.json');
  const canary = run([
    'dir', '--config', config, '--redact', '--no-banner', '--log-level', 'error',
    '--report-format', 'json', '--report-path', canaryReport, '--exit-code', '7', canaryDir,
  ]);
  const canaryFindings = fs.existsSync(canaryReport)
    ? JSON.parse(fs.readFileSync(canaryReport, 'utf8'))
    : [];
  assert.equal(canary.status, 7, 'positive secret canary was not rejected');
  assert.equal(canaryFindings.length, 1, 'positive secret canary denominator drifted');
  assert.equal(canaryFindings[0].RuleID, 'consultify-env-secret-assignment');

  // Directory names must never suppress a real-format credential. These three
  // sentinels guard against broad test/docs/backup path allowlists returning.
  for (const relative of [
    'tests/security-negative.env',
    'docs/validation/security-negative.env',
    'server/src/_backup/security-negative.env',
  ]) {
    const negativeRoot = path.join(temp, `negative-${relative.split('/')[0]}`);
    const target = path.join(negativeRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'JWT_SECRET=R8nP4vK7xT2mW9zB6dF3hJ5lS1uC7eG4iK8mN2qY6\n');
    const report = path.join(temp, `${relative.replaceAll('/', '-')}.json`);
    const negative = run([
      'dir', '--config', config, '--redact', '--no-banner', '--log-level', 'error',
      '--report-format', 'json', '--report-path', report, '--exit-code', '7', negativeRoot,
    ]);
    const findings = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')) : [];
    assert.equal(negative.status, 7, `${relative} real-format negative fixture was not rejected`);
    assert.equal(findings.length, 1, `${relative} negative fixture denominator drifted`);
  }
  fs.rmSync(canaryDir, { recursive: true, force: true });
  process.stdout.write('SEC-PRIV-001 secret canaries PASS: positive 1/1 + path negatives 3/3 rejected\n');

  const scans = [];
  if (mode === 'current' || mode === 'all') {
    scans.push({
      name: 'current',
      args: [
        'dir', '--config', config, '--redact', '--no-banner', '--log-level', 'error',
        '--max-target-megabytes', '5', '--report-format', 'json',
        '--report-path', path.join(temp, 'current.json'), '--exit-code', '9', root,
      ],
      report: path.join(temp, 'current.json'),
    });
  }
  if (mode === 'history' || mode === 'all') {
    scans.push({
      name: 'history',
      args: [
        'git', '--config', config, '--redact', '--no-banner', '--log-level', 'error',
        '--report-format', 'json', '--report-path', path.join(temp, 'history.json'),
        '--exit-code', '9', '--log-opts=--all', root,
      ],
      report: path.join(temp, 'history.json'),
    });
  }

  for (const scan of scans) {
    const result = run(scan.args);
    const findings = fs.existsSync(scan.report)
      ? JSON.parse(fs.readFileSync(scan.report, 'utf8'))
      : [];
    if (result.status !== 0 || findings.length !== 0) {
      const summary = findings.slice(0, 20).map((finding) => ({
        rule: finding.RuleID,
        file: finding.File,
        line: finding.StartLine,
        commit: finding.Commit || undefined,
      }));
      process.stderr.write(`${scan.name} secret scan failed: ${findings.length} finding(s)\n`);
      process.stderr.write(`${JSON.stringify(summary, null, 2)}\n`);
      process.exit(1);
    }
    process.stdout.write(`SEC-PRIV-001 ${scan.name} secret scan PASS: 0 findings\n`);
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

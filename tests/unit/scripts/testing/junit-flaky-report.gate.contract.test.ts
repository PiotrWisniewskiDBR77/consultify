import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/junit-flaky-report.ts');
const fixtureWithSignal = path.resolve(repoRoot, 'tests/fixtures/junit-flaky/with-signal');
const fixtureNoSignal = path.resolve(repoRoot, 'tests/fixtures/junit-flaky/no-signal');
const outRoot = path.resolve(repoRoot, 'test-results/_gate-contract-junit-flaky');

function runJunitFlakyReport(dir: string, out: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('npx', ['tsx', scriptPath, '--dir', dir, '--out', out], {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error: any) {
    return {
      status: error?.status ?? 1,
      stdout: String(error?.stdout || ''),
      stderr: String(error?.stderr || ''),
    };
  }
}

describe('junit-flaky-report gate contract', () => {
  it('produces deterministic JSON/MD artifacts for flaky and clean fixtures', () => {
    const outWithSignal = path.join(outRoot, 'with-signal');
    const outNoSignal = path.join(outRoot, 'no-signal');
    fs.rmSync(outRoot, { recursive: true, force: true });

    const runWithSignal = runJunitFlakyReport(fixtureWithSignal, outWithSignal);
    const runNoSignal = runJunitFlakyReport(fixtureNoSignal, outNoSignal);
    expect(runWithSignal.status).toBe(0);
    expect(runNoSignal.status).toBe(0);

    const withSignalJsonPath = path.join(outWithSignal, 'flaky-report.json');
    const withSignalMdPath = path.join(outWithSignal, 'flaky-report.md');
    const noSignalJsonPath = path.join(outNoSignal, 'flaky-report.json');
    const noSignalMdPath = path.join(outNoSignal, 'flaky-report.md');

    [withSignalJsonPath, withSignalMdPath, noSignalJsonPath, noSignalMdPath].forEach((target) => {
      expect(fs.existsSync(target)).toBe(true);
    });

    const withSignal = JSON.parse(fs.readFileSync(withSignalJsonPath, 'utf-8')) as any;
    const noSignal = JSON.parse(fs.readFileSync(noSignalJsonPath, 'utf-8')) as any;

    for (const report of [withSignal, noSignal]) {
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('totals');
      expect(report).toHaveProperty('suites');
      expect(report).toHaveProperty('flaky');
      expect(Number.isNaN(Date.parse(report.generatedAt))).toBe(false);
    }

    expect(withSignal.totals.xmlFiles).toBe(1);
    expect(withSignal.totals.suites).toBe(1);
    expect(withSignal.totals.tests).toBe(2);
    expect(withSignal.totals.flaky).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(withSignal.flaky)).toBe(true);
    expect(withSignal.flaky.length).toBeGreaterThanOrEqual(1);
    expect(withSignal.flaky[0].reason).toBe('flaky-attr');

    expect(noSignal.totals.xmlFiles).toBe(1);
    expect(noSignal.totals.suites).toBe(1);
    expect(noSignal.totals.tests).toBe(1);
    expect(noSignal.totals.flaky).toBe(0);
    expect(Array.isArray(noSignal.flaky)).toBe(true);
    expect(noSignal.flaky).toHaveLength(0);

    const withSignalMd = fs.readFileSync(withSignalMdPath, 'utf-8');
    expect(withSignalMd).toContain('# JUnit Flaky Report');
    expect(withSignalMd).toContain('## Totals');
    expect(withSignalMd).toContain(`Generated: ${withSignal.generatedAt}`);
    expect(withSignalMd).toContain(`- Flaky signals: ${withSignal.totals.flaky}`);
  });
});

import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/skip-scan-gate.ts');
const jsonReportPath = path.resolve(repoRoot, 'test-results/skip-scan/skip-scan.report.json');
const mdReportPath = path.resolve(repoRoot, 'test-results/skip-scan/skip-scan.report.md');

function runSkipScanGate(): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('npx', ['tsx', scriptPath], {
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

describe('skip-scan gate contract', () => {
  it('executes successfully and writes coherent JSON/MD evidence reports', () => {
    const run = runSkipScanGate();
    const combinedOutput = `${run.stdout}\n${run.stderr}`;
    expect(run.status === 0 || run.status === 1).toBe(true);
    expect(combinedOutput).toContain('Skip/Only Gate');

    expect(fs.existsSync(jsonReportPath)).toBe(true);
    expect(fs.existsSync(mdReportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(jsonReportPath, 'utf-8')) as any;
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('roots');
    expect(report).toHaveProperty('totals');
    expect(report).toHaveProperty('breakdown');
    expect(report).toHaveProperty('findings');
    expect(report).toHaveProperty('gate');
    expect(report.roots).toEqual(['tests', 'e2e']);

    expect(report.totals.findings).toBe(report.totals.skip + report.totals.only);
    expect(report.totals.skip).toBe(
      report.breakdown.smoke.skip + report.breakdown.unit.skip + report.breakdown.other.skip
    );
    expect(report.totals.only).toBe(
      report.breakdown.smoke.only + report.breakdown.unit.only + report.breakdown.other.only
    );

    expect(report.gate.status === 'PASS' || report.gate.status === 'FAIL').toBe(true);
    expect(Array.isArray(report.gate.fatalReasons)).toBe(true);
    if (report.gate.status === 'PASS') {
      expect(report.gate.fatalReasons.length).toBe(0);
    } else {
      expect(report.gate.fatalReasons.length).toBeGreaterThan(0);
    }
    expect(report.gate.allowlist.path).toBe('scripts/testing/skip-allowlist.json');

    const md = fs.readFileSync(mdReportPath, 'utf-8');
    expect(md).toContain(`Gate status: **${report.gate.status}**`);
    expect(combinedOutput).toContain('test-results/skip-scan/skip-scan.report.json');
  });
});


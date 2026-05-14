import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/high-risk-scan.ts');
const jsonReportPath = path.resolve(repoRoot, 'test-results/high-risk-scan/high-risk-scan.json');
const mdReportPath = path.resolve(repoRoot, 'test-results/high-risk-scan/high-risk-scan.md');

function runHighRiskScan(): { status: number; stdout: string; stderr: string } {
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

describe('high-risk-scan gate contract', () => {
  it('runs and writes coherent JSON+MD evidence artifacts', () => {
    const run = runHighRiskScan();
    expect(run.status).toBe(0);

    expect(fs.existsSync(jsonReportPath)).toBe(true);
    expect(fs.existsSync(mdReportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(jsonReportPath, 'utf-8')) as any;
    expect(typeof report.baseRef).toBe('string');
    expect(typeof report.changedFiles).toBe('number');
    expect(Number.isFinite(report.changedFiles)).toBe(true);
    expect(report.changedFiles).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(report.highRiskFiles)).toBe(true);
    expect(typeof report.highRiskHit).toBe('boolean');
    expect(report.highRiskHit).toBe(report.highRiskFiles.length > 0);

    const md = fs.readFileSync(mdReportPath, 'utf-8');
    expect(md).toContain('# High-risk Scan');
    expect(md).toContain('Base ref:');
    expect(md).toContain('Changed files:');

    const changedLine = md.match(/Changed files:\s*(\d+)/);
    expect(changedLine).not.toBeNull();
    expect(Number(changedLine?.[1])).toBe(report.changedFiles);
  });
});

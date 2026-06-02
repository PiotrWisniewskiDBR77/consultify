import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/junit-retry-trend.ts');
const fixtureDir = path.resolve(repoRoot, 'tests/fixtures/junit-retry-trend');

function runTrend(dir: string, out: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('npx', ['tsx', scriptPath, '--dir', dir, '--out', out, '--top', '3'], {
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

describe('junit-retry-trend gate contract', () => {
  it('produces deterministic flaky-trend json and markdown artifacts', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jrt-gate-'));
    const result = runTrend(fixtureDir, outDir);
    expect(result.status).toBe(0);

    const jsonPath = path.join(outDir, 'flaky-trend.json');
    const mdPath = path.join(outDir, 'flaky-trend.md');
    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(mdPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as any;
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('xmlFiles');
    expect(report).toHaveProperty('totalHits');
    expect(report).toHaveProperty('top');
    expect(report.xmlFiles).toBe(1);
    expect(report.totalHits).toBe(1);
    expect(Array.isArray(report.top)).toBe(true);
    expect(report.top[0].testId).toBe('execution.retry.contract::handles transient failures');
    expect(report.top[0].reason).toBe('retry-attr');
    expect(Number.isNaN(Date.parse(report.generatedAt))).toBe(false);

    const markdown = fs.readFileSync(mdPath, 'utf-8');
    expect(markdown).toContain('# Flaky Trend (Per-Run)');
    expect(markdown).toContain('XML files: 1');
    expect(markdown).toContain('Total retry signals: 1');
    expect(markdown).toContain(
      '- execution.retry.contract::handles transient failures (count=1, reason=retry-attr)'
    );
    expect(markdown).toContain('Note: this is per-run only. 30-day trend requires CI history.');
  });
});


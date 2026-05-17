import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/quality-check.ts');
const jsonReportPath = path.resolve(repoRoot, 'test-results/quality-check/quality-check.report.json');
const mdReportPath = path.resolve(repoRoot, 'test-results/quality-check/quality-check.report.md');

function runQualityCheck(): { status: number; stdout: string; stderr: string } {
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

describe('quality-check gate contract', () => {
  it('executes successfully and produces coherent evidence report accounting', () => {
    const run = runQualityCheck();
    expect(run.status === 0 || run.status === 1).toBe(true);
    expect(`${run.stdout}\n${run.stderr}`).toContain('Test Quality Report');

    expect(fs.existsSync(jsonReportPath)).toBe(true);
    expect(fs.existsSync(mdReportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(jsonReportPath, 'utf-8')) as any;
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('scannedRoots');
    expect(report).toHaveProperty('totals');
    expect(report).toHaveProperty('ratios');
    expect(report).toHaveProperty('buckets');
    expect(report).toHaveProperty('root');
    expect(report.scannedRoots).toEqual(['tests/', 'e2e/']);

    const bucketKeys = Object.keys(report.buckets).sort();
    expect(bucketKeys).toEqual(
      [
        'REAL_CODE',
        'REAL_RUNTIME',
        'FAKE_UNIT',
        'PLACEHOLDER',
        'FAKE_INTEGRATION',
        'FAKE_INTEGRATION_RISK',
        'SPEC_FILE',
        'LOW_SIGNAL',
        'OTHER',
      ].sort()
    );

    const totalFromBuckets = Object.values(report.buckets).reduce(
      (sum: number, bucket: any) => sum + bucket.count,
      0
    );
    expect(report.totals.total).toBe(totalFromBuckets);
    expect(report.totals.real).toBe(
      report.buckets.REAL_CODE.count + report.buckets.REAL_RUNTIME.count
    );
    expect(report.totals.placeholder).toBe(
      report.buckets.PLACEHOLDER.count + report.buckets.FAKE_UNIT.count
    );
    expect(report.totals.other).toBe(
      report.buckets.OTHER.count +
        report.buckets.FAKE_INTEGRATION.count +
        report.buckets.FAKE_INTEGRATION_RISK.count +
        report.buckets.SPEC_FILE.count +
        report.buckets.LOW_SIGNAL.count
    );

    for (const metric of [
      report.ratios.authenticityScoredPct,
      report.ratios.authenticityOverallPct,
      report.ratios.placeholderShareScoredPct,
    ]) {
      expect(Number.isFinite(metric)).toBe(true);
      expect(metric).toBeGreaterThanOrEqual(0);
      expect(metric).toBeLessThanOrEqual(100);
    }

    const md = fs.readFileSync(mdReportPath, 'utf-8');
    expect(md).toContain('# Test Quality Report');
    expect(md).toContain(report.generatedAt);
  });
});


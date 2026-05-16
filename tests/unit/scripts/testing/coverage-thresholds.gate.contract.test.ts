import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/coverage-thresholds.ts');
const fixturesDir = path.resolve(repoRoot, 'tests/fixtures/coverage');

function runCoverageThresholds(args: string[]): {
  status: number;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = execFileSync('npx', ['tsx', scriptPath, ...args], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: repoRoot,
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

describe('coverage-thresholds gate contract', () => {
  it('returns usage contract when required arguments are missing', () => {
    const result = runCoverageThresholds([]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      'Usage: coverage-thresholds --report <path> --profile <l1|l2|l3>'
    );
  });

  it('returns missing report contract for non-existent report path', () => {
    const missingPath = path.resolve(fixturesDir, 'does-not-exist.vitest.json');
    const result = runCoverageThresholds(['--report', missingPath, '--profile', 'l1']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Missing report:');
  });

  it('returns report-shape contract when coverageMap is missing', () => {
    const missingCoverageMapPath = path.resolve(fixturesDir, 'missing-coverage-map.vitest.json');
    const result = runCoverageThresholds(['--report', missingCoverageMapPath, '--profile', 'l1']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Report does not contain coverageMap:');
  });

  it('passes when all L1 thresholds are satisfied', () => {
    const passPath = path.resolve(fixturesDir, 'l1-pass-minimal.vitest.json');
    const result = runCoverageThresholds(['--report', passPath, '--profile', 'l1']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Coverage thresholds OK.');
  });

  it('fails with deterministic line format when thresholds are below target', () => {
    const failPath = path.resolve(fixturesDir, 'l1-fail-under-threshold.vitest.json');
    const result = runCoverageThresholds(['--report', failPath, '--profile', 'l1']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Coverage thresholds failed:');
    expect(result.stderr).toMatch(
      /- .+: (statements|branches|functions|lines) \d+\.\d{2}% < \d+%/
    );
  });
});


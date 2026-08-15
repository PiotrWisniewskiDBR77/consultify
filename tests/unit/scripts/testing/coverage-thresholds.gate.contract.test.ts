import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/coverage-thresholds.ts');
let fixturesDir = '';

const l1Files = [
  'server/src/middleware/auth.middleware.ts',
  'server/src/middleware/csrf.middleware.ts',
  'server/src/middleware/permission.middleware.ts',
  'server/src/middleware/inputSanitization.middleware.ts',
  'server/src/middleware/rateLimitUserId.middleware.ts',
  'server/src/middleware/resourceQuota.middleware.ts',
  'server/src/services/accessPolicyService.ts',
  'server/src/utils/security.utils.ts',
];

function coverageMap(covered: boolean) {
  return Object.fromEntries(
    l1Files.map((file) => [path.resolve(repoRoot, file), {
      path: path.resolve(repoRoot, file),
      statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } } },
      fnMap: { '0': { name: 'f', decl: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } }, loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } }, line: 1 } },
      branchMap: { '0': { type: 'if', line: 1, locations: [{ start: { line: 1, column: 0 }, end: { line: 1, column: 1 } }, { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } }] } },
      s: { '0': covered ? 1 : 0 },
      f: { '0': covered ? 1 : 0 },
      b: { '0': covered ? [1, 1] : [0, 0] },
    }])
  );
}

beforeAll(() => {
  fixturesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-gate-contract-'));
  fs.writeFileSync(path.join(fixturesDir, 'missing-coverage-map.vitest.json'), '{}');
  fs.writeFileSync(path.join(fixturesDir, 'l1-pass-minimal.vitest.json'), JSON.stringify({ coverageMap: coverageMap(true) }));
  fs.writeFileSync(path.join(fixturesDir, 'l1-fail-under-threshold.vitest.json'), JSON.stringify({ coverageMap: coverageMap(false) }));
});

afterAll(() => fs.rmSync(fixturesDir, { recursive: true, force: true }));

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

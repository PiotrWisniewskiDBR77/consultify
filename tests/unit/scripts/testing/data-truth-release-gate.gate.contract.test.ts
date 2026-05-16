import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'server/scripts/data-truth-release-gate.ts');

const expectedCheckIds = [
  'no-hardcoded-db-url',
  'legacy-migrate-blocked',
  'critical-demo-fallbacks-gated',
  'task-scope-visible',
  'data-context-endpoint',
  'resolver-validates-final-selected-host',
  'demo-policy-defaults-not-real-tenant-branded',
  'nondefault-demo-org-requires-explicit-approval',
  'dangerous-finance-reimport-scripts-hardened',
  'no-unsafe-raw-db-env-in-scripts',
  'no-unsafe-manual-dotenv-in-scripts',
  'deploy-gate-checks-real-health-paths',
  'data-context-runtime-test-exists',
  'backup-restore-scripts-are-postgres-safe',
] as const;

function runDataTruthReleaseGate(): { status: number; stdout: string; stderr: string } {
  const outputPath = path.resolve(repoRoot, 'server/exports');
  fs.mkdirSync(outputPath, { recursive: true });

  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
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
  } finally {
    if (previousEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousEnv;
    }
  }
}

describe('data-truth-release-gate contract', () => {
  it('emits deterministic report with stable check inventory', () => {
    const run = runDataTruthReleaseGate();
    const output = `${run.stdout}\n${run.stderr}`;

    expect(run.status === 0 || run.status === 1).toBe(true);
    expect(output).toMatch(/Data truth release gate: (PASS|FAIL)/);
    expect(output).toContain('server/exports/data-truth-release-gate-');

    const reportMatch = output.match(/server\/exports\/data-truth-release-gate-[^\s]+\.md/);
    expect(reportMatch).not.toBeNull();

    const reportPath = path.resolve(repoRoot, reportMatch![0]);
    expect(fs.existsSync(reportPath)).toBe(true);

    const report = fs.readFileSync(reportPath, 'utf-8');
    expect(report).toContain('# Data Truth Release Gate');
    expect(report).toMatch(/- Result: `(PASS|FAIL)`/);

    for (const checkId of expectedCheckIds) {
      const escaped = checkId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const checkRegex = new RegExp(`- \\[[x ]\\] \`${escaped}\``, 'g');
      const matches = report.match(checkRegex) || [];
      expect(matches.length).toBe(1);
    }
  });
});

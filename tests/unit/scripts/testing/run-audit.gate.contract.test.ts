import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/run-audit.ts');

function runAudit(args: string[]): { status: number; stdout: string; stderr: string } {
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

describe('run-audit gate contract', () => {
  it('prints stable help contract and exits without executing audits', () => {
    const result = runAudit(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('npx tsx scripts/testing/run-audit.ts [options]');
    expect(result.stdout).toContain('--full, -f');
    expect(result.stdout).toContain('--quick, -q');
    expect(result.stdout).toContain('--report, -r');
    expect(result.stdout).toContain('--update-registry');
    expect(result.stdout).toContain('--dry-run');
    expect(result.stdout).toContain('--verbose, -v');
    expect(result.stdout).toContain('--help, -h');
    expect(result.stdout).not.toContain('AUDIT SUMMARY');
  });

  it('runs quick dry-run contract without scheduling integration/e2e levels', () => {
    const result = runAudit(['--quick', '--dry-run']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Quick (L1-L2)');
    expect(result.stdout).toContain('[DRY RUN] Would execute: npm run test:unit');
    expect(result.stdout).toContain('[DRY RUN] Would execute: npm run test:component');
    expect(result.stdout).not.toContain('[DRY RUN] Would execute: npm run test:integration');
    expect(result.stdout).toContain('L1 Unit');
    expect(result.stdout).toContain('L2 Component');
    expect(result.stdout).toContain('0 passed');
    expect(result.stdout).toContain('0 failed');
  });
});


import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/test-runner.ts');

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, '');
}

function runTestRunner(args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('npx', ['tsx', scriptPath, ...args], {
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

describe('test-runner gate contract', () => {
  it('prints stable help output without running test suite banner', () => {
    const result = runTestRunner(['--help']);
    const output = stripAnsi(`${result.stdout}\n${result.stderr}`);

    expect(result.status).toBe(0);
    expect(output).toContain('npx tsx scripts/testing/test-runner.ts [options]');
    expect(output).toContain('--all, -a');
    expect(output).toContain('--unit, -u');
    expect(output).toContain('--changed-only');
    expect(output).not.toContain('IRIS 6.0 Automated Test Suite');
  });
});

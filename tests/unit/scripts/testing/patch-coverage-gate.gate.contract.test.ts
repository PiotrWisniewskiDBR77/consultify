import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/patch-coverage-gate.ts');

function runPatchCoverageGate(
  args: string[]
): { status: number; stdout: string; stderr: string } {
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

describe('patch-coverage-gate contract', () => {
  it('fails closed with exit code 2 and usage text when coverage argument is missing', () => {
    const run = runPatchCoverageGate([]);
    const output = `${run.stdout}\n${run.stderr}`;

    expect(run.status).toBe(2);
    expect(output).toContain('Usage: patch-coverage-gate.ts --coverage-json <path>');
  });

  it('fails closed with exit code 2 and absolute missing coverage path evidence', () => {
    const missingPath = 'test-results/_gate-contract-patch-coverage/__missing_coverage__.json';
    const rootCommit = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    }).trim();
    const run = runPatchCoverageGate(['--coverage-json', missingPath, '--base', rootCommit]);
    const output = `${run.stdout}\n${run.stderr}`;
    const resolved = path.resolve(repoRoot, missingPath);

    expect(run.status).toBe(2);
    expect(output).toContain('Coverage file not found:');
    expect(output).toContain(resolved);
  });
});

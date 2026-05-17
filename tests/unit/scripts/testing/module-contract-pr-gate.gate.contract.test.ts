import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/module-contract-pr-gate.ts');

function runPrGateWithHeadBase(): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('npx', ['tsx', scriptPath, '--base', 'HEAD'], {
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

describe('module-contract-pr-gate contract', () => {
  it('passes deterministic no-runtime-change path for --base HEAD', () => {
    const run = runPrGateWithHeadBase();
    const output = `${run.stdout}\n${run.stderr}`;

    expect(run.status).toBe(0);
    expect(output).toContain('Module Contract PR Gate');
    expect(output).toContain('Base: HEAD');
    expect(output).toContain('No runtime changes detected; contract-runtime sync gate not required.');
    expect(output).not.toContain('❌ Ownership registry errors:');
    expect(output).not.toContain('❌ Module contract PR gate failed:');
  });
});

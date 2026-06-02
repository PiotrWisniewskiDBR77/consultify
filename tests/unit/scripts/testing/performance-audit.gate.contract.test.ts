import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/performance-audit.ts');

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, '');
}

function runPerformanceAudit(args: string[]): { status: number; stdout: string; stderr: string } {
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

describe('performance-audit gate contract', () => {
  it('prints stable help output without running metrics collection', () => {
    const result = runPerformanceAudit(['--help']);
    const output = stripAnsi(`${result.stdout}\n${result.stderr}`);

    expect(result.status).toBe(0);
    expect(output).toContain('npx tsx scripts/testing/performance-audit.ts [options]');
    expect(output).toContain('--baseline, -b');
    expect(output).toContain('--compare, -c');
    expect(output).toContain('--help, -h');
    expect(output).not.toContain('Collecting performance metrics');
    expect(output).not.toContain('📊 Collecting metrics');
  });
});

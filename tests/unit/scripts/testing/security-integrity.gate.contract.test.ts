import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/security/verify-security-integrity.ts');

function runSecurityIntegrity(): { status: number; stdout: string; stderr: string } {
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

describe('security-integrity gate contract', () => {
  it('executes and prints deterministic gate evidence contract', () => {
    const run = runSecurityIntegrity();
    const output = `${run.stdout}\n${run.stderr}`;

    expect(run.status === 0 || run.status === 1).toBe(true);
    expect(output).toContain('Security Integrity Verification');
    if (run.status === 0) {
      expect(output).toContain('✅ Security integrity check PASSED');
      expect(output).toContain('all 29 checks clean');
      expect(output).not.toContain('❌ Security integrity check FAILED');
    } else {
      expect(output).toContain('❌ Security integrity check FAILED');
      expect(output).toContain('issues');
    }
  });
});

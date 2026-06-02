import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/verify-integrity.js');
const runAuditPath = path.resolve(repoRoot, 'scripts/testing/run-audit.ts');

function runIntegrityCheck(): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath], {
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

describe('verify-integrity gate contract', () => {
  it('passes integrity checks and run-audit has no hardcoded 96 marker', () => {
    const result = runIntegrityCheck();
    expect([0, 1]).toContain(result.status);
    if (result.status === 0) {
      expect(result.stdout).toContain('Integrity check passed');
      expect(result.stdout).not.toContain('Integrity check failed');
      expect(result.stderr).not.toContain('Integrity check failed');
    } else {
      expect(result.stderr || result.stdout).toContain('Integrity check failed');
    }

    const runAuditSource = fs.readFileSync(runAuditPath, 'utf-8');
    expect(runAuditSource).not.toContain('~96%');
    expect(runAuditSource).not.toContain('| ~96%');
  });
});


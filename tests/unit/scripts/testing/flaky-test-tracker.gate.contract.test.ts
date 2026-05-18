import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/flaky-test-tracker.ts');
const fixturePath = path.resolve(
  repoRoot,
  'tests/fixtures/flaky-test-tracker/record-auto-quarantine.json'
);

function runTracker(
  args: string[],
  envOverrides?: Record<string, string>
): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('npx', ['tsx', scriptPath, ...args], {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...envOverrides },
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

describe('flaky-test-tracker gate contract', () => {
  it('prints stable help output contract', () => {
    const result = runTracker(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('USAGE');
    expect(result.stdout).toContain('--report');
    expect(result.stdout).toContain('--record=<file>');
    expect(result.stdout).toContain('70%');
    expect(result.stdout).toContain('50%');
  });

  it('records fixture and auto-quarantines unstable tests in isolated registry', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flaky-tracker-gate-'));
    const registryPath = path.join(outDir, 'registry.json');
    const result = runTracker(['--record=' + fixturePath], {
      FLAKY_TRACKER_REGISTRY_PATH: registryPath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Recorded 5 test results');
    const defaultRegistryPath = path.join(repoRoot, 'test-results', 'flaky-tests.json');
    const effectiveRegistryPath = fs.existsSync(registryPath) ? registryPath : defaultRegistryPath;
    expect(fs.existsSync(effectiveRegistryPath)).toBe(true);

    const registry = JSON.parse(fs.readFileSync(effectiveRegistryPath, 'utf-8')) as any;
    expect(registry.version).toBe('1.0.0');
    expect(Array.isArray(registry.tests)).toBe(true);
    expect(registry.tests.length).toBeGreaterThan(0);

    const quarantined = registry.tests.find(
      (entry: any) => entry.testName === 'should auto quarantine unstable test'
    );
    expect(quarantined).toBeTruthy();
    expect(quarantined.quarantined).toBe(true);
    expect(Number.isNaN(Date.parse(quarantined.quarantinedAt))).toBe(false);
  });
});


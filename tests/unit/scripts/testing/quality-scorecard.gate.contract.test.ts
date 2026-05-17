import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/quality-scorecard.ts');
const outputRelativePath = 'test-results/_gate-contract-quality-scorecard/quality-scorecard.json';
const outputPath = path.resolve(repoRoot, outputRelativePath);
const sourcePath = path.resolve(repoRoot, 'scripts/testing/quality-scorecard.ts');

function runQualityScorecard(): { status: number; stdout: string; stderr: string } {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  try {
    const stdout = execFileSync('npx', ['tsx', scriptPath, '--json', '--output', outputRelativePath], {
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

function resolveExpectedModulesCount(): number {
  const source = fs.readFileSync(sourcePath, 'utf-8');
  const match = source.match(/const MODULES:\s*ModuleDefinition\[\]\s*=\s*\[([\s\S]*?)\n\];/);
  if (!match) return 0;
  const body = match[1] || '';
  const names = body.match(/name:\s*'[^']+'/g);
  return names ? names.length : 0;
}

describe('quality-scorecard gate contract', () => {
  it('emits deterministic JSON artifact with schema and accounting invariants', () => {
    const run = runQualityScorecard();
    const output = `${run.stdout}\n${run.stderr}`;
    const expectedModulesCount = resolveExpectedModulesCount();

    expect(run.status).toBe(0);
    expect(output).toContain('JSON scorecard saved to:');
    expect(output).toContain(outputRelativePath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as any[];
    expect(Array.isArray(report)).toBe(true);
    expect(expectedModulesCount).toBeGreaterThan(0);
    expect(report.length).toBe(expectedModulesCount);

    for (const row of report) {
      expect(typeof row.module).toBe('string');
      expect(['critical', 'high', 'medium', 'low']).toContain(row.riskLevel);
      expect(typeof row.coverageGate).toBe('boolean');
      expect(typeof row.hasNegativeTests).toBe('boolean');
      expect(typeof row.score).toBe('number');
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(row.grade);

      expect(typeof row.testFiles).toBe('object');
      expect(typeof row.testFiles.unit).toBe('number');
      expect(typeof row.testFiles.component).toBe('number');
      expect(typeof row.testFiles.integration).toBe('number');
      expect(typeof row.testFiles.e2e).toBe('number');
      expect(typeof row.testFiles.security).toBe('number');
      expect(typeof row.testFiles.total).toBe('number');

      expect(row.testFiles.unit).toBeGreaterThanOrEqual(0);
      expect(row.testFiles.component).toBeGreaterThanOrEqual(0);
      expect(row.testFiles.integration).toBeGreaterThanOrEqual(0);
      expect(row.testFiles.e2e).toBeGreaterThanOrEqual(0);
      expect(row.testFiles.security).toBeGreaterThanOrEqual(0);
      expect(row.testFiles.total).toBeGreaterThanOrEqual(0);

      expect(row.testFiles.total).toBe(
        row.testFiles.unit +
          row.testFiles.component +
          row.testFiles.integration +
          row.testFiles.e2e +
          row.testFiles.security
      );
    }
  });
});

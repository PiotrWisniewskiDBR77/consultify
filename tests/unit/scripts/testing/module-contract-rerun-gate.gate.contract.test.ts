import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const scriptPath = path.resolve(repoRoot, 'scripts/testing/module-contract-rerun-gate.ts');
const jsonReportPath = path.resolve(
  repoRoot,
  'test-results/module-contract-gate/module-contract-gate.json'
);
const mdReportPath = path.resolve(repoRoot, 'test-results/module-contract-gate/module-contract-gate.md');

function runModuleContractRerunGate(): { status: number; stdout: string; stderr: string } {
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

describe('module-contract-rerun gate contract', () => {
  it('emits coherent JSON/MD evidence with stable result derivation', () => {
    const run = runModuleContractRerunGate();
    const output = `${run.stdout}\n${run.stderr}`;
    expect(run.status === 0 || run.status === 1).toBe(true);
    expect(output).toContain('Checked modules:');
    expect(output).toContain('Report: test-results/module-contract-gate/module-contract-gate.md');

    expect(fs.existsSync(jsonReportPath)).toBe(true);
    expect(fs.existsSync(mdReportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(jsonReportPath, 'utf-8')) as any;
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('checkedModules');
    expect(report).toHaveProperty('checkedFunctions');
    expect(report).toHaveProperty('errorCount');
    expect(report).toHaveProperty('warningCount');
    expect(report).toHaveProperty('errors');
    expect(report).toHaveProperty('warnings');
    expect(report).toHaveProperty('result');
    expect(Number.isNaN(Date.parse(report.generatedAt))).toBe(false);

    expect(report.checkedModules).toBe(19);
    expect(report.checkedFunctions).toBeGreaterThan(0);
    expect(report.errorCount).toBe(report.errors.length);
    expect(report.warningCount).toBe(report.warnings.length);

    const expectedResult =
      report.errorCount > 0 ? 'FAIL' : report.warningCount > 0 ? 'PASS_WITH_WARNINGS' : 'PASS';
    expect(report.result).toBe(expectedResult);

    const md = fs.readFileSync(mdReportPath, 'utf-8');
    expect(md).toContain('# Module Contract Rerun Gate');
    if (report.result === 'FAIL') {
      expect(md).toContain('**FAIL**');
    } else if (report.result === 'PASS_WITH_WARNINGS') {
      expect(md).toContain('**PASS_WITH_WARNINGS**');
    } else {
      expect(md).toContain('**PASS**');
    }
  });
});

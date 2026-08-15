import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const counterparts = [
  'tests/e2e/uspojnienie/f1-initiative-funnel.spec.ts',
  'tests/e2e/uspojnienie/f2-stage-handoffs.spec.ts',
  'tests/e2e/uspojnienie/f3-quality-gates.spec.ts',
  'tests/e2e/uspojnienie/f4-fe-state.spec.ts',
  'tests/e2e/uspojnienie/f5-observability.spec.ts',
  'tests/e2e/m14-execution-cockpit.spec.ts',
  'tests/e2e/m15-results-cockpit.spec.ts',
  'tests/e2e/m15/m15-results-panels.spec.ts',
  'tests/e2e/m16/_m16.ts',
  'tests/e2e/decision-management.spec.ts',
  'tests/e2e/projects.spec.ts',
] as const;

const read = (relativePath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('CLEAN-002-QA-005 E2E test-support tenant isolation', () => {
  it('covers the exact 11 current E2E counterparts', () => {
    expect(counterparts).toHaveLength(11);
    counterparts.forEach((relativePath) => expect(fs.existsSync(relativePath), relativePath).toBe(true));
  });

  it('routes every counterpart through the shared test-support tenant fixture', () => {
    counterparts.forEach((relativePath) => {
      const source = read(relativePath);
      expect(
        source.includes('readTestSupportState') || source.includes('seedE2EAuthWithBootstrap'),
        `${relativePath} must consume the shared test-support tenant state`
      ).toBe(true);
    });
  });

  it('contains no executable fallback to the former real account or login endpoint', () => {
    const forbiddenExecutablePatterns = [
      /email\s*:\s*['"]piotr\.wisniewski@dbr77\.com['"]/,
      /password\s*:\s*['"]123456['"]/,
      /\.fill\(\s*['"]piotr\.wisniewski@dbr77\.com['"]\s*\)/,
      /\.fill\(\s*['"]123456['"]\s*\)/,
      /request\.post\([^\n]*\/api\/auth\/login/,
      /VITE_API_TARGET\s*=\s*https:\/\/demo\.consultify\.ai/,
    ];

    counterparts.forEach((relativePath) => {
      const executableSource = read(relativePath)
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
        .join('\n');

      forbiddenExecutablePatterns.forEach((pattern) => {
        expect(executableSource, `${relativePath} matches ${pattern}`).not.toMatch(pattern);
      });
    });
  });

  it('keeps the canonical shared state reader fail-closed', () => {
    const fixture = read('tests/e2e/_helpers/testSupportState.ts');
    expect(fixture).toContain('E2E_TEST_SUPPORT_STATE_PATH');
    expect(fixture).toContain("fs.readFileSync(TEST_SUPPORT_STATE_PATH, 'utf8')");
    expect(fixture).toContain('if (!parsed?.token || !parsed?.runId)');
    expect(fixture).not.toContain('demo.consultify.ai');
  });
});

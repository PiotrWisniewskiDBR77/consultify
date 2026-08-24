/** @vitest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/Execution/ExecutionHub.tsx'),
  'utf8'
);

describe('Execution canonical data-source contract', () => {
  it('admits review rows only through the explicit demo-data toggle', () => {
    expect(source).toContain('const allowDemoData = shouldAllowDemoData();');
    expect(source).toContain('const reviewInitiatives = allowDemoData');
    expect(source).not.toMatch(/const reviewInitiatives = import\.meta\.env\.DEV/);
  });

  it('fails closed instead of replacing a failed canonical read with DEV fixtures', () => {
    expect(source).toContain('const fallbackInitiatives = allowDemoData');
    expect(source).toContain(': [];');
    expect(source).not.toMatch(/const fallbackInitiatives = import\.meta\.env\.DEV/);
  });

  it('uses the canonical execution-case spine to admit initiatives into Execution', () => {
    expect(source).toContain('listExecutionCases()');
    expect(source).toContain("String(executionCase.state || '').toUpperCase() === 'ACTIVE'");
    expect(source).toContain('activeExecutionInitiativeIds.has(String(initiative.id))');
    expect(source).toContain('status: InitiativeStatus.EXECUTING');
  });

  it('opens the canonical Initiative before resolving the list-tab default', () => {
    const openBranch = source.indexOf("if (openId && (mode === 'doc' || mode === 'initiative'))");
    const tabBranch = source.indexOf(
      "if (['list', 'work', 'resources', 'control', 'reports'].includes(targetTab))"
    );

    expect(openBranch).toBeGreaterThan(-1);
    expect(tabBranch).toBeGreaterThan(openBranch);
    expect(source).toContain('setActiveDocumentId(openId);');
  });
});

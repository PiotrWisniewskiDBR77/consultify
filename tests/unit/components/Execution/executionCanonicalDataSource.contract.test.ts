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
    // DEC-120/A10: fallback substitution is now gated by an explicit
    // `if (allowDemoData)` branch (not a ternary) so the failure can also
    // set the visible demoFallbackActive banner instead of silently
    // clearing the error. The non-demo path still fails closed to [].
    expect(source).toContain('const fallbackInitiatives = executionDemoData.initiatives');
    expect(source).toContain('setInitiatives([]);');
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

  it('renders an opened canonical Initiative before the list catalog', () => {
    const renderContent = source.indexOf('const renderContent = () => {');
    const documentBranch = source.indexOf('if (activeDocumentId) {', renderContent);
    const listBranch = source.indexOf("if (activeTab === 'list') {", renderContent);

    expect(renderContent).toBeGreaterThan(-1);
    expect(documentBranch).toBeGreaterThan(renderContent);
    expect(listBranch).toBeGreaterThan(documentBranch);
  });

  it('keeps the Control register free of the retired delivery-closure panel', () => {
    expect(source).not.toContain("import { ExecutionDeliveryClosurePanel }");
    expect(source).not.toContain('<ExecutionDeliveryClosurePanel');
  });

  it('renders the executing lifecycle label in Polish when the locale is Polish', () => {
    expect(source).toContain("isPolish && row.status === InitiativeStatus.EXECUTING");
    expect(source).toContain("? 'W realizacji'");
  });
});

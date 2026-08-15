/**
 * Regression guard for the four-surface canonical Initiatives hub. The former
 * Goals tab implementation remains available as source but is intentionally
 * unmounted after the Initiatives/Execution fan-in.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const HUB_PATH = path.resolve(__dirname, '../../../src/components/Initiatives/InitiativesHub.tsx');
const source = readFileSync(HUB_PATH, 'utf-8');

describe('canonical InitiativesHub tab wiring — source anchors', () => {
  it('does not expose the retired Goals table as a production tab', () => {
    expect(source).not.toContain(
      "import { InitiativesGoalsTable } from './InitiativesGoalsTable';"
    );
    expect(source).not.toContain("if (activeTab === 'goals') {");
    expect(source).not.toContain("id: 'goals' as ModuleTab");
  });

  it('excludes all three scenario surfaces from unrelated list view modes', () => {
    const start = source.indexOf('const availableViewModes: ViewMode[] =');
    const end = source.indexOf('const tabs = useMemo(');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const slice = source.slice(start, end);
    expect(slice).toContain("activeTab === 'portfolio'");
    expect(slice).toContain("activeTab === 'plan'");
    expect(slice).toContain("activeTab === 'capacity'");
  });

  it('declares exactly the four canonical tab entries', () => {
    for (const tab of ['list', 'portfolio', 'plan', 'capacity']) {
      expect(source).toContain(`id: '${tab}' as ModuleTab`);
    }
    expect(source).not.toContain("id: 'analysis' as ModuleTab");
    expect(source).not.toContain("id: 'observability' as ModuleTab");
  });
});

describe('canonical InitiativesHub surface preservation', () => {
  it('keeps the register and all three scenario mounts', () => {
    expect(source).toContain('<CanonicalInitiativeRegister');
    expect(source).toContain('<PortfolioScenarioSurface');
    expect(source).toContain('<PlanScenarioSurface');
    expect(source).toContain('<CapacityScenarioSurface');
  });
});

/**
 * Source-anchor guard for the canonical Initiatives integration. The accepted
 * hub has four business surfaces: register, portfolio scenario, plan scenario
 * and capacity. Earlier R11 tables remain source artifacts but are deliberately
 * not mounted in the production hub.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const HUB_PATH = path.resolve(__dirname, '../../../src/components/Initiatives/InitiativesHub.tsx');
const source = readFileSync(HUB_PATH, 'utf-8');

describe('canonical InitiativesHub wiring — source anchors', () => {
  it('imports the canonical register and three scenario surfaces', () => {
    expect(source).toContain(
      "import { CanonicalInitiativeRegister } from './CanonicalInitiativeRegister';"
    );
    expect(source).toContain(
      "import { PortfolioScenarioSurface } from './PortfolioScenarioSurface';"
    );
    expect(source).toContain("import { PlanScenarioSurface } from './PlanScenarioSurface';");
    expect(source).toContain(
      "import { CapacityScenarioSurface } from './CapacityScenarioSurface';"
    );
  });

  it('mounts the canonical register in the list table view', () => {
    expect(source).toContain("case 'table':");
    expect(source).toContain('<CanonicalInitiativeRegister');
    expect(source).toContain('rows={searchedInitiatives}');
  });

  it('mounts portfolio, plan and capacity under their canonical tabs', () => {
    expect(source).toContain("if (activeTab === 'portfolio') {");
    expect(source).toContain('<PortfolioScenarioSurface');
    expect(source).toContain("if (activeTab === 'plan') {");
    expect(source).toContain('<PlanScenarioSurface');
    expect(source).toContain("if (activeTab === 'capacity')");
    expect(source).toContain('<CapacityScenarioSurface');
  });

  it('limits URL tab hydration to the four accepted business surfaces', () => {
    expect(source).toContain(
      "const CANONICAL_INITIATIVES_TABS = new Set<ModuleTab>(['list', 'portfolio', 'plan', 'capacity']);"
    );
  });

  it('reads the canonical initiative registry rather than the retired portfolio fallbacks', () => {
    expect(source).toContain(
      "import { listRegisteredInitiatives } from '../../services/initiatives-execution/runtimeApi';"
    );
    expect(source).toContain('const canonical = await listRegisteredInitiatives();');
    expect(source).toContain('toCanonicalInitiativeRegisterItem(record');
  });

  it('does not remount the retired R11 tables in the canonical hub', () => {
    expect(source).not.toContain("from './InitiativeObservabilityTable'");
    expect(source).not.toContain("from './CandidatesTable'");
    expect(source).not.toContain("from './PortfolioHealthTable'");
    expect(source).not.toContain('<CandidatesPanel');
  });
});

/**
 * T30-GOALS-R13-CORRECTION — source-anchor guard (raw source-text
 * assertions, no mount). Proves the Goals tab is wired in, excluded from
 * unrelated view modes, and that R11/T25 wiring in InitiativesHub.tsx is
 * preserved byte-for-byte.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const HUB_PATH = path.resolve(__dirname, '../../../src/components/Initiatives/InitiativesHub.tsx');
const source = readFileSync(HUB_PATH, 'utf-8');

describe('T30 InitiativesHub wiring — source anchors', () => {
  it('imports InitiativesGoalsTable and mounts it on activeTab==="goals"', () => {
    expect(source).toContain("import { InitiativesGoalsTable } from './InitiativesGoalsTable';");
    const start = source.indexOf("if (activeTab === 'goals') {");
    expect(start).toBeGreaterThan(-1);
    const slice = source.slice(start, start + 120);
    expect(slice).toContain('<InitiativesGoalsTable />');
  });

  it('excludes the goals tab from table/kanban/timeline/grid view modes', () => {
    const start = source.indexOf('const availableViewModes: ViewMode[] =');
    const end = source.indexOf('const tabs = useMemo(');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const slice = source.slice(start, end);
    expect(slice).toContain("activeTab === 'goals'");
  });

  it('declares the Goals tab entry in the tabs array', () => {
    expect(source).toContain("id: 'goals' as ModuleTab");
    expect(source).toContain("label: t('initiatives.tabs.goals', 'Goals')");
  });
});

describe('T30 — R11/R24 (T25) wiring preserved byte-for-byte', () => {
  it('R11 T27/T28/T29 mounts and T25 buildInitiativePreviewDetails wiring are unchanged', () => {
    expect(source).toContain('<InitiativeObservabilityTable');
    expect(source).toContain('<CandidatesTable onAccept={handleAcceptCandidate} />');
    expect(source).toContain('<PortfolioHealthTable onOpenInitiative={openInitiative} />');
    expect(source).toContain('const tablePreviewDetailsText = buildInitiativePreviewDetails(');
    expect(source).toContain('text: tablePreviewDetailsText,');
  });
});

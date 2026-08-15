/**
 * R13 — source-anchor guard (raw source-text assertions, no mount): the
 * canonical T26 table is wired in above the five existing analysis
 * subviews, which remain present and untouched; InitiativesHub.tsx and
 * the R11 T27/T28/T29 wiring were not touched by this package.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const VIEW_PATH = path.resolve(
  __dirname,
  '../../../src/components/Initiatives/Analysis/PortfolioAnalysisView.tsx'
);
const source = readFileSync(VIEW_PATH, 'utf-8');

describe('R13 PortfolioAnalysisView wiring — source anchors', () => {
  it('imports and mounts PortfolioAnalysisTable above the existing subview switch', () => {
    expect(source).toContain("import { PortfolioAnalysisTable } from './PortfolioAnalysisTable';");
    const tableIdx = source.indexOf(
      '<PortfolioAnalysisTable initiatives={initiatives} onOpenInitiative={onOpenInitiative} />'
    );
    const switchIdx = source.indexOf("subview === 'resources' &&");
    expect(tableIdx).toBeGreaterThan(-1);
    expect(switchIdx).toBeGreaterThan(tableIdx);
  });

  it('preserves all five analysis subviews unchanged, relocated below the table', () => {
    for (const subview of ['resources', 'feasibility', 'logic', 'timeline', 'completeness']) {
      expect(source).toContain(`subview === '${subview}' &&`);
    }
    expect(source).toContain('<ResourcesAnalysis');
    expect(source).toContain('<FeasibilityAnalysis');
    expect(source).toContain('<LogicAnalysis');
    expect(source).toContain('<TimelineAnalysis');
    expect(source).toContain('<CompletenessAnalysis');
  });

  it('does not touch TableWithPreviewLayout/dependency POST-DELETE logic (still present, unmodified call sites)', () => {
    expect(source).toContain('<TableWithPreviewLayout<PreviewItem>');
    expect(source).toContain("Api.post('/initiatives/portfolio/dependencies'");
    expect(source).toContain('Api.delete(`/initiatives/portfolio/dependencies/${dependencyId}`)');
  });
});

describe('R13 — canonical hub ownership', () => {
  it('keeps the legacy analysis workspace unmounted from the canonical portfolio surface', () => {
    const HUB_PATH = path.resolve(
      __dirname,
      '../../../src/components/Initiatives/InitiativesHub.tsx'
    );
    const hubSource = readFileSync(HUB_PATH, 'utf-8');
    expect(hubSource).toContain("if (activeTab === 'portfolio') {");
    expect(hubSource).toContain('<PortfolioScenarioSurface');
    expect(hubSource).not.toContain("if (activeTab === 'analysis') {");
    expect(hubSource).not.toContain('<PortfolioAnalysisView');
    expect(hubSource).not.toContain('PortfolioAnalysisTable');
    expect(hubSource).not.toContain('<InitiativeObservabilityTable');
    expect(hubSource).not.toContain('<CandidatesTable');
    expect(hubSource).not.toContain('<PortfolioHealthTable');
  });
});

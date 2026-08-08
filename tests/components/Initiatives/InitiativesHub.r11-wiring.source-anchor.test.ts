/**
 * R11 — source-anchor guard (no mount; raw source-text assertions, same
 * technique the T20/T21/T23/T24 guard suites use). Two things must both
 * stay true after this package: T27/T28/T29 are wired into InitiativesHub,
 * and T25's prose-preview work is untouched.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const HUB_PATH = path.resolve(__dirname, '../../../src/components/Initiatives/InitiativesHub.tsx');
const source = readFileSync(HUB_PATH, 'utf-8');

describe('R11 InitiativesHub wiring — source anchors', () => {
  it('imports all three new canonical tables', () => {
    expect(source).toContain("import { InitiativeObservabilityTable } from './InitiativeObservabilityTable';");
    expect(source).toContain("import { CandidatesTable } from './CandidatesTable';");
    expect(source).toContain("import { PortfolioHealthTable } from './PortfolioHealthTable';");
  });

  it('mounts InitiativeObservabilityTable + preserved InitiativeObservabilityPanel dashboard under activeTab==="observability"', () => {
    const start = source.indexOf('// T27 R11:');
    const end = source.indexOf('// T28 R11:');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const slice = source.slice(start, end);
    expect(slice).toContain('<InitiativeObservabilityTable');
    expect(slice).toContain('<InitiativeObservabilityPanel initialInitiativeId={previewInitiativeId} />');
  });

  it('mounts CandidatesTable (not the retired CandidatesPanel) under activeTab==="candidates"', () => {
    const start = source.indexOf('// T28 R11:');
    const end = source.indexOf('// T29 R11:');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const slice = source.slice(start, end);
    expect(slice).toContain('<CandidatesTable onAccept={handleAcceptCandidate} />');
    expect(slice).not.toContain('<CandidatesPanel');
  });

  it('mounts PortfolioHealthTable + preserved PortfolioHealthView dashboard under activeTab==="portfolioHealth"', () => {
    const start = source.indexOf('// T29 R11:');
    const end = source.indexOf("// V3-F02: Analysis tab");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const slice = source.slice(start, end);
    expect(slice).toContain('<PortfolioHealthTable onOpenInitiative={openInitiative} />');
    expect(slice).toContain('<PortfolioHealthView onOpenInitiative={openInitiative} />');
  });

  it('T25 preserved: buildInitiativePreviewDetails import and both usage sites intact', () => {
    expect(source).toContain("import { buildInitiativePreviewDetails } from './initiativePreviewDetails';");
    expect(source).toContain('const tablePreviewDetailsText = buildInitiativePreviewDetails(');
    expect(source).toContain('text: tablePreviewDetailsText,');
    expect(source).toContain('void navigator.clipboard?.writeText(tablePreviewDetailsText);');
  });

  it('CandidatesPanel component import dropped (type-only reuse for AcceptCandidatePayload) — no unused import', () => {
    expect(source).toContain("import { type AcceptCandidatePayload } from './CandidatesPanel';");
    expect(source).not.toMatch(/import\s*{\s*type AcceptCandidatePayload,\s*CandidatesPanel/);
  });
});

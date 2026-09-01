import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ARTIFACT_PANEL_SECTION_ORDER } from '@/components/standard/ArtifactRightPanel';

const source = fs.readFileSync(path.resolve(__dirname, '../NotebookRightRail.tsx'), 'utf8');

// DEC-2026-08-25-69: replaced the bespoke Work/Context tablist with the
// shared SPEC-A right-panel canon — a fixed-order accordion, no tabs.
// This contract now checks for THAT shape instead of the old one.
//
// ★ 2026-09-01 (dyżur 164): szerokość NIE jest już literałem `360`. Prawy pas
// ma w całej aplikacji jedną szerokość z tokenu `--ntype-right-panel-width`
// (`src/index.css`), więc test pilnuje TOKENU, a nie liczby — inaczej sam
// blokowałby ujednolicenie, dla którego powstał.
describe('Notebook right rail owner contract (SPEC-A accordion)', () => {
  it('renders the shared ArtifactRightPanel behind the default-off rollout flag', () => {
    expect(source).toContain("from '@/components/standard/ArtifactRightPanel'");
    expect(source).toContain('<ArtifactRightPanel');
    expect(source).toContain('isNotebookSpecAShellEnabled()');
  });

  it('is a token-width accordion rail, not a tablist', () => {
    expect(source).toContain('<aside');
    expect(source).toContain("width: 'var(--ntype-right-panel-width)'");
    expect(source).toContain("minWidth: 'var(--ntype-right-panel-width)'");
    // Zakaz powrotu do liczby: każda szerokość wpisana ręcznie odtwarza
    // rozjazd 300/320/360/400 px zmierzony 2026-09-01.
    expect(source).not.toContain('width: 360');
    expect(source).not.toContain('width={360}');
    expect(source).not.toContain('role="tablist"');
    expect(source).not.toContain('role="tab"');
    expect(source).not.toContain('role="tabpanel"');
  });

  it('declares the five canonical sections in the fixed order, sourced from the ArtifactRightPanel canon (not a private copy)', () => {
    expect(source).toContain('ARTIFACT_PANEL_SECTION_ORDER');
    expect(source).toContain('const RAIL_SECTION_ORDER = ARTIFACT_PANEL_SECTION_ORDER.filter(');
    // The filter must resolve, at runtime, to the same five ids in the same
    // order the old literal declared — this is what keeps the change
    // visually and behaviorally identical (docs/program/grafika/ANALIZA_PRAWY_PANEL.md §7).
    const railIds = ['actions', 'properties', 'relations', 'comments', 'history'];
    const derived = ARTIFACT_PANEL_SECTION_ORDER.filter((id) => (railIds as string[]).includes(id));
    expect(derived).toEqual(railIds);
  });

  it('names the close control and reveals Właściwości/Powiązania from activeTab', () => {
    expect(source).toContain("aria-label={t('notebook.rightRail.closePanel', 'Close panel')}");
    expect(source).toContain("activeTab === 'work' ? 'properties' : 'relations'");
  });

  it('reuses ArtifactRightPanel-style accordion header semantics (h-11, chevron, aria-expanded)', () => {
    expect(source).toContain('aria-expanded={open}');
    expect(source).toContain('h-11 w-full items-center gap-2 px-4');
  });

  it('embeds NotebookContextPanel without its own card chrome', () => {
    expect(source).toContain('<NotebookContextPanel');
    expect(source).toContain('embedded');
  });
});

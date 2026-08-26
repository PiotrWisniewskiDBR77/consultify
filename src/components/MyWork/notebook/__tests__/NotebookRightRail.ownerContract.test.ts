import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../NotebookRightRail.tsx'), 'utf8');

// DEC-2026-08-25-69: replaced the bespoke Work/Context tablist with the
// shared SPEC-A right-panel canon — a fixed-order accordion, 360px, no
// tabs. This contract now checks for THAT shape instead of the old one.
describe('Notebook right rail owner contract (SPEC-A accordion)', () => {
  it('is a 360px accordion rail, not a tablist', () => {
    expect(source).toContain('<aside');
    expect(source).toContain('width: 360, minWidth: 360');
    expect(source).not.toContain('role="tablist"');
    expect(source).not.toContain('role="tab"');
    expect(source).not.toContain('role="tabpanel"');
  });

  it('declares the five canonical sections in the fixed order', () => {
    expect(source).toContain(
      "const RAIL_SECTION_ORDER = ['actions', 'properties', 'relations', 'comments', 'history'] as const;"
    );
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

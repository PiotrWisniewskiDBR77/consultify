import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(path.resolve(import.meta.dirname, '../FinanceHub.tsx'), 'utf8');

describe('FinanceHub shared registry shell contract', () => {
  it('defines exactly the five canonical Menu 2 tabs in owner order', () => {
    const labels = [
      'finance.tabs.statements',
      'finance.tabs.analysis',
      'finance.tabs.models',
      'finance.tabs.prediction',
      'finance.tabs.valuation',
    ];
    expect(labels.map((label) => source.indexOf(label))).toEqual(
      labels.map((label) => source.indexOf(label)).sort((a, b) => a - b)
    );
    expect(labels.every((label) => source.includes(label))).toBe(true);
  });

  it('uses canonical table and preview primitives with full-height token geometry', () => {
    expect(source).toContain('<StandardTable');
    expect(source).toContain('<StandardPreview');
    expect(source).toContain('style={{ width: PREVIEW_PANE_WIDTH }}');
    expect(source).toContain('className="h-full shrink-0');
  });

  it('retains the active tab in the URL and the shared list state in memory on Back', () => {
    expect(source).toContain("nextParams.set('tab', activeTab)");
    expect(source).toContain('const [searchQuery, setSearchQuery] = useState');
    expect(source).toContain('const [activeFilters, setActiveFilters] = useState');
    expect(source).toContain('const handleShowList = useCallback');
  });

  it('keeps one context CTA mapping for each canonical registry', () => {
    for (const key of ['statements:', 'analysis:', 'models:', 'prediction:', 'valuation:']) {
      expect(source).toContain(key);
    }
    expect(source).toContain('const primaryCta = useMemo');
  });
});

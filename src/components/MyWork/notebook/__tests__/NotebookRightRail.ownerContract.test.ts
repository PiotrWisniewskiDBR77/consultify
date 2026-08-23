import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../NotebookRightRail.tsx'), 'utf8');

describe('Notebook right rail owner contract', () => {
  it('uses one bounded Work/Context rail with canonical tab semantics', () => {
    expect(source).toContain('<aside');
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain("activeTab: 'work' | 'context'");
    expect(source).toContain('w-[min(22rem,calc(100vw-2rem))]');
  });

  it('names close and links each tab to its panel', () => {
    expect(source).toContain("aria-label={t('notebook.rightRail.closePanel', 'Close panel')}");
    expect(source).toContain('aria-controls={`notebook-rail-panel-${tab}`}');
    expect(source).toContain('aria-labelledby="notebook-rail-tab-work"');
    expect(source).toContain('aria-labelledby="notebook-rail-tab-context"');
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.resolve(__dirname, '../../../src/components/Initiatives/InitiativesHub.tsx'),
  'utf8'
);

describe('R11 compatibility after the F9 three-tab cutover', () => {
  it('keeps exactly the three owner-approved visible Menu 2 destinations', () => {
    const start = source.indexOf('const tabs = useMemo(');
    const tabs = source.slice(start, source.indexOf('useEffect(() => {', start));
    expect(tabs.match(/id: '(?:list|plan|capacity)' as ModuleTab/g)).toHaveLength(3);
  });

  it('maps observability and portfolio legacy URLs to the Analysis lens', () => {
    expect(source).toContain(
      "['analysis', 'portfolio', 'observability', 'portfolioHealth'].includes(requested || '')"
    );
  });

  it('does not restore Candidates as a top-level pill', () => {
    const start = source.indexOf('const tabs = useMemo(');
    const tabs = source.slice(start, source.indexOf('useEffect(() => {', start));
    expect(tabs).not.toContain("id: 'candidates'");
  });

  it('keeps Portfolio health as a flagged preparation-lens option and real view', () => {
    expect(source).toContain('<option value="portfolioHealth">');
    expect(source).toContain("preparationLens === 'portfolioHealth'");
    expect(source).toContain('<PortfolioHealthView');
  });

  it('preserves the canonical and legacy initiative list merge', () => {
    expect(source).toContain('listRegisteredInitiatives()');
    expect(source).toContain('listLegacyInitiatives({ includeArchived: true })');
  });

  it('keeps flagged Work report and For approval surfaces in the Status control', () => {
    expect(source).toContain("id: 'workReport'");
    expect(source).toContain("id: 'transitionInbox'");
    expect(source).toContain("const POWIERZCHNIE_Z_PRZELACZNIKA: ModuleTab[] = ['workReport', 'transitionInbox']");
  });
});

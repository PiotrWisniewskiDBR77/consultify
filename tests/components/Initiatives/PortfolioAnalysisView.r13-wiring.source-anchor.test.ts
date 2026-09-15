import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const hubSource = readFileSync(
  path.resolve(__dirname, '../../../src/components/Initiatives/InitiativesHub.tsx'),
  'utf8'
);

describe('R13 analysis compatibility after the F9 three-tab cutover', () => {
  it('maps retired analysis URLs into the canonical Initiatives preparation lens', () => {
    expect(hubSource).toContain(
      "['analysis', 'portfolio', 'observability', 'portfolioHealth'].includes(requested || '')"
    );
    expect(hubSource).toContain("? 'portfolioHealth'");
    expect(hubSource).toContain(": 'analysis'");
  });

  it('keeps Portfolio health behind its strict default-off flag', () => {
    expect(hubSource).toContain("import.meta.env.VITE_WAVE3_INITIATIVES_PORTFOLIO_HEALTH === 'true'");
    expect(hubSource).toContain("preparationLens === 'portfolioHealth'");
    expect(hubSource).toContain('<PortfolioHealthView');
  });

  it('does not restore retired analysis destinations as Menu 2 pills', () => {
    const start = hubSource.indexOf('const tabs = useMemo(');
    const tabs = hubSource.slice(start, hubSource.indexOf('useEffect(() => {', start));
    for (const id of ['analysis', 'portfolio', 'observability', 'portfolioHealth']) {
      expect(tabs).not.toContain(`id: '${id}'`);
    }
  });

  it('preserves the F9 visible Menu 2 denominator', () => {
    expect(hubSource).toContain("id: 'list' as ModuleTab");
    expect(hubSource).toContain("id: 'plan' as ModuleTab");
    expect(hubSource).toContain("id: 'capacity' as ModuleTab");
  });
});

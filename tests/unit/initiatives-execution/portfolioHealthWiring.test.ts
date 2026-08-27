import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/Initiatives/InitiativesHub.tsx'),
  'utf8'
);

describe('Day 49 C.1 portfolio health wiring', () => {
  it('keeps the portfolio health surface behind a strict default-off flag', () => {
    expect(source).toContain("import.meta.env.VITE_WAVE3_INITIATIVES_PORTFOLIO_HEALTH === 'true'");
    expect(source).toContain("...(PORTFOLIO_HEALTH_ENABLED ? (['portfolioHealth']");
  });

  it('adds one Menu 1 entry and mounts the preserved real view', () => {
    expect(source).toContain("id: 'portfolioHealth' as ModuleTab");
    expect(source).toContain("if (activeTab === 'portfolioHealth')");
    expect(source).toContain('<PortfolioHealthView');
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.resolve(__dirname, '../../../src/components/Initiatives/InitiativesHub.tsx'),
  'utf8'
);

describe('InitiativesHub canonical intake navigation', () => {
  it('keeps the owner-approved three-tab information architecture', () => {
    const start = source.indexOf('const tabs = useMemo(');
    const visibleTabs = source.slice(start, source.indexOf('useEffect(() => {', start));
    expect(visibleTabs).toContain("id: 'list' as ModuleTab");
    expect(visibleTabs).toContain("id: 'plan' as ModuleTab");
    expect(visibleTabs).toContain("id: 'capacity' as ModuleTab");
    expect(visibleTabs).not.toContain("id: 'workReport'");
    expect(visibleTabs).not.toContain("id: 'transitionInbox'");
  });

  it('keeps flagged report and approval surfaces reachable through Status', () => {
    expect(source).toContain("id: 'workReport'");
    expect(source).toContain("id: 'transitionInbox'");
    expect(source).toContain("const POWIERZCHNIE_Z_PRZELACZNIKA: ModuleTab[] = ['workReport', 'transitionInbox']");
  });
});

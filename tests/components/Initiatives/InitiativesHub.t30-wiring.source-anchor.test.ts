import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.resolve(__dirname, '../../../src/components/Initiatives/InitiativesHub.tsx'),
  'utf8'
);

describe('T30 compatibility after the F9 navigation cutover', () => {
  it('does not restore the retired Goals table import', () => {
    expect(source).not.toContain("import { InitiativesGoalsTable }");
  });

  it('does not expose Goals in the visible Menu 2 tabs', () => {
    const start = source.indexOf('const tabs = useMemo(');
    const tabs = source.slice(start, source.indexOf('useEffect(() => {', start));
    expect(tabs).not.toContain("id: 'goals'");
  });

  it('falls invalid legacy tab parameters back to the canonical list', () => {
    expect(source).toContain("setActiveTab('list')");
    expect(source).toContain("next.delete('tab')");
  });

  it('preserves the F9 list, plan and capacity navigation', () => {
    expect(source).toContain("id: 'list' as ModuleTab");
    expect(source).toContain("id: 'plan' as ModuleTab");
    expect(source).toContain("id: 'capacity' as ModuleTab");
  });
});

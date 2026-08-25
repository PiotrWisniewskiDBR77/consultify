import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('SystemModule platform operations reachability', () => {
  it('registers the tab as renderable and routes it to PlatformOperationsView', () => {
    const source = fs.readFileSync('src/views/superadmin/SystemModule.tsx', 'utf8');
    expect(source).toContain("'platform-operations',");
    expect(source).toContain("id: 'platform-operations'");
    expect(source).toMatch(/case 'platform-operations':\s*return <PlatformOperationsView \/>/);
  });
});

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Day 224 Partner organizations table width contract', { retry: 0 }, () => {
  it('passes minTableWidth="auto" to the organizations FilterableTable', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/views/partner/PartnerPortalView.tsx'),
      'utf8'
    );
    const organizationsStart = source.indexOf("if (subsection === 'organizations')");
    const organizationsEnd = source.indexOf("if (subsection === 'projects')", organizationsStart);
    const organizationsBranch = source.slice(organizationsStart, organizationsEnd);

    expect(organizationsBranch).toContain('<FilterableTable');
    expect(organizationsBranch).toContain('minTableWidth="auto"');
    expect(organizationsBranch.match(/minTableWidth=/g)).toHaveLength(1);
  });
});

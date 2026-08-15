import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const assessmentHubSource = () =>
  readFileSync(join(process.cwd(), 'src/components/assessment/AssessmentHub.tsx'), 'utf8');

describe('T21 Assessment list preview Details', () => {
  it('uses the canonical Property/Value details contract and keeps block order', () => {
    const source = assessmentHubSource();
    const listStart = source.indexOf("if (activeTab === 'list' || activeTab === 'processes')");
    const reportsStart = source.indexOf("if (activeTab === 'reports')", listStart);
    const listSlice = source.slice(listStart, reportsStart);

    expect(listSlice).toContain("propertyLabel: isPolish ? 'Wlasciwosc' : 'Property'");
    expect(listSlice).toContain("valueLabel: isPolish ? 'Wartosc' : 'Value'");
    expect(listSlice).toContain('properties: [');
    expect(listSlice).toContain("id: 'type'");
    expect(listSlice).toContain("id: 'progress'");
    expect(listSlice).not.toContain('text: previewDetailsText');

    const blockOrder = ['meta={{', 'details={{', 'ai={{', 'relations={[]}', 'actions={previewActions}'];
    const positions = blockOrder.map((token) => listSlice.indexOf(token));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('T23 Reports preview Details', () => {
  it('uses Property/Value details and keeps imported-report actions intact', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/assessment/AssessmentHub.tsx'),
      'utf8'
    );
    const listStart = source.indexOf("if (activeTab === 'list' || activeTab === 'processes')");
    const reportsStart = source.indexOf("if (activeTab === 'reports')", listStart);
    const initiativesStart = source.indexOf("if (activeTab === 'initiatives')", reportsStart);
    const reportsSlice = source.slice(reportsStart, initiativesStart);

    expect(reportsSlice).toContain("propertyLabel: isPolish ? 'Wlasciwosc' : 'Property'");
    expect(reportsSlice).toContain("valueLabel: isPolish ? 'Wartosc' : 'Value'");
    expect(reportsSlice).toContain('properties: [');
    expect(reportsSlice).toContain("id: 'type'");
    expect(reportsSlice).toContain("id: 'source'");
    expect(reportsSlice).toContain("id: 'author'");
    expect(reportsSlice).not.toContain('text: previewDetailsText');

    expect(reportsSlice).toContain("id: 'open'");
    expect(reportsSlice).toContain("id: 'duplicate'");
    expect(reportsSlice).toContain('isImported');
    expect(reportsSlice).toContain('ReportSlideOverContent');
    expect(reportsSlice).toContain('relations={[]}');
  });
});

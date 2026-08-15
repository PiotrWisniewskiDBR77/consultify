import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('T24 Initiatives preview Details', () => {
  it('uses Property/Value details and keeps row actions and relations intact', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/assessment/AssessmentHub.tsx'),
      'utf8'
    );
    const listStart = source.indexOf("if (activeTab === 'list' || activeTab === 'processes')");
    const initiativesStart = source.indexOf("if (activeTab === 'initiatives')", listStart);
    const initiativesSlice = source.slice(initiativesStart);

    expect(initiativesSlice).toContain("propertyLabel: isPolish ? 'Wlasciwosc' : 'Property'");
    expect(initiativesSlice).toContain("valueLabel: isPolish ? 'Wartosc' : 'Value'");
    expect(initiativesSlice).toContain('properties: [');
    expect(initiativesSlice).toContain("id: 'type'");
    expect(initiativesSlice).toContain("id: 'source-report'");
    expect(initiativesSlice).toContain("id: 'author'");
    expect(initiativesSlice).not.toContain('text: previewDetailsText');

    expect(initiativesSlice).toContain("id: 'open'");
    expect(initiativesSlice).toContain("id: 'duplicate'");
    expect(initiativesSlice).toContain('setSelectedInitiativeRowId');
    expect(initiativesSlice).toContain('destructive:');
    expect(initiativesSlice).toContain('relations={[]}');
  });
});

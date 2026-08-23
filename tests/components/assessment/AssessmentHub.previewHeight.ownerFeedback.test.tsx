/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('ASM-OWN-005 Assessment Processes preview height', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/assessment/AssessmentHub.tsx'),
    'utf8'
  );

  it('gives the hub content an explicit full-height chain inside StandardModuleBar', () => {
    expect(source).toContain('<div className="h-full min-h-0 overflow-hidden space-y-3">');
    expect(source).not.toContain('<div className="min-h-0 flex-1 overflow-hidden space-y-3">');
  });

  it('keeps Processes table and StandardPreview in the same full-height flex row', () => {
    const processesStart = source.indexOf("if (activeTab === 'list' || activeTab === 'processes')");
    const reportsStart = source.indexOf("if (activeTab === 'reports')", processesStart);
    const processesSlice = source.slice(processesStart, reportsStart);

    expect(processesStart).toBeGreaterThan(-1);
    expect(reportsStart).toBeGreaterThan(processesStart);
    expect(processesSlice).toContain('<div className="h-full flex overflow-hidden">');
    expect(processesSlice).toContain('<StandardTable');
    expect(processesSlice).toContain('<aside className="w-[400px]');
    expect(processesSlice).toContain('<StandardPreview');
  });
});

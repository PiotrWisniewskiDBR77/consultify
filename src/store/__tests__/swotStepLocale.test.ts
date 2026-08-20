import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { SWOT_STEPS } from '@/store/useToolStore';

describe('dynamic SWOT step locale contract', () => {
  it('keeps distinct, complete English and Polish labels for every live step', () => {
    expect(SWOT_STEPS.map(({ id, name, namePl }) => ({ id, name, namePl }))).toEqual([
      { id: 'mission', name: 'Mission & Context', namePl: 'Misja i kontekst' },
      { id: 'input', name: 'Input & Exploration', namePl: 'Materiały i eksploracja' },
      { id: 'swot', name: 'SWOT Build', namePl: 'Budowa SWOT' },
      { id: 'insights', name: 'Synthesis & Insights', namePl: 'Synteza i wnioski' },
      { id: 'outputs', name: 'Outputs & Actions', namePl: 'Rezultaty i działania' },
    ]);

    const documentView = readFileSync(
      path.resolve(process.cwd(), 'src/components/DiscoveryTools/ToolDocumentView.tsx'),
      'utf8'
    );
    expect(documentView).toContain('en: step.name');
    expect(documentView).toContain('pl: step.namePl');
    expect(documentView).not.toContain("pl: isOutputs ? 'Outputs & Actions'");
  });
});

import { describe, expect, it } from 'vitest';

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
  });
});

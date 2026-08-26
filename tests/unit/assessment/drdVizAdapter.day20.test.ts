import { describe, expect, it } from 'vitest';

import {
  buildDRDVisualizationData,
  buildDRDVisualizationDataFromAxes,
} from '../../../server/src/services/report/drdVizAdapter';

describe('Assessment day 20 — canonical per-axis DRD scales', () => {
  it('publishes 7,5,5,7,6,6,5 as the seven server-side max levels', () => {
    const result = buildDRDVisualizationDataFromAxes({});

    expect(result.dimensions.map((dimension) => dimension.maxLevel)).toEqual([7, 5, 5, 7, 6, 6, 5]);
  });

  it('keeps a culture level 6 readable instead of clipping it to the old scale', () => {
    const result = buildDRDVisualizationData({
      '5A': { actual: 6, target: 6 },
    });
    const culture = result.dimensions.find((dimension) => dimension.id === '5');

    expect(culture).toMatchObject({ current: 6, target: 6, maxLevel: 6 });
  });

  it('keeps a cybersecurity level 6 readable instead of clipping it to the old scale', () => {
    const result = buildDRDVisualizationData({
      '6A': { actual: 6, target: 6 },
    });
    const cybersecurity = result.dimensions.find((dimension) => dimension.id === '6');

    expect(cybersecurity).toMatchObject({ current: 6, target: 6, maxLevel: 6 });
  });

  it('represents the honest empty state with canonical scales and zero completion', () => {
    const result = buildDRDVisualizationData({});

    expect(result.completionPercent).toBe(0);
    expect(result.dimensions).toHaveLength(7);
    expect(result.dimensions.every((dimension) => dimension.current === 0)).toBe(true);
  });
});

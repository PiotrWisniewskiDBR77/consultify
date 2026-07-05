/**
 * drdVizAdapter — dual key-convention resilience for the DRD maturity radar.
 *
 * Backend `computeAxisDataFromAssessment` writes NUMERIC axis keys ("1".."7");
 * the report editor writes NAMED keys ("processes"…). buildDRDVisualizationDataFromAxes
 * must render on either — otherwise the flagship radar silently shows all zeros.
 */
import { describe, it, expect } from 'vitest';
import { buildDRDVisualizationDataFromAxes } from '../../src/services/drdVizAdapter';

describe('buildDRDVisualizationDataFromAxes — key-convention resilience', () => {
  it('reads NAMED axis keys (report-editor convention)', () => {
    const viz = buildDRDVisualizationDataFromAxes({
      processes: { actual: 3, target: 5 },
      dataManagement: { actual: 4, target: 6 },
    });
    const processes = viz.dimensions.find((d) => d.id === '1');
    const data = viz.dimensions.find((d) => d.id === '4');
    expect(processes?.current).toBe(3);
    expect(processes?.target).toBe(5);
    expect(data?.current).toBe(4);
  });

  it('reads NUMERIC axis keys (backend computeAxisData convention)', () => {
    const viz = buildDRDVisualizationDataFromAxes({
      '1': { actual: 3, target: 5 },
      '4': { actual: 4, target: 6 },
      '7': { actual: 2, target: 4 },
    });
    const processes = viz.dimensions.find((d) => d.id === '1');
    const ai = viz.dimensions.find((d) => d.id === '7');
    expect(processes?.current).toBe(3);
    expect(processes?.target).toBe(5);
    expect(ai?.current).toBe(2);
    // Not all zeros — the real bug this guards against.
    expect(viz.overallScore).toBeGreaterThan(0);
  });

  it('prefers the NAMED key when both are present', () => {
    const viz = buildDRDVisualizationDataFromAxes({
      processes: { actual: 5, target: 7 },
      '1': { actual: 1, target: 2 },
    });
    expect(viz.dimensions.find((d) => d.id === '1')?.current).toBe(5);
  });

  it('fails soft on empty / missing data (no crash, zeros)', () => {
    const viz = buildDRDVisualizationDataFromAxes({});
    expect(viz.dimensions).toHaveLength(7);
    expect(viz.overallScore).toBe(0);
    expect(viz.completionPercent).toBe(0);
  });
});

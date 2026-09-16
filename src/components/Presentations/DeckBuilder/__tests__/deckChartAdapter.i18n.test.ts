import { describe, expect, it } from 'vitest';

import { adaptChartBlockContent } from '../blocks/deckChartAdapter';

describe('deckChartAdapter fallback labels', () => {
  it('uses English labels by default when authored labels are missing', () => {
    const cartesian = adaptChartBlockContent({
      chartType: 'bar',
      data: [{ label: 'A', value: 10 }],
    });
    const matrix = adaptChartBlockContent({
      chartType: 'matrix_2x2',
      points: [{ label: 'A', x: 8, y: 6 }],
    });

    expect(cartesian?.type).toBe('bar');
    if (cartesian?.type === 'bar') expect(cartesian.series[0]?.label).toBe('Value');
    expect(matrix?.type).toBe('matrix_2x2');
    if (matrix?.type === 'matrix_2x2') {
      expect(matrix.axisLabels).toEqual({ x: 'Impact', y: 'Feasibility' });
    }
  });

  it('uses caller-provided Polish labels without changing authored labels', () => {
    const polish = {
      seriesValue: 'Wartość',
      matrixImpact: 'Wpływ',
      matrixFeasibility: 'Wykonalność',
    };

    const cartesian = adaptChartBlockContent(
      { chartType: 'bar', data: [{ label: 'A', value: 10 }] },
      polish
    );
    const matrix = adaptChartBlockContent(
      {
        chartType: 'matrix_2x2',
        axisLabels: { x: 'Business value' },
        points: [{ label: 'A', x: 8, y: 6 }],
      },
      polish
    );

    if (cartesian?.type === 'bar') expect(cartesian.series[0]?.label).toBe('Wartość');
    if (matrix?.type === 'matrix_2x2') {
      expect(matrix.axisLabels).toEqual({ x: 'Business value', y: 'Wykonalność' });
    }
  });
});

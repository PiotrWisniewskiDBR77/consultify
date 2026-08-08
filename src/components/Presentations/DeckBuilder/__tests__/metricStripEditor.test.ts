import { describe, expect, it } from 'vitest';

import { parseMetricStrip, serializeMetricStrip } from '../metricStripEditor';

describe('manual metric-strip editor', () => {
  it('round-trips business labels, values, units, trends and changes', () => {
    const metrics = [
      { label: 'Scope delivery', value: '72', unit: '%', trend: 'down', change: '-3 pp' },
      { label: 'Annual benefit', value: '2.2', unit: 'EUR m', trend: 'up', change: '+0.2' },
    ];

    expect(parseMetricStrip(serializeMetricStrip(metrics))).toEqual(metrics);
  });

  it('ignores unsupported trends and keeps a usable metric row', () => {
    expect(parseMetricStrip('Spend | 1.08 | EUR m | sideways | EUR 0.32m headroom')).toEqual([
      {
        label: 'Spend',
        value: '1.08',
        unit: 'EUR m',
        change: 'EUR 0.32m headroom',
      },
    ]);
  });
});

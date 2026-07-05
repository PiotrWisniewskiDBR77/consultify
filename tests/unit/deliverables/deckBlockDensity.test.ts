/**
 * grow-content — blockDensityFor() contract.
 *
 * Locks the rule that decides when a deck block renders at 'hero' density
 * (bigger hero-number / taller chart / heavier KPI tiles) because it is the
 * dominant content of its region. Gated on the grow-content flag so the proof
 * harness can isolate the effect and so `default` is byte-identical to pre-grow.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  blockDensityFor,
  setGrowContent,
} from '@/components/Presentations/DeckBuilder/layouts/LayoutEngine';

type B = { type: string; content?: Record<string, unknown> };

const kpi: B = { type: 'kpi_widget', content: { value: '18%' } };
const chart: B = { type: 'chart', content: { chartType: 'line', series: [{ name: 'x', data: [1, 2] }] } };
const strip: B = { type: 'metric_strip', content: { metrics: [{ label: 'a', value: 1 }] } };
const heading: B = { type: 'heading', content: { text: 'H' } };
const callout: B = { type: 'callout', content: { text: 'short' } };
const bullets: B = { type: 'bullet_list', content: { items: ['a', 'b', 'c'] } };

describe('blockDensityFor — grow-content', () => {
  beforeEach(() => setGrowContent(true));
  afterEach(() => setGrowContent(true));

  it('off flag → always default (byte-identical to pre-grow)', () => {
    setGrowContent(false);
    expect(blockDensityFor(kpi, [kpi], { variant: 'big_number' })).toBe('default');
    expect(blockDensityFor(chart, [chart])).toBe('default');
  });

  it('big_number / single_insight metric is hero even with supporting narrative', () => {
    const region = [kpi, callout, bullets];
    expect(blockDensityFor(kpi, region, { variant: 'big_number' })).toBe('hero');
    expect(blockDensityFor(kpi, region, { intent: 'single_insight' })).toBe('hero');
  });

  it('off-archetype metric is hero only when truly alone', () => {
    expect(blockDensityFor(kpi, [kpi])).toBe('hero');
    expect(blockDensityFor(kpi, [kpi, bullets])).toBe('default');
  });

  it('chart owning its region grows; a short strip/caption beside it does not block it', () => {
    expect(blockDensityFor(chart, [chart])).toBe('hero');
    expect(blockDensityFor(chart, [heading, chart])).toBe('hero');
    expect(blockDensityFor(chart, [strip, chart])).toBe('hero');
  });

  it('chart competing with another tall block stays default', () => {
    const other: B = { type: 'image', content: {} };
    expect(blockDensityFor(chart, [chart, other])).toBe('default');
  });

  it('metric strip owning its region (only a heading beside it) is hero', () => {
    expect(blockDensityFor(strip, [heading, strip])).toBe('hero');
    expect(blockDensityFor(strip, [strip, chart, bullets])).toBe('default');
  });

  it('non-target blocks are always default', () => {
    expect(blockDensityFor(bullets, [bullets])).toBe('default');
    expect(blockDensityFor(heading, [heading])).toBe('default');
  });

  it('self-exclusion is by reference — the block never counts itself as competing', () => {
    // If self-exclusion were broken, a lone chart would see itself as competing
    // weight and fall back to 'default'. It must be 'hero'.
    expect(blockDensityFor(chart, [chart])).toBe('hero');
  });
});

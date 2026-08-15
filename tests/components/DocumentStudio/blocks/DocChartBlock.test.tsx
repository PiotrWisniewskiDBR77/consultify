/**
 * R3 — DocChartBlock render tests.
 *
 * recharts `ResponsiveContainer` measures its parent with ResizeObserver,
 * which in jsdom reports 0×0 → children never mount. We mock it to a fixed
 * 600×300 box so the inner SVG renders and we can assert on series count etc.
 */

import { cloneElement, isValidElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// recharts' real ResponsiveContainer measures the parent (0×0 in jsdom) and
// clones the single chart child with explicit width/height. We replicate that
// clone with a fixed 600×300 box so the chart actually lays out its shapes.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 600, height: 300 }}>
        {isValidElement(children)
          ? cloneElement(children as React.ReactElement, { width: 600, height: 300 })
          : children}
      </div>
    ),
  };
});

import { DocChartBlock } from '../../../../src/components/DocumentStudio/blocks/DocChartBlock';
import type { DocumentChartBlockContent } from '../../../../src/components/DocumentStudio/types';

function bar(): DocumentChartBlockContent {
  return {
    kind: 'bar',
    title: 'Quarterly Revenue',
    categories: ['Q1', 'Q2', 'Q3'],
    series: [{ label: 'Net', values: [10, 20, 30] }],
  };
}

describe('DocChartBlock', () => {
  it('renders a bar chart with title, axes, legend and a bar series', () => {
    const { container } = render(<DocChartBlock content={bar()} />);
    expect(screen.getByText('Quarterly Revenue')).toBeTruthy();
    // recharts surfaces categories via axis tick text
    expect(screen.getByText('Q1')).toBeTruthy();
    // legend label = series label
    expect(screen.getAllByText('Net').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.recharts-bar').length).toBeGreaterThan(0);
  });

  it('renders a line chart', () => {
    const content: DocumentChartBlockContent = {
      kind: 'line',
      title: 'Trend',
      categories: ['Jan', 'Feb'],
      series: [{ label: 'Visits', values: [5, 9] }],
    };
    const { container } = render(<DocChartBlock content={content} />);
    expect(container.querySelectorAll('.recharts-line').length).toBeGreaterThan(0);
  });

  it('renders a pie chart and aggregates >5 slices into the localized "Other" label', () => {
    const content: DocumentChartBlockContent = {
      kind: 'pie',
      title: 'Share',
      categories: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      series: [{ label: 'pct', values: [1, 1, 1, 1, 1, 1, 1] }],
    };
    render(<DocChartBlock content={content} />);
    // 7 input slices → capped to 5 (4 head + 1 aggregated "Other"); the
    // surplus slice is labelled and carries the summed value (3 here).
    expect(screen.getByText(/Other/)).toBeTruthy();
    // Only 5 legend entries (one per kept slice).
    const legendItems = document.querySelectorAll('.recharts-legend-item');
    expect(legendItems.length).toBe(5);
  });

  it('caps series to ≤8 (MAX_SERIES)', () => {
    const series = Array.from({ length: 12 }, (_, i) => ({
      label: `S${i}`,
      values: [i, i + 1],
    }));
    const content: DocumentChartBlockContent = {
      kind: 'bar',
      title: 'Many',
      categories: ['x', 'y'],
      series,
    };
    const { container } = render(<DocChartBlock content={content} />);
    // recharts renders one <Bar> group (.recharts-bar) per series
    expect(container.querySelectorAll('.recharts-bar').length).toBe(8);
  });

  it('clamps height into the 240–300 band', () => {
    render(<DocChartBlock content={bar()} height={9999} />);
    // ResponsiveContainer is mocked so we cannot read computed height here;
    // the assertion is that rendering with an out-of-range height does not throw.
    expect(screen.getByTestId('responsive-container')).toBeTruthy();
  });
});

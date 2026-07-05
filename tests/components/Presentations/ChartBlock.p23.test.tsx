/**
 * P2.3 — ChartBlock data-bound render tests.
 *
 * Proves the deck chart block now draws a REAL chart from data (recharts bar
 * series present) and FAILS OPEN — a chart block with no usable data renders
 * nothing (no placeholder icon balast, no crash).
 *
 * recharts ResponsiveContainer measures its parent (0×0 in jsdom) → we mock it
 * to a fixed box so inner SVG shapes actually mount (same pattern as the
 * DocChartBlock tests).
 */
import { cloneElement, isValidElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

import { ChartBlock } from '@/components/Presentations/DeckBuilder/blocks/ChartBlock';
import { CURATED_COLOR_SETS, type CardBlock } from '@/components/Presentations/wizard/types';

const theme = CURATED_COLOR_SETS[0];

function chartBlock(content: Record<string, unknown>): CardBlock {
  return {
    block_id: 'b1',
    card_id: 'c1',
    type: 'chart',
    content,
    is_refreshable: false,
    position: { area: 'full', order: 0 },
    ai_editable: true,
  };
}

describe('ChartBlock — data-bound (P2.3)', () => {
  it('renders a real recharts bar series from series[{name,data}]', () => {
    const { container, getByText } = render(
      <ChartBlock
        block={chartBlock({
          chartType: 'bar',
          title: 'Dojrzałość cyfrowa',
          series: [{ name: 'VTS', data: [3, 2, 4] }],
        })}
        theme={theme}
      />
    );
    expect(getByText('Dojrzałość cyfrowa')).toBeTruthy();
    expect(container.querySelectorAll('.recharts-bar').length).toBeGreaterThan(0);
  });

  it('renders a line chart for chartType line', () => {
    const { container } = render(
      <ChartBlock
        block={chartBlock({
          chartType: 'line',
          series: [{ name: 'Adopcja', data: [66, 63, 61] }],
        })}
        theme={theme}
      />
    );
    expect(container.querySelectorAll('.recharts-line').length).toBeGreaterThan(0);
  });

  it('renders a RAG chart (non-recharts archetype) from thresholds', () => {
    const { getByText } = render(
      <ChartBlock
        block={chartBlock({
          chartType: 'rag',
          thresholds: { green: 80, amber: 50 },
          items: [{ label: 'Uptime', value: 92 }],
        })}
        theme={theme}
      />
    );
    expect(getByText('Uptime')).toBeTruthy();
  });

  it('FAIL-OPEN: chart block with no data renders nothing (no placeholder)', () => {
    const { container } = render(
      <ChartBlock block={chartBlock({ chartType: 'pie', title: 'Empty' })} theme={theme} />
    );
    // Nothing painted: no title, no svg, no placeholder icon.
    expect(container.innerHTML).toBe('');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('FAIL-OPEN: garbage content does not crash and renders nothing', () => {
    const { container } = render(
      <ChartBlock
        block={chartBlock({ chartType: 'bar', series: [{ name: 'x', data: ['nope'] }] })}
        theme={theme}
      />
    );
    expect(container.innerHTML).toBe('');
  });
});

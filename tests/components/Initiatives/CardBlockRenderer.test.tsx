/**
 * @vitest-environment jsdom
 *
 * CardBlockRenderer.test — F3 (D11): each block type renders, empty graceful.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { CardBlockRenderer } from '@/components/Initiatives/cards/CardBlockRenderer';
import type { CardSpec } from '@/components/Initiatives/cards/cardBlockSchema';

function spec(blocks: CardSpec['blocks']): CardSpec {
  return { sectionKey: 'problemDefinition', title: 'Definicja problemu', blocks };
}

describe('CardBlockRenderer — empty / graceful', () => {
  it('renders graceful empty-state for null spec (PL fallback)', () => {
    const { container } = render(<CardBlockRenderer spec={null} />);
    expect(container.querySelector('[data-card-empty]')).not.toBeNull();
    expect(screen.getByText(/Brak treści/)).toBeTruthy();
  });

  it('renders EN empty-state when lang=en', () => {
    render(<CardBlockRenderer spec={spec([])} lang="en" />);
    expect(screen.getByText(/Nothing to display/)).toBeTruthy();
  });

  it('renders the card title when present', () => {
    render(<CardBlockRenderer spec={spec([{ type: 'paragraph', text: 'Treść.' }])} />);
    expect(screen.getByText('Definicja problemu')).toBeTruthy();
  });

  it('hides title when showTitle=false', () => {
    const { container } = render(
      <CardBlockRenderer spec={spec([{ type: 'paragraph', text: 'Treść.' }])} showTitle={false} />,
    );
    expect(container.querySelector('[data-card-title]')).toBeNull();
  });
});

describe('CardBlockRenderer — block-type mapping', () => {
  it('renders heading block', () => {
    const { container } = render(<CardBlockRenderer spec={spec([{ type: 'heading', text: 'Symptom' }])} />);
    expect(container.querySelector('[data-block="heading"]')).not.toBeNull();
    expect(screen.getByText('Symptom')).toBeTruthy();
  });

  it('renders paragraph block', () => {
    const { container } = render(
      <CardBlockRenderer spec={spec([{ type: 'paragraph', text: 'Proces trwa długo.' }])} />,
    );
    expect(container.querySelector('[data-block="paragraph"]')).not.toBeNull();
    expect(screen.getByText('Proces trwa długo.')).toBeTruthy();
  });

  it('renders kpi_strip tiles', () => {
    const { container } = render(
      <CardBlockRenderer
        spec={spec([
          {
            type: 'kpi_strip',
            tiles: [
              { label: 'Czas', value: '5 dni', delta: '-2 dni', trend: 'down' },
              { label: 'Koszt', value: '120k zł' },
            ],
          },
        ])}
      />,
    );
    expect(container.querySelectorAll('[data-kpi-tile]')).toHaveLength(2);
    expect(screen.getByText('5 dni')).toBeTruthy();
    expect(screen.getByText('-2 dni')).toBeTruthy();
  });

  it('renders bullet_list items', () => {
    render(
      <CardBlockRenderer spec={spec([{ type: 'bullet_list', items: ['Punkt A', 'Punkt B'] }])} />,
    );
    expect(screen.getByText('Punkt A')).toBeTruthy();
    expect(screen.getByText('Punkt B')).toBeTruthy();
  });

  it('renders ordered list as <ol>', () => {
    const { container } = render(
      <CardBlockRenderer spec={spec([{ type: 'bullet_list', ordered: true, items: ['Krok 1'] }])} />,
    );
    expect(container.querySelector('ol[data-block="bullet_list"]')).not.toBeNull();
  });

  it('renders table with headers and cells', () => {
    const { container } = render(
      <CardBlockRenderer
        spec={spec([{ type: 'table', columns: ['Metryka', 'Wartość'], rows: [['ROI', '23%']] }])}
      />,
    );
    expect(container.querySelector('[data-block="table"]')).not.toBeNull();
    expect(screen.getByText('Metryka')).toBeTruthy();
    expect(screen.getByText('ROI')).toBeTruthy();
    expect(screen.getByText('23%')).toBeTruthy();
  });

  it('renders chart as proportional bars', () => {
    const { container } = render(
      <CardBlockRenderer
        spec={spec([
          {
            type: 'chart',
            chartKind: 'bar',
            title: 'Trend',
            series: [
              { label: 'Q1', value: 10 },
              { label: 'Q2', value: 20 },
            ],
          },
        ])}
      />,
    );
    const chart = container.querySelector('[data-block="chart"]');
    expect(chart).not.toBeNull();
    expect(chart?.getAttribute('data-chart-kind')).toBe('bar');
    expect(container.querySelectorAll('[data-chart-bar]')).toHaveLength(2);
  });

  it('renders callout with tone + title', () => {
    const { container } = render(
      <CardBlockRenderer
        spec={spec([{ type: 'callout', tone: 'danger', title: 'Ryzyko', text: 'Brak danych.' }])}
      />,
    );
    const callout = container.querySelector('[data-block="callout"]');
    expect(callout).not.toBeNull();
    expect(callout?.getAttribute('data-tone')).toBe('danger');
    expect(screen.getByText('Ryzyko')).toBeTruthy();
    expect(screen.getByText('Brak danych.')).toBeTruthy();
  });
});

describe('CardBlockRenderer — robustness', () => {
  it('skips unknown block silently by default and renders the rest', () => {
    const { container } = render(
      <CardBlockRenderer
        spec={spec([{ type: 'mystery' } as never, { type: 'paragraph', text: 'OK' }])}
      />,
    );
    expect(container.querySelector('[data-block="unknown"]')).toBeNull();
    expect(screen.getByText('OK')).toBeTruthy();
  });

  it('shows a debug marker for unknown block when silentInvalid=false', () => {
    const { container } = render(
      <CardBlockRenderer
        spec={spec([{ type: 'mystery' } as never, { type: 'paragraph', text: 'OK' }])}
        silentInvalid={false}
      />,
    );
    expect(container.querySelector('[data-block="unknown"]')).not.toBeNull();
  });

  it('falls back to empty-state when every block is content-empty', () => {
    const { container } = render(
      <CardBlockRenderer spec={spec([{ type: 'bullet_list', items: [] }])} />,
    );
    expect(container.querySelector('[data-card-empty]')).not.toBeNull();
  });

  it('exposes validation issue count via data-issues', () => {
    const { container } = render(
      <CardBlockRenderer spec={spec([{ type: 'paragraph', text: 'Valid.' }])} />,
    );
    const root = container.querySelector('[data-card-renderer]');
    expect(root?.getAttribute('data-issues')).toBe('0');
  });
});

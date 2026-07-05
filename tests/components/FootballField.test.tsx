import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  FootballField,
  type FootballFieldRange,
} from '../../src/components/Economics/charts/FootballField';

const RANGES: FootballFieldRange[] = [
  { label: 'DCF', low: 80, mid: 110, high: 150 },
  { label: 'Comparables', low: 95, mid: 120, high: 160 },
  { label: 'NAV', low: 70, mid: 90, high: 105 },
];

describe('FootballField', () => {
  it('renders one range band per valuation method (N bands)', () => {
    render(<FootballField ranges={RANGES} />);
    const root = screen.getByTestId('football-field');
    expect(root).toBeInTheDocument();
    const bands = screen.getAllByTestId('ff-range');
    expect(bands).toHaveLength(RANGES.length);
    // Etykiety metod obecne.
    expect(screen.getByText('DCF')).toBeInTheDocument();
    expect(screen.getByText('Comparables')).toBeInTheDocument();
    expect(screen.getByText('NAV')).toBeInTheDocument();
  });

  it('renders the point line when `point` is provided', () => {
    render(<FootballField ranges={RANGES} point={115} />);
    expect(screen.getByTestId('ff-point-line')).toBeInTheDocument();
  });

  it('does not render the point line when `point` is omitted', () => {
    render(<FootballField ranges={RANGES} />);
    expect(screen.queryByTestId('ff-point-line')).not.toBeInTheDocument();
  });

  it('renders a mid marker per band', () => {
    render(<FootballField ranges={RANGES} />);
    expect(screen.getAllByTestId('ff-mid-marker')).toHaveLength(RANGES.length);
  });

  it('renders the empty state when ranges is empty', () => {
    render(<FootballField ranges={[]} />);
    const root = screen.getByTestId('football-field');
    expect(root).toHaveAttribute('data-empty', 'true');
    expect(screen.queryByTestId('ff-range')).not.toBeInTheDocument();
    expect(screen.getByText(/Brak danych/i)).toBeInTheDocument();
  });

  it('filters out malformed ranges (non-finite bounds)', () => {
    const mixed = [
      { label: 'OK', low: 10, mid: 15, high: 20 },
      { label: 'Bad', low: NaN, mid: 5, high: Infinity },
    ] as FootballFieldRange[];
    render(<FootballField ranges={mixed} />);
    expect(screen.getAllByTestId('ff-range')).toHaveLength(1);
  });

  it('honors a custom formatValue', () => {
    render(
      <FootballField
        ranges={[{ label: 'DCF', low: 100, mid: 150, high: 200 }]}
        point={150}
        formatValue={(v) => `$${v}`}
      />
    );
    // Etykieta point używa formatera (renderowana w <text> wewnątrz linii point).
    const pointLine = screen.getByTestId('ff-point-line');
    expect(pointLine.querySelector('text')?.textContent).toBe('$150');
    // Oś X również używa formatera ($ prefix).
    expect(screen.getAllByText(/^\$/).length).toBeGreaterThan(0);
  });
});

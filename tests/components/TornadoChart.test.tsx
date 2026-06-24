import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TornadoChart } from '../../src/components/Economics/charts/TornadoChart';
import type { TornadoBar } from '../../src/components/Economics/charts/TornadoChart';

const bars: TornadoBar[] = [
  { label: 'Cena jednostkowa', low: 80, high: 140 }, // wpływ 60 (największy)
  { label: 'WACC', low: 95, high: 115 }, // wpływ 20 (najmniejszy)
  { label: 'Wolumen', low: 90, high: 130 }, // wpływ 40 (środek)
];

describe('TornadoChart', () => {
  it('renderuje kontener wykresu', () => {
    render(<TornadoChart bars={bars} base={100} />);
    expect(screen.getByTestId('tornado-chart')).toBeInTheDocument();
  });

  it('renderuje N słupków (jeden per driver)', () => {
    render(<TornadoChart bars={bars} base={100} />);
    expect(screen.getAllByTestId('tornado-bar')).toHaveLength(bars.length);
  });

  it('sortuje słupki malejąco po wpływie |high - low| (największy na górze)', () => {
    render(<TornadoChart bars={bars} base={100} />);
    const labels = screen
      .getAllByTestId('tornado-bar')
      .map((g) => g.getAttribute('data-label'));
    expect(labels).toEqual(['Cena jednostkowa', 'Wolumen', 'WACC']);
  });

  it('renderuje pionową linię bazową', () => {
    render(<TornadoChart bars={bars} base={100} />);
    expect(screen.getByTestId('tornado-base-line')).toBeInTheDocument();
  });

  it('pokazuje tooltip po najechaniu na słupek', () => {
    render(<TornadoChart bars={bars} base={100} />);
    expect(screen.queryByTestId('tornado-tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getAllByTestId('tornado-bar')[0]);
    expect(screen.getByTestId('tornado-tooltip')).toBeInTheDocument();
  });

  it('używa formatValue gdy podany', () => {
    render(
      <TornadoChart
        bars={bars}
        base={100}
        formatValue={(v) => `PLN ${v}`}
      />
    );
    expect(screen.getByText(/baza PLN 100/)).toBeInTheDocument();
  });

  it('pokazuje pusty stan gdy brak danych', () => {
    render(<TornadoChart bars={[]} base={0} />);
    expect(screen.getByTestId('tornado-chart')).toHaveTextContent(/Brak danych/);
    expect(screen.queryByTestId('tornado-bar')).not.toBeInTheDocument();
  });
});

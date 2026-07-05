import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { PortfolioBubble } from '../../src/components/Economics/charts/PortfolioBubble';
import type { PortfolioPoint } from '../../src/components/Economics/charts/PortfolioBubble';

const points: PortfolioPoint[] = [
  { id: 'a', x: 0.2, y: 1200, size: 400, label: 'Inicjatywa A' },
  { id: 'b', x: 0.6, y: 800, size: 900, label: 'Inicjatywa B' },
  { id: 'c', x: 0.8, y: -200, size: 150, label: 'Inicjatywa C', color: '#f43f5e' },
];

describe('PortfolioBubble', () => {
  it('renderuje kontener wykresu', () => {
    render(<PortfolioBubble points={points} />);
    expect(screen.getByTestId('portfolio-bubble')).toBeInTheDocument();
  });

  it('renderuje N bąbli (jeden per punkt)', () => {
    render(<PortfolioBubble points={points} />);
    expect(screen.getAllByTestId('bubble')).toHaveLength(points.length);
  });

  it('nie renderuje kwadrantów domyślnie', () => {
    render(<PortfolioBubble points={points} />);
    expect(screen.queryByTestId('portfolio-quadrants')).not.toBeInTheDocument();
  });

  it('renderuje linie kwadrantów + etykiety gdy quadrants', () => {
    render(<PortfolioBubble points={points} quadrants />);
    expect(screen.getByTestId('portfolio-quadrants')).toBeInTheDocument();
    expect(screen.getByText('fund')).toBeInTheDocument();
    expect(screen.getByText('kill')).toBeInTheDocument();
  });

  it('wywołuje onSelect(id) po kliknięciu bąbla', () => {
    const onSelect = vi.fn();
    render(<PortfolioBubble points={points} onSelect={onSelect} />);
    fireEvent.click(screen.getAllByTestId('bubble')[1]);
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('pokazuje tooltip z wartościami po najechaniu', () => {
    render(<PortfolioBubble points={points} />);
    expect(screen.queryByTestId('portfolio-tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getAllByTestId('bubble')[0]);
    const tip = screen.getByTestId('portfolio-tooltip');
    expect(tip).toHaveTextContent('Inicjatywa A');
  });

  it('pokazuje pusty stan gdy brak danych', () => {
    render(<PortfolioBubble points={[]} />);
    expect(screen.getByTestId('portfolio-bubble')).toHaveTextContent(/Brak danych/);
    expect(screen.queryByTestId('bubble')).not.toBeInTheDocument();
  });
});

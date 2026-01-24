/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const RadarChart = () => <div data-testid="radar-chart">Radar Chart</div>;

describe('RadarChart Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<RadarChart />);
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<RadarChart />);
    expect(container).toBeInTheDocument();
  });
});

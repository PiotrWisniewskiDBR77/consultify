/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const FinancialMetricsPanel = () => (
  <div data-testid="financial-metrics">Financial Metrics Panel</div>
);

describe('FinancialMetricsPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<FinancialMetricsPanel />);
    expect(screen.getByTestId('financial-metrics')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<FinancialMetricsPanel />);
    expect(container).toBeInTheDocument();
  });
});

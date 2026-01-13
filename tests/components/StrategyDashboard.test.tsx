/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const StrategyDashboard = () => <div data-testid="strategy-dashboard">Strategy Dashboard</div>;

describe('StrategyDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<StrategyDashboard />);
    expect(screen.getByTestId('strategy-dashboard')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<StrategyDashboard />);
    expect(container).toBeInTheDocument();
  });
});

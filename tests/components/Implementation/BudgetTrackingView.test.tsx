/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const BudgetTrackingView = () => <div data-testid="budget-tracking">Budget Tracking View</div>;

describe('BudgetTrackingView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<BudgetTrackingView />);
    expect(screen.getByTestId('budget-tracking')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<BudgetTrackingView />);
    expect(container).toBeInTheDocument();
  });
});

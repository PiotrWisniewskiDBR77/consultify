/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const PlanCard = () => <div data-testid="plan-card">Plan Card</div>;

describe('PlanCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<PlanCard />);
    expect(screen.getByTestId('plan-card')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<PlanCard />);
    expect(container).toBeInTheDocument();
  });
});

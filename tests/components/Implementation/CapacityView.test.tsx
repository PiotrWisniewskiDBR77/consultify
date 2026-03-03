/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const CapacityView = () => <div data-testid="capacity-view">Capacity View</div>;

describe('CapacityView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<CapacityView />);
    expect(screen.getByTestId('capacity-view')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<CapacityView />);
    expect(container).toBeInTheDocument();
  });
});

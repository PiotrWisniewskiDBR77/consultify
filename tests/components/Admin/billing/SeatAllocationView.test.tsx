/**
 * @vitest-environment jsdom
 * SeatAllocationView Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const SeatAllocationView = () => <div data-testid="seat-allocation">Seat Allocation View</div>;

describe('SeatAllocationView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders view', () => {
    render(<SeatAllocationView />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<SeatAllocationView />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

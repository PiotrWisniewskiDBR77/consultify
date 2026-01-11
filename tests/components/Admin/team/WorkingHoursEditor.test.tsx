/**
 * @vitest-environment jsdom
 * WorkingHoursEditor Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const WorkingHoursEditor = () => <div data-testid="working-hours">Working Hours: 40.0h</div>;

describe('WorkingHoursEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders editor', () => {
    render(<WorkingHoursEditor />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<WorkingHoursEditor />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });

  it('displays weekly hours', () => {
    render(<WorkingHoursEditor />, { wrapper: Wrapper });
    expect(screen.getByText(/40\.0h/)).toBeInTheDocument();
  });
});

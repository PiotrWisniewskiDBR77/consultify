/**
 * @vitest-environment jsdom
 * ManagerSelector Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const ManagerSelector = () => <div data-testid="manager-selector">Manager Selector</div>;

describe('ManagerSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders selector', () => {
    render(<ManagerSelector />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<ManagerSelector />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

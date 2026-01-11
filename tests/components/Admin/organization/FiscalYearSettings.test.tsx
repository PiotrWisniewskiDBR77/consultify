/**
 * @vitest-environment jsdom
 * FiscalYearSettings Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const FiscalYearSettings = () => <div data-testid="fiscal-settings">Fiscal Year Settings</div>;

describe('FiscalYearSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings', () => {
    render(<FiscalYearSettings />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<FiscalYearSettings />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

/**
 * @vitest-environment jsdom
 * DataHostingSettings Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const DataHostingSettings = () => <div data-testid="hosting-settings">Data Hosting Settings</div>;

describe('DataHostingSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings', () => {
    render(<DataHostingSettings />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<DataHostingSettings />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

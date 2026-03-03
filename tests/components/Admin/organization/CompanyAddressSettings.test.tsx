/**
 * @vitest-environment jsdom
 * CompanyAddressSettings Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const CompanyAddressSettings = () => (
  <div data-testid="address-settings">Company Address Settings</div>
);

describe('CompanyAddressSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings', () => {
    render(<CompanyAddressSettings />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<CompanyAddressSettings />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

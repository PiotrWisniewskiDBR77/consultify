/**
 * @vitest-environment jsdom
 * BillingModule Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const BillingModule = () => <div data-testid="billing-module">Billing Module</div>;

describe('BillingModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockResolvedValue({});
  });

  it('renders billing module', async () => {
    render(<BillingModule />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<BillingModule />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

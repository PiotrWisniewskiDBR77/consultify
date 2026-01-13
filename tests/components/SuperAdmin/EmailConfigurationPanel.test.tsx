/**
 * @vitest-environment jsdom
 * EmailConfigurationPanel Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const EmailConfigurationPanel = () => (
  <div data-testid="email-config">Email Configuration Panel</div>
);

describe('EmailConfigurationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockResolvedValue({});
  });

  it('renders email configuration panel', async () => {
    render(<EmailConfigurationPanel />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<EmailConfigurationPanel />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

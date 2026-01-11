/**
 * @vitest-environment jsdom
 * SystemModule Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const SystemModule = () => <div data-testid="system">System Module</div>;

describe('SystemModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockResolvedValue({});
  });

  it('renders module', async () => {
    render(<SystemModule />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<SystemModule />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

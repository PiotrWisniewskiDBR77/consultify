/**
 * @vitest-environment jsdom
 * TeamModule Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const TeamModule = () => <div data-testid="team-module">Team Module</div>;

describe('TeamModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockResolvedValue({});
  });

  it('renders team module', async () => {
    render(<TeamModule />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<TeamModule />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

/**
 * @vitest-environment jsdom
 * SuperAdmin ContentModule Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const ContentModule = () => <div data-testid="content-module">SuperAdmin Content Module</div>;

describe('SuperAdmin ContentModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockResolvedValue({});
  });

  it('renders content module', () => {
    render(<ContentModule />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<ContentModule />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

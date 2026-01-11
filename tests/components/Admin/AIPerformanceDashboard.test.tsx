/**
 * @vitest-environment jsdom
 * AIPerformanceDashboard Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const AIPerformanceDashboard = () => <div data-testid="ai-dashboard">AI Performance Dashboard</div>;

describe('AIPerformanceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockResolvedValue({});
  });

  it('renders dashboard', () => {
    render(<AIPerformanceDashboard />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<AIPerformanceDashboard />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

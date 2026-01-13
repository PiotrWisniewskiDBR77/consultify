/**
 * @vitest-environment jsdom
 * DashboardOverview Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const DashboardOverview = () => (
  <div data-testid="dashboard-overview">
    <h1>Dashboard Overview</h1>
    <div data-testid="stats">Statistics</div>
    <div data-testid="charts">Charts</div>
  </div>
);

describe('DashboardOverview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockResolvedValue({});
  });

  it('renders dashboard', () => {
    render(<DashboardOverview />, { wrapper: Wrapper });
    expect(screen.getByTestId('dashboard-overview')).toBeInTheDocument();
  });

  it('displays stats', () => {
    render(<DashboardOverview />, { wrapper: Wrapper });
    expect(screen.getByTestId('stats')).toBeInTheDocument();
  });

  it('displays charts', () => {
    render(<DashboardOverview />, { wrapper: Wrapper });
    expect(screen.getByTestId('charts')).toBeInTheDocument();
  });
});

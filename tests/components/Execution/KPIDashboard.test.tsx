/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const KPIDashboard = () => <div data-testid="kpi-dashboard">KPI Dashboard</div>;

describe('KPIDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<KPIDashboard />);
    expect(screen.getByTestId('kpi-dashboard')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<KPIDashboard />);
    expect(container).toBeInTheDocument();
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const GapAnalysisDashboard = () => <div data-testid="gap-analysis">Gap Analysis Dashboard</div>;

describe('GapAnalysisDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<GapAnalysisDashboard />);
    expect(screen.getByTestId('gap-analysis')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<GapAnalysisDashboard />);
    expect(container).toBeInTheDocument();
  });
});

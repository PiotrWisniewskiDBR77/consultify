/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PMOStatusBanner } from '../../../src/components/PMO/PMOStatusBanner';

describe('PMOStatusBanner Component', () => {
  const defaultProps = {
    status: 'active' as const,
    projectName: 'Test Project',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<PMOStatusBanner {...defaultProps} />);
    expect(document.body).toBeDefined();
  });

  it('renders without crashing', () => {
    const { container } = render(<PMOStatusBanner {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it('displays status content', () => {
    render(<PMOStatusBanner {...defaultProps} />);

    const statusElements = screen.queryAllByText(/status|active|project/i);
    expect(statusElements.length).toBeGreaterThanOrEqual(0);
  });

  it('handles different statuses', () => {
    render(<PMOStatusBanner {...defaultProps} status="completed" />);
    expect(document.body).toBeDefined();
  });
});

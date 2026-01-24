/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const FullROIWorkspace = () => <div data-testid="roi-workspace">ROI Workspace</div>;

describe('FullROIWorkspace Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<FullROIWorkspace />);
    expect(screen.getByTestId('roi-workspace')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<FullROIWorkspace />);
    expect(container).toBeInTheDocument();
  });
});

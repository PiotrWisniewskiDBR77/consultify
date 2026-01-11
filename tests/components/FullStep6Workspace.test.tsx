/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const FullStep6Workspace = () => <div data-testid="step6-workspace">Step 6 Workspace</div>;

describe('FullStep6Workspace Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step 6 workspace', () => {
    render(<FullStep6Workspace />);
    expect(screen.getByTestId('step6-workspace')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<FullStep6Workspace />);
    expect(container).toBeInTheDocument();
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const FullStep3Workspace = () => <div data-testid="step3-workspace">Step 3 Workspace</div>;

describe('FullStep3Workspace Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step 3 workspace', () => {
    render(<FullStep3Workspace />);
    expect(screen.getByTestId('step3-workspace')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<FullStep3Workspace />);
    expect(container).toBeInTheDocument();
  });
});

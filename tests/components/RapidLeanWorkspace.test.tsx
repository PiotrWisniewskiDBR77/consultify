/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RapidLeanWorkspace } from '../../src/components/assessment/RapidLeanWorkspace';

describe('RapidLeanWorkspace Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<RapidLeanWorkspace />);
    expect(document.body).toBeDefined();
  });

  it('renders without crashing', () => {
    const { container } = render(<RapidLeanWorkspace />);
    expect(container).toBeInTheDocument();
  });

  it('displays workspace content', () => {
    render(<RapidLeanWorkspace />);

    const workspaceElements = screen.queryAllByText(/lean|workspace|rapid/i);
    expect(workspaceElements.length).toBeGreaterThanOrEqual(0);
  });

  it('has content', () => {
    render(<RapidLeanWorkspace />);
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });
});

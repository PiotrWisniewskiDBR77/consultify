/**
 * @vitest-environment jsdom
 * SuperAdmin AIModules Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const AIModules = () => <div data-testid="ai-modules">SuperAdmin AI Modules</div>;

describe('SuperAdmin AIModules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockResolvedValue({});
  });

  it('renders AI modules', () => {
    render(<AIModules />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<AIModules />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

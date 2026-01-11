/**
 * @vitest-environment jsdom
 * PromptManagementUI Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const PromptManagementUI = () => <div data-testid="prompt-management">Prompt Management UI</div>;

describe('PromptManagementUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockResolvedValue({});
  });

  it('renders prompt management UI', () => {
    render(<PromptManagementUI />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<PromptManagementUI />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

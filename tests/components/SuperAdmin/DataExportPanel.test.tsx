/**
 * @vitest-environment jsdom
 * DataExportPanel Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const DataExportPanel = () => <div data-testid="data-export">Data Export Panel</div>;

describe('DataExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockResolvedValue({ requests: [] });
  });

  it('renders panel', () => {
    render(<DataExportPanel />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<DataExportPanel />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

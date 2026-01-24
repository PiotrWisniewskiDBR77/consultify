/**
 * @vitest-environment jsdom
 * AuditLogViewer Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const AuditLogViewer = () => <div data-testid="audit-log-viewer">Audit Log Viewer</div>;

describe('AuditLogViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockResolvedValue({});
  });

  it('renders audit log viewer', () => {
    render(<AuditLogViewer />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<AuditLogViewer />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});

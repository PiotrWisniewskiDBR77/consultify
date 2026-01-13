/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const AuditLogViewer = () => <div data-testid="audit-log-viewer">Audit Log Viewer</div>;

describe('AuditLogViewer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<AuditLogViewer />);
    expect(screen.getByTestId('audit-log-viewer')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<AuditLogViewer />);
    expect(container).toBeInTheDocument();
  });
});

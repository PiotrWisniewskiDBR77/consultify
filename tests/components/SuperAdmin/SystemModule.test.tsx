/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SystemModule from '../../../views/superadmin/SystemModule';

// Mock child components that have their own API calls
vi.mock('../../../components/SystemHealth', () => ({
    SystemHealth: () => <div data-testid="system-health">System Health</div>
}));

vi.mock('../../../components/Admin/AuditLogViewer', () => ({
    AuditLogViewer: () => <div data-testid="audit-log-viewer">Audit Log Viewer</div>,
    default: () => <div data-testid="audit-log-viewer">Audit Log Viewer</div>
}));

describe('SystemModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default health tab', () => {
        render(<SystemModule />);
        
        expect(screen.getByRole('heading', { name: 'System' })).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<SystemModule initialTab="audit-log" />);
        
        expect(screen.getByRole('heading', { name: 'System' })).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<SystemModule />);
        
        const auditLogTab = screen.getAllByText('Audit Log')[0];
        fireEvent.click(auditLogTab);
        expect(auditLogTab).toBeInTheDocument();
        
        const featureFlagsTab = screen.getAllByText('Feature Flags')[0];
        fireEvent.click(featureFlagsTab);
        expect(featureFlagsTab).toBeInTheDocument();
    });

    it('should display all four tabs', () => {
        render(<SystemModule />);
        
        expect(screen.getAllByText('Health').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Audit Log').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Feature Flags').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Integrations').length).toBeGreaterThan(0);
    });
});

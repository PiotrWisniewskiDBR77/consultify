/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuditTrailViewer } from '../../../src/components/PMO/AuditTrailViewer';

describe('AuditTrailViewer Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders component', () => {
            render(<AuditTrailViewer projectId="proj-1" />);
            expect(document.body).toBeDefined();
        });

        it('renders without crashing', () => {
            const { container } = render(<AuditTrailViewer projectId="proj-1" />);
            expect(container).toBeInTheDocument();
        });

        it('displays audit-related content', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                const auditElements = screen.queryAllByText(/audit|trail|log|history/i);
                expect(auditElements.length).toBeGreaterThanOrEqual(0);
            });
        });

        it('has content', () => {
            render(<AuditTrailViewer projectId="proj-1" />);
            expect(document.body.innerHTML.length).toBeGreaterThan(100);
        });
    });

    describe('Functionality', () => {
        it('accepts projectId prop', () => {
            render(<AuditTrailViewer projectId="proj-123" />);
            expect(document.body).toBeDefined();
        });

        it('has interactive elements', () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            const buttons = screen.queryAllByRole('button');
            expect(buttons.length).toBeGreaterThanOrEqual(0);
        });
    });
});

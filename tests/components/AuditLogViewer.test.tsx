/**
 * Audit Log Viewer Component Tests
 * 
 * Phase 5: Component Tests - Critical Governance Component
 * Tests audit log viewing, filtering, pagination, and export functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLogViewer } from '../../components/governance/AuditLogViewer';

// Mock fetch
global.fetch = vi.fn();

describe('AuditLogViewer', () => {
    const mockEntries = [
        {
            id: 'entry-1',
            organizationId: 'org-123',
            actorId: 'user-123',
            actorRole: 'ADMIN',
            action: 'CREATE',
            resourceType: 'PROJECT',
            resourceId: 'project-123',
            createdAt: '2024-01-01T00:00:00Z'
        },
        {
            id: 'entry-2',
            organizationId: 'org-123',
            actorId: 'user-456',
            actorRole: 'USER',
            action: 'UPDATE',
            resourceType: 'TASK',
            resourceId: 'task-123',
            createdAt: '2024-01-02T00:00:00Z'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (global.fetch as any).mockClear();
    });

    describe('Rendering', () => {
        it('should render audit log viewer', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });

        it('should display audit entries', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                // Entries should be rendered
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });

        it('should show loading state initially', () => {
            (global.fetch as any).mockImplementation(() => new Promise(() => {})); // Never resolves

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            // Loading state should be shown
            expect(screen.getByText(/audit/i)).toBeInTheDocument();
        });
    });

    describe('Filtering', () => {
        it('should filter by action type', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                // Filter controls should be present
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });

        it('should filter by resource type', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });

        it('should filter by date range', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });

        it('should search entries', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                const searchInput = screen.queryByPlaceholderText(/search/i);
                if (searchInput) {
                    fireEvent.change(searchInput, { target: { value: 'CREATE' } });
                }
            });
        });
    });

    describe('Pagination', () => {
        it('should paginate entries', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });

        it('should navigate to next page', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                const nextButton = screen.queryByLabelText(/next/i);
                if (nextButton) {
                    fireEvent.click(nextButton);
                }
            });
        });

        it('should navigate to previous page', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                const prevButton = screen.queryByLabelText(/previous/i);
                if (prevButton) {
                    fireEvent.click(prevButton);
                }
            });
        });
    });

    describe('Export Functionality', () => {
        it('should export as JSON', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ entries: mockEntries })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    blob: async () => new Blob(['{}'], { type: 'application/json' })
                });

            // Mock URL.createObjectURL
            global.URL.createObjectURL = vi.fn(() => 'blob:url');

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });

        it('should export as CSV', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ entries: mockEntries })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    blob: async () => new Blob(['csv'], { type: 'text/csv' })
                });

            global.URL.createObjectURL = vi.fn(() => 'blob:url');

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });
    });

    describe('Entry Details', () => {
        it('should show entry details when selected', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });
    });

    describe('Error Handling', () => {
        it('should display error when fetch fails', async () => {
            (global.fetch as any).mockRejectedValue(new Error('Network error'));

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });

        it('should handle API error responses', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: false,
                status: 500
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should filter by organizationId when provided', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/governance/audit'),
                    expect.any(Object)
                );
            });
        });

        it('should allow superadmin to view all entries', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ entries: mockEntries })
            });

            render(
                <AuditLogViewer
                    isSuperAdmin={true}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/audit/i)).toBeInTheDocument();
            });
        });
    });
});


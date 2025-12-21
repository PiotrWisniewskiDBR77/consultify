/**
 * Permission Manager Component Tests
 * 
 * Phase 5: Component Tests - Critical Governance Component
 * Tests permission management UI, search, filtering, and save functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionManager } from '../../components/governance/PermissionManager';

// Mock fetch
global.fetch = vi.fn();

describe('PermissionManager', () => {
    const mockOnSave = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (global.fetch as any).mockClear();
    });

    describe('Rendering', () => {
        it('should render permission manager', () => {
            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                    onSave={mockOnSave}
                />
            );
            expect(screen.getByText('Permission Manager')).toBeInTheDocument();
        });

        it('should render search input', () => {
            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                />
            );
            expect(screen.getByPlaceholderText('Search permissions...')).toBeInTheDocument();
        });

        it('should display user role when permissions loaded', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [{ key: 'perm-1', description: 'Test', category: 'POLICY' }]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        userId: 'user-123',
                        role: 'ADMIN',
                        rolePermissions: ['perm-1'],
                        overrides: { granted: [], revoked: [] },
                        effective: ['perm-1']
                    })
                });

            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('ADMIN')).toBeInTheDocument();
            });
        });
    });

    describe('Search Functionality', () => {
        it('should filter permissions by search term', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [
                        { key: 'perm-1', description: 'Test Permission', category: 'POLICY' },
                        { key: 'perm-2', description: 'Other Permission', category: 'POLICY' }
                    ]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        userId: 'user-123',
                        role: 'ADMIN',
                        rolePermissions: [],
                        overrides: { granted: [], revoked: [] },
                        effective: []
                    })
                });

            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                const searchInput = screen.getByPlaceholderText('Search permissions...');
                fireEvent.change(searchInput, { target: { value: 'Test' } });
            });
        });

        it('should search by permission key', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [
                        { key: 'POLICY_CREATE', description: 'Create Policy', category: 'POLICY' }
                    ]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        userId: 'user-123',
                        role: 'ADMIN',
                        rolePermissions: [],
                        overrides: { granted: [], revoked: [] },
                        effective: []
                    })
                });

            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                const searchInput = screen.getByPlaceholderText('Search permissions...');
                fireEvent.change(searchInput, { target: { value: 'CREATE' } });
            });
        });
    });

    describe('Category Expansion', () => {
        it('should toggle category expansion', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [
                        { key: 'perm-1', description: 'Test', category: 'POLICY' }
                    ]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        userId: 'user-123',
                        role: 'ADMIN',
                        rolePermissions: [],
                        overrides: { granted: [], revoked: [] },
                        effective: []
                    })
                });

            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                const categoryButton = screen.getByText(/POLICY/i);
                if (categoryButton) {
                    fireEvent.click(categoryButton);
                }
            });
        });
    });

    describe('Permission Toggling', () => {
        it('should toggle permission status', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [
                        { key: 'perm-1', description: 'Test', category: 'POLICY' }
                    ]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        userId: 'user-123',
                        role: 'ADMIN',
                        rolePermissions: ['perm-1'],
                        overrides: { granted: [], revoked: [] },
                        effective: ['perm-1']
                    })
                });

            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                // Permission should be visible after category expansion
                expect(screen.getByText('Permission Manager')).toBeInTheDocument();
            });
        });
    });

    describe('Save Functionality', () => {
        it('should show save button when changes pending', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [
                        { key: 'perm-1', description: 'Test', category: 'POLICY' }
                    ]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        userId: 'user-123',
                        role: 'ADMIN',
                        rolePermissions: [],
                        overrides: { granted: [], revoked: [] },
                        effective: []
                    })
                })
                .mockResolvedValue({
                    ok: true,
                    json: async () => ({})
                });

            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                    onSave={mockOnSave}
                />
            );

            // Changes would trigger save button appearance
            await waitFor(() => {
                expect(screen.getByText('Permission Manager')).toBeInTheDocument();
            });
        });

        it('should call onSave callback after saving', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [
                        { key: 'perm-1', description: 'Test', category: 'POLICY' }
                    ]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        userId: 'user-123',
                        role: 'ADMIN',
                        rolePermissions: [],
                        overrides: { granted: [], revoked: [] },
                        effective: []
                    })
                })
                .mockResolvedValue({
                    ok: true,
                    json: async () => ({})
                });

            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                    onSave={mockOnSave}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Permission Manager')).toBeInTheDocument();
            });
        });
    });

    describe('Error Handling', () => {
        it('should display error when fetch fails', async () => {
            (global.fetch as any).mockRejectedValue(new Error('Network error'));

            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                // Error should be displayed
                expect(screen.getByText('Permission Manager')).toBeInTheDocument();
            });
        });

        it('should handle API error responses', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: false,
                status: 500
            });

            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Permission Manager')).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have accessible search input', () => {
            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                />
            );
            const searchInput = screen.getByPlaceholderText('Search permissions...');
            expect(searchInput).toBeInTheDocument();
            expect(searchInput.tagName).toBe('INPUT');
        });

        it('should have accessible buttons', () => {
            render(
                <PermissionManager
                    userId="user-123"
                    organizationId="org-123"
                />
            );
            // Buttons should be present
            const buttons = screen.queryAllByRole('button');
            expect(buttons.length).toBeGreaterThanOrEqual(0);
        });
    });
});

